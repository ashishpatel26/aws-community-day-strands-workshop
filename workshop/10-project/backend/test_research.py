"""Offline regression tests for scheduling, data reuse and report lifecycle."""

import asyncio
import importlib
import json
import sys
import threading
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

import tools

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


class Result:
    def __init__(self, text, stop_reason="end_turn"):
        self.text = text
        self.stop_reason = stop_reason

    def __str__(self):
        return self.text


def snapshot(ticker="TEST"):
    return {
        "retrieved_at": "2026-09-22T12:00:00+00:00",
        "price": {"current_price": 100, "day_change_percent": 0, "currency": "USD"},
        "company": {"name": ticker, "summary": "Fixture company"},
        "financials": {"pe_ratio": 20, "profit_margin": 0.1},
        "news": {"headlines": [f"{ticker} fixture headline"]},
    }


@pytest.fixture
def pipeline(monkeypatch):
    # Importing the app must never probe a live model in the offline suite.
    with patch("model_provider.get_model", return_value=MagicMock()):
        agents = importlib.import_module("agents")
        main = importlib.import_module("main")
    events = []
    monkeypatch.setattr(agents, "_model_slots", asyncio.Semaphore(3))
    monkeypatch.setattr(agents, "emit", lambda *event: events.append(event))
    monkeypatch.setattr(main, "emit", lambda *event: events.append(event))
    monkeypatch.setattr(main, "set_loop", lambda loop: None)
    monkeypatch.setattr(main, "_jobs", {})
    monkeypatch.setattr(main, "_tasks", set())
    monkeypatch.setattr(main, "_ticker_index", {})

    async def fetch(ticker):
        return snapshot(ticker)

    monkeypatch.setattr(agents, "get_research_snapshot", fetch)
    return SimpleNamespace(agents=agents, main=main, events=events)


def test_snapshot_fetches_company_info_once_and_overlaps_news(monkeypatch):
    barrier = threading.Barrier(2, timeout=2)
    calls = []

    class Ticker:
        def __init__(self, ticker):
            assert ticker == "TEST"

        @property
        def info(self):
            calls.append("info")
            barrier.wait()
            return {
                "symbol": "TEST",
                "longName": "Fixture",
                "currentPrice": 100,
                "trailingPE": 20,
                "longBusinessSummary": "x" * 5000,
            }

        @property
        def news(self):
            calls.append("news")
            barrier.wait()
            return [{"content": {"title": "Current headline"}}]

    monkeypatch.setattr(tools.yf, "Ticker", Ticker)
    data = asyncio.run(tools.get_research_snapshot("TEST"))
    assert sorted(calls) == ["info", "news"]
    assert data["price"]["current_price"] == 100
    assert data["company"]["name"] == "Fixture"
    assert len(data["company"]["summary"]) == 4000
    assert data["financials"]["pe_ratio"] == 20
    assert data["news"]["headlines"] == ["Current headline"]


def test_news_accepts_modern_and_legacy_records_and_skips_empty_items(monkeypatch):
    items = [
        {"content": {"title": "Modern"}},
        {"title": "Legacy"},
        {"content": None},
        {},
        None,
        {"content": {"title": ""}},
    ]
    monkeypatch.setattr(tools.yf, "Ticker", lambda _: SimpleNamespace(news=items))
    assert tools.get_stock_news("TEST")["headlines"] == ["Modern", "Legacy"]


def test_missing_core_data_fails_before_inference(monkeypatch):
    monkeypatch.setattr(tools.yf, "Ticker", lambda _: SimpleNamespace(info={}, news=[]))
    with pytest.raises(RuntimeError, match="Company data for TEST is unavailable"):
        asyncio.run(tools.get_research_snapshot("TEST"))


def test_missing_news_preserves_company_and_financial_evidence(monkeypatch):
    monkeypatch.setattr(
        tools.yf,
        "Ticker",
        lambda _: SimpleNamespace(info={"currentPrice": 100, "longBusinessSummary": None}, news=[]),
    )
    data = asyncio.run(tools.get_research_snapshot("TEST"))
    assert data["news"]["headlines"] == []
    assert "No recent news" in data["news"]["note"]
    assert data["price"]["current_price"] == 100


def test_specialists_overlap_then_lead_synthesizes_in_exactly_four_calls(pipeline, monkeypatch):
    started, completed, instances = set(), set(), []

    async def scenario():
        all_started = asyncio.Event()

        class Agent:
            def __init__(self, **kwargs):
                self.name = kwargs["name"]
                assert not kwargs.get("tools")
                instances.append(self)

            async def invoke_async(self, prompt):
                data = json.loads(prompt)
                if self.name == "orchestrator":
                    assert len(completed) == 3
                    assert set(data["sections"]) == {
                        "company_overview",
                        "financial_health",
                        "market_sentiment",
                        "stock_price_analysis",
                    }
                    return Result("Integrated perspective")
                started.add(self.name)
                if len(started) == 3:
                    all_started.set()
                # A sequential implementation deadlocks this barrier and fails.
                await asyncio.wait_for(all_started.wait(), 1)
                completed.add(self.name)
                return Result(f"**{self.name}:** {data['ticker']} findings")

        monkeypatch.setattr(pipeline.agents, "Agent", Agent)
        return await pipeline.agents.run_research("job", "TEST")

    report = asyncio.run(scenario())
    assert len(instances) == 4
    assert report.integrated_insights == "Integrated perspective"
    assert report.integrated_insights != report.market_sentiment
    assert "100.00" in report.stock_price_analysis
    assert "+0.00%" in report.stock_price_analysis
    assert "Unavailable" in report.stock_price_analysis
    assert len([e for e in pipeline.events if e[2] == "completed"]) == 3
    assert not any(e[1:3] == ("orchestrator", "completed") for e in pipeline.events)


