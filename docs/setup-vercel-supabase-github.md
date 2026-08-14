# Setup: Vercel, Supabase y GitHub

Documenta todos los pasos manuales de configuración necesarios para que el CI/CD y el despliegue funcionen correctamente. Creado el 2026-08-07.

---

## 1. Visibilidad del repositorio

El repositorio `ondina-erp` debe ser **público** para desbloquear todas las features de GitHub Actions en el plan Free:

| Feature | Repo público (Free) | Repo privado (Free) |
| :------ | :------------------ | :----------------- |
| Environments | ✅ | ❌ |
| Environment secrets | ✅ | ❌ |
| Required reviewers | ✅ | ❌ |
| Branch protection | ✅ | ❌ |

### Pasos

1. Ve a <https://github.com/Cristhian-S1/ondina-erp/settings>
2. Baja hasta **Danger Zone** (al final de la página)
3. Click **Change visibility** → **Public**
4. Escribe el nombre del repo para confirmar
5. Click **I understand, make this repository public**

> **Verificación previa:** confirma que no hay secrets commiteados con `git log --all -p -- '*.env*'`. El archivo `frontend/.env` está en `.gitignore` y no se versiona.

---

## 2. Secrets de GitHub Actions

Los workflows de deploy (`deploy-develop.yml` y `deploy-prod.yml`) necesitan tres secrets para autenticarse con Vercel.

### 2.1 Obtener el token de Vercel

1. Ve a <https://vercel.com/account/tokens>
2. Click **Create Token**
3. Nombre: `ondina-erp-ci` · Scope: tu team · Expiration: recomendado 6 meses
4. Copia el token (solo se ve una vez)

### 2.2 Obtener IDs del proyecto Vercel

El **Project ID** y el **Org/Team ID** están en:

- Vercel → ondina-erp → Settings → General → Project ID / Team ID
- Valores conocidos:
  - **Project ID:** `prj_uOyPIotyMKPyB4zVTP7AD7cSZpp1`
  - **Team ID (Org ID):** `team_JcZu1ij2RbokdkQuq8SYtT0g`

### 2.3 Crear los secrets en GitHub

1. Ve a <https://github.com/Cristhian-S1/ondina-erp/settings/secrets/actions>
2. Click **New repository secret**
3. Crea tres secrets:

| Nombre | Valor |
| :----- | :---- |
| `VERCEL_TOKEN` | (el token generado en el paso 2.1) |
| `VERCEL_PROJECT_ID` | `prj_uOyPIotyMKPyB4zVTP7AD7cSZpp1` |
| `VERCEL_ORG_ID` | `team_JcZu1ij2RbokdkQuq8SYtT0g` |

> Estos secrets son **privados**: nunca se loguean, nunca llegan al navegador. Solo se inyectan en los runners de GitHub Actions durante los jobs de deploy.

---

## 3. Variables de entorno en Vercel

Vercel necesita las variables `VITE_*` para hacer el build del frontend. Estas variables son **públicas** (Vite las injerta en el bundle JS del navegador; no son secretos).

### 3.1 Valores

| Variable | Valor |
| :------- | :---- |
| `VITE_SUPABASE_URL` | `https://rhivlzwtobhiguzmkiat.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoaXZsend0b2JoaWd1em1raWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MDAzMzEsImV4cCI6MjEwMTM3NjMzMX0.y3rDG43A7-thpQuZYJU3rpDXN-OPLRay2EJyfWJt_0A` |

> Alternativamente, la clave publishable moderna es: `sb_publishable_p1vhJzoJjAkPScE4Mif2Hg_PT48GQ0W`. Las dos funcionan; la anon legacy es la más compatible con `@supabase/supabase-js`.

### 3.2 Pasos

1. Ve a <https://vercel.com/cristhiansanchezsmartv-1777s-projects/ondina-erp/settings/environment-variables>
2. Click **Add New**
3. Key: `VITE_SUPABASE_URL` →_Value: la URL de arriba
4. Selecciona: ✅ Preview ✅ Development ✅ Production
5. Click **Save**
6. Repite para `VITE_SUPABASE_ANON_KEY` con el valor de arriba
7. (Opcional) Si en el futuro tienes proyectos Supabase separados por ambiente, crea las vars con scopes distintos (Preview apunta a dev, Production apunta a prod).

