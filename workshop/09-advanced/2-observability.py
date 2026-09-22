"""Observability example — trace every model/tool call with OpenTelemetry.
Ollama primary, Bedrock fallback. Run: uv run 2-observability.py

Strands emits OTEL spans for every agent invocation, model call, and tool
call automatically — you don't instrument your own code, you just attach an
exporter. This demo uses the console exporter (prints spans to stdout, no
external service, works offline on any laptop). To ship real traces to
Langfuse instead, swap setup_console_exporter() for:

    import os
    os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://cloud.langfuse.com/api/public/otel"
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {base64_encoded_key}"
    StrandsTelemetry().setup_otlp_exporter()

Same agent code either way — only the exporter changes, same swap pattern
as model_provider.get_model().
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent, tool
from strands.telemetry import StrandsTelemetry

StrandsTelemetry().setup_console_exporter()

model = get_model()


@tool
def add(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y


agent = Agent(model=model, tools=[add], trace_attributes={"workshop.module": "09-advanced"})


if __name__ == "__main__":
    result = agent("What is 12 plus 30? Use the add tool.")
    print("---")
    print(result)
