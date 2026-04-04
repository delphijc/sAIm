#!/bin/bash
# Observability Dashboard Manager - PAI Agent Activity Monitor
# Location: ~/.claude/skills/observability/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUN_BIN="${HOME}/.bun/bin/bun"

case "${1:-}" in
    start)
        # Check if already running
        if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✓ Observability already running at http://localhost:5172"
            exit 0
        fi

        # Ensure log directory exists
        mkdir -p "$SCRIPT_DIR/logs"
        LOG_SERVER="$SCRIPT_DIR/logs/server.log"
        LOG_CLIENT="$SCRIPT_DIR/logs/client.log"

        echo "▶ Starting server..."
        # Start server in background
        cd "$SCRIPT_DIR/apps/server"
        export PAI_DIR="${PAI_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
        $BUN_BIN run dev > "$LOG_SERVER" 2>&1 &
        SERVER_PID=$!

        # Wait for server
        echo "▶ Waiting for server to initialize..."
        for i in {1..15}; do
            if curl -s http://localhost:4000/events/filter-options >/dev/null 2>&1; then
                echo "✓ Server ready"
                break
            fi
            sleep 1
        done

        echo "▶ Starting client..."
        # Start client in background
        cd "$SCRIPT_DIR/apps/client"
        $BUN_BIN ./node_modules/.bin/vite --host 0.0.0.0 > "$LOG_CLIENT" 2>&1 &
        CLIENT_PID=$!

        # Wait for client
        echo "▶ Waiting for client to initialize..."
        for i in {1..15}; do
            if curl -s http://localhost:5172 >/dev/null 2>&1; then
                echo "✓ Client ready"
                break
            fi
            sleep 1
        done

        echo "✅ Observability running at http://localhost:5172"
        echo "📝 Logs available in $SCRIPT_DIR/logs/"

        # Store PIDs for later cleanup (non-blocking return)
        echo "$SERVER_PID" > "$SCRIPT_DIR/server.pid"
        echo "$CLIENT_PID" > "$SCRIPT_DIR/client.pid"
        ;;

    stop)
        # Try to kill from stored PID files first
        if [ -f "$SCRIPT_DIR/server.pid" ]; then
            SERVER_PID=$(cat "$SCRIPT_DIR/server.pid" 2>/dev/null)
            [ -n "$SERVER_PID" ] && kill -9 $SERVER_PID 2>/dev/null
            rm -f "$SCRIPT_DIR/server.pid"
        fi
        if [ -f "$SCRIPT_DIR/client.pid" ]; then
            CLIENT_PID=$(cat "$SCRIPT_DIR/client.pid" 2>/dev/null)
            [ -n "$CLIENT_PID" ] && kill -9 $CLIENT_PID 2>/dev/null
            rm -f "$SCRIPT_DIR/client.pid"
        fi

        # Also kill by port (fallback)
        for port in 4000 5172; do
            if [[ "$OSTYPE" == "darwin"* ]]; then
                PIDS=$(lsof -ti :$port 2>/dev/null)
            else
                PIDS=$(lsof -ti :$port 2>/dev/null || fuser -n tcp $port 2>/dev/null | awk '{print $2}')
            fi
            [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
        done

        # Kill remaining bun processes
        ps aux | grep -E "bun.*(apps/(server|client))" | grep -v grep | awk '{print $2}' | while read PID; do
            [ -n "$PID" ] && kill -9 $PID 2>/dev/null
        done

        # Clean SQLite WAL files
        rm -f "$SCRIPT_DIR/apps/server/events.db-wal" "$SCRIPT_DIR/apps/server/events.db-shm" 2>/dev/null

        echo "✅ Observability stopped"
        ;;

    restart)
        echo "🔄 Restarting..."
        "$0" stop 2>/dev/null
        sleep 1
        exec "$0" start
        ;;

    status)
        if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ Observability running at http://localhost:5172"
            echo "   Backend: http://localhost:4000"
            echo "   Frontend: http://localhost:5172"
        else
            echo "❌ Observability not running"
        fi
        ;;

    *)
        echo "Observability Dashboard Manager"
        echo ""
        echo "Usage: manage.sh {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start observability services (backend + frontend)"
        echo "  stop    - Stop observability services"
        echo "  restart - Restart observability services"
        echo "  status  - Check if services are running"
        exit 1
        ;;
esac