> **No usar GitHub Secrets para estas vars**: el build lo hace Vercel, no GitHub Actions. Vercel no lee secrets de GitHub.

---

## 4. Environment `production` en GitHub

El workflow `deploy-prod.yml` referencia `environment: production`. Esto pausa el deploy hasta que un reviewer apruebe manualmente.

### 4.1 Crear el environment

1. Ve a <https://github.com/Cristhian-S1/ondina-erp/settings/environments>
2. Click **New environment**
3. Nombre: `production` → click **Configure environment**

### 4.2 Configurar Required reviewers

1. En **Required reviewers**, activa el check
2. Escribe tu usuario: `Cristhian-S1`
3. Puedes añadir hasta 6 usuarios/teams. Solo **1** necesita aprobar.
4. (Opcional) Activa **Prevent self-review** si hay más devs (así nadie aprueba su propio deploy)
5. Click **Save protection rules**

### 4.3 Configurar deployment branches

1. En **Deployment branches and tags**, selecciona **Selected branches and tags**
2. Click **Add branch rule** → escribe `main` → Add
3. Solo la rama `main` puede deployar a production

### Qué pasa al hacer push a `main`

1. El workflow `deploy-prod.yml` se dispara
2. Job `verify` (lint+build+test) corre primero
3. Job `deploy` se pausa con "Waiting for approval"
4. Recibes una notificación de GitHub
5. Entras a la run → click **Approve** o **Reject**
6. Solo después de Approve, Vercel recibe el deploy y publica a production (`ondina-erp.vercel.app`)

---

## 5. Branch protection en `main`

Evita push directo y fuerza PR con review + CI verde.

### 5.1 Crear la regla

1. Ve a <https://github.com/Cristhian-S1/ondina-erp/settings/branches>
2. Click **Add branch protection rule**
3. **Branch name pattern**: `main`

### 5.2 Pull request requerido

1. Activa **Require a pull request before merging**
2. **Required approvals**: `1`
3. (Opcional) Activa **Dismiss stale pull request approvals when new commits are pushed**
4. (Opcional) Activa **Require review from Code Owners** (si tienes `.github/CODEOWNERS`)

### 5.3 Status checks requeridos

> **Importante:** los checks solo aparecen en la lista después de que el workflow corrió al menos una vez. Como ya hicimos push de los workflows a `develop` y `main`, los checks estarán disponibles.

1. Activa **Require status checks to pass before merging**
2. Click **Search** y busca:
   - `build` (job de `ci.yml` — Lint + typecheck + build + test)
   - `migrations-check` (job de `ci.yml` — validación SQL)
3. Selecciona ambos
4. Activa **Require branches to be up to date before merging**

### 5.4 Configuración de admin (actualizada 2026-08-14)

**Configuración actual:**
- `enforce_admins: false` — el admin **puede** hacer commit + push directo a `main` sin PR.
- `required_pull_request_reviews: 1` — el resto del equipo (write) sigue necesitando PR + 1 aprobación.
- `allow_force_pushes: false`, `allow_deletions: false`.

> **Nota:** El workflow `deploy-prod.yml` se dispara en push a `main` (incluso push directo del admin). El deploy a producción requiere aprobación manual vía el environment `production` de GitHub Actions con Required reviewers.

1. Para replicar: en <https://github.com/Cristhian-S1/ondina-erp/settings/branches>, edita la regla de `main`.
2. Desactiva **Do not allow bypassing the above settings** (para que `enforce_admins: false`).
3. Click **Save changes**.

### (Opcional) Branch protection en `develop`

Repite los pasos 5.1-5.3 para la rama `develop` si quieres protección ahí también. En `develop` puedes relajar:
- No requerir status checks (o requerir solo `build`)
- Solo requerir 1 approval de PR

---

## 6. CI/CD Workflows

Los workflows ya están commiteados en `.github/workflows/`:

