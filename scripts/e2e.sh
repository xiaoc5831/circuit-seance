#!/usr/bin/env bash
# Build is assumed (npm run build). Starts `vite preview` itself, then runs Playwright.
# usage: scripts/e2e.sh [playwright args...]
set -u
PORT=${PORT:-4319}
npx vite preview --port "$PORT" --strictPort --host 127.0.0.1 > /tmp/circuit-seance-preview.log 2>&1 &
SRV=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/" > /dev/null && break; sleep 0.5; done
PW_EXTERNAL_SERVER=1 PORT=$PORT npx playwright test "$@"
RC=$?
kill $SRV 2>/dev/null
exit $RC
