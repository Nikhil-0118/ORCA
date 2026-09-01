import React, { useState } from 'react';
import { MessageSquare, RefreshCw, Radio } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { OrcaVoiceOverlay } from '../orca/OrcaVoiceOverlay';
import { DestinationPoint } from '../../types/map.types';
import { OrcaCompanionState } from '../../types/chat.types';

interface ChatContainerProps {
  currentLat?: number;
  currentLon?: number;
  onDestinationSelect?: (destination: DestinationPoint) => void;
  onCompanionStateChange?: (state: OrcaCompanionState) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  currentLat = 13.0827,
  currentLon = 80.2707,
  onDestinationSelect,
  onCompanionStateChange,
}) => {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const {
    messages,
    isLoading,
    companionState,
    setCompanionState,
    sendMessage,
    clearChat,
  } = useChat({
    onRouteGenerated: (dest) => {
      if (onDestinationSelect) {
        onDestinationSelect(dest);
      }
    },
  });

  // Keep parent companion state in sync if prop provided
  React.useEffect(() => {
    if (onCompanionStateChange) {
      onCompanionStateChange(companionState);
    }
  }, [companionState, onCompanionStateChange]);

  const {
    isListening,
    transcript,
    audioLevel,
    error: voiceError,
    startListening,
    stopListening,
    clearError: clearVoiceError,
  } = useVoiceRecognition({
    onResult: (text) => {
      sendMessage(text, currentLat, currentLon);
    },
  });

  const handleOpenVoice = () => {
    setIsVoiceModalOpen(true);
    setCompanionState('listening');
    startListening();
  };

  const handleCloseVoice = () => {
    stopListening();
    clearVoiceError();
    setIsVoiceModalOpen(false);
    setCompanionState('idle');
  };

  const handleVoiceSend = (spokenText: string) => {
    sendMessage(spokenText, currentLat, currentLon);
    handleCloseVoice();
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-navy-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">ORCA Marine Intelligence</h2>
            <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
              <span>Multi-Agent Synthesizer Active</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearChat}
          aria-label="Clear chat"
          title="Reset conversation"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message List */}
      <ChatMessageList messages={messages} isLoading={isLoading} />

      {/* Input Box */}
      <ChatInput
        onSend={(text) => sendMessage(text, currentLat, currentLon)}
        onVoiceClick={handleOpenVoice}
        isVoiceActive={isListening}
        isLoading={isLoading}
      />

      {/* Voice Recognition Modal / Overlay */}
      <OrcaVoiceOverlay
        isOpen={isVoiceModalOpen}
        isListening={isListening}
        transcript={transcript}
        audioLevel={audioLevel}
        error={voiceError}
        onClose={handleCloseVoice}
        onSend={handleVoiceSend}
        onRetry={() => {
          clearVoiceError();
          startListening();
        }}
      />
    </div>
  );
};

