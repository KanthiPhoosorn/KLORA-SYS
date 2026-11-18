#!/bin/bash
# First-boot setup of the Corta SSO relay on Amazon Linux 2023 (filled in and sent by provision.py).
# Installs the official Caddy release after checking its SHA-512 against the release's checksum file.
set -euo pipefail
exec > /var/log/corta-relay-setup.log 2>&1

CADDY_VERSION="__CADDY_VERSION__"
case "$(uname -m)" in aarch64) ARCH=arm64 ;; x86_64) ARCH=amd64 ;; *) echo "unknown arch"; exit 1 ;; esac

cd /tmp
BASE="https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}"
TGZ="caddy_${CADDY_VERSION}_linux_${ARCH}.tar.gz"
curl -fsSLo "$TGZ" "$BASE/$TGZ"
curl -fsSLo sums.txt "$BASE/caddy_${CADDY_VERSION}_checksums.txt"
grep " ${TGZ}\$" sums.txt | sha512sum -c -
tar -xzf "$TGZ" caddy
install -m 0755 caddy /usr/local/bin/caddy

id caddy >/dev/null 2>&1 || useradd --system --home-dir /var/lib/caddy --create-home --shell /sbin/nologin caddy
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<'CADDYFILE_EOF'
__CADDYFILE__
CADDYFILE_EOF
cat > /etc/caddy/env <<'ENV_EOF'
RELAY_HOST=__RELAY_HOST__
RELAY_KEY=__RELAY_KEY__
ENV_EOF
chown root:caddy /etc/caddy/env
chmod 0640 /etc/caddy/env

set -a; . /etc/caddy/env; set +a
/usr/local/bin/caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

cat > /etc/systemd/system/caddy.service <<'UNIT_EOF'
[Unit]
Description=Corta SSO relay (Caddy)
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
Environment=HOME=/var/lib/caddy
EnvironmentFile=/etc/caddy/env
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=on-failure
AmbientCapabilities=CAP_NET_BIND_SERVICE
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
UNIT_EOF

systemctl daemon-reload
systemctl enable --now caddy
dnf -y upgrade --security || true
echo "corta relay ready"
