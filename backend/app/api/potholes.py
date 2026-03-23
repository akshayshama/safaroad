from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from ..schemas import (
    PotholeCreate, PotholeUpdate, PotholeResponse,
    PotholeListResponse, PotholeNearbyRequest, PotholeVoteRequest
)
from ..database import get_db
from ..models import Pothole, Profile, PotholeVote
from ..services.geospatial import GeospatialService
from ..services.risk import RiskScoringService
from ..services.notification import NotificationService
from ..services.image import ImageService
from ..api.websocket_manager import manager
from .auth import get_current_user, verify_token

router = APIRouter(prefix="/potholes", tags=["Potholes"])


@router.get("", response_model=PotholeListResponse, summary="List potholes")
async def list_potholes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    min_severity: int = Query(1, ge=1, le=5),
    max_severity: int = Query(5, ge=1, le=5),
    city: Optional[str] = None,
    resolved: Optional[bool] = None,
    verified: Optional[bool] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get paginated list of potholes with filters."""
    query = db.query(Pothole)
    
    # Apply filters
    query = query.filter(Pothole.severity >= min_severity)
    query = query.filter(Pothole.severity <= max_severity)
    
    if city:
        query = query.filter(Pothole.city == city)
    
    if resolved is not None:
        query = query.filter(Pothole.resolved == resolved)
    
    if verified is not None:
        query = query.filter(Pothole.verified == verified)
    
    if source:
        query = query.filter(Pothole.source == source)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    potholes = query.order_by(desc(Pothole.reported_at)).offset(offset).limit(page_size).all()
    
    # Build response with vote counts
    items = []
    for p in potholes:
        confirm_votes = db.query(PotholeVote).filter(
            PotholeVote.pothole_id == p.id,
            PotholeVote.vote == True
        ).count()
        dispute_votes = db.query(PotholeVote).filter(
            PotholeVote.pothole_id == p.id,
            PotholeVote.vote == False
        ).count()
        
        item = PotholeResponse.model_validate(p)
        item.vote_count = confirm_votes + dispute_votes
        item.confirm_votes = confirm_votes
        item.dispute_votes = dispute_votes
        items.append(item)
    
    return PotholeListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=offset + len(items) < total
    )


@router.get("/nearby", summary="Get nearby potholes")
async def get_nearby_potholes(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5, ge=0.1, le=50),
    min_severity: int = Query(1, ge=1, le=5),
    include_resolved: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get potholes within a radius of given coordinates."""
    # Get bounding box
    min_lat, max_lat, min_lng, max_lng = GeospatialService.get_bounding_box(
        latitude, longitude, radius_km
    )
    
    # Query within bounding box
    query = db.query(Pothole).filter(
        and_(
            Pothole.latitude >= min_lat,
            Pothole.latitude <= max_lat,
            Pothole.longitude >= min_lng,
            Pothole.longitude <= max_lng,
            Pothole.severity >= min_severity
        )
    )
    
    if not include_resolved:
        query = query.filter(Pothole.resolved == False)
    
    potholes = query.all()
    
    # Filter by actual distance and calculate
    results = []
    for p in potholes:
        distance = GeospatialService.calculate_distance(
            latitude, longitude, p.latitude, p.longitude
        )
        
        if distance <= radius_km * 1000:  # Convert to meters
            # Calculate risk score
            age_days = (datetime.utcnow() - p.reported_at).days
            risk_score = RiskScoringService.calculate_risk_score(
                severity=p.severity,
                size_sqm=float(p.size_sqm) if p.size_sqm else None,
                age_days=age_days,
                confirmed=p.verified
            )
            
            results.append({
                "id": str(p.id),
                "latitude": p.latitude,
                "longitude": p.longitude,
                "severity": p.severity,
                "distance_meters": round(distance, 2),
                "risk_score": risk_score,
                "image_url": p.image_url,
                "road_name": p.road_name,
                "reported_at": p.reported_at.isoformat(),
                "verified": p.verified,
                "resolved": p.resolved
            })
    
    # Sort by distance
    results.sort(key=lambda x: x["distance_meters"])
    
    return {
        "items": results,
        "total": len(results),
        "center": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km
    }


