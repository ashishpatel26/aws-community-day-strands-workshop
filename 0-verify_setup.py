"""Pre-workshop setup check. Run: uv run 0-verify_setup.py

Confirms strands imports, a model is reachable (Ollama, falling back to
Bedrock), and a trivial agent call round-trips — catches environment
problems before minute 1 of the workshop instead of mid-demo.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "workshop"))

try:
    from strands import Agent
except ImportError as e:
    print(f"FAIL: could not import strands ({e}). Run `uv sync` first.")
    sys.exit(1)

from model_provider import get_model

print("Checking model reachability (Ollama first, Bedrock fallback)...")
model = get_model()
print(f"Using: {type(model).__name__}")

print("Running a trivial agent call...")
agent = Agent(model=model, callback_handler=None)
result = str(agent("Say OK and nothing else."))

if "ok" in result.lower():
    print(f"OK — agent responded: {result.strip()!r}")
else:
    print(f"WARNING: agent responded but not with 'OK': {result.strip()!r}")
    print("Model is reachable, but check it's the one you expect.")
