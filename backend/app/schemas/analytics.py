from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class H3HexCell(BaseModel):
    """H3 hexagonal cell data."""
    h3_index: str
    count: int
    avg_severity: float
    risk_score: float
    lat: float
    lng: float


class HeatmapResponse(BaseModel):
    """Response for heatmap data."""
    cells: List[H3HexCell]
    total_potholes: int
    city: str
    generated_at: datetime


class AnalyticsSummary(BaseModel):
    """Overall analytics summary."""
    total_potholes: int
    active_potholes: int
    resolved_potholes: int
    verified_potholes: int
    avg_severity: float
    reports_today: int
    reports_this_week: int
    reports_this_month: int
    city: str
    last_updated: datetime


class TrendDataPoint(BaseModel):
    """Single data point for trends."""
    date: str
    count: int
    avg_severity: float


class TrendData(BaseModel):
    """Time series trend data."""
    period: str  # daily, weekly, monthly
    data: List[TrendDataPoint]
    city: str


class SeverityDistribution(BaseModel):
    """Severity distribution for charts."""
    severity_1: int
    severity_2: int
    severity_3: int
    severity_4: int
    severity_5: int
