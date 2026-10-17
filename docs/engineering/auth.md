# Supabase Auth configuration

Status: 2026-10-15 · GitHub #44 · OND-d40. Local values live in
[`supabase/config.toml`](../../supabase/config.toml) and mirror the intended remote settings.
The remote project is configured manually in the Supabase dashboard; `config.toml` does not
apply to it. Use the checklist below when the release gate authorizes a remote change, and
record the date and the value you saw before and after.

Authorization does not depend on Auth settings: RLS, grants and the active-profile helpers
(B2) decide what a user can read or write. Deactivating a profile (`perfiles.activo = false`)
stops data access immediately, even while an already issued JWT is still valid. Auth
configuration reduces the chance of account abuse; it does not replace that check.

## Remote dashboard checklist

Dashboard paths can change between Supabase releases. Confirm them in the current UI.

| Setting | Local value (`config.toml`) | Remote dashboard | Done |
| --- | --- | --- | --- |
| New sign-ups | Off (`[auth].enable_signup = false`; `[auth.email].enable_signup` stays `true` because locally it switches the whole email provider, including login) | Authentication → Sign In / Providers: disable "Allow new users to sign up" while keeping the Email provider enabled. Accounts are created by an administrator. | ☐ |
| Email confirmation | On (`[auth.email].enable_confirmations = true`) | Authentication → Sign In / Providers → Email: "Confirm email" on. | ☐ |
| Minimum password length | 10 (`minimum_password_length = 10`) | Authentication → Policies: minimum length 10. | ☐ |
| Password requirements | `lower_upper_letters_digits` | Authentication → Policies: lowercase, uppercase, letters and digits. | ☐ |
| Secure password change | On (`[auth.email].secure_password_change = true`) | Authentication → Policies: require a recent sign-in or reauthentication to change the password. | ☐ |
| Refresh token rotation | On, reuse interval 10 s (`enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`) | Authentication → Sessions: rotation on, reuse interval 10 seconds. | ☐ |
| JWT expiry | 3600 s (`jwt_expiry = 3600`) | Authentication → JWT / Sessions: 3600 seconds. | ☐ |
| Rate limits | Local defaults (`[auth.rate_limit]`) | Authentication → Rate limits: keep the dashboard defaults. Do not copy the local values, which are for development. | ☐ |
| Site URL and redirect URLs | Local site `http://127.0.0.1:3000`; exact recovery callbacks on port 5173 | Authentication → URL Configuration: use the environment site URL and approve the exact `/restablecer` callback below. No wildcard entries or localhost URLs on the production project. | ☐ |
| Anonymous sign-ins | Off | Authentication → Sign In / Providers → Anonymous: off. | ☐ |
| Manual account linking | Off | Keep off unless a story requires it. | ☐ |
| Leaked password protection | Not in local config | Requires the Supabase **Pro plan**. On other plans, document the limit and keep the password policy above. | ☐ |
| MFA for administrators | Enrollment and verification off | **Open decision** under #44: not defined yet. Do not enable it on the remote project until the decision is recorded here. | ☐ |
| CAPTCHA (Turnstile or hCaptcha) | Off | **Open decision** under #44. If enabled, login and recovery must send valid tokens, and expired-token and retry errors must be tested. | ☐ |

## Password recovery

The repository now implements self-service password recovery for #44 alongside HU-31.
The public routes `/recuperar` and `/restablecer` sit outside `ProtectedRoute` and load
lazily so the recovery forms do not inflate the login bundle. UI messages are Spanish.

1. Login links to **¿Olvidaste tu contraseña?**. `/recuperar` validates the email with
   Zod v4 and calls the auth domain service, which uses `resetPasswordForEmail` with
   `redirectTo = window.location.origin + '/restablecer'`.
2. A successful request always shows the same neutral message: if the email is registered,
   instructions will arrive. A 60-second client retry delay survives a tab reload and
   also applies after a failed request. This is UX throttling; Auth server rate limits
   remain the abuse control and must not be weakened to match the browser timer.
3. Supabase consumes the callback and emits `PASSWORD_RECOVERY`. `AuthProvider` clears
   ERP profile/cache/draft state and keeps that session outside protected screens. It
   remembers only the recovery `session_id` in browser storage, preserving isolation on
   refresh, repeated auth events, reload and another tab in the same browser. This is a
   UI boundary, not an additional RLS rule: the Auth recovery JWT is still authenticated.
4. `/restablecer` accepts a new password and confirmation. Its Zod policy matches
   `config.toml`: at least 10 characters, one ASCII lowercase letter, one uppercase letter
   and one digit. `updateUser({ password })` runs through `domains/auth/api.ts`.
5. After the update, the recovery session is signed out and the app returns to Login
   with a success message. If sign-out fails, the reset screen retains a dedicated retry
   action without submitting the password change again. A normal login is required to
   enter the ERP.
