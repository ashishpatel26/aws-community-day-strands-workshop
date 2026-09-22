"""Graph Loops example — Writer <-> QualityChecker feedback loop, then Finalizer.
Ollama primary, Bedrock fallback. Run: uv run 2-graph_loops.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands.agent.agent_result import AgentResult
from strands.multiagent import GraphBuilder
from strands.multiagent.base import MultiAgentBase, MultiAgentResult, NodeResult
from strands.types.content import ContentBlock

model = get_model()

writer = Agent(
    model=model,
    name="writer",
    system_prompt=(
        "You write short marketing blurbs (<=60 words). If given feedback, "
        "revise the previous draft to address it. Output only the blurb."
    ),
)

finalizer = Agent(
    model=model,
    name="finalizer",
    system_prompt=(
        "You receive upstream graph output that may include the original task, "
        "verdicts like APPROVED, and a marketing blurb. Find ONLY the final "
        "marketing blurb (the short promotional text, not instructions or "
        "verdicts) and output it prefixed with 'FINAL: ', nothing else."
    ),
)


class QualityChecker(MultiAgentBase):
    """Deterministic node: no LLM. Approves once text is long enough."""

    def __init__(self, min_words: int = 15):
        super().__init__()
        self.min_words = min_words

    def __call__(self, task, **kwargs) -> MultiAgentResult:
        text = task if isinstance(task, str) else str(task)
        approved = len(text.split()) >= self.min_words
        verdict = "APPROVED" if approved else "REVISE: too short, add more detail"
        result = AgentResult(
            stop_reason="end_turn",
            message={"role": "assistant", "content": [ContentBlock(text=verdict)]},
            metrics=None,
            state={},
        )
        return MultiAgentResult(
            results={"quality_checker": NodeResult(result=result)},
            status="completed" if approved else "needs_revision",
        )

    async def invoke_async(self, task, invocation_state=None, **kwargs) -> MultiAgentResult:
        return self.__call__(task, **kwargs)


def build_graph():
    checker = QualityChecker(min_words=15)
    builder = GraphBuilder()
    builder.add_node(writer, "writer")
    builder.add_node(checker, "quality_checker")
    builder.add_node(finalizer, "finalizer")

    builder.add_edge("writer", "quality_checker")
    builder.add_edge(
        "quality_checker",
        "writer",
        condition=lambda state: "REVISE" in str(state.results.get("quality_checker")),
    )
    builder.add_edge(
        "quality_checker",
        "finalizer",
        condition=lambda state: "APPROVED" in str(state.results.get("quality_checker")),
    )

    builder.set_max_node_executions(6)
    builder.set_execution_timeout(60)
    builder.reset_on_revisit(True)
    builder.set_entry_point("writer")
    return builder.build()


if __name__ == "__main__":
    graph = build_graph()
    result = graph("Write a blurb for a local Ollama-powered coding agent.")
    print(result)
