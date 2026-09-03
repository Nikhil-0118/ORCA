"""
Top-level /api endpoints: query, safety-check, health (Phase 8.2).
These are the primary endpoints consumed by the ORCA frontend.
"""
from fastapi import APIRouter, status
from app.core.graph import orca_graph
from app.schemas.query import Location, LocationContext, QueryRequest, QueryResponse
from app.schemas.safety import SafetyCheckRequest, SafetyCheckResponse
from app.services.planner import orca_planner
from app.services.conversational_llm import generate_conversational_response
from app.services.geofence_service import geofence_service, SafetyState

router = APIRouter(prefix="/api", tags=["ORCA Core API"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health() -> dict:
    """Basic liveness probe."""
    return {"status": "ok"}


def _normalize_request_location(request: QueryRequest) -> LocationContext:
    """Normalize input location into a canonical LocationContext without hidden defaults."""
    req_loc = request.location
    if req_loc is None:
        if request.is_demo_mode:
            return LocationContext(
                latitude=13.0827,
                longitude=80.2707,
                source="demo",
                is_demo=True,
                label="Chennai Coastal Region (SIH Demo Mode)",
            )
        return LocationContext(
            latitude=None,
            longitude=None,
            source="unavailable",
            is_demo=False,
            label="Location unavailable",
        )

    if isinstance(req_loc, LocationContext):
        return req_loc

    if isinstance(req_loc, Location):
        return LocationContext(
            latitude=req_loc.lat,
            longitude=req_loc.lon,
            source="demo" if request.is_demo_mode else "browser_gps",
            is_demo=bool(request.is_demo_mode),
        )

    if isinstance(req_loc, dict):
        raw_lat = req_loc.get("latitude") if req_loc.get("latitude") is not None else req_loc.get("lat")
        raw_lon = req_loc.get("longitude") if req_loc.get("longitude") is not None else req_loc.get("lon")
        is_demo = bool(req_loc.get("is_demo", request.is_demo_mode or False))
        source = req_loc.get("source", "demo" if is_demo else ("browser_gps" if raw_lat is not None else "unavailable"))
        accuracy_m = req_loc.get("accuracy_m")
        timestamp = req_loc.get("timestamp")
        label = req_loc.get("label")

        return LocationContext(
            latitude=float(raw_lat) if raw_lat is not None else None,
            longitude=float(raw_lon) if raw_lon is not None else None,
            source=source,
            accuracy_m=float(accuracy_m) if accuracy_m is not None else None,
            timestamp=str(timestamp) if timestamp else None,
            is_demo=is_demo,
            label=label,
        )

    return LocationContext(
        latitude=None,
        longitude=None,
        source="unavailable",
        is_demo=False,
    )


@router.post("/query", response_model=QueryResponse, status_code=status.HTTP_200_OK)
async def query(request: QueryRequest) -> QueryResponse:
    """
    Accept a plain-language query. Dynamically planned by ORCAPlanner:
      - conversation: Conversational LLM generates dynamic response
      - utility: Real system clock/location data formatted by LLM
      - marine: Minimal specialist agent subset executed and synthesized
      - safety: Safety-aware pipeline with deterministic risk enforcement
    """
    loc_ctx = _normalize_request_location(request)
    loc_dict = loc_ctx.model_dump()
    loc_dict["lat"] = loc_ctx.latitude
    loc_dict["lon"] = loc_ctx.longitude

    # ── 1. Dynamic Agentic Planning ──────────────────────────────────────────
    plan = await orca_planner.plan(
        query=request.query,
        conversation_history=request.conversation_history,
        location=loc_dict,
    )

    # ── 2. Conversation & Utility Branches (Bypass multi-agent graph) ─────────
    if plan.response_mode in ("conversation", "utility"):
        answer = await generate_conversational_response(
            intent=plan.intent,
            user_query=request.query,
            tools=plan.tools,
            conversation_history=request.conversation_history,
            location=loc_dict,
        )
        return QueryResponse(
            mode=plan.response_mode,
            answer=answer,
            location=loc_ctx,
            decision=None,
            risk_level="none",
            recommendations=[],
            risk_summary=None,
            key_conditions=[],
            best_time=None,
            reasoning_summary=None,
            evidence=[],
            structured_evidence=[],
            data_limitations=[],
            agents_used=[],
        )

    # ── 3. Marine / Safety Branch: Execute Selected Agents in LangGraph ───────
    initial_state = {
        "query": request.query,
        "location": loc_dict,
        "session_id": request.session_id,
        "selected_agents": plan.agents,
        "safety_required": plan.safety_required,
        "eo_result": None,
        "ocean_result": None,
        "weather_result": None,
        "safety_result": None,
        "ecosystem_result": None,
        "evidence": [],
        "risk_level": "unknown",
        "final_answer": "",
        "recommendations": [],
    }

    result = await orca_graph.ainvoke(initial_state)

    final_answer = result.get("final_answer") or "No operational data available."
    evidence = result.get("evidence") or []
    risk_level = result.get("risk_level") or "low"
    recommendations = result.get("recommendations") or []
    risk_summary = result.get("risk_summary")
    structured_evidence = result.get("structured_evidence") or []
    data_limitations = result.get("data_limitations") or []
    agents_used = result.get("agents_used") or []
    decision = result.get("decision")
    key_conditions = result.get("key_conditions") or []
    best_time = result.get("best_time")
    reasoning_summary = result.get("reasoning_summary")

    return QueryResponse(
        mode=plan.response_mode,
        answer=final_answer,
        location=loc_ctx,
        decision=decision,
        risk_level=risk_level,
        recommendations=recommendations,
        risk_summary=risk_summary,
        key_conditions=key_conditions,
        best_time=best_time,
        reasoning_summary=reasoning_summary,
        evidence=evidence,
        structured_evidence=structured_evidence,
        data_limitations=data_limitations,
        agents_used=agents_used,
    )


@router.post("/safety-check", response_model=SafetyCheckResponse, status_code=status.HTTP_200_OK)
async def safety_check(request: SafetyCheckRequest) -> SafetyCheckResponse:
    """
    Fast, non-LLM boundary proximity check.
    Independent offline safety path (Phase 7).
    """
    prev = SafetyState(request.prev_state) if request.prev_state and request.prev_state in SafetyState.__members__ else None
    eval_res = geofence_service.evaluate_position(request.lat, request.lon, prev_state=prev)

    inside = eval_res.state != SafetyState.BREACH
    alert_level_str = (
        "critical" if eval_res.state == SafetyState.BREACH
        else "warning" if eval_res.state == SafetyState.WARNING
        else "caution" if eval_res.state == SafetyState.APPROACHING
        else "none"
    )

    return SafetyCheckResponse(
        inside_boundary=inside,
        distance_to_boundary_km=eval_res.distance_to_boundary_km,
        alert_level=alert_level_str,
        state=eval_res.state.value,
        severity=eval_res.severity.value,
        bearing_degrees=eval_res.bearing_degrees,
        nearest_boundary_name=eval_res.nearest_boundary_name,
        alert_title=eval_res.alert_title,
        alert_message=eval_res.alert_message,
        demo_only=True,
    )
