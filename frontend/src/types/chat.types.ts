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

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  evidence?: string[];
  structured_evidence?: StructuredEvidenceItem[];
  risk_level?: string;
  risk_summary?: string;
  recommendations?: string[];
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
  location?: { lat: number; lon: number };
  session_id: string;
}

export interface QueryApiResponse {
  answer: string;
  evidence: string[];
  structured_evidence?: StructuredEvidenceItem[];
  risk_level: string;
  risk_summary?: string;
  recommendations: string[];
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
