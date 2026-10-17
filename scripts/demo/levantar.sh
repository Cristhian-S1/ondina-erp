#!/usr/bin/env bash
# Levanta Ondina en http://localhost:5173 con Supabase LOCAL y datos de prueba (demo/QA).
# Usa la rama que tenga checkout esta carpeta (normalmente develop).
# Uso, desde la raíz del repo:
#   scripts/demo/levantar.sh            # actualizar la rama (git pull) + levantar
#   scripts/demo/levantar.sh --sin-pull # levantar sin git pull
#   scripts/demo/levantar.sh --reset    # BD local de cero + datos de prueba
#   scripts/demo/levantar.sh --host     # accesible desde el teléfono (misma red)
#   scripts/demo/levantar.sh --detener  # detener la app y Supabase
# Nunca usa datos de producción: aborta si la API detectada no es local.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONT="$REPO/frontend"
PULL=1; RESET=0; HOST=0; DETENER=0
for arg in "$@"; do
  case "$arg" in
    --sin-pull) PULL=0 ;;
    --reset) RESET=1 ;;
    --host) HOST=1 ;;
    --detener) DETENER=1 ;;
    -h|--help) sed -n 2,10p "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg (usa --help)"; exit 1 ;;
  esac
done

paso() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

cd "$REPO"

if [ "$DETENER" = 1 ]; then
  paso "Deteniendo la app y Supabase local"
  pkill -f "$FRONT/node_modules/.bin/vite" 2>/dev/null && ok "Vite detenido" || ok "Vite no estaba corriendo"
  supabase stop >/dev/null 2>&1 && ok "Supabase detenido" || ok "Supabase no estaba corriendo"
  exit 0
fi

paso "Requisitos"
command -v docker >/dev/null || die "Falta Docker."
docker info >/dev/null 2>&1 || die "Docker no está corriendo (inicia el servicio: sudo systemctl start docker)."
command -v supabase >/dev/null || die "Falta Supabase CLI."
command -v node >/dev/null || die "Falta Node.js 22 (>= 22.12)."
[[ "$(node -v)" =~ ^v22\. ]] || printf '   \033[33m!\033[0m Node %s: el proyecto fija Node 22 (frontend/.nvmrc, CI). Suele funcionar igual; si algo falla, usa Node 22.\n' "$(node -v)"
ok "Docker, Supabase CLI y Node $(node -v)"

if [ "$PULL" = 1 ]; then
  paso "Actualizando la rama $(git branch --show-current)"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "   Hay cambios locales sin commitear; no se hace git pull (usa --sin-pull para omitir este aviso)."
  else
    git pull --ff-only -q && ok "Rama al día: $(git log --oneline -1)"
  fi
fi

paso "Supabase local"
supabase start >/dev/null 2>&1 || supabase start
ENV_OUT="$(supabase status -o env 2>/dev/null)"
val() { printf '%s\n' "$ENV_OUT" | sed -n "s/^$1=\"\(.*\)\"$/\1/p"; }
API_URL="$(val API_URL)"; ANON="$(val ANON_KEY)"
[[ "$API_URL" =~ ^http://(127\.0\.0\.1|localhost) ]] || die "La API no es local ($API_URL). Abortando."
ok "Supabase en $API_URL (Studio: http://127.0.0.1:54323)"

if [ "$RESET" = 1 ]; then
  paso "Reiniciando la BD local (sólo datos sintéticos)"
  supabase db reset --local --yes >/dev/null
  ok "BD reiniciada"
fi

# Tras un start/reset, Kong puede quedar apuntando a un Auth anterior (HTTP 502).
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/auth/v1/health" || true)"
  [ "$code" = 200 ] && break
  [ "$i" = 5 ] && docker restart supabase_kong_ondina-erp >/dev/null 2>&1 || true
  sleep 2
done
[ "$code" = 200 ] || die "Auth local no responde (HTTP $code). Prueba: docker restart supabase_kong_ondina-erp"
ok "Auth responde"

paso "Frontend"
HOST_URL="http://127.0.0.1:54321"
if [ "$HOST" = 1 ]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -n "$IP" ] || IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [ -n "$IP" ] || die "No se pudo detectar la IP de la red local para --host."
  HOST_URL="http://$IP:54321"
fi
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$HOST_URL" "$ANON" > "$FRONT/.env.local"
ok ".env.local apunta a $HOST_URL"

cd "$FRONT"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "   Instalando dependencias (npm ci)..."
  npm ci --silent && ok "Dependencias instaladas"
else
  ok "Dependencias al día"
fi

paso "Datos de prueba"
node "$REPO/scripts/demo/seed-demo.mjs" | sed 's/^/   /'

pkill -f "$FRONT/node_modules/.bin/vite" 2>/dev/null && echo "   (se detuvo una instancia previa de Vite)" || true

paso "Listo"
cat <<EOF
   App:      http://localhost:5173$( [ "$HOST" = 1 ] && printf '  (teléfono: http://%s:5173)' "$IP" )
   Cuentas:  ux-vendedor@ / ux-bodega@ / ux-produccion@ / ux-admin@ / ux-admin-global@  (example.invalid)
   Clave:    ${DEMO_PASSWORD:-ux-local-2026}
   Ctrl+C detiene la app (Supabase sigue corriendo; --detener lo apaga).
EOF
if [ "$HOST" = 1 ]; then exec npm run dev -- --host; else exec npm run dev; fi
