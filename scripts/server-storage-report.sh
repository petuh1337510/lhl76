#!/usr/bin/env bash
# Read-only storage diagnostics: sizes and counts only, never file contents or secrets.
set -euo pipefail
export LC_ALL=C
printf '\n=== FILESYSTEM_BYTES ===\n'
df -B1 --output=source,size,used,avail,pcent,target /
printf '\n=== INODES ===\n'
df -i /
printf '\n=== ROOT_DIRECTORIES_BYTES ===\n'
du -x -B1 --max-depth=1 / 2>/dev/null | sort -n || true
printf '\n=== VAR_DIRECTORIES_BYTES ===\n'
for directory in /var /var/lib /var/log /var/cache; do
  du -x -B1 --max-depth=1 "$directory" 2>/dev/null | sort -n || true
done
printf '\n=== APPLICATION_DIRECTORIES_BYTES ===\n'
for directory in /opt/lhl76 /opt/lhl76/public-files; do
  du -x -B1 --max-depth=1 "$directory" 2>/dev/null | sort -n || true
done
printf '\n=== ROOT_FILES_BYTES ===\n'
find / -maxdepth 1 -type f -printf '%s %f\n' 2>/dev/null | sort -n
printf '\n=== DOCKER_STORAGE ===\n'
docker system df -v
printf '\n=== CONTAINER_LOG_BYTES ===\n'
find /var/lib/docker/containers -type f -name '*-json.log*' -printf '%s\n' 2>/dev/null | awk '{n++;total+=$1} END {printf "files=%d bytes=%.0f\n",n,total}'
printf '\n=== JOURNAL ===\n'
journalctl --disk-usage
printf '\n=== BACKUPS ===\n'
find /opt/lhl76/backups -maxdepth 1 -type f -printf '%s\n' | awk '{n++;total+=$1} END {printf "files=%d bytes=%.0f\n",n,total}'
printf '\n=== DATABASE_BYTES ===\n'
docker compose --env-file /opt/lhl76/.env -f /opt/lhl76/docker-compose.production.yml exec -T db \
  sh -ec 'PGOPTIONS="-c default_transaction_read_only=on" exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_database_size(current_database());"'
