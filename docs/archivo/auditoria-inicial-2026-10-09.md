> Informe preliminar conservado como antecedente. Fue sustituido por [la auditoría integral](../auditoria-integral-2026-10-09.md); algunas conclusiones sobre Mem0 y Beads se corrigieron al ampliar las verificaciones.

# Auditoría de reanudación de Ondina

Fecha: 9 de octubre de 2026, America/Santiago. Repositorio: `/home/cristhian/Documents/ondina`. Revisión de código y despliegue: `38b60b00c6dc5b41c37472c02d2f2f081ab7ac3e`.

## Diagnóstico

El proyecto se puede retomar y el frontend publicado está disponible. La página principal y `/login` responden HTTP 200, y el navegador muestra el formulario de acceso sin errores de consola capturados. Vercel informa que el último despliegue de producción está READY. El frontend también arranca localmente y pasa lint, compilación y 99 tests.

Supabase respondió inicialmente con timeouts e hibernación en sus herramientas de consulta. Tras comprobar los endpoints de Auth y REST con la clave pública local, las consultas SQL y los advisors respondieron correctamente. Esto confirma disponibilidad al finalizar la auditoría; no demuestra que no existieran interrupciones antes de ella.

La principal deuda para reanudar operaciones es la seguridad de vistas y permisos, la falta de correspondencia entre el historial remoto de migraciones y los archivos locales, y la configuración incompleta de las herramientas de seguimiento. La disponibilidad del login no equivale a una validación de todos los flujos del negocio.

## Acceso a servicios y herramientas

| Servicio | Evidencia | Limitación |
|---|---|---|
| Supabase plugin | Proyecto `ondina-erp`, ref `rhivlzwtobhiguzmkiat`, ACTIVE_HEALTHY; SQL, migraciones y advisors consultados | No se aplicaron migraciones ni se probaron escrituras operativas |
| Vercel plugin | Proyecto `prj_uOyPIotyMKPyB4zVTP7AD7cSZpp1`, configuración y despliegues consultados | El parámetro explícito teamId devolvió 403; las lecturas funcionan con el ámbito predeterminado. No se probó publicar |
| GitHub plugin | Repositorio encontrado, permisos reportados, ramas, PRs, comparaciones y estado del commit consultados | El endpoint de protección detallada de main devuelve 403 para la integración |
| CodeGraph | MCP y CLI disponibles; consultas de fuente y relaciones realizadas antes de leer código | Motor 1.6.0; índice construido con 1.0.1. Conviene actualizarlo para aprovechar el parser actual |
| Beads | CLI 1.0.4; recuperación de contexto, estadísticas, creación, asignación, notas y cierre probados | Funciona localmente; no existe remoto Dolt configurado y `bd doctor` no está soportado en modo embedded |
| Mem0 plugin | Búsqueda semántica y listado respondieron sin errores | Cero memorias en el ámbito predeterminado actual; no se probaron escrituras ni otros ámbitos |

CodeGraph contiene 97 archivos, 797 nodos y 2.069 relaciones. Su estado indica que está al día respecto de los archivos, aunque la versión del parser que construyó el índice es antigua. Sirve para navegación estructural; lint, compilación y tests siguen siendo la evidencia de corrección.

Mem0 está accesible desde Codex. La declaración de `@mem0/opencode-plugin` en `opencode.json` no demuestra por sí misma que la integración de OpenCode esté operativa. Para uso correcto: Beads conserva tareas y dependencias; Mem0 puede recuperar contexto y preferencias con un ámbito explícito; las afirmaciones sobre infraestructura deben comprobarse en vivo. Esta auditoría no guardó nuevas memorias en Mem0.

## Repositorio y ramas

