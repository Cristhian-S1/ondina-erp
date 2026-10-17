#!/usr/bin/env bash
# Never enable shell tracing: the synthetic value must stay out of logs too.
set +x
set -euo pipefail
umask 077
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
binary=${GITLEAKS_BIN:-gitleaks}
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
mkdir "$temporary/fixture"

# Construct a GitHub PAT-shaped value at runtime; no complete fixture is tracked.
python3 - "$temporary" <<'PY'
import pathlib, secrets, string, sys
root = pathlib.Path(sys.argv[1])
value = 'ghp_' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(36))
(root / 'value').write_text(value)
(root / 'fixture' / 'credential.txt').write_text('github_token=' + value + '\n')
PY

status=0
"$binary" dir "$temporary/fixture" --config "$root/.gitleaks.toml" \
  --redact=100 --verbose --no-banner --ignore-gitleaks-allow --exit-code 42 \
  --report-format json --report-path "$temporary/report.json" \
  > "$temporary/output" 2>&1 || status=$?
if [[ $status != 42 ]]; then
  echo 'FAIL: expected the dedicated leak exit code 42.' >&2
  exit 1
fi
python3 - "$temporary" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
value = (root / 'value').read_text()
for name in ('output', 'report.json'):
    if value in (root / name).read_text():
        sys.exit('FAIL: synthetic value appeared in scanner output or report.')
findings = json.loads((root / 'report.json').read_text())
if not any(f['RuleID'] == 'github-pat' and f['Secret'] == 'REDACTED' for f in findings):
    sys.exit('FAIL: missing redacted GitHub PAT finding.')
PY
echo 'PASS: synthetic credential detected (exit 42); log and JSON contain no value.'

# Exercise the same git range wrapper used in CI, including a removed credential.
repository="$temporary/fixture"
git -C "$repository" init --quiet
git -C "$repository" config user.name 'CI self-test'
git -C "$repository" config user.email 'ci-self-test@example.invalid'
git -C "$repository" config commit.gpgsign false
mv "$repository/credential.txt" "$temporary/credential.txt"
git -C "$repository" -c core.hooksPath=/dev/null commit --quiet --allow-empty -m clean
base=$(git -C "$repository" rev-parse HEAD)
mv "$temporary/credential.txt" "$repository/credential.txt"
git -C "$repository" add credential.txt
git -C "$repository" -c core.hooksPath=/dev/null commit --quiet -m synthetic
git -C "$repository" rm --quiet credential.txt
git -C "$repository" -c core.hooksPath=/dev/null commit --quiet -m removed
head=$(git -C "$repository" rev-parse HEAD)

for mode in pr push; do
  status=0
  GITLEAKS_REPO="$repository" GITLEAKS_BIN="$binary" \
    bash "$root/scripts/ci/scan-gitleaks.sh" "$mode" "$base" "$head" \
    > "$temporary/range-output" 2>&1 || status=$?
  if [[ $status != 1 ]] || grep -Fq -f "$temporary/value" "$temporary/range-output"; then
    echo "FAIL: $mode range must detect the removed credential without exposing it." >&2
    exit 1
  fi
done
# The first push to a branch must scan all commits reachable from its tip.
status=0
GITLEAKS_REPO="$repository" GITLEAKS_BIN="$binary" \
  bash "$root/scripts/ci/scan-gitleaks.sh" push \
  0000000000000000000000000000000000000000 "$head" \
  > "$temporary/first-push-output" 2>&1 || status=$?
if [[ $status != 1 ]] || grep -Fq -f "$temporary/value" "$temporary/first-push-output"; then
  echo 'FAIL: first push must detect the historical fixture without exposing it.' >&2
  exit 1
fi
status=0
GITLEAKS_REPO="$repository" GITLEAKS_BIN="$binary" \
  bash "$root/scripts/ci/scan-gitleaks.sh" push \
  ffffffffffffffffffffffffffffffffffffffff "$head" \
  > "$temporary/missing-output" 2>&1 || status=$?
if [[ $status == 0 ]]; then
  echo 'FAIL: an unavailable endpoint must fail closed.' >&2
  exit 1
fi
GITLEAKS_REPO="$repository" GITLEAKS_BIN="$binary" \
  bash "$root/scripts/ci/scan-gitleaks.sh" push "$head" "$head" \
  > "$temporary/empty-output" 2>&1
echo 'PASS: PR/push/first-push detect a removed credential; an empty range passes; missing refs fail.'
