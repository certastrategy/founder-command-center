"""
Workflow: Project Definition Document

Chain: Command Center -> Strategy & Structuring -> Product & Tech
       -> Narrative & Media -> Audit & Red Team -> Command Center (Final)
"""
from typing import Optional
from workflows.base import execute_chain
from router import get_workflow_chain


WORKFLOW_KEY = "project_definition"


def run(user_input: str, run_id: Optional[str] = None) -> dict:
    """
    Execute the Project Definition workflow.

    Args:
        user_input: Founder's raw input describing the project.
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
