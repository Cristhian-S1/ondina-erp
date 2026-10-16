import { useState } from 'react'

export function usePaginaProduccion(ambito: string) {
  const [estado, setEstado] = useState({ ambito, pagina: 1 })
  if (estado.ambito !== ambito) setEstado({ ambito, pagina: 1 })
  return { pagina: estado.ambito === ambito ? estado.pagina : 1,
    setPagina: (pagina: number) => setEstado({ ambito, pagina }) }
}
