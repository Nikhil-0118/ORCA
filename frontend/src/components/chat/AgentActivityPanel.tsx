import React, { useState } from 'react';
import { ChevronDown, Cpu, FileText } from 'lucide-react';
import { ReasoningStep } from '../../types/chat.types';

interface AgentActivityPanelProps {
  steps?: ReasoningStep[];
  evidence?: string[];
  riskLevel?: string;
}

/**
 * Maps raw agent type identifiers to human-readable display names.
 */
function getAgentDisplayName(agent: string): string {
  const map: Record<string, string> = {
    orchestrator: 'Coordinator',
    weather_storm_agent: 'Weather Agent',
    fishing_zone_agent: 'Fishing Zone Agent',
    ocean_temp_agent: 'Ocean Agent',
    safety_boundary_agent: 'Safety Agent',
  };
  return map[agent] || agent;
}

/**
 * Returns a dot color based on agent type.
 */
function getAgentDotColor(agent: string): string {
  const map: Record<string, string> = {
    orchestrator: '#06b6d4',
    weather_storm_agent: '#f59e0b',
    fishing_zone_agent: '#10b981',
    ocean_temp_agent: '#3b82f6',
    safety_boundary_agent: '#ef4444',
  };
  return map[agent] || '#64748b';
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({ steps, evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSteps = steps && steps.length > 0;
  const hasEvidence = evidence && evidence.length > 0;

  if (!hasSteps && !hasEvidence) return null;

  const count = hasSteps
    ? new Set(steps.map((s) => s.agent)).size
    : evidence!.length;

  const toggleLabel = hasSteps
    ? `ORCA used ${count} specialized agent${count !== 1 ? 's' : ''}`
    : `Verified Data Sources & Evidence (${count} sources)`;

  return (
    <div className="chat-agent-panel">
      <button
        type="button"
        className={`chat-agent-toggle ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {hasSteps ? <Cpu className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        <span>{toggleLabel}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isExpanded && (
        <div className="chat-agent-details">
          {/* Step-by-step agent reasoning */}
          {hasSteps &&
            steps.map((step, idx) => (
              <div key={idx} className="chat-agent-item">
                <div
                  className="chat-agent-dot"
                  style={{ backgroundColor: getAgentDotColor(step.agent) }}
                />
                <div>
                  <div className="chat-agent-name">{getAgentDisplayName(step.agent)}</div>
                  <div className="chat-agent-rationale">{step.rationale}</div>
                  {step.data_sources_queried.length > 0 && (
                    <div className="chat-agent-sources">
                      Sources: {step.data_sources_queried.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}

          {/* Evidence lines */}
          {hasEvidence &&
            evidence.map((ev, idx) => (
              <div key={idx} className="chat-agent-item">
                <div
                  className="chat-agent-dot"
                  style={{
                    backgroundColor: ev.includes('live')
                      ? '#10b981'
                      : ev.includes('mock')
                      ? '#f59e0b'
                      : '#06b6d4',
                  }}
                />
                <div>
                  <div className="chat-agent-rationale" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {ev}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
