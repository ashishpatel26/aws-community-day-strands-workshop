"""Agents Workflows example — sequential Researcher -> Analyst -> Writer pipeline.
Ollama primary, Bedrock fallback. Run: uv run 1-agents_workflows.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands_tools import http_request

model = get_model()

researcher_agent = Agent(
    model=model,
    system_prompt=(
        "You are a Researcher Agent that gathers information from the web. "
        "1. Determine if the input is a research query or factual claim "
        "2. Use your research tools (http_request) to find relevant information "
        "3. Include source URLs and keep findings under 500 words"
    ),
    callback_handler=None,
    tools=[http_request],
)

analyst_agent = Agent(
    model=model,
    callback_handler=None,
    system_prompt=(
        "You are an Analyst Agent that verifies information. "
        "1. For factual claims: Rate accuracy from 1-5 and correct if needed "
        "2. For research queries: Identify 3-5 key insights "
        "3. Evaluate source reliability and keep analysis under 400 words"
    ),
)

writer_agent = Agent(
    model=model,
    system_prompt=(
        "You are a Writer Agent that creates clear reports. "
        "1. For fact-checks: State whether claims are true or false "
        "2. For research: Present key insights in a logical structure "
        "3. Keep reports under 500 words with brief source mentions"
    ),
)


def run_research_workflow(user_input: str) -> str:
    research_findings = str(researcher_agent(f"Research: '{user_input}'."))
    analysis = str(analyst_agent(f"Analyze these findings about '{user_input}':\n\n{research_findings}"))
    return str(writer_agent(f"Create a report on '{user_input}' based on this analysis:\n\n{analysis}"))


if __name__ == "__main__":
    print(run_research_workflow("The James Webb Space Telescope's main discoveries"))
