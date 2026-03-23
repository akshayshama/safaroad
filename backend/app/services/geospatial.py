import h3
from typing import List, Tuple, Optional
from math import radians, sin, cos, sqrt, atan2
from ..config import settings


class GeospatialService:
    """Service for geospatial operations using H3 and PostGIS."""
    
    H3_RESOLUTION = settings.H3_RESOLUTION
    
    @classmethod
    def lat_lng_to_h3(cls, latitude: float, longitude: float, resolution: int = None) -> str:
        """Convert latitude/longitude to H3 index."""
        if resolution is None:
            resolution = cls.H3_RESOLUTION
        return h3.latlng_to_cell(latitude, longitude, resolution)
    
    @classmethod
    def h3_to_lat_lng(cls, h3_index: str) -> Tuple[float, float]:
        """Convert H3 index to center lat/lng."""
        return h3.cell_to_latlng(h3_index)
    
    @classmethod
    def get_neighbors(cls, h3_index: str) -> List[str]:
        """Get neighboring H3 cells."""
        return h3.grid_disk(h3_index, k=1)
    
    @classmethod
    def get_geojson_polygon(cls, h3_index: str) -> dict:
        """Get GeoJSON polygon for H3 cell."""
        return h3.cell_to_geojson(h3_index)
    
    @classmethod
    def calculate_distance(
        cls, 
        lat1: float, lng1: float, 
        lat2: float, lng2: float
    ) -> float:
        """Calculate distance between two points in meters (Haversine formula)."""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lng = radians(lng2 - lng1)
        
        a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return R * c
    
    @classmethod
    def get_bounding_box(
        cls, 
        latitude: float, 
        longitude: float, 
        radius_km: float
    ) -> Tuple[float, float, float, float]:
        """Get bounding box for a center point and radius."""
        # Approximate degrees per km
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * cos(radians(latitude)))
        
        return (
            latitude - lat_delta,  # min_lat
            latitude + lat_delta,  # max_lat
            longitude - lng_delta,  # min_lng
            longitude + lng_delta   # max_lng
        )
    
    @classmethod
    def is_point_in_polygon(
        cls, 
        latitude: float, 
        longitude: float, 
        polygon: List[Tuple[float, float]]
    ) -> bool:
        """Ray casting algorithm to check if point is inside polygon."""
        n = len(polygon)
        inside = False
        
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            
            if ((yi > latitude) != (yj > latitude)) and \
               (longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        
        return inside
    
    @classmethod
    def get_h3_polygon_boundary(cls, h3_index: str) -> List[Tuple[float, float]]:
        """Get polygon boundary for H3 cell."""
        boundary = h3.cell_to_boundary(h3_index)
        return [(lat, lng) for lng, lat in boundary]
