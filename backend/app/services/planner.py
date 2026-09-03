"""
Agentic Query Planner for ORCA (Phase 8.2).

Dynamically evaluates user intent, dialog context, and available tools/agents.
Selects the minimum necessary capability set rather than forcing fixed categories
or hardcoded responses.
"""
from dataclasses import dataclass, field
import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.services.llm_provider import get_llm_provider

logger = logging.getLogger("orca.services.planner")

# ── Available Capability Registry ────────────────────────────────────────────
AVAILABLE_CAPABILITIES = {
    "ocean": "Retrieves ocean temperature, SST anomalies, waves, currents, and ocean conditions from INCOIS ERDDAP.",
    "weather": "Retrieves coastal weather, wind vectors, visibility, precipitation, and IMD advisories.",
    "satellite": "Retrieves Earth Observation metadata, cloud cover, and Oceansat-3 (EOS-06) observations.",
    "safety": "Calculates geodesic boundary proximity (IMBL), geofence alerts, and maritime restriction states.",
    "rag": "Queries maritime regulatory knowledge base, UNCLOS guidelines, and navigational advisories.",
    "clock": "Retrieves authoritative current time (Asia/Kolkata / IST).",
    "date": "Retrieves authoritative current date and day of week.",
    "location": "Retrieves current vessel coordinates, geographic region name, and operational positioning.",
    "conversation": "Handles general dialogue, greetings, capability overviews, and conversational inquiries.",
}

# ── Safety & Emergency Signals (Deterministic Guardrail Override) ─────────────
SAFETY_OVERRIDE_SIGNALS = {
    "risk", "risks", "risk level", "risk near", "safe", "safety", "danger", "dangerous",
    "emergency", "sos", "mayday", "help me", "drifting", "sinking", "capsize", "capsized",
    "distress", "hazard", "hazardous", "storm", "cyclone", "gale", "squall",
    "rough sea", "high wave", "tsunami", "boundary", "border", "imbl",
    "crossed", "violation", "restricted", "piracy", "collision",
    "can i sail", "can we sail", "can we cross", "can i depart",
    "should i depart", "is it safe", "is the sea safe", "am i in danger",
    "how far am i", "distance to border", "distance to boundary",
}

# ── Planner System Prompt ───────────────────────────────────────────────────
PLANNER_SYSTEM_PROMPT = """You are ORCA's Agentic Query Planner.

Your task is to understand the user's plain-language request and determine the MINIMUM information, tools, and specialized agents required to answer it accurately.

Available Capabilities:
1. "ocean": INCOIS Sea surface temperature, SST anomaly, waves, swell, ocean currents, surface conditions.
2. "weather": IMD Coastal weather, wind speed/direction, visibility, precipitation, storm warnings.
3. "satellite": ISRO Oceansat-3 (EOS-06) Earth Observation, cloud cover, satellite observations.
4. "safety": Maritime boundaries, IMBL, geofencing, restricted zones, collision/hazard proximity.
5. "ecosystem": ISRO MOSDAC OCM-3 Chlorophyll-a density, ocean color, phytoplankton activity, and marine trophic state.
6. "rag": Maritime regulations, safety guidelines, reference documentation.
7. "clock": Authoritative current time tool.
8. "date": Authoritative current date and day of week tool.
9. "location": Authoritative current vessel location and geographic region tool.
10. "conversation": General dialogue, greetings, social exchange, or questions about what ORCA is and can do.

Rules & Invariants:
- AGENT MINIMALITY: Select ONLY the capabilities strictly necessary.
  - "What is the sea temperature?" -> agents: ["ocean"]
  - "Is it safe for a small fishing boat?" -> agents: ["ocean", "weather", "safety"]
  - "What satellite data is available?" -> agents: ["satellite"]
  - "What's the weather and wind?" -> agents: ["weather"]
  - "What is the chlorophyll concentration or plankton level?" -> agents: ["ecosystem"]
  - "Should I depart tomorrow morning considering weather, sea state, and borders?" -> agents: ["weather", "ocean", "safety"]
- CONVERSATION: Casual greetings ("hi", "hello", "how are you", "what's up", "thanks") or meta questions ("what can you do", "who are you") DO NOT need marine agents. response_mode must be "conversation".
- UTILITY: Questions asking for the current time, date, or day ("what time is it", "whats today day", "what is the date") need "clock" or "date" tools, NEVER marine agents. response_mode must be "utility".
- LOCATION: Questions asking for current position or location ("what is my current location", "where am I", "what is my position") need "location" tool, response_mode must be "utility". Do NOT trigger ocean or weather agents unless the user also asked about conditions.
- SAFETY SUPREMACY: If the user asks about safety, crossing boundaries, danger, storms, or navigation clearance, response_mode must be "safety", safety_required must be true, and "safety" must be included in agents.
- CONTEXTUAL FOLLOW-UP: If conversation history is provided, resolve references. Example: If previous discussion was about ocean temperature and the user asks "And the wind?", route to "weather" agent.

Return ONLY a valid JSON object with this exact structure:
{
  "intent": "general_conversation | utility | orca_capability | marine_analysis | marine_safety | clarification",
  "response_mode": "conversation | utility | marine | safety",
  "requires_tools": true | false,
  "tools": ["clock" | "date" | "location"],
  "requires_agents": true | false,
  "agents": ["ocean" | "weather" | "satellite" | "safety" | "rag" | "ecosystem"],
  "safety_required": true | false,
  "confidence": 0.0 to 1.0,
  "reasoning_summary": "1-sentence internal summary of plan"
}"""


