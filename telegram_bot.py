"""
Founder Command Center - Telegram Bot
Lightweight Telegram interface for submitting tasks to the FCC backend.

Usage:
    TELEGRAM_BOT_TOKEN=<token> python3 telegram_bot.py
Environment variables:
    TELEGRAM_BOT_TOKEN - Required. Bot token from @BotFather.
    FCC_BACKEND_URL    - Optional. Defaults to https://web-production-82e2.up.railway.app
"""

import os
import sys
import logging
import asyncio
from typing import Dict, List, Optional

import httpx
from telegram import Update, BotCommand
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from telegram.constants import ParseMode

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
FCC_BACKEND_URL = os.getenv("FCC_BACKEND_URL", "https://web-production-82e2.up.railway.app").rstrip("/")

POLL_INTERVAL_SEC = 30
POLL_TIMEOUT_SEC = 20 * 60  # 20 minutes
TELEGRAM_MSG_LIMIT = 4000   # Telegram max ~4096; leave margin

# Per-chat last task tracking: {chat_id: task_id}
_chat_tasks: Dict[int, str] = {}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("fcc.telegram")
logging.getLogger("httpx").setLevel(logging.WARNING)

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

_http_client: Optional[httpx.AsyncClient] = None


def _get_http() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


async def _submit_task(title: str, task_type: str = "auto") -> dict:
    """POST /api/tasks/run and return the JSON response."""
    client = _get_http()
    payload = {"title": title, "task_type": task_type}
    resp = await client.post(f"{FCC_BACKEND_URL}/api/tasks/run", json=payload)
    resp.raise_for_status()
    return resp.json()


async def _get_status(task_id: str) -> dict:
    """GET /api/tasks/{task_id}/status"""
    client = _get_http()
    resp = await client.get(f"{FCC_BACKEND_URL}/api/tasks/{task_id}/status")
    resp.raise_for_status()
    return resp.json()


async def _get_output(task_id: str) -> dict:
    """GET /api/tasks/{task_id}/output"""
    client = _get_http()
    resp = await client.get(f"{FCC_BACKEND_URL}/api/tasks/{task_id}/output")
    resp.raise_for_status()
    return resp.json()

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def _escape_md(text: str) -> str:
    """Minimal escaping for Telegram MarkdownV2 — escape all special chars."""
    special = r"_*[]()~`>#+-=|{}.!"
    out = []
    for ch in text:
        if ch in special:
            out.append("\\")
        out.append(ch)
    return "".join(out)


def _split_text(text: str, limit: int = TELEGRAM_MSG_LIMIT) -> List[str]:
    """Split long text into chunks of at most *limit* characters."""
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        if len(text) <= limit:
            chunks.append(text)
            break
        # Try to break at a newline
        idx = text.rfind("\n", 0, limit)
        if idx == -1:
            idx = limit
        chunks.append(text[:idx])
        text = text[idx:].lstrip("\n")
    return chunks


def _format_steps(steps: list) -> str:
    """Format department step list for display."""
    icons = {"completed": "✅", "running": "⏳", "pending": "⬜", "failed": "❌"}
    lines = []
    for i, s in enumerate(steps, 1):
        dept = s.get("department", "Unknown")
        st = s.get("status", "pending")
        icon = icons.get(st, "⬜")
        dur = s.get("duration")
        dur_str = f" ({dur}s)" if dur else ""
        lines.append(f"  {i}. {icon} {dept}{dur_str}")
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Polling logic
# ---------------------------------------------------------------------------


