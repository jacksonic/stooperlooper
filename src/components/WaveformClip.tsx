import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioClip, Track } from '../types';
import { extractWaveformData, calculateNormalizationGain } from '../audio/waveformUtils';
import { Volume2, Scissors, Trash2, Maximize2, MoveHorizontal } from 'lucide-react';

interface WaveformClipProps {
  clip: AudioClip;
  track: Track;
  pixelsPerSecond: number;
  timelineScrollLeft: number;
  snapToGrid: boolean;
  secondsPerSnap: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateClip: (updatedClip: AudioClip) => void;
  onDeleteClip: () => void;
}

export const WaveformClip: React.FC<WaveformClipProps> = ({
  clip,
  track,
  pixelsPerSecond,
  snapToGrid,
  secondsPerSnap,
  isSelected,
  onSelect,
  onUpdateClip,
  onDeleteClip,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [isTrimmingLeft, setIsTrimmingLeft] = useState(false);
  const [isTrimmingRight, setIsTrimmingRight] = useState(false);
  const [showGainMenu, setShowGainMenu] = useState(false);

  // Position and sizing in pixels
  const leftPx = clip.startTime * pixelsPerSecond;
  const widthPx = Math.max(30, clip.duration * pixelsPerSecond);

  // Generate / refresh peaks if missing
  useEffect(() => {
    if (!clip.rawPeaks && clip.buffer) {
      const data = extractWaveformData(clip.buffer, Math.ceil(widthPx * 2));
      onUpdateClip({
        ...clip,
        rawPeaks: data.peaks,
      });
    }
  }, [clip, widthPx, onUpdateClip]);

  // Draw high-resolution waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clip.buffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const clientW = Math.max(20, widthPx);
    const clientH = 92;

    canvas.width = clientW * dpr;
    canvas.height = clientH * dpr;
    canvas.style.width = `${clientW}px`;
    canvas.style.height = `${clientH}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, clientW, clientH);

    // Center horizontal baseline
    const midY = clientH / 2;
    const maxAmplitudeH = (clientH / 2) - 4;

    // Draw background subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(clientW, midY);
    ctx.stroke();

    // Amplitude scale based on clip.gain
    const amplitudeMultiplier = clip.gain;

    // Retrieve peaks
    const channelData = clip.buffer.getChannelData(0);
    const totalBufferSamples = clip.buffer.length;
    const trimStartSample = Math.floor((clip.trimStart / clip.buffer.duration) * totalBufferSamples);
    const clipSamples = Math.floor((clip.duration / clip.buffer.duration) * totalBufferSamples);

    // Color gradient based on track accent
    const grad = ctx.createLinearGradient(0, 0, 0, clientH);
    if (track.id === 1) {
      grad.addColorStop(0, '#38bdf8'); // sky blue
      grad.addColorStop(0.5, '#0284c7');
      grad.addColorStop(1, '#38bdf8');
    } else if (track.id === 2) {
      grad.addColorStop(0, '#fbbf24'); // amber
      grad.addColorStop(0.5, '#d97706');
      grad.addColorStop(1, '#fbbf24');
    } else if (track.id === 3) {
      grad.addColorStop(0, '#34d399'); // emerald
      grad.addColorStop(0.5, '#059669');
      grad.addColorStop(1, '#34d399');
    } else {
      grad.addColorStop(0, '#c084fc'); // violet
      grad.addColorStop(0.5, '#7c3aed');
      grad.addColorStop(1, '#c084fc');
    }

    ctx.fillStyle = grad;

    // Draw waveform bars per pixel column
    const step = Math.max(1, Math.floor(clipSamples / clientW));

    for (let x = 0; x < clientW; x++) {
      const sampleIdx = trimStartSample + Math.floor(x * (clipSamples / clientW));
      if (sampleIdx >= totalBufferSamples) break;

      let min = 1.0;
      let max = -1.0;

      for (let s = 0; s < step && sampleIdx + s < totalBufferSamples; s++) {
        const val = channelData[sampleIdx + s];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      // Visually scale with amplitude gain
      const scaledMin = Math.max(-1.0, min * amplitudeMultiplier);
      const scaledMax = Math.min(1.0, max * amplitudeMultiplier);

      const topY = midY - scaledMax * maxAmplitudeH;
      const bottomY = midY - scaledMin * maxAmplitudeH;
      const barH = Math.max(1.5, bottomY - topY);

      // Check clipping hot signal (when amplitude exceeds 1.0)
      if (Math.abs(min * amplitudeMultiplier) > 0.98 || Math.abs(max * amplitudeMultiplier) > 0.98) {
        ctx.fillStyle = '#ef4444'; // Red clip indicator
      } else {
        ctx.fillStyle = grad;
      }

      ctx.fillRect(x, topY, 1.2, barH);
    }

    // Draw Fade-in visual ramp curve
    if (clip.fadeIn > 0) {
      const fadeInPx = (clip.fadeIn / clip.duration) * clientW;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(fadeInPx, 0);
      ctx.lineTo(0, clientH);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, clientH);
      ctx.lineTo(fadeInPx, 0);
      ctx.stroke();
    }

    // Draw Fade-out visual ramp curve
    if (clip.fadeOut > 0) {
      const fadeOutPx = (clip.fadeOut / clip.duration) * clientW;
      const fadeStartX = clientW - fadeOutPx;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.moveTo(fadeStartX, 0);
      ctx.lineTo(clientW, 0);
      ctx.lineTo(clientW, clientH);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fadeStartX, 0);
      ctx.lineTo(clientW, clientH);
      ctx.stroke();
    }
  }, [clip, track.id, widthPx]);

  // Handle Horizontal Dragging to align audio
  const handleMouseDownBody = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    setIsDraggingClip(true);
    const startMouseX = e.clientX;
    const initialStartTime = clip.startTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      let newStartTime = initialStartTime + deltaX / pixelsPerSecond;

      if (snapToGrid && secondsPerSnap > 0) {
        newStartTime = Math.round(newStartTime / secondsPerSnap) * secondsPerSnap;
      }
      newStartTime = Math.max(0, newStartTime);

      onUpdateClip({
        ...clip,
        startTime: newStartTime,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingClip(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Left Trim Handle
  const handleMouseDownLeftTrim = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTrimmingLeft(true);
    const startMouseX = e.clientX;
    const initialStartTime = clip.startTime;
    const initialDuration = clip.duration;
    const initialTrimStart = clip.trimStart;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startMouseX) / pixelsPerSecond;
      const newDuration = Math.max(0.1, initialDuration - deltaSec);
      const newStartTime = initialStartTime + (initialDuration - newDuration);
      const newTrimStart = Math.min(clip.buffer.duration - 0.1, Math.max(0, initialTrimStart + deltaSec));

      onUpdateClip({
        ...clip,
        startTime: newStartTime,
        duration: newDuration,
        trimStart: newTrimStart,
      });
    };

    const handleMouseUp = () => {
      setIsTrimmingLeft(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Right Trim Handle
  const handleMouseDownRightTrim = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTrimmingRight(true);
    const startMouseX = e.clientX;
    const initialDuration = clip.duration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startMouseX) / pixelsPerSecond;
      const maxAvailable = clip.buffer.duration - clip.trimStart;
      const newDuration = Math.min(maxAvailable, Math.max(0.1, initialDuration + deltaSec));

      onUpdateClip({
        ...clip,
        duration: newDuration,
      });
    };

    const handleMouseUp = () => {
      setIsTrimmingRight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Normalize clip gain
  const handleNormalize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const gainMult = calculateNormalizationGain(clip.buffer);
    onUpdateClip({
      ...clip,
      gain: Number(gainMult.toFixed(2)),
    });
  };

  // dB to multiplier converter
  const gainDb = 20 * Math.log10(Math.max(0.001, clip.gain));

  return (
    <div
      ref={containerRef}
      id={`clip-${clip.id}`}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
      }}
      className={`absolute top-1 bottom-1 rounded-md overflow-visible select-none border transition-shadow cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'border-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/50'
          : 'border-slate-700/80 hover:border-slate-500/80'
      } ${isDraggingClip ? 'opacity-90 z-30' : 'z-10'} bg-slate-900/90 backdrop-blur-xs`}
      onMouseDown={handleMouseDownBody}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Left Trim Handle */}
      <div
        title="Drag to trim start"
        className="absolute left-0 top-0 bottom-0 w-2.5 z-20 hover:w-3.5 bg-slate-800/80 hover:bg-amber-400/80 cursor-ew-resize transition-all rounded-l-md flex items-center justify-center group"
        onMouseDown={handleMouseDownLeftTrim}
      >
        <div className="w-0.5 h-6 bg-slate-400 group-hover:bg-slate-950 rounded-full" />
      </div>

      {/* Right Trim Handle */}
      <div
        title="Drag to trim end"
        className="absolute right-0 top-0 bottom-0 w-2.5 z-20 hover:w-3.5 bg-slate-800/80 hover:bg-amber-400/80 cursor-ew-resize transition-all rounded-r-md flex items-center justify-center group"
        onMouseDown={handleMouseDownRightTrim}
      >
        <div className="w-0.5 h-6 bg-slate-400 group-hover:bg-slate-950 rounded-full" />
      </div>

      {/* Clip Header Label */}
      <div className="absolute top-1 left-3 right-3 flex items-center justify-between text-[11px] font-medium pointer-events-none z-10">
        <div className="flex items-center gap-1.5 bg-slate-950/75 px-1.5 py-0.5 rounded text-slate-200 border border-slate-800/80">
          <MoveHorizontal className="w-3 h-3 text-slate-400" />
          <span className="truncate max-w-[120px]">{clip.name}</span>
          <span className="text-slate-400 text-[10px]">
            {clip.startTime >= 0 ? `+${clip.startTime.toFixed(2)}s` : `${clip.startTime.toFixed(2)}s`}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950/75 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800/80">
          <span>{gainDb >= 0 ? `+${gainDb.toFixed(1)}` : gainDb.toFixed(1)} dB</span>
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="w-full h-full flex items-center justify-center px-2 py-3 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Quick Action Overlay (shows when selected) */}
      {isSelected && (
        <div
          className="absolute -top-9 right-1 z-40 flex items-center gap-1 bg-slate-950/95 border border-slate-700/80 rounded-md px-1.5 py-1 shadow-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Amplitude Gain slider */}
          <div className="flex items-center gap-1 text-[11px] text-slate-300 px-1">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] w-8">{clip.gain.toFixed(1)}x</span>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={clip.gain}
              title={`Clip Gain Multiplier: ${(clip.gain * 100).toFixed(0)}% (${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)} dB)`}
              onChange={(e) => {
                onUpdateClip({
                  ...clip,
                  gain: parseFloat(e.target.value),
                });
              }}
              className="w-16 h-1.5 accent-amber-400 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          {/* Normalize Peak button */}
          <button
            id={`normalize-clip-${clip.id}`}
            type="button"
            onClick={handleNormalize}
            title="Normalize peak amplitude to 0 dBFS"
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
          >
            <Maximize2 className="w-2.5 h-2.5 text-sky-400" />
            Normalize
          </button>

          {/* Fade In & Out quick toggles */}
          <div className="flex items-center gap-0.5 text-[10px] text-slate-400 border-l border-slate-800 pl-1">
            <span className="text-[9px]">Fade:</span>
            <button
              type="button"
              onClick={() => onUpdateClip({ ...clip, fadeIn: clip.fadeIn > 0 ? 0 : 0.15 })}
              className={`px-1 py-0.5 rounded text-[10px] ${clip.fadeIn > 0 ? 'bg-amber-500/30 text-amber-300' : 'hover:bg-slate-800 text-slate-400'}`}
              title="Toggle 150ms Fade-In"
            >
              In
            </button>
            <button
              type="button"
              onClick={() => onUpdateClip({ ...clip, fadeOut: clip.fadeOut > 0 ? 0 : 0.2 })}
              className={`px-1 py-0.5 rounded text-[10px] ${clip.fadeOut > 0 ? 'bg-amber-500/30 text-amber-300' : 'hover:bg-slate-800 text-slate-400'}`}
              title="Toggle 200ms Fade-Out"
            >
              Out
            </button>
          </div>

          {/* Delete Clip */}
          <button
            id={`delete-clip-${clip.id}`}
            type="button"
            onClick={onDeleteClip}
            title="Delete this audio clip"
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
