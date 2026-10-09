#!/usr/bin/env bash
# Recupera Beads sin reinicializar ni borrar issues existentes.
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
command -v bd >/dev/null || { echo "Falta bd: consulta .beads/README.md" >&2; exit 1; }
if [[ -d .beads/embeddeddolt || -d .beads/dolt ]]; then
  bd stats
else
  bd bootstrap --yes
fi
bd hooks install --beads
git config --local core.hooksPath .beads/hooks
bd stats
bd ready
