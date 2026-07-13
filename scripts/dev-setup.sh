#!/usr/bin/env bash
set -euo pipefail
echo "=== AI-Pay Hub — Dev Setup ==="
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js required (>=20)"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm required"; exit 1; }
echo ">>> Installing dependencies..."
pnpm install
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">>> .env created from .env.example"
fi
if ! redis-cli ping >/dev/null 2>&1; then
  if command -v docker >/dev/null 2>&1; then
    echo ">>> Starting Redis via Docker..."
    docker run -d -p 6379:6379 --name ai-pay-redis redis:7-alpine 2>/dev/null || true
  else
    echo "WARN: Redis not running — install or start it manually"
  fi
else
  echo ">>> Redis is running"
fi
mkdir -p dist logs
echo "=== Done! Run: pnpm dev ==="
