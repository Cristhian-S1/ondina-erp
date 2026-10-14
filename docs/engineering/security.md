# CI Security Controls

This guide describes repository controls introduced for #46 / OND-o5g on
2026-10-14. External configuration below is a proposal for the repository owner;
it has not been applied by this change.

## Secret scanning

`.github/workflows/security.yml` runs on every pull request targeting `develop`
or `main` and every push to those branches, without path filters. The check is
named `Secret scan + self-test`.

- Gitleaks **8.30.1** is downloaded directly from its official Linux x86_64
  release. `scripts/ci/install-gitleaks.sh` verifies the archive against the
  committed SHA-256 digest before extracting or executing it:
  `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`.
- Checkout fetches complete history and does not persist Git credentials.
  A PR scans `merge-base(base, head)..head`; a push scans `before..head`.
  A new branch whose `before` is all zeros scans the entire history reachable
  from its new tip. Missing/invalid endpoints fail the check rather than silently
  reducing coverage. A force push with an unavailable previous tip needs owner
  investigation; the check fails closed.
- The scanner reads commit patches, so adding and then deleting a credential
  within the same range still fails. A local `all` run scans all reachable refs.
  Range scans do not recertify older commits outside that range or unreachable
  objects; run a full scan when adopting or changing the policy.
- Every scanner invocation uses `--redact=100`. Normal scans emit finding counts
  rather than verbose source lines, and no secret report artifact is uploaded.
  Inline `gitleaks:allow` comments are ignored; review exceptions in
  `.gitleaks.toml` instead.
- The config extends the upstream default rules. Its only added exception is the
  exact public Supabase `anon` JWT in the deleted
  `docs/setup-vercel-supabase-github.md`, restricted by **both** path and value and
  to rule `jwt`. The token payload was reviewed as `role=anon`, with SHA-256
  `85410bc506548bca60fbeb0096e9c5fa920a2f5838b2a1e0d7c10663eaf0007a`.
  No whole archive, commit, local-demo token family or privileged key is exempted.
  Public anon keys rely on database authorization and are not evidence that RLS
  is safe. A future false positive needs its own bounded, explained review.

Run locally on Linux x86_64, from the repository root:

```bash
bash scripts/ci/install-gitleaks.sh /tmp/ondina-gitleaks-bin
export GITLEAKS_BIN=/tmp/ondina-gitleaks-bin/gitleaks
bash scripts/ci/test-gitleaks.sh
bash scripts/ci/scan-gitleaks.sh all
# To reproduce a PR or push, supply full 40-character commit SHAs:
# bash scripts/ci/scan-gitleaks.sh pr BASE_SHA HEAD_SHA
# bash scripts/ci/scan-gitleaks.sh push BEFORE_SHA HEAD_SHA
```

The self-test generates a random, nonfunctional GitHub PAT-shaped value in a
private temporary directory, requires the dedicated detection exit code `42`,
and checks that verbose stdout/stderr and the JSON report omit the complete
value and that the reported secret is `REDACTED`. It also creates an isolated
temporary Git repository, adds and removes the fixture, and verifies both PR
and push ranges fail with exit `1`, including the first-push case, while an empty
range passes and an unavailable endpoint fails closed. Temporary files
are removed on exit. The same self-test runs before the repository scan in CI;
no complete synthetic credential is committed. Do not run it with shell tracing.

## Dependency review and permissions

The PR-only `Dependency review (runtime high)` check uses
`actions/dependency-review-action` **v5.0.0** pinned to
`a1d282b36b6f3519aa1f3fc636f609c47dddb294`.

| Scope | Policy | Reason |
| --- | --- | --- |
| Runtime and unknown | Fail on **high** and critical advisories | Block substantial application exposure; unknown scope cannot bypass the runtime gate. |
| Development | Report all advisory severities as warnings, without blocking | Keep build-tool exposure visible for triage while distinguishing it from runtime; reassess this threshold if build execution risk changes. |

Both steps produce Actions logs/job summaries and set `comment-summary-in-pr:
never`. License checking is explicitly disabled because this change defines a
vulnerability policy, not an approved license policy. The dependency review API
compares the PR revisions, including lockfile changes; it does not execute PR
code or install its packages. It is not a full audit of unchanged dependencies.

The Security workflow grants no permissions by default, then grants only
`contents: read` to each job. It references no repository or environment secrets.
It uses `pull_request`, never `pull_request_target`, and therefore does not give
fork PR code a privileged execution context. Fork runs may still need GitHub's
normal approval. The existing CI deploy job additionally requires a canonical
repository push to `develop`; manual/production deploys do not trigger on PRs.
Local synthetic Supabase keys generated inside the existing CI stack are test
credentials, not repository/production credentials.

