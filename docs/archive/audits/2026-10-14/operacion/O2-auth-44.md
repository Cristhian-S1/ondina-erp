# O2 — Recuperación de contraseña y corte de cuentas inactivas

Fecha de ejecución: 2026-10-15 (America/Santiago). GitHub #44 · Beads OND-d40.
Rama: `chore/auth-recuperacion`. Base verificada: `origin/develop` = `6903f59`.
El `git fetch origin develop` inicial no trajo avances respecto de la base del WIP `01664a2`;
no hizo falta rebase. Entrega exclusivamente local, sin push, PR ni despliegue.
Esto completa la parte de repositorio despachada; no implica cerrar #44/OND-d40: la
configuración externa y las decisiones del responsable siguen pendientes.

## Resultado y alcance

Login incorpora **¿Olvidaste tu contraseña?** y las rutas públicas `/recuperar` y
`/restablecer`. Los formularios usan React Hook Form y Zod v4; el servicio está en
`frontend/src/domains/auth/api.ts`. Solicitud neutra, cooldown de 60 segundos persistido en
la pestaña, validación en español, cambio de contraseña, cierre de sesión y retorno a Login.
Las páginas se cargan de forma diferida para conservar el presupuesto del bundle inicial.

`AuthProvider` separa la sesión `PASSWORD_RECOVERY` del perfil ERP y limpia caché/borrador.
Mantiene esa separación en `SIGNED_IN` de la misma sesión, `USER_UPDATED`, renovación,
recarga y otra pestaña. Guarda sólo el identificador `session_id`, sin duplicar tokens.
La recuperación permite una nueva autenticación normal después del cierre de sesión.

Se añadió un journey contra Supabase **local** y Mailpit reales, con contraseña original
restaurada y comprobada antes de eliminar la cuenta Auth sintética propia. Otra prueba
comprueba activo → inactivo → activo con **el mismo JWT**, lecturas PostgREST vacías mientras
está inactivo y restauración de las filas originales al reactivarlo. No se cambió SQL.

## Criterio de aceptación de #44 → evidencia

| Criterio solicitado | Evidencia concreta | Resultado |
| --- | --- | --- |
| Enlace desde Login y rutas públicas | `frontend/src/pages/Login.tsx`; `frontend/src/App.tsx`; prueba `login links to recovery` | PASS |
| Solicitud con `resetPasswordForEmail` y redirect del origen actual a `/restablecer` | `frontend/src/domains/auth/api.ts`; `frontend/src/pages/SolicitarRecuperacion.tsx`; `api.test.ts` comprueba parámetros exactos | PASS |
| Mensaje neutro, envío pendiente y límite de reintento | `Recuperacion.test.tsx`: correo inválido/foco, envío pendiente, éxito neutro, error seguro, cooldown persistido y habilitación al terminar 60 s | PASS |
| `PASSWORD_RECOVERY` y sesión aislada del ERP | `AuthProvider.tsx:94`; `AuthProvider.test.tsx` añade 7 casos; navegador: 0 peticiones a `/rest/v1/perfiles`, recarga, ruta `/ventas` y otra pestaña | PASS local |
| Política de contraseña igual a config y confirmación | `domains/auth/schemas.ts`: mínimo 10, minúscula/mayúscula/dígito ASCII; unitarias de formulario y servicio, incluido límite de 10 caracteres | PASS |
| `updateUser`, cierre y regreso al Login | `Restablecer.tsx`; unitarias de Guardando/error/reintento de cierre sin repetir mutation; recorrido real de navegador y journey Mailpit | PASS |
| Enlace inválido/expirado/reutilizado | Unitarias de hash/query inválidos, incluso con sesión previa; journey real rechaza reutilización con `otp_expired` y sesión nula; capturas de error | PASS |
| Supabase sólo en servicio/contexto | Nuevas páginas importan `domains/auth/api.ts` y `useAuth`; ninguna importa el cliente Supabase | PASS estático |
| Integración Mailpit real y restauración de contraseña | `frontend/tests/integration/auth-recuperacion.journey.ts:52`: correo, hash real, `verifyOtp`, evento, update, login nuevo, reutilización, restauración verificada y eliminación de fixture en `finally` | PASS 2/2 journeys O2 |
| Corte después de desactivar con JWT aún válido | Mismo archivo, desde línea 103: Authorization fijo, `exp` vigente y `getUser(jwt)` válido; `carga_vendedor`/`productos` vacíos; estado restaurado y lectura inicial recuperada | PASS |
| Documentación inglesa y propuestas externas | `docs/engineering/auth.md`: flujo, callbacks exactos, SMTP, Turnstile/TOTP pendientes, alcance de RLS y comandos de prueba | PASS repositorio |
| Pantallas a 412×915, 768×1024 y 1280 | 6 capturas nominales, 5 de estados; tabla de enlaces abajo; JSON de controles ≥44 px y ausencia de desbordamiento | PASS visual |
| lint/build/size/test y suite integración | Resultados y ventanas abajo | PASS |
| Sin SQL, remoto, CAPTCHA/MFA, CSP ni `.opencode/` | Diff limitado a auth/rutas, tests, URLs locales, documentación e informe/capturas | PASS de alcance |

