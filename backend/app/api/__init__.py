from .auth import router as auth_router
from .potholes import router as potholes_router
from .claims import router as claims_router
from .analytics import router as analytics_router
from .websocket import router as websocket_router

__all__ = [
    "auth_router",
    "potholes_router", 
    "claims_router",
    "analytics_router",
    "websocket_router"
]
