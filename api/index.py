"""Vercel Serverless Function entrypoint for Mating FastAPI application.
Handles route rewriting from /api/* and passes requests to canonical FastAPI app.
"""

import os
import sys
from urllib.parse import parse_qs, urlencode

# Ensure project root is on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.api.main import app as original_app


async def app(scope, receive, send):
    """ASGI middleware wrapper for Vercel serverless environment.
    Unpacks __path__ parameter if rewritten by vercel.json.
    """
    if scope["type"] == "http":
        qs = scope.get("query_string", b"").decode("utf-8")
        if "__path__" in qs:
            parsed = parse_qs(qs, keep_blank_values=True)
            new_path = parsed.pop("__path__", None)
            if new_path:
                scope["path"] = new_path[0]
                scope["query_string"] = urlencode(parsed, doseq=True).encode("utf-8")

    await original_app(scope, receive, send)
