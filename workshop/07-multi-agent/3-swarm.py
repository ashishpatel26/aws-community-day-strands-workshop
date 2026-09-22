"""Swarm example — self-organizing agents that hand off to each other.
Ollama primary, Bedrock fallback. Run: uv run 3-swarm.py

Unlike Graph (explicit edges + conditions you write), a Swarm has no fixed
routing: each agent decides on its own whether to hand off, and to whom.
Loop guards (max_handoffs, execution_timeout, repetitive-handoff detection)
are what keep that freedom from turning into an infinite bounce.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands.multiagent import Swarm

model = get_model()

research_agent = Agent(
    model=model,
    name="research_agent",
    system_prompt=(
        "You are a Research Agent. Give 2-3 short factual bullet points on "
        "the topic. Then you MUST call the handoff_to_agent tool with "
        "agent_name=\"creative_agent\" — do not answer in prose only, "
        "actually invoke the tool. Never hand off to yourself."
    ),
)

creative_agent = Agent(
    model=model,
    name="creative_agent",
    system_prompt=(
        "You are a Creative Agent. Read the research so far and propose "
        "one clear, practical angle in 2-3 sentences. Then you MUST call "
        "the handoff_to_agent tool with agent_name=\"critical_agent\" — "
        "do not answer in prose only, actually invoke the tool."
    ),
)

critical_agent = Agent(
    model=model,
    name="critical_agent",
    system_prompt=(
        "You are a Critical Agent. Point out one real weakness in the "
        "proposal so far, in 1-2 sentences. Then you MUST call the "
        "handoff_to_agent tool with agent_name=\"summarizer_agent\" — do "
        "not answer in prose only, actually invoke the tool."
    ),
)

summarizer_agent = Agent(
    model=model,
    name="summarizer_agent",
    system_prompt=(
        "You are a Summarizer Agent. Combine the research, the proposal, "
        "and the critique into one short final answer (<=80 words). Do "
        "not call handoff_to_agent — this is the last step, just answer."
    ),
)

swarm = Swarm(
    [research_agent, creative_agent, critical_agent, summarizer_agent],
    max_handoffs=8,
    max_iterations=8,
    execution_timeout=420.0,
    node_timeout=150.0,
    repetitive_handoff_detection_window=6,
    repetitive_handoff_min_unique_agents=3,
)


if __name__ == "__main__":
    result = swarm("Explain Agentic AI in one short blog-post-style summary.")
    print(f"Status: {result.status}")
    for node in result.node_history:
        print(f"Agent: {node.node_id}")
    print(result)
