"""
ISRO Bhoonidhi Earth Observation (EO) Agent — LangGraph node.

Fetches satellite Earth Observation metadata from the official ISRO/NRSC
Bhoonidhi STAC (SpatioTemporal Asset Catalog) API:
  - Endpoint: https://bhoonidhi-api.nrsc.gov.in/data/search
  - Authentication: Bearer token (settings.BHUVAN_ACCESS_TOKEN)
  - Scope: Metadata & discovery (satellite platforms, sensors, pass timestamps, cloud cover)

Normalizes the STAC response into a clean structured dictionary with
explicit data freshness tracking (data_time, retrieved_at, data_age_hours, freshness).
Falls back to realistic mock metadata on authentication, network, or parsing failure.
Results are cached in-memory for 15 minutes keyed by (lat, lon).

Node contract:
  Input:  OrcaState (reads query, location)
  Output: {"eo_result": {...}}
"""
from datetime import datetime, timezone
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings
from app.core.state import OrcaState

logger = logging.getLogger("orca.agents.eo")

# ── 15-minute in-memory cache keyed by location ───────────────────────────
_cache: Dict[Tuple[float, float], Dict[str, Any]] = {}
_cache_ts: Dict[Tuple[float, float], float] = {}
_CACHE_TTL_SEC: float = 15 * 60  # 15 minutes


def _get_cache_key(lat: float, lon: float) -> Tuple[float, float]:
    """Round coordinates to 4 decimal places for consistent cache keys."""
    return (round(lat, 4), round(lon, 4))


