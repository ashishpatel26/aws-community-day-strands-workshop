"""A2A example — server half. Exposes a Strands agent as an HTTP service
speaking the Agent-to-Agent protocol. Ollama primary, Bedrock fallback.

Same two-terminal shape as 06-mcp/1-mcp_calculator.py: start this first,
then run 4-a2a_client.py in a second terminal. A2A differs from MCP in what
crosses the wire — MCP exposes tools to an agent, A2A exposes a whole agent
to other agents/services as a standalone deployment, each side its own
process with its own model, own tools, own lifecycle. That's the tradeoff:
heavier to stand up than an in-process agent-as-tool, but the two agents no
longer have to share a runtime, a language, or even a machine.

Run: uv run 4-a2a_server.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands.multiagent.a2a import A2AServer

model = get_model()

agent = Agent(
    model=model,
    name="calculator_agent",
    description="Answers arithmetic questions.",
    system_prompt="You answer arithmetic questions concisely, with just the number.",
)

server = A2AServer(agent=agent, host="127.0.0.1", port=9000)


if __name__ == "__main__":
    print("A2A server starting on http://127.0.0.1:9000 — run 4-a2a_client.py in another terminal.")
    server.serve()
