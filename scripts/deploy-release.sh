#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-/opt/lhl76}"
release="${app_path}/release"
compose="${app_path}/docker-compose.production.yml"
environment="${app_path}/.env"
backup_dir="${app_path}/backups"

for file in "${release}/docker-compose.production.yml" "${release}/runtime.env" \
  "${release}/secrets/postgres_owner_password" "${release}/secrets/postgres_app_password"; do
  test -s "${file}" || { echo "Missing release file: ${file}" >&2; exit 1; }
done

mkdir -p "${backup_dir}" "${app_path}/secrets"
chmod 700 "${app_path}/secrets"
rollback="$(mktemp -d "${app_path}/.rollback.XXXXXX")"
previous=0
if test -s "${environment}" && test -s "${compose}"; then
  previous=1
  cp -p "${environment}" "${rollback}/runtime.env"
  cp -p "${compose}" "${rollback}/docker-compose.production.yml"
  cp -p "${app_path}/secrets/postgres_owner_password" "${rollback}/postgres_owner_password"
  cp -p "${app_path}/secrets/postgres_app_password" "${rollback}/postgres_app_password"
fi

restore_previous() {
  code="$?"
  trap - ERR
  if test "${previous}" -eq 1; then
    install -m 600 "${rollback}/runtime.env" "${environment}"
    install -m 644 "${rollback}/docker-compose.production.yml" "${compose}"
    install -m 600 "${rollback}/postgres_owner_password" "${app_path}/secrets/postgres_owner_password"
    install -m 600 "${rollback}/postgres_app_password" "${app_path}/secrets/postgres_app_password"
    chown 1000:1000 "${app_path}/secrets/postgres_app_password"
    chmod 400 "${app_path}/secrets/postgres_app_password"
    docker compose --env-file "${environment}" -f "${compose}" up -d --wait --wait-timeout 180 || true
  fi
  echo "Release failed; previous configuration restored" >&2
  rm -rf -- "${rollback}" "${release}"
  exit "${code}"
}
trap restore_previous ERR

if test "${previous}" -eq 1; then
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  docker compose --env-file "${environment}" -f "${compose}" exec -T db \
    sh -ec 'pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    > "${backup_dir}/postgres-${stamp}.dump"
  test -s "${backup_dir}/postgres-${stamp}.dump"
  chmod 600 "${backup_dir}/postgres-${stamp}.dump"
fi

install -m 600 "${release}/runtime.env" "${environment}"
install -m 644 "${release}/docker-compose.production.yml" "${compose}"
install -m 600 "${release}/secrets/postgres_owner_password" "${app_path}/secrets/postgres_owner_password"
install -m 600 "${release}/secrets/postgres_app_password" "${app_path}/secrets/postgres_app_password"
chown 1000:1000 "${app_path}/secrets/postgres_app_password"
chmod 400 "${app_path}/secrets/postgres_app_password"

docker compose --env-file "${environment}" -f "${compose}" config --quiet
docker compose --env-file "${environment}" -f "${compose}" pull app
docker compose --env-file "${environment}" -f "${compose}" up -d --wait --wait-timeout 180

trap - ERR
rm -rf -- "${rollback}" "${release}"
echo "Release healthy"
