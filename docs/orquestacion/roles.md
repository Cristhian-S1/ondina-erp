# Roles y cantidad propuesta de subagentes

Propuesta para un ERP React/Vite con Supabase; no es una obligación de iniciar todos los roles. Los modelos quedan a elección del usuario.

| Área | Slots del catálogo | Activación recomendada | Responsabilidad |
| --- | ---: | --- | --- |
| Coordinación | 1 | Durante una ejecución supervisada | Alcance, Beads, DAG de Orca, propiedad, validación e integración. |
| Frontend | 2 | 1 normalmente; 2 con archivos independientes | UI/accesibilidad y servicios/datos/formularios. |
| Backend/Supabase | 2 | 1 normalmente; 2 con contratos y entornos separados | Esquema/RLS e integridad/RPC/stock. |
| Testing | 1 | Preparación o revisión de entregables | Vitest, recorridos y pruebas SQL/roles en aislamiento. |
| Documentación | 1 | Tras decisiones y evidencia disponibles | HU, procedimientos, trazabilidad y enlaces. |
| CI/CD y operación | 1 | Si la tarea afecta integración/despliegue | Checks reales, entorno reproducible, rollback y observabilidad. |
| Seguridad/revisión | 1 | Hallazgos de riesgo o revisión final | Auth, RLS/grants, secretos, aislamiento y revisión independiente. |

**Catálogo:** 8 slots de workers + 1 coordinador. **Concurrencia inicial:** como máximo 3 workers + coordinador. Para cambios pequeños, reducirlo a 1 worker y una revisión.
No aumentar concurrencia por disponibilidad de slots: hacerlo solo si hay trabajo independiente, capacidad del equipo y presupuesto.

## Propiedad de archivos
- frontend-ui: componentes y páginas asignadas; coordinar con frontend-data los archivos de formularios y hooks compartidos.
- frontend-data: servicios, consultas y validación asignados; no rediseñar contratos RPC unilateralmente.
- backend-schema: migraciones y políticas asignadas; responsable de serializar el orden de integración.
- backend-rpc: funciones, triggers y operaciones de negocio asignadas; no modificar una migración que otro worker tenga en propiedad.
- testing: tests/fixtures asignados y evidencia de ejecución; los arreglos de implementación se devuelven a su propietario.
- documentation: documentos asignados; esperar evidencia antes de marcar una HU validada.
- ci-cd: workflows y configuración asignados; secretos y aprobaciones permanecen fuera del archivo.
- security: revisión de lectura por defecto; una corrección requiere tarea y propiedad explícitas.

Reservar un único escritor para lib/supabase, tipos compartidos, lockfile, migraciones y reglas raíz. El QA no arregla esos archivos mientras otro worker los posee.

## Olas sugeridas
1. Aclarar contrato, alcance y criterios en el coordinador; conservar decisiones en Beads/docs.
2. Frontend y backend implementan en worktrees independientes; testing puede preparar pruebas sin escribir implementación compartida.
3. Testing y seguridad validan los cambios candidatos. El coordinador devuelve hallazgos al propietario y verifica los arreglos.
4. Documentación y CI/CD terminan lo que corresponda. El coordinador revisa integración, publica dentro del alcance y cierra los intentos.

Un backend compartido impone serialización: no ejecutar dos migraciones contra el mismo entorno ni usar producción como fixture.
