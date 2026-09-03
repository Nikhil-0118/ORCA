export type AgentType =
  | 'orchestrator'
  | 'weather_storm_agent'
  | 'fishing_zone_agent'
  | 'ocean_temp_agent'
  | 'safety_boundary_agent';

export interface ReasoningStep {
  agent: AgentType | string;
  action: string;
  rationale: string;
  data_sources_queried: string[];
  timestamp: string;
}

export type OrcaCompanionState = 'idle' | 'listening' | 'thinking' | 'answering' | 'error';

export interface ChatRouteInfo {
  destinationName: string;
  distanceKm: number;
  bearingDegrees: number;
  safetyClearance: 'SAFE' | 'CAUTION' | 'RESTRICTED';
  estimatedTimeMinutes: number;
}

export interface StructuredEvidenceItem {
  source: string;
  summary: string;
}

export interface DecisionInfo {
  label: string;
  summary?: string;
  confidence?: 'high' | 'moderate' | 'low' | string;
}

export interface BestTimeInfo {
  available: boolean;
  window?: string | null;
  basis?: string | null;
}

export interface LocationContext {
  latitude: number | null;
  longitude: number | null;
  source: 'browser_gps' | 'user_override' | 'map_selection' | 'demo' | 'unavailable';
  accuracy_m?: number | null;
  timestamp?: string | null;
  is_demo: boolean;
  label?: string | null;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  location?: LocationContext;
  mode?: 'conversation' | 'utility' | 'marine' | 'safety';
  decision?: DecisionInfo;
  risk_level?: string;
  risk_summary?: string;
  key_conditions?: string[];
  recommendations?: string[];
  best_time?: BestTimeInfo;
  reasoning_summary?: string;
  evidence?: string[];
  structured_evidence?: StructuredEvidenceItem[];
  data_limitations?: string[];
  agents_used?: string[];
  reasoning_steps?: ReasoningStep[];
  involved_agents?: (AgentType | string)[];
  suggested_actions?: string[];
  next_safe_window?: string;
  route_info?: ChatRouteInfo;
}

export interface QueryApiRequest {
  query: string;
  location?: LocationContext | { lat: number; lon: number } | null;
  session_id: string;
  conversation_history?: Array<{ role: string; content: string }>;
  is_demo_mode?: boolean;
}

export interface QueryApiResponse {
  mode?: 'conversation' | 'utility' | 'marine' | 'safety';
  answer: string;
  location?: LocationContext;
  decision?: DecisionInfo;
  risk_level: string;
  risk_summary?: string;
  key_conditions?: string[];
  recommendations: string[];
  best_time?: BestTimeInfo;
  reasoning_summary?: string;
  evidence: string[];
  structured_evidence?: StructuredEvidenceItem[];
  data_limitations?: string[];
  agents_used?: string[];
}

export interface ChatRequest {
  query: string;
  vessel_location?: { latitude: number; longitude: number };
  language_code?: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface ChatResponse {
  answer: string;
  reasoning_steps: ReasoningStep[];
  involved_agents: AgentType[];
  suggested_actions: string[];
  next_safe_window?: string;
  structured_data?: Record<string, unknown>;
  route_info?: ChatRouteInfo;
}
