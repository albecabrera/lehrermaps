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

# The production backend is a user-owned Node process (not a systemd unit).
# Only terminate the PID recorded by this project after verifying that it is
# actually the expected server process, then start the current sources anew.
PID_FILE="$ROOT_DIR/.logs/server.pid"
mkdir -p "$ROOT_DIR/.logs"

is_expected_backend_pid() {
  local pid=$1
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null || return 1

  local process_cwd process_command
  process_cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
  process_command=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
  [ "$process_cwd" = "$ROOT_DIR/server" ] && [ "$process_command" = "node index.js " ]
}

stop_expected_backend_pid() {
  local pid=$1
  if ! is_expected_backend_pid "$pid"; then
    echo "Refusing to stop unexpected PID $pid." >&2
    exit 1
  fi

  kill -TERM "$pid"
  for _ in $(seq 1 30); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 1
  done
  echo "Backend PID $pid did not stop gracefully." >&2
  exit 1
}

if [ -f "$PID_FILE" ]; then
  recorded_pid=$(cat "$PID_FILE")
  if [[ "$recorded_pid" =~ ^[0-9]+$ ]] && kill -0 "$recorded_pid" 2>/dev/null; then
    stop_expected_backend_pid "$recorded_pid"
  fi
fi

# A stale PID file must never make a deploy appear successful while an older
# LehrerMaps server still owns the port. Discover that listener, but only stop
# it after the same cwd and command validation as the recorded PID.
listener_pid=$(ss -ltnp "sport = :3001" 2>/dev/null | sed -nE 's/.*pid=([0-9]+).*/\1/p' | head -n 1)
if [ -n "$listener_pid" ]; then
  stop_expected_backend_pid "$listener_pid"
fi

(
  cd "$ROOT_DIR/server"
  setsid nohup node index.js > "$ROOT_DIR/.logs/server.log" 2>&1 < /dev/null &
  echo $! > "$PID_FILE"
)

for _ in $(seq 1 30); do
  new_pid=$(cat "$PID_FILE")
  if kill -0 "$new_pid" 2>/dev/null && curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then
    break
  fi
  sleep 1
done
new_pid=$(cat "$PID_FILE")
if ! kill -0 "$new_pid" 2>/dev/null || ! curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3001/api/health >/dev/null; then
  echo "Backend failed to start; see $ROOT_DIR/.logs/server.log." >&2
  exit 1
fi

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
