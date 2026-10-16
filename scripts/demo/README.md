# Local demo kit

Runs Ondina at `http://localhost:5173` against an isolated **local** Supabase stack with synthetic demo data, for client demos and manual QA. Every script aborts unless the Supabase API is `127.0.0.1`/`localhost`; it never touches production.

| File | Use |
| --- | --- |
| `levantar.sh` | Linux/macOS: update the checked-out branch, start Supabase, write `frontend/.env.local`, `npm ci`, seed and run Vite. |
| `levantar-windows.ps1` | Windows 11 equivalent with prerequisite checks, explained errors, a final pause and a log (`%USERPROFILE%\ondina-demo-ultimo.log`). |
| `seed-demo.mjs` | Shared idempotent seed used by both scripts. |

## Prerequisites

Git, Node 22 (`>= 22.12`, see `frontend/.nvmrc`), Docker (Docker Desktop with WSL2 on Windows) running, and the Supabase CLI (the Windows script falls back to `npx supabase`). The first `supabase start` downloads several GB of images; run it once before a demo.

## Run

```bash
# Linux/macOS, from the repository root
scripts/demo/levantar.sh             # git pull + start
scripts/demo/levantar.sh --host      # reachable from a phone on the same network
scripts/demo/levantar.sh --reset     # reset the local database and reseed
scripts/demo/levantar.sh --detener   # stop Vite and Supabase
```

```powershell
# Windows, from the repository root (uses this clone and its current branch)
powershell -ExecutionPolicy Bypass -File .\scripts\demo\levantar-windows.ps1
# Copied alone to any folder, it clones the repository (default branch develop) into -Destino
powershell -ExecutionPolicy Bypass -File .\levantar-windows.ps1 -Destino C:\dev\ondina-demo
# Other switches: -Rama <branch>, -SoloReiniciarDatos, -SinArrancar, -SinPausa
```

## Demo accounts

All use the password `ux-local-2026` (override with `DEMO_PASSWORD` before seeding). They exist only in the local stack on the reserved `example.invalid` domain.

| Email | Role |
| --- | --- |
| `ux-vendedor@example.invalid` | Seller, Sucursal Sintética A (load, 5 clients, 3 sales, 2 expenses) |
| `ux-bodega@example.invalid` | Warehouse, Sucursal Sintética A (dispatches, returns, stock) |
| `ux-produccion@example.invalid` | Production, Sucursal Sintética A (4 records, 1 loss, 1 incident) |
| `ux-admin@example.invalid` | Administrator, Sucursal Sintética A |
| `ux-admin-global@example.invalid` | Administrator without a branch (branch selector) |

Password-recovery emails are captured by the local mail catcher at `http://127.0.0.1:54324`. After pulling a change to `supabase/config.toml` (for example auth redirect URLs), restart the stack (`--detener`, then start again) so it is applied.

## Security

The seed reads `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the environment or from `supabase status -o env`, keeps the service-role key in memory only, and acts as each demo user through the same RPCs and tables as the app. `frontend/.env.local` only receives the local URL and anon key. Never point these scripts or accounts at a shared or production project.
