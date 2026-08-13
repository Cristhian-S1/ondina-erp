# Guía de Merge y Pull Request

Cómo integrar cambios entre ramas en Ondina. Cubre estrategias (squash, cherry-pick, PR), conflictos, protecciones de `main` y consideraciones del CI/CD.

---

## Modelo de ramas

```text
feature/ventas ──────► develop ──────► main
feature/bodega   ────►   │              │
feature/produccion ─►   │              │
feature/administracion ►│              │
                         │              │
                    CI en PR         CI + deploy-prod
                    deploy-dev       (aprobación manual)
```

| Rama | Rol | Protección |
| :--- | :-- | :--------- |
| `main` | Producción. Solo versiones aprobadas. | Branch protection: PR obligatorio + 1 approval + CI verde + `deploy-prod.yml` con `environment: production` (required reviewers). |
| `develop` | Integración. Todo el equipo fusiona aquí. | sin branch protection por defecto. CI corre en PR y en push (trigger `push: develop`). `deploy-develop.yml` deploya a Vercel automáticamente. |
| `feature/*` | Trabajo individual por dominio. CI solo en PR hacia `develop`/`main`. Vercel genera previews automáticos. | sin protección. |

---

## Opción A — Squash merge (recomendada para feature → develop)

Aplana todos los commits de la rama en un solo commit dentro de develop. Mantiene el historial limpio.

### Desde GitHub web

1. Abre un PR: `https://github.com/Cristhian-S1/ondina-erp/compare/develop...feature/ventas`
2. Reviewa el diff y los commits.
3. Espera a que el CI pase verde.
4. Click **Squash and merge** (botón verde).
5. Edita el mensaje del commit squash si quieres (sugerido: `feat(ventas): módulo de ventas completo [HU-01..07]`).
6. Click **Confirm squash and merge**.
7. El CI correrá automáticamente en develop (trigger `push: develop`).
8. `deploy-develop.yml` disparará deploy a Vercel desarrollo.

### Desde terminal (más rápido, sin revisión en GitHub)

```bash
cd /home/cristhian/Downloads/Ondina

# actualiza develop
git checkout develop
git pull origin develop

# traer todo de feature/ventas en un solo commit
git merge --squash feature/ventas

# resolver conflictos si los hay (ver sección abajo)
git commit -m "feat(ventas): módulo de ventas completo [HU-01..07]"

# push (dispara CI + deploy-develop)
git push origin develop
```

**Ventajas:** historial limpio, un solo commit por feature, fácil de revertir.
**Desventajas:** pierdes granularidad de commits individuales; si necesitas excluir algo, usa cherry-pick (opción B).

---

## Opción B — Cherry-pick (control selectivo)

Permite elegir exactamente qué commits entran a develop. Útil cuando una rama tiene commits que no quieres integrar (ej: experimentos, commits de limpieza).

```bash
cd /home/cristhian/Downloads/Ondina

# actualiza develop
git checkout develop
git pull origin develop

# ver qué commits hay disponibles
git log --oneline feature/ventas ^develop

# elegir los que quieres, en orden (del más viejo al más nuevo)
git cherry-pick <sha1> <sha2> <sha3>

# resolver conflictos si los hay
git push origin develop
```

**Ventajas:** control total, puedes excluir commits.
**Desventajas:** más trabajo manual, puede generar conflictos en cada commit.

---

## Opción C — Merge commit (preserva historial)

Conserva todos los commits individuales con un merge commit encima. Útil cuando el historial de commits individual es importante para la auditoría.

### Desde GitHub web

1. Abre el PR.
2. Click **Merge pull request** (no squash).
3. Click **Confirm merge**.

### Desde terminal

```bash
git checkout develop
git pull origin develop
git merge --no-ff feature/ventas -m "merge: feature/ventas → develop [HU-01..07]"
git push origin develop
```

**Ventajas:** historial completo, `git log --graph` muestra ramas y merges.
**Desventajas:** historial de develop se llena de commits de feature; más difícil de seguir.

---

## develop → main (PR con aprobación manual)

Este flujo tiene dos frenos:

1. **Branch protection en `main`:** nadie puede hacer push directo. Todo entra por PR con ≥1 approval y CI verde.
2. **`deploy-prod.yml` con `environment: production`:** el workflow se pausa esperando aprobación manual antes de deployar a Vercel Production.

### Pasos

1. Abre un PR: `https://github.com/Cristhian-S1/ondina-erp/compare/main...develop`
2. Revisa el diff y los commits.
3. Espera a que el CI pase verde.
4. Pídele a un reviewer que apruebe el PR (no puedes aprobar tu mismo si activaste **Prevent self-review**).
5. Click **Squash and merge**.
6. GitHub dispara `deploy-prod.yml`:
   - Job `verify` corre primero (lint + build + tests).
   - Job `deploy` se pausa con **"Waiting for approval"**.
7. Entra a la run en GitHub Actions → click **Approve** (o **Reject**).
8. Solo después de Approve, Vercel recibe el deploy y publica a `ondina-erp.vercel.app`.

### Usar cherry-pick de develop a main (paso a paso)

Si solo quieres llevar uno o dos commits específicos de develop a main (sin mergear todo develop):

```bash
cd /home/cristhian/Downloads/Ondina

# crear rama temporal desde main
git checkout main
git pull origin main
git checkout -b hotfix/fix-especifico

# cherry-pick los commits de develop que necesitas
git cherry-pick <sha1>

# push + PR
git push origin hotfix/fix-especifico
# luego abrir PR: hotfix/fix-especifico → main en GitHub web
```

