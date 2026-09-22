"""File Operations example — natural-language filesystem agent.
Bedrock primary, Ollama fallback. Run: uv run 1-file_operations.py
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("BYPASS_TOOL_CONSENT", "true")  # skip interactive y/n prompt (breaks under this shell)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands_tools import editor, file_read, file_write

model = get_model()

FILE_SYSTEM_PROMPT = """You are a file operations specialist. You help users read,
write, search, and modify files. Focus on providing clear information about file
operations and always confirm when files have been modified.
Key Capabilities:
1. Read files with various options (full content, line ranges, search)
2. Create and write to files
3. Edit existing files with precision
4. Report file information and statistics

Always specify the full file path in your responses for clarity."""

file_agent = Agent(
    model=model,
    system_prompt=FILE_SYSTEM_PROMPT,
    tools=[file_read, file_write, editor],
)


if __name__ == "__main__":
    file_agent("Create a new file called notes.txt with content 'Meeting notes'")
    file_agent("Read the contents of notes.txt")
