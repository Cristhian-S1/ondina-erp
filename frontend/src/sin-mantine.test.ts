import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.(ts|tsx|css)$/.test(nombre) && nombre !== 'sin-mantine.test.ts' ? [ruta] : []
  })
}

describe('dependencias retiradas', () => {
  it('el código no importa @mantine ni dayjs', () => {
    const ofensores = archivos(__dirname).filter((ruta) =>
      /@mantine|dayjs/.test(readFileSync(ruta, 'utf8')),
    )
    expect(ofensores).toEqual([])
  })
})
