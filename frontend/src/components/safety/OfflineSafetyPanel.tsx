import React from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Wifi,
  WifiOff,
  Compass,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  MapPin,
  Flame,
} from 'lucide-react';
import {
  useOfflineSafety,
  PRESET_LOCATIONS,
  LocationPreset,
} from '../../hooks/useOfflineSafety';
import { SafetyState } from '../../services/offlineSafetyService';

interface OfflineSafetyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  safetyHook: ReturnType<typeof useOfflineSafety>;
}

function getStateBadge(state: SafetyState) {
  switch (state) {
    case 'BREACH':
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.4)',
        color: '#ef4444',
        icon: Flame,
        label: 'CRITICAL BREACH',
      };
    case 'WARNING':
      return {
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.4)',
        color: '#f59e0b',
        icon: AlertTriangle,
        label: 'WARNING ZONE',
      };
    case 'APPROACHING':
      return {
        bg: 'rgba(234, 179, 8, 0.15)',
        border: 'rgba(234, 179, 8, 0.4)',
        color: '#eab308',
        icon: ShieldAlert,
        label: 'APPROACHING',
      };
    default:
      return {
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.4)',
        color: '#10b981',
        icon: ShieldCheck,
        label: 'NORMAL (SAFE)',
      };
  }
}

export const OfflineSafetyPanel: React.FC<OfflineSafetyPanelProps> = ({
  isOpen,
  onClose,
  safetyHook,
}) => {
  if (!isOpen) return null;

  const {
    latitude,
    longitude,
    stepSize,
    setStepSize,
    isOffline,
    isSimulatedOffline,
    evaluation,
    alertHistory,
    moveNorth,
    moveSouth,
    moveEast,
    moveWest,
    loadPreset,
    toggleSimulatedOffline,
  } = safetyHook;

  const badge = getStateBadge(evaluation.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0b1329] border border-cyan-500/30 p-6 shadow-2xl shadow-black/80 flex flex-col space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Offline Safety & Geofence Engine
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-950/60 border border-cyan-800 text-cyan-300">
                  Phase 7
                </span>
              </div>
              <p className="text-xs text-slate-400">
                100% Local Geodesic Calculation · Zero Network · Deterministic Alerts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
            aria-label="Close safety panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connectivity Status Banner & Simulate Internet Toggle */}
        <div className="p-4 rounded-2xl bg-[#070c18] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl flex items-center justify-center ${
                isOffline
                  ? 'bg-red-950/80 border border-red-500/50 text-red-400 animate-pulse'
                  : 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-400'
              }`}
            >
              {isOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold uppercase ${
                    isOffline ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {isOffline ? '🔴 OFFLINE SAFETY MODE' : '🟢 ONLINE MODE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isOffline
                  ? 'AI Agents: Disabled · Local Geofence: Active'
                  : 'AI Agents: Available · Geofence: Active'}
              </p>
            </div>
          </div>

          {/* Dev Switch */}
          <button
            type="button"
            onClick={() => toggleSimulatedOffline()}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
              isSimulatedOffline
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>
              {isSimulatedOffline ? 'Simulating Offline (Active)' : 'Simulate Internet OFF'}
            </span>
          </button>
        </div>

        {/* Telemetry Readout Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Latitude</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1">
              {latitude.toFixed(4)}° N
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Longitude</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1">
              {longitude.toFixed(4)}° E
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Border Distance</div>
            <div className="text-sm font-bold font-mono text-cyan-400 mt-1">
              {evaluation.distanceToBoundaryKm.toFixed(2)} km
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Bearing</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>{evaluation.bearingDegrees}°</span>
            </div>
          </div>
        </div>

        {/* Active Status & Alert Banner */}
        <div
          className="p-4 rounded-2xl border transition-all"
          style={{
            backgroundColor: badge.bg,
            borderColor: badge.border,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <badge.icon className="w-4 h-4" style={{ color: badge.color }} />
              <span className="text-xs font-mono font-bold uppercase" style={{ color: badge.color }}>
                {badge.label}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {new Date(evaluation.evaluatedAt).toLocaleTimeString()}
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-100">{evaluation.alertTitle}</h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {evaluation.alertMessage}
          </p>

          <div className="mt-2 text-[10px] font-mono text-slate-400">
            Nearest Feature: {evaluation.nearestBoundaryName}
          </div>
        </div>

        {/* Simulator Controls & Presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* D-Pad Controls */}
          <div className="p-4 rounded-2xl bg-[#070c18] border border-slate-800 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3">
              <span className="text-xs font-bold text-slate-300">Vessel D-Pad Simulator</span>
              {/* Step Size Selector */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {[
                  { label: '0.01° (1km)', val: 0.01 },
                  { label: '0.05° (5km)', val: 0.05 },
                  { label: '0.10° (11km)', val: 0.1 },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => setStepSize(s.val)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      stepSize === s.val
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* D-Pad layout */}
            <div className="grid grid-cols-3 gap-2 w-44 my-2">
              <div />
              <button
                type="button"
                onClick={moveNorth}
                className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white transition-all flex items-center justify-center active:scale-95 shadow-md"
                title="Move North (+Lat)"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />

              <button
                type="button"
                onClick={moveWest}
                className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white transition-all flex items-center justify-center active:scale-95 shadow-md"
                title="Move West (-Lon)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/50 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-cyan-400" />
              </div>
              <button
                type="button"
                onClick={moveEast}
                className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white transition-all flex items-center justify-center active:scale-95 shadow-md"
                title="Move East (+Lon)"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              <div />
              <button
                type="button"
                onClick={moveSouth}
                className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white transition-all flex items-center justify-center active:scale-95 shadow-md"
                title="Move South (-Lat)"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <div />
            </div>

            <span className="text-[10px] font-mono text-slate-500 mt-2">
              Click arrows to step vessel position
            </span>
          </div>

          {/* Presets List */}
          <div className="p-4 rounded-2xl bg-[#070c18] border border-slate-800 flex flex-col">
            <span className="text-xs font-bold text-slate-300 mb-2">Test Location Presets</span>
            <div className="space-y-1.5 flex-1 overflow-y-auto max-h-48 pr-1">
              {PRESET_LOCATIONS.map((preset: LocationPreset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-800/80 hover:border-cyan-500/40 transition-all flex items-start gap-2.5"
                >
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {preset.expectedState}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {preset.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alert History Log (if any) */}
        {alertHistory.length > 0 && (
          <div className="p-3 rounded-2xl bg-[#070c18] border border-slate-800">
            <span className="text-xs font-bold text-slate-300 block mb-2">
              Recent State Transitions ({alertHistory.length})
            </span>
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {alertHistory.map((hist, idx) => (
                <div
                  key={idx}
                  className="text-xs p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                >
                  <span className="font-mono text-slate-300">
                    {hist.state} · {hist.distanceToBoundaryKm.toFixed(2)} km
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(hist.evaluatedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="text-[10px] font-mono text-slate-500 text-center border-t border-slate-800/60 pt-3">
          {evaluation.warning}
        </div>
      </div>
    </div>
  );
};
