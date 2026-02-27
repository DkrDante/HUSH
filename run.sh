#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# HUSH – One-command startup script
# Usage:  bash run.sh
# ─────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"

echo ""
echo "  🤚  HUSH – Gesture & Sign Language Recognition"
echo "  ───────────────────────────────────────────────"

# Create virtual env if needed
if [ ! -d "$VENV_DIR" ]; then
  echo "  📦  Creating virtual environment…"
  python3 -m venv "$VENV_DIR"
fi

# Activate
source "$VENV_DIR/bin/activate"

# Install / upgrade deps
echo "  📥  Installing dependencies (may take a minute on first run)…"
pip install -q --upgrade pip
pip install -q fastapi "uvicorn[standard]" mediapipe==0.10.18 opencv-python-headless numpy==1.26.4 python-multipart websockets Pillow

echo ""
echo "  ✅  Dependencies ready."
echo "  🚀  Starting HUSH on http://localhost:8000"
echo "  Press Ctrl+C to stop."
echo ""

cd "$PROJECT_DIR"
python3 -m uvicorn backend.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-dir backend \
  --log-level info
