#!/usr/bin/env bash
set -euo pipefail

# Reviewed release asset; update version and digest together in a PR.
version=8.30.1
checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
if [[ $(uname -s) != Linux || $(uname -m) != x86_64 ]]; then
  echo 'This installer supports Linux x86_64 only.' >&2
  exit 1
fi
destination=${1:?Usage: install-gitleaks.sh DESTINATION_DIRECTORY}
mkdir -p "$destination"
destination=$(cd "$destination" && pwd)
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
asset="gitleaks_${version}_linux_x64.tar.gz"
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${asset}" \
  --output "$temporary/$asset"
printf '%s  %s\n' "$checksum" "$temporary/$asset" | sha256sum --check --status
tar -xzf "$temporary/$asset" -C "$temporary" gitleaks
install -m 0755 "$temporary/gitleaks" "$destination/gitleaks"
"$destination/gitleaks" version
