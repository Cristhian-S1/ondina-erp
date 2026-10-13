import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RankingVendedores from './RankingVendedores'
import { obtenerRankingVendedores } from '../api'
import type { RankingVendedor } from '../api'

vi.mock('../api', () => ({ obtenerRankingVendedores: vi.fn() }))
vi.mock('@mantine/dates', () => ({
  MonthPickerInput: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Seleccionar período" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

function pendiente() {
  let resolve!: (data: RankingVendedor[]) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<RankingVendedor[]>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const fila: RankingVendedor = {
  vendedor_id: 'u-1', sucursal_id: 's-1', vendedor: 'Vendedor vigente',
  mes: '2026-01-01', cantidad_ventas: 3, total_vendido: 3000,
}

describe('FE-06 · ranking vigente', () => {
  it.each(['éxito', 'error'])('ignora una respuesta anterior de %s después de cambiar el período', async (resultado) => {
    const anterior = pendiente()
    const vigente = pendiente()
    vi.mocked(obtenerRankingVendedores).mockReset()
    vi.mocked(obtenerRankingVendedores).mockReturnValueOnce(anterior.promise).mockReturnValueOnce(vigente.promise)
    render(<RankingVendedores />)
    fireEvent.change(screen.getByLabelText('Seleccionar período'), { target: { value: '2026-01-01' } })
    await waitFor(() => expect(obtenerRankingVendedores).toHaveBeenCalledTimes(2))
    await act(async () => { vigente.resolve([fila]) })
    expect(screen.getByText('Vendedor vigente')).toBeInTheDocument()
    await act(async () => {
      if (resultado === 'éxito') anterior.resolve([{ ...fila, vendedor: 'Vendedor anterior' }])
      else anterior.reject(new Error('Solicitud anterior fallida'))
    })
    expect(screen.getByText('Vendedor vigente')).toBeInTheDocument()
    expect(screen.queryByText('Vendedor anterior')).not.toBeInTheDocument()
    expect(screen.queryByText(/No fue posible/)).not.toBeInTheDocument()
  })

  it('no termina la carga actual cuando termina una solicitud anterior', async () => {
    const anterior = pendiente()
    const vigente = pendiente()
    vi.mocked(obtenerRankingVendedores).mockReset()
    vi.mocked(obtenerRankingVendedores).mockReturnValueOnce(anterior.promise).mockReturnValueOnce(vigente.promise)
    render(<RankingVendedores />)
    fireEvent.change(screen.getByLabelText('Seleccionar período'), { target: { value: '2026-01-01' } })
    await act(async () => { anterior.resolve([fila]) })
    expect(screen.getByText('Cargando ranking...')).toBeInTheDocument()
    await act(async () => { vigente.resolve([]) })
    expect(screen.getByText(/No hay ventas registradas/)).toBeInTheDocument()
  })
})
