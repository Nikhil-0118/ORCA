from app.schemas.common import Coordinates
from app.services.geofence_service import GeofenceService


def test_geofence_boundary_proximity():
    service = GeofenceService()
    loc = Coordinates(latitude=13.0827, longitude=80.2707)
    res = service.check_boundary_proximity(loc)
    assert res["inside_indian_eez"] is True
    assert "distance_to_nearest_border_km" in res
