# Founder Command Center - Deployment Guide

This guide covers deploying the Founder Command Center (FCC) to production using Vercel (frontend) and Railway (backend).

## Prerequisites

- **Frontend**: A Vercel account (https://vercel.com)
- **Backend**: A Railway account (https://railway.app)
- **Tools**: Git, Node.js 16+, Python 3.9+
- **Secrets**: Anthropic API key for Claude access

## Local Development

### 1. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set environment variables
export ANTHROPIC_API_KEY="your-api-key-here"

# Run the FastAPI server
python3 -m uvicorn api.server:app --reload
```

The backend will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend
npm install
export NEXT_PUBLIC_BACKEND_URL="http://localhost:8000"
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Deploying Frontend to Vercel

### Step 1: Connect Repository
1. Sign in to Vercel at https://vercel.com
2. Click Add New > Project
3. Import your GitHub repository

### Step 2: Configure Build Settings
1. Set Root Directory to frontend/
2. Build Command: npm install && npm run build
3. Output Directory: .next

### Step 3: Set Environment Variables
| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_BACKEND_URL | Your Railway backend URL |

### Step 4: Deploy
Click Deploy.

## Deploying Backend to Railway

### Step 1: Create a New Project
1. Sign in to Railway at https://railway.app
2. Click New Project > Deploy from GitHub
3. Select your repository

### Step 2: Configure
Railway detects railway.toml automatically.

### Step 3: Set Environment Variables
| Variable | Required | Default |
|----------|----------|---------|
| ANTHROPIC_API_KEY | Yes | - |
| FCC_MODEL | No | claude-sonnet-4-20250514 |
| FCC_MAX_TOKENS | No | 4096 |
| FCC_TEMPERATURE | No | 0.4 |
| PORT | Auto | 8000 |

### Step 4: Get Your Backend URL
Copy the Railway URL for use in Vercel NEXT_PUBLIC_BACKEND_URL.

## CORS Configuration
The FastAPI backend includes CORS middleware. If you encounter CORS errors, verify NEXT_PUBLIC_BACKEND_URL matches the Railway URL.

## Troubleshooting
- Frontend Cannot POST: Check NEXT_PUBLIC_BACKEND_URL is set
- Backend failing: Check ANTHROPIC_API_KEY and requirements.txt
- Health check failures: Verify /api/health endpoint responds
