from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
import base64


class PotholeCreate(BaseModel):
    """Schema for creating a new pothole report."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    severity: int = Field(..., ge=1, le=5)
    size_sqm: Optional[float] = Field(None, ge=0, le=100)
    depth_cm: Optional[float] = Field(None, ge=0, le=100)
    confidence: float = Field(default=0.8, ge=0, le=1)
    image_base64: Optional[str] = None  # Base64 encoded image
    source: str = Field(default="mobile")
    road_name: Optional[str] = None
    city: str = Field(default="Mumbai")
    additional_data: Optional[dict] = None


class PotholeUpdate(BaseModel):
    """Schema for updating a pothole."""
    severity: Optional[int] = Field(None, ge=1, le=5)
    size_sqm: Optional[float] = None
    depth_cm: Optional[float] = None
    road_name: Optional[str] = None
    verified: Optional[bool] = None
    resolved: Optional[bool] = None


class PotholeResponse(BaseModel):
    """Schema for pothole response."""
    id: UUID
    latitude: float
    longitude: float
    severity: int
    size_sqm: Optional[float]
    depth_cm: Optional[float]
    confidence: float
    image_url: Optional[str]
    source: str
    reported_by: Optional[UUID]
    reported_at: datetime
    verified: bool
    verified_by: Optional[UUID]
    resolved: bool
    resolved_at: Optional[datetime]
    h3_index: Optional[str]
    road_name: Optional[str]
    city: str
    vote_count: int = 0
    confirm_votes: int = 0
    dispute_votes: int = 0
    
    class Config:
        from_attributes = True


class PotholeListResponse(BaseModel):
    """Paginated list of potholes."""
    items: List[PotholeResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class PotholeNearbyRequest(BaseModel):
    """Request for nearby potholes."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=5, ge=0.1, le=50)
    min_severity: int = Field(default=1, ge=1, le=5)
    include_resolved: bool = False


class PotholeVoteRequest(BaseModel):
    """Request for voting on a pothole."""
    vote: bool  # True = confirm, False = false positive
