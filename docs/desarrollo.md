# Desarrollo de Ondina

## Entorno y comandos
Usar Node 22.12 o posterior y ejecutar en frontend/: npm ci, npm run dev, npm run lint, npm run build y npm run test. Copiar frontend/.env.example a frontend/.env y completar un proyecto de desarrollo. Las claves privilegiadas de Supabase no pertenecen al navegador.

## Estructura y convenciones
Hay una aplicación React/Vite. Los dominios viven en frontend/src/domains/ y se componen mediante DomainModule. La UI consume servicios; las reglas no triviales se prueban a través de su interfaz pública.
TypeScript es estricto y requiere import type para tipos. Componentes PascalCase, hooks useCamelCase, utilidades camelCase y mensajes en español.
Las convenciones visuales están en [convenciones de frontend](convenciones-frontend.md); conservar los estilos de error compartidos, Toast y responsividad de tablets.

## Git y revisión
develop es integración; main contiene versiones aprobadas para producción. El trabajo de dominio se integra por PR desde feature/ventas, feature/bodega, feature/produccion y feature/administracion. Una petición explícita puede autorizar cambios directos en develop.
Usar Conventional Commits en español, imperativo y hasta 72 caracteres. Referenciar HU o issue cuando corresponda. El PR explica problema, resultado, evidencia y límites.
Conservar stashes y trabajo ajeno. Revisar git status y el diff antes de publicar. El alcance autorizado define si corresponde publicar, crear PR o conservar un borrador local.

## Calidad
Al cambiar frontend, ejecutar lint y build y las pruebas que ejerciten el comportamiento afectado. Los tests actuales usan Vitest y Testing Library; no certifican por sí solos RLS, triggers o RPC remotas.
La estrategia de integración, pruebas SQL y recorridos autenticados sigue pendiente en [los issues](https://github.com/Cristhian-S1/ondina-erp/issues).
Para documentación, verificar enlaces, fechas y comandos. Para scripts, comprobar sintaxis y el recorrido real en un entorno aislado; no probar con datos de producción.

## Alcance
[Estado de las HU](estado-historias-usuario.md) distingue implementación histórica de validación. Decisiones de negocio pendientes deben confirmarse y registrarse, no resolverse por suposición.
Ver [base de datos](base-de-datos.md), [herramientas](herramientas-agentes.md) y [orquestación](orquestacion/README.md).
