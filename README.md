# Ondina

Sistema web para gestionar ventas, clientes, despacho, bodega y producción de una empresa distribuidora de agua embotellada y hielo.

La aplicación será utilizada principalmente desde tablets por vendedores, personal de bodega y producción. Administración utilizará también computadores para consultar y controlar la operación.

## Documentación Principal

- `AGENTS_para_equipo_desarrollo.md`: convenciones obligatorias de código, Git, base de datos, seguridad y pruebas.
- `AGENTS.md`: contexto operativo para agentes y sesiones de desarrollo.
- `Plan De Desarrollo.md`: alcance, cronograma, stack, despliegue y modelo de datos propuesto.
- `docs/Problematica.md`: situación actual y necesidades del negocio.
- `docs/Requerimentos RF y RNF.md`: requisitos funcionales y no funcionales.
- `docs/Historias de Usuario.md`: historias y criterios de aceptación.
- `bd/diagramas_esquemas_mermaid.md`: diagrama visual del esquema final de datos.
- `bd/ondina_schema_supabase.sql`: esquema relacional final.
- `docs/setup-vercel-supabase-github.md`: pasos manuales de configuración de Vercel, Supabase y GitHub (environments, secrets, branch protection, migraciones).
- `docs/estado-historias-usuario.md`: estado de implementación de cada HU (completas, parciales, placeholders, sin UI).
- `docs/convenciones-frontend.md`: reglas de mensajes de validación, errores, Toast y comentarios de código para todos los módulos.

Lee `AGENTS_para_equipo_desarrollo.md` completo antes de escribir, revisar o modificar código.

## Estado Actual

El repositorio se encuentra en etapa de definición. Actualmente contiene documentación y esquemas SQL, pero todavía no tiene aplicación React, `package.json`, migraciones Supabase, configuración de Vite, workflows de CI ni pruebas ejecutables.

No inventes comandos de instalación, build, lint o test hasta que se incorpore la aplicación y sus archivos de configuración. Cuando se agregue el código, actualiza este README con los comandos reales.

## Stack Elegido

- **Frontend:** React + Vite + TypeScript en modo estricto.
- **Estilos:** Tailwind CSS + Mantine UI (componentes complejos como DatePickers).
- **Datos remotos:** TanStack Query.
- **Formularios:** React Hook Form + Zod.
- **Backend:** Supabase.
- **Base de datos:** PostgreSQL administrado por Supabase.
- **Autenticación:** Supabase Auth.
- **Autorización:** Row Level Security (RLS) en la base de datos.
- **Archivos:** Supabase Storage para comprobantes de gastos.
- **Tiempo real:** Supabase Realtime donde sea necesario.
- **Mapas:** Leaflet o Mapbox para GPS.
- **Pruebas:** Vitest, Testing Library, Playwright y k6.
- **CI/CD:** GitHub Actions.
- **Despliegue:** Vercel para React/Vite y Supabase para backend y datos.
- **PWA:** manifest y service worker básico, sujeto a validar primero los flujos online.

No se incorporará un backend Node separado en la primera versión. No agregues dependencias nuevas sin justificar la necesidad en el PR.

## Módulos Y Roles

### Módulos

- **Ventas y clientes:** ventas, cartera, precios reales, medios de pago, documentos y gastos.
- **Bodega y despacho:** stock, carga de vendedores, despachos, ajustes, devoluciones y mermas.
  - **Nota sobre Despachos:** la página de despachos (`frontend/src/domains/bodega/pages/Despachos.tsx`) pertenece al dominio **Bodega/Despacho**, no al de Ventas. Su ruta vive en `feature/bodega`; si aparece en otras ramas de dominio es herencia de `develop`. En un futuro se evalúa aislarla del menú del vendedor de ventas.
- **Producción:** producción de agua/hielo e incidencias.
- **Administración:** usuarios, catálogo, reportes, comisiones, alertas y GPS.

### Roles

- **Vendedor:** registra ventas, clientes, gastos y consulta su carga y cartera.
- **Bodega:** registra despachos, devoluciones, mermas y consulta existencias.
- **Producción:** registra producción e incidencias.
- **Administrador:** gestiona usuarios y catálogo, consulta reportes y corrige o anula registros con trazabilidad.

La UI puede ocultar opciones, pero nunca reemplaza la autorización de RLS.

