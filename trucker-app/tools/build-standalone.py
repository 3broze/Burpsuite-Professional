#!/usr/bin/env python3
"""Build a fully self-contained single-file version of RouteRig.
All CSS, JS, fonts and Leaflet images are inlined as data: URIs, so the
file works offline from file:// or any static host.
"""
import base64
import os
import re
import sys

APP = '/home/user/Burpsuite-Professional/trucker-app'
OUT = '/home/user/RouteRig.html'

def data_uri(path, mime):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    return f'data:{mime};base64,{b64}'

def inline_css(path, rel_dir):
    """Inline a CSS file, converting url(...) references to data URIs."""
    with open(path, 'r', encoding='utf-8') as f:
        css = f.read()
    def repl(m):
        target = m.group(1)
        full = os.path.normpath(os.path.join(os.path.dirname(path), target))
        mime = 'image/png' if full.endswith('.png') else \
               'font/woff2' if full.endswith('.woff2') else \
               'image/svg+xml' if full.endswith('.svg') else 'application/octet-stream'
        if not os.path.exists(full):
            print(f'WARN missing asset: {full}', file=sys.stderr)
            return m.group(0)
        return f"url('{data_uri(full, mime)}')"
    css = re.sub(r"url\(['\"]?([^'\"()]+)['\"]?\)", repl, css)
    return css

with open(os.path.join(APP, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()

def replace_tag(html, pattern, replacement):
    new, n = re.subn(pattern, lambda m: replacement, html)
    assert n == 1, f'expected 1 match, got {n} for {pattern}'
    return new

# --- stylesheets ---
css_blocks = {
    'vendor/leaflet/leaflet.css': None,
    'vendor/markercluster/MarkerCluster.css': None,
    'css/fonts.css': None,
    'css/style.css': None,
}
for rel in css_blocks:
    css_blocks[rel] = inline_css(os.path.join(APP, rel), rel)

html = html.replace('<link rel="stylesheet" href="vendor/leaflet/leaflet.css">',
                    '<style>\n' + css_blocks['vendor/leaflet/leaflet.css'] + '\n</style>')
html = html.replace('<link rel="stylesheet" href="vendor/markercluster/MarkerCluster.css">',
                    '<style>\n' + css_blocks['vendor/markercluster/MarkerCluster.css'] + '\n</style>')
html = html.replace('<link rel="stylesheet" href="css/fonts.css">',
                    '<style>\n' + css_blocks['css/fonts.css'] + '\n</style>')
html = html.replace('<link rel="stylesheet" href="css/style.css">',
                    '<style>\n' + css_blocks['css/style.css'] + '\n</style>')

# --- scripts ---
js_files = [
    'vendor/leaflet/leaflet.js',
    'vendor/markercluster/leaflet.markercluster.js',
    'js/config.js', 'js/util.js', 'js/geo.js', 'js/icons.js', 'js/data.js',
    'js/overpass.js', 'js/fuel.js', 'js/services.js', 'js/routing.js',
    'js/drive.js', 'js/ui.js', 'js/app.js',
]
for rel in js_files:
    with open(os.path.join(APP, rel), 'r', encoding='utf-8') as f:
        code = f.read()
    html = html.replace(f'<script src="{rel}"></script>', '<script>\n' + code + '\n</script>')

# --- favicon stays as-is (inline data URI already) ---
# --- ensure Leaflet default icon path never hits the network (we only use divIcons) ---
html = html.replace('</body>',
    "<script>try{window.L&&L.Icon&&(L.Icon.Default.imagePath='data:');}catch(e){}</script>\n</body>")

# leftover external references check
leftover = re.findall(r'(?:src|href)="(?!data:)(?!https?://(?:[a-z0-9.-]+\.(?:basemaps\.cartocdn\.com|openstreetmap\.org|overpass[^"]*|nominatim[^"]*|router\.project-osrm\.org|api\.openrouteservice\.org)))([^"]+)"', html)
if leftover:
    print('WARN remaining local references:', leftover, file=sys.stderr)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

size = os.path.getsize(OUT)
print(f'OK wrote {OUT} ({size/1024:.0f} KB)')
