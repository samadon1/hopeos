"""Tiny HTTP server for the HopeOS loading splash screen.

Serves loading.html and status.json on port 3000.
setup.sh writes status updates to /tmp/hopeos_status.json.
This server reads that file and serves it to the loading page.

Usage: python3 launchers/splash_server.py &
"""

import http.server
import json
import os
import sys

PORT = 3099
STATUS_FILE = "/tmp/hopeos_status.json"
LOADING_HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), "loading.html")


class SplashHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.serve_file(LOADING_HTML, "text/html")
        elif self.path.startswith("/status.json"):
            self.serve_status()
        else:
            self.send_error(404)

    def serve_file(self, filepath, content_type):
        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", len(data))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404)

    def serve_status(self):
        try:
            with open(STATUS_FILE, "r") as f:
                data = f.read()
        except FileNotFoundError:
            data = json.dumps({"step": "platform", "detail": "Starting..."})

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data.encode())

    def log_message(self, format, *args):
        pass  # Suppress logs


def main():
    server = http.server.HTTPServer(("0.0.0.0", PORT), SplashHandler)
    print(f"Splash server on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()


if __name__ == "__main__":
    main()
