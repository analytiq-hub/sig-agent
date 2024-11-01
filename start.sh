#!/bin/bash

# Only runs inside docker
if [ -f /.dockerenv ]; then
    echo "Running inside Docker"
else
    echo "Not running inside Docker"
    exit 1
fi

echo "Starting Next.js frontend"
cd /app/frontend && npm run start &

echo "Starting FastAPI backend"
cd /app/backend/api && uvicorn main:app --host :: --port 8000 &

echo "Starting worker"
cd /app/backend/worker && python3 worker.py &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?