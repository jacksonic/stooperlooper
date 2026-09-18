import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Track, AudioClip } from '../types';
import { TrackHeader } from './TrackHeader';
import { WaveformClip } from './WaveformClip';
import { TimelineRuler } from './TimelineRuler';
import { Mic, Upload, Plus } from 'lucide-react';

interface MultitrackTimelineProps {
  project: ProjectState;
  playheadTime: number;
  pixelsPerSecond: number;
  timelineTotalSeconds: number;
  isRecording: boolean;
  isCountingIn: boolean;
  countInRemaining: number;
  armedTrackId: number | null;
  micInputLevel: number;
  trackMeters?: { [trackId: number]: number };
  onSeek: (time: number) => void;
  onUpdateLoop: (start: number, end: number) => void;
  onToggleLooping: () => void;
  onZoomChange: (pps: number) => void;
  onToggleSnap: () => void;
  onUpdateTrack: (trackId: number, updated: Partial<Track>) => void;
  onArmTrack: (trackId: number) => void;
  onRecordTrigger: (trackId: number) => void;
  onImportFileToTrack: (trackId: number, file: File) => void;
  onClearTrack: (trackId: number) => void;
  onUpdateClip: (trackId: number, updatedClip: AudioClip) => void;
  onDeleteClip: (trackId: number) => void;
}

