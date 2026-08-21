#!/usr/bin/env bash
set -euo pipefail

XAMPP_ETC="/Applications/XAMPP/xamppfiles/etc"
HTTPD_CONF="$XAMPP_ETC/httpd.conf"
VHOSTS_CONF="$XAMPP_ETC/extra/httpd-vhosts.conf"
BACKUP_TS=$(date +%Y%m%d-%H%M%S)
VHOST_NAME="localhost"
BACKEND_URL="${LEHRERMAPS_BACKEND_URL:-http://lehrermaps-backend:3001}"
LISTEN_PORT="${LEHRERMAPS_PROXY_PORT:-8090}"
MARKER_BEGIN="# --- LehrerMaps reverse proxy BEGIN ---"
MARKER_END="# --- LehrerMaps reverse proxy END ---"

for file in "$HTTPD_CONF" "$VHOSTS_CONF"; do
  if [ ! -f "$file" ]; then
    echo "Falta $file"
    exit 1
  fi
done

cp "$HTTPD_CONF" "$HTTPD_CONF.bak.$BACKUP_TS"
cp "$VHOSTS_CONF" "$VHOSTS_CONF.bak.$BACKUP_TS"

python3 - "$HTTPD_CONF" "$VHOSTS_CONF" "$VHOST_NAME" "$BACKEND_URL" "$MARKER_BEGIN" "$MARKER_END" "$LISTEN_PORT" <<'PY2'
from pathlib import Path
import re
import sys

httpd = Path(sys.argv[1])
vhosts = Path(sys.argv[2])
hostname = sys.argv[3]
backend = sys.argv[4]
marker_begin = sys.argv[5]
marker_end = sys.argv[6]

httpd_text = httpd.read_text()
httpd_text = re.sub(r'^#Include etc/extra/httpd-vhosts\.conf$', 'Include etc/extra/httpd-vhosts.conf', httpd_text, flags=re.M)
httpd.write_text(httpd_text)

listen_line = f'Listen {sys.argv[7]}'
block = f'''{listen_line}

{marker_begin}
<IfModule mod_proxy.c>
    <VirtualHost *:{sys.argv[7]}>
        ServerName {hostname}
        ProxyPreserveHost On
        ProxyRequests Off
        ProxyPass / {backend}/
        ProxyPassReverse / {backend}/
        ErrorLog "logs/{hostname}-error_log"
        CustomLog "logs/{hostname}-access_log" common
    </VirtualHost>
</IfModule>
{marker_end}
'''

vhosts_text = vhosts.read_text()
vhosts_text = vhosts_text.replace('Listen 8090', listen_line)
vhosts_text = vhosts_text.replace('<VirtualHost *:8090>', f'<VirtualHost *:{sys.argv[7]}>')
if not re.search(rf'(?m)^{re.escape(listen_line)}$', vhosts_text):
    if not vhosts_text.endswith('\n'):
        vhosts_text += '\n'
    vhosts_text += f'\n{listen_line}\n'
pattern = re.compile(re.escape(marker_begin) + r'.*?' + re.escape(marker_end) + r'\n?', re.S)
if pattern.search(vhosts_text):
    vhosts_text = pattern.sub(block, vhosts_text)
elif hostname not in vhosts_text:
    if not vhosts_text.endswith('\n'):
        vhosts_text += '\n'
    vhosts_text += '\n' + block
vhosts.write_text(vhosts_text)
PY2

printf 'XAMPP updated. Restart Apache in XAMPP now.\n'
