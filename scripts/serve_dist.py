import http.server
import socketserver
import os
import sys

PORT = 4173
DIRECTORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Serve static file if exists, otherwise fallback to index.html for SPA
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        # Silent logging for performance
        pass

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with ThreadedTCPServer(("", PORT), SPAHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        sys.stdout.flush()
        httpd.serve_forever()
