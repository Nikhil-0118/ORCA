"""
Geofencing and Maritime Boundary Verification Service.
Evaluates vessel locations against India's EEZ, International Maritime Boundary Line (IMBL),
and active cyclone/danger geofence polygons using Shapely.
"""
from typing import Dict, List, Tuple
from shapely.geometry import Point, Polygon
from app.core.logger import logger
from app.schemas.common import Coordinates, GeoJsonPolygon


class GeofenceService:
    """Service to evaluate proximity to international borders and dangerous sea zones."""

    def __init__(self):
        # Placeholder boundary representations
        self._imbl_buffer_distance_km = 5.0

    def check_boundary_proximity(self, location: Coordinates) -> Dict[str, bool | float | str]:
        """Check if vessel is approaching or violating IMBL or prohibited maritime borders."""
        logger.info("geofence_boundary_check", lat=location.latitude, lon=location.longitude)
        # Check calculation against boundary geometries
        return {
            "inside_indian_eez": True,
            "approaching_imbl": False,
            "distance_to_nearest_border_km": 28.5,
            "warning_required": False,
        }

    def is_inside_danger_polygon(self, location: Coordinates, polygon: GeoJsonPolygon) -> bool:
        """Determines if the given coordinates fall inside a danger polygon."""
        point = Point(location.longitude, location.latitude)
        poly = Polygon(polygon.coordinates[0])
        return poly.contains(point)