def _get_cached(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Return cached EO data if still fresh, else None."""
    key = _get_cache_key(lat, lon)
    if key in _cache:
        age = time.time() - _cache_ts.get(key, 0.0)
        if age < _CACHE_TTL_SEC:
            logger.info("eo_cache_hit", extra={"lat": lat, "lon": lon, "age_sec": round(age, 1)})
            return _cache[key]
    return None


def _set_cache(lat: float, lon: float, data: Dict[str, Any]) -> None:
    key = _get_cache_key(lat, lon)
    _cache[key] = data
    _cache_ts[key] = time.time()


# ── Bhoonidhi STAC Configuration ─────────────────────────────────────────
_BHOONIDHI_SEARCH_URL = "https://bhoonidhi-api.nrsc.gov.in/data/search"
_REQUEST_TIMEOUT_SEC = 8.0


def _calculate_data_age_hours(data_time_str: str, retrieved_at_str: str) -> Optional[float]:
    """
    Calculate elapsed age in hours between observation data_time and retrieved_at.
    Both timestamps must be ISO 8601 UTC strings.
    """
    try:
        dt_clean = data_time_str.replace("Z", "+00:00")
        ret_clean = retrieved_at_str.replace("Z", "+00:00")
        t_obs = datetime.fromisoformat(dt_clean)
        t_ret = datetime.fromisoformat(ret_clean)
        diff_seconds = (t_ret - t_obs).total_seconds()
        return round(max(0.0, diff_seconds / 3600.0), 2)
    except Exception:
        return None


def _classify_freshness(data_age_hours: Optional[float]) -> str:
    """
    Classify observation age into metadata tiers:
    - fresh: <= 24.0 hours (near real-time satellite pass)
    - stale: > 24.0 hours and <= 168.0 hours (1 to 7 days old)
    - historical: > 168.0 hours (> 7 days old, archival catalog pass)
    """
    if data_age_hours is None:
        return "unknown"
    if data_age_hours <= 24.0:
        return "fresh"
    if data_age_hours <= 168.0:
        return "stale"
    return "historical"


def _parse_stac_features(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract and normalize individual STAC features into structured observations."""
    features = data.get("features")
    if not isinstance(features, list) or not features:
        return []

    observations: List[Dict[str, Any]] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties") or {}

        # Instrument handling (may be string or list in STAC specs)
        inst_prop = props.get("instruments") or props.get("instrument")
        if isinstance(inst_prop, list) and inst_prop:
            instrument = str(inst_prop[0])
        elif isinstance(inst_prop, str):
            instrument = inst_prop
        else:
            instrument = "Optical/Radar Sensor"

        platform = str(props.get("platform") or props.get("satellite") or "Earth Observation Satellite")
        acq_time = str(props.get("datetime") or props.get("acquisition_time") or "unknown")

        cloud_val = props.get("eo:cloud_cover")
        if cloud_val is None:
            cloud_val = props.get("cloud_cover")
        cloud_cover = float(cloud_val) if cloud_val is not None and isinstance(cloud_val, (int, float)) else None

        observations.append({
            "platform": platform,
            "instrument": instrument,
            "collection": str(feature.get("collection") or "Bhoonidhi-STAC"),
            "acquisition_time": acq_time,
            "cloud_cover": cloud_cover,
            "id": str(feature.get("id") or "unknown"),
            "bbox": feature.get("bbox"),
        })

    return observations


async def _fetch_bhoonidhi_stac(lat: float, lon: float) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Query the Bhoonidhi STAC catalog for satellite passes covering the coordinate.
    Returns (normalized_dict, failure_reason).
    """
    token = settings.BHUVAN_ACCESS_TOKEN
    if not token:
        logger.info("eo_token_missing", extra={"reason": "BHUVAN_ACCESS_TOKEN is not configured"})
        return None, "BHUVAN_ACCESS_TOKEN not configured"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Search bounding box around coordinate (~25km buffer)
    bbox = [
        round(lon - 0.25, 4),
        round(lat - 0.25, 4),
        round(lon + 0.25, 4),
        round(lat + 0.25, 4),
    ]
    payload = {
        "bbox": bbox,
        "limit": 5,
    }

    logger.info("eo_bhoonidhi_search_start", extra={"lat": lat, "lon": lon, "bbox": bbox})

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SEC, verify=False) as client:
            resp = await client.post(_BHOONIDHI_SEARCH_URL, headers=headers, json=payload)

            if resp.status_code == 401:
                logger.warning("eo_bhoonidhi_auth_401", extra={"status": 401})
                return None, "Authentication failed (HTTP 401 Unauthorized - invalid or expired token)"

            if resp.status_code == 403:
                logger.warning("eo_bhoonidhi_auth_403", extra={"status": 403})
                return None, "Access forbidden (HTTP 403 Forbidden - insufficient permissions)"

            if resp.status_code != 200:
                logger.warning("eo_bhoonidhi_http_error", extra={"status": resp.status_code})
                return None, f"Bhoonidhi STAC returned HTTP {resp.status_code}"

            data = resp.json()
            observations = _parse_stac_features(data)
            if not observations:
                logger.info("eo_bhoonidhi_no_scenes", extra={"lat": lat, "lon": lon})
                return None, "No satellite scenes found for specified location in catalog"

            retrieved_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            latest_time = observations[0].get("acquisition_time", "unknown")
            data_age_hours = _calculate_data_age_hours(latest_time, retrieved_at)
            freshness = _classify_freshness(data_age_hours)

            normalized: Dict[str, Any] = {
                "source": "Bhoonidhi STAC",
                "status": "live",
                "data_time": latest_time,
                "retrieved_at": retrieved_at,
                "data_age_hours": data_age_hours,
                "freshness": freshness,
                "location": {"lat": lat, "lon": lon},
                "observations": observations,
                "observation_count": len(observations),
                "notes": "Satellite Earth Observation metadata retrieved from ISRO Bhoonidhi STAC catalog.",
            }
            logger.info("eo_bhoonidhi_success", extra={"scenes": len(observations), "freshness": freshness})
            return normalized, None

    except httpx.TimeoutException:
        logger.warning("eo_bhoonidhi_timeout", extra={"lat": lat, "lon": lon})
        return None, "Connection timeout contacting Bhoonidhi STAC API"
    except Exception as exc:
        logger.warning("eo_bhoonidhi_exception", extra={"error": str(exc), "lat": lat, "lon": lon})
        return None, f"Network/parsing exception: {str(exc)}"


# ── Mock fallback ─────────────────────────────────────────────────────────

def _mock_eo_data(lat: float, lon: float, is_demo: bool = False, reason: str = "Live Bhoonidhi STAC access unavailable") -> Dict[str, Any]:
    """Spatially-parameterized realistic EO metadata mock fallback when live STAC fails."""
    retrieved_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data_time = "2026-09-02T04:15:00Z"
    age = _calculate_data_age_hours(data_time, retrieved_at) or 0.0

    min_lon = round(lon - 0.5, 4)
    min_lat = round(lat - 0.5, 4)
    max_lon = round(lon + 0.5, 4)
    max_lat = round(lat + 0.5, 4)

    return {
        "source": "Bhoonidhi-mock",
        "status": "mock",
        "data_source_type": "simulated",
        "data_time": data_time,
        "retrieved_at": retrieved_at,
        "data_age_hours": age,
        "freshness": _classify_freshness(age),
        "location": {"lat": round(lat, 4), "lon": round(lon, 4)},
        "requested_location": {"lat": round(lat, 4), "lon": round(lon, 4)},
        "resolved_location": {"lat": round(lat, 4), "lon": round(lon, 4)},
        "scene_coverage_bbox": [min_lon, min_lat, max_lon, max_lat],
        "spatial_relation": "contains_point",
        "is_demo": is_demo,
        "observations": [
            {
                "platform": "Oceansat-3 (EOS-06)",
                "instrument": "OCM-3",
                "collection": "EOS-06_OCM-LAC_L1C",
                "acquisition_time": data_time,
                "cloud_cover": 12.0,
                "id": f"MOCK_OCM3_{lat:.2f}_{lon:.2f}",
                "bbox": [min_lon, min_lat, max_lon, max_lat],
            }
        ],
        "observation_count": 1,
        "reason": reason,
        "notes": "Simulated EO metadata footprint generated around requested coordinate.",
    }


# ── LangGraph node function ──────────────────────────────────────────────

async def eo_node(state: OrcaState) -> dict:
    """
    LangGraph node: fetch Earth Observation metadata and write to eo_result.
    Skips execution if selected_agents is provided and neither 'eo' nor 'satellite' is selected.
    """
    selected = state.get("selected_agents")
    if selected is not None and not any(a in selected for a in ("eo", "satellite")):
        return {}

    loc = state.get("location") or {}
    req_lat = loc.get("latitude") if loc.get("latitude") is not None else loc.get("lat")
    req_lon = loc.get("longitude") if loc.get("longitude") is not None else loc.get("lon")
    is_demo = bool(loc.get("is_demo", False))

    # Reject hidden default: if coordinates are not supplied, mark as unavailable
    if req_lat is None or req_lon is None:
        return {
            "eo_result": {
                "source": "ISRO Bhoonidhi STAC",
                "status": "unavailable",
                "data_source_type": "unavailable",
                "notes": "Satellite EO metadata unavailable because no geographic coordinates were provided.",
            }
        }

    lat = float(req_lat)
    lon = float(req_lon)

    # 1. Check cache first
    cached = _get_cached(lat, lon)
    if cached:
        return {
            "eo_result": cached,
        }

    # 2. Try live Bhoonidhi STAC fetch
    live_data, failure_reason = await _fetch_bhoonidhi_stac(lat, lon)
    if live_data:
        live_data["is_demo"] = is_demo
        live_data["data_source_type"] = "live"
        _set_cache(lat, lon, live_data)
        return {
            "eo_result": live_data,
        }

    # 3. Fall back to spatial mock if real fetch failed
    reason_str = failure_reason or "live EO source unavailable"
    logger.info("eo_node_fallback_activated", extra={"lat": lat, "lon": lon, "reason": reason_str})
    mock = _mock_eo_data(lat, lon, is_demo=is_demo, reason=reason_str)
    _set_cache(lat, lon, mock)
    return {
        "eo_result": mock,
    }
