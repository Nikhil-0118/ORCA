import React, { useRef, useEffect } from 'react';
import { Anchor, Clock, Compass, Navigation, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ChatMessage } from '../../types/chat.types';
import { AgentActivityPanel } from './AgentActivityPanel';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

/**
 * Safely parses bold markdown and bullet lines into clean React elements without dangerouslySetInnerHTML.
 */
function renderFormattedContent(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="chat-formatted-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 6 }} />;
        }

        // Check if line is a bullet item
        const isBullet =
          trimmed.startsWith('•') ||
          trimmed.startsWith('- ') ||
          trimmed.startsWith('* ');
        const cleanLine = isBullet
          ? trimmed.replace(/^[•\-\*]\s*/, '')
          : trimmed;

        // Parse bold tokens (**text**) safely into <strong> elements
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
        const renderedParts = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            return (
              <strong key={pIdx} style={{ color: '#f8fafc', fontWeight: 600 }}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: 3,
                marginBottom: 3,
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: '#06b6d4', fontSize: 13, lineHeight: '20px' }}>•</span>
              <span style={{ flex: 1 }}>{renderedParts}</span>
            </div>
          );
        }

        return (
          <p
            key={idx}
            style={{
              margin: '0 0 6px 0',
              lineHeight: 1.55,
            }}
          >
            {renderedParts}
          </p>
        );
      })}
    </div>
  );
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-messages-area">
      <div className="chat-messages-inner">
        {messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant';
          const isElevatedRisk = msg.risk_level === 'high' || msg.risk_level === 'critical';
          const isModerateRisk = msg.risk_level === 'moderate';

          return (
            <div
              key={msg.id || index}
              className={`chat-msg-row ${isAssistant ? 'assistant' : 'user'}`}
            >
              {/* ORCA avatar for assistant messages */}
              {isAssistant && (
                <div className="chat-msg-avatar orca">
                  <Anchor className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={`chat-msg-bubble ${isAssistant ? 'assistant' : 'user'}`}>
                {/* Risk Level Badge (if provided by backend) */}
                {msg.risk_level && msg.risk_level !== 'unknown' && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '3px 9px',
                      borderRadius: 6,
                      marginBottom: 10,
                      backgroundColor:
                        msg.risk_level === 'low'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : isModerateRisk
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.18)',
                      color:
                        msg.risk_level === 'low'
                          ? '#10b981'
                          : isModerateRisk
                          ? '#f59e0b'
                          : '#ef4444',
                      border: `1px solid ${
                        msg.risk_level === 'low'
                          ? 'rgba(16, 185, 129, 0.28)'
                          : isModerateRisk
                          ? 'rgba(245, 158, 11, 0.28)'
                          : 'rgba(239, 68, 68, 0.35)'
                      }`,
                    }}
                  >
                    {msg.risk_level === 'low' ? (
                      <ShieldCheck className="w-3 h-3" />
                    ) : isModerateRisk ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <ShieldAlert className="w-3 h-3" />
                    )}
                    <span>{msg.risk_level} Risk Level</span>
                  </div>
                )}

                {/* Plain-Language Risk Summary Banner (for High/Critical warnings) */}
                {isElevatedRisk && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ High Maritime Risk: A safety restriction or hazardous sea/weather condition is active in this region.
                  </div>
                )}

                {/* Formatted Conversational Message Content */}
                <div className="chat-msg-content" style={{ fontSize: 13.5 }}>
                  {renderFormattedContent(msg.content)}
                </div>

                {/* Route Info Card (only rendered if legitimate route info is present) */}
                {msg.route_info && (
                  <div className="chat-route-card" style={{ marginTop: 10 }}>
                    <div className="chat-route-header">
                      <div className="chat-route-name">
                        <Navigation className="w-3.5 h-3.5" />
                        <span>{msg.route_info.destinationName}</span>
                      </div>
                      <span
                        className={`chat-route-badge ${
                          msg.route_info.safetyClearance === 'SAFE'
                            ? 'safe'
                            : msg.route_info.safetyClearance === 'CAUTION'
                            ? 'caution'
                            : 'restricted'
                        }`}
                      >
                        {msg.route_info.safetyClearance}
                      </span>
                    </div>

                    <div className="chat-route-stats">
                      <div>
                        <div className="chat-route-stat-label">Distance</div>
                        <div className="chat-route-stat-value">{msg.route_info.distanceKm} km</div>
                      </div>
                      <div>
                        <div className="chat-route-stat-label">Bearing</div>
                        <div className="chat-route-stat-value" style={{ color: '#06b6d4' }}>
                          {msg.route_info.bearingDegrees}°
                        </div>
                      </div>
                      <div>
                        <div className="chat-route-stat-label">Est. Time</div>
                        <div className="chat-route-stat-value">
                          {msg.route_info.estimatedTimeMinutes} min
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggested Actions / Recommendations */}
                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="chat-actions" style={{ marginTop: 10 }}>
                    {msg.suggested_actions.map((action, aIdx) => (
                      <span key={aIdx} className="chat-action-chip">
                        <Compass className="w-3 h-3" style={{ color: '#06b6d4' }} />
                        {action}
                      </span>
                    ))}
                  </div>
                )}

                {/* Agent Activity / Structured Evidence / Limitations (expandable) */}
                {((msg.reasoning_steps && msg.reasoning_steps.length > 0) ||
                  (msg.evidence && msg.evidence.length > 0) ||
                  (msg.structured_evidence && msg.structured_evidence.length > 0) ||
                  (msg.data_limitations && msg.data_limitations.length > 0) ||
                  (msg.agents_used && msg.agents_used.length > 0)) && (
                  <div style={{ marginTop: 12 }}>
                    <AgentActivityPanel
                      steps={msg.reasoning_steps}
                      evidence={msg.evidence}
                      structuredEvidence={msg.structured_evidence}
                      dataLimitations={msg.data_limitations}
                      agentsUsed={msg.agents_used}
                      riskLevel={msg.risk_level}
                    />
                  </div>
                )}

                {/* Next Safe Window */}
                {msg.next_safe_window && (
                  <div className="chat-safe-window" style={{ marginTop: 8 }}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Next Safe Window: {msg.next_safe_window}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div className="chat-msg-row assistant">
            <div className="chat-msg-avatar orca">
              <Anchor className="w-3.5 h-3.5" />
            </div>
            <div className="chat-loading">
              <div className="chat-loading-dots">
                <div className="chat-loading-dot" />
                <div className="chat-loading-dot" />
                <div className="chat-loading-dot" />
              </div>
              <span className="chat-loading-text">ORCA multi-agent reasoning...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
