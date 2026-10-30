# Production deployment

The deployment target is `191.217.231.118`. The public origin is
`https://191.217.231.118` until a domain is selected. The hostname
`vm346018.it-garage.network` is a provider hostname and is not used as the
website address. The previous `lhl-76.ru` DNS record is not changed.

The release follows the same pattern as the zxccaraul deployment: GitHub
Actions builds and publishes an immutable image to GHCR, copies a runtime
bundle over SSH, backs up PostgreSQL before replacing a running release, waits
for readiness, and restores the previous image configuration on failure.
`Prepare production host` provisions Docker, Nginx, firewall rules and a
short-lived Let's Encrypt certificate for the IP address. Certbot checks for
renewal twice daily. `Build and deploy LHL-76` is started manually from
Actions. `CI` runs on commits and pull requests.

## GitHub Actions configuration

Create a `production` Environment. The workflows use these repository or
Environment variables:

| Variable | Value |
| --- | --- |
| `SERVER_HOST` | `191.217.231.118` |
| `SERVER_PORT` | `22` |
| `SERVER_USERNAME` | `root` |
| `SERVER_APP_PATH` | `/opt/lhl76` |
| `PUBLIC_SITE_URL` | `https://191.217.231.118` |
| `MEDIA_ROOT` | `/opt/lhl76/public-files` |
| `APP_PORT` | `3000` |
| `COMPOSE_PROJECT_NAME` | `lhl76` |

Required secrets are `SERVER_PRIVATE_KEY`, `POSTGRES_OWNER_PASSWORD`,
`POSTGRES_APP_PASSWORD`, and `AUTH_SECRET`. Their values are generated and
kept locally outside Git. The server has the corresponding public SSH key.
The workflow uses its short-lived `GITHUB_TOKEN` for GHCR; no long-lived
package token is needed. The server host key is pinned in
`docs/production-known-hosts`.

## Data and first deployment

The existing PostgreSQL data is restored into a new `lhl76_postgres_data`
volume. The app connects as `lhl_app`, which has DML rights but no schema
creation rights. The owner password is only used by the database container
and maintenance operations. Source media lives in
`/opt/lhl76/public-files/{uploads,legacy-media,documents,images-optimized}`.
Those paths are outside the image and survive image replacement. `uploads`
and `images-optimized` are writable by container UID 1000; the original
legacy files and documents are read-only in the app container.

Do not seed, reset, or restore over a populated production database. Before
each update the release script writes `backups/postgres-<UTC>.dump` using
`pg_dump -Fc`. A failed application release restores the previous image
configuration; it never rewinds the database or removes the persistent
volumes. Schema changes require a separate migration plan and backup test.

Useful checks on the server:

```sh
cd /opt/lhl76
docker compose --env-file .env -f docker-compose.production.yml ps
docker compose --env-file .env -f docker-compose.production.yml logs --tail=100 app db
curl --fail https://191.217.231.118/api/ready
systemctl status lhl76-certbot-renew.timer
df -h /
```

This 10 GB server has limited free disk space after restoring media. Monitor
disk use and arrange independent backups before relying on it as the sole
production copy. The local encrypted handoff and original data remain
separate from the source repository.