6. A missing recovery session or an expired/reused/invalid callback displays a clear
   Spanish error and a link to request another email. Backend failures never disclose
   account existence or raw diagnostics.

### Exact redirect URLs to approve externally

These are proposals, not applied dashboard settings. `config.toml` affects the local
stack only. The responsible owner must approve the target host for each environment.

| Environment | Site URL | Allowed recovery redirect | State |
| --- | --- | --- | --- |
| Production | `https://ondina-erp.vercel.app` | `https://ondina-erp.vercel.app/restablecer` | Proposed from the production URL in `health.yml`; verify and approve in the production Supabase panel before release. |
| Hosted development | Stable URL pending definition by the owner (#39) | The exact approved development origin plus `/restablecer` | No stable development alias is declared by `deploy-develop.yml`; define it before adding a callback. Do not invent an alias or allow preview wildcards. |
| Local Vite | Existing site `http://127.0.0.1:3000` retained | `http://127.0.0.1:5173/restablecer` and `http://localhost:5173/restablecer` | Added to the local allowlist to match Vite's default port. Effective at the next normal `supabase start`; no services were restarted for this change. |

A Vite server on another origin/port needs its own exact callback. Do not approve wildcard
hosts or paths. Test delivery and callback navigation on staging after the approved panel
change; the token-exchange journey alone does not establish a deployed redirect allowlist.
See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

### Pending owner decisions

- **Custom SMTP:** choose a transactional provider, verify the sender domain and configure
  SMTP secrets only in Supabase's dashboard/secret store. Supabase's default sender is
  restricted, has low delivery limits and is unsuitable as the production delivery plan.
  Validate delivery, spam placement, an expired link and rate-limit feedback before release.
  See [custom SMTP and default sender limits](https://supabase.com/docs/guides/auth/auth-smtp).
- **CAPTCHA:** propose Cloudflare Turnstile on login and recovery, with an accessible retry
  after expiration, `captchaToken` passed through auth services, and mobile/error tests.
  Keep disabled until the owner approves the provider, privacy implications and UX.
  See [bot protection](https://supabase.com/docs/guides/auth/auth-captcha).
- **MFA:** propose TOTP for administrators (including global administration), with enrollment,
  AAL2 verification and an administrator recovery procedure; decide whether sensitive
  operations also need database enforcement of AAL2. Keep disabled until that scope is
  approved. See [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).

Never publish service-role keys, recovery tokens or SMTP secrets. No remote settings,
CAPTCHA, MFA, SQL or migrations were changed by this implementation.

### Local integration evidence

`frontend/tests/integration/auth-recuperacion.journey.ts` requests a recovery email for
its own policy-compliant synthetic account, polls Mailpit at
`http://127.0.0.1:54324/api/v1/messages`, extracts the recovery hash, and exchanges it with
`verifyOtp({ type: 'recovery', token_hash })`. It verifies `PASSWORD_RECOVERY`, changes the
password through the real domain service, signs out, logs in with the new password and
rejects reuse with `otp_expired`. A `finally` block restores and verifies the original
password before deleting the dedicated Auth fixture.

The second test signs in an active synthetic seller, freezes its JWT in a PostgREST
Authorization header, deactivates the profile through the local verifier, and checks that
`carga_vendedor` and `productos` return no rows while Auth still accepts the JWT. It
restores `activo` and confirms the same JWT reads its original rows again. This adds the
active-to-inactive transition to the existing inactive-profile pgTAP/B5 coverage without
changing SQL. It does not establish Realtime disconnect behavior or JWT revocation.

From `frontend/`, with the isolated local stack and Mailpit already running:

```bash
npx vitest run -c vitest.integration.config.ts tests/integration/auth-recuperacion.journey.ts
npm run test:integration
```

Coordinate the full-suite window before running it on a shared local database: the existing
global setup normalizes synthetic balances. Do not reset or restart the shared stack.

## Validation (staging, synthetic users only)

1. Create two synthetic accounts with an administrator: one active seller, one that will be
   deactivated.
2. Check that self-service sign-up is rejected and that a password below 10 characters or
   without the required classes is rejected.
3. Trigger a password change and confirm it asks for recent authentication.
4. Use an expired invitation or recovery link and confirm the error is shown and no session
   is created.
5. Deactivate the second account (`perfiles.activo = false`), keep its JWT, and confirm that
   reads through PostgREST and Realtime return no rows. Restore the account afterwards.
6. Roll back any setting that was changed for the test, and record the dashboard value.

## Related

- [Database and migrations](database.md), including the B4 indexes and Realtime publication.
- [`supabase/config.toml`](../../supabase/config.toml), the local mirror of these settings.
