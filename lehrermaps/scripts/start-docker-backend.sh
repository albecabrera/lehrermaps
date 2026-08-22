#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XAMPP_ROOT="${LEHRERMAPS_XAMPP_ROOT:-/Users/acabrera/repos/xampp-docker}"
COMPOSE_FILE="$XAMPP_ROOT/docker-compose.yml"

if ! docker network inspect xampp_xampp-net >/dev/null 2>&1; then
  echo "Falta la red Docker compartida xampp_xampp-net."
  echo "Primero levantá tu stack XAMPP Docker."
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d lehrermaps-backend
echo "Backend canónico de LehrerMaps listo en http://localhost:3001"
