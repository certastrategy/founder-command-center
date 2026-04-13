"""
Founder Command Center - Anthropic API Client
Handles all communication with the Claude API via official SDK.
"""
import logging
from typing import Optional
from anthropic import Anthropic

import config

logger = logging.getLogger("fcc.client")

_client = None


def get_client() -> Anthropic:
    """Return a singleton Anthropic client instance."""
    global _client
    if _client is None:
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. "
                "Please set it in your .env file or environment variables."
            )
        _client = Anthropic(api_key=config.ANTHROPIC_API_KEY)
        logger.info("Anthropic client initialized (model=%s)", config.MODEL_NAME)
    return _client


def call_department(
    system_prompt: str,
    user_message: str,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    """
    Send a request to Claude acting as a specific department.

    Args:
        system_prompt: The department's system-level instructions.
        user_message: The assembled user message (brief + prior context).
        model: Override the default model.
        max_tokens: Override the default max tokens.
        temperature: Override the default temperature.

    Returns:
        The assistant's response text.
    """
    client = get_client()
    model = model or config.MODEL_NAME
    max_tokens = max_tokens or config.MAX_TOKENS
    temperature = temperature if temperature is not None else config.TEMPERATURE

    logger.debug(
        "API call: model=%s, max_tokens=%d, temperature=%.2f",
        model,
        max_tokens,
        temperature,
    )

    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    response_text = message.content[0].text
    logger.debug(
        "API response: %d chars, stop_reason=%s",
        len(response_text),
        message.stop_reason,
    )
    return response_text