async def _poll_and_deliver(chat_id: int, task_id: str, workflow: str, context: ContextTypes.DEFAULT_TYPE):
    """Background coroutine: poll task status and deliver result when done."""
    elapsed = 0
    last_step_msg = ""

    while elapsed < POLL_TIMEOUT_SEC:
        await asyncio.sleep(POLL_INTERVAL_SEC)
        elapsed += POLL_INTERVAL_SEC

        try:
            status_data = await _get_status(task_id)
        except Exception as e:
            logger.warning("Poll error for %s: %s", task_id, e)
            continue

        task_status = status_data.get("status", "unknown")

        # Send progress update if department changed
        steps = status_data.get("steps", [])
        step_msg = _format_steps(steps)
        if step_msg != last_step_msg:
            progress_text = (
                f"⏳ Task {task_id} — processing\n"
                f"Workflow: {workflow}\n\n"
                f"{step_msg}"
            )
            try:
                await context.bot.send_message(chat_id=chat_id, text=progress_text)
            except Exception:
                pass
            last_step_msg = step_msg

        # ----- Completed -----
        if task_status == "completed":
            try:
                output_data = await _get_output(task_id)
            except Exception as e:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"✅ Task {task_id} completed, but failed to retrieve output: {e}",
                )
                return

            final_output = output_data.get("final_output", "")

            # Summary message
            summary = (
                f"✅ Task completed\n\n"
                f"Task ID: {task_id}\n"
                f"Workflow: {workflow}\n"
                f"Status: completed\n\n"
                f"Final Output follows below."
            )
            await context.bot.send_message(chat_id=chat_id, text=summary)

            # Deliver Final Output in chunks
            if final_output and final_output.strip():
                chunks = _split_text(final_output)
                for i, chunk in enumerate(chunks):
                    header = f"📄 Final Output ({i + 1}/{len(chunks)}):\n\n" if len(chunks) > 1 else ""
                    await context.bot.send_message(chat_id=chat_id, text=header + chunk)
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="⚠️ Final Output is empty. The workflow completed but produced no output text. You may want to re-run the task.",
                )
            return

        # ----- Failed -----
        if task_status == "failed":
            error_msg = status_data.get("error", "Unknown error")
            fail_text = (
                f"❌ Task failed\n\n"
                f"Task ID: {task_id}\n"
                f"Workflow: {workflow}\n"
                f"Status: failed\n\n"
                f"Error: {error_msg}\n\n"
                f"Suggestions:\n"
                f"• Try re-submitting with /run or the specific workflow command\n"
                f"• Simplify the task description\n"
                f"• Check backend status at {FCC_BACKEND_URL}/api/health"
            )
            await context.bot.send_message(chat_id=chat_id, text=fail_text)
            return

    # ----- Timeout -----
    timeout_text = (
        f"⏱ Task {task_id} timed out after 20 minutes.\n\n"
        f"The task may still be processing on the backend.\n"
        f"Use /status to check the latest state."
    )
    await context.bot.send_message(chat_id=chat_id, text=timeout_text)

# ---------------------------------------------------------------------------
# Task submission helper
# ---------------------------------------------------------------------------


async def _handle_task_submission(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    task_text: str,
    task_type: str = "auto",
):
    """Submit a task to FCC, send confirmation, start polling."""
    chat_id = update.effective_chat.id

    if not task_text.strip():
        await update.message.reply_text(
            "Please provide a task description.\n\n"
            "Example: /run Create a financing deck for a B2B SaaS startup raising Series A"
        )
        return

    # Submit to backend
    try:
        result = await _submit_task(title=task_text, task_type=task_type)
    except httpx.HTTPStatusError as e:
        await update.message.reply_text(
            f"❌ Backend returned error {e.response.status_code}:\n{e.response.text[:500]}"
        )
        return
    except Exception as e:
        await update.message.reply_text(f"❌ Could not reach FCC backend:\n{e}")
        return

    task_id = result.get("task_id", "unknown")
    status = result.get("status", "queued")

    # Record for /status lookup
    _chat_tasks[chat_id] = task_id

    # Resolve display name for task_type
    type_display = task_type if task_type != "auto" else "auto-detect"

    confirmation = (
        f"📋 Task submitted\n\n"
        f"Task ID: {task_id}\n"
        f"Workflow: {type_display}\n"
        f"Status: {status}\n\n"
        f"I'll poll every 30 seconds and send results when ready.\n"
        f"Use /status to check progress anytime."
    )
    await update.message.reply_text(confirmation)

    # Start background polling
    asyncio.create_task(_poll_and_deliver(chat_id, task_id, type_display, context))

# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/start — welcome message"""
    welcome = (
        "🏛 Founder Command Center — Telegram Bot\n\n"
        "This bot is a lightweight entry point to the FCC system. "
        "Send a task and the 5-department AI workflow will process it, "
        "then deliver structured results right here.\n\n"
        "Commands:\n"
        "  /run [task] — Submit a task (auto-detect workflow)\n"
        "  /financing [task] — Force Financing Deck workflow\n"
        "  /proposal [task] — Force Proposal workflow\n"
        "  /website [task] — Force Website Strategy workflow\n"
        "  /project [task] — Force Project Definition workflow\n"
        "  /status — Check your latest task status\n\n"
        "Example:\n"
        "  /run Create a financing deck for an AI-powered legal tech startup raising $3M seed round\n\n"
        f"Backend: {FCC_BACKEND_URL}"
    )
    await update.message.reply_text(welcome)


