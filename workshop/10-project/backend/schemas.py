"""Pydantic request/response models for the finance swarm portal API."""

from typing import Literal

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str


class AnalyzeRequest(BaseModel):
    ticker: str


class AnalyzeResponse(BaseModel):
    job_id: str


class ProgressEvent(BaseModel):
    agent: str
    status: Literal["started", "tool_call", "completed", "error"]
    detail: str = ""


class ReportSections(BaseModel):
    company_overview: str
    stock_price_analysis: str
    financial_health: str
    market_sentiment: str
    integrated_insights: str


class ReportResponse(BaseModel):
    ticker: str
    status: Literal["running", "completed", "error"]
    sections: ReportSections | None = None
    error: str | None = None
