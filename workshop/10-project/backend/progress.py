"""WebSocket progress broadcasting for live swarm/agent execution.

Strands' Agent callback_handler hook — the same one model_provider.py
silences with callback_handler=None — is reused here to push
{"agent": name, "status": ...} events onto a per-job asyncio.Queue,
consumed by the WebSocket endpoint in main.py.
"""

import asyncio
from collections import defaultdict

from fastapi import WebSocket

_queues: dict[str, asyncio.Queue] = defaultdict(asyncio.Queue)
_connections: dict[str, list[WebSocket]] = defaultdict(list)

# Set once at app startup (see main.py) so emit() — called from a worker
# thread via run_in_executor, not the event loop thread — can safely hand
# off to the loop with call_soon_threadsafe instead of touching the
# asyncio.Queue directly from a foreign thread (a data race: asyncio.Queue
# has no cross-thread lock, unlike queue.Queue).
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def get_queue(job_id: str) -> asyncio.Queue:
    return _queues[job_id]


async def register(job_id: str, ws: WebSocket) -> None:
    await ws.accept()
    _connections[job_id].append(ws)


def unregister(job_id: str, ws: WebSocket) -> None:
    if ws in _connections[job_id]:
        _connections[job_id].remove(ws)


def emit(job_id: str, agent: str, status: str, detail: str = "") -> None:
    """Called from the (sync, background-thread) swarm execution to report
    progress. Hands off via call_soon_threadsafe when the loop is known
    (the normal case, set by main.py at startup) — falls back to a direct
    put_nowait only for contexts with no running loop (e.g. sync tests)."""
    event = {"agent": agent, "status": status, "detail": detail}
    if _loop is not None:
        _loop.call_soon_threadsafe(_queues[job_id].put_nowait, event)
    else:
        _queues[job_id].put_nowait(event)


async def broadcast_loop(job_id: str, ws: WebSocket) -> None:
    """Drains the job's queue and forwards events to one connected client
    until a 'completed' or 'error' event for the orchestrator closes it out."""
    queue = get_queue(job_id)
    while True:
        event = await queue.get()
        await ws.send_json(event)
        if event["agent"] == "orchestrator" and event["status"] in ("completed", "error"):
            break


def make_callback_handler(job_id: str, agent_name: str):
    """Returns a callback_handler that emits progress events for one agent."""

    def handler(**kwargs) -> None:
        if kwargs.get("current_tool_use"):
            emit(job_id, agent_name, "tool_call", kwargs["current_tool_use"].get("name", ""))

    return handler