export const MultitrackTimeline: React.FC<MultitrackTimelineProps> = ({
  project,
  playheadTime,
  pixelsPerSecond,
  timelineTotalSeconds,
  isRecording,
  isCountingIn,
  countInRemaining,
  armedTrackId,
  micInputLevel,
  trackMeters,
  onSeek,
  onUpdateLoop,
  onToggleLooping,
  onZoomChange,
  onToggleSnap,
  onUpdateTrack,
  onArmTrack,
  onRecordTrigger,
  onImportFileToTrack,
  onClearTrack,
  onUpdateClip,
  onDeleteClip,
}) => {
  const [selectedClipTrackId, setSelectedClipTrackId] = useState<number | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<number | null>(null);
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const playheadBarRef = useRef<HTMLDivElement | null>(null);

  const secondsPerBeat = 60.0 / project.bpm;
  const secondsPerBar = secondsPerBeat * project.timeSignatureNumerator;
  const totalBars = Math.ceil(timelineTotalSeconds / secondsPerBar) + 2;

  const playheadPx = playheadTime * pixelsPerSecond;

  // Direct high-performance event listener for 60fps/120fps/144fps vertical playhead updates
  useEffect(() => {
    const handlePlayheadEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ time: number; isPlaying: boolean }>;
      if (playheadBarRef.current && customEvent.detail) {
        const px = 288 + customEvent.detail.time * pixelsPerSecond;
        playheadBarRef.current.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    };

    window.addEventListener('looper:playhead', handlePlayheadEvent);
    return () => window.removeEventListener('looper:playhead', handlePlayheadEvent);
  }, [pixelsPerSecond]);

  // Keep playhead bar in sync on seek, stop, or zoom
  useEffect(() => {
    if (playheadBarRef.current) {
      const px = 288 + playheadTime * pixelsPerSecond;
      playheadBarRef.current.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }, [playheadTime, pixelsPerSecond]);

  // Handle horizontal scroll sync between tracks and ruler
  const handleTracksScroll = () => {
    if (tracksScrollRef.current && rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = tracksScrollRef.current.scrollLeft;
    }
  };

  // Handle Drag & Drop of audio files directly onto track lanes
  const handleDragOver = (trackId: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTrackId(trackId);
  };

  const handleDragLeave = (trackId: number) => {
    if (dragOverTrackId === trackId) {
      setDragOverTrackId(null);
    }
  };

  const handleDrop = (trackId: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTrackId(null);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onImportFileToTrack(trackId, file);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative select-none">
      {/* Timeline Ruler at Top */}
      <TimelineRuler
        project={project}
        pixelsPerSecond={pixelsPerSecond}
        playheadTime={playheadTime}
        timelineTotalSeconds={timelineTotalSeconds}
        scrollRef={rulerScrollRef}
        onSeek={onSeek}
        onUpdateLoop={onUpdateLoop}
        onToggleLooping={onToggleLooping}
        onZoomChange={onZoomChange}
        onToggleSnap={onToggleSnap}
      />

      {/* Main 4-Track Container */}
      <div
        ref={tracksScrollRef}
        onScroll={handleTracksScroll}
        className="flex-1 overflow-x-auto overflow-y-auto relative flex flex-col"
        onClick={() => setSelectedClipTrackId(null)}
      >
        <div
          className="flex flex-col min-w-max relative"
          style={{ width: `${Math.max(window.innerWidth, 288 + timelineTotalSeconds * pixelsPerSecond)}px` }}
        >
          {/* Vertical Playhead Cursor Line (Stretches across all tracks) */}
          <div
            id="timeline-playhead"
            ref={playheadBarRef}
            style={{
              transform: `translate3d(${288 + playheadPx}px, 0, 0)`,
              willChange: 'transform',
            }}
            className="absolute top-0 bottom-0 left-0 w-0.5 bg-amber-400 z-40 pointer-events-none shadow-[0_0_8px_#fbbf24]"
          >
            {/* Playhead handle flag */}
            <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-amber-400 rotate-45 rounded-xs" />
          </div>

          {/* Loop Region background shade across timeline */}
          {project.isLooping && (
            <div
              style={{
                left: `${288 + project.loopStart * pixelsPerSecond}px`,
                width: `${Math.max(0, (project.loopEnd - project.loopStart) * pixelsPerSecond)}px`,
              }}
              className="absolute top-0 bottom-0 bg-amber-400/5 pointer-events-none z-0 border-x border-amber-400/20"
            />
          )}

          {/* The 4 Audio Tracks */}
          {project.tracks.map((track) => {
            const isArmed = track.armed;
            const isRecordingThis = isRecording && armedTrackId === track.id;
            const isDragOver = dragOverTrackId === track.id;

            return (
              <div
                key={track.id}
                id={`track-row-${track.id}`}
                className={`flex h-28 border-b border-slate-800/80 relative transition-colors ${
                  isArmed ? 'bg-red-950/10' : 'bg-slate-900/30'
                } ${isDragOver ? 'bg-amber-950/30 ring-2 ring-amber-500' : ''}`}
                onDragOver={(e) => handleDragOver(track.id, e)}
                onDragLeave={() => handleDragLeave(track.id)}
                onDrop={(e) => handleDrop(track.id, e)}
              >
                {/* Track Left Mixer Controls */}
                <TrackHeader
                  track={track}
                  isRecordingThisTrack={isRecordingThis}
                  isCountingIn={isCountingIn && isArmed}
                  micInputLevel={micInputLevel}
                  meterLevel={trackMeters ? trackMeters[track.id] : undefined}
                  onUpdateTrack={(updated) => onUpdateTrack(track.id, updated)}
                  onArmTrack={() => onArmTrack(track.id)}
                  onRecordTrigger={() => onRecordTrigger(track.id)}
                  onImportFile={(file) => onImportFileToTrack(track.id, file)}
                  onClearTrack={() => onClearTrack(track.id)}
                />

                {/* Track Right Timeline Lane */}
                <div
                  className="flex-1 relative h-full overflow-hidden"
                  style={{ minWidth: `${timelineTotalSeconds * pixelsPerSecond}px` }}
                  onClick={(e) => {
                    // Click on empty area of track to seek
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    onSeek(Math.max(0, clickX / pixelsPerSecond));
                  }}
                >
                  {/* Background Grid Lines: Bars & Beats */}
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: totalBars }).map((_, barIdx) => {
                      const barLeftPx = barIdx * secondsPerBar * pixelsPerSecond;
                      return (
                        <div
                          key={barIdx}
                          className="absolute top-0 bottom-0 border-l border-slate-800/60"
                          style={{ left: `${barLeftPx}px` }}
                        >
                          {Array.from({ length: project.timeSignatureNumerator - 1 }).map((__, bIdx) => (
                            <div
                              key={bIdx}
                              className="absolute top-0 bottom-0 border-l border-slate-800/30"
                              style={{ left: `${(bIdx + 1) * secondsPerBeat * pixelsPerSecond}px` }}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Waveform Clip (if present) */}
                  {track.clip && (
                    <WaveformClip
                      clip={track.clip}
                      track={track}
                      pixelsPerSecond={pixelsPerSecond}
                      timelineScrollLeft={0}
                      snapToGrid={project.snapToGrid}
                      secondsPerSnap={secondsPerBeat}
                      isSelected={selectedClipTrackId === track.id}
                      onSelect={() => setSelectedClipTrackId(track.id)}
                      onUpdateClip={(updatedClip) => onUpdateClip(track.id, updatedClip)}
                      onDeleteClip={() => onDeleteClip(track.id)}
                    />
                  )}

                  {/* Live Recording Waveform Placeholder (during active recording) */}
                  {isRecordingThis && (
                    <div
                      style={{
                        left: `${playheadPx}px`,
                        width: '120px',
                      }}
                      className="absolute top-2 bottom-2 rounded-md bg-red-600/30 border border-red-500 flex items-center justify-center gap-2 text-red-200 text-xs font-bold animate-pulse z-20"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span>Recording...</span>
                    </div>
                  )}

                  {/* Empty Track Prompt */}
                  {!track.clip && !isRecordingThis && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        Arm track to record microphone, or drop audio file here
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
