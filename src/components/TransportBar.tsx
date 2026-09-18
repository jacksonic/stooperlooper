import React, { useState, useRef } from 'react';
import { ProjectState } from '../types';
import { formatTimeSeconds, formatBarsBeats } from '../audio/waveformUtils';
import {
  Play,
  Pause,
  Square,
  Circle,
  Volume2,
  Bell,
  Download,
  Music,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface TransportBarProps {
  project: ProjectState;
  isPlaying: boolean;
  isRecording: boolean;
  isCountingIn: boolean;
  countInRemaining: number;
  playheadTime: number;
  metronomeActiveBeat: number;
  isDownbeat: boolean;
  masterVolume: number;
  masterMeterLevel: number;
  hasArmedTrack: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onUpdateBpm: (bpm: number) => void;
  onUpdateTimeSignature: (numerator: number) => void;
  onToggleMetronome: () => void;
  onUpdateMetronomeVolume: (vol: number) => void;
  onToggleCountIn: () => void;
  onUpdateMasterVolume: (vol: number) => void;
  onOpenExportModal: () => void;
  onLoadDemoProject: () => void;
  onResetProject: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  project,
  isPlaying,
  isRecording,
  isCountingIn,
  countInRemaining,
  playheadTime,
  metronomeActiveBeat,
  isDownbeat,
  masterVolume,
  masterMeterLevel,
  hasArmedTrack,
  onPlayPause,
  onStop,
  onRecord,
  onUpdateBpm,
  onUpdateTimeSignature,
  onToggleMetronome,
  onUpdateMetronomeVolume,
  onToggleCountIn,
  onUpdateMasterVolume,
  onOpenExportModal,
  onLoadDemoProject,
  onResetProject,
}) => {
  // Tap Tempo State
  const tapTimesRef = useRef<number[]>([]);
  const [tapActive, setTapActive] = useState(false);

  const handleTapTempo = () => {
    const now = performance.now();
    setTapActive(true);
    setTimeout(() => setTapActive(false), 120);

    const times = tapTimesRef.current;
    // reset if previous tap was > 2 seconds ago
    if (times.length > 0 && now - times[times.length - 1] > 2000) {
      tapTimesRef.current = [now];
      return;
    }

    times.push(now);
    if (times.length > 4) times.shift();

    if (times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        onUpdateBpm(calculatedBpm);
      }
    }
  };

  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 select-none z-40">
      {/* Brand & Transport Play/Stop/Record */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <Music className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">
              Stooper Looper
            </h1>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
              Audio Workstation
            </span>
          </div>
        </div>

        {/* Transport Action Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 shadow-inner">
          {/* Rewind to start */}
          <button
            id="transport-stop"
            type="button"
            onClick={onStop}
            title="Stop and Rewind to Start [Space/Enter]"
            className="w-9 h-9 flex items-center justify-center rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Play / Pause */}
          <button
            id="transport-play"
            type="button"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause Playback [Space]' : 'Start Playback [Space]'}
            className={`w-10 h-9 flex items-center justify-center rounded-md font-bold transition active:scale-95 ${
              isPlaying
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Master Record Button */}
          <button
            id="transport-record"
            type="button"
            onClick={onRecord}
            title={
              isRecording
                ? 'Stop Recording'
                : hasArmedTrack
                ? 'Start Recording on Armed Track'
                : 'Arm a track first to record'
            }
            className={`w-9 h-9 flex items-center justify-center rounded-md transition active:scale-95 ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                : isCountingIn
                ? 'bg-amber-600 text-white animate-pulse'
                : hasArmedTrack
                ? 'bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/60'
                : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'
            }`}
          >
            <Circle className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* Center Display: LED Time & Bars counter */}
      <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
        {/* Bars.Beats.16ths */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            Bars . Beats
          </span>
          <span className="text-base font-mono font-bold text-amber-400 tracking-wider">
            {formatBarsBeats(playheadTime, project.bpm, project.timeSignatureNumerator)}
          </span>
        </div>

        <div className="h-6 w-px bg-slate-800 mx-1" />

        {/* Min:Sec.Ms */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            Time
          </span>
          <span className="text-base font-mono font-bold text-slate-200 tracking-wider">
            {formatTimeSeconds(playheadTime)}
          </span>
        </div>

        {/* Count-In Banner if active */}
        {isCountingIn && (
          <div className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500 text-amber-300 font-mono text-xs font-bold animate-pulse">
            COUNT-IN: {countInRemaining}
          </div>
        )}
      </div>

      {/* Right Controls: Metronome, Tempo, Master Fader, Export */}
      <div className="flex items-center gap-3">
        {/* Metronome & Tempo Control Section */}
        <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
          {/* Metronome Click Toggle */}
          <button
            id="metronome-toggle"
            type="button"
            onClick={onToggleMetronome}
            title={project.metronomeEnabled ? 'Click Metronome ON (Click to mute)' : 'Click Metronome OFF'}
            className={`relative p-1.5 rounded-md flex items-center gap-1.5 transition ${
              project.metronomeEnabled
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800/80 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            {/* Visual Flashing Pulse Beat Indicator */}
            {isPlaying && project.metronomeEnabled && (
              <span
                className={`w-2 h-2 rounded-full transition-transform ${
                  isDownbeat
                    ? 'bg-amber-400 scale-125 shadow-[0_0_8px_#fbbf24]'
                    : metronomeActiveBeat > 0
                    ? 'bg-slate-300 scale-100'
                    : 'bg-slate-700'
                }`}
              />
            )}
          </button>

          {/* Count-in Toggle */}
          <button
            type="button"
            onClick={onToggleCountIn}
            title={`Recording Count-in: ${project.countInEnabled ? `${project.countInBars} Bar` : 'Off'}`}
            className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${
              project.countInEnabled
                ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'
            }`}
          >
            1-BAR IN
          </button>

          {/* BPM Slider & Tap Tempo */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="40"
                  max="240"
                  value={project.bpm}
                  onChange={(e) => onUpdateBpm(parseInt(e.target.value) || 120)}
                  className="w-12 text-center text-xs font-mono font-bold bg-slate-950 text-slate-200 border border-slate-800 rounded px-1 py-0.5 focus:border-amber-500 outline-none"
                />
                <span className="text-[10px] font-mono text-slate-400">BPM</span>
              </div>
            </div>

            {/* Tap Tempo Button */}
            <button
              id="tap-tempo-button"
              type="button"
              onClick={handleTapTempo}
              title="Tap repeatedly to set tempo"
              className={`px-1.5 py-1 rounded text-[10px] font-bold border transition ${
                tapActive
                  ? 'bg-amber-400 text-slate-950 border-amber-300 scale-95'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
              }`}
            >
              TAP
            </button>
          </div>
        </div>

        {/* Master Output Fader & VU Meter */}
        <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>MASTER</span>
              <span className="text-slate-200">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.02"
              value={masterVolume}
              onChange={(e) => onUpdateMasterVolume(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-slate-800 rounded accent-emerald-400 cursor-pointer"
              title="Master Mix Volume"
            />
          </div>

          {/* Master Stereo Peak Meter */}
          <div className="w-2.5 h-7 bg-slate-950 rounded overflow-hidden flex flex-col justify-end p-0.5 border border-slate-800">
            <div
              className={`w-full rounded-xs transition-all duration-75 ${
                masterMeterLevel > 0.9
                  ? 'bg-rose-500'
                  : masterMeterLevel > 0.65
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ height: `${Math.min(100, Math.round(masterMeterLevel * 100))}%` }}
            />
          </div>
        </div>

        {/* Presets & Reset */}
        <div className="hidden lg:flex items-center gap-1">
          <button
            type="button"
            onClick={onLoadDemoProject}
            title="Load 4-Track Demo Loops (Drums, Bass, Chords, Lead)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Demo Beat</span>
          </button>
          <button
            type="button"
            onClick={onResetProject}
            title="Clear all tracks"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* High-Quality MP3 Export Modal Trigger */}
        <button
          id="open-export-modal-button"
          type="button"
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)] transition active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export MP3</span>
        </button>
      </div>
    </header>
  );
};
