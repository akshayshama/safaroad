from typing import Optional
from datetime import datetime, timedelta
from ..config import settings


class RiskScoringService:
    """Service for calculating risk scores based on pothole characteristics."""
    
    # Weights for risk calculation
    SEVERITY_WEIGHT = 0.4
    SIZE_WEIGHT = 0.2
    TRAFFIC_WEIGHT = 0.2
    TIME_WEIGHT = 0.2
    
    # Severity decay factors (potholes become more dangerous over time if unfixed)
    SEVERITY_DECAY_DAYS = 30  # After this, unresolved potholes increase risk
    
    @classmethod
    def calculate_risk_score(
        cls,
        severity: int,  # 1-5
        size_sqm: Optional[float] = None,
        age_days: int = 0,
        confirmed: bool = False,
        vote_ratio: float = 1.0  # confirm / total votes
    ) -> float:
        """
        Calculate risk score (0-10) for a pothole.
        
        Higher score = more dangerous.
        """
        # Base severity score (normalized to 0-10)
        severity_score = (severity / 5.0) * 10
        
        # Size contribution (if available)
        size_score = 0
        if size_sqm:
            # Normalize: 0.1 sqm = low, 1+ sqm = high
            size_score = min(size_sqm * 10, 10)
        
        # Time decay factor
        time_factor = 1.0
        if age_days > cls.SEVERITY_DECAY_DAYS:
            # Unresolved potholes get more dangerous over time
            time_factor = 1.0 + ((age_days - cls.SEVERITY_DECAY_DAYS) / 60) * 0.5
        
        # Confirmation factor (verified potholes are more reliable)
        confirmation_factor = 0.7 + (0.3 * vote_ratio) if confirmed else (0.5 + 0.5 * vote_ratio)
        
        # Calculate weighted score
        risk = (
            severity_score * cls.SEVERITY_WEIGHT +
            size_score * cls.SIZE_WEIGHT +
            (10 * cls.TRAFFIC_WEIGHT) * cls._get_default_traffic_score() +
            (10 * cls.TIME_WEIGHT) * time_factor
        ) * confirmation_factor
        
        return round(min(risk, 10.0), 2)
    
    @classmethod
    def _get_default_traffic_score(cls) -> float:
        """Default traffic score if no data available (neutral)."""
        return 0.5
    
    @classmethod
    def get_risk_level(cls, score: float) -> str:
        """Categorize risk score into levels."""
        if score >= 7.5:
            return "CRITICAL"
        elif score >= 5.0:
            return "HIGH"
        elif score >= 2.5:
            return "MODERATE"
        else:
            return "LOW"
    
    @classmethod
    def calculate_distance_risk(
        cls,
        distance_meters: float,
        speed_kmh: float = 60
    ) -> float:
        """
        Calculate risk based on proximity and vehicle speed.
        
        Lower distance + higher speed = higher risk.
        """
        if distance_meters <= 0:
            return 10.0
        
        # Reaction time at given speed (seconds to reach pothole)
        time_to_reach = (distance_meters / 1000) / (speed_kmh / 3600)
        
        # Less than 5 seconds to react = high risk
        if time_to_reach < 5:
            return 10.0
        elif time_to_reach < 15:
            return 7.5
        elif time_to_reach < 30:
            return 5.0
        elif time_to_reach < 60:
            return 2.5
        else:
            return 1.0
    
    @classmethod
    def calculate_claim_risk(
        cls,
        nearest_distance_meters: float,
        pothole_severity: int,
        pothole_age_days: int,
        has_image: bool = False
    ) -> dict:
        """
        Calculate risk for insurance claim validation.
        
        Returns dict with score, confidence, and recommendation.
        """
        # Distance factor
        if nearest_distance_meters <= 10:
            distance_factor = 1.0
        elif nearest_distance_meters <= 50:
            distance_factor = 0.8
        elif nearest_distance_meters <= 100:
            distance_factor = 0.5
        else:
            distance_factor = 0.2
        
        # Pothole risk
        pothole_risk = cls.calculate_risk_score(
            severity=pothole_severity,
            age_days=pothole_age_days
        ) / 10
        
        # Image evidence factor
        evidence_factor = 1.2 if has_image else 0.9
        
        # Combined score
        combined_score = (distance_factor * 0.4 + pothole_risk * 0.6) * evidence_factor
        final_score = min(combined_score * 10, 10.0)
        
        # Determine validation result
        if combined_score >= 0.7:
            result = "CONFIRMED"
            confidence = min(0.95, 0.6 + combined_score * 0.4)
        elif combined_score >= 0.4:
            result = "DISPUTED"
            confidence = 0.5 + combined_score * 0.3
        else:
            result = "UNCONFIRMED"
            confidence = min(0.85, 0.4 + combined_score * 0.5)
        
        return {
            "risk_score": round(final_score, 2),
            "confidence": round(confidence, 2),
            "result": result,
            "distance_factor": distance_factor,
            "pothole_risk": pothole_risk
        }
