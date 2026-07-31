#!/usr/bin/env bash
# One-command launcher for the AI Trading Terminal.
#
#   ./launch.sh
#
# Pulls the latest code, installs dependencies, builds the frontend and starts
# the server. Leave the terminal open while it runs; press Ctrl+C to stop.
set -euo pipefail

BRANCH="claude/ai-trading-terminal-alpaca-5bonfn"
cd "$(dirname "$0")"
REPO_ROOT="$(cd .. && pwd)"

echo "▸ Updating code…"
cd "$REPO_ROOT"
if [ -n "$(git status --porcelain)" ]; then
  echo "  ! You have uncommitted local changes. Stashing them so the update can proceed."
  git stash push -m "launch.sh autostash $(date +%F-%H%M%S)" >/dev/null
  echo "  ! Recover them later with: git stash pop"
fi
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
cd "$REPO_ROOT/ai-trading-terminal"

echo "▸ Installing dependencies…"
npm run install:all --silent

echo "▸ Building the app…"
npm run build --silent

PORT="${PORT:-8787}"
# Free the port if a previous run is still holding it.
if command -v lsof >/dev/null 2>&1; then
  OLD_PID="$(lsof -ti tcp:"$PORT" || true)"
  if [ -n "$OLD_PID" ]; then
    echo "▸ Stopping previous server on port $PORT (pid $OLD_PID)…"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi

cat <<BANNER

  ────────────────────────────────────────────────────────
   AI Trading Terminal is starting.

   Open your browser at:   http://localhost:$PORT

   Log in with  jmorgan  /  Password@123
   (or click "Create account" to make your own)

   Keep this window open. Press Ctrl+C here to stop.
  ────────────────────────────────────────────────────────

BANNER

# Open the browser automatically once the server is up.
( sleep 3
  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"        # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"  # Linux
  fi ) >/dev/null 2>&1 &

exec npm start
