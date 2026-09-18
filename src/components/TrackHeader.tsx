import React, { useRef } from 'react';
import { Track } from '../types';
import { Mic, Volume2, Upload, Trash2, Sliders, Radio } from 'lucide-react';

interface TrackHeaderProps {
  track: Track;
  isRecordingThisTrack: boolean;
  isCountingIn: boolean;
  micInputLevel: number; // 0..1 for mic level when armed
  meterLevel?: number;
  onUpdateTrack: (updated: Partial<Track>) => void;
  onArmTrack: () => void;
  onRecordTrigger: () => void;
  onImportFile: (file: File) => void;
  onClearTrack: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  isRecordingThisTrack,
  isCountingIn,
  micInputLevel,
  meterLevel,
  onUpdateTrack,
  onArmTrack,
  onRecordTrigger,
  onImportFile,
  onClearTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeMeter = meterLevel !== undefined ? meterLevel : (track.meterLevel || 0);

  // Convert linear volume (0..1.5) to dB string
  const getDbString = (vol: number) => {
    if (vol <= 0.001) return '-∞ dB';
    const db = 20 * Math.log10(vol);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  // Convert pan (-1..1) to readout string
  const getPanString = (pan: number) => {
    if (Math.abs(pan) < 0.05) return 'C';
    if (pan < 0) return `L${Math.round(Math.abs(pan) * 100)}`;
    return `R${Math.round(pan * 100)}`;
  };

  // Accent styles per track
  const accentColors: Record<number, { border: string; text: string; bg: string; ring: string }> = {
    1: { border: 'border-sky-500/40', text: 'text-sky-400', bg: 'bg-sky-500/10', ring: 'ring-sky-500' },
    2: { border: 'border-amber-500/40', text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500' },
    3: { border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500' },
    4: { border: 'border-purple-500/40', text: 'text-purple-400', bg: 'bg-purple-500/10', ring: 'ring-purple-500' },
  };
  const color = accentColors[track.id] || accentColors[1];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      id={`track-header-${track.id}`}
      className={`w-72 shrink-0 h-28 border-b border-r border-slate-800 bg-slate-900/95 p-2.5 flex flex-col justify-between transition-colors ${
        track.armed ? 'bg-red-950/20 border-r-red-900/50' : ''
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        className="hidden"
      />

      {/* Row 1: Track Number, Name, Record Arm, Solo, Mute */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold ${color.bg} ${color.text} border ${color.border}`}
          >
            {track.id}
          </span>
          <input
            type="text"
            value={track.name}
            onChange={(e) => onUpdateTrack({ name: e.target.value })}
            className="text-xs font-semibold text-slate-200 bg-transparent hover:bg-slate-800/60 focus:bg-slate-800 px-1 py-0.5 rounded border border-transparent focus:border-slate-600 outline-none truncate w-24"
            title="Click to rename track"
          />
        </div>

        {/* Buttons: Arm, Solo, Mute */}
        <div className="flex items-center gap-1">
          {/* Record Arm Button */}
          <button
            id={`arm-track-${track.id}`}
            type="button"
            onClick={onArmTrack}
            title={track.armed ? 'Track Armed for Recording (Click to Disarm)' : 'Arm Track for Recording'}
            className={`relative px-1.5 py-0.5 text-[11px] font-bold rounded flex items-center gap-1 transition ${
              track.armed
                ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] ring-1 ring-red-400'
                : 'bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                track.armed ? 'bg-white animate-pulse' : 'bg-red-500/70'
              }`}
            />
            REC
          </button>

          {/* Solo Button */}
          <button
            id={`solo-track-${track.id}`}
            type="button"
            onClick={() => onUpdateTrack({ soloed: !track.soloed })}
            title={track.soloed ? 'Solo Active (Click to disable)' : 'Solo Track'}
            className={`w-6 h-6 text-[11px] font-bold rounded transition flex items-center justify-center ${
              track.soloed
                ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                : 'bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700'
            }`}
          >
            S
          </button>

          {/* Mute Button */}
          <button
            id={`mute-track-${track.id}`}
            type="button"
            onClick={() => onUpdateTrack({ muted: !track.muted })}
            title={track.muted ? 'Mute Active (Click to un-mute)' : 'Mute Track'}
            className={`w-6 h-6 text-[11px] font-bold rounded transition flex items-center justify-center ${
              track.muted
                ? 'bg-rose-600 text-white font-black shadow-[0_0_8px_rgba(225,29,72,0.4)]'
                : 'bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700'
            }`}
          >
            M
          </button>
        </div>
      </div>

      {/* Row 2: Volume Fader + Output Meter + Pan Slider */}
      <div className="grid grid-cols-[1fr_auto_72px] gap-2 items-center bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
        {/* Volume Slider */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>VOL</span>
            <span className="text-slate-200">{getDbString(track.volume)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={track.volume}
            onChange={(e) => onUpdateTrack({ volume: parseFloat(e.target.value) })}
            className="h-1.5 bg-slate-800 rounded accent-slate-200 cursor-pointer w-full"
            title={`Volume: ${Math.round(track.volume * 100)}% (${getDbString(track.volume)})`}
          />
        </div>

        {/* Real-time Peak Output Meter (or Mic level when armed) */}
        <div className="w-2.5 h-7 bg-slate-900 rounded overflow-hidden flex flex-col justify-end p-0.5 border border-slate-800">
          <div
            className={`w-full rounded-xs transition-all duration-75 ${
              track.armed && !track.clip
                ? 'bg-red-500'
                : activeMeter > 0.85
                ? 'bg-rose-500'
                : activeMeter > 0.6
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{
              height: `${Math.min(100, Math.round((track.armed && !track.clip ? micInputLevel : activeMeter) * 100))}%`,
            }}
          />
        </div>

        {/* Pan Slider */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>PAN</span>
            <span className="text-slate-200">{getPanString(track.pan)}</span>
          </div>
          <input
            type="range"
            min="-1.0"
            max="1.0"
            step="0.05"
            value={track.pan}
            onChange={(e) => onUpdateTrack({ pan: parseFloat(e.target.value) })}
            className="h-1.5 bg-slate-800 rounded accent-slate-400 cursor-pointer w-full"
            title={`Pan: ${getPanString(track.pan)}`}
          />
        </div>
      </div>

      {/* Row 3: Clip Status & Action Buttons (Mic Rec, Import, Clear) */}
      <div className="flex items-center justify-between text-[11px] pt-0.5">
        <div className="flex items-center gap-1 text-slate-400">
          {track.clip ? (
            <span className="text-[10px] text-slate-300 font-medium truncate max-w-[110px]">
              {track.clip.duration.toFixed(1)}s • {(track.clip.buffer.sampleRate / 1000).toFixed(1)}kHz
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 italic">Empty track</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Record on this Track */}
          <button
            id={`quick-rec-${track.id}`}
            type="button"
            onClick={onRecordTrigger}
            title={isRecordingThisTrack ? 'Stop Recording' : 'Record Mic directly to this track'}
            className={`p-1 rounded text-[10px] flex items-center gap-0.5 transition ${
              isRecordingThisTrack
                ? 'bg-red-600 text-white animate-pulse'
                : isCountingIn && track.armed
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Mic className="w-3 h-3" />
            <span>{isRecordingThisTrack ? 'STOP' : 'REC'}</span>
          </button>

          {/* Import File Button */}
          <button
            id={`import-track-${track.id}`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import Audio File (WAV, MP3, etc.)"
            className="p-1 rounded text-[10px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center gap-0.5 transition"
          >
            <Upload className="w-3 h-3" />
            <span>FILE</span>
          </button>

          {/* Clear Track */}
          {track.clip && (
            <button
              id={`clear-track-${track.id}`}
              type="button"
              onClick={onClearTrack}
              title="Clear Track Audio"
              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
