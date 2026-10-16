#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
repository=${GITLEAKS_REPO:-$root}
binary=${GITLEAKS_BIN:-gitleaks}
mode=${1:?Usage: scan-gitleaks.sh all | pr BASE_SHA HEAD_SHA | push BEFORE_SHA HEAD_SHA}

case "$mode" in
  all) log_options=--all ;;
  pr|push)
    base=${2:?Missing base SHA}
    head=${3:?Missing head SHA}
    if [[ ! $base =~ ^[[:xdigit:]]{40}$ || ! $head =~ ^[[:xdigit:]]{40}$ ]]; then
      echo 'Expected full hexadecimal commit SHAs.' >&2
      exit 2
    fi
    git -C "$repository" cat-file -e "${head}^{commit}"
    if [[ $mode == push && $base == 0000000000000000000000000000000000000000 ]]; then
      # A newly created branch has no previous tip: scan its entire history.
      log_options=$head
    else
      # Fail closed if the checkout does not contain either endpoint.
      git -C "$repository" cat-file -e "${base}^{commit}"
      if [[ $mode == pr ]]; then
        base=$(git -C "$repository" merge-base "$base" "$head")
      fi
      log_options="${base}..${head}"
    fi
    ;;
  *) echo 'Unknown scan mode.' >&2; exit 2 ;;
esac

# Do not let inline comments suppress findings; exceptions belong in reviewed config.
"$binary" git "$repository" --config "$root/.gitleaks.toml" \
  --log-opts="$log_options" --redact=100 --no-banner --ignore-gitleaks-allow
