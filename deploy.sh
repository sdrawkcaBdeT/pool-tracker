#!/usr/bin/env bash
set -euo pipefail

NAS_SHARE="/z/pool-tracker"
NAS_HOST="CashBaggins@192.168.100.241"
NAS_PROJECT="/volume1/python_projects/pool-tracker"
NAS_COMPOSE_FILE="docker-compose.yaml"

cd "$NAS_SHARE"
git fetch origin
git reset --hard origin/main

if [[ ! -f .env ]]; then
  echo "Missing $NAS_SHARE/.env; refusing to deploy without production secrets." >&2
  exit 1
fi

APP_GIT_SHA="$(git rev-parse HEAD)"

upsert_env() {
  local key="$1"
  local value="$2"
  local file=".env"

  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$file"
  fi
}

upsert_env "APP_GIT_SHA" "$APP_GIT_SHA"

# UGREEN's Docker app points at docker-compose.yaml, while the repo tracks
# docker-compose.yml. Keep the NAS-facing copy in sync on every deploy.
cp docker-compose.yml "$NAS_COMPOSE_FILE"

ssh -t "$NAS_HOST" "cd $NAS_PROJECT && sudo docker compose --env-file .env -f $NAS_COMPOSE_FILE up -d --build"
