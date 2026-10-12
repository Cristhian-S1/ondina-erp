# Ondina ERP

Sistema web para gestionar ventas, clientes, despacho, bodega y producción de una distribuidora de agua embotellada y hielo. Está pensado para tablets en la operación y computadores en administración.

## Estado del proyecto

El proyecto tiene una aplicación integrada en `frontend/`. Su etapa actual es completar funcionalidades y corregir los hallazgos de la auditoría antes de considerar la operación validada.

| Etapa | Estado y evidencia |
| --- | --- |
| Requisitos y diseño | Documentados en `docs/` y `bd/`; hay decisiones de negocio pendientes. |
| Implementación | Ventas, bodega y producción tienen pantallas y servicios. Administración y varias HU requieren trabajo adicional. |
| Integración y calidad | Existen lint, build, 15 archivos de pruebas y 10 migraciones locales. El estado detallado de las HU distingue implementación de validación. |
| Despliegue y operación | Hay configuración de GitHub Actions, Vercel y Supabase. La auditoría del 09-10-2026 documenta diferencias de esquema y permisos que deben resolverse. |

Consulta [estado de las historias](docs/estado-historias-usuario.md), [auditoría integral](docs/auditorias/2026-10-09/auditoria-integral-2026-10-09.md) e [issues del proyecto](https://github.com/Cristhian-S1/ondina-erp/issues) para el detalle y el trabajo pendiente. Las verificaciones históricas conservan su fecha; una pantalla existente no acredita que su recorrido funcione en producción.

## Stack

React, Vite y TypeScript; Tailwind CSS y Mantine; TanStack Query; React Hook Form y Zod. Supabase proporciona PostgreSQL, Auth y los servicios de backend. El despliegue utiliza Vercel y GitHub Actions.

## Desarrollo local

Usa Node.js 22.12 o posterior. Los comandos se ejecutan en `frontend/`:

```bash
cd frontend
npm ci
cp .env.example .env
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con un entorno de desarrollo, y ejecuta:

```bash
npm run dev
```

Verificación:

```bash
npm run lint
npm run build
npm run test
```

## Organización del repositorio

| Ruta | Contenido |
| --- | --- |
| `frontend/` | Aplicación, dominios, componentes, servicios y pruebas. |
| `supabase/migrations/` | Migraciones versionadas; su historial debe reconciliarse con el remoto. |
| `bd/` | SQL de diseño, reglas de negocio y diagramas. |
| `docs/` | Requisitos, convenciones y guías de desarrollo y operación. |
| `docs/auditorias/` | Informes y antecedentes históricos, identificados por fecha. |
| `.github/workflows/` | Integración y despliegue. |
| `.agents/skills/` | Fuente compartida de las skills del proyecto. |
| `.claude/` | Configuración, reglas y acceso a skills para Claude Code. |

## Cómo contribuir

`develop` es la base de integración y `main` contiene las versiones aprobadas para producción. El trabajo de dominio se organiza en `feature/ventas`, `feature/bodega`, `feature/produccion` y `feature/administracion`.

Relaciona cada cambio con su HU o issue y utiliza Conventional Commits en español. Consulta [guía de desarrollo](docs/desarrollo.md) y [convenciones de frontend](docs/convenciones-frontend.md).

El seguimiento persistente utiliza Beads; la configuración y los procedimientos están en [.beads/README.md](.beads/README.md) y [herramientas para agentes](docs/herramientas-agentes.md).

## Documentación de referencia

- [Problemática](docs/Problematica.md), [requisitos](docs/Requerimentos%20RF%20y%20RNF.md) e [historias de usuario](docs/Historias%20de%20Usuario.md).
- [Plan de desarrollo](docs/Plan%20De%20Desarrollo.md).
- [Estado de las HU](docs/estado-historias-usuario.md).
- [Base de datos y migraciones](docs/base-de-datos.md).
- [Configuración de Vercel, Supabase y GitHub](docs/setup-vercel-supabase-github.md).
- [Auditorías y antecedentes](docs/auditorias/2026-10-09/).
- [Reglas comunes para agentes](AGENTS.md).
- [Orquestación con Orca, Claude Code y OpenCode](docs/orquestacion/README.md).
- [Catálogo y revisión de skills](docs/skills.md).

No aplicar las migraciones a producción hasta reconciliar esquema e historial en un entorno aislado. El procedimiento y la evidencia se documentan en la guía de base de datos.
