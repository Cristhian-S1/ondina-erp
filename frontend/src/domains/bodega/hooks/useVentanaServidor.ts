import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerVentanaAjuste } from '../api'
import { ventanaDesdeServidor } from '../ventanaAjuste'

// HU-26: ventana configurada y desfase con el reloj del servidor, una vez por carga de página.
// Es accesorio: si la RPC falla o no responde, la pista usa el valor por defecto y nunca rompe la página.
export function useVentanaServidor() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['bodega-ventana-ajuste', perfil?.id, perfil?.rol],
    enabled: !!perfil,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const respuesta = await obtenerVentanaAjuste()
        return respuesta ? ventanaDesdeServidor(respuesta, Date.now()) : null
      } catch {
        return null
      }
    },
  })
}
