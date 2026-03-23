from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, timedelta

from ..schemas import (
    ClaimValidateRequest, ClaimValidateResponse,
    ClaimHistoryResponse, NearestPotholeInfo
)
from ..database import get_db
from ..models import ClaimValidation, Pothole, Profile
from ..services.geospatial import GeospatialService
from ..services.risk import RiskScoringService
from .auth import get_current_user

router = APIRouter(prefix="/claims", tags=["Claims"])


@router.post("/validate", response_model=ClaimValidateResponse, summary="Validate insurance claim")
async def validate_claim(
    claim: ClaimValidateRequest,
    db: Session = Depends(get_db)
):
    """
    Validate an insurance claim by checking for nearby potholes.
    
    This endpoint helps insurance companies verify if reported damage
    matches known pothole locations.
    """
    # Find nearest pothole within 500m
    min_lat, max_lat, min_lng, max_lng = GeospatialService.get_bounding_box(
        claim.damage_latitude, claim.damage_longitude, 0.5  # 500m radius
    )
    
    nearby_potholes = db.query(Pothole).filter(
        Pothole.latitude >= min_lat,
        Pothole.latitude <= max_lat,
        Pothole.longitude >= min_lng,
        Pothole.longitude <= max_lng,
        Pothole.resolved == False
    ).all()
    
    nearest_pothole = None
    min_distance = float('inf')
    
    for p in nearby_potholes:
        distance = GeospatialService.calculate_distance(
            claim.damage_latitude, claim.damage_longitude,
            p.latitude, p.longitude
        )
        
        if distance < min_distance:
            min_distance = distance
            nearest_pothole = p
    
    # Calculate risk and validation result
    validation_result = "UNCONFIRMED"
    risk_score = 0.0
    confidence = 0.0
    
    if nearest_pothole:
        age_days = (datetime.utcnow() - nearest_pothole.reported_at).days
        
        risk_result = RiskScoringService.calculate_claim_risk(
            nearest_distance_meters=min_distance,
            pothole_severity=nearest_pothole.severity,
            pothole_age_days=age_days,
            has_image=bool(nearest_pothole.image_url)
        )
        
        validation_result = risk_result["result"]
        risk_score = risk_result["risk_score"]
        confidence = risk_result["confidence"]
        
        nearest_info = NearestPotholeInfo(
            id=nearest_pothole.id,
            distance_meters=round(min_distance, 2),
            severity=nearest_pothole.severity,
            reported_at=nearest_pothole.reported_at,
            image_url=nearest_pothole.image_url,
            risk_score=risk_score
        )
    else:
        nearest_info = None
    
    # Save validation record
    validation = ClaimValidation(
        claim_id=claim.claim_id,
        insurance_company=claim.insurance_company,
        damage_latitude=claim.damage_latitude,
        damage_longitude=claim.damage_longitude,
        damage_timestamp=claim.damage_timestamp,
        damage_type=claim.damage_type,
        vehicle_info=claim.vehicle_info,
        validation_result=validation_result,
        nearest_pothole_id=nearest_pothole.id if nearest_pothole else None,
        distance_meters=min_distance if nearest_pothole else None,
        risk_score=risk_score,
        confidence=confidence
    )
    
    db.add(validation)
    db.commit()
    
    return ClaimValidateResponse(
        claim_id=claim.claim_id,
        validation_result=validation_result,
        nearest_pothole=nearest_info,
        risk_score=risk_score,
        confidence=confidence,
        evidence={
            "nearby_potholes_found": len(nearby_potholes),
            "search_radius_km": 0.5,
            "map_url": f"https://www.google.com/maps?q={claim.damage_latitude},{claim.damage_longitude}"
        }
    )


@router.get("/history", response_model=ClaimHistoryResponse, summary="Get claim validation history")
async def get_claim_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    result: Optional[str] = None,
    insurance_company: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Get history of claim validations."""
    # Only admins and insurance users can view history
    if current_user.role not in ["admin", "insurance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(ClaimValidation)
    
    if result:
        query = query.filter(ClaimValidation.validation_result == result)
    
    if insurance_company:
        query = query.filter(ClaimValidation.insurance_company == insurance_company)
    
    total = query.count()
    offset = (page - 1) * page_size
    
    validations = query.order_by(desc(ClaimValidation.created_at)).offset(offset).limit(page_size).all()
    
    items = []
    for v in validations:
        nearest = None
        if v.nearest_pothole_id:
            pothole = db.query(Pothole).filter(Pothole.id == v.nearest_pothole_id).first()
            if pothole:
                nearest = NearestPotholeInfo(
                    id=pothole.id,
                    distance_meters=float(v.distance_meters) if v.distance_meters else 0,
                    severity=pothole.severity,
                    reported_at=pothole.reported_at,
                    image_url=pothole.image_url,
                    risk_score=float(v.risk_score) if v.risk_score else 0
                )
        
        items.append(ClaimValidateResponse(
            claim_id=v.claim_id,
            validation_result=v.validation_result,
            nearest_pothole=nearest,
            risk_score=float(v.risk_score) if v.risk_score else 0,
            confidence=float(v.confidence) if v.confidence else 0,
            evidence={
                "map_url": v.claim_map_url,
                "pothole_image_url": v.pothole_image_url
            }
        ))
    
    return ClaimHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/stats", summary="Get claim statistics")
async def get_claim_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Get claim validation statistics."""
    if current_user.role not in ["admin", "insurance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    since = datetime.utcnow() - timedelta(days=days)
    
    total = db.query(ClaimValidation).filter(
        ClaimValidation.created_at >= since
    ).count()
    
    confirmed = db.query(ClaimValidation).filter(
        ClaimValidation.created_at >= since,
        ClaimValidation.validation_result == "CONFIRMED"
    ).count()
    
    unconfirmed = db.query(ClaimValidation).filter(
        ClaimValidation.created_at >= since,
        ClaimValidation.validation_result == "UNCONFIRMED"
    ).count()
    
    disputed = db.query(ClaimValidation).filter(
        ClaimValidation.created_at >= since,
        ClaimValidation.validation_result == "DISPUTED"
    ).count()
    
    return {
        "period_days": days,
        "total_claims": total,
        "confirmed": confirmed,
        "unconfirmed": unconfirmed,
        "disputed": disputed,
        "confirmation_rate": round(confirmed / total * 100, 2) if total > 0 else 0
    }
