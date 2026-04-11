"""
Workflow: Website Strategy / Website Content Structure

Chain: Command Center \u2192 Strategy & Structuring \u2192 Narrative & Media
       \u2192 Product & Tech \u2192 Audit & Red Team \u2192 Command Center (Final)
"""
from workflows.base import execute_chain
from router import get_workflow_chain


WORKFLOW_KEY = "website_strategy"


def run(user_input: str, run_id: str | None = None) -> dict:
    """
    Execute the Website Strategy workflow.

    Args:
        user_input: Founder's raw input describing the website task.
        run_id: Optional run identifier.

    Returns:
        Workflow result dictionary.
    """
    chain = get_workflow_chain(WORKFLOW_KEY)
    return execute_chain(
        user_input=user_input,
        workflow_key=WORKFLOW_KEY,
        chain=chain,
        run_id=run_id,
    )
