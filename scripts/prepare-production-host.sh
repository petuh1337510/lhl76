#!/usr/bin/env bash
set -euo pipefail

host_ip="${1:?Usage: prepare-production-host.sh <public IPv4>}"
app_port="${2:-3000}"
app_path="${3:-/opt/lhl76}"
if [[ "${host_ip}" != 191.217.231.118 ]]; then
  echo "Unexpected production IP" >&2
  exit 1
fi
if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -o DPkg::Lock::Timeout=1200 install -y docker.io docker-compose-v2 nginx python3-venv ufw
apt-get clean
systemctl enable --now docker nginx

install -d -m 0755 "${app_path}" /var/www/certbot /etc/nginx/sites-available /etc/nginx/sites-enabled
install -d -m 0700 "${app_path}/secrets" "${app_path}/backups"
for directory in uploads legacy-media documents images-optimized; do
  install -d -m 0755 "${app_path}/public-files/${directory}"
done
chown -R 1000:1000 "${app_path}/public-files/uploads" "${app_path}/public-files/images-optimized"

cat > /etc/nginx/sites-available/lhl76.conf <<EOF
server {
    listen 80;
    server_name ${host_ip};
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 503; }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/lhl76.conf /etc/nginx/sites-enabled/lhl76.conf
nginx -t
systemctl reload nginx

if [[ ! -x "${app_path}/certbot-venv/bin/certbot" ]]; then
  python3 -m venv "${app_path}/certbot-venv"
  "${app_path}/certbot-venv/bin/pip" install --disable-pip-version-check 'certbot>=5.4,<7'
fi
"${app_path}/certbot-venv/bin/certbot" certonly \
  --preferred-profile shortlived \
  --webroot --webroot-path /var/www/certbot \
  --ip-address "${host_ip}" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring

cat > /etc/nginx/sites-available/lhl76.conf <<EOF
server {
    listen 80;
    server_name ${host_ip};
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name ${host_ip};
    ssl_certificate /etc/letsencrypt/live/${host_ip}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${host_ip}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    gzip_vary on;
    gzip_proxied any;
    gzip_min_length 1024;
    gzip_comp_level 4;
    gzip_types application/json application/javascript text/css text/plain image/svg+xml;
    client_max_body_size 160m;
    add_header X-Content-Type-Options nosniff always;
    location / {
        proxy_pass http://127.0.0.1:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
EOF
nginx -t
systemctl reload nginx

cat > /etc/systemd/system/lhl76-certbot-renew.service <<EOF
[Unit]
Description=Renew short-lived LHL-76 IP certificate
[Service]
Type=oneshot
ExecStart=${app_path}/certbot-venv/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
cat > /etc/systemd/system/lhl76-certbot-renew.timer <<'EOF'
[Unit]
Description=Check LHL-76 IP certificate twice daily
[Timer]
OnCalendar=*-*-* 03,15:00:00
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now lhl76-certbot-renew.timer

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Host prepared for https://${host_ip}"
