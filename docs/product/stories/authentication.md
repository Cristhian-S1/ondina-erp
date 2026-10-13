# Acceso y roles

Criterios del producto; consultar [requisitos](../requirements.md) y [estado de implementación](../../status/user-stories.md) sin confundirlos con validación de producción.

## HU-31

**Ingresar al sistema con credenciales y rol** · RNF-07, RNF-08 · Todos los roles

Como usuario, quiero ingresar al sistema con mis credenciales personales y acceder únicamente a las funciones de mi rol, para proteger la información del negocio y evitar manipulaciones.

**Aceptación:**

- Dado un usuario habilitado, cuando ingresa credenciales válidas, entonces el sistema le da acceso solo a las funcionalidades permitidas para su rol (Vendedor, Bodega/Despacho, Producción o Administrador).
- Dado un usuario con credenciales inválidas o deshabilitado, cuando intenta ingresar, entonces el sistema rechaza el acceso.
- Cada acción realizada queda asociada al usuario autenticado (RNF-12).
