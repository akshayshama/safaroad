from pydantic_settings import BaseSettings
from typing import Optional
import os
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SafeRoad API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # Redis
    REDIS_URL: Optional[str] = None
    
    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Image Storage
    IMGBB_API_KEY: Optional[str] = None
    
    # ML Model Path
    MODEL_PATH: str = "./models/pothole_model.onnx"
    
    # H3 Resolution for geospatial indexing
    H3_RESOLUTION: int = 9  # ~114m radius hexagons
    
    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
