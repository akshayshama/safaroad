from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserCreate(BaseModel):
    """Schema for user registration."""
    phone: str = Field(..., min_length=10, max_length=15)
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login."""
    phone: str


class Token(BaseModel):
    """JWT Token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Optional["ProfileResponse"] = None


class TokenData(BaseModel):
    """Decoded token data."""
    user_id: Optional[UUID] = None
    phone: Optional[str] = None
    role: str = "user"


class ProfileCreate(BaseModel):
    """Schema for creating profile."""
    phone: str = Field(..., min_length=10, max_length=15)
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "user"


class ProfileResponse(BaseModel):
    """Profile response schema."""
    id: UUID
    phone: str
    email: Optional[str]
    full_name: Optional[str]
    role: str
    avatar_url: Optional[str]
    is_active: bool
    notification_enabled: bool
    alert_radius_km: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    """Schema for updating profile."""
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    notification_enabled: Optional[bool] = None
    alert_radius_km: Optional[int] = Field(None, ge=1, le=50)


# Update forward references
Token.model_rebuild()
