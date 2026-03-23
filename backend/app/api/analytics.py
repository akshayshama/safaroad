from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict

from ..schemas import AnalyticsSummary, TrendData, TrendDataPoint, SeverityDistribution
from ..database import get_db
from ..models import Pothole, Profile, ClaimValidation
from ..services.risk import RiskScoringService
from .auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary, summary="Get analytics summary")
async def get_summary(
    city: str = Query("Mumbai"),
    db: Session = Depends(get_db)
):
    """Get overall analytics summary."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)
    
    # Total counts
    base_query = db.query(Pothole).filter(Pothole.city == city)
    
    total = base_query.count()
    active = base_query.filter(Pothole.resolved == False).count()
    resolved = base_query.filter(Pothole.resolved == True).count()
    verified = base_query.filter(Pothole.verified == True).count()
    
    # Average severity
    avg_severity = db.query(func.avg(Pothole.severity)).filter(
        Pothole.city == city
    ).scalar() or 0
    
    # Reports counts
    reports_today = base_query.filter(Pothole.reported_at >= today_start).count()
    reports_week = base_query.filter(Pothole.reported_at >= week_start).count()
    reports_month = base_query.filter(Pothole.reported_at >= month_start).count()
    
    return AnalyticsSummary(
        total_potholes=total,
        active_potholes=active,
        resolved_potholes=resolved,
        verified_potholes=verified,
        avg_severity=round(float(avg_severity), 2),
        reports_today=reports_today,
        reports_this_week=reports_week,
        reports_this_month=reports_month,
        city=city,
        last_updated=now
    )


@router.get("/trends", response_model=TrendData, summary="Get trend data")
async def get_trends(
    period: str = Query("daily", regex="^(daily|weekly|monthly)$"),
    days: int = Query(30, ge=7, le=365),
    city: str = Query("Mumbai"),
    db: Session = Depends(get_db)
):
    """Get time-series trend data."""
    since = datetime.utcnow() - timedelta(days=days)
    
    if period == "daily":
        # Group by day
        date_format = "%Y-%m-%d"
        group_by = func.date(Pothole.reported_at)
    elif period == "weekly":
        # Group by week
        date_format = "%Y-W%V"
        group_by = func.date_trunc('week', Pothole.reported_at)
    else:
        # Group by month
        date_format = "%Y-%m"
        group_by = func.date_trunc('month', Pothole.reported_at)
    
    results = db.query(
        group_by.label('date'),
        func.count(Pothole.id).label('count'),
        func.avg(Pothole.severity).label('avg_severity')
    ).filter(
        Pothole.city == city,
        Pothole.reported_at >= since
    ).group_by(group_by).order_by(group_by).all()
    
    data = []
    for r in results:
        date_str = r.date.strftime(date_format) if hasattr(r.date, 'strftime') else str(r.date)
        data.append(TrendDataPoint(
            date=date_str,
            count=r.count,
            avg_severity=round(float(r.avg_severity or 0), 2)
        ))
    
    return TrendData(
        period=period,
        data=data,
        city=city
    )


@router.get("/severity-distribution", response_model=SeverityDistribution, summary="Get severity distribution")
async def get_severity_distribution(
    city: str = Query("Mumbai"),
    db: Session = Depends(get_db)
):
    """Get distribution of potholes by severity."""
    base_query = db.query(
        Pothole.severity,
        func.count(Pothole.id).label('count')
    ).filter(Pothole.city == city).group_by(Pothole.severity)
    
    results = {i: 0 for i in range(1, 6)}
    
    for r in base_query.all():
        results[r.severity] = r.count
    
    return SeverityDistribution(
        severity_1=results[1],
        severity_2=results[2],
        severity_3=results[3],
        severity_4=results[4],
        severity_5=results[5]
    )


@router.get("/top-roads", summary="Get roads with most potholes")
async def get_top_roads(
    limit: int = Query(10, ge=1, le=50),
    city: str = Query("Mumbai"),
    db: Session = Depends(get_db)
):
    """Get roads with the most potholes."""
    results = db.query(
        Pothole.road_name,
        func.count(Pothole.id).label('count'),
        func.avg(Pothole.severity).label('avg_severity'),
        func.max(Pothole.severity).label('max_severity')
    ).filter(
        Pothole.city == city,
        Pothole.road_name.isnot(None),
        Pothole.resolved == False
    ).group_by(Pothole.road_name).order_by(desc('count')).limit(limit).all()
    
    roads = []
    for r in results:
        avg_risk = RiskScoringService.calculate_risk_score(
            severity=int(r.avg_severity or 3)
        )
        
        roads.append({
            "road_name": r.road_name,
            "pothole_count": r.count,
            "avg_severity": round(float(r.avg_severity or 0), 2),
            "max_severity": r.max_severity,
            "risk_score": avg_risk
        })
    
    return {"roads": roads, "city": city}


@router.get("/activity-feed", summary="Get recent activity")
async def get_activity_feed(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get recent pothole reports and resolutions."""
    # Recent reports
    recent_reports = db.query(Pothole).order_by(
        desc(Pothole.reported_at)
    ).limit(limit // 2).all()
    
    # Recent resolutions
    recent_resolutions = db.query(Pothole).filter(
        Pothole.resolved == True,
        Pothole.resolved_at.isnot(None)
    ).order_by(desc(Pothole.resolved_at)).limit(limit // 2).all()
    
    activities = []
    
    for p in recent_reports:
        activities.append({
            "type": "report",
            "pothole_id": str(p.id),
            "severity": p.severity,
            "road_name": p.road_name,
            "timestamp": p.reported_at.isoformat(),
            "verified": p.verified
        })
    
    for p in recent_resolutions:
        activities.append({
            "type": "resolved",
            "pothole_id": str(p.id),
            "severity": p.severity,
            "road_name": p.road_name,
            "timestamp": p.resolved_at.isoformat() if p.resolved_at else None
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {"activities": activities[:limit]}


@router.get("/realtime-stats", summary="Get real-time statistics")
async def get_realtime_stats(db: Session = Depends(get_db)):
    """Get real-time statistics for dashboard."""
    from ..api.websocket_manager import manager
    
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Counts
    total = db.query(Pothole).count()
    active = db.query(Pothole).filter(Pothole.resolved == False).count()
    today = db.query(Pothole).filter(Pothole.reported_at >= today_start).count()
    
    # Recent reports (last hour)
    hour_ago = now - timedelta(hours=1)
    last_hour = db.query(Pothole).filter(Pothole.reported_at >= hour_ago).count()
    
    return {
        "total_potholes": total,
        "active_potholes": active,
        "reported_today": today,
        "reported_last_hour": last_hour,
        "websocket_connections": manager.get_stats()["total_connections"],
        "timestamp": now.isoformat()
    }
