"""yfinance-backed tools for the finance research swarm.

Every yfinance call is wrapped in try/except so a rate-limited or delisted
ticker degrades to a tool-observed {"error": ...} the agent can narrate,
rather than an unhandled exception that kills the whole run.

The pure dict-shaping functions (_shape_price_snapshot,
_shape_financial_metrics) are factored out from the @tool-decorated
functions so they're unit-testable without hitting yfinance or a live
agent — see test_tools.py.
"""

import asyncio
from datetime import UTC, datetime

import yfinance as yf
from strands import tool


def _shape_price_snapshot(info: dict) -> dict:
    return {
        "ticker": info.get("symbol", "?"),
        "currency": info.get("currency"),
        "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "day_change_percent": info.get("regularMarketChangePercent"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        "volume": info.get("volume") or info.get("regularMarketVolume"),
    }


def _shape_company_info(info: dict) -> dict:
    return {
        "name": info.get("longName") or info.get("shortName", "?"),
        "sector": info.get("sector", "Unknown"),
        "industry": info.get("industry", "Unknown"),
        "summary": info.get("longBusinessSummary", ""),
        "employees": info.get("fullTimeEmployees"),
    }


def _shape_financial_metrics(info: dict) -> dict:
    return {
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "revenue": info.get("totalRevenue"),
        "profit_margin": info.get("profitMargins"),
        "debt_to_equity": info.get("debtToEquity"),
    }


@tool
def get_real_stock_data(ticker: str) -> dict:
    """Current price, day change, 52-week range, and volume for a ticker."""
    try:
        info = yf.Ticker(ticker).info
        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            return {"error": f"No price data found for ticker '{ticker}'."}
        return _shape_price_snapshot(info)
    except Exception as e:
        return {"error": str(e)}


@tool
def get_company_info(ticker: str) -> dict:
    """Sector, industry, and business summary for a ticker."""
    try:
        info = yf.Ticker(ticker).info
        if not info:
            return {"error": f"No company info found for ticker '{ticker}'."}
        return _shape_company_info(info)
    except Exception as e:
        return {"error": str(e)}


@tool
def get_financial_metrics(ticker: str) -> dict:
    """P/E ratio, market cap, revenue, and margin metrics for a ticker."""
    try:
        info = yf.Ticker(ticker).info
        if not info:
            return {"error": f"No financial metrics found for ticker '{ticker}'."}
        return _shape_financial_metrics(info)
    except Exception as e:
        return {"error": str(e)}


@tool
def get_stock_news(ticker: str) -> dict:
    """Recent news headlines for a ticker, via yfinance's news feed."""
    try:
        news = yf.Ticker(ticker).news or []
        # Recent yfinance versions nest the article inside `content`.
        headlines = [
            content["title"][:500]
            for item in news
            if isinstance(item, dict)
            and isinstance(content := item.get("content", item), dict)
            and isinstance(content.get("title"), str)
            and content["title"].strip()
        ][:5]
        if not headlines:
            return {"headlines": [], "note": f"No recent news found for '{ticker}'."}
        return {"headlines": headlines}
    except Exception as e:
        return {"error": str(e)}


async def get_research_snapshot(ticker: str) -> dict:
    """Fetch info once for all views, overlapping it with the news request.

    Each analysis requests current data. Blocking calls run outside the event loop.
    """

    async def fetch(call):
        try:
            return await asyncio.wait_for(asyncio.to_thread(call), timeout=20)
        except TimeoutError:
            return {"error": "The market-data request timed out."}
        except Exception as exc:
            return {"error": str(exc)}

    info, news = await asyncio.gather(
        fetch(lambda: yf.Ticker(ticker).info),
        fetch(lambda: get_stock_news(ticker)),
    )
    if not info or info.get("error"):
        raise RuntimeError(f"Company data for {ticker} is unavailable. Please retry shortly.")
    company = _shape_company_info(info)
    company["summary"] = (company["summary"] or "")[:4000]
    price = _shape_price_snapshot(info)
    if price["current_price"] is None:
        price = {"error": "No price data supplied."}
    return {
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "price": price,
        "company": company,
        "financials": _shape_financial_metrics(info),
        "news": news,
    }


def get_price_history(ticker: str, period: str = "1mo") -> dict:
    """30-day closing price history for the frontend chart. Not an agent
    tool — called directly by a FastAPI endpoint (see main.py), so no
    @tool decorator: agents never need to invoke this themselves."""
    try:
        hist = yf.Ticker(ticker).history(period=period)
        if hist.empty:
            return {"error": f"No price history found for '{ticker}'.", "points": []}
        points = [
            {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
            for idx, row in hist.iterrows()
        ]
        return {"points": points}
    except Exception as e:
        return {"error": str(e), "points": []}
