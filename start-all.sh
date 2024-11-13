#! /bin/bash

# Define colors for different processes
RED='\033[0;31m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Array to store background PIDs
pids=()

# Cleanup function to kill all child processes
cleanup() {
    echo "Stopping all processes..."
    # Kill all child processes in the process group
    pkill -P $$
    exit 0
}

# Set up trap for script termination
trap cleanup SIGINT SIGTERM

# Function to run a process and color its output
run_with_color() {
    local command=$1
    local color=$2
    local name=$3
    local dir=$4
    
    # Run the command with virtual environment activation and optional directory change
    if [ -n "$dir" ]; then
        (cd "$dir" && source ~/.venv/doc-router/bin/activate && $command) 2>&1 | while read -r line; do
            echo -e "${color}[$name] $line${NC}"
        done &
    else
        (source ~/.venv/doc-router/bin/activate && $command) 2>&1 | while read -r line; do
            echo -e "${color}[$name] $line${NC}"
        done &
    fi
    # Store the PID of the last background process
    pids+=($!)
}

cleanup() {
    kill -9 `ps -ef|grep next-server | awk '{ print $2}'| head -n 1` >/dev/null 2>&1
}

# Clean up old processes
cleanup

# Run both processes
run_with_color "uvicorn main:app --host :: --port 8000" "$RED" "FASTAPI" "backend/fastapi"
run_with_color "python worker.py" "$GREEN" "WORKER" "backend/worker"
run_with_color "npm run dev" "$MAGENTA" "NEXTJS" "frontend"

# Wait for any process to exit
while true; do
    for pid in ${pids[@]}; do
        if ! kill -0 $pid 2>/dev/null; then
            echo "Process $pid has exited. Stopping all processes..."
            cleanup
        fi
    done
    sleep 1
done

