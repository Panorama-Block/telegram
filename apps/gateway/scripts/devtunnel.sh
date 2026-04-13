#!/usr/bin/env bash
# -----------------------------------------------------------
# devtunnel.sh – Start ngrok tunnel + auto-register Telegram webhook
#
# Usage:
#   ./scripts/devtunnel.sh          # uses default port 7778
#   ./scripts/devtunnel.sh 8080     # custom port
#
# Requirements:
#   - ngrok installed (https://ngrok.com/download)
#   - .env with TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET
# -----------------------------------------------------------

set -euo pipefail

PORT="${1:-7778}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATEWAY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[devtunnel]${NC} $1"; }
ok()   { echo -e "${GREEN}[devtunnel]${NC} $1"; }
warn() { echo -e "${YELLOW}[devtunnel]${NC} $1"; }
err()  { echo -e "${RED}[devtunnel]${NC} $1" >&2; }

# ── Pre-flight checks ──────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  err "ngrok not found. Install it:"
  err "  brew install ngrok     (macOS)"
  err "  https://ngrok.com/download"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  err "npx not found. Install Node.js first."
  exit 1
fi

# ── Kill any existing ngrok on this port ────────────────────
if pgrep -f "ngrok.*http.*$PORT" &>/dev/null; then
  warn "Killing existing ngrok tunnel on port $PORT..."
  pkill -f "ngrok.*http.*$PORT" || true
  sleep 1
fi

# ── Start ngrok in background ──────────────────────────────
log "Starting ngrok tunnel on port $PORT..."
ngrok http "$PORT" --log=stdout --log-level=warn > /dev/null &
NGROK_PID=$!

# Wait for ngrok to initialize
sleep 3

# Verify ngrok is running
if ! kill -0 "$NGROK_PID" 2>/dev/null; then
  err "ngrok failed to start. Check your ngrok auth token (ngrok config add-authtoken <token>)."
  exit 1
fi

# ── Get public URL from ngrok API ──────────────────────────
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
  | grep -o '"public_url":"https://[^"]*"' \
  | head -1 \
  | cut -d'"' -f4)

if [ -z "$TUNNEL_URL" ]; then
  err "Could not get tunnel URL from ngrok API."
  err "Make sure ngrok is running and port 4040 is accessible."
  kill "$NGROK_PID" 2>/dev/null || true
  exit 1
fi

ok "Tunnel active: $TUNNEL_URL -> localhost:$PORT"

# ── Register Telegram webhook ──────────────────────────────
log "Registering Telegram webhook..."

cd "$GATEWAY_DIR"
PUBLIC_GATEWAY_URL="$TUNNEL_URL" npx tsx scripts/setWebhook.ts

ok "Webhook registered at: $TUNNEL_URL/telegram/webhook"

# ── Summary ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Dev tunnel ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Tunnel URL:  ${CYAN}$TUNNEL_URL${NC}"
echo -e "  Local port:  ${CYAN}$PORT${NC}"
echo -e "  Webhook:     ${CYAN}$TUNNEL_URL/telegram/webhook${NC}"
echo -e "  ngrok UI:    ${CYAN}http://localhost:4040${NC}"
echo -e "  ngrok PID:   ${CYAN}$NGROK_PID${NC}"
echo ""
echo -e "  ${YELLOW}Now run in another terminal:${NC}"
echo -e "  ${CYAN}cd $GATEWAY_DIR && npm run dev${NC}"
echo ""
echo -e "  ${YELLOW}To stop the tunnel:${NC}"
echo -e "  ${CYAN}kill $NGROK_PID${NC}"
echo ""

# ── Keep alive (Ctrl+C to stop) ────────────────────────────
cleanup() {
  echo ""
  log "Shutting down tunnel..."
  kill "$NGROK_PID" 2>/dev/null || true

  # Delete webhook on shutdown
  warn "Removing Telegram webhook..."
  cd "$GATEWAY_DIR"
  npx tsx scripts/deleteWebhook.ts 2>/dev/null || true

  ok "Tunnel stopped. Webhook removed."
  exit 0
}

trap cleanup SIGINT SIGTERM

log "Press Ctrl+C to stop the tunnel and remove the webhook."
wait "$NGROK_PID"
