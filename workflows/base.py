"""
Founder Command Center - Base Workflow Engine
Handles the core logic of executing a department chain.
"""
import os
import json
import logging
from datetime import datetime

import config
from client import call_department

logger = logging.getLogger("fcc.workflow")


def load_prompt(department_key: str) -> str:
    """Load the prompt markdown file for a department."""
    dept = config.DEPARTMENTS[department_key]
    prompt_path = os.path.join(config.PROMPTS_DIR, dept["prompt_file"])
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def build_system_prompt(department_key: str, is_final: bool = False) -> str:
    """
    Build the full system prompt for a department call.

    Combines the department's prompt file with the output protocol.
    """
    dept_prompt = load_prompt(department_key)
    phase_note = ""
    if department_key == "command_center":
        if is_final:
            phase_note = (
                "\n\n**You are now in PHASE 2: FINAL INTEGRATION.**\n"
                "Synthesize all department outputs below into a single cohesive deliverable.\n"
            )
        else:
            phase_note = (
                "\n\n**You are now in PHASE 1: TASK INTAKE.**\n"
                "Parse the founder's input and produce a structured brief.\n"
            )

    return f"{dept_prompt}{phase_note}\n\n{config.OUTPUT_PROTOCOL}"


def build_user_message(
    user_input: str,
    workflow_name: str,
    department_key: str,
    step_index: int,
    total_steps: int,
    prior_outputs: list[dict],
    is_final: bool = False,
) -> str:
    """
    Build the user message sent to a department.

    Includes the original input and all prior department outputs for context.
    """
    parts = []

    parts.append(f"# Task Workflow: {workflow_name}")
    parts.append(f"## Step {step_index + 1} of {total_steps}")
    parts.append("")

    if is_final:
        parts.append("## FINAL INTEGRATION REQUEST")
        parts.append(
            "You are the final step. Synthesize all department outputs below "
            "into a single, cohesive, deliverable-ready output."
        )
        parts.append("")

    parts.append("## Original Founder Input")
    parts.append(user_input)
    parts.append("")

    if prior_outputs:
        parts.append("---")
        parts.append("## Prior Department Outputs")
        parts.append("")
        for output in prior_outputs:
            parts.append(f"### {output['department_name']} (Step {output['step']})")
            parts.append(output["content"])
            parts.append("")

    return "\n".join(parts)


def execute_chain(
    user_input: str,
    workflow_key: str,
    chain: list[str],
    run_id: str | None = None,
) -> dict:
    """
    Execute a full department chain for a workflow.

    Args:
        user_input: The founder's raw input text.
        workflow_key: The workflow key (e.g. 'financing_deck').
        chain: Ordered list of department keys.
        run_id: Optional run identifier for file naming.

    Returns:
        Dictionary with run metadata and all outputs.
    """
    workflow_name = config.WORKFLOWS[workflow_key]["name"]
    run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join(config.OUTPUTS_DIR, f"{workflow_key}_{run_id}")
    os.makedirs(run_dir, exist_ok=True)

    total_steps = len(chain)
    prior_outputs: list[dict] = []
    all_outputs: list[dict] = []

    logger.info(
        "Starting workflow '%s' with %d steps (run=%s)",
        workflow_name,
        total_steps,
        run_id,
    )

    for i, dept_key in enumerate(chain):
        dept_config = config.DEPARTMENTS[dept_key]
        dept_name = dept_config["name"]
        is_final = (i == total_steps - 1) and dept_key == "command_center"

        logger.info(
            "[Step %d/%d] Calling department: %s%s",
            i + 1,
            total_steps,
            dept_name,
            " (FINAL)" if is_final else "",
        )
        print(f"\n{'='*60}")
        print(f"  Step {i+1}/{total_steps}: {dept_name}{'  [FINAL INTEGRATION]' if is_final else ''}")
        print(f"{'='*60}\n")

        system_prompt = build_system_prompt(dept_key, is_final=is_final)
        user_message = build_user_message(
            user_input=user_input,
            workflow_name=workflow_name,
            department_key=dept_key,
            step_index=i,
            total_steps=total_steps,
            prior_outputs=prior_outputs,
            is_final=is_final,
        )

        try:
            response = call_department(
                system_prompt=system_prompt,
                user_message=user_message,
            )
        except Exception as e:
            logger.error("Department %s failed: %s", dept_name, e)
            response = (
                f"## Department\n{dept_name}\n\n"
                f"## Error\nThis department encountered an error: {e}\n\n"
                f"## Recommended Next Step\nRetry this step or proceed with available outputs."
            )

        output_record = {
            "step": i + 1,
            "department_key": dept_key,
            "department_name": dept_name,
            "is_final": is_final,
            "content": response,
            "timestamp": datetime.now().isoformat(),
        }
        all_outputs.append(output_record)
        prior_outputs.append(output_record)

        step_file = os.path.join(run_dir, f"step_{i+1:02d}_{dept_key}.md")
        with open(step_file, "w", encoding="utf-8") as f:
            f.write(f"# {dept_name} \u2014 Step {i+1}/{total_steps}\n\n")
            f.write(f"**Workflow**: {workflow_name}\n")
            f.write(f"**Run ID**: {run_id}\n")
            f.write(f"**Timestamp**: {output_record['timestamp']}\n\n")
            f.write("---\n\n")
            f.write(response)
        logger.info("Saved step output to %s", step_file)

        preview = response[:500]
        if len(response) > 500:
            preview += "\n... [truncated \u2014 see full output in file]"
        print(preview)

    meta = {
        "run_id": run_id,
        "workflow_key": workflow_key,
        "workflow_name": workflow_name,
        "total_steps": total_steps,
        "chain": chain,
        "started_at": all_outputs[0]["timestamp"] if all_outputs else None,
        "completed_at": all_outputs[-1]["timestamp"] if all_outputs else None,
        "output_dir": run_dir,
    }
    meta_file = os.path.join(run_dir, "run_metadata.json")
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    if all_outputs:
        final_file = os.path.join(run_dir, "FINAL_OUTPUT.md")
        with open(final_file, "w", encoding="utf-8") as f:
            f.write(f"# {workflow_name} \u2014 Final Integrated Output\n\n")
            f.write(f"**Run ID**: {run_id}\n")
            f.write(f"**Generated**: {all_outputs[-1]['timestamp']}\n\n")
            f.write("---\n\n")
            f.write(all_outputs[-1]["content"])

    logger.info("Workflow complete. Outputs saved to %s", run_dir)
    print(f"\n{'='*60}")
    print(f"  WORKFLOW COMPLETE")
    print(f"  Outputs saved to: {run_dir}")
    print(f"{'='*60}\n")

    return {
        "meta": meta,
        "outputs": all_outputs,
        "output_dir": run_dir,
    }