## Arquitectura De Datos

Supabase Auth administra las credenciales. La tabla `perfiles` solo extiende a `auth.users` con nombres, rol y datos operativos; nunca se guardan contraseñas en tablas del proyecto.

El modelo de dominio propuesto en `bd/ondina_schema_supabase.sql` mantiene estas entidades principales:

- Catálogos: `sucursales`, `perfiles`, `tipos_empaque`, `productos`, `configuracion` y `reglas_comision`.
- Existencias: `stock_bodega`, `stock_envases` y `carga_vendedor`, separadas por sucursal cuando corresponde.
- Ventas: `clientes`, `ventas`, `venta_detalles` y `gastos_extras`.
- Operación: `despachos`, `despacho_detalles`, devoluciones y `mermas`.
- Producción: `producciones` e `incidencias_produccion`.
- Control: `ubicaciones_vendedores` y `auditoria`.

Reglas que deben mantenerse:

- Las operaciones se anulan; no se eliminan físicamente.
- Los precios históricos viven en `venta_detalles`, no se recalculan desde el precio actual del catálogo.
- Los despachos se ajustan agregando nuevas filas dentro de la ventana configurada; no se editan ni restan filas históricas.
- La producción aumenta stock; el despacho mueve stock a la carga del vendedor; la venta descuenta la carga.
- Devoluciones y mermas ajustan existencias y conservan el movimiento original.
- Toda tabla expuesta necesita RLS y políticas definidas.
- Las operaciones de escritura deben guardar fecha/hora, responsable y auditoría cuando corresponda.

Los objetos `auth.users` y `storage.objects` pertenecen a Supabase y no se duplican como tablas del dominio.

## Organización Por Ramas

Los módulos no se separan mediante carpetas permanentes. El repositorio tendrá una
sola aplicación frontend y el trabajo de cada dominio se aislará mediante ramas.
Esto evita duplicar layouts, clientes de Supabase y componentes compartidos.

Ramas de trabajo por dominio:

```text
feature/ventas
feature/bodega
feature/produccion
feature/administracion
```

Reglas de integración:

- Cada rama aborda una HU o cambio técnico de un único dominio.
- La rama parte de `develop` y se integra nuevamente mediante Pull Request.
- `develop` contiene la aplicación integrada y el estilo principal compartido.
- `main` contiene únicamente versiones aprobadas para producción.
- Si una HU afecta más de un dominio, el PR debe explicar las dependencias y el orden de integración.
- El frontend central será responsable de navegación, sesión, roles, layout, estilo, cliente Supabase, errores globales y composición de las funcionalidades.

Cuando se incorpore el código, se mantendrá una aplicación frontend única; no se
crearán carpetas `ventas`, `bodega`, `produccion` o `administracion` como
aplicaciones independientes. La lógica de negocio seguirá identificándose por
HU y dominio en los cambios de cada rama.

La lógica de negocio no debe vivir en componentes React. Utiliza funciones, hooks, servicios y esquemas testeables. Los componentes de UI y utilidades genéricas pueden nombrarse en inglés; los conceptos del dominio deben nombrarse en español.

## Estilo Principal

Todos los módulos deben compartir una misma base visual para que el equipo pueda
mantener una experiencia consistente en tablets y computadores:

- Layout y navegación común definidos en `frontend/`.
- Componentes reutilizables antes de crear variantes locales.
- Estados de carga, error, vacío y confirmación con el mismo patrón.
- Mensajes al usuario en español y acciones principales visibles en pantallas táctiles.
- Colores, tipografía, espaciado y tamaños de interacción definidos en un único lugar.
- Las diferencias entre módulos deben responder al flujo del rol, no a estilos aislados.

## Convenciones De Código