`main`, `develop`, sus referencias locales y los heads remotos están en `38b60b0`. El último cambio es del 22 de agosto de 2026 en horario de Chile. No hay PRs abiertos. GitHub indica que main está protegida, pero sus reglas detalladas no fueron accesibles mediante el plugin. Los últimos workflows de CI y despliegue de ambas ramas terminaron con éxito; son ejecuciones de agosto, no validaciones nuevas de CI.

| Rama comparada con develop | Commits exclusivos de la rama | Commits que le faltan de develop |
|---|---:|---:|
| feature/ventas | 23 | 79 |
| feature/bodega | 0 | 54 |
| feature/produccion | 0 | 44 |
| feature/administracion | 3 | 89 |

Las divergencias de ventas pueden incluir historia duplicada por el flujo de integración; los números no prueban que existan 23 funcionalidades pendientes. Administración presenta numerosas eliminaciones de documentación, skills y configuración en su comparación. Requiere revisión antes de integrar. Hay tres stashes antiguos; se conservaron porque pueden contener trabajo recuperable.

SSH falla con la configuración predeterminada por permisos de `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf`. La conexión al remoto funciona con `git -c core.sshCommand='ssh -F /dev/null' ...`. No se modificó la configuración SSH del sistema.

## Aplicación y alcance funcional

La aplicación usa React, Vite y TypeScript, Tailwind/Mantine, TanStack Query, React Hook Form/Zod y Supabase. Los dominios de ventas, bodega, producción y administración se componen dentro de una sola aplicación. Auth es compartido y las escrituras de stock dependen de la base de datos.

| Dominio | Estado observado |
|---|---|
| Ventas | Registro de ventas y clientes, carga, cartera, gastos, ranking y comisión implementados. Documentos y upload de comprobantes siguen fuera del alcance documentado |
| Bodega | Despachos, devoluciones, existencias y corrección administrativa parcial. Ajustes y mermas generales necesitan revisar su cobertura de UI |
| Producción | Registro, historial, indicadores, disponibilidad de envases y mermas implementados. Existe un perfil de producción en la base actual |
| Administración | Administración, reportes, geolocalización y auditoría son cuatro páginas placeholder. Gestión de usuarios, catálogo y otras funcionalidades administrativas siguen pendientes de UI |

La documentación funcional contiene discrepancias: su resumen numérico no coincide con todas las filas y describe RPC de producción/devoluciones que no usa el código actual. Producción y devoluciones escriben directamente en sus tablas; ventas y despacho usan RPC. Por eso no debe interpretarse la ausencia de aquellas RPC como una caída del sistema.

El README conserva una sección que afirma que no existe frontend y referencia `AGENTS_para_equipo_desarrollo.md`, inexistente. Para retomar, el código, los comandos ejecutados y el esquema remoto observado ofrecen evidencia más actual que ese párrafo.

## Supabase: disponibilidad y riesgos

Auth `/auth/v1/health` respondió HTTP 200. Las consultas REST de productos y perfiles con `limit=0` respondieron HTTP 200 sin extraer registros personales. La URL local coincide con el proyecto auditado y la clave utilizada es del rol público `anon`.

La consulta de catálogo confirmó 23 tablas públicas con RLS habilitado y políticas. Hay seis perfiles: dos vendedores, uno de producción, uno de bodega y dos administradores. Se observaron 16 triggers no internos sobre tablas públicas. Estos conteos no sustituyen pruebas de autorización o reversión de stock.

Los advisors de seguridad reportaron:

- Dos errores por vistas con privilegios del propietario: `v_comision_vendedor` y `v_ranking_vendedores`.
- Dieciséis advertencias de funciones SECURITY DEFINER ejecutables por anon y diecinueve por authenticated.
- Protección de contraseñas filtradas deshabilitada.

