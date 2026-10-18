#!/usr/bin/env python3
"""Serve Stillspace locally using only the Python standard library."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


def port_number(value: str) -> int:
    """Validate the port before attempting to start the server."""
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("port must be a number") from error
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--host", default="127.0.0.1", help="bind address (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--port", type=port_number, default=5173, help="port (default: 5173)"
    )
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent / "dist"
    if not (directory / "index.html").is_file():
        print("Cannot start: dist/index.html is missing.", file=sys.stderr)
        return 1

    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    try:
        with ThreadingHTTPServer((args.host, args.port), handler) as server:
            host = "localhost" if args.host in ("0.0.0.0", "::") else args.host
            print(f"Stillspace: http://{host}:{args.port}", flush=True)
            print("Press Ctrl+C to stop.", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                print("\nStopped.")
    except OSError as error:
        print(f"Cannot start server: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