- TypeScript siempre con `strict: true`.
- No usar `any`; si fuera inevitable, justificarlo explícitamente.
- Funciones públicas y props de componentes con tipos explícitos.
- Validar datos externos con Zod; no confiar únicamente en `as`.
- Componentes en `PascalCase`; hooks en `useCamelCase`; utilidades en `camelCase`.
- Variables booleanas con `is`, `has`, `can` o `should`.
- Carpetas en `kebab-case`.
- Tablas y columnas en español con `snake_case`.
- Mensajes al usuario en español.
- Comentarios para explicar el porqué, no para repetir el código.
- La lógica no trivial debe incluir JSDoc/TSDoc con la regla de negocio o HU relacionada.
- No dejar `console.log`, código comentado ni `catch` vacío.
- **Mensajes de validación y errores:** usar `errorTextCls`/`errorBlockCls`/`inputErrorCls` de `lib/ui.ts` (no strings inline). Toast verde en éxito, rojo en error. Ver `docs/convenciones-frontend.md` para el estándar completo.
- **Responsividad:** todas las páginas deben funcionar en 375px (móvil), 768px (tablet) y 1280px (desktop). Tablas → tarjetas en `<640px` con CSS single-view. Ver `docs/convenciones-frontend.md`.
- **Zod v4 + RHF:** usar `@hookform/resolvers` v5.9.1+. Separar tipos `z.input` (formulario) de `z.infer`/`z.output` (onSubmit) en schemas con `z.coerce`.

## Base De Datos

- Todos los cambios se realizan mediante migraciones versionadas en `supabase/migrations/`.
- Nunca modificar manualmente una base de producción.
- RLS y sus políticas son obligatorios para toda tabla expuesta.
- La autorización debe validarse en PostgreSQL, no solo en React.
- Los parámetros de negocio viven en configuración, no como números mágicos en el frontend.
- No guardar secretos, contraseñas, datos reales de clientes ni archivos `.env` en Git.

El archivo histórico `bd/ondina_sql.txt` no debe desplegarse. `bd/ondina_schema_supabase.sql` es el esquema relacional final; sus políticas RLS, triggers de negocio, auditoría, vistas y datos semilla viven en archivos separados de `bd/`.

## Git Y Pull Requests

### Ramas

- `main`: producción y protegida.
- `develop`: integración y desarrollo.
- `feature/HU-XX-descripcion`: funcionalidad asociada a una HU.
- `fix/descripcion-corta`: corrección de bug.
- `hotfix/descripcion-corta`: corrección urgente en producción.
- `chore/descripcion-corta`: tarea técnica.

Toda rama nace de `develop`, excepto un `hotfix`, que nace de `main`. Una rama debe contener una HU, un bug o una tarea técnica claramente delimitada.

### Commits

Usa Conventional Commits en español, imperativo y con máximo 72 caracteres:

```text
<tipo>(<alcance>): <descripción> [HU-XX]
```

Ejemplos:

```text
feat(ventas): registrar venta con método de pago [HU-01]
fix(despacho): validar stock antes de confirmar [HU-25]
test(comisiones): cubrir cálculo por tipo de producto [HU-09]
docs: actualizar criterios de aceptación [HU-07]
```

Los commits deben ser pequeños y atómicos. Nunca incluyas secretos, credenciales, `.env` ni datos reales.

### Pull Requests

Todo PR debe indicar qué cambia, qué HU cubre, cómo probarlo y cómo se validaron RLS, entradas, auditoría y pruebas. Requiere al menos una aprobación de otro integrante; nadie aprueba ni fusiona su propio PR. El CI debe estar verde y el merge se realiza con squash.

## Pruebas

- Unitarias y de integración: Vitest + Testing Library.
- E2E: Playwright, incluyendo emulación de tablets para flujos críticos.
- Carga: k6 para objetivos de rendimiento.
- Usar Arrange–Act–Assert.
- Escribir los nombres de pruebas en español describiendo comportamiento.
- Usar factories de prueba, fechas fijas y datos deterministas.
- Cada HU debe tener al menos una prueba de sus criterios de aceptación.
- La lógica de comisiones, stock, mermas, devoluciones y ventana de ajuste requiere pruebas unitarias.
- Login por rol, ventas, despacho, devoluciones, mermas, producción y reportes requieren E2E.

### Verificación con Playwright MCP

Para depurar y verificar correctamente el funcionamiento de la página desde el navegador se recomienda usar el **MCP de Playwright** que vive declarado en `opencode.json`. Permite abrir la URL del frontend (local o el preview de Vercel por PR), navegar como vendedor/admin, tomar screenshots, inspeccionar la consola y validar flujos de dominio sin instalar Playwright aparte. Es complementario a las pruebas Vitest+Testing Library y no reemplaza las E2E del repositorio.

## Flujo De Trabajo

