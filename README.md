# Founder Command Center V1

A single-founder AI command system that routes tasks through an 8-department pipeline and produces structured, audited outputs. This is not a chatbot — it is an execution engine.

## Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/certastrategy/founder-command-center.git
cd founder-command-center

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Run with sample input
python main.py --input inputs/sample_input.md --yes

# Or run interactively
python main.py
```

## Architecture

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

### 4 Supported Workflows

**Financing Deck** — `Command Center → Strategy → Capital → Narrative → Audit → Final`

**Website Strategy** — `Command Center → Strategy → Narrative → Product & Tech → Audit → Final`

**Proposal** — `Command Center → Strategy → Capital → Narrative → Audit → Final`

**Project Definition** — `Command Center → Strategy → Product & Tech → Narrative → Audit → Final`

## Usage

```bash
# Interactive mode — type your task and press Enter twice
python main.py

# File input — reads from a markdown file
python main.py --input inputs/sample_input.md

# Direct workflow selection — skip auto-detection
python main.py --task financing_deck --input inputs/sample_input.md

# Skip confirmation prompt
python main.py --task financing_deck --input inputs/sample_input.md --yes

# List available workflows
python main.py --list
```

## Output Structure

Each run creates a timestamped directory in `outputs/`:

```
outputs/financing_deck_20260411_143022/
├── step_01_command_center.md         # Task intake
├── step_02_strategy_structuring.md   # Strategic framing
├── step_03_capital_deal.md           # Financial structure
├── step_04_narrative_media.md        # Content & messaging
├── step_05_audit_red_team.md         # Critical review
├── step_06_command_center.md         # Final integration
├── FINAL_OUTPUT.md                   # Integrated deliverable
└── run_metadata.json                 # Run metadata
```

Every department output follows a unified protocol: Department, Objective, What Is Known, What Is Missing, Main Output, Risks, and Recommended Next Step.

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
├── main.py              # CLI entry point
├── config.py            # Configuration & registry
├── router.py            # Task classification & routing
├── client.py            # Anthropic API client
├── prompts/             # 8 department prompt files
├── workflows/           # Workflow execution modules
│   ├── base.py          # Core workflow engine
│   ├── financing_deck.py
│   ├── website_strategy.py
│   ├── proposal.py
│   └── project_definition.py
├── inputs/              # Input files
├── outputs/             # Generated outputs
├── logs/                # Execution logs
└── docs/                # System documentation
```

## V1 Limitations

- Sequential execution (no parallel department calls)
- Keyword-based routing (not semantic)
- No persistent memory across runs
- No real-time data access
- CLI only (no web UI)
- Support departments (Research, Monetization) not in default chains

## Upgrade Path

V2 targets: LLM-based routing, parallel execution, web search integration, session memory, web UI, and multi-format export (PPTX/DOCX).

See `docs/system_spec.md` for the full specification and roadmap.

## License

Proprietary — CertaStrategy