La comprobación adicional confirmó que ambas vistas conceden SELECT a anon y authenticated, carecen de `security_invoker` y no contienen filtros por el usuario actual en su definición. Es un riesgo concreto de exposición de información comercial que debe atenderse primero. [Documentación oficial de vistas](https://supabase.com/docs/guides/database/views) y [remediación del advisor](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).

Las advertencias de funciones requieren análisis individual: varias son funciones trigger, y `corregir_devolucion` tiene una guarda de administrador. Un permiso excesivo no prueba por sí solo una operación anónima explotable. [Remediación de funciones para anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Hay diez archivos locales `0001`–`0010`, mientras que el historial remoto contiene cinco versiones timestamp. Objetos de bodega y producción existen en el catálogo pese a que ese historial no refleja las diez migraciones locales. Esto exige reconciliar esquema e historial antes de ejecutar `supabase db push`; no significa simplemente que falten cinco migraciones. No se verificó una restauración desde cero ni la recuperación de backups.

La publicación `supabase_realtime` no contiene tablas. La actualización automática prevista por producción necesita revisar esa configuración. No hay buckets de Storage, consistente con el upload de comprobantes pendiente.

Rendimiento: 48 claves foráneas sin índice de cobertura, 21 advertencias sobre evaluación repetida de funciones de Auth en RLS y dos índices sin uso observado. Son avisos de optimización; no demuestran una lentitud actual. [Índices de claves foráneas](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) y [RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).

## Calidad y entorno

| Comprobación ejecutada | Resultado |
|---|---|
| npm run lint | Exit 0 |
| npm run build | Exit 0; JavaScript 911,39 kB, gzip 258,90 kB |
| npm run test -- --reporter=dot | 99/99 tests, 15 archivos |
| npm ls --depth=0 | Dependencias instaladas válidas |
| npm run dev -- --host 127.0.0.1 | Vite arrancó en localhost:5173 y el navegador mostró login |

El build avisa por un bundle superior a 500 kB y una prueba de despachos emite advertencias de React `act`. No impidieron pasar las verificaciones. Los tests usan servicios simulados; no validan las escrituras contra el Supabase real. No se encontró una suite E2E o k6 ejecutable en el inventario revisado.

Node es 26.3.1 localmente, 24.x en Vercel y 22 en CI. Conviene elegir una versión compartida. CI comprueba lint/build/tests, pero su chequeo SQL solo busca punto y coma: no valida sintaxis con PostgreSQL ni aplica migraciones. Los workflows usan `vercel@latest`; desarrollo despliega sin depender del job de CI y producción depende de su propio job de verificación.

## Seguimiento de la reanudación

La auditoría se registró y cerró en `OND-o9d`. Los hallazgos se conservan como issues locales en la base Dolt de Beads:

- `OND-8ox`: exposición de vistas y revisión de permisos RPC, prioridad 1.
- `OND-8wi`: reconciliación del esquema remoto y migraciones, prioridad 1.
- `OND-jf6`: alineación de herramientas y documentación, prioridad 2.

Antes de la auditoría había 17 issues cerrados y ninguno abierto. La creación de estos issues no los sincroniza con otro equipo: `bd dolt remote list` indica que no hay remoto y `bd dolt push` omite el envío. Declarar `sync.remote` en YAML no está produciendo una sincronización efectiva en este entorno. [Documentación oficial de sincronización](https://github.com/gastownhall/beads/blob/main/docs/getting-started/sync-setup.md).

`core.hooksPath` apunta a `/home/cristhian/Downloads/Ondina/.beads/hooks`, que ya no existe. Además, `.beads/issues.jsonl` y `.beads/metadata.json` siguen versionados, en contradicción con las instrucciones actuales. Los exports generados por esta auditoría se devolvieron a sus bytes originales; las tareas permanecen en la base Dolt. No se borraron stashes ni se alteraron hooks o remotos.

Este informe se guarda en `referencia_archivos/`, carpeta ignorada por Git. No se modificaron código, migraciones ni datos operativos. Las comprobaciones disponibles permiten retomar el desarrollo; la habilitación completa del negocio aún necesita pruebas por rol y pruebas de escritura en un entorno aislado.
