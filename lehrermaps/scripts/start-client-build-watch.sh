#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
PID_FILE="$LOG_DIR/client-build-watch.pid"
LOG_FILE="$LOG_DIR/client-build-watch.log"

mkdir -p "$LOG_DIR"

if [ -f "$PID_FILE" ]; then
  WATCH_PID="$(awk '{print $1}' "$PID_FILE")"
  if kill -0 "$WATCH_PID" 2>/dev/null; then
    echo "✓ Frontend watcher ya está corriendo (PID: $WATCH_PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

echo "→ Iniciando watcher del frontend: cada cambio actualizará client/dist..."
if command -v setsid >/dev/null 2>&1; then
  nohup setsid npm run build --prefix "$ROOT_DIR/client" -- --watch > "$LOG_FILE" 2>&1 < /dev/null &
else
  # macOS no incluye setsid; nohup mantiene el watcher al cerrar el launcher.
  nohup npm run build --prefix "$ROOT_DIR/client" -- --watch > "$LOG_FILE" 2>&1 < /dev/null &
fi
echo $! > "$PID_FILE"

for _ in $(seq 1 30); do
  if [ -f "$ROOT_DIR/client/dist/index.html" ]; then
    echo "✓ client/dist actualizado automáticamente"
    exit 0
  fi
  sleep 1
done

echo "✗ El watcher no generó client/dist. Revisá $LOG_FILE"
exit 1
