# 04 — Model Providers

Concept-only stage, no script here.

The idea this stage teaches: `Agent` doesn't change when the model provider does. Swapping `OllamaModel` for `BedrockModel` (or any other provider Strands supports) is a one-line change — the agent loop, tools, and state logic stay identical.

This is proven live, not just described: see [`workshop/model_provider.py`](../model_provider.py) — a single `get_model()` resolver that every script in this repo imports, and [`workshop/08-production/`](../08-production/), where the Ollama→Bedrock swap actually runs.
