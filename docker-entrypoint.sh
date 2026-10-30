#!/bin/sh
set -eu

mkdir -p /app/public/uploads

if [ -n "${POSTGRES_APP_PASSWORD_FILE:-}" ]; then
  db_password="$(cat "$POSTGRES_APP_PASSWORD_FILE")"
  export DATABASE_URL="postgresql://${POSTGRES_APP_USER}:${db_password}@db:5432/${POSTGRES_DB}?schema=public"
  unset db_password
fi

if [ -z "$(find /app/public/uploads -mindepth 1 -maxdepth 1 -print -quit)" ]; then
  cp -a /app/uploads-seed/. /app/public/uploads/
fi

# Schema changes are a separate, backed-up and reviewed release operation.
exec node server.js
