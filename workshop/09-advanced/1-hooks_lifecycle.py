"""Hooks example — observe and control the agent loop from the outside.
Ollama primary, Bedrock fallback. Run: uv run 1-hooks_lifecycle.py

Hooks are callbacks fired at specific points in the agent loop: before/after
the whole invocation, before/after each model call, before/after each tool
call, and whenever a message is added to the conversation. They don't
replace the loop — they observe (and can influence) it from outside, which
is how timing, logging, and guardrail-style checks get bolted on without
touching the Agent's own code.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent, tool
from strands.hooks import (
    AfterModelCallEvent,
    AfterToolCallEvent,
    BeforeModelCallEvent,
    BeforeToolCallEvent,
)

model = get_model()

_timers = {}


def start_model_timer(event: BeforeModelCallEvent) -> None:
    _timers["model"] = time.perf_counter()


def report_model_duration(event: AfterModelCallEvent) -> None:
    start = _timers.get("model")
    if start is not None:
        print(f"[hook] model call took {time.perf_counter() - start:.2f}s")


def log_tool_start(event: BeforeToolCallEvent) -> None:
    print(f"[hook] tool call starting: {event.tool_use['name']}")


def log_tool_end(event: AfterToolCallEvent) -> None:
    print(f"[hook] tool call finished: {event.tool_use['name']}")


@tool
def add(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y


agent = Agent(model=model, tools=[add])
agent.add_hook(start_model_timer)
agent.add_hook(report_model_duration)
agent.add_hook(log_tool_start)
agent.add_hook(log_tool_end)


if __name__ == "__main__":
    result = agent("What is 47 plus 55? Use the add tool.")
    print(result)
