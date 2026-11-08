#!/usr/bin/env python3
"""Enable text compression and HTTP/2 on the two existing LHL-76 vhosts."""
from pathlib import Path
import subprocess
import time

paths = [Path('/etc/nginx/sites-available/lhl76.conf'), Path('/etc/nginx/sites-available/lhl76-domain.conf')]
originals = {path: path.read_bytes() for path in paths}
stamp = time.strftime('%Y%m%d-%H%M%S')
try:
    for path, original in originals.items():
        source = original.decode()
        if 'proxy_pass http://127.0.0.1:3000;' not in source:
            raise RuntimeError('Unexpected upstream: ' + str(path))
        source = source.replace('listen 443 ssl;', 'listen 443 ssl http2;').replace('listen 8443 ssl;', 'listen 8443 ssl http2;')
        if '# LHL text compression' not in source:
            source = source.replace('    client_max_body_size 160m;', '''    # LHL text compression; compressed images, video and archives are excluded.
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_min_length 1024;
    gzip_comp_level 4;
    gzip_types application/json application/javascript text/css text/plain image/svg+xml;
    client_max_body_size 160m;''')
        if source.encode() != original:
            path.with_name(path.name + '.before-compression-' + stamp).write_bytes(original)
            path.write_text(source)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except BaseException:
    for path, original in originals.items():
        path.write_bytes(original)
    raise
print('HTTP/2 and text gzip enabled; database and media unchanged')
