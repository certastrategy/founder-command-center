#!/bin/bash
# Founder Command Center V1.1 — Setup & Launch Script

set -e

echo ""
echo "════════════════════════════════════════════════"
echo "  Founder Command Center V1.1 — Setup"
echo "════════════════════════════════════════════════"
echo ""

# Check .env
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "[!] Created .env from .env.example"
        echo "    Edit .env and set your ANTHROPIC_API_KEY before running tasks."
        echo ""
    else
        echo "[ERROR] No .env or .env.example found."
        exit 1
    fi
fi

# Check API key
if grep -q "sk-ant-xxxxxxxxxxxxxxxxxxxx" .env 2>/dev/null; then
    echo "[WARNING] ANTHROPIC_API_KEY is still the placeholder value."
    echo "          Edit .env and set your real API key."
    echo ""
fi

# Install Python dependencies
echo "[1/3] Installing Python dependencies..."
python3 -m pip install -r requirements.txt -q
echo "      Done."

# Install frontend dependencies
echo "[2/3] Installing frontend dependencies..."
cd frontend
npm install --silent 2>/dev/null || npm install
cd ..
echo "      Done."

echo "[3/3] Starting servers..."
echo ""

# Start backend
echo "  Starting backend (port 8000)..."
python3 api/server.py &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "  Starting frontend (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "════════════════════════════════════════════════"
echo "  FCC V1.1 is running!"
echo ""
echo "  Dashboard: http://localhost:3000"
echo "  API:       http://localhost:8000/api/health"
echo ""
echo "  To stop: kill $BACKEND_PID $FRONTEND_PID"
echo "════════════════════════════════════════════════"
echo ""

wait
