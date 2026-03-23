from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import secrets

from ..schemas import (
    UserCreate, UserLogin, Token, TokenData,
    ProfileCreate, ProfileResponse, ProfileUpdate
)
from ..database import get_db
from ..models import Profile
from ..config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory OTP storage (use Redis in production)
otp_storage = {}


def create_access_token(data: dict) -> str:
    """Create JWT access token."""
    from jose import jwt
    
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> Optional[TokenData]:
    """Verify JWT token and return data."""
    from jose import jwt, JWTError
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        phone = payload.get("phone")
        role = payload.get("role", "user")
        
        if user_id is None:
            return None
        
        return TokenData(user_id=user_id, phone=phone, role=role)
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(lambda x: x),
    db: Session = Depends(get_db)
) -> Profile:
    """Get current authenticated user."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token_data = verify_token(token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(Profile).filter(Profile.id == token_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.post("/send-otp", summary="Send OTP to phone")
async def send_otp(phone: str):
    """Send OTP to phone number for verification."""
    # Generate 6-digit OTP
    otp = secrets.token_hex(3)[:6]  # Simple OTP generation
    
    # Store OTP (use Redis in production with TTL)
    otp_storage[phone] = {
        "otp": otp,
        "expires": datetime.utcnow() + timedelta(minutes=10),
        "attempts": 0
    }
    
    # In production, integrate with SMS provider (Twilio, MSG91, etc.)
    print(f"OTP for {phone}: {otp}")  # For development
    
    return {
        "success": True,
        "message": "OTP sent successfully",
        "debug_otp": otp if settings.DEBUG else None  # Only in debug mode
    }


@router.post("/verify-otp", response_model=Token, summary="Verify OTP")
async def verify_otp(phone: str, otp: str, db: Session = Depends(get_db)):
    """Verify OTP and return access token."""
    stored = otp_storage.get(phone)
    
    if not stored:
        raise HTTPException(status_code=400, detail="OTP not sent or expired")
    
    if datetime.utcnow() > stored["expires"]:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if stored["attempts"] >= 3:
        raise HTTPException(status_code=400, detail="Too many attempts")
    
    if stored["otp"] != otp:
        stored["attempts"] += 1
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Clear OTP after successful verification
    del otp_storage[phone]
    
    # Find or create user
    user = db.query(Profile).filter(Profile.phone == phone).first()
    
    if not user:
        # Create new user
        user = Profile(phone=phone, role="user")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Create token
    access_token = create_access_token({
        "sub": str(user.id),
        "phone": user.phone,
        "role": user.role
    })
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=ProfileResponse.model_validate(user)
    )


@router.post("/refresh", response_model=Token, summary="Refresh token")
async def refresh_token(current_user: Profile = Depends(get_current_user)):
    """Refresh access token."""
    access_token = create_access_token({
        "sub": str(current_user.id),
        "phone": current_user.phone,
        "role": current_user.role
    })
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=ProfileResponse.model_validate(current_user)
    )


@router.get("/me", response_model=ProfileResponse, summary="Get current user")
async def get_me(current_user: Profile = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return ProfileResponse.model_validate(current_user)


@router.patch("/me", response_model=ProfileResponse, summary="Update profile")
async def update_me(
    update: ProfileUpdate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    update_data = update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return ProfileResponse.model_validate(current_user)
