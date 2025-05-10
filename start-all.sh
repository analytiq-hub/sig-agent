#! /bin/bash

# Get the project root directory regardless of where the script is called from
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="${SCRIPT_DIR}"
VENV_PATH="${PROJECT_ROOT}/.venv"

# Define colors for different processes
RED='\033[0;31m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Array to store background PIDs
pids=()

# Cleanup function to kill all child processes
cleanup() {
    echo "Shutting down processes..."
    
    # First, terminate child processes individually
    for pid in ${pids[@]}; do
        if kill -0 $pid 2>/dev/null; then
            kill -TERM $pid 2>/dev/null
        fi
    done
    
    # Give processes a moment to terminate gracefully
    sleep 1
    
    # Force kill any remaining processes
    for pid in ${pids[@]}; do
        if kill -0 $pid 2>/dev/null; then
            kill -9 $pid 2>/dev/null
        fi
    done
    
    # Cleanup Next.js server specifically
    cleanup_next_server
    
    echo "Shutdown complete"
    exit 0
}

# Modify trap to only catch specific signals
trap cleanup SIGINT SIGTERM
# Remove EXIT from trap to prevent double-cleanup

# Function to run a process and color its output
run_with_color() {
    local command=$1
    local color=$2
    local name=$3
    local dir=$4
    
    # Run the command with virtual environment activation and optional directory change
    if [ -n "$dir" ]; then
        (cd "$dir" && source "${VENV_PATH}/bin/activate" && $command) 2>&1 | while read -r line; do
            echo -e "${color}[$name] $line${NC}"
        done &
    else
        (source "${VENV_PATH}/bin/activate" && $command) 2>&1 | while read -r line; do
            echo -e "${color}[$name] $line${NC}"
        done &
    fi
    # Store the PID of the last background process
    pids+=($!)
}

cleanup_next_server() {
    kill -9 `ps -ef|grep next-server | awk '{ print $2}'| head -n 1` >/dev/null 2>&1
}
cleanup_uvicorn() {
    kill -9 `ps -ef|grep uvicorn | awk '{ print $2}'| head -n 1` >/dev/null 2>&1
}

# Clean up old processes
cleanup_next_server
cleanup_uvicorn
# Run both processes
run_with_color "uvicorn api.main:app --reload --host 0.0.0.0 --port 8000" "$RED" "FASTAPI" "backend"
run_with_color "python worker.py" "$GREEN" "WORKER" "backend/worker"
run_with_color "npm run dev" "$MAGENTA" "NEXTJS" "frontend"

# Wait for any process to exit
while true; do
    for pid in ${pids[@]}; do
        if ! kill -0 $pid 2>/dev/null; then
            echo "Process $pid has exited. Stopping all processes..."
            cleanup
            exit 0
        fi
    done
    sleep 1
done