| Workflow | Archivo | Disparador | Qué hace |
| :------- | :------ | :--------- | :------- |
| CI | `ci.yml` | `pull_request` a `develop`/`main` | Lint + typecheck + build + tests (Vitest) + `migrations-check` (valida sintaxis SQL sin aplicar). |
| Deploy Desarrollo | `deploy-develop.yml` | `push` a `develop` | Deploy del frontend a Vercel (ambiente `development`). |
| Deploy Producción | `deploy-prod.yml` | `push` a `main` | Verifica lint+build+tests; luego job `deploy` con `environment: production` que espera aprobación manual antes de publicar en Vercel Production. |

### Ramas `feature/*`

- CI **solo** corre en PRs a `develop`/`main` (no en push a `feature/*`).
- Vercel genera previews automáticamente por su GitHub App en cada push a cualquier rama.
- No hay deploy de `feature/*` a ambientes estables.

### `frontend/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- `rewrites` evita 404 al hacer refresh en rutas internas del SPA (React Router).
- `installCommand: "npm ci"` usa el lockfile determinista.

---

## 7. Migraciones de Supabase (manuales)

### Decisión

Las migraciones son **manuales** (no automatizadas en CI/CD). Razones:

1. El `AGENTS.md` indica: "Los cambios definitivos van en migraciones versionadas" y "Aplica el esquema solo en un entorno aislado".
2. Las migraciones tocan RLS, triggers de auditoría e invariantes de stock que requieren revisión humana.
3. Una migración fallida en CI deja la BD en estado inconsistente sin rollback simple.
4. El equipo (4 personas) puede manejar el control manual sin cuello de botella.

El CI **valida** sintaxis SQL (`migrations-check` job en `ci.yml`) pero **no aplica** migraciones.

### 7.1 Una sola vez: link al proyecto

```bash
# Instala la CLI
npm install -g supabase

# Login (genera access token en https://supabase.com/dashboard/account/tokens)
supabase login

# Link al proyecto remoto
supabase link --project-ref rhivlzwtobhiguzmkiat
```

### 7.2 Después de cada merge a `develop` o `main`

```bash
# Pull latest
git pull origin develop   # o main

# Ver qué migraciones se van a aplicar (sin tocar la BD)
supabase db push --dry-run

# Si todo se ve bien, aplicar
supabase db push

# (Opcional) Incluir seed data
supabase db push --include-seed
```

### 7.3 Alternativa: MCP de Supabase

Si tienes el MCP de Supabase configurado (como es el caso), puedes aplicar migraciones directamente sin CLI:

```
supabase_apply_migration(
  name="0005_eliminar_seed_inicial_productos",
  query="UPDATE public.productos SET activo = false WHERE nombre IN (...);"
)
```

o ejecutar SQL directo:

```
supabase_execute_sql(query="UPDATE public.productos SET activo = false WHERE ...")
```

### Reglas de oro

- **Nunca** modifiques la BD remota desde el Dashboard SQL Editor. Todo va por migraciones.
- **Nunca** edites una migración ya aplicada; crea una nueva.
- Si `db push` falla con sync errors, es porque alguien modificó la BD remotamente. Revisa con `supabase db pull` para sincronizar.

---

## 8. Resumen de finalización

| Paso | Estado | Dónde |
| :--- | :---- | :--- |
| 1. Repo público | Pendiente manual | GitHub → Settings → Danger Zone |
| 2. GitHub Secrets | Pendiente manual | GitHub → Settings → Secrets → Actions |
| 3. Vercel env vars | Pendiente manual | Vercel → Settings → Environment Variables |
| 4. Environment `production` | Pendiente manual | GitHub → Settings → Environments |
| 5. Branch protection `main` | Pendiente manual | GitHub → Settings → Branches |
| 6. CI/CD workflows | ✅ Creado y pusheado | `.github/workflows/` |
| 7. Migraciones Supabase | ✅ Documentado | Este archivo (manual) |
| 8. `vercel.json` | ✅ Creado | `frontend/vercel.json` |

> Los pasos 1-5 requieren acceso al dashboard de GitHub/Vercel y no pueden ser automatizados por el agente. Los pasos 6-8 ya están implementados.