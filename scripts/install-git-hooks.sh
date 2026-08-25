#!/bin/sh
set -eu

ROOT_DIR=$(git rev-parse --show-toplevel)
git -C "$ROOT_DIR" config core.hooksPath .githooks
chmod +x "$ROOT_DIR/.githooks/pre-commit"
echo "Git-Hooks aktiviert: .githooks"