## Verificación ejecutada

Todos los comandos npm se ejecutaron desde `frontend/`.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | PASS, sin errores ni advertencias |
| `npm run build` | PASS, TypeScript y Vite |
| `npm run size` | PASS con los presupuestos originales intactos |
| `npm run test` | **568/568**, 46 archivos, última ejecución 01:39, 6,04 s |
| `npx vitest run -c vitest.integration.config.ts tests/integration/auth-recuperacion.journey.ts` | **2/2**, 3,76 s, durante desarrollo autorizado |
| `npm run test:integration` | **24/24**, 7 archivos, 8,11 s; ejecutado **una vez** a las 01:35 en ventana concedida por el coordinador |
| Navegador Chrome headless + Playwright | PASS: 11 capturas, 0 errores consola/pageerror, 0 consultas de perfil durante recuperación; foco de validación y cambio/cierre/login reales |
| `git diff --check` | PASS |
| `node --check docs/archive/audits/2026-10-14/operacion/O2-visual.cjs` | PASS |

Métricas `size` (bytes): JS de entrada gzip **110084 / 117979**; CSS de entrada gzip
**45767 / 50330**; chunk JS máximo **352389 / 375855**. No se subieron presupuestos.

Hallazgos resueltos durante la reanudación:

- Fixture de Login del WIP corregido a `recovery=false`.
- Nueva regresión roja reprodujo que `SIGNED_IN` de la recuperación cargaba perfil; corregida
  preservando el identificador de sesión y probada en eventos/recarga/otra pestaña.
- El primer intento acotado encontró que las contraseñas antiguas B5 no cumplen la política
  actual al restaurarlas; se usa cuenta Auth dedicada con contraseña compatible, sin alterar
  las definiciones B5. El teardown existente desactivó/eliminó sus fixtures de esa corrida.
- Importación inicial de los formularios aumentaba el bundle: corregida con `lazy/Suspense`.
- Un test nuevo del cooldown instalaba los fake timers después del intervalo real; se
  corrigió el orden del test. Última suite completa unitaria verde.

## Evidencia visual

Capturas PNG optimizadas sin pérdida: **11 archivos, 1713783 bytes** en total.
Las dos vistas son nuevas: no se presentan capturas ficticias de un estado «antes».
Se inspeccionaron visualmente las seis capturas nominales y el error móvil.

| Vista | 412×915 | 768×1024 | 1280×900 |
| --- | --- | --- | --- |
| Solicitar recuperación | [Móvil](../frontend-movil/capturas/O2/recuperar-412x915-despues.png) | [Tablet](../frontend-movil/capturas/O2/recuperar-768x1024-despues.png) | [Escritorio](../frontend-movil/capturas/O2/recuperar-1280x900-despues.png) |
| Nueva contraseña | [Móvil](../frontend-movil/capturas/O2/restablecer-412x915-despues.png) | [Tablet](../frontend-movil/capturas/O2/restablecer-768x1024-despues.png) | [Escritorio](../frontend-movil/capturas/O2/restablecer-1280x900-despues.png) |
| Enlace inválido | [Móvil](../frontend-movil/capturas/O2/restablecer-enlace-invalido-412x915-despues.png) | [Tablet](../frontend-movil/capturas/O2/restablecer-enlace-invalido-768x1024-despues.png) | [Escritorio](../frontend-movil/capturas/O2/restablecer-enlace-invalido-1280x900-despues.png) |

