#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "${1//[[:space:]]/}" ]; then
  echo "Usage: npm run commit:deploy -- \"type(scope): description\"" >&2
  exit 2
fi

COMMIT_MESSAGE=$1
ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

if ! [[ "$COMMIT_MESSAGE" =~ ^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9._-]+\))?!?:\ .+ ]]; then
  echo "Commit message must use a Conventional Commit type." >&2
  exit 2
fi

git config core.hooksPath .githooks
git diff --check
npm run build
bash scripts/deploy-static.sh

git add client/src client/dist server index.html assets scripts/commit-deploy.sh scripts/deploy-static.sh .githooks/post-commit package.json
git diff --cached --check
git commit -m "$COMMIT_MESSAGE"
