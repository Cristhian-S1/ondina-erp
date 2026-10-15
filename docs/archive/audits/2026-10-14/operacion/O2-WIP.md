# O2 / #44 / OND-d40 — WIP, pausa solicitada 2026-10-14

> Reanudado el 2026-10-15; entrega y evidencia finales en [O2-auth-44.md](O2-auth-44.md).
> Las instrucciones de pausa de este checkpoint son históricas y fueron sustituidas por el nuevo despacho.

- Rama: `chore/auth-recuperacion`, creada desde `origin/develop`; sólo trabajo local, sin push/PR.
- Hecho: enlace en Login, rutas públicas `/recuperar` y `/restablecer`, servicio `domains/auth/api.ts`, esquemas Zod v4, formularios RHF y cooldown de 60 s persistido en sessionStorage.
- Hecho parcial: AuthProvider reconoce PASSWORD_RECOVERY, separa el perfil ERP y recuerda el session_id de recuperación; falta probar eventos/reload/enlaces reales y revisar su robustez.
- Verificación acotada: `cd frontend && npm run test -- src/pages/Recuperacion.test.tsx src/context/AuthProvider.test.tsx`: 34/35 PASS; `git diff --check` PASS; lint/build/size/suite completa NO ejecutados.
- Fallo pendiente: `login links to recovery` usa `setup('/login')` con recovery=true por defecto y por ello navega a `/restablecer`; siguiente paso: corregir fixture a recovery=false y añadir pruebas del proveedor/rutas/servicio.
- Pendiente: journey real Mailpit (enlace válido/reutilizado y restauración de contraseña), desactivar perfil después de login conservando JWT y restaurar activo, actualización inglesa de `docs/engineering/auth.md`, configuración local sólo si necesaria.
- Pendiente: capturas de ambas pantallas a 412×915, 768×1024 y 1280, informe final `O2-auth-44.md`, gates `npm run lint`, `npm run build`, `npm run size`, `npm run test` desde frontend.
- Integración autorizada por coordinador: pruebas acotadas del nuevo journey durante desarrollo y `npm run test:integration` UNA vez al final; ninguna ejecutada; no reiniciar servicios ni db reset, sin SQL/remoto/.opencode.
- Pausa: no servidores propios iniciados ni procesos propios pendientes; NO worker_done por instrucción expresa del coordinador; reanudar desde este commit WIP.
