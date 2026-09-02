import React, { useRef, useEffect } from 'react';
import { Anchor, Clock, Compass, Navigation, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ChatMessage } from '../../types/chat.types';
import { AgentActivityPanel } from './AgentActivityPanel';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
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
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '2px 8px',
                      borderRadius: 4,
                      marginBottom: 8,
                      backgroundColor:
                        msg.risk_level === 'low'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : msg.risk_level === 'moderate'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(239, 68, 68, 0.15)',
                      color:
                        msg.risk_level === 'low'
                          ? '#10b981'
                          : msg.risk_level === 'moderate'
                          ? '#f59e0b'
                          : '#ef4444',
                      border: `1px solid ${
                        msg.risk_level === 'low'
                          ? 'rgba(16, 185, 129, 0.25)'
                          : msg.risk_level === 'moderate'
                          ? 'rgba(245, 158, 11, 0.25)'
                          : 'rgba(239, 68, 68, 0.3)'
                      }`,
                    }}
                  >
                    {msg.risk_level === 'low' ? (
                      <ShieldCheck className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    <span>{msg.risk_level} Risk Assessment</span>
                  </div>
                )}

                <div className="chat-msg-content">{msg.content}</div>

                {/* Route Info Card (only rendered if legitimate route info is present) */}
                {msg.route_info && (
                  <div className="chat-route-card">
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

                {/* Agent Activity / Evidence Sources (expandable) */}
                {((msg.reasoning_steps && msg.reasoning_steps.length > 0) ||
                  (msg.evidence && msg.evidence.length > 0)) && (
                  <AgentActivityPanel
                    steps={msg.reasoning_steps}
                    evidence={msg.evidence}
                    riskLevel={msg.risk_level}
                  />
                )}

                {/* Suggested Actions / Recommendations */}
                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="chat-actions">
                    {msg.suggested_actions.map((action, aIdx) => (
                      <span key={aIdx} className="chat-action-chip">
                        <Compass className="w-3 h-3" style={{ color: '#06b6d4' }} />
                        {action}
                      </span>
                    ))}
                  </div>
                )}

                {/* Next Safe Window */}
                {msg.next_safe_window && (
                  <div className="chat-safe-window">
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
              <span className="chat-loading-text">ORCA multi-agent graph reasoning...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
