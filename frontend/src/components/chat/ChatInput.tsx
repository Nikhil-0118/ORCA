import React, { useState, KeyboardEvent } from 'react';
import { Send, Mic, Sparkles, Navigation } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  onVoiceClick?: () => void;
  isVoiceActive?: boolean;
  isLoading: boolean;
}

const QUICK_PROMPTS = [
  'Is it safe to go fishing tomorrow?',
  'What is the weather at my destination?',
  'Show me the safest route to Pulicat.',
  'Where is the nearest fishing zone?',
  'Will there be a storm?',
  'Take me to Kamarajar Ennore Port.',
  'Compare conditions to Mahabalipuram.',
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onVoiceClick,
  isVoiceActive = false,
  isLoading,
}) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleChipClick = (prompt: string) => {
    if (isLoading) return;
    onSend(prompt);
  };

  return (
    <div className="p-3 border-t border-slate-800 bg-navy-950/80 space-y-2.5">
      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-mono select-none">
        <span className="text-slate-500 shrink-0 flex items-center gap-1">
          <Navigation className="w-3 h-3 text-cyan-400" />
          <span>Ask:</span>
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleChipClick(prompt)}
            disabled={isLoading}
            className="shrink-0 px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-950/80 border border-slate-800 hover:border-cyan-700/60 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-95 shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Main Input Row */}
      <div className="flex items-center gap-2 bg-slate-900/90 rounded-xl px-3 py-2 border border-slate-700/60 focus-within:border-cyan-500/80 transition-colors shadow-inner">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ORCA (e.g. Take me to Pulicat, or is it safe to fish tomorrow?)"
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        {onVoiceClick && (
          <button
            type="button"
            onClick={onVoiceClick}
            aria-label="Voice input"
            title="Speak to ORCA"
            className={`p-1.5 rounded-lg transition-all ${
              isVoiceActive
                ? 'bg-cyan-500 text-navy-950 shadow-md shadow-cyan-500/50 animate-pulse'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="p-1.5 rounded-lg bg-cyan-500 text-navy-950 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

