"""Knowledge Base Agent example — code-defined routing: store vs retrieve.
Bedrock primary, Ollama fallback. Uses strands_tools.memory (local file-backed).

Note: the doc example uses the `use_llm` tool for classification/answering, but
that tool spins up its own inner Agent() with no model override (defaults to
Bedrock unconditionally, bypassing our fallback logic). Instead we reuse our
single resolved `model` directly for both steps, which is simpler and avoids
a second model config.
Run: uv run 1-knowledge_base_agent.py
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("BYPASS_TOOL_CONSENT", "true")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands_tools import memory

model = get_model()

ACTION_SYSTEM_PROMPT = """Classify the user's query as exactly one word: 'store' or
'retrieve'. 'store' = user wants to save/remember information.
'retrieve' = user is asking a question. Respond with only that one word."""

ANSWER_SYSTEM_PROMPT = """Answer the user's question using ONLY the provided context.
If the context doesn't contain the answer, say you don't know."""

agent = Agent(model=model, tools=[memory])


def determine_action(query: str) -> str:
    classifier = Agent(model=model, system_prompt=ACTION_SYSTEM_PROMPT, callback_handler=None)
    return str(classifier(f"Query: {query}")).strip().lower()


def handle_query(query: str) -> str:
    action = determine_action(query)
    if "store" in action:
        agent.tool.memory(action="store", content=query)
        return "Stored."

    retrieved = agent.tool.memory(action="retrieve", query=query, min_score=0.4, max_results=9)
    answerer = Agent(model=model, system_prompt=ANSWER_SYSTEM_PROMPT, callback_handler=None)
    return str(answerer(f"Context:\n{retrieved}\n\nQuestion: {query}"))


if __name__ == "__main__":
    print(handle_query("Remember that our office is closed on Fridays."))
    print(handle_query("When is the office closed?"))
