# Founder Command Center V1.1

A single-founder AI command system that routes tasks through an 8-department pipeline and produces structured, audited outputs. This is not a chatbot â it is an execution engine.

**V1.1** adds a web dashboard and API layer on top of the CLI engine.

## Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/certastrategy/founder-command-center.git
cd founder-command-center

# 2. Install dependencies
pip install -r requirements.txt
cd frontend && npm install && cd ..

# 3. Set your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Start the system
python api/server.py &          # Backend on port 8000
cd frontend && npm run dev &    # Frontend on port 3000

# 5. Open http://localhost:3000
```

Or use the setup script: `bash setup.sh`

## Requirements

- Python 3.10+
- Node.js 18+
- Anthropic API key

## Architecture

```
Browser (localhost:3000)
    â
    â  /api/* requests (Next.js rewrites)
    â¼
FastAPI Backend (localhost:8000)
    â
    â  router.py â classify_task()
    â  workflows/base.py â execute_chain()
    â  client.py â call_department()
    â¼
Anthropic API (Claude)
```

### 8 Departments

| # | Department | Role |
|---|-----------|------|
| 1 | **Command Center** | Central coordination, task intake, and final integration |
| 2 | **Strategy & Structuring** | Strategic framing, positioning, structural design |
| 3 | **Capital & Deal** | Financial modeling, deal structuring, investor alignment |
| 4 | **Narrative & Media** | Content creation, storytelling, messaging |
| 5 | **Product & Tech** | Product strategy, technical architecture, roadmaps |
| 6 | **Research & Intelligence** | Market research, competitive intelligence (support) |
| 7 | **Monetization & Operations** | Revenue model, pricing, unit economics (support) |
| 8 | **Audit & Red Team** | Critical review, adversarial testing, quality assurance |

### 4 Workflows

| Workflow | Pipeline |
|----------|----------|
| **Financing Deck** | Command Center â Strategy â Capital â Narrative â Audit â Final |
| **Website Strategy** | Command Center â Strategy â Narrative â Product & Tech â Audit â Final |
| **Proposal** | Command Center â Strategy â Capital â Narrative â Audit â Final |
| **Project Definition** | Command Center â Strategy â Product & Tech â Narrative â Audit â Final |

## Web Dashboard (V1.1)

The dashboard has four views:

- **Command** â Input a task, watch departments execute in real-time, view final output
- **History** â Browse all past task runs with status, duration, and workflow type
- **Trace** â Expand each department's output step-by-step
- **Settings** â View configuration, backend status, and available workflows

The left panel takes task input (title, type, background, goal, constraints, desired outputs). The center shows the live workflow pipeline with step-by-step status. The right panel shows the final output, department summaries, audit findings, and raw trace.

## CLI Usage (V1)

```bash
# Interactive mode
python main.py

# File input
python main.py --input inputs/sample_input.md

# Direct workflow selection
python main.py --task financing_deck --input inputs/sample_input.md --yes

# List workflows
python main.py --list
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + API key status |
| GET | `/api/config` | Departments, workflows, model config |
| POST | `/api/tasks/run` | Submit a new task |
| GET | `/api/tasks/{id}/status` | Task status + step progress |
| GET | `/api/tasks/{id}/output` | Final output + step outputs |
| GET | `/api/tasks/{id}/trace` | Full execution trace |
| GET | `/api/tasks/history` | All task history |

## Configuration

Environment variables (set in `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `FCC_MODEL` | `claude-sonnet-4-20250514` | Claude model to use |
| `FCC_MAX_TOKENS` | `4096` | Max tokens per department call |
| `FCC_TEMPERATURE` | `0.4` | Generation temperature |

## Project Structure

```
founder-command-center/
âââ main.py              # CLI entry point (V1)
âââ config.py            # Configuration & registry
âââ router.py            # Task classification & routing
âââ client.py            # Anthropic API client
âââ api/
â   âââ server.py        # FastAPI backend (V1.1)
âââ frontend/
â   âââ app/
â   â   âââ page.tsx     # Main dashboard
â   â   âââ layout.tsx   # Root layout
â   â   âââ globals.css  # FCC dark theme
â   âââ lib/
â   â   âââ api.ts       # TypeScript API client
â   âââ package.json     # Next.js 14 project
â   âââ next.config.js   # API proxy config
â   âââ tailwind.config.ts
âââ prompts/             # 8 department prompt files
âââ workflows/           # Workflow execution modules
â   âââ base.py          # Core workflow engine
âââ inputs/              # Input files
âââ outputs/             # Generated outputs (gitignored)
âââ setup.sh             # One-command setup
âââ .env.example         # Environment template
```

## License

Proprietary â CertaStrategy
