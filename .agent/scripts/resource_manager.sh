#!/bin/bash
# resource_manager.sh - Manages port allocation and file locks for parallel agent execution

set -e

RESOURCES_DIR="resources"
PORTS_FILE="$RESOURCES_DIR/ports.jsonl"
LOCKS_FILE="$RESOURCES_DIR/file_locks.jsonl"

# Port range for agent allocation
PORT_START=3000
PORT_END=3999

# Ensure resources directory exists
ensure_resources_dir() {
    mkdir -p "$RESOURCES_DIR"
    touch "$PORTS_FILE" "$LOCKS_FILE"
}

# Allocate an available port for an agent
allocate_port() {
    ensure_resources_dir

    local agent_id="${1:-agent_$$}"
    local allocated_ports
    allocated_ports=$(cut -d'"' -f4 "$PORTS_FILE" 2>/dev/null | sort -n || echo "")

    # Find first available port
    for port in $(seq $PORT_START $PORT_END); do
        if ! echo "$allocated_ports" | grep -q "^$port$"; then
            # Check if port is actually free on the system
            if ! lsof -i ":$port" >/dev/null 2>&1; then
                # Record allocation
                echo "{\"agent_id\": \"$agent_id\", \"port\": $port, \"timestamp\": \"$(date -Iseconds)\"}" >> "$PORTS_FILE"
                echo "$port"
                return 0
            fi
        fi
    done

    echo "Error: No available ports in range $PORT_START-$PORT_END" >&2
    exit 1
}

# Release a port allocation
release_port() {
    ensure_resources_dir

    local port="$1"
    if [ -z "$port" ]; then
        echo "Error: Port number required"
        exit 1
    fi

    # Remove the port entry from the file
    if [ -f "$PORTS_FILE" ]; then
        grep -v "\"port\": $port" "$PORTS_FILE" > "$PORTS_FILE.tmp" || true
        mv "$PORTS_FILE.tmp" "$PORTS_FILE"
        echo "Released port $port"
    fi
}

# Acquire a file lock
acquire_lock() {
    ensure_resources_dir

    local file_path="$1"
    local agent_id="${2:-agent_$$}"

    if [ -z "$file_path" ]; then
        echo "Error: File path required"
        exit 1
    fi

    # Check if file is already locked
    if grep -q "\"file\": \"$file_path\"" "$LOCKS_FILE" 2>/dev/null; then
        local holder
        holder=$(grep "\"file\": \"$file_path\"" "$LOCKS_FILE" | tail -1 | grep -o '"agent_id": "[^"]*"' | cut -d'"' -f4)
        echo "Error: File '$file_path' is locked by $holder" >&2
        exit 1
    fi

    # Acquire lock
    echo "{\"agent_id\": \"$agent_id\", \"file\": \"$file_path\", \"timestamp\": \"$(date -Iseconds)\"}" >> "$LOCKS_FILE"
    echo "Lock acquired on '$file_path' by $agent_id"
}

# Release a file lock
release_lock() {
    ensure_resources_dir

    local file_path="$1"

    if [ -z "$file_path" ]; then
        echo "Error: File path required"
        exit 1
    fi

    if [ -f "$LOCKS_FILE" ]; then
        grep -v "\"file\": \"$file_path\"" "$LOCKS_FILE" > "$LOCKS_FILE.tmp" || true
        mv "$LOCKS_FILE.tmp" "$LOCKS_FILE"
        echo "Released lock on '$file_path'"
    fi
}

# Clean up stale resources (orphaned ports and locks)
cleanup_stale() {
    ensure_resources_dir

    echo "Cleaning up stale resources..."

    # Clean up ports that are no longer in use
    if [ -f "$PORTS_FILE" ]; then
        local temp_file="$PORTS_FILE.tmp"
        > "$temp_file"

        while IFS= read -r line; do
            port=$(echo "$line" | grep -o '"port": [0-9]*' | cut -d' ' -f2)
            if lsof -i ":$port" >/dev/null 2>&1; then
                echo "$line" >> "$temp_file"
            else
                echo "Cleaned up stale port: $port"
            fi
        done < "$PORTS_FILE"

        mv "$temp_file" "$PORTS_FILE"
    fi

    # Clear all file locks (manual cleanup)
    if [ -f "$LOCKS_FILE" ]; then
        local lock_count
        lock_count=$(wc -l < "$LOCKS_FILE" | tr -d ' ')
        > "$LOCKS_FILE"
        echo "Cleared $lock_count file locks"
    fi

    echo "Cleanup complete."
}

# List current allocations
list_resources() {
    ensure_resources_dir

    echo "=== Allocated Ports ==="
    if [ -s "$PORTS_FILE" ]; then
        cat "$PORTS_FILE"
    else
        echo "No ports allocated."
    fi

    echo ""
    echo "=== File Locks ==="
    if [ -s "$LOCKS_FILE" ]; then
        cat "$LOCKS_FILE"
    else
        echo "No file locks."
    fi
}

# Main command dispatcher
case "$1" in
    "allocate_port")
        shift
        allocate_port "$@"
        ;;
    "release_port")
        shift
        release_port "$@"
        ;;
    "acquire_lock")
        shift
        acquire_lock "$@"
        ;;
    "release_lock")
        shift
        release_lock "$@"
        ;;
    "cleanup_stale")
        cleanup_stale
        ;;
    "list")
        list_resources
        ;;
    *)
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  allocate_port [agent_id]     - Allocate an available port"
        echo "  release_port <port>          - Release a port allocation"
        echo "  acquire_lock <file> [agent]  - Acquire a file lock"
        echo "  release_lock <file>          - Release a file lock"
        echo "  cleanup_stale                - Clean up orphaned resources"
        echo "  list                         - List all current allocations"
        exit 1
        ;;
esac
