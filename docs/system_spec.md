# Founder Command Center — System Specification V1

## 1. Product Overview

The Founder Command Center (FCC) is a single-user AI command system designed for solo founders. It receives a task, automatically routes it through a chain of specialized AI departments, and delivers a structured, audited final output.

It is not a chatbot. It is an execution engine.

## 2. Architecture: 8 Departments

| # | Department | Role | Type |
|---|-----------|------|------|
| 1 | Command Center | Central coordination, task intake, and final integration | Core |
| 2 | Strategy & Structuring | Strategic framing, positioning, structural design | Core |
| 3 | Capital & Deal | Financial modeling, deal structuring, investor alignment | Core |
| 4 | Narrative & Media | Content creation, storytelling, messaging | Core |
| 5 | Product & Tech | Product strategy, technical architecture, roadmaps | Core |
| 6 | Research & Intelligence | Market research, competitive intelligence, data analysis | Support |
| 7 | Monetization & Operations | Revenue model, pricing, unit economics, operations | Support |
| 8 | Audit & Red Team | Critical review, adversarial testing, quality assurance | Core |

**Support departments** (Research & Intelligence, Monetization & Operations) have full prompt definitions and can be called by the router when needed. In V1, they are not in the default chains but are fully operational.

## 3. Supported Task Types (V1)

### A. Financing Deck / Investor Deck
**Chain**: Command Center → Strategy & Structuring → Capital & Deal → Narrative & Media → Audit & Red Team → Command Center (Final)

**Purpose**: Generate an investor-ready financing deck with strategic framing, financial structure, narrative polish, and audit.

### B. Website Strategy / Website Content Structure
**Chain**: Command Center → Strategy & Structuring → Narrative & Media → Product & Tech → Audit & Red Team → Command Center (Final)

**Purpose**: Design a website content strategy with positioning, narrative, technical architecture, and audit.

### C. Proposal / Partnership Proposal
**Chain**: Command Center → Strategy & Structuring → Capital & Deal → Narrative & Media → Audit & Red Team → Command Center (Final)

**Purpose**: Create a partnership or business proposal with strategic logic, deal terms, compelling narrative, and audit.

### D. Project Definition Document
**Chain**: Command Center → Strategy & Structuring → Product & Tech → Narrative & Media → Audit & Red Team → Command Center (Final)

**Purpose**: Produce a comprehensive project definition with strategy, technical spec, narrative framing, and audit.

## 4. Execution Flow

```
User Input
    │
    ▼
┌─────────────┐
│   Router     │ ─── Classify task type via keyword matching
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Workflow    │ ─── Load the department chain
│  Engine      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  For each department in chain:          │
│  1. Load department prompt (.md file)   │
│  2. Build system prompt + protocol      │
│  3. Assemble user message + context     │
│  4. Call Claude API                     │
│  5. Save step output                   │
│  6. Pass output to next department     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Final       │ ─── Command Center synthesizes all outputs
│  Integration │
└──────┬──────┘
       │
       ▼
  Output files saved to outputs/
```

## 5. Output Protocol

Every department produces output in a standardized format:

- **Department**: Name of the department
- **Objective**: What this department is achieving
- **What Is Known**: Available facts and context
- **What Is Missing**: Gaps and assumptions
- **Main Output**: The core deliverable content
- **Risks**: Identified risks and concerns
- **Recommended Next Step**: What should happen next

## 6. File Structure

```
founder-command-center/
├── main.py              # Entry point — CLI interface
├── config.py            # Configuration, department/workflow registry
├── router.py            # Task classification and routing
├── client.py            # Anthropic API client wrapper
├── prompts/             # Department prompt files (8 .md files)
├── workflows/           # Workflow execution modules
│   ├── base.py          # Core workflow engine
│   ├── financing_deck.py
│   ├── website_strategy.py
│   ├── proposal.py
│   └── project_definition.py
├── inputs/              # Sample and user input files
├── outputs/             # Generated outputs (per-run directories)
├── logs/                # Execution logs
└── docs/                # Documentation
```

## 7. Configuration

All configuration is via environment variables (with `.env` file support):

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `FCC_MODEL` | `claude-sonnet-4-20250514` | Claude model to use |
| `FCC_MAX_TOKENS` | `4096` | Max tokens per API call |
| `FCC_TEMPERATURE` | `0.4` | Temperature for generation |

## 8. V1 Limitations

1. **No persistent memory** — each run is independent; no cross-run learning
2. **No parallel department execution** — departments run sequentially
3. **Keyword-based routing** — task classification uses keyword matching, not semantic understanding
4. **No real-time data** — Research & Intelligence operates on model knowledge, not live APIs
5. **No frontend** — CLI only
6. **No authentication** — single-user local system
7. **No cost tracking** — API usage is not tracked or budgeted
8. **Support departments not in default chains** — Research & Intelligence and Monetization & Operations must be manually added to chains

## 9. Upgrade Path to V2+

| Area | V1 (Current) | V2 (Next) | V3 (Future) |
|------|-------------|-----------|-------------|
| Routing | Keyword matching | LLM-based classification | Dynamic chain construction |
| Execution | Sequential | Parallel where possible | Autonomous re-routing |
| Memory | None | Session memory | Persistent knowledge base |
| Data | Static | Web search integration | Live API feeds |
| Interface | CLI | Web UI | Multi-user dashboard |
| Departments | 8 fixed | 8 + custom | Unlimited, user-defined |
| Workflows | 4 fixed | 10+ templates | User-defined workflows |
| Output | Markdown | Markdown + PPTX/DOCX | Multi-format export |
| Audit | Single pass | Multi-pass with iteration | Continuous monitoring |
| Deployment | Local | Cloud (single tenant) | Multi-tenant SaaS |
