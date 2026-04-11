#!/usr/bin/env python3
"""
Founder Command Center — V1 Local Engine
=========================================
A single-founder AI command system that routes tasks through
an 8-department pipeline and produces structured, audited outputs.

Usage:
    python main.py                          # Interactive mode
    python main.py --input inputs/sample_input.md   # File input mode
    python main.py --task financing_deck --input inputs/sample_input.md  # Direct workflow
    python main.py --list                   # List available workflows
"""
import argparse
import logging
import os
import sys
from datetime import datetime

import config
from router import classify_task, get_workflow_chain, list_workflows
from workflows.base import execute_chain


def setup_logging() -> None:
    """Configure logging to both console and file."""
    os.makedirs(config.LOGS_DIR, exist_ok=True)
    log_file = os.path.join(
        config.LOGS_DIR, f"fcc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    )

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("anthropic").setLevel(logging.WARNING)


def print_banner() -> None:
    """Print the startup banner."""
    print(
        r"""
╔══════════════════════════════════════════════════════════╗
║           FOUNDER COMMAND CENTER  v1.0                   ║
║           AI-Powered Execution System                    ║
║           8-Department Architecture                      ║
╚══════════════════════════════════════════════════════════╝
"""
    )


def print_workflows() -> None:
    """Print available workflows."""
    workflows = list_workflows()
    print("\nAvailable Workflows:")
    print("-" * 50)
    for key, info in workflows.items():
        print(f"  {key:<25} {info['name']}")
        print(f"  {'':25} {info['description'][:80]}")
        print()


def read_input(path: str) -> str:
    """Read input from a file."""
    if not os.path.isabs(path):
        path = os.path.join(config.BASE_DIR, path)
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def interactive_input() -> str:
    """Get task input interactively from the user."""
    print("\nDescribe your task (press Enter twice to submit):")
    print("-" * 50)
    lines = []
    empty_count = 0
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line == "":
            empty_count += 1
            if empty_count >= 2:
                break
            lines.append(line)
        else:
            empty_count = 0
            lines.append(line)
    return "\n".join(lines).strip()


def confirm_workflow(workflow_key: str, user_input: str) -> bool:
    """Ask user to confirm the detected workflow."""
    wf = config.WORKFLOWS[workflow_key]
    chain_names = [config.DEPARTMENTS[d]["name"] for d in wf["chain"]]

    print(f"\n  Detected task type: {wf['name']}")
    print(f"  Workflow chain:")
    for i, name in enumerate(chain_names):
        suffix = " (Final Integration)" if i == len(chain_names) - 1 and name == "Command Center" else ""
        print(f"    {i+1}. {name}{suffix}")
    print()

    response = input("  Proceed? [Y/n]: ").strip().lower()
    return response in ("", "y", "yes")


def run_workflow(workflow_key: str, user_input: str) -> dict:
    """Execute a workflow and return results."""
    chain = get_workflow_chain(workflow_key)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    result = execute_chain(
        user_input=user_input,
        workflow_key=workflow_key,
        chain=chain,
        run_id=run_id,
    )
    return result


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Founder Command Center \u2014 V1 Local Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py
  python main.py --input inputs/sample_input.md
  python main.py --task financing_deck --input inputs/sample_input.md
  python main.py --list
        """,
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        help="Path to input file (markdown or text)",
    )
    parser.add_argument(
        "--task", "-t",
        type=str,
        choices=list(config.WORKFLOWS.keys()),
        help="Directly specify the workflow type (skip auto-detection)",
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available workflows and exit",
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip confirmation prompt",
    )

    args = parser.parse_args()
    setup_logging()
    logger = logging.getLogger("fcc.main")

    print_banner()

    if args.list:
        print_workflows()
        return

    if not config.ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY is not set.")
        print("Please set it in your .env file or as an environment variable.")
        print("See .env.example for reference.")
        sys.exit(1)

    if args.input:
        logger.info("Reading input from: %s", args.input)
        user_input = read_input(args.input)
    else:
        user_input = interactive_input()

    if not user_input:
        print("No input provided. Exiting.")
        sys.exit(1)

    logger.info("Input received (%d chars)", len(user_input))

    if args.task:
        workflow_key = args.task
        logger.info("Workflow specified directly: %s", workflow_key)
    else:
        workflow_key = classify_task(user_input)
        if workflow_key is None:
            print("\nCould not auto-detect task type from your input.")
            print("Please either:")
            print("  1. Use --task to specify the workflow directly")
            print("  2. Include clearer keywords in your input")
            print()
            print_workflows()
            sys.exit(1)

    if not args.yes:
        if not confirm_workflow(workflow_key, user_input):
            print("Cancelled.")
            return

    logger.info("Executing workflow: %s", workflow_key)
    result = run_workflow(workflow_key, user_input)

    print("\n" + "=" * 60)
    print("  EXECUTION SUMMARY")
    print("=" * 60)
    print(f"  Workflow:    {result['meta']['workflow_name']}")
    print(f"  Steps:       {result['meta']['total_steps']}")
    print(f"  Output dir:  {result['meta']['output_dir']}")
    print(f"  Started:     {result['meta']['started_at']}")
    print(f"  Completed:   {result['meta']['completed_at']}")
    print()
    print(f"  Final output: {os.path.join(result['meta']['output_dir'], 'FINAL_OUTPUT.md')}")
    print("=" * 60)


if __name__ == "__main__":
    main()
