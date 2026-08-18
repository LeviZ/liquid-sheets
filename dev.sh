#!/bin/bash
# Liquid Sheets dev server. Dedicated port 8013 so it never collides with
# other projects' servers. Serves the repo root (the app imports
# ../engine/engine.js, so serving app/ alone would 404 the engine).
cd "$(dirname "$0")"
lsof -ti tcp:8013 | xargs kill 2>/dev/null
echo "Liquid Sheets -> http://localhost:8013/app/"
exec /usr/bin/python3 -m http.server 8013