def test_concurrent_jobs_share_limit_but_never_conversation_state(pipeline, monkeypatch):
    active, peak = 0, 0
    instances = []

    class Agent:
        def __init__(self, **kwargs):
            self.name = kwargs["name"]
            self.called = False
            instances.append(self)

        async def invoke_async(self, prompt):
            nonlocal active, peak
            assert not self.called
            self.called = True
            data = json.loads(prompt)
            active += 1
            peak = max(peak, active)
            try:
                await asyncio.sleep(0.01)
                if self.name == "orchestrator":
                    assert data["ticker"] in data["sections"]["company_overview"]
                return Result(f"{data['ticker']} {self.name}")
            finally:
                active -= 1

    monkeypatch.setattr(pipeline.agents, "Agent", Agent)

    async def scenario():
        return await asyncio.gather(
            pipeline.agents.run_research("a", "AAA"), pipeline.agents.run_research("b", "BBB")
        )

    first, second = asyncio.run(scenario())
    assert len(instances) == 8
    assert peak == 3
    assert "AAA" in first.integrated_insights and "BBB" not in first.integrated_insights
    assert "BBB" in second.integrated_insights and "AAA" not in second.integrated_insights


def test_failed_specialist_cancels_siblings_and_skips_synthesis(pipeline, monkeypatch):
    cancelled = []
    names = []

    class Agent:
        def __init__(self, **kwargs):
            self.name = kwargs["name"]
            names.append(self.name)

        async def invoke_async(self, prompt):
            await asyncio.sleep(0)
            if self.name == "financial_analyst":
                raise RuntimeError("Model offline")
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.append(self.name)
                raise

    monkeypatch.setattr(pipeline.agents, "Agent", Agent)
    with pytest.raises(RuntimeError, match="Model offline"):
        asyncio.run(pipeline.agents.run_research("job", "TEST"))
    assert set(cancelled) == {"company_strategist", "market_analyst"}
    assert "orchestrator" not in names


@pytest.mark.parametrize("text,reason", [("", "end_turn"), ("Truncated", "max_tokens")])
def test_empty_or_truncated_responses_are_not_published_as_complete(
    pipeline, monkeypatch, text, reason
):
    class Agent:
        def __init__(self, **kwargs):
            pass

        async def invoke_async(self, prompt):
            return Result(text, reason)

    monkeypatch.setattr(pipeline.agents, "Agent", Agent)
    with pytest.raises(RuntimeError, match="incomplete response"):
        asyncio.run(pipeline.agents.run_research("job", "TEST"))


def test_slow_model_has_bounded_wait_and_emits_error(pipeline, monkeypatch):
    class Agent:
        def __init__(self, **kwargs):
            pass

        async def invoke_async(self, prompt):
            await asyncio.Event().wait()

    monkeypatch.setattr(pipeline.agents, "Agent", Agent)
    monkeypatch.setattr(pipeline.agents, "AGENT_TIMEOUT", 0.01)
    with pytest.raises(TimeoutError):
        asyncio.run(pipeline.agents.run_research("job", "TEST"))
    assert any(event[2] == "error" for event in pipeline.events)


def test_api_publishes_job_before_first_poll_and_report_before_terminal_event(
    pipeline, monkeypatch
):
    async def scenario():
        release = asyncio.Event()

        async def research(job_id, ticker):
            assert ticker == "TEST"
            await release.wait()
            return pipeline.agents.ReportSections(
                **{key: key for key in pipeline.agents.ReportSections.model_fields}
            )

        def emit(job_id, agent, status, detail):
            if (agent, status) == ("orchestrator", "completed"):
                assert pipeline.main.report(job_id).status == "completed"
            pipeline.events.append((job_id, agent, status, detail))

        monkeypatch.setattr(pipeline.main, "run_research", research)
        monkeypatch.setattr(pipeline.main, "emit", emit)
        result = await pipeline.main.analyze(pipeline.main.AnalyzeRequest(ticker=" test "))
        assert pipeline.main.report(result.job_id).status == "running"
        release.set()
        await asyncio.gather(*pipeline.main._tasks)
        assert pipeline.main.report(result.job_id).sections.integrated_insights
        assert pipeline.main.searches()["tickers"] == [{"ticker": "TEST", "job_id": result.job_id}]
        assert len(pipeline.events) == 1

    asyncio.run(scenario())


@pytest.mark.parametrize("failure", [RuntimeError("Model offline"), TimeoutError()])
def test_api_failure_becomes_terminal_error(pipeline, monkeypatch, failure):
    async def research(job_id, ticker):
        raise failure

    monkeypatch.setattr(pipeline.main, "run_research", research)

    async def scenario():
        job = await pipeline.main.analyze(pipeline.main.AnalyzeRequest(ticker="TEST"))
        await asyncio.gather(*pipeline.main._tasks)
        result = pipeline.main.report(job.job_id)
        assert result.status == "error" and result.error
        assert result.sections is None
        assert pipeline.events[-1][1:3] == ("orchestrator", "error")

    asyncio.run(scenario())


def test_backend_shutdown_cancels_running_research(pipeline, monkeypatch):
    async def scenario():
        started = asyncio.Event()
        cancelled = asyncio.Event()

        async def research(job_id, ticker):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()

        monkeypatch.setattr(pipeline.main, "run_research", research)
        async with pipeline.main.lifespan(pipeline.main.app):
            job = await pipeline.main.analyze(pipeline.main.AnalyzeRequest(ticker="TEST"))
            await started.wait()
        assert cancelled.is_set()
        assert pipeline.main.report(job.job_id).status == "error"
        assert not pipeline.main._tasks

    asyncio.run(scenario())
