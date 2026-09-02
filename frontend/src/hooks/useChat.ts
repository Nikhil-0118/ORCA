import { useState, useCallback, useRef } from 'react';
import { ChatMessage, OrcaCompanionState } from '../types/chat.types';
import { DestinationPoint } from '../types/map.types';
import { chatService } from '../services/chatService';
import { initialChatState } from '../store/chatStore';
import { GeofenceEvaluation } from '../services/offlineSafetyService';

interface UseChatOptions {
  onRouteGenerated?: (destination: DestinationPoint) => void;
  isOffline?: boolean;
  offlineSafetyEval?: GeofenceEvaluation;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatState.messages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [companionState, setCompanionState] = useState<OrcaCompanionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const resetTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string>(`orca-sess-${Date.now()}`);

  const setCompanionStateWithTimeout = useCallback((state: OrcaCompanionState, durationMs = 4000) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setCompanionState(state);
    if (state === 'answering' || state === 'error') {
      resetTimerRef.current = window.setTimeout(() => {
        setCompanionState('idle');
      }, durationMs);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string, lat = 13.0827, lon = 80.2707) => {
      if (!text.trim()) return;

      const userMessage: ChatMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // If Offline Safety Mode is active, respond locally without making ANY network calls
      if (options.isOffline) {
        setIsLoading(false);
        const evalInfo = options.offlineSafetyEval;
        const safetySummary = evalInfo
          ? `Status: ${evalInfo.state} · Distance: ${evalInfo.distanceToBoundaryKm.toFixed(2)} km to ${evalInfo.nearestBoundaryName}\nAlert: ${evalInfo.alertMessage}`
          : 'Local geofence safety engine is monitoring vessel position.';

        const offlineNotice: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: `🔴 [OFFLINE SAFETY MODE ACTIVE]\n\nExternal AI agents and online APIs are unavailable while disconnected.\n\n${safetySummary}\n\nLocal GPS tracking and boundary safety checks continue running 100% offline.`,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, offlineNotice]);
        setCompanionStateWithTimeout('answering', 3500);
        return;
      }

      setIsLoading(true);
      setCompanionState('thinking');
      setError(null);

      try {
        const response = await chatService.sendQuery({
          query: text,
          lat,
          lon,
          session_id: sessionIdRef.current,
        });

        if (response && response.answer) {
          const assistantMessage: ChatMessage = {
            id: `ast-${Date.now()}`,
            role: 'assistant',
            content: response.answer,
            timestamp: new Date().toISOString(),
            evidence: response.evidence,
            structured_evidence: response.structured_evidence,
            risk_level: response.risk_level,
            risk_summary: response.risk_summary,
            recommendations: response.recommendations,
            suggested_actions: response.recommendations,
            data_limitations: response.data_limitations,
            agents_used: response.agents_used,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setCompanionStateWithTimeout('answering', 4500);
        } else {
          throw new Error('No answer received from ORCA backend.');
        }
      } catch (err: unknown) {
        // Clean error message without fake PFZ or route attachments
        const errorText =
          err instanceof Error && err.message && !err.message.includes('Failed to fetch')
            ? `Unable to reach ORCA backend: ${err.message}`
            : 'Unable to reach ORCA backend. Please make sure the ORCA server is running.';

        const errorMessage: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: errorText,
          timestamp: new Date().toISOString(),
        };

        setError(errorText);
        setMessages((prev) => [...prev, errorMessage]);
        setCompanionStateWithTimeout('error', 4500);
      } finally {
        setIsLoading(false);
      }
    },
    [options.isOffline, options.offlineSafetyEval, setCompanionStateWithTimeout]
  );

  const clearChat = useCallback(() => {
    setMessages(initialChatState.messages);
    setError(null);
    setCompanionState('idle');
    sessionIdRef.current = `orca-sess-${Date.now()}`;
  }, []);

  return {
    messages,
    isLoading,
    companionState,
    setCompanionState,
    setCompanionStateWithTimeout,
    error,
    sendMessage,
    clearChat,
  };
}
