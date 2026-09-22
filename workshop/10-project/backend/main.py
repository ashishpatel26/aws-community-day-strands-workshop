"""FastAPI backend for the finance research swarm portal.

Run from the repo root (shared .venv):
    uv run uvicorn --app-dir workshop/10-project/backend main:app --reload --port 8000
"""

import asyncio
import uuid
from contextlib import asynccontextmanager

from agents import model, run_research
from auth import check_credentials
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from progress import broadcast_loop, emit, register, set_loop, unregister
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    LoginRequest,
    LoginResponse,
    ReportResponse,
)

from tools import _shape_price_snapshot, get_price_history


@asynccontextmanager
async def lifespan(app: FastAPI):
    set_loop(asyncio.get_running_loop())
    try:
        yield
    finally:
        # Reload/shutdown must also cancel background inference and release slots.
        pending = list(_tasks)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)


app = FastAPI(title="Finance Research Swarm Portal", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_jobs: dict[str, ReportResponse] = {}
_ticker_index: dict[str, str] = {}  # ticker -> most recent completed job_id
_tasks: set[asyncio.Task] = set()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model": type(model).__name__, "workflow": "parallel-research"}


@app.post("/api/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    # DEMO AUTH ONLY — see auth.py docstring. Not a real authentication system.
    token = check_credentials(req.username, req.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid demo credentials.")
    return LoginResponse(token=token)


async def _run_swarm_job(job_id: str, ticker: str) -> None:
    try:
        sections = await run_research(job_id, ticker)
        _jobs[job_id] = ReportResponse(ticker=ticker, status="completed", sections=sections)
        _ticker_index[ticker] = job_id
        emit(job_id, "orchestrator", "completed", "Report ready.")
    except TimeoutError:
        detail = "Research timed out. The model server may be busy; please try again."
        _jobs[job_id] = ReportResponse(ticker=ticker, status="error", error=detail)
        emit(job_id, "orchestrator", "error", detail)
    except asyncio.CancelledError:
        detail = "Research was interrupted. Please start the analysis again."
        _jobs[job_id] = ReportResponse(ticker=ticker, status="error", error=detail)
        emit(job_id, "orchestrator", "error", detail)
        raise
    except Exception as e:
        _jobs[job_id] = ReportResponse(ticker=ticker, status="error", error=str(e))
        emit(job_id, "orchestrator", "error", str(e))


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    job_id = str(uuid.uuid4())
    ticker = req.ticker.strip().upper()
    # Publish before scheduling so the first poll cannot race an unknown job_id.
    _jobs[job_id] = ReportResponse(ticker=ticker, status="running")
    task = asyncio.create_task(_run_swarm_job(job_id, ticker))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return AnalyzeResponse(job_id=job_id)


@app.get("/api/report/{job_id}", response_model=ReportResponse)
def report(job_id: str) -> ReportResponse:
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Unknown job_id.")
    return _jobs[job_id]


@app.get("/api/history/{ticker}")
def history(ticker: str) -> dict:
    return get_price_history(ticker.upper())


@app.get("/api/searches")
def searches() -> dict:
    """Recently analyzed tickers, most-recent job per ticker — lets the
    frontend history sidebar reload a completed report without re-running
    the swarm."""
    return {"tickers": [{"ticker": t, "job_id": j} for t, j in _ticker_index.items()]}


@app.get("/api/quote/{ticker}")
def quote(ticker: str) -> dict:
    """Fast price snapshot, bypassing the agent/swarm entirely — for the
    watchlist's auto-refresh tiles, which shouldn't wait on a multi-minute
    swarm run just to show a current price."""
    import yfinance as yf

    try:
        info = yf.Ticker(ticker.upper()).info
        if not info or (
            info.get("regularMarketPrice") is None and info.get("currentPrice") is None
        ):
            raise HTTPException(status_code=404, detail=f"No data for '{ticker}'.")
        return _shape_price_snapshot(info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.websocket("/ws/progress/{job_id}")
async def ws_progress(websocket: WebSocket, job_id: str) -> None:
    await register(job_id, websocket)
    try:
        await broadcast_loop(job_id, websocket)
    except WebSocketDisconnect:
        pass
    finally:
        unregister(job_id, websocket)
