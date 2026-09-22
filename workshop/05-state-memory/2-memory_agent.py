"""Memory Agent (mem0) example — persistent memory across conversations.
Chat agent: Bedrock primary, Ollama fallback (via model_provider). mem0's
own internal LLM/embedder stay pinned to local Ollama regardless — mem0 has
no Bedrock provider wired up here, and this keeps memory storage working
offline even when the chat model itself is cloud-backed.

NOTE: strands_tools.mem0_memory (v0.8.9) is bypassed here. Its FAISS backend
hardcodes embedding_model_dims=1536/1024 depending on code path, ignoring
MEM0_EMBEDDER_MODEL, while the embedder itself and mem0's own internal
defaults use yet other dims (512/768) — three inconsistent values inside one
call chain. No single env var or monkeypatch reconciles it reliably. We
construct mem0.Memory directly instead, with an explicit config where every
dim matches nomic-embed-text's real 768-dim output.

Run: uv run 2-memory_agent.py
"""

import sys
from pathlib import Path
from typing import Any

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
        "config": {
            "model": "nomic-embed-text",
            "ollama_base_url": OLLAMA_HOST,
            "embedding_dims": 768,
        },
    },
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "qwen3.5:4b",
            "ollama_base_url": OLLAMA_HOST,
            "temperature": 0.1,
            "max_tokens": 2000,
        },
    },
}

MEMORY_SYSTEM_PROMPT = "You manage a user's personal memory store precisely and concisely."


class MemoryAssistant:
    def __init__(self, user_id: str = "demo_user"):
        self.user_id = user_id
        self.memory = Memory.from_config(MEM0_CONFIG)
        self.agent = Agent(model=model, system_prompt=MEMORY_SYSTEM_PROMPT)

    def store_memory(self, content: str) -> dict[str, Any]:
        return self.memory.add(content, user_id=self.user_id)

    def retrieve_memories(self, query: str, min_score: float = 0.3, max_results: int = 5):
        results = self.memory.search(query, user_id=self.user_id, limit=max_results)
        return [r for r in results.get("results", []) if r.get("score", 0) >= min_score]

    def process_input(self, user_input: str) -> str:
        lowered = user_input.lower()
        if lowered.startswith(("remember ", "note that ", "i want you to know ")):
            content = user_input.split(" ", 1)[1]
            self.store_memory(content)
            return "I've stored that information in my memory."

        memories = self.retrieve_memories(user_input)
        context = "\n".join(m["memory"] for m in memories) or "(nothing relevant stored)"
        answerer = Agent(
            model=model,
            system_prompt="Answer using the known info if relevant.",
            callback_handler=None,
        )
        return str(answerer(f"Known info: {context}\n\nUser: {user_input}"))


if __name__ == "__main__":
    assistant = MemoryAssistant(user_id="alex")
    print(assistant.process_input("Remember that my favorite language is Rust."))
    print(assistant.process_input("What's my favorite language?"))
