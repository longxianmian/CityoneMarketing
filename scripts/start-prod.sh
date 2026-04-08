#!/bin/sh
# Production startup: launch growth-backend then api-server
# Both must run in the same container so localhost:3100 resolves.

# Start the CityOne growth backend (ES module, port 3100)
PORT=3100 node artifacts/cityone-growth-backend/backend/src/index.js &
BACKEND_PID=$!

# Forward signals so both processes clean up on container shutdown
trap 'kill $BACKEND_PID 2>/dev/null; exit 0' INT TERM

echo "Growth backend starting (PID: $BACKEND_PID)..."

# Wait up to 15 s for the backend to accept connections
i=0
while [ $i -lt 30 ]; do
  if node -e "require('http').get('http://localhost:3100/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))" 2>/dev/null; then
    echo "Growth backend ready (${i} x 0.5s)"
    break
  fi
  sleep 0.5
  i=$((i + 1))
done

echo "Starting API server..."
node --enable-source-maps artifacts/api-server/dist/index.mjs &
SERVER_PID=$!

# Wait for either process to exit; restart the whole thing if either dies
wait $BACKEND_PID $SERVER_PID
