# Contributing

This is a workshop repo, not a product — contributions are welcome, especially:

- Bug fixes in demo scripts (`workshop/0N-*/`)
- Typos or broken links in the guides
- Compatibility fixes (new Ollama/Bedrock model versions, new strands-agents releases)

## Before opening a PR

```bash
uv sync
uv run ruff check .
uv run python -m pytest workshop/test_model_provider.py -v
```

Note: most demo scripts under `workshop/` need a live local Ollama model (or AWS Bedrock access) to run — they aren't covered by CI. If you're changing one, run it locally and confirm it still works before submitting.

No CLA, no heavy process — just open a PR.
