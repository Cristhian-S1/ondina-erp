#!/usr/bin/env bash
# Recupera Beads sin reinicializar ni borrar issues existentes.
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
command -v bd >/dev/null || { echo "Falta bd: consulta .beads/README.md" >&2; exit 1; }
chmod 700 .beads
if ! git config --local --get beads.role >/dev/null; then
  git config --local beads.role contributor
fi
if [[ -d .beads/embeddeddolt || -d .beads/dolt ]]; then
  bd stats
else
  bd bootstrap --yes
  # bd bootstrap omite el salto de línea final; conserva el formato versionado.
  if [[ -s .beads/config.yaml && -n "$(tail -c 1 .beads/config.yaml)" ]]; then
    printf '\n' >> .beads/config.yaml
  fi
fi
bd hooks install --beads
git config --local core.hooksPath .beads/hooks
bd stats
bd ready
