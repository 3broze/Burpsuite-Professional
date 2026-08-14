#!/usr/bin/env python3
"""RouteRig preview server: static files with no-cache headers for app code
so the preview always shows the latest build. Live data calls still come
straight from the user's browser."""
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# app code: always revalidate. vendor/fonts/icons are immutable per commit.
NO_CACHE_EXT = {'', '.html', '.js', '.css', '.json', '.webmanifest'}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        ext = os.path.splitext(self.path.split('?')[0])[1].lower()
        if ext in NO_CACHE_EXT or self.path.split('?')[0].endswith('/'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
