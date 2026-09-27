#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

test -f client/dist/index.html
test -d client/dist/assets
cp client/dist/index.html index.html
rsync -a client/dist/assets/ assets/

if command -v curl >/dev/null 2>&1; then
  curl --fail --silent --show-error --max-time 15 https://lehrermaps.albertocabrera.de/api/health >/dev/null
  echo "LehrerMaps: static deploy and production health check passed."
else
  echo "LehrerMaps: static deploy passed; curl is unavailable, health check skipped."
fi
