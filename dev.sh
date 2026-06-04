#!/usr/bin/env bash
# dev.sh — pull latest, rebuild the new frontend, and run the backend.
#
# Typical phone workflow: cloud Claude Code edits + pushes to GitHub, then on
# this PC you run `./dev.sh` to pull those changes, rebuild frontend-next (the
# backend serves the BUILT dist, not the source), and ensure the server is up.
#
# Usage:
#   ./dev.sh            pull + build frontend + ensure server running   (default)
#   ./dev.sh pull       pull + build frontend only (no server)
#   ./dev.sh run        start the server (no pull/build)
#   ./dev.sh restart    stop the server on :8000, then start it fresh
#   ./dev.sh build      rebuild frontend-next only
set -uo pipefail
cd "$(dirname "$0")"

HOST=127.0.0.1
PORT=8000
PATTERN="uvicorn backend.main:app --host $HOST --port $PORT"

pull() {
  echo "▶ git pull (fast-forward only)…"
  if ! git pull --ff-only; then
    echo "✗ pull failed — branch diverged or has conflicts. Resolve manually, then re-run." >&2
    exit 1
  fi
}

build_frontend() {
  echo "▶ Building frontend-next…"
  ( cd frontend-next
    if [ ! -d node_modules ]; then echo "  (first run) installing deps…"; npm install; fi
    npm run build
  ) && echo "✔ frontend built (refresh the browser to see it)."
}

stop_server() {
  local pids
  pids=$(pgrep -f "$PATTERN" || true)
  if [ -n "$pids" ]; then echo "▶ stopping server (pid: $pids)…"; kill $pids 2>/dev/null || true; sleep 2; fi
}

start_server() {
  if curl -s -o /dev/null --max-time 2 "http://$HOST:$PORT/api/health"; then
    echo "✔ server already running on :$PORT (--reload picks up backend changes automatically)."
  else
    echo "▶ starting server on :$PORT…"
    nohup uv run uvicorn backend.main:app --host "$HOST" --port "$PORT" --reload > /tmp/aria-server.log 2>&1 &
    sleep 5
  fi
  curl -s -o /dev/null -w "  /next/ → HTTP %{http_code}\n" "http://$HOST:$PORT/next/" || true
  echo "  Open: http://localhost:$PORT/next/   (classic UI: /)   logs: /tmp/aria-server.log"
}

case "${1:-all}" in
  pull)    pull; build_frontend ;;
  build)   build_frontend ;;
  run)     start_server ;;
  restart) stop_server; start_server ;;
  all)     pull; build_frontend; start_server ;;
  *) echo "usage: ./dev.sh [pull|build|run|restart]"; exit 1 ;;
esac
