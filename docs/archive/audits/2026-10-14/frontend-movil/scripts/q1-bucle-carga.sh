#!/usr/bin/env bash
# Q1 (OND-c07.19) - Bucle de detección de pruebas intermitentes bajo carga simulada.
#
# Qué hace: corre N corridas de la suite completa (npx vitest run --reporter=verbose,
# desde frontend/) con carga simulada: 8 bucles de CPU anclados con taskset a los 8
# primeros núcleos + la carga ambiental del host. Registra rc, duración y loadavg
# por corrida; copia el log completo de cada corrida a $OUT (fallo-*.log cuando rc≠0).
# Informe fuente: Q1-flaky.md en este mismo directorio (2026-10-14, 14/15 → 15/15).
#
# Uso (desde la raíz del repo; requiere node_modules en frontend/):
#   docs/archive/audits/2026-10-14/frontend-movil/scripts/q1-bucle-carga.sh [corridas] [out]
#   (por defecto: 15 corridas, out=/tmp/opencode/q1-bucle-$(date +%H%M%S))
set -u
RUNS=${1:-15}
DIR_OUT=${2:-/tmp/opencode/q1-bucle-$(date +%H%M%S)}
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
Cores_Fijos=8
cd "$REPO_ROOT/frontend" || exit 1
mkdir -p "$DIR_OUT"

# --- carga: Cores_Fijos bucles busy (labrados al core i-1); mueren al terminar ---
PIDS=()
for i in $(seq 1 "$Cores_Fijos"); do
  taskset -c $((i - 1)) sh -c 'a=0; while :; do a=$(( (a + 1) % 1000000 )); done' >/dev/null 2>&1 &
  PIDS+=("$!")
done
cleanup() {
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null; done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

for i in $(seq -w 1 "$RUNS"); do
  t0=$(date +%s)
  loadavg=$(cut -d' ' -f1-3 /proc/loadavg)
  npx vitest run --reporter=verbose > "$DIR_OUT/run-$i.log" 2>&1
  rc=$?
  t1=$(date +%s)
  echo "run=$i rc=$rc dur=$((t1 - t0))s load=$loadavg date=$(date +%FT%T)"
  if [ "$rc" -ne 0 ]; then
    cp "$DIR_OUT/run-$i.log" "$DIR_OUT/fallo-run-$i.log"
    echo "  FALLO en run $i (ver fallo-run-$i.log)"
  fi
done
echo "LOOP_FIN runs=$RUNS out=$DIR_OUT"
