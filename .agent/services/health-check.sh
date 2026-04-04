#!/bin/bash

# Quick health status of all PAI services
# Usage: ./health-check.sh

echo "🔍 PAI Health Check - $(date)"
echo "================================"

# Check voice server
if curl -s --max-time 3 http://localhost:8888/health > /dev/null; then
  VOICE="✅ Running"
else
  VOICE="❌ Down"
fi

# Check discord
if curl -s --max-time 3 http://localhost:4000/health > /dev/null; then
  DISCORD="✅ Running"
else
  DISCORD="❌ Down"
fi

# Check observability
if curl -s --max-time 3 http://localhost:5172 > /dev/null; then
  OBS="✅ Running"
else
  OBS="❌ Down"
fi

echo "Voice Server:        $VOICE (http://localhost:8888)"
echo "Discord Bot:         $DISCORD (http://localhost:4000)"
echo "Observability:       $OBS (http://localhost:5172)"
echo "================================"

# Alert if any service is down
if [[ $VOICE == *"❌"* ]] || [[ $DISCORD == *"❌"* ]] || [[ $OBS == *"❌"* ]]; then
  echo "⚠️  Some services are down. Run recovery or check systemd status:"
  echo "sudo systemctl status pai-voice-server pai-discord pai-observability"
  exit 1
else
  echo "✅ All systems healthy"
  exit 0
fi
