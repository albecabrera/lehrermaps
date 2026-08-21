#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
LOG_DIR="$ROOT_DIR/.logs"
PORT=3001
APP_URL="http://localhost:8090"
PROXY_PORT="8090"
BACKEND_URL="http://127.0.0.1:$PORT"

mkdir -p "$LOG_DIR"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Falta: $1"; exit 1; }
}

need node
need curl
need sudo
need open

if [ ! -f "$SERVER_DIR/.env" ]; then
  if [ -f "$SERVER_DIR/env.txt" ]; then
    cp "$SERVER_DIR/env.txt" "$SERVER_DIR/.env"
    echo "✓ server/.env creado desde env.txt"
  else
    echo "Falta server/.env y server/env.txt"
    exit 1
  fi
fi

# 1) Instalar/actualizar el proxy de Apache en XAMPP.
echo "→ Configurando Apache de XAMPP para apuntar al backend..."
sudo LEHRERMAPS_BACKEND_URL="$BACKEND_URL" LEHRERMAPS_PROXY_PORT="$PROXY_PORT" "$ROOT_DIR/scripts/install-xampp-proxy.sh"

# 2) Reiniciar Apache.
echo "→ Reiniciando Apache de XAMPP..."
sudo /Applications/XAMPP/xamppfiles/xampp restartapache

# 3) Levantar backend si no está corriendo.
if curl -sf "$BACKEND_URL/api/health" >/dev/null 2>&1; then
  echo "✓ Backend ya está corriendo en $BACKEND_URL"
else
  echo "→ Iniciando backend en $BACKEND_URL..."
  if [ ! -d "$SERVER_DIR/node_modules" ]; then
    npm install --prefix "$SERVER_DIR" --silent
  fi
  (cd "$SERVER_DIR" && nohup node index.js > "$LOG_DIR/server.log" 2>&1 & echo $! > "$LOG_DIR/server.pid")

  for _ in $(seq 1 40); do
    curl -sf "$BACKEND_URL/api/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

if curl -sf "$BACKEND_URL/api/health" >/dev/null 2>&1; then
  echo "✓ Backend listo"
else
  echo "✗ El backend no respondió. Revisá $LOG_DIR/server.log"
  exit 1
fi

# 4) Abrir la app a través de XAMPP.
echo "→ Abriendo $APP_URL ..."
open "$APP_URL"