@dataclass
class ExecutionPlan:
    intent: str
    response_mode: str  # "conversation" | "utility" | "marine" | "safety"
    requires_tools: bool = False
    tools: List[str] = field(default_factory=list)
    requires_agents: bool = False
    agents: List[str] = field(default_factory=list)
    safety_required: bool = False
    confidence: float = 0.9
    reasoning_summary: Optional[str] = None


class ORCAPlanner:
    """Agentic query planner for dynamic capability and agent selection."""

    def __init__(self):
        self.provider = get_llm_provider()

    async def plan(
        self,
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        location: Optional[Dict[str, float]] = None,
    ) -> ExecutionPlan:
        """
        Produce a structured execution plan for the query.
        Uses LLM planning with context awareness and deterministic safety override.
        """
        # 1. Check deterministic safety override first (authoritative safety guardrail)
        normalized = self._normalize(query)
        safety_detected = any(sig in normalized for sig in SAFETY_OVERRIDE_SIGNALS)

        # 2. Attempt dynamic LLM planning if provider is available
        llm_plan = await self._plan_with_llm(query, conversation_history, location)
        if llm_plan is not None:
            # Enforce safety guardrail if safety signal detected
            if safety_detected:
                llm_plan.safety_required = True
                llm_plan.response_mode = "safety"
                llm_plan.requires_agents = True
                if "safety" not in llm_plan.agents:
                    llm_plan.agents.append("safety")

            self._log_plan(llm_plan)
            return llm_plan

        # 3. Fallback to resilient semantic deterministic planner
        fallback_plan = self._plan_fallback(query, conversation_history, location, safety_detected)
        self._log_plan(fallback_plan, is_fallback=True)
        return fallback_plan

    async def _plan_with_llm(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]],
        location: Optional[Dict[str, float]],
    ) -> Optional[ExecutionPlan]:
        """Query the LLM for a structured JSON plan."""
        provider = get_llm_provider()
        if not provider:
            return None

        # Format context
        context_parts = []
        if history:
            recent = history[-4:]
            formatted_history = "\n".join(
                f"{turn.get('role', 'user')}: {turn.get('content', '')[:120]}" for turn in recent
            )
            context_parts.append(f"Recent Conversation History:\n{formatted_history}")

        if location:
            context_parts.append(f"Vessel Coordinates: lat={location.get('lat')}, lon={location.get('lon')}")

        context_str = "\n\n".join(context_parts)
        user_payload = f"USER QUERY: {query}\n\n{context_str}" if context_str else f"USER QUERY: {query}"

        try:
            raw_response = await provider.generate(
                system_prompt=PLANNER_SYSTEM_PROMPT,
                user_payload=user_payload,
                temperature=0.0,
                max_tokens=256,
            )

            if not raw_response:
                return None

            # Parse JSON out of response
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                cleaned = "\n".join(lines).strip()

            parsed = json.loads(cleaned)
            return self._build_plan_from_dict(parsed)

        except Exception as e:
            logger.warning(f"LLM planner failed, falling back: {type(e).__name__}: {e}")
            return None

    def _build_plan_from_dict(self, data: Dict[str, Any]) -> ExecutionPlan:
        """Construct ExecutionPlan from parsed LLM dictionary with validation."""
        intent = str(data.get("intent", "marine_analysis"))
        mode = str(data.get("response_mode", "marine")).lower()
        if mode not in ("conversation", "utility", "marine", "safety"):
            mode = "marine"

        tools = [
            str(t).lower()
            for t in data.get("tools", [])
            if str(t).lower() in ("clock", "date", "datetime", "location")
        ]
        agents = [
            str(a).lower() for a in data.get("agents", [])
            if str(a).lower() in ("ocean", "weather", "satellite", "safety", "rag")
        ]

        requires_tools = bool(data.get("requires_tools", bool(tools)))
        requires_agents = bool(data.get("requires_agents", bool(agents)))
        safety_required = bool(data.get("safety_required", mode == "safety"))

        if mode == "safety":
            safety_required = True
            requires_agents = True
            if "safety" not in agents:
                agents.append("safety")

        return ExecutionPlan(
            intent=intent,
            response_mode=mode,
            requires_tools=requires_tools,
            tools=tools,
            requires_agents=requires_agents,
            agents=agents,
            safety_required=safety_required,
            confidence=float(data.get("confidence", 0.9)),
            reasoning_summary=data.get("reasoning_summary"),
        )

    def _plan_fallback(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]],
        location: Optional[Dict[str, float]],
        safety_detected: bool,
    ) -> ExecutionPlan:
        """
        Semantic rule-based fallback planner.
        Ensures high reliability without requiring hundreds of fixed phrases.
        """
        normalized = self._normalize(query)

        # 1. Safety always takes highest precedence
        if safety_detected:
            agents = ["safety"]
            # Check if weather or ocean should accompany safety
            if any(w in normalized for w in ["wind", "storm", "cyclone", "wave", "weather"]):
                agents.append("weather")
            if any(w in normalized for w in ["sea", "wave", "swell", "water", "temp", "ocean"]):
                agents.append("ocean")

            return ExecutionPlan(
                intent="marine_safety",
                response_mode="safety",
                requires_tools=False,
                tools=[],
                requires_agents=True,
                agents=list(dict.fromkeys(agents)),
                safety_required=True,
                confidence=0.95,
                reasoning_summary="Deterministic safety override activated based on navigational safety terms.",
            )

        # 2. Location Utility
        location_signals = [
            "my location", "current location", "where am i", "my position",
            "current position", "what is my location", "area near me", "what location",
        ]
        is_location = any(sig in normalized for sig in location_signals)

        if is_location and not any(w in normalized for w in ["risk", "safe", "safety", "danger", "hazard", "border", "boundary", "fish", "fishing", "weather", "wind", "sea", "wave", "temp", "ocean"]):
            return ExecutionPlan(
                intent="utility",
                response_mode="utility",
                requires_tools=True,
                tools=["location"],
                requires_agents=False,
                agents=[],
                safety_required=False,
                confidence=0.96,
                reasoning_summary="Current vessel location inquiry requested.",
            )

        # 3. Time / Date Utility (excluding activity timing like "what time is best for fishing")
        time_signals = ["what time is it", "whats the time", "current time", "time right now", "tell me the time"]
        date_signals = [
            "what day", "whats today day", "whats the date", "what is the date", "what date",
            "day is today", "date today", "what day are we on", "todays date", "tell me the date",
            "tell me today", "the date",
        ]

        is_activity_timing = any(w in normalized for w in ["fish", "fishing", "sail", "sailing", "depart", "departure", "trip", "travel", "sea", "boat", "best time"])
        is_time = (any(sig in normalized for sig in time_signals) or (normalized.strip() in ("time", "what time", "the time"))) and not is_activity_timing
        is_date = any(sig in normalized for sig in date_signals)

        if is_time and is_date:
            return ExecutionPlan(
                intent="utility",
                response_mode="utility",
                requires_tools=True,
                tools=["clock", "date"],
                requires_agents=False,
                agents=[],
                safety_required=False,
                confidence=0.96,
                reasoning_summary="Combined current time and date utility requested.",
            )
        elif is_time:
            return ExecutionPlan(
                intent="utility",
                response_mode="utility",
                requires_tools=True,
                tools=["clock"],
                requires_agents=False,
                agents=[],
                safety_required=False,
                confidence=0.96,
                reasoning_summary="Current time utility requested.",
            )
        elif is_date:
            return ExecutionPlan(
                intent="utility",
                response_mode="utility",
                requires_tools=True,
                tools=["date"],
                requires_agents=False,
                agents=[],
                safety_required=False,
                confidence=0.96,
                reasoning_summary="Current date/day utility requested.",
            )

        # 4. Conversational inquiries & Greetings
        greeting_words = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "greetings", "namaste", "vanakkam"]
        social_phrases = ["how are you", "hows it going", "whats up", "how do you do", "nice to meet you", "how are things", "whats happening"]
        thanks_words = ["thanks", "thank you", "thx", "thank u", "much appreciated"]
        confirm_words = ["ok", "okay", "cool", "got it", "sure", "alright", "perfect", "sounds good"]
        capability_phrases = ["what can you do", "who are you", "what is orca", "how do you work", "what are your capabilities", "tell me about yourself", "how can you help"]

        # Check if conversation only
        is_greeting = any(normalized == g or normalized.startswith(g + " ") for g in greeting_words)
        is_social = any(s in normalized for s in social_phrases)
        is_thanks = any(normalized == t for t in thanks_words)
        is_confirm = any(normalized == c for c in confirm_words)
        is_capability = any(c in normalized for c in capability_phrases)

        # Check if marine terms are present to distinguish "hello, what is the weather?"
        ocean_terms = ["sst", "temperature", "temp", "wave", "waves", "swell", "sea surface", "currents", "ocean current"]
        weather_terms = ["weather", "wind", "winds", "knots", "forecast", "visibility", "rain", "precipitation", "storm"]
        satellite_terms = ["satellite", "oceansat", "eos-06", "eos06", "earth observation", "cloud cover", "bhoonidhi", "imagery"]
        ecosystem_terms = ["chlorophyll", "phytoplankton", "plankton", "algae", "algal", "ecosystem", "trophic", "productivity", "pfz", "potential fishing zone"]
        marine_context_terms = [
            "ocean", "marine", "sea", "coastal", "harbor", "port", "fish", "fishing",
            "vessel", "boat", "sail", "chennai", "palk", "bay of bengal", "arabian sea",
            "environment", "sri lanka", "sri lankan", "channel", "strait", "gulf",
        ]

        has_ocean = any(w in normalized for w in ocean_terms)
        has_weather = any(w in normalized for w in weather_terms)
        has_satellite = any(w in normalized for w in satellite_terms)
        has_ecosystem = any(w in normalized for w in ecosystem_terms)
        has_marine_general = any(w in normalized for w in marine_context_terms) or is_activity_timing

        # Conversational / Capability (no marine query attached)
        if (is_greeting or is_social or is_thanks or is_confirm or is_capability) and not (has_ocean or has_weather or has_satellite or has_ecosystem or has_marine_general):
            intent = "orca_capability" if is_capability else "general_conversation"
            return ExecutionPlan(
                intent=intent,
                response_mode="conversation",
                requires_tools=False,
                tools=[],
                requires_agents=False,
                agents=[],
                safety_required=False,
                confidence=0.92,
                reasoning_summary="Conversational exchange; no external agents or tools required.",
            )

        # 5. Contextual Follow-Up
        # e.g., User: "And the wind?" after previous marine query
        if history and len(normalized.split()) <= 6 and not (has_ocean or has_weather or has_satellite or has_ecosystem):
            last_turn = history[-1].get("content", "").lower() if history else ""
            if any(t in last_turn for t in ["ocean", "weather", "sea", "wave", "temp", "sri lanka", "fish", "fishing", "chlorophyll"]):
                if "wind" in normalized:
                    has_weather = True
                elif "chlorophyll" in normalized or "plankton" in normalized:
                    has_ecosystem = True
                elif "fish" in normalized or "fishing" in normalized:
                    has_marine_general = True
                else:
                    has_ocean = True

        # 6. Dynamic Agent Selection (Minimality)
        selected_agents = []
        if has_ocean:
            selected_agents.append("ocean")
        if has_weather:
            selected_agents.append("weather")
        if has_satellite:
            selected_agents.append("satellite")
        if has_ecosystem:
            selected_agents.append("ecosystem")

        if any(w in normalized for w in ["sri lanka", "sri lankan", "palk"]):
            if "safety" not in selected_agents:
                selected_agents.append("safety")
            if "ocean" not in selected_agents:
                selected_agents.append("ocean")

        if not selected_agents and has_marine_general:
            selected_agents.append("ocean")
            selected_agents.append("weather")

        if not selected_agents:
            # Ambiguous / General query fallback
            return ExecutionPlan(
                intent="general_conversation",
                response_mode="conversation",
                requires_tools=False,
                tools=[],
                requires_agents=False,
                agents=[],
                safety_required=False,
                confidence=0.7,
                reasoning_summary="No specific domain agents detected; routed to conversational path.",
            )

        return ExecutionPlan(
            intent="marine_analysis",
            response_mode="marine",
            requires_tools=False,
            tools=[],
            requires_agents=True,
            agents=selected_agents,
            safety_required=False,
            confidence=0.92,
            reasoning_summary=f"Selected minimal agent capabilities: {selected_agents}",
        )

    def _normalize(self, text: str) -> str:
        """Normalize query text: lowercase, remove apostrophes, strip punctuation."""
        if not text:
            return ""
        lowered = text.lower()
        no_apos = re.sub(r"[''`]", "", lowered)
        cleaned = re.sub(r"[!?,.:;\"()\[\]{}\\/\-_]", " ", no_apos)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _log_plan(self, plan: ExecutionPlan, is_fallback: bool = False) -> None:
        """Developer/server log for observability."""
        src = "Fallback Planner" if is_fallback else "LLM Planner"
        logger.info(
            f"[{src}] Intent: {plan.intent} | Mode: {plan.response_mode} | "
            f"Tools: {plan.tools} | Agents: {plan.agents} | Safety: {plan.safety_required}"
        )


# Global singleton instance
orca_planner = ORCAPlanner()
