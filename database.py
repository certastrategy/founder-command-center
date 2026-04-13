import sqlite3
import json
import os
import threading
from typing import Optional, List, Dict, Any

import config

# Database path relative to project root
DB_PATH = os.path.join(config.BASE_DIR, "data", "fcc.db")

# Thread-safe connection with a lock
_db_lock = threading.RLock()
_db_connection: Optional[sqlite3.Connection] = None


def _get_connection() -> sqlite3.Connection:
    """Get or create the database connection (thread-safe)."""
    global _db_connection
    if _db_connection is None:
        # check_same_thread=False for FastAPI which uses threads
        _db_connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        # Return rows as dictionaries
        _db_connection.row_factory = sqlite3.Row
    return _db_connection


def init_db() -> None:
    """Initialize database: create data/ directory and tables if they don't exist."""
    with _db_lock:
        # Create data directory if it doesn't exist
        data_dir = os.path.dirname(DB_PATH)
        if not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)

        conn = _get_connection()
        cursor = conn.cursor()

        # Create tasks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                task_type TEXT DEFAULT 'auto',
                workflow_key TEXT DEFAULT '',
                workflow_name TEXT DEFAULT '',
                status TEXT DEFAULT 'queued',
                created_at TEXT,
                completed_at TEXT,
                total_duration REAL,
                final_output TEXT DEFAULT '',
                step_outputs TEXT DEFAULT '[]',
                chain TEXT DEFAULT '[]',
                error TEXT,
                archived INTEGER DEFAULT 0,
                input_data TEXT DEFAULT '{}'
            )
        """)

        conn.commit()


def save_task(task: Dict[str, Any]) -> None:
    """
    Insert or replace a task record.
    Converts step_outputs, chain, input_data from Python objects to JSON strings.
    """
    with _db_lock:
        conn = _get_connection()
        cursor = conn.cursor()

        # Prepare data with JSON serialization
        task_data = task.copy()
        if 'step_outputs' in task_data and not isinstance(task_data['step_outputs'], str):
            task_data['step_outputs'] = json.dumps(task_data['step_outputs'])
        if 'chain' in task_data and not isinstance(task_data['chain'], str):
            task_data['chain'] = json.dumps(task_data['chain'])
        if 'input_data' in task_data and not isinstance(task_data['input_data'], str):
            task_data['input_data'] = json.dumps(task_data['input_data'])

        # Build INSERT OR REPLACE query
        columns = ', '.join(task_data.keys())
        placeholders = ', '.join(['?' for _ in task_data.keys()])
        query = f"INSERT OR REPLACE INTO tasks ({columns}) VALUES ({placeholders})"

        values = tuple(task_data.values())
        cursor.execute(query, values)
        conn.commit()


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single task by task_id.
    Parses JSON fields back to Python objects.
    """
    with _db_lock:
        conn = _get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM tasks WHERE task_id = ?", (task_id,))
        row = cursor.fetchone()

        if row is None:
            return None

        # Convert sqlite3.Row to dict and parse JSON fields
        task = dict(row)
        if task.get('step_outputs'):
            task['step_outputs'] = json.loads(task['step_outputs'])
        if task.get('chain'):
            task['chain'] = json.loads(task['chain'])
        if task.get('input_data'):
            task['input_data'] = json.loads(task['input_data'])

        return task


def update_task(task_id: str, **fields) -> None:
    """
    Update specific fields of a task.
    Handles JSON serialization for step_outputs, chain, input_data if present.
    """
    with _db_lock:
        conn = _get_connection()
        cursor = conn.cursor()

        # Prepare data with JSON serialization
        update_data = fields.copy()
        if 'step_outputs' in update_data and not isinstance(update_data['step_outputs'], str):
            update_data['step_outputs'] = json.dumps(update_data['step_outputs'])
        if 'chain' in update_data and not isinstance(update_data['chain'], str):
            update_data['chain'] = json.dumps(update_data['chain'])
        if 'input_data' in update_data and not isinstance(update_data['input_data'], str):
            update_data['input_data'] = json.dumps(update_data['input_data'])

        # Build UPDATE query
        set_clause = ', '.join([f"{key} = ?" for key in update_data.keys()])
        values = list(update_data.values()) + [task_id]
        query = f"UPDATE tasks SET {set_clause} WHERE task_id = ?"

        cursor.execute(query, values)
        conn.commit()


def get_all_tasks(include_archived: bool = False) -> List[Dict[str, Any]]:
    """
    Return all tasks ordered by created_at DESC.
    If include_archived is False, filter out archived=1.
    Parses JSON fields back to Python objects.
    """
    with _db_lock:
        conn = _get_connection()
        cursor = conn.cursor()

        if include_archived:
            cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        else:
            cursor.execute("SELECT * FROM tasks WHERE archived = 0 ORDER BY created_at DESC")

        rows = cursor.fetchall()

        tasks = []
        for row in rows:
            task = dict(row)
            if task.get('step_outputs'):
                task['step_outputs'] = json.loads(task['step_outputs'])
            if task.get('chain'):
                task['chain'] = json.loads(task['chain'])
            if task.get('input_data'):
                task['input_data'] = json.loads(task['input_data'])
            tasks.append(task)

        return tasks


def archive_task(task_id: str) -> bool:
    """
    Set archived=1 for a task.
    Returns True if task existed, False otherwise.
    """
    with _db_lock:
        conn = _get_connection()
        cursor = conn.cursor()

        cursor.execute("UPDATE tasks SET archived = 1 WHERE task_id = ?", (task_id,))
        conn.commit()

        return cursor.rowcount > 0


def unarchive_task(task_id: str) -> bool:
    """
    Set archived=0 for a task.
    Returns True if task existed, False otherwise.
    """
    with _db_lock:
        conn = _get_connection()
        cursor = conn.cursor()

        cursor.execute("UPDATE tasks SET archived = 0 WHERE task_id = ?", (task_id,))
        conn.commit()

        return cursor.rowcount > 0


# Initialize database at module import time
init_db()
