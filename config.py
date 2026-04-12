"""
Founder Command Center - Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv(override=True)

# --- API Configuration ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL_NAME = os.getenv("FCC_MODEL", "claude-sonnet-4-20250514")
MAX_TOKENS = int(os.getenv("FCC_MAX_TOKENS", "4096"))
TEMPERATURE = float(os.getenv("FCC_TEMPERATURE", "0.4"))

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")
INPUTS_DIR = os.path.join(BASE_DIR, "inputs")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
LOGS_DIR = os.path.join(BASE_DIR, "logs")

# --- Department Registry ---
DEPARTMENTS = {
    "command_center": {
        "name": "Command Center",
        "prompt_file": "command_center.md",
        "description": "Central coordination, task intake, routing, and final integration.",
    },
    "strategy_structuring": {
        "name": "Strategy & Structuring",
        "prompt_file": "strategy_structuring.md",
        "description": "Strategic framing, positioning, narrative logic, and structural design.",
    },
    "capital_deal": {
        "name": "Capital & Deal",
        "prompt_file": "capital_deal.md",
        "description": "Financial modeling, deal structuring, investor alignment, and capital strategy.",
    },
    "narrative_media": {
        "name": "Narrative & Media",
        "prompt_file": "narrative_media.md",
        "description": "Content creation, messaging, storytelling, and media-ready outputs.",
    },
    "product_tech": {
        "name": "Product & Tech",
        "prompt_file": "product_tech.md",
        "description": "Product strategy, technical architecture, roadmap, and implementation planning.",
    },
    "research_intelligence": {
        "name": "Research & Intelligence",
        "prompt_file": "research_intelligence.md",
        "description": "Market research, competitive intelligence, data analysis, and trend synthesis.",
    },
    "monetization_operations": {
        "name": "Monetization & Operations",
        "prompt_file": "monetization_operations.md",
        "description": "Revenue model design, pricing, unit economics, and operational planning.",
    },
    "audit_red_team": {
        "name": "Audit & Red Team",
        "prompt_file": "audit_red_team.md",
        "description": "Critical review, risk identification, adversarial testing, and quality assurance.",
    },
}

# --- Workflow Definitions ---
WORKFLOWS = {
    "financing_deck": {
        "name": "Financing Deck / Investor Deck",
        "keywords": ["financing", "investor", "deck", "fundraising", "pitch deck", "raise", "funding round", "series"],
        "chain": [
            "command_center",
            "strategy_structuring",
            "capital_deal",
            "narrative_media",
            "audit_red_team",
            "command_center",
        ],
        "description": "Generate an investor-ready financing deck with strategic framing, financial structure, narrative polish, and audit.",
    },
    "website_strategy": {
        "name": "Website Strategy / Website Content Structure",
        "keywords": ["website", "web", "landing page", "site structure", "web content", "homepage", "web strategy"],
        "chain": [
            "command_center",
            "strategy_structuring",
            "narrative_media",
            "product_tech",
            "audit_red_team",
            "command_center",
        ],
        "description": "Design a website content strategy with positioning, narrative, technical architecture, and audit.",
    },
    "proposal": {
        "name": "Proposal / Partnership Proposal",
        "keywords": ["proposal", "partnership", "partner", "collaboration", "joint venture", "alliance", "deal proposal"],
        "chain": [
            "command_center",
            "strategy_structuring",
            "capital_deal",
            "narrative_media",
            "audit_red_team",
            "command_center",
        ],
        "description": "Create a partnership or business proposal with strategic logic, deal terms, compelling narrative, and audit.",
    },
    "project_definition": {
        "name": "Project Definition Document",
        "keywords": ["project definition", "project plan", "pdd", "project scope", "project spec", "define project", "project brief"],
        "chain": [
            "command_center",
            "strategy_structuring",
            "product_tech",
            "narrative_media",
            "audit_red_team",
            "command_center",
        ],
        "description": "Produce a comprehensive project definition document with strategy, technical spec, narrative framing, and audit.",
    },
}

# --- Output Protocol ---
OUTPUT_PROTOCOL = """
You MUST structure your output using the following protocol:

## Department
[Your department name]

## Objective
[What this department is trying to achieve for this task]

## What Is Known
[Key facts, context, and inputs available from the user brief and prior department outputs]

## What Is Missing
[Gaps in information, assumptions made, areas needing clarification]

## Main Output
[The core deliverable from this department — this is the primary content]

## Risks
[Key risks, concerns, or vulnerabilities identified]

## Recommended Next Step
[What should happen next in the workflow]
"""