async def cmd_run(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/run [task description] — auto-detect workflow"""
    task_text = " ".join(context.args) if context.args else ""
    await _handle_task_submission(update, context, task_text, task_type="auto")


async def cmd_financing(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/financing [task description] — force financing_deck workflow"""
    task_text = " ".join(context.args) if context.args else ""
    await _handle_task_submission(update, context, task_text, task_type="financing_deck")


async def cmd_proposal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/proposal [task description] — force proposal workflow"""
    task_text = " ".join(context.args) if context.args else ""
    await _handle_task_submission(update, context, task_text, task_type="proposal")


async def cmd_website(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/website [task description] — force website_strategy workflow"""
    task_text = " ".join(context.args) if context.args else ""
    await _handle_task_submission(update, context, task_text, task_type="website_strategy")


async def cmd_project(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/project [task description] — force project_definition workflow"""
    task_text = " ".join(context.args) if context.args else ""
    await _handle_task_submission(update, context, task_text, task_type="project_definition")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/status — check status of this chat's most recent task"""
    chat_id = update.effective_chat.id
    task_id = _chat_tasks.get(chat_id)

    if not task_id:
        await update.message.reply_text(
            "No recent task found for this chat.\n"
            "Submit a task first with /run or a specific workflow command."
        )
        return

    try:
        status_data = await _get_status(task_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            await update.message.reply_text(f"Task {task_id} not found on the backend (may have expired).")
        else:
            await update.message.reply_text(f"❌ Backend error: {e.response.status_code}")
        return
    except Exception as e:
        await update.message.reply_text(f"❌ Could not reach backend: {e}")
        return

    task_status = status_data.get("status", "unknown")
    workflow = status_data.get("workflow_name", status_data.get("workflow_key", "unknown"))
    steps = status_data.get("steps", [])
    error = status_data.get("error", "")
    total_dur = status_data.get("total_duration")

    step_display = _format_steps(steps) if steps else "  (no steps yet)"

    msg = (
        f"📊 Task Status\n\n"
        f"Task ID: {task_id}\n"
        f"Workflow: {workflow}\n"
        f"Status: {task_status}\n"
    )
    if total_dur:
        msg += f"Duration: {total_dur}s\n"
    msg += f"\nDepartments:\n{step_display}"
    if error:
        msg += f"\n\nError: {error}"

    await update.message.reply_text(msg)

    # If completed, offer to fetch output
    if task_status == "completed":
        msg += "\n\nTip: The final output was already delivered. Re-run /run to start a new task."


async def handle_plain_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle plain text messages (no command) — treat as /run."""
    task_text = update.message.text.strip()
    if task_text:
        await _handle_task_submission(update, context, task_text, task_type="auto")
    else:
        await update.message.reply_text("Send a task description or use /start to see available commands.")

# ---------------------------------------------------------------------------
# Bot setup & entry point
# ---------------------------------------------------------------------------


async def post_init(application: Application):
    """Set bot commands in Telegram's menu."""
    commands = [
        BotCommand("start", "Welcome & command list"),
        BotCommand("run", "Submit task (auto-detect workflow)"),
        BotCommand("financing", "Submit as Financing Deck"),
        BotCommand("proposal", "Submit as Proposal"),
        BotCommand("website", "Submit as Website Strategy"),
        BotCommand("project", "Submit as Project Definition"),
        BotCommand("status", "Check latest task status"),
    ]
    await application.bot.set_my_commands(commands)
    logger.info("Bot commands registered with Telegram.")


def main():
    if not TELEGRAM_BOT_TOKEN:
        print("=" * 60)
        print("  ERROR: TELEGRAM_BOT_TOKEN is not set.")
        print("  Set it as an environment variable before starting the bot.")
        print("  Example: export TELEGRAM_BOT_TOKEN=123456:ABC-DEF...")
        print("=" * 60)
        sys.exit(1)

    print("=" * 60)
    print("  Founder Command Center — Telegram Bot")
    print("=" * 60)
    print(f"  Backend: {FCC_BACKEND_URL}")
    print(f"  Poll interval: {POLL_INTERVAL_SEC}s")
    print(f"  Poll timeout: {POLL_TIMEOUT_SEC // 60} min")
    print("=" * 60)

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(post_init).build()

    # Register command handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("run", cmd_run))
    app.add_handler(CommandHandler("financing", cmd_financing))
    app.add_handler(CommandHandler("proposal", cmd_proposal))
    app.add_handler(CommandHandler("website", cmd_website))
    app.add_handler(CommandHandler("project", cmd_project))
    app.add_handler(CommandHandler("status", cmd_status))

    # Plain text messages → treat as /run
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_plain_text))

    logger.info("Starting bot polling...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
