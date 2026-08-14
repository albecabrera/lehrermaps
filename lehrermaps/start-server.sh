#!/usr/bin/env bash
set -euo pipefail

# LehrerMaps — arranca solo el backend (sirve también el build del cliente)
# Uso: ./start-server.sh  → app en http://localhost:3001

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
LOG_DIR="$ROOT_DIR/.logs"
PORT=3001
APP_URL="http://localhost:$PORT"

mkdir -p "$LOG_DIR"

alive() { curl -sf -o /dev/null "$APP_URL/"; }

# Ya corre → solo abrir browser
if alive; then
  echo "✓ Server ya corre en $APP_URL"
else
  echo "→ Iniciando server..."
  cd "$SERVER_DIR"
  nohup node index.js > "$LOG_DIR/server.log" 2>&1 &
  echo $! > "$LOG_DIR/server.pid"
  cd "$ROOT_DIR"

  for _ in $(seq 1 60); do
    alive && break
    sleep 0.5
  done

  if alive; then
    echo "✓ Server corriendo en $APP_URL (PID: $(cat "$LOG_DIR/server.pid"))"
  else
    echo "✗ El server no respondió — revisá $LOG_DIR/server.log"
    exit 1
  fi
fi

open -a "Arc" "$APP_URL" 2>/dev/null || open "$APP_URL"
