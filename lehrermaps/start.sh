#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
LOG_DIR="$ROOT_DIR/.logs"
PORT=3001
APP_URL="http://localhost:$PORT"
PID_FILE="$LOG_DIR/server.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC}  $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC}  $1"; }

echo ""
echo -e "${BOLD}  LehrerMaps${NC}"
echo "  ──────────"
echo ""

alive() { curl -sf -o /dev/null "$APP_URL/api/health"; }

# Ya corre → solo abrir browser
if alive 2>/dev/null; then
  ok "Server ya corre en $APP_URL"
  open "$APP_URL" 2>/dev/null || true
  echo ""
  exit 0
fi

# Node.js
command -v node &>/dev/null || fail "Node.js no instalado — instalalo desde https://nodejs.org (v18+)"
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js $NODE_MAJOR detectado, se requiere v18+"
ok "Node.js $(node --version)"

# .env
ENV_FILE="$SERVER_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$SERVER_DIR/env.txt" ]; then
    cp "$SERVER_DIR/env.txt" "$ENV_FILE"
    ok ".env creado desde env.txt"
    warn "Editá server/.env con tus contraseñas antes de usar en producción."
  else
    fail "No se encontró server/.env ni server/env.txt"
  fi
else
  ok ".env presente"
fi

# Dependencias
if [ ! -d "$SERVER_DIR/node_modules" ]; then
  info "Instalando dependencias del servidor..."
  npm install --prefix "$SERVER_DIR" --silent
  ok "Dependencias instaladas"
else
  ok "Dependencias presentes"
fi

mkdir -p "$LOG_DIR"

# Matar proceso anterior en el puerto
OLD_PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
  echo "$OLD_PID" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

# Iniciar backend (sirve client/dist como SPA estática)
info "Iniciando server (puerto $PORT)..."
cd "$SERVER_DIR"
nohup node index.js > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$PID_FILE"
cd "$ROOT_DIR"

# Esperar health check
for _ in $(seq 1 40); do
  alive 2>/dev/null && break
  sleep 0.5
done

if alive 2>/dev/null; then
  ok "Server corriendo en $APP_URL (PID: $(cat "$PID_FILE"))"
  echo ""
  echo -e "  Para detener: ${YELLOW}kill \$(cat $LOG_DIR/server.pid)${NC}"
  echo ""
  open "$APP_URL" 2>/dev/null || echo -e "  Abrí: ${CYAN}$APP_URL${NC}"
  echo ""
else
  warn "Server no respondió — revisá $LOG_DIR/server.log"
  exit 1
fi
