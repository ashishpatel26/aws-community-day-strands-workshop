"""Evaluation example — score agent outputs against expected behavior.
Ollama primary, Bedrock fallback. Run: uv run 5-evaluation.py

Strands doesn't ship an eval framework — evaluation is "run the agent
against known cases, score what comes back," same as testing any other
piece of software. This is the minimum viable version: a table of cases,
a scoring function per case, a pass/fail summary. Swap the scorer for
something LLM-judged, or plug in RAGAS/a hosted eval service, once cases
outgrow what a plain Python check can score.
"""

import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent, tool

model = get_model()


@tool
def add(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y


agent = Agent(model=model, tools=[add], callback_handler=None)


@dataclass
class EvalCase:
    name: str
    prompt: str
    check: Callable[[str], bool]


def contains_any(*substrings: str) -> Callable[[str], bool]:
    return lambda output: any(s.lower() in output.lower() for s in substrings)


def contains_all(*substrings: str) -> Callable[[str], bool]:
    return lambda output: all(s.lower() in output.lower() for s in substrings)


CASES = [
    EvalCase("basic_addition", "What is 12 plus 30? Use the add tool.", contains_all("42")),
    EvalCase(
        "refuses_unknown",
        "What is the capital of Mars?",
        contains_any("don't know", "no capital", "not know", "doesn't have", "does not have"),
    ),
    EvalCase("uses_tool_not_mental_math", "What is 999 plus 1? Use the add tool.", contains_all("1000")),
]


def run_eval() -> None:
    passed = 0
    for case in CASES:
        output = str(agent(case.prompt))
        ok = case.check(output)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {case.name}")
        if not ok:
            print(f"       prompt: {case.prompt}")
            print(f"       output: {output.strip()[:200]}")
        passed += ok

    print(f"\n{passed}/{len(CASES)} cases passed")


if __name__ == "__main__":
    run_eval()