@router.get("/heatmap", summary="Get heatmap data")
async def get_heatmap(
    city: str = Query("Mumbai"),
    resolution: int = Query(9, ge=7, le=12),
    db: Session = Depends(get_db)
):
    """Get aggregated pothole data for heatmap visualization."""
    # Get all active potholes for city
    potholes = db.query(Pothole).filter(
        and_(
            Pothole.city == city,
            Pothole.resolved == False
        )
    ).all()
    
    # Aggregate by H3 cells
    h3_aggregates = {}
    
    for p in potholes:
        h3_index = p.h3_index or GeospatialService.lat_lng_to_h3(
            p.latitude, p.longitude, resolution
        )
        
        if h3_index not in h3_aggregates:
            h3_aggregates[h3_index] = {
                "count": 0,
                "total_severity": 0,
                "lat": p.latitude,
                "lng": p.longitude
            }
        
        h3_aggregates[h3_index]["count"] += 1
        h3_aggregates[h3_index]["total_severity"] += p.severity
    
    # Build response
    cells = []
    for h3_index, data in h3_aggregates.items():
        lat, lng = GeospatialService.h3_to_lat_lng(h3_index)
        
        cells.append({
            "h3_index": h3_index,
            "count": data["count"],
            "avg_severity": round(data["total_severity"] / data["count"], 2),
            "risk_score": round(
                RiskScoringService.calculate_risk_score(
                    severity=int(data["total_severity"] / data["count"]),
                    confirmed=True
                ),
                2
            ),
            "lat": lat,
            "lng": lng
        })
    
    return {
        "cells": cells,
        "total_potholes": sum(c["count"] for c in cells),
        "city": city,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.post("", response_model=PotholeResponse, summary="Report new pothole")
async def create_pothole(
    pothole: PotholeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: str = Query(None)
):
    """Report a new pothole."""
    # Validate image if provided
    image_url = None
    if pothole.image_base64:
        is_valid, processed = ImageService.validate_base64_image(pothole.image_base64)
        if not is_valid:
            raise HTTPException(status_code=400, detail=processed)
        
        # Upload to ImgBB
        image_url = await ImageService.upload_to_imgbb(processed)
    
    # Calculate H3 index
    h3_index = GeospatialService.lat_lng_to_h3(
        pothole.latitude, pothole.longitude
    )
    
    # Calculate initial risk score
    risk_score = RiskScoringService.calculate_risk_score(
        severity=pothole.severity,
        size_sqm=pothole.size_sqm
    )
    
    # Get user ID if authenticated
    user_id = None
    if token:
        token_data = verify_token(token)
        if token_data:
            user_id = token_data.user_id
    
    # Create pothole
    db_pothole = Pothole(
        latitude=pothole.latitude,
        longitude=pothole.longitude,
        severity=pothole.severity,
        size_sqm=pothole.size_sqm,
        depth_cm=pothole.depth_cm,
        confidence=pothole.confidence,
        image_url=image_url,
        source=pothole.source,
        reported_by=user_id,
        h3_index=h3_index,
        road_name=pothole.road_name,
        city=pothole.city,
        additional_data=pothole.additional_data
    )
    
    db.add(db_pothole)
    db.commit()
    db.refresh(db_pothole)
    
    # Prepare response data
    response_data = {
        "id": str(db_pothole.id),
        "latitude": db_pothole.latitude,
        "longitude": db_pothole.longitude,
        "severity": db_pothole.severity,
        "size_sqm": float(db_pothole.size_sqm) if db_pothole.size_sqm else None,
        "depth_cm": float(db_pothole.depth_cm) if db_pothole.depth_cm else None,
        "confidence": float(db_pothole.confidence),
        "image_url": db_pothole.image_url,
        "source": db_pothole.source,
        "reported_by": db_pothole.reported_by,
        "reported_at": db_pothole.reported_at,
        "verified": db_pothole.verified,
        "verified_by": db_pothole.verified_by,
        "resolved": db_pothole.resolved,
        "resolved_at": db_pothole.resolved_at,
        "h3_index": db_pothole.h3_index,
        "road_name": db_pothole.road_name,
        "city": db_pothole.city,
        "risk_score": risk_score
    }
    
    # Broadcast to WebSocket clients in background
    background_tasks.add_task(manager.broadcast_pothole, response_data)
    
    return PotholeResponse.model_validate(db_pothole)


@router.get("/{pothole_id}", response_model=PotholeResponse, summary="Get pothole details")
async def get_pothole(pothole_id: UUID, db: Session = Depends(get_db)):
    """Get details of a specific pothole."""
    pothole = db.query(Pothole).filter(Pothole.id == pothole_id).first()
    
    if not pothole:
        raise HTTPException(status_code=404, detail="Pothole not found")
    
    response = PotholeResponse.model_validate(pothole)
    
    # Add vote counts
    response.confirm_votes = db.query(PotholeVote).filter(
        PotholeVote.pothole_id == pothole.id,
        PotholeVote.vote == True
    ).count()
    response.dispute_votes = db.query(PotholeVote).filter(
        PotholeVote.pothole_id == pothole.id,
        PotholeVote.vote == False
    ).count()
    response.vote_count = response.confirm_votes + response.dispute_votes
    
    return response


@router.patch("/{pothole_id}", response_model=PotholeResponse, summary="Update pothole")
async def update_pothole(
    pothole_id: UUID,
    update: PotholeUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Update pothole (verify, resolve, edit)."""
    pothole = db.query(Pothole).filter(Pothole.id == pothole_id).first()
    
    if not pothole:
        raise HTTPException(status_code=404, detail="Pothole not found")
    
    update_data = update.model_dump(exclude_unset=True)
    
    # Handle verification
    if update.verified is not None:
        if update.verified:
            pothole.verified_by = current_user.id
            pothole.verified_at = datetime.utcnow()
        else:
            pothole.verified_by = None
            pothole.verified_at = None
    
    # Handle resolution
    if update.resolved is not None:
        if update.resolved:
            pothole.resolved_by = current_user.id
            pothole.resolved_at = datetime.utcnow()
        else:
            pothole.resolved_by = None
            pothole.resolved_at = None
    
    # Update other fields
    for field, value in update_data.items():
        if field not in ["verified", "resolved"]:
            setattr(pothole, field, value)
    
    db.commit()
    db.refresh(pothole)
    
    return PotholeResponse.model_validate(pothole)


@router.post("/{pothole_id}/vote", summary="Vote on pothole")
async def vote_pothole(
    pothole_id: UUID,
    vote: PotholeVoteRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Vote on a pothole (confirm or dispute)."""
    pothole = db.query(Pothole).filter(Pothole.id == pothole_id).first()
    
    if not pothole:
        raise HTTPException(status_code=404, detail="Pothole not found")
    
    # Check for existing vote
    existing_vote = db.query(PotholeVote).filter(
        PotholeVote.pothole_id == pothole_id,
        PotholeVote.user_id == current_user.id
    ).first()
    
    if existing_vote:
        existing_vote.vote = vote.vote
        message = "Vote updated"
    else:
        new_vote = PotholeVote(
            pothole_id=pothole_id,
            user_id=current_user.id,
            vote=vote.vote
        )
        db.add(new_vote)
        message = "Vote recorded"
    
    db.commit()
    
    # Get updated counts
    confirm_count = db.query(PotholeVote).filter(
        PotholeVote.pothole_id == pothole_id,
        PotholeVote.vote == True
    ).count()
    dispute_count = db.query(PotholeVote).filter(
        PotholeVote.pothole_id == pothole_id,
        PotholeVote.vote == False
    ).count()
    
    # Auto-verify if enough confirmations
    total_votes = confirm_count + dispute_count
    if confirm_count >= 3 and not pothole.verified:
        pothole.verified = True
        pothole.verified_by = current_user.id
        pothole.verified_at = datetime.utcnow()
        db.commit()
    
    return {
        "message": message,
        "confirm_votes": confirm_count,
        "dispute_votes": dispute_count,
        "verified": pothole.verified
    }