1. Leer `AGENTS_para_equipo_desarrollo.md`, la HU correspondiente y los requisitos relacionados.
2. Confirmar el alcance y crear una rama específica.
3. Diseñar o actualizar primero la migración y las reglas RLS cuando el cambio afecte datos.
4. Implementar la lógica de negocio fuera de los componentes visuales.
5. Agregar o actualizar pruebas antes de solicitar revisión.
6. Ejecutar los comandos definidos por el proyecto cuando existan; no inventar comandos mientras el repositorio siga sin configuración ejecutable.
7. Abrir un PR con la plantilla y checklist de seguridad.
8. Incorporar la revisión de otro integrante y fusionar con squash.

## Despliegue

- Los Pull Requests generan previews en Vercel.
- `develop` publica el ambiente de desarrollo con Supabase dev.
- `main` publica producción con aprobación manual previa.
- Las migraciones se ejecutan de forma versionada y nunca mediante cambios manuales en producción.
- Variables públicas `VITE_` pueden llegar al frontend; claves privadas deben permanecer en GitHub Secrets, Vercel o Supabase.

### CI/CD

El pipeline vive en `.github/workflows/`:

| Workflow | Disparador | Qué hace |
| :------- | :--------- | :------- |
| `ci.yml` | `pull_request` a `develop`/`main` | Lint + typecheck + build + tests (Vitest) y validación de sintaxis SQL de migraciones (`migrations-check`). **No aplica** migraciones a la BD. |
| `deploy-develop.yml` | `push` a `develop` | Deploy del frontend a Vercel (ambiente `development`). |
| `deploy-prod.yml` | `push` a `main` | Verifica lint+build+tests; luego job `deploy` con `environment: production` que espera aprobación manual de un reviewer antes de publicar en Vercel Production (`ondina-erp.vercel.app`). |

Las ramas `feature/*` no deployan: el CI solo corre en PRs a `develop`/`main`; Vercel genera previews automáticamente por su GitHub App en cada push a cualquier rama.

### Configuración manual pendiente (una sola vez)

Estos pasos no los puede hacer el agente; requieren acceso al dashboard:

