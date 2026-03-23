from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = None
SessionLocal = None
Base = declarative_base()


def get_database_url():
    """Get database URL from Supabase or environment."""
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        return f"postgresql://postgres:{settings.SUPABASE_SERVICE_KEY}@{settings.SUPABASE_URL.split('//')[1]}:5432/postgres"
    return "sqlite:///safaroad.db"  # Fallback to SQLite for local dev


def init_db():
    """Initialize database connection."""
    global engine, SessionLocal
    
    database_url = get_database_url()
    
    if database_url.startswith("postgresql"):
        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
    else:
        engine = create_engine(database_url, connect_args={"check_same_thread": False})
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    
    return engine


def get_db():
    """Get database session."""
    if SessionLocal is None:
        init_db()
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Supabase client for direct queries
def get_supabase_client():
    """Get Supabase client if configured."""
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        from supabase import create_client
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return None
