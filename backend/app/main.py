from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from .config import settings
from .database import init_db, get_db
from .api import (
    auth_router,
    potholes_router,
    claims_router,
    analytics_router,
    websocket_router
)
from .api.websocket_manager import manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting SafeRoad API...")
    
    # Initialize database
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"Database initialization skipped: {e}")
    
    # Initialize WebSocket manager
    try:
        await manager.start()
        logger.info("WebSocket manager started")
    except Exception as e:
        logger.warning(f"WebSocket manager initialization skipped: {e}")
    
    logger.info(f"SafeRoad API v{settings.APP_VERSION} started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down SafeRoad API...")
    await manager.stop()
    logger.info("SafeRoad API shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    SafeRoad API - Real-time pothole tracking and road safety platform.
    
    ## Features
    - **Pothole Reporting**: Submit and track pothole reports
    - **Real-time Updates**: WebSocket-based live updates
    - **Claims Validation**: Insurance claim verification
    - **Analytics**: Comprehensive road safety analytics
    
    ## Authentication
    - Phone OTP based authentication
    - JWT tokens for API access
    
    ## WebSocket Endpoints
    - `/ws/potholes` - Subscribe to pothole updates in an area
    - `/ws/alerts/{user_id}` - Personal alert notifications
    - `/ws/admin` - Admin dashboard updates
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


# Include routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(potholes_router, prefix="/api/v1")
app.include_router(claims_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(websocket_router)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to SafeRoad API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
