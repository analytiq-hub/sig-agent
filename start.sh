#!/bin/bash

# Only runs inside docker
if [ -f /.dockerenv ]; then
    echo "Running inside Docker"
else
    echo "Not running inside Docker"
    exit 1
fi

# Start the Next.js frontend
cd /app/frontend && npm run start &

# Start the FastAPI backend
cd /app/backend/api && uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start the worker
cd /app/backend/worker && python worker.py &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?