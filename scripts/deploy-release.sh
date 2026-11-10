#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-/opt/lhl76}"
release="${app_path}/release"
compose="${app_path}/docker-compose.production.yml"
environment="${app_path}/.env"
backup_dir="${app_path}/backups"

for file in "${release}/docker-compose.production.yml" "${release}/runtime.env" \
  "${release}/secrets/postgres_owner_password" "${release}/secrets/postgres_app_password" \
  "${release}/check-vk-photos.mjs"; do
  test -s "${file}" || { echo "Missing release file: ${file}" >&2; exit 1; }
done

mkdir -p "${backup_dir}"
rollback="$(mktemp -d "${app_path}/.rollback.XXXXXX")"
previous=0
if test -s "${environment}" && test -s "${compose}"; then
  previous=1
  cp -p "${environment}" "${rollback}/runtime.env"
  cp -p "${compose}" "${rollback}/docker-compose.production.yml"
fi
if test "${previous}" -ne 1; then
  echo "Existing production release is required; refusing to initialize a database" >&2
  exit 1
fi

# Allow only the application image and the VK photo integration secret to change.
# Database, media mounts and every other runtime setting must remain identical.
cmp -s <(sed '/^      VK_API_ACCESS_TOKEN: /d' "${compose}") \
  <(sed '/^      VK_API_ACCESS_TOKEN: /d' "${release}/docker-compose.production.yml") || {
  echo "Compose configuration changed; refusing automatic deployment" >&2
  exit 1
}
cmp -s <(sed '/^LHL76_IMAGE=/d; /^VK_API_ACCESS_TOKEN=/d' "${environment}") \
  <(sed '/^LHL76_IMAGE=/d; /^VK_API_ACCESS_TOKEN=/d' "${release}/runtime.env") || {
  echo "Runtime configuration changed beyond the image and VK token; refusing automatic deployment" >&2
  exit 1
}
for secret in postgres_owner_password postgres_app_password; do
  cmp -s "${app_path}/secrets/${secret}" "${release}/secrets/${secret}" || {
    echo "Database credentials changed; refusing automatic deployment" >&2
    exit 1
  }
done
grep -Fxq 'MEDIA_ROOT=/opt/lhl76/public-files' "${environment}" || {
  echo "Unexpected media root" >&2
  exit 1
}

running_db="$(docker compose --env-file "${environment}" -f "${compose}" ps -q db)"
running_app="$(docker compose --env-file "${environment}" -f "${compose}" ps -q app)"
test -n "${running_db}" && test -n "${running_app}" || {
  echo "Production containers are not running" >&2
  exit 1
}
db_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}{{end}}{{end}}' "${running_db}")"
db_started_at="$(docker inspect --format '{{.State.StartedAt}}' "${running_db}")"
test "${db_mount}" = 'volume|lhl76_postgres_data' || {
  echo "Unexpected PostgreSQL volume" >&2
  exit 1
}
app_mounts="$(docker inspect --format '{{range .Mounts}}{{printf "%s|%s|%s|%t\n" .Destination .Type .Source .RW}}{{end}}' "${running_app}")"
for mount in \
  '/app/public/uploads|bind|/opt/lhl76/public-files/uploads|true' \
  '/app/public/legacy-media|bind|/opt/lhl76/public-files/legacy-media|false' \
  '/app/public/documents|bind|/opt/lhl76/public-files/documents|false' \
  '/app/public/images/optimized|bind|/opt/lhl76/public-files/images-optimized|true'; do
  grep -Fxq "${mount}" <<< "${app_mounts}" || {
    echo "Missing expected persistent media mount: ${mount}" >&2
    exit 1
  }
done

media_root="${app_path}/public-files"
media_manifest() {
  (cd "${media_root}" && find uploads legacy-media documents images-optimized \
    -type f -printf '%p\t%s\t%T@\n' | LC_ALL=C sort)
}
media_manifest > "${rollback}/media-before.txt"

db_counts() {
  printf '%s\n' 'SELECT (SELECT count(*) FROM "User"), (SELECT count(*) FROM "Player"), (SELECT count(*) FROM "Match"), (SELECT count(*) FROM "Goal"), (SELECT count(*) FROM "Penalty"), (SELECT count(*) FROM "PlayerStatistic"), (SELECT count(*) FROM "TeamStatistic");' |
    docker compose --env-file "${environment}" -f "${compose}" exec -T db \
      sh -ec 'PGOPTIONS="-c default_transaction_read_only=on" exec psql -XAt -F, -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
}
counts_before="$(db_counts)"
IFS=, read -r -a before_values <<< "${counts_before}"
test "${#before_values[@]}" -eq 7 && test "${before_values[0]}" -gt 0 || {
  echo "Production database did not return expected populated tables" >&2
  exit 1
}

switched=0

restore_previous() {
  code="$?"
  trap - ERR
  if test "${switched}" -eq 1; then
    install -m 600 "${rollback}/runtime.env" "${environment}"
    install -m 600 "${rollback}/docker-compose.production.yml" "${compose}"
    docker compose --env-file "${environment}" -f "${compose}" up -d --no-deps --wait --wait-timeout 180 app || true
  fi
  echo "Release failed; previous configuration retained or restored; database and media were not rolled back" >&2
  rm -rf -- "${rollback}" "${release}"
  exit "${code}"
}
trap restore_previous ERR

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose --env-file "${environment}" -f "${compose}" exec -T db \
  sh -ec 'PGOPTIONS="-c default_transaction_read_only=on" exec pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "${backup_dir}/postgres-${stamp}.dump"
test -s "${backup_dir}/postgres-${stamp}.dump"
chmod 600 "${backup_dir}/postgres-${stamp}.dump"
docker compose --env-file "${environment}" -f "${compose}" exec -T db \
  pg_restore -l < "${backup_dir}/postgres-${stamp}.dump" > /dev/null

switched=1
install -m 600 "${release}/runtime.env" "${environment}"
install -m 600 "${release}/docker-compose.production.yml" "${compose}"

docker compose --env-file "${environment}" -f "${compose}" config --quiet
docker compose --env-file "${environment}" -f "${compose}" pull app
docker compose --env-file "${environment}" -f "${compose}" up -d --no-deps --wait --wait-timeout 180 app

test "$(docker compose --env-file "${environment}" -f "${compose}" ps -q db)" = "${running_db}" &&
  test "$(docker inspect --format '{{.State.StartedAt}}' "${running_db}")" = "${db_started_at}" || {
  echo "PostgreSQL container changed or restarted during deployment" >&2
  false
}

counts_after="$(db_counts)"
IFS=, read -r -a after_values <<< "${counts_after}"
test "${#after_values[@]}" -eq 7 || { echo "Database count check failed" >&2; false; }
for index in "${!before_values[@]}"; do
  test "${after_values[index]}" -ge "${before_values[index]}" || {
    echo "Critical database row count decreased after deployment" >&2
    false
  }
done
media_manifest > "${rollback}/media-after.txt"
test -z "$(comm -23 "${rollback}/media-before.txt" "${rollback}/media-after.txt")" || {
  echo "Previously present media files are missing or changed after deployment" >&2
  false
}

# Verify the key from inside the runtime container before accepting the release.
docker compose --env-file "${environment}" -f "${compose}" exec -T app \
  node --input-type=module < "${release}/check-vk-photos.mjs"

trap - ERR
rm -rf -- "${rollback}" "${release}"
echo "Release healthy"