Otros estados móviles: [envío neutro](../frontend-movil/capturas/O2/recuperar-enviado-412x915-despues.png),
[validación y foco](../frontend-movil/capturas/O2/restablecer-validacion-412x915-despues.png).
[Mediciones del navegador](../frontend-movil/capturas/O2/verificacion.json).

Runner duradero: [O2-visual.cjs](O2-visual.cjs). Requiere Vite propio en `127.0.0.1:5173`,
Supabase local ya iniciado, `supabase status -o env`, Playwright y Chrome instalados. Se puede
indicar `O2_PLAYWRIGHT_MODULE` y `O2_CHROME_EXECUTABLE`; no instala dependencias ni reinicia nada.
El runner crea/restaura/elimina su propia cuenta sintética. No guarda tokens ni claves en
las capturas o el JSON. Para reproducirlo desde la raíz:

```bash
node docs/archive/audits/2026-10-14/operacion/O2-visual.cjs
```

## Commits locales y archivos

El WIP `01664a2` fue reorganizado, con autorización del despacho, en commits coherentes:

- `9971538` — `feat(auth): add public password recovery and isolate recovery sessions`:
  rutas/Login/guard, contexto, `domains/auth` y pruebas unitarias de ambas pantallas/servicio.
- `e01630e` — `test(auth): verify Mailpit recovery and live JWT deactivation cutoff`:
  journey nuevo y allowlist local de `supabase/config.toml`.
- El commit final `docs(auth): document recovery rollout and local acceptance evidence`
  contiene `docs/engineering/auth.md`, este informe, el checkpoint WIP histórico,
  `O2-visual.cjs`, `frontend-movil/O2-entrega.md`, 11 PNG y `verificacion.json`.

El coordinador recibe los SHA completos y debe integrar estos commits finales, no el WIP
anterior. `OND-d40` queda abierto por sus decisiones/configuración externa restantes.

## Configuración externa propuesta, sin aplicar

| Acción del responsable | Propuesta | Estado |
| --- | --- | --- |
| Site URL producción | `https://ondina-erp.vercel.app` | Verificar/aprobar en Authentication → URL Configuration |
| Callback producción | `https://ondina-erp.vercel.app/restablecer`, exacto y sin comodines | Pendiente de aprobación/aplicación en panel |
| Callback de desarrollo hospedado | URL estable pendiente de definir por el responsable, ligada a #39; luego su origen exacto + `/restablecer` | Sin alias inventado; no hay URL estable documentada en deploy-develop |
| SMTP propio | Proveedor transaccional, dominio remitente verificado, secretos sólo en panel; probar entrega y límites | Decisión pendiente; SMTP predeterminado tiene límites bajos y destinatarios restringidos |
| CAPTCHA | Propuesta Turnstile en login/recuperación con token expirado/reintento accesible y pruebas móviles | Decisión pendiente; no activado |
| MFA | Propuesta TOTP para administración, incluida global; definir enrollment, AAL2, recuperación y eventual enforcement de operaciones sensibles | Decisión pendiente; no activado |

Único cambio de configuración local: `additional_redirect_urls` añade
`http://127.0.0.1:5173/restablecer` y `http://localhost:5173/restablecer`; retiene el Site URL
existente en :3000. Aplica en el próximo `supabase start` normal; **no se reinició ningún servicio**.

## Límites precisos

- La prueba Mailpit intercambia el hash con `verifyOtp`, según instrucción del coordinador;
  no depende de que la allowlist aún no recargada redirija el navegador a :5173. La evidencia
  visual usa una sesión real y construye su callback local. La navegación desde el enlace
  de correo a una URL aprobada en un despliegue debe probarse después de configurar el panel.
- El corte demostrado es de **datos PostgREST** con un JWT vigente, no revocación del JWT,
  cierre inmediato del navegador ni prueba nueva de Realtime. La UI de recuperación tampoco
  añade restricciones RLS al JWT autenticado; se preserva la autorización existente.
- El marcador de recuperación depende de almacenamiento del navegador para sobrevivir a
  recargas/otras pestañas; si está deshabilitado, la sesión en memoria conserva la separación
  durante la ejecución actual. No se duplican credenciales en ese marcador.
- No se aplicaron cambios al Supabase remoto, SQL/migraciones, CSP, CAPTCHA, MFA o `.opencode/`.
  Tampoco se hizo reset de BD, push, PR, merge ni despliegue. La suite existente sí normaliza
  saldos sintéticos locales, dentro de la ventana autorizada.
