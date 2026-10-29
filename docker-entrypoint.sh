#!/bin/sh
set -eu

mkdir -p /app/public/uploads

if [ -z "$(find /app/public/uploads -mindepth 1 -maxdepth 1 -print -quit)" ]; then
  cp -a /app/uploads-seed/. /app/public/uploads/
fi

# Schema changes are a separate, backed-up and reviewed release operation.
exec node server.js
