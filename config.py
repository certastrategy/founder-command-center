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