The Health workflow grants no permissions by default and grants `issues: write`
only to its incident-management job; it needs no repository contents access.
Other workflows retain `contents: read`; no workflow requests
`pull-requests: write` or `write-all`. Each job has a timeout.

Dependabot already proposes weekly npm and GitHub Actions updates. Review action
updates by resolving the release tag through
`gh api repos/OWNER/REPO/git/ref/tags/TAG`; if its object type is `tag`, resolve
`gh api repos/OWNER/REPO/git/tags/TAG_OBJECT_SHA` until it reaches a commit.
Keep the version comment next to the resulting SHA. Gitleaks binary updates
need a manual PR changing **both** version and the independently reviewed release
checksum; run the self-test and full history scan again. Do not download a mutable
checksum file at CI runtime and trust it as the expected digest.

## Responding to a real exposed credential

1. Treat the credential as compromised. Notify the responsible owner through the
   approved private channel; record only provider, affected environment, finding
   location and incident reference in an issue. Never paste the value into an
   issue, PR, chat, screenshot, log or reproduction command.
2. Revoke or rotate it at the provider through a secure channel immediately.
   Restrict access if needed, inspect provider audit logs and assess misuse and
   affected systems. Do not rely on deleting the Git file to invalidate a key.
3. Update the appropriate environment secret securely and deploy/restart the
   consumers through their normal approval gates. Confirm that the old
   credential is rejected and that the replacement works, without logging it.
4. Remove the value from current files and affected logs/artifacts. Consider a
   coordinated history purge only when the owner determines it is appropriate
   after rotation; plan forks/clones, open PRs, protected refs and backups before
   rewriting history. Rotation is required even if history is purged.
5. Re-run the full redacted scan and relevant checks, verify provider revocation
   and application behavior, then record sanitized evidence and follow-up work.
   Never allowlist an actual private credential just to make CI green.

## External configuration proposal — do not apply automatically

Read-only GitHub API inspection on 2026-10-14 found the three Vercel secret
**names** at repository scope and no secrets in `development` or `production`.
The existing deploy jobs already select these environments, so the proposed
scope change requires no workflow secret-name change. Values must come from the
owner's secure channel; the labels below are not literal secret values.

Exact desired configuration delta:

```diff
 repository.actions.secrets:
-  VERCEL_TOKEN
-  VERCEL_PROJECT_ID
-  VERCEL_ORG_ID
 environments.development.actions.secrets:
+  VERCEL_TOKEN: [development-scoped token, supplied securely]
+  VERCEL_PROJECT_ID: [intended development project, supplied securely]
+  VERCEL_ORG_ID: [intended development account/team, supplied securely]
 environments.production.actions.secrets:
+  VERCEL_TOKEN: [production-scoped token, supplied securely]
+  VERCEL_PROJECT_ID: [intended production project, supplied securely]
+  VERCEL_ORG_ID: [intended production account/team, supplied securely]
```

The owner should create the environment values, preserve existing reviewers and
branch restrictions, verify authorized development and production deployments,
then remove repository-scope copies. Use the narrowest provider token scope
available; do not put values into CLI arguments or this document.

Read-only branch protection inspection found the following required contexts.
Apply the additive delta to **both** `develop` and `main`, retaining the existing
check app bindings and all other protections (`strict=false` for `develop`,
`strict=true` for `main`):

```diff
 required_status_checks.contexts:
   - "Lint + typecheck + build + test"
   - "Validar migraciones Supabase"
+  - "Secret scan + self-test"
+  - "Dependency review (runtime high)"
```

Wait for successful real PR runs before selecting their exact check contexts
and GitHub Actions app binding in branch rules. The dependency job intentionally
skips pushes, so validate these requirements on a PR. If branch rules use
rulesets instead, add the same check contexts to the existing rule without
replacing unrelated settings. No remote settings were changed by this task.

Security and deployment currently run in separate workflows; a security failure
does not itself create a `needs` dependency for a direct push deployment.
Required PR checks enforce the merge path after the owner enables them; existing
direct-push/admin bypass policies remain the owner's decision. Live GitHub
execution, required-check enforcement and environment-secret migration must be
verified after integration. Local checks alone do not prove those remote gates.

References: [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/tree/v8.30.1)
and [Dependency Review v5.0.0 inputs](https://github.com/actions/dependency-review-action/blob/v5.0.0/action.yml).
