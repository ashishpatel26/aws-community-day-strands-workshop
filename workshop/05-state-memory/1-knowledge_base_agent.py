"""Knowledge Base Agent example — code-defined routing: store vs retrieve.
Ollama primary, Bedrock fallback. Uses mem0 (local FAISS, same store as
2-memory_agent.py) — strands_tools.memory is deprecated upstream and its
retrieve path returns nothing usable (silent failure, not an error).
Run: uv run 1-knowledge_base_agent.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mem0 import Memory
from model_provider import OLLAMA_HOST, get_model
from strands import Agent

model = get_model()

MEM0_CONFIG = {
    "vector_store": {
        "provider": "faiss",
        "config": {"embedding_model_dims": 768, "path": "mem0_data/faiss"},
    },
    "embedder": {
        "provider": "ollama",
        "config": {"model": "nomic-embed-text", "ollama_base_url": OLLAMA_HOST, "embedding_dims": 768},
    },
    "llm": {
        "provider": "ollama",
        "config": {"model": "qwen3.5:4b", "ollama_base_url": OLLAMA_HOST},
    },
}

store = Memory.from_config(MEM0_CONFIG)

ACTION_SYSTEM_PROMPT = """Classify the user's query as exactly one word: 'store' or
'retrieve'. 'store' = user wants to save/remember information.
'retrieve' = user is asking a question. Respond with only that one word."""

ANSWER_SYSTEM_PROMPT = """Answer the user's question using ONLY the provided context.
If the context doesn't contain the answer, say you don't know."""


def determine_action(query: str) -> str:
    classifier = Agent(model=model, system_prompt=ACTION_SYSTEM_PROMPT, callback_handler=None)
    return str(classifier(f"Query: {query}")).strip().lower()


def handle_query(query: str) -> str:
    action = determine_action(query)
    if "store" in action:
        store.add(query, user_id="demo")
        return "Stored."

    results = store.search(query, user_id="demo", limit=5)
    retrieved = "\n".join(r["memory"] for r in results.get("results", []))
    answerer = Agent(model=model, system_prompt=ANSWER_SYSTEM_PROMPT, callback_handler=None)
    return str(answerer(f"Context:\n{retrieved}\n\nQuestion: {query}"))


if __name__ == "__main__":
    print(handle_query("Remember that our office is closed on Fridays."))
    print(handle_query("When is the office closed?"))
