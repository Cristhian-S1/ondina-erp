import type { useDatosBodega } from '../hooks/useDatosBodega'
import type { usePaginaBodega } from '../hooks/usePaginaBodega'

export type RecursosDespacho = NonNullable<ReturnType<typeof useDatosBodega>['data']>
export type PaginaDespachos = NonNullable<ReturnType<typeof usePaginaBodega>['data']>
export type FiltroDia = 'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'
