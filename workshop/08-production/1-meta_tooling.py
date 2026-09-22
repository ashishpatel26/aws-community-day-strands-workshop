"""Meta Tooling example — agent writes and hot-loads its own tools at runtime.
Ollama primary, Bedrock fallback. Run: uv run 3-meta_tooling.py
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("BYPASS_TOOL_CONSENT", "true")  # skip interactive y/n prompt (breaks under this shell)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands_tools import editor, load_tool

# NOTE: strands_tools.shell imports POSIX-only `pty`/`termios`, unavailable
# on Windows. Dropped here — editor + load_tool alone cover the meta-tooling
# pattern (write tool file, hot-load it, invoke it).

model = get_model()

TOOL_BUILDER_SYSTEM_PROMPT = """You are a tool-building agent with access to two
real tools: editor and load_tool. You must actually CALL these tools — never
describe or print what a tool call would look like as text or JSON.

When asked to create a tool named <tool_name>:
1. Call the editor tool (command="create") to write tools/<tool_name>.py. The
   file must define a TOOL_SPEC dict (name, description, inputSchema) and a
   function <tool_name>(tool, **kwargs) that reads its argument from
   tool["input"]["<param>"] (NOT from kwargs) and returns a ToolResult dict
   with keys toolUseId, status, content.
2. Call the load_tool tool to register tools/<tool_name>.py.

Do both as actual tool calls. Do not narrate the JSON — invoke the tools."""

agent = Agent(model=model, system_prompt=TOOL_BUILDER_SYSTEM_PROMPT, tools=[load_tool, editor])

# ponytail: qwen2.5:7b is unreliable formatting multi-field JSON tool calls
# several steps into a chain, so the agent-authored tools/char_counter.py may
# come out malformed. Fall back to a known-good file so the hot-load/invoke
# half of the demo still runs deterministically. Upgrade path: drop this once
# testing a model with sturdier tool-calling (e.g. qwen2.5:14b+, llama3.1).
FALLBACK_TOOL_SOURCE = '''from typing import Any
from strands.types.tools import ToolResult, ToolUse

TOOL_SPEC = {
    "name": "char_counter",
    "description": "Counts characters in a text string.",
    "inputSchema": {
        "json": {
            "type": "object",
            "properties": {"text": {"type": "string", "description": "Text to count."}},
            "required": ["text"],
        }
    },
}


def char_counter(tool: ToolUse, **kwargs: Any) -> ToolResult:
    text = tool["input"]["text"]
    return {
        "toolUseId": tool["toolUseId"],
        "status": "success",
        "content": [{"text": f"Character count: {len(text)}"}],
    }
'''


if __name__ == "__main__":
    result = agent(
        "Create a tool called char_counter that counts characters in a text "
        "string, then load it."
    )
    print(result)

    tool_path = "tools/char_counter.py"
    valid = False
    if os.path.exists(tool_path):
        with open(tool_path) as f:
            valid = "text" in f.read()
    if not valid:
        os.makedirs("tools", exist_ok=True)
        with open(tool_path, "w") as f:
            f.write(FALLBACK_TOOL_SOURCE)
        agent.tool.load_tool(path=tool_path, name="char_counter")

    direct = agent.tool.char_counter(text="hello world")
    print(direct)
