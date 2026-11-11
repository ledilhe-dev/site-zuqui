#!/usr/bin/env bash
set -euo pipefail
umask 077

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq poppler-utils >/dev/null

install -d -m 0700 /opt/checkdiario/codex-reader/codex-home
install -m 0755 /tmp/checkdiario-codex-reader/reader_bridge.py /opt/checkdiario/codex-reader/reader_bridge.py
install -m 0644 /tmp/checkdiario-codex-reader/schema.json /opt/checkdiario/codex-reader/schema.json
install -m 0600 /root/.codex/auth.json /opt/checkdiario/codex-reader/codex-home/auth.json
install -m 0644 /tmp/checkdiario-codex-reader/codex-reader.service /etc/systemd/system/codex-reader.service

reader_secret="$(openssl rand -hex 32)"
printf 'CODEX_READER_HOST=172.16.1.1\nCODEX_READER_PORT=8788\nCODEX_READER_MODEL=gpt-5.6-sol\nCODEX_READER_SECRET=%s\n' "$reader_secret" > /opt/checkdiario/codex-reader/reader.env
chmod 0600 /opt/checkdiario/codex-reader/reader.env

functions_env=/opt/checkdiario/supabase/.env.functions
functions_tmp="${functions_env}.codex.tmp"
grep -v '^CODEX_READER_' "$functions_env" > "$functions_tmp"
printf 'CODEX_READER_URL=http://172.16.1.1:8788/\nCODEX_READER_SECRET=%s\nCODEX_READER_TIMEOUT_MS=165000\n' "$reader_secret" >> "$functions_tmp"
chmod 0600 "$functions_tmp"
mv "$functions_tmp" "$functions_env"
unset reader_secret

systemctl daemon-reload
systemctl enable --now codex-reader.service >/dev/null
cd /opt/checkdiario/supabase
docker compose -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.private-db.yml -f docker-compose.edge-secrets.yml up -d --no-deps --force-recreate functions >/dev/null
rm -rf /tmp/checkdiario-codex-reader
systemctl is-active codex-reader.service
