"""Tests for the pure data-shaping helpers in tools.py. No yfinance network
calls, no live agent calls — hand-built dicts simulate yf.Ticker(...).info.
Run: uv run pytest workshop/10-project/backend/test_tools.py -v
"""

from tools import _shape_company_info, _shape_financial_metrics, _shape_price_snapshot


def test_shape_price_snapshot_maps_known_fields():
    raw = {
        "symbol": "AAPL",
        "currentPrice": 189.5,
        "regularMarketChangePercent": 1.2,
        "fiftyTwoWeekHigh": 199.0,
        "fiftyTwoWeekLow": 150.0,
        "volume": 50_000_000,
    }
    shaped = _shape_price_snapshot(raw)
    assert shaped["ticker"] == "AAPL"
    assert shaped["current_price"] == 189.5
    assert shaped["fifty_two_week_high"] == 199.0
    assert shaped["volume"] == 50_000_000


def test_shape_price_snapshot_missing_fields_default_to_none():
    shaped = _shape_price_snapshot({})
    assert shaped["ticker"] == "?"
    assert shaped["current_price"] is None


def test_shape_company_info_prefers_long_name():
    raw = {"longName": "Apple Inc.", "shortName": "Apple", "sector": "Technology"}
    shaped = _shape_company_info(raw)
    assert shaped["name"] == "Apple Inc."
    assert shaped["sector"] == "Technology"


def test_shape_company_info_falls_back_to_short_name():
    raw = {"shortName": "Apple"}
    shaped = _shape_company_info(raw)
    assert shaped["name"] == "Apple"
    assert shaped["sector"] == "Unknown"


def test_shape_financial_metrics_maps_known_fields():
    raw = {
        "marketCap": 3_000_000_000_000,
        "trailingPE": 30.5,
        "totalRevenue": 400_000_000_000,
        "profitMargins": 0.25,
    }
    shaped = _shape_financial_metrics(raw)
    assert shaped["market_cap"] == 3_000_000_000_000
    assert shaped["pe_ratio"] == 30.5
    assert shaped["profit_margin"] == 0.25
