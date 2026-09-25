"""Multi-Agent example (Teacher's Assistant) — orchestrator routes to specialist
sub-agents wrapped as tools. Ollama primary, Bedrock fallback for every agent.
Run: uv run 2-teachers_assistant.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent, tool
from strands.vended_tools import http_request
from strands_tools import calculator, editor, file_read, file_write

# NOTE: strands_tools.shell / python_repl import POSIX-only `pty`/`fcntl`,
# unavailable on Windows. Dropped from computer_science_assistant below.

model = get_model()


@tool
def math_assistant(query: str) -> str:
    """Solve math problems, showing steps."""
    agent = Agent(
        model=model,
        system_prompt="You are a math tutor. Solve problems step by step.",
        tools=[calculator],
    )
    return str(agent(query))


@tool
def computer_science_assistant(query: str) -> str:
    """Answer CS/programming questions, can run code."""
    agent = Agent(
        model=model,
        system_prompt="You are a CS tutor. Explain concepts clearly with examples.",
        tools=[editor, file_read, file_write],
    )
    return str(agent(query))


@tool
def language_assistant(query: str) -> str:
    """Handle translation / language questions."""
    agent = Agent(
        model=model,
        system_prompt="You are a language tutor and translator.",
        tools=[http_request],
    )
    return str(agent(query))


@tool
def general_assistant(query: str) -> str:
    """Fallback for anything else."""
    agent = Agent(model=model, system_prompt="You are a helpful general-purpose tutor.")
    return str(agent(query))


TEACHER_SYSTEM_PROMPT = """You are a Teacher's Assistant. Route each query to the
single most relevant tool (math_assistant, computer_science_assistant,
language_assistant, general_assistant) and return its answer."""

teacher_agent = Agent(
    model=model,
    system_prompt=TEACHER_SYSTEM_PROMPT,
    callback_handler=None,
    tools=[math_assistant, language_assistant, computer_science_assistant, general_assistant],
)


if __name__ == "__main__":
    print(teacher_agent("What is the derivative of x^3 + 2x?"))
