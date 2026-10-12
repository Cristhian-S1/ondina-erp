# Plantilla de Task para un worker Orca

Esta es una spec de ejecución, no un tracker alternativo. Conservar el seguimiento en Beads y enviar su texto a Orca con el comando de la versión instalada.

## Identidad y contexto
- Beads: ID real del issue y enlace GitHub si existe.
- Rol: uno de los definidos en roles.md.
- Referencias: requisito, HU, spec y decisiones pertinentes.
- Base: commit/ref verificado y selector de worktree emitido por Orca.

## Resultado
Describir el comportamiento o documento que debe quedar y qué problema resuelve. Incluir datos y casos concretos.

## Propiedad
Enumerar rutas que puede editar, rutas compartidas que debe coordinar y archivos fuera de alcance. Nombrar el propietario que recibe un hallazgo que no le corresponde corregir.

## Restricciones
Indicar el entorno de datos, clientes/herramientas disponibles, invariantes de seguridad y compatibilidad. Aplicar AGENTS y skills pertinentes sin cargar todo el catálogo.
No ampliar permisos, publicar ni desplegar fuera de la autorización de la tarea. El preámbulo vivo de Orca aporta los IDs y comandos; esta plantilla no los inventa.

## Aceptación observable
Describir comandos o escenarios y los resultados que prueban éxito. Diferenciar sintaxis, mocks, integración y comportamiento desplegado.
Precisar los casos límite: permisos, otra sucursal, sesión, concurrencia, stock y anulación si la tarea los afecta.

## Entrega
Enviar el worker_done del preámbulo con outcome explícito y evidencia real. Reportar archivos, commit/diff, pruebas, resultados y límites.
Leer las últimas indicaciones del coordinador antes del cierre. Después del reporte, quedar inactivo hasta la decisión de reutilización, retención o liberación.
