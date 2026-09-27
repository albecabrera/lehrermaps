#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

API_BASE_URL=https://lehrermaps.albertocabrera.de/api

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for production deployment verification." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to verify the authenticated randomizer endpoint." >&2
  exit 1
fi

if [ -z "${LEHRERMAPS_DEPLOY_PASSWORD:-}" ]; then
  echo "LEHRERMAPS_DEPLOY_PASSWORD must be set for authenticated deployment verification." >&2
  exit 1
fi

test -f client/dist/index.html
test -d client/dist/assets
cp client/dist/index.html index.html
rsync -a client/dist/assets/ assets/

systemctl restart lehrermaps
systemctl is-active --quiet lehrermaps

curl --fail --silent --show-error --max-time 15 "$API_BASE_URL/health" >/dev/null

# Authentication is intentionally part of this smoke check: the API-wide auth
# middleware returns 401 for both existing and missing private routes.
login_response=$(node -e 'process.stdout.write(JSON.stringify({ password: process.env.LEHRERMAPS_DEPLOY_PASSWORD }))' | \
  curl --fail --silent --show-error --max-time 15 \
    --request POST \
    --header 'Content-Type: application/json' \
    --data-binary @- \
    "$API_BASE_URL/login")

randomizer_token=$(printf '%s' "$login_response" | node -e '
  const fs = require("node:fs");
  try {
    const { token } = JSON.parse(fs.readFileSync(0, "utf8"));
    if (typeof token !== "string" || !/^[A-Za-z0-9._-]+$/.test(token)) throw new Error("invalid token");
    process.stdout.write(token);
  } catch {
    console.error("Login verification did not return a valid token.");
    process.exit(1);
  }
')

# Pass the authorization header via an inherited file descriptor so neither the
# password nor the token is printed by this script or placed in curl arguments.
randomizer_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 15 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$randomizer_token") \
  "$API_BASE_URL/randomizer")
unset login_response randomizer_token

if [ "$randomizer_status" != "200" ]; then
  echo "Expected authenticated GET /api/randomizer to return 200; received $randomizer_status." >&2
  exit 1
fi

echo "LehrerMaps: static deploy, backend restart, and production API checks passed."
