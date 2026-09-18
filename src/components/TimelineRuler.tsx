import React, { useRef, useEffect } from 'react';
import { ProjectState } from '../types';
import { formatTimeSeconds } from '../audio/waveformUtils';
import { ZoomIn, ZoomOut, Magnet, Repeat } from 'lucide-react';

interface TimelineRulerProps {
  project: ProjectState;
  pixelsPerSecond: number;
  playheadTime: number;
  timelineTotalSeconds: number;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onSeek: (time: number) => void;
  onUpdateLoop: (start: number, end: number) => void;
  onToggleLooping: () => void;
  onZoomChange: (newPps: number) => void;
  onToggleSnap: () => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  project,
  pixelsPerSecond,
  playheadTime,
  timelineTotalSeconds,
  scrollRef,
  onSeek,
  onUpdateLoop,
  onToggleLooping,
  onZoomChange,
  onToggleSnap,
}) => {
  const localRulerRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = scrollRef || localRulerRef;
  const rulerPlayheadRef = useRef<HTMLDivElement | null>(null);

  // High-performance event listener for 60fps/120fps playhead tracking
  useEffect(() => {
    const handlePlayheadEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ time: number; isPlaying: boolean }>;
      if (rulerPlayheadRef.current && customEvent.detail) {
        const px = customEvent.detail.time * pixelsPerSecond;
        rulerPlayheadRef.current.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    };

    window.addEventListener('looper:playhead', handlePlayheadEvent);
    return () => window.removeEventListener('looper:playhead', handlePlayheadEvent);
  }, [pixelsPerSecond]);

  // Sync on prop change or seek
  useEffect(() => {
    if (rulerPlayheadRef.current) {
      const px = playheadTime * pixelsPerSecond;
      rulerPlayheadRef.current.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }, [playheadTime, pixelsPerSecond]);

  const secondsPerBeat = 60.0 / project.bpm;
  const secondsPerBar = secondsPerBeat * project.timeSignatureNumerator;
  const totalBars = Math.ceil(timelineTotalSeconds / secondsPerBar) + 2;

  // Handle click / drag on timeline ruler to seek
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = Math.max(0, clickX / pixelsPerSecond);

    onSeek(clickedTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveX = moveEvent.clientX - rect.left;
      const moveTime = Math.max(0, moveX / pixelsPerSecond);
      onSeek(moveTime);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Loop Start / End dragging
  const handleLoopHandleMouseDown = (handle: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveX = moveEvent.clientX - rect.left;
      let newTime = Math.max(0, moveX / pixelsPerSecond);

      if (project.snapToGrid) {
        newTime = Math.round(newTime / secondsPerBeat) * secondsPerBeat;
      }

      if (handle === 'start') {
        onUpdateLoop(Math.min(newTime, project.loopEnd - 0.2), project.loopEnd);
      } else {
        onUpdateLoop(project.loopStart, Math.max(newTime, project.loopStart + 0.2));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const loopStartPx = project.loopStart * pixelsPerSecond;
  const loopEndPx = project.loopEnd * pixelsPerSecond;
  const loopWidthPx = Math.max(10, loopEndPx - loopStartPx);

  return (
    <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center select-none sticky top-0 z-30">
      {/* Left fixed utility box over track headers */}
      <div className="w-72 shrink-0 h-full border-r border-slate-800 px-3 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-1.5">
          {/* Loop Toggle */}
          <button
            type="button"
            onClick={onToggleLooping}
            title={project.isLooping ? 'Loop Mode Enabled (Click to disable)' : 'Enable Loop Mode'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition ${
              project.isLooping
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>LOOP</span>
          </button>

          {/* Snap to Grid */}
          <button
            type="button"
            onClick={onToggleSnap}
            title={project.snapToGrid ? 'Snap to Grid ON' : 'Free Drag Mode (Snap OFF)'}
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs font-medium transition ${
              project.snapToGrid
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>SNAP</span>
          </button>
        </div>

        {/* Zoom In / Out */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(40, pixelsPerSecond - 20))}
            title="Zoom Out Timeline"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono w-7 text-center">
            {Math.round((pixelsPerSecond / 100) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(300, pixelsPerSecond + 20))}
            title="Zoom In Timeline"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Ruler Canvas / Area */}
      <div
        ref={rulerRef}
        onMouseDown={handleRulerMouseDown}
        className="flex-1 h-full relative cursor-pointer overflow-hidden"
        style={{ minWidth: `${timelineTotalSeconds * pixelsPerSecond}px` }}
      >
        {/* Playhead Cursor Marker in Ruler */}
        <div
          id="ruler-playhead"
          ref={rulerPlayheadRef}
          style={{
            transform: `translate3d(${playheadTime * pixelsPerSecond}px, 0, 0)`,
            willChange: 'transform',
          }}
          className="absolute top-0 bottom-0 left-0 w-0.5 bg-amber-400 z-30 pointer-events-none shadow-[0_0_6px_#fbbf24]"
        >
          <div className="absolute -bottom-1 -left-1.5 w-3.5 h-3.5 bg-amber-400 rotate-45 rounded-xs" />
        </div>

        {/* Loop Region Highlight Bar */}
        {project.isLooping && (
          <div
            style={{
              left: `${loopStartPx}px`,
              width: `${loopWidthPx}px`,
            }}
            className="absolute top-0 bottom-0 bg-amber-500/15 border-t-2 border-amber-400 z-10 pointer-events-none"
          >
            <div className="text-[10px] font-bold text-amber-300 px-1.5 py-0.5 select-none">
              Loop ({project.loopBars} bars)
            </div>
          </div>
        )}

        {/* Loop Start Handle */}
        {project.isLooping && (
          <div
            style={{ left: `${loopStartPx - 6}px` }}
            className="absolute top-0 w-3 h-5 bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center rounded-b cursor-ew-resize z-20 shadow hover:scale-110 transition-transform"
            title="Drag Loop Start"
            onMouseDown={(e) => handleLoopHandleMouseDown('start', e)}
          >
            ▲
          </div>
        )}

        {/* Loop End Handle */}
        {project.isLooping && (
          <div
            style={{ left: `${loopEndPx - 6}px` }}
            className="absolute top-0 w-3 h-5 bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center rounded-b cursor-ew-resize z-20 shadow hover:scale-110 transition-transform"
            title="Drag Loop End"
            onMouseDown={(e) => handleLoopHandleMouseDown('end', e)}
          >
            ▲
          </div>
        )}

        {/* Bar & Beat Ruler markings */}
        {Array.from({ length: totalBars }).map((_, barIdx) => {
          const barStartSec = barIdx * secondsPerBar;
          const barLeftPx = barStartSec * pixelsPerSecond;

          return (
            <div key={barIdx} className="absolute top-0 bottom-0" style={{ left: `${barLeftPx}px` }}>
              {/* Major Bar Division Line */}
              <div className="h-full border-l border-slate-700/80 flex flex-col justify-between pl-1 pb-1">
                <span className="text-[11px] font-bold text-slate-300">
                  {barIdx + 1}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {formatTimeSeconds(barStartSec)}
                </span>
              </div>

              {/* Sub-beats (1.2, 1.3, 1.4) */}
              {Array.from({ length: project.timeSignatureNumerator - 1 }).map((__, beatIdx) => {
                const beatSec = (beatIdx + 1) * secondsPerBeat;
                const beatPx = beatSec * pixelsPerSecond;
                return (
                  <div
                    key={beatIdx}
                    className="absolute top-3 bottom-0 border-l border-slate-800/80 pl-1"
                    style={{ left: `${beatPx}px` }}
                  >
                    <span className="text-[9px] text-slate-500">
                      .{beatIdx + 2}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
