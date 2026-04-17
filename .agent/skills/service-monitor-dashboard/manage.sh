#!/bin/bash

# Service Monitor Dashboard Management Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/apps/server"
CLIENT_DIR="$SCRIPT_DIR/apps/client"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[Service Monitor]${NC} $1"
}

print_error() {
    echo -e "${RED}[Error]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[Warning]${NC} $1"
}

install_deps() {
    print_status "Installing dependencies..."
    cd "$SERVER_DIR" && bun install || { print_error "Failed to install server deps"; exit 1; }
    cd "$CLIENT_DIR" && bun install || { print_error "Failed to install client deps"; exit 1; }
    print_status "Dependencies installed"
}

start_dev() {
    print_status "Starting development servers..."
    print_status "Server: http://localhost:6000"
    print_status "Client: http://localhost:5175"

    # Start server in background
    cd "$SERVER_DIR" && bun run dev > /tmp/service-monitor-server.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$SCRIPT_DIR/server.pid"

    # Start client
    cd "$CLIENT_DIR" && bun run dev
}

start_server() {
    print_status "Starting server only on port 6000..."
    cd "$SERVER_DIR" && bun run dev
}

start_client() {
    print_status "Starting client only on port 5175..."
    cd "$CLIENT_DIR" && bun run dev
}

stop() {
    print_status "Stopping services..."
    if [ -f "$SCRIPT_DIR/server.pid" ]; then
        kill $(cat "$SCRIPT_DIR/server.pid") 2>/dev/null || true
        rm "$SCRIPT_DIR/server.pid"
    fi
    print_status "Stopped"
}

build_client() {
    print_status "Building client..."
    cd "$CLIENT_DIR" && bun run build
    print_status "Build complete in $CLIENT_DIR/dist"
}

help() {
    echo "Service Monitor Dashboard Management"
    echo ""
    echo "Usage: ./manage.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install      Install dependencies"
    echo "  dev          Start both server and client in dev mode"
    echo "  server       Start server only (port 6000)"
    echo "  client       Start client only (port 5175)"
    echo "  build        Build client for production"
    echo "  stop         Stop running services"
    echo "  help         Show this help message"
    echo ""
}

case "${1:-help}" in
    install)
        install_deps
        ;;
    dev)
        install_deps
        start_dev
        ;;
    server)
        install_deps
        start_server
        ;;
    client)
        install_deps
        start_client
        ;;
    build)
        install_deps
        build_client
        ;;
    stop)
        stop
        ;;
    help)
        help
        ;;
    *)
        print_error "Unknown command: $1"
        help
        exit 1
        ;;
esac
