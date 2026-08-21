#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.backend.yml"

if ! docker network inspect xampp_xampp-net >/dev/null 2>&1; then
  echo "Falta la red Docker compartida xampp_xampp-net."
  echo "Primero levantá tu stack XAMPP Docker."
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d --build
echo "Backend de LehrerMaps listo en http://localhost:3001"
