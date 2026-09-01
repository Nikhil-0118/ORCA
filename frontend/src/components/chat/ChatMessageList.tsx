import React from 'react';
import { Bot, User, Clock, Compass, Navigation } from 'lucide-react';
import { ChatMessage } from '../../types/chat.types';
import { ReasoningStepViewer } from './ReasoningStepViewer';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, isLoading }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg, index) => {
        const isAssistant = msg.role === 'assistant';
        return (
          <div
            key={msg.id || index}
            className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            {isAssistant && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-950 to-blue-900 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-md shadow-cyan-950/50">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
            )}

            <div
              className={`max-w-[88%] rounded-2xl p-4 text-sm ${
                isAssistant
                  ? 'bg-slate-900/90 text-slate-200 border border-slate-800/90 shadow-md space-y-3'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950/40'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* Destination & Route Summary Card */}
              {msg.route_info && (
                <div className="p-3 rounded-xl bg-navy-950/90 border border-cyan-800/60 shadow-md space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                      <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{msg.route_info.destinationName}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        msg.route_info.safetyClearance === 'SAFE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : msg.route_info.safetyClearance === 'CAUTION'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700/50'
                          : 'bg-red-950 text-red-300 border border-red-700/50'
                      }`}
                    >
                      {msg.route_info.safetyClearance}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 pt-0.5">
                    <div>
                      <span className="text-slate-500 block text-[9px]">Distance</span>
                      <span className="font-bold text-slate-100">{msg.route_info.distanceKm} km</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px]">Bearing</span>
                      <span className="font-bold text-cyan-300">{msg.route_info.bearingDegrees}°</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px]">Est. Time</span>
                      <span className="font-bold text-slate-100">{msg.route_info.estimatedTimeMinutes} min</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Show Reasoning trace for multi-agent synthesis */}
              {msg.reasoning_steps && msg.reasoning_steps.length > 0 && (
                <ReasoningStepViewer steps={msg.reasoning_steps} />
              )}

              {/* Suggested Actions if present */}
              {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {msg.suggested_actions.map((action, aIdx) => (
                    <span
                      key={aIdx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-cyan-300"
                    >
                      <Compass className="w-2.5 h-2.5 text-cyan-400" />
                      {action}
                    </span>
                  ))}
                </div>
              )}

              {/* Next Safe Window Badge if present */}
              {msg.next_safe_window && (
                <div className="flex items-center gap-2 text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-3 py-1.5 rounded-xl font-mono">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Next Safe Window: {msg.next_safe_window}</span>
                </div>
              )}
            </div>

            {!isAssistant && (
              <div className="w-8 h-8 rounded-xl bg-blue-900 border border-blue-700 flex items-center justify-center shrink-0 shadow-md">
                <User className="w-4 h-4 text-blue-200" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center gap-3 text-cyan-400 text-xs font-mono p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/30 animate-pulse">
          <Bot className="w-4 h-4 animate-spin" />
          <span>Specialist agents synthesizing MOSDAC, INCOIS & NavIC telemetry...</span>
        </div>
      )}
    </div>
  );
};

