"""
Founder Command Center - Task Router
Identifies task type from user input and returns the matching workflow.
"""
import logging
import config

logger = logging.getLogger("fcc.router")


def classify_task(user_input: str) -> str | None:
    """
    Classify the user's input into one of the supported workflow types.

    Uses keyword matching with weighted scoring.
    Returns the workflow key or None if no match is found.

    Args:
        user_input: Raw user input text.

    Returns:
        Workflow key string (e.g. 'financing_deck') or None.
    """
    text = user_input.lower()
    scores: dict[str, int] = {}

    for wf_key, wf_config in config.WORKFLOWS.items():
        score = 0
        for keyword in wf_config["keywords"]:
            if keyword in text:
                # Longer keyword matches are more specific \u2192 higher weight
                score += len(keyword.split())
        if score > 0:
            scores[wf_key] = score

    if not scores:
        logger.warning("No workflow matched for input: %s", text[:100])
        return None

    best = max(scores, key=scores.get)  # type: ignore
    logger.info("Classified task as '%s' (score=%d)", best, scores[best])
    return best


def get_workflow_chain(workflow_key: str) -> list[str]:
    """
    Return the ordered department chain for a given workflow.

    Args:
        workflow_key: Key from config.WORKFLOWS.

    Returns:
        List of department keys in execution order.
    """
    wf = config.WORKFLOWS.get(workflow_key)
    if wf is None:
        raise ValueError(f"Unknown workflow: {workflow_key}")
    return list(wf["chain"])


def get_department_config(department_key: str) -> dict:
    """
    Return the config dict for a department.

    Args:
        department_key: Key from config.DEPARTMENTS.

    Returns:
        Department configuration dictionary.
    """
    dept = config.DEPARTMENTS.get(department_key)
    if dept is None:
        raise ValueError(f"Unknown department: {department_key}")
    return dict(dept)


def list_workflows() -> dict:
    """Return all available workflows with their descriptions."""
    return {
        k: {"name": v["name"], "description": v["description"]}
        for k, v in config.WORKFLOWS.items()
    }
