"""
Schemas for the /api/query endpoint (Phase 8.3 Decision-First Engine).

Supports response modes: conversation | utility | marine | safety | location.
Separates decision, key conditions, actionable recommendations, best timing,
and reasoning summary from evidence and limitations.
"""
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class LocationContext(BaseModel):
    """
    Canonical location context for ORCA (Phase 8.4).
    Every spatial agent consumes this single source of truth.
    """
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to +90)")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to +180)")
    source: str = Field(
        "unavailable",
        description="Location provenance: browser_gps | user_override | map_selection | demo | unavailable",
    )
    accuracy_m: Optional[float] = Field(None, ge=0.0, description="GPS accuracy in meters when available from device")
    timestamp: Optional[str] = Field(None, description="ISO timestamp when coordinates were acquired")
    is_demo: bool = Field(False, description="True if coordinate is an explicit application demonstration position")
    label: Optional[str] = Field(None, description="Human-readable regional descriptor e.g. 'Chennai Coastal Region'")

    @field_validator("latitude", mode="before")
    @classmethod
    def validate_latitude(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        val = float(v)
        if val < -90.0 or val > 90.0:
            raise ValueError(f"Latitude {val} must be between -90.0 and +90.0 decimal degrees")
        return val

    @field_validator("longitude", mode="before")
    @classmethod
    def validate_longitude(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        val = float(v)
        if val < -180.0 or val > 180.0:
            raise ValueError(f"Longitude {val} must be between -180.0 and +180.0 decimal degrees")
        return val


class Location(BaseModel):
    """Legacy 2-parameter coordinates for backward compatibility."""
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Plain-language marine query")
    location: Optional[Union[LocationContext, Location, Dict[str, Any]]] = Field(
        None,
        description="Explicit client location context or legacy lat/lon coordinates",
    )
    session_id: str = Field(..., min_length=1, description="Client session identifier")
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Recent conversation history turns for context resolution [{'role': 'user'|'assistant', 'content': '...'}]",
    )
    is_demo_mode: Optional[bool] = Field(
        False,
        description="Explicit flag for SIH demonstration mode; permits use of demo coordinates",
    )


class DecisionData(BaseModel):
    label: str = Field(
        ...,
        description="Actionable decision label: Recommended | Recommended with caution | Not recommended | Avoid | Operational caution | Clear | Unable to determine reliably",
    )
    summary: Optional[str] = Field(None, description="1-sentence plain-language decision summary")
    confidence: Optional[str] = Field("moderate", description="Human-readable decision confidence: high | moderate | low")


class BestTimeWindow(BaseModel):
    available: bool = Field(False, description="True ONLY if verified forecast supports timing window")
    window: Optional[str] = Field(None, description="Time window string e.g. '06:00 - 09:00 AM' if available")
    basis: Optional[str] = Field(None, description="Factual basis for window or reason why window cannot be determined")


class StructuredEvidenceItem(BaseModel):
    source: str = Field(..., description="Name of the reporting specialist agent or data feed")
    summary: str = Field(..., description="Concise human-readable summary of domain evidence")


class QueryResponse(BaseModel):
    mode: str = Field(
        "marine",
        description="Response mode indicating execution branch: conversation | utility | marine | safety | location",
    )
    answer: str = Field(..., description="Direct 1-3 line plain-language answer addressing the user question first")
    location: Optional[LocationContext] = Field(
        None,
        description="Canonical location context associated with this query response",
    )
    decision: Optional[DecisionData] = Field(None, description="Actionable activity or operational decision")
    risk_level: str = Field(..., description="Enforced risk level: low | moderate | high | critical | none")
    risk_summary: Optional[str] = Field(None, description="1-sentence plain-language reason for risk level")
    key_conditions: List[str] = Field(default_factory=list, description="Top 2-4 key operational/environmental conditions")
    recommendations: List[str] = Field(default_factory=list, description="Actionable maritime precautions and guidelines")
    best_time: Optional[BestTimeWindow] = Field(None, description="Timing advice (never fabricated or hallucinated)")
    reasoning_summary: Optional[str] = Field(None, description="Short user-facing 'Why' explanation")
    evidence: List[str] = Field(default_factory=list, description="Legacy list of evidence strings")
    structured_evidence: List[StructuredEvidenceItem] = Field(default_factory=list, description="Structured agent evidence items")
    data_limitations: List[str] = Field(default_factory=list, description="Transparent data limitations or simulation notes")
    agents_used: List[str] = Field(default_factory=list, description="List of domain agents participating in the query")
