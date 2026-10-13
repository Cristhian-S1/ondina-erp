# Supabase Auth configuration

Status: 2026-10-13 · GitHub #44 · OND-d40. Local values live in
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
| Site URL and redirect URLs | Local `127.0.0.1` only | Authentication → URL Configuration: production site URL and only the approved environment redirect URLs. Remove local and wildcard entries. | ☐ |
| Anonymous sign-ins | Off | Authentication → Sign In / Providers → Anonymous: off. | ☐ |
| Manual account linking | Off | Keep off unless a story requires it. | ☐ |
| Leaked password protection | Not in local config | Requires the Supabase **Pro plan**. On other plans, document the limit and keep the password policy above. | ☐ |
| MFA for administrators | Enrollment and verification off | **Open decision** under #44: not defined yet. Do not enable it on the remote project until the decision is recorded here. | ☐ |
| CAPTCHA (Turnstile or hCaptcha) | Off | **Open decision** under #44. If enabled, login and recovery must send valid tokens, and expired-token and retry errors must be tested. | ☐ |

## Password recovery

- HU-31 does not include a recovery screen. Until a user story adds one, recovery is done by an
  administrator, who resets the password or sends a new invitation from the dashboard.
- Recovery links must point only to the approved redirect URLs in the table above. Test an
  expired link and a reused link on staging with synthetic users before relying on them.
- Do not publish the service-role key or SMTP secrets. Use environment variables or the
  dashboard secret fields.

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
