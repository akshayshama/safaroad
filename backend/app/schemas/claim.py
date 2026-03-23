from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ClaimValidateRequest(BaseModel):
    """Request for validating a damage claim."""
    claim_id: str = Field(..., max_length=100)
    damage_latitude: float = Field(..., ge=-90, le=90)
    damage_longitude: float = Field(..., ge=-180, le=180)
    damage_timestamp: Optional[datetime] = None
    damage_type: Optional[str] = Field(None, max_length=50)
    vehicle_info: Optional[str] = None
    insurance_company: Optional[str] = None


class NearestPotholeInfo(BaseModel):
    """Information about the nearest pothole."""
    id: UUID
    distance_meters: float
    severity: int
    reported_at: datetime
    image_url: Optional[str]
    risk_score: float


class ClaimValidateResponse(BaseModel):
    """Response for claim validation."""
    claim_id: str
    validation_result: str  # CONFIRMED, UNCONFIRMED, DISPUTED
    nearest_pothole: Optional[NearestPotholeInfo]
    risk_score: float
    confidence: float
    evidence: dict


class ClaimHistoryResponse(BaseModel):
    """Response for claim history."""
    items: List[ClaimValidateResponse]
    total: int
    page: int
    page_size: int
