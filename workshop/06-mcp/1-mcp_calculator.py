"""MCP Calculator example — Strands agent + MCP server, Bedrock primary /
Ollama fallback model. Two halves in one file: run server first (separate
process), then client.

Terminal 1: uv run 3-mcp_calculator.py server
Terminal 2: uv run 3-mcp_calculator.py client
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def run_server():
    from mcp.server import FastMCP

    mcp = FastMCP("Calculator Server")

    @mcp.tool(description="Add two numbers together")
    def add(x: int, y: int) -> int:
        return x + y

    @mcp.tool(description="Multiply two numbers together")
    def multiply(x: int, y: int) -> int:
        return x * y

    mcp.run(transport="streamable-http")


def run_client():
    from mcp.client.streamable_http import streamablehttp_client
    from model_provider import get_model
    from strands import Agent
    from strands.tools.mcp.mcp_client import MCPClient

    model = get_model()

    def create_transport():
        return streamablehttp_client("http://localhost:8000/mcp/")

    mcp_client = MCPClient(create_transport)
    with mcp_client:
        tools = mcp_client.list_tools_sync()
        agent = Agent(model=model, tools=tools)
        response = agent("What is 125 plus 375?")
        print(response)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "client"
    run_server() if mode == "server" else run_client()
