#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_COMPOSE_FILE="$ROOT_DIR/docker-compose.backend.yml"
APP_URL="http://localhost:8080"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Falta: $1"
    exit 1
  }
}

require_cmd docker
require_cmd sudo
require_cmd open

if ! docker network inspect xampp_xampp-net >/dev/null 2>&1; then
  echo "La red Docker xampp_xampp-net no existe."
  echo "Primero levantá tu stack XAMPP Docker."
  exit 1
fi

echo "→ Levantando backend de LehrerMaps en Docker..."
docker compose -f "$BACKEND_COMPOSE_FILE" up -d --build

echo "→ Aplicando proxy de Apache en XAMPP..."
sudo "$ROOT_DIR/scripts/install-xampp-proxy.sh"

echo "→ Reiniciando Apache de XAMPP..."
sudo /Applications/XAMPP/xamppfiles/xampp restartapache

echo "→ Esperando al backend..."
for _ in $(seq 1 40); do
  BACKEND_CONTAINER="$(docker compose -f "$BACKEND_COMPOSE_FILE" ps -q lehrermaps-backend 2>/dev/null || true)"
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$BACKEND_CONTAINER" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 1
done

BACKEND_CONTAINER="$(docker compose -f "$BACKEND_COMPOSE_FILE" ps -q lehrermaps-backend 2>/dev/null || true)"
status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$BACKEND_CONTAINER" 2>/dev/null || true)"
if [ "$status" != "healthy" ]; then
  echo "El backend no respondió. Revisá docker compose logs."
  exit 1
fi

echo "✓ Backend listo dentro de Docker"
echo "→ Abriendo XAMPP local..."
open "$APP_URL"