---

## Resolución de conflictos

Los conflictos ocurren cuando dos ramas modifican las mismas líneas. Dos estrategias:

### Estrategia 1: tomar todo de una rama (squash merge)

Si sabes que feature/ventas tiene la versión correcta de TODO:

```bash
git checkout develop
git merge --squash feature/ventas
# si hay conflictos:
git checkout --theirs .   # tomar todo de feature/ventas
git add .
git commit -m "feat(ventas): módulo completo [HU-01..07]"
git push origin develop
```

### Estrategia 2: resolver manualmente

```bash
git merge --squash feature/ventas
# conflictos aparecen en git status
git status --short
# archivos con conflictos tienen "UU" o "AA"

# editar cada archivo y buscar <<<<<<<<, =======, >>>>>>
# elegir/quedarte con las versiones correctas
# guardar
git add <archivo-resuelto>
git commit -m "..."
git push origin develop
```

---

## Status checks y branch protection

`main` tiene branch protection activada. Esto significa:

- **No se puede push directo** (ni admins, si activaste "Do not allow bypassing").
- **PR obligatorio** con ≥1 approval.
- **Status checks requeridos:** `build` y `migrations-check` (de `ci.yml`) deben pasar.
- **Require branches up to date:** la rama del PR debe estar al día con `main` antes del merge.

> **Importante:** los status checks solo aparecen en la lista de GitHub después de que el workflow corrió al menos una vez. Si no los ves, abre un PR de prueba para que el CI dispare y los registre.

`develop` puede tener branch protection opcional (más liviana):
- PR obligatorio, 1 approval.
- No requerir status checks (o requerir solo `build`).

---

## CI/CD: qué dispara qué

| Workflow | Disparador | Rama objetivo | Qué hace |
| :------- | :--------- | :------------ | :------- |
| `ci.yml` | `pull_request` a develop/main | cualquier feature/* | Lint + build + tests + migrations-check |
| `ci.yml` | `push` a develop | develop | Igual que arriba, post-merge |
| `deploy-develop.yml` | `push` a develop | develop | Deploy frontend → Vercel desarrollo |
| `deploy-prod.yml` | `push` a main | main | Verify (lint+build+test) → deploy con approval manual → Vercel producción |

Vercel por su parte genera previews automáticos en cada push a cualquier rama (vía GitHub App).

---

## Consideraciones y errores comunes

### Perdí status checks en la lista de GitHub

Los checks solo aparecen después de que el workflow corrió al menos una vez. Solución: abre un PR de prueba hacia `main` o `develop` y espera a que el CI dispare. Después los checks estarán disponibles en Settings → Branches → Edit rule.

### El push a main fue rechazado ("protected branch hook declined")

Branch protection está activa y no permite push directo. Solución: crear un PR `develop → main` y mergear por GitHub web.

### `deploy-prod.yml` quedó en "Waiting for approval"

Es el comportamiento esperado: `environment: production` tiene required reviewers. Entra a GitHub Actions → la run → Approve.

### Merge squash trajo archivos que no quería

Si el squash merge trajo 213 archivos y solo querías 50, tienes dos opciones:
1. **Cancelar el merge**: `git merge --abort` (si no commiteaste) o `git reset --hard origin/develop` (si ya commiteaste pero no pusheaste).
2. **Usar cherry-pick** (Opción B) en lugar de squash merge.

### Conflictos add/add

Ocurren cuando develop y feature crearon el mismo archivo independientemente. Resolución:

```bash
# para squash merge, tomar versión de feature/*
git checkout --theirs <archivo>
git add <archivo>
```

### Necesito deshacer un merge ya pusheado

```bash
# en develop, después de un push equivocado
git revert -m 1 <sha-del-merge-commit>
git push origin develop
```

Esto crea un commit que invierte el merge, sin reescribir historial.

---

## Checklist de merge feature → develop

- [ ] En `feature/*`: `npm run lint && npm run build && npm run test` pasan.
- [ ] En `feature/*`: migraciones nuevas están en `supabase/migrations/` y validan sintaxis.
- [ ] Abrir PR en GitHub (`compare/develop...feature/ventas`).
- [ ] CI en el PR pasa verde.
- [ ] Reviewer aprueba (si vas por GitHub web).
- [ ] Squash and merge → develop.
- [ ] CI en develop pasa verde (trigger `push: develop`).
- [ ] `deploy-develop.yml` dispara deploy a Vercel desarrollo.
- [ ] (Opcional) Aplicar migraciones a Supabase dev: `supabase db push --linked`.

## Checklist de merge develop → main

- [ ] Todo en develop está verificado en el ambiente de desarrollo.
- [ ] Abrir PR `main...develop` en GitHub.
- [ ] CI en el PR pasa verde (build + migrations-check).
- [ ] Reviewer aprueba el PR.
- [ ] Squash and merge → main.
- [ ] `deploy-prod.yml` dispara: verify pasa → deploy queda "Waiting for approval".
- [ ] Approve en GitHub Actions.
- [ ] Vercel publica a producción (`ondina-erp.vercel.app`).
- [ ] (Opcional) Aplicar migraciones a Supabase prod: `supabase db push --linked` (cuidado: cambiar `supabase link` al proyecto prod primero).