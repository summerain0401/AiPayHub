#!/usr/bin/env bash
set -euo pipefail
command -v ngrok >/dev/null 2>&1 || { echo "ERROR: Install ngrok (brew install ngrok)"; exit 1; }
PORT="${1:-3000}"
echo ">>> Starting ngrok on port $PORT..."
ngrok http "$PORT" &
NGROK_PID=$!
sleep 3
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$NGROK_URL" ]; then
  echo "ERROR: Could not detect ngrok URL"
  kill $NGROK_PID 2>/dev/null
  exit 1
fi
echo "=== Ngrok active ==="
echo "Public URL: $NGROK_URL"
echo "Update .env: GATEWAY_BASE_URL=$NGROK_URL"
echo "Webhook URL: $NGROK_URL/webhook/alipay"
echo "Ctrl+C to stop"
wait $NGROK_PID
