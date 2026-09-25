"""Structured Output example — Ollama primary, Bedrock fallback.

Agent returns a validated Pydantic object instead of raw text.
Run: uv run 1-structured_output.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from pydantic import BaseModel
from strands import Agent

model = get_model()


class PersonInfo(BaseModel):
    name: str
    age: int
    occupation: str


def main():
    agent = Agent(model=model)
    result = agent(
        "John Smith is a 30-year-old software engineer",
        structured_output_model=PersonInfo,
    )
    print(f"Name: {result.structured_output.name}")
    print(f"Age: {result.structured_output.age}")
    print(f"Job: {result.structured_output.occupation}")


if __name__ == "__main__":
    main()