1. **Vercel env vars** (proyecto `ondina-erp`, Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = `https://rhivlzwtobhiguzmkiat.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = clave anon/publicable del proyecto Supabase
   - Crear scopes para Preview, Development y Production si se usan proyectos Supabase separados por ambiente.
2. **GitHub Secrets** (repo Settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN` = token de Vercel (crear en Vercel → Settings → Tokens)
   - `VERCEL_PROJECT_ID` = `prj_uOyPIotyMKPyB4zVTP7AD7cSZpp1` (se ve en Vercel → Project Settings → General)
   - `VERCEL_ORG_ID` = team id de Vercel (se ve en Vercel → Team Settings → General)
3. **GitHub Environments** (repo Settings → Environments):
   - `production` con **Required reviewers** (administradores que aprueban el deploy a Vercel Production).
   - (Opcional) `development` para fricción intermedia en develop.
4. **Branch protection** en `main` (configurada 2026-08-14):
    - `enforce_admins: false` — el admin puede hacer commit + push directo a `main`.
    - `required_pull_request_reviews: 1` — el resto del equipo (write) necesita PR + 1 aprobación.
    - `allow_force_pushes: false`, `allow_deletions: false`.
    - El workflow `deploy-prod.yml` se dispara en push a `main`; el deploy a producción requiere aprobación manual vía el environment `production` de GitHub Actions.
5. **Migraciones Supabase:**
   - No automatizar en CI/CD (mejor control manual). Tras cada merge a develop/main, aplicar con `supabase db push --linked` localmente o vía el MCP de Supabase.

## Definition Of Done

Una historia está terminada cuando:

- Cumple sus criterios de aceptación.
- Tiene pruebas apropiadas y pasan.
- La autorización está validada en RLS.
- Los inputs tienen validación en frontend y constraints en BD.
- Las operaciones nuevas guardan fecha, responsable y auditoría cuando corresponde.
- No contiene secretos, `console.log` ni código comentado.
- La documentación está actualizada.
- El PR fue aprobado por otro integrante.
- La versión está desplegada en el ambiente de desarrollo.

## Dudas Y Requisitos Pendientes

No resolver silenciosamente asuntos que los documentos marcan como pendientes. Confirmar con el cliente antes de cerrar el modelo de datos, entre otros:

- Recepción centralizada de pedidos.
- Precios y cupones por cliente.
- Informe de clientes por vendedor.
- Respaldo de gastos de vehículo.
- Método de pago definitivo.
- Catálogo único de productos.
- Alcance real de operación sin conexión.

## Contexto Operativo Del Repositorio

Este repositorio mantiene una sola aplicación integrada. Las ramas separan el
trabajo por dominio, pero comparten el modelo de datos, la navegación, la sesión,
los roles, el estilo visual y las reglas de seguridad.

| Rama | Contexto de trabajo |
| :--- | :--- |
| `main` | Versiones aprobadas para producción y documentación estable. |
| `develop` | Integración del equipo, validación en ambiente de desarrollo y base para nuevas ramas. |
| `feature/ventas` | Ventas, clientes, cartera, gastos, precios históricos y comisiones relacionadas. |
| `feature/bodega` | Existencias, despachos, carga de vendedores, devoluciones y mermas. |
| `feature/produccion` | Producción de agua/hielo e incidencias de planta. |
| `feature/administracion` | Usuarios, catálogo, configuración, reportes, GPS y control transversal. |

Cada rama de dominio debe limitarse a una HU o cambio técnico de su ámbito. Los
cambios que atraviesen dominios deben explicar sus dependencias en el Pull Request
y coordinarse mediante `develop`.

## Skills Y Herramientas De Trabajo

### Skills locales del proyecto

Las skills instaladas en `.agents/skills/` son: `ask-matt`, `codebase-design`,
`domain-modeling`, `find-skills`, `grill-with-docs`, `handoff`,
`improve-codebase-architecture`, `prototype`, `setup-matt-pocock-skills`,
`supabase`, `supabase-postgres-best-practices`, `to-spec`, `to-tickets` y
`vercel-react-best-practices`.

La auditoría realizada contra las skills disponibles de Superpowers no encontró
duplicados exactos por nombre. Las skills locales complementan a Superpowers:
las de Supabase y Vercel aportan conocimiento de proveedor, mientras que
Superpowers aporta flujos de brainstorming, TDD, debugging, revisión, ejecución
de planes y verificación.

### Herramientas de soporte

- **CodeGraph:** navegación y análisis local de relaciones del código. Su base de datos es local y no se versiona.
- **Mem0:** memoria persistente de decisiones y aprendizajes del proyecto mediante el plugin configurado en `.opencode/`.
- **Beads:** seguimiento de tareas, dependencias y estado de trabajo. Las issues viven en `.beads/` y se sincronizan con el repositorio.
- **Superpowers:** flujos de diseño, implementación, pruebas, revisión y verificación usados por los agentes.
- **GitHub:** repositorio remoto, Pull Requests, revisión cruzada y futura automatización CI/CD.

### MCPs

El proyecto contempla MCPs para Supabase, GitHub y herramientas auxiliares de
desarrollo. En el entorno de esta revisión no se expusieron recursos ni plantillas
MCP verificables; por eso no se afirma que una conexión Supabase o GitHub esté
activa. Antes de ejecutar operaciones remotas, el agente debe comprobar que el
MCP correspondiente aparece conectado y autenticado.

## Estado De Los Objetos SQL

`bd/ondina_schema_supabase.sql` define las tablas, relaciones y restricciones del
modelo y habilita RLS, e incluye índices sobre las columnas de filtro frecuente
(`sucursal_id`, `vendedor_id`, `creado_en`, `venta_id`, `despacho_id`, `producto_id`,
`(tabla, registro_id)` en auditoría). Las políticas (rls_policies.sql), triggers de
negocio (triggers_negocio.sql — incluidos los de reversión por anulación),
auditoría (auditoria.sql), vistas (vistas.sql — `v_stock_actual`,
`v_cuadre_despacho`, `v_ventas_diarias`, `v_ranking_vendedores`, `v_comision_vendedor`,
`v_clientes_inactivos`, `v_historial_cliente`, `v_ventas_producto`) y datos
semilla (seed.sql) se aplican como objetos separados en el orden documentado en
cada archivo, y deben convertirse a migraciones versionadas antes de producción.

### Contexto De Esta Rama

`develop` es la rama de integración del equipo. Recibe Pull Requests revisados
desde las ramas de dominio, concentra la aplicación compartida y sirve como base
para validaciones contra el ambiente de desarrollo. No debe usarse para trabajo
individual sin una rama de dominio asociada.

## Configuración Inicial Del Entorno

Estas instrucciones preparan Ubuntu y OpenCode para trabajar en Ondina. Ejecuta
los comandos desde la raíz del repositorio cuando se indique. No guardes claves
reales, contraseñas ni archivos `.env` en Git.

### Dependencias base de Ubuntu

```bash
sudo apt update
sudo apt install -y curl git jq build-essential postgresql postgresql-contrib docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Cierra la sesión y vuelve a entrar después de agregar el usuario al grupo
`docker`. Comprueba que `docker info` funciona sin `sudo`.

### Node.js y herramientas frontend

El frontend usa Node.js 22 o superior porque las versiones actuales de React,
Vite y Supabase del proyecto lo requieren. Una instalación reproducible con
`nvm` es:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
node --version
npm --version
```

Instala las dependencias versionadas del frontend y ejecuta sus comandos reales:

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
cd ..
```

El proyecto ya declara React, React DOM, React Router, TypeScript, Vite,
Tailwind CSS y `@supabase/supabase-js` en `frontend/package.json`. Vercel puede
desplegar el frontend mediante integración GitHub; la CLI opcional se instala
con `npm install -g vercel` si se necesita publicar manualmente.

### PostgreSQL y Supabase CLI

Para disponer de `psql` y un servidor PostgreSQL local:

```bash
sudo apt install -y postgresql postgresql-contrib
psql --version
sudo -u postgres psql
```

Para instalar la CLI de Supabase globalmente:

```bash
npm install -g supabase
supabase --version
```

La CLI usa Docker para `supabase start`. Inicializa el proyecto únicamente
cuando se vaya a crear la estructura local de Supabase:

```bash
supabase init
supabase start
```

No ejecutes el esquema contra producción. Los cambios definitivos deben quedar
en migraciones versionadas y revisarse con RLS, triggers, Storage y pruebas.

### CodeGraph

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
cd /ruta/al/proyecto/Ondina
codegraph init
```

La base de datos de CodeGraph es local y no debe versionarse.

### Beads

```bash
curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash
cd /ruta/al/proyecto/Ondina
bd init
bd ready
```

Beads conserva el seguimiento de tareas y decisiones del repositorio. Usa `bd`
para crear, reclamar y cerrar trabajo antes de modificar el proyecto.

### Mem0 y plugin de OpenCode

1. Visita <https://app.mem0.ai> y crea una API key nueva.
2. Agrega la clave solo a tu entorno local:

```bash
echo 'export MEM0_API_KEY="m0-tu-key-aquí"' >> ~/.bashrc
source ~/.bashrc
```

Desde la raíz del proyecto, instala o habilita el plugin:

```bash
opencode plugin @mem0/opencode-plugin
```

El plugin también está declarado en `opencode.json`. La clave real nunca debe
escribirse en ese archivo ni publicarse en commits.

### OpenCode y MCPs

La configuración raíz está en `opencode.json`. Incluye Superpowers, Beads,
Context7, fetch, filesystem, Git, GitHub, Supabase, Mermaid, MarkItDown,
Playwright, sequential thinking y Tavily. Algunos MCPs requieren dependencias o
variables locales:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
echo 'export GITHUB_PERSONAL_ACCESS_TOKEN="github-token-local"' >> ~/.bashrc
echo 'export TAVILY_API_KEY="tvly-token-local"' >> ~/.bashrc
source ~/.bashrc
```

Reemplaza los valores de ejemplo solo en tu máquina. El MCP de GitHub requiere
Docker y `GITHUB_PERSONAL_ACCESS_TOKEN`; el MCP remoto de Supabase requiere
autenticación OAuth desde OpenCode y no debe recibir una `service_role` key en
el frontend. Activa los MCPs que vayas a usar y reinicia OpenCode después de
cambiar `opencode.json`.

### Comprobación rápida

```bash
git status
node --version
psql --version
supabase --version
docker info
codegraph --help
bd ready
```

Si un comando no existe, instala primero la dependencia indicada en esta sección
y abre una nueva sesión de terminal para recargar el `PATH`.
