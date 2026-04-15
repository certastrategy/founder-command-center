"""
FCC V1.1 --- FastAPI Backend
Wraps the existing FCC V1 engine (router, workflows, client) into REST endpoints.
All workflow execution uses the real engine --- no mock data.
Persists all task data to SQLite via database.py.
"""

import os
import sys
import uuid
import time
import threading
import logging
from datetime import datetime
from typing import Optional, List, Dict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to path so we can import FCC V1 modules
PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, PROJECT_ROOT)

# Ensure .env is loaded from project root regardless of working directory
from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=True)

import config
# Refresh config values after explicit dotenv load
config.ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
config.MODEL_NAME = os.getenv("FCC_MODEL", "claude-sonnet-4-20250514")
config.MAX_TOKENS = int(os.getenv("FCC_MAX_TOKENS", "4096"))
config.TEMPERATURE = float(os.getenv("FCC_TEMPERATURE", "0.4"))
from router import classify_task, get_workflow_chain
from workflows.base import load_prompt, build_system_prompt, build_user_message
from client import call_department, get_client
import database as db

logger = logging.getLogger("fcc.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("anthropic").setLevel(logging.WARNING)

app = FastAPI(title="Founder Command Center V1.1", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://rulemarkmarket.com", "https://www.rulemarkmarket.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_running: Dict[str, dict] = {}


class TaskRequest(BaseModel):
    title: str
    task_type: str = "auto"
    background: str = ""
    goal: str = ""
    constraints: str = ""
    desired_outputs: str = ""


class TaskResponse(BaseModel):
    task_id: str
    status: str


def build_input_text(req: TaskRequest) -> str:
    parts = [f"# {req.title}", ""]
    if req.background:
        parts += ["## Background", req.background, ""]
    if req.goal:
        parts += ["## Goal", req.goal, ""]
    if req.constraints:
        parts += ["## Constraints", req.constraints, ""]
    if req.desired_outputs:
        parts += ["## Desired Outputs", req.desired_outputs, ""]
    return "\n".join(parts)


def resolve_task_type(req: TaskRequest, input_text: str) -> str:
    if req.task_type and req.task_type != "auto":
        return req.task_type
    result = classify_task(input_text)
    if result is None:
        return "financing_deck"
    return result


def _task_from_db_or_running(task_id: str) -> Optional[dict]:
    if task_id in _running:
        return _running[task_id]
    return db.get_task(task_id)


def run_task_async(task_id: str, req: TaskRequest):
    task = _running[task_id]
    try:
        input_text = build_input_text(req)
        workflow_key = resolve_task_type(req, input_text)
        chain = get_workflow_chain(workflow_key)
        workflow_name = config.WORKFLOWS[workflow_key]["name"]

        task["workflow_key"] = workflow_key
        task["workflow_name"] = workflow_name
        task["chain"] = [
            {"department": config.DEPARTMENTS[d]["name"], "dept_id": d, "status": "pending"}
            for d in chain
        ]
        for i in range(len(chain) - 1, -1, -1):
            if chain[i] == "command_center" and i > 0:
                task["chain"][i]["department"] = "Command Center (Final Integration)"
                break

        task["status"] = "running"
        task["started_at"] = datetime.now().isoformat()
        db.update_task(task_id, workflow_key=workflow_key, workflow_name=workflow_name, chain=task["chain"], status="running")

        total_steps = len(chain)
        prior_outputs: List[Dict] = []
        step_outputs: List[Dict] = []

        for i, dept_id in enumerate(chain):
            dept = config.DEPARTMENTS[dept_id]
            step = task["chain"][i]
            step["status"] = "running"
            step_start = time.time()
            is_final = (i == total_steps - 1) and dept_id == "command_center"

            try:
                system_prompt = build_system_prompt(dept_id, is_final=is_final)
                user_message = build_user_message(
                    user_input=input_text, workflow_name=workflow_name,
                    department_key=dept_id, step_index=i, total_steps=total_steps,
                    prior_outputs=prior_outputs, is_final=is_final,
                )
                output_text = call_department(system_prompt=system_prompt, user_message=user_message)
                duration = round(time.time() - step_start, 1)
                step["status"] = "completed"
                step["duration"] = duration
                step["output"] = output_text
                prior_outputs.append({"step": i+1, "department_key": dept_id, "department_name": dept["name"], "is_final": is_final, "content": output_text, "timestamp": datetime.now().isoformat()})
                step_outputs.append({"department": dept["name"], "dept_id": dept_id, "output": output_text, "duration": duration, "is_final": is_final})
                logger.info("[Task %s] Step %d/%d: %s completed (%.1fs)", task_id, i+1, total_steps, dept["name"], duration)
            except Exception as e:
                duration = round(time.time() - step_start, 1)
                step["status"] = "failed"
                step["error"] = str(e)
                step["duration"] = duration
                task["status"] = "failed"
                task["error"] = f"Step {i+1} ({dept['name']}): {e}"
                task["completed_at"] = datetime.now().isoformat()
                task["step_outputs"] = step_outputs
                db.update_task(task_id, status="failed", error=task["error"], completed_at=task["completed_at"], chain=task["chain"], step_outputs=step_outputs)
                logger.error("[Task %s] Step %d failed: %s", task_id, i+1, e)
                _running.pop(task_id, None)
                return

        task["status"] = "completed"
        task["completed_at"] = datetime.now().isoformat()
        task["step_outputs"] = step_outputs
        task["final_output"] = step_outputs[-1]["output"] if step_outputs else ""
        task["total_duration"] = sum(s.get("duration", 0) for s in task["chain"])
        db.update_task(task_id, status="completed", completed_at=task["completed_at"], step_outputs=step_outputs, final_output=task["final_output"], total_duration=task["total_duration"], chain=task["chain"])
        logger.info("[Task %s] Workflow '%s' completed in %.1fs", task_id, workflow_name, task["total_duration"])
        _running.pop(task_id, None)
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        task["completed_at"] = datetime.now().isoformat()
        db.update_task(task_id, status="failed", error=str(e), completed_at=task["completed_at"])
        logger.error("[Task %s] Workflow failed: %s", task_id, e)
        _running.pop(task_id, None)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.1.0", "api_key_configured": bool(config.ANTHROPIC_API_KEY)}


@app.post("/api/tasks/run", response_model=TaskResponse)
def run_task(req: TaskRequest):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Task title is required")
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured. Set it in .env file.")
    task_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    input_data = {"title": req.title, "task_type": req.task_type, "background": req.background, "goal": req.goal, "constraints": req.constraints, "desired_outputs": req.desired_outputs}
    task = {"task_id": task_id, "title": req.title, "task_type": req.task_type, "status": "queued", "created_at": now, "chain": [], "step_outputs": [], "final_output": "", "input_data": input_data}
    _running[task_id] = task
    db.save_task(task)
    thread = threading.Thread(target=run_task_async, args=(task_id, req), daemon=True)
    thread.start()
    return TaskResponse(task_id=task_id, status="queued")


@app.get("/api/tasks/{task_id}/status")
def get_task_status(task_id: str):
    task = _task_from_db_or_running(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    chain = task.get("chain", [])
    current_step = -1
    for i, s in enumerate(chain):
        if isinstance(s, dict) and s.get("status") == "running":
            current_step = i
            break
    if current_step == -1 and task["status"] == "completed":
        current_step = len(chain) - 1
    return {"task_id": task_id, "status": task["status"], "workflow_key": task.get("workflow_key", ""), "workflow_name": task.get("workflow_name", ""), "current_step": current_step, "steps": [{"department": s["department"] if isinstance(s, dict) else str(s), "status": s.get("status", "pending") if isinstance(s, dict) else "pending", "duration": s.get("duration") if isinstance(s, dict) else None} for s in chain], "total_duration": task.get("total_duration"), "error": task.get("error")}


@app.get("/api/tasks/{task_id}/output")
def get_task_output(task_id: str):
    task = _task_from_db_or_running(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task_id": task_id, "status": task["status"], "final_output": task.get("final_output", ""), "step_outputs": task.get("step_outputs", [])}


@app.get("/api/tasks/{task_id}/trace")
def get_task_trace(task_id: str):
    task = _task_from_db_or_running(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task_id": task_id, "title": task.get("title", ""), "workflow_key": task.get("workflow_key", ""), "workflow_name": task.get("workflow_name", ""), "status": task["status"], "created_at": task.get("created_at"), "completed_at": task.get("completed_at"), "total_duration": task.get("total_duration"), "chain": task.get("chain", []), "step_outputs": task.get("step_outputs", []), "input_data": task.get("input_data", {})}


@app.get("/api/tasks/history")
def get_task_history(include_archived: bool = Query(False)):
    all_tasks = db.get_all_tasks(include_archived=include_archived)
    for tid, t in _running.items():
        if not any(dt["task_id"] == tid for dt in all_tasks):
            all_tasks.insert(0, t)
    return {"tasks": [{"task_id": t["task_id"], "title": t.get("title", ""), "task_type": t.get("task_type", ""), "workflow_key": t.get("workflow_key", ""), "workflow_name": t.get("workflow_name", ""), "status": t.get("status", "queued"), "created_at": t.get("created_at"), "completed_at": t.get("completed_at"), "total_duration": t.get("total_duration"), "archived": t.get("archived", 0), "input_data": t.get("input_data", {})} for t in all_tasks]}


@app.post("/api/tasks/{task_id}/archive")
def archive_task(task_id: str):
    if db.archive_task(task_id):
        return {"status": "archived", "task_id": task_id}
    raise HTTPException(status_code=404, detail="Task not found")


@app.post("/api/tasks/{task_id}/unarchive")
def unarchive_task(task_id: str):
    if db.unarchive_task(task_id):
        return {"status": "unarchived", "task_id": task_id}
    raise HTTPException(status_code=404, detail="Task not found")


@app.get("/api/config")
def get_config():
    return {"departments": {k: {"name": v["name"], "description": v["description"]} for k, v in config.DEPARTMENTS.items()}, "workflows": {k: {"name": v["name"], "description": v["description"], "chain": v["chain"]} for k, v in config.WORKFLOWS.items()}, "model": config.MODEL_NAME, "max_tokens": config.MAX_TOKENS, "temperature": config.TEMPERATURE, "version": "1.1.0"}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  Founder Command Center V1.1 --- API Server")
    print("=" * 60)
    print(f"  Model:       {config.MODEL_NAME}")
    print(f"  Max tokens:  {config.MAX_TOKENS}")
    print(f"  Temperature: {config.TEMPERATURE}")
    print(f"  API key:     {'configured' if config.ANTHROPIC_API_KEY else 'NOT SET'}")
    print(f"  Server:      http://localhost:8000")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
