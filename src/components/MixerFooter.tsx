import React from 'react';
import { ProjectState } from '../types';
import {
  AlignLeft,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  Keyboard,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface MixerFooterProps {
  project: ProjectState;
  onSetLoopBars: (bars: number) => void;
  onAlignAllClipsToStart: () => void;
  onQuantizeClips: () => void;
  onNudgeActiveClips: (deltaSeconds: number) => void;
}

export const MixerFooter: React.FC<MixerFooterProps> = ({
  project,
  onSetLoopBars,
  onAlignAllClipsToStart,
  onQuantizeClips,
  onNudgeActiveClips,
}) => {
  const secondsPerBeat = 60.0 / project.bpm;
  const secondsPerBar = secondsPerBeat * project.timeSignatureNumerator;

  return (
    <footer className="h-12 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between gap-4 text-xs select-none">
      {/* Loop Length Presets */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 font-semibold text-[11px]">Loop Length:</span>
        <div className="flex items-center gap-1">
          {[1, 2, 4, 8].map((bars) => {
            const isCurrent = Math.round((project.loopEnd - project.loopStart) / secondsPerBar) === bars;
            return (
              <button
                key={bars}
                type="button"
                onClick={() => onSetLoopBars(bars)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {bars} {bars === 1 ? 'Bar' : 'Bars'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alignment & Timing Utilities */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 font-semibold text-[11px]">Audio Alignment:</span>
        
        {/* Nudge -10ms / +10ms */}
        <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            type="button"
            onClick={() => onNudgeActiveClips(-0.01)}
            title="Nudge all clips left by 10 milliseconds"
            className="px-1.5 py-0.5 rounded text-[11px] text-slate-300 hover:bg-slate-800 flex items-center gap-0.5"
          >
            <ChevronsLeft className="w-3 h-3" />
            -10ms
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={() => onNudgeActiveClips(0.01)}
            title="Nudge all clips right by 10 milliseconds"
            className="px-1.5 py-0.5 rounded text-[11px] text-slate-300 hover:bg-slate-800 flex items-center gap-0.5"
          >
            +10ms
            <ChevronsRight className="w-3 h-3" />
          </button>
        </div>

        {/* Align to 0:00 */}
        <button
          type="button"
          onClick={onAlignAllClipsToStart}
          title="Align start of all clips to Beat 1 (0:00)"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
        >
          <AlignLeft className="w-3 h-3 text-sky-400" />
          <span>Align to 1.1</span>
        </button>

        {/* Quantize to Beat Grid */}
        <button
          type="button"
          onClick={onQuantizeClips}
          title="Snap clip start offsets to nearest beat grid"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Quantize Grid</span>
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="hidden md:flex items-center gap-3 text-slate-400 text-[11px]">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-300">
            Space
          </kbd>
          <span>Play/Pause</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-300">
            R
          </kbd>
          <span>Record</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-300">
            Drag
          </kbd>
          <span>Move & Align</span>
        </div>
      </div>
    </footer>
  );
};
