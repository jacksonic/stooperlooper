import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, AudioClip } from './types';
import { AudioEngine } from './audio/AudioEngine';
import { generateStarterProjectBuffers } from './audio/starterSamples';
import { extractWaveformData } from './audio/waveformUtils';
import { TransportBar } from './components/TransportBar';
import { MultitrackTimeline } from './components/MultitrackTimeline';
import { MixerFooter } from './components/MixerFooter';
import { ExportModal } from './components/ExportModal';

const INITIAL_BPM = 120;
const INITIAL_BARS = 4;
const SECONDS_PER_BEAT = 60.0 / INITIAL_BPM;
const INITIAL_LOOP_DURATION = INITIAL_BARS * 4 * SECONDS_PER_BEAT; // 8.0s

const createDefaultTracks = (): Track[] => [
  {
    id: 1,
    name: 'Track 1 (Drums)',
    color: '#38bdf8',
    volume: 1.0,
    pan: 0.0,
    muted: false,
    soloed: false,
    armed: false,
    clip: null,
    meterLevel: 0,
  },
  {
    id: 2,
    name: 'Track 2 (Bass)',
    color: '#fbbf24',
    volume: 0.95,
    pan: 0.0,
    muted: false,
    soloed: false,
    armed: false,
    clip: null,
    meterLevel: 0,
  },
  {
    id: 3,
    name: 'Track 3 (Chords)',
    color: '#34d399',
    volume: 0.85,
    pan: -0.2,
    muted: false,
    soloed: false,
    armed: false,
    clip: null,
    meterLevel: 0,
  },
  {
    id: 4,
    name: 'Track 4 (Lead)',
    color: '#c084fc',
    volume: 0.8,
    pan: 0.25,
    muted: false,
    soloed: false,
    armed: false,
    clip: null,
    meterLevel: 0,
  },
];

export default function App() {
  const [project, setProject] = useState<ProjectState>({
    bpm: INITIAL_BPM,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    loopBars: INITIAL_BARS,
    loopStart: 0,
    loopEnd: INITIAL_LOOP_DURATION,
    isLooping: true,
    metronomeEnabled: false,
    metronomeVolume: 0.75,
    countInEnabled: true,
    countInBars: 1,
    snapToGrid: true,
    gridSnapDivision: 1, // 1 beat
    tracks: createDefaultTracks(),
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isCountingIn, setIsCountingIn] = useState<boolean>(false);
  const [countInRemaining, setCountInRemaining] = useState<number>(4);
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(110);
  const [timelineTotalSeconds, setTimelineTotalSeconds] = useState<number>(24);

  // Metronome visual tick
  const [metronomeBeat, setMetronomeBeat] = useState<number>(0);
  const [isDownbeat, setIsDownbeat] = useState<boolean>(false);

  // Meter levels
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [masterMeterLevel, setMasterMeterLevel] = useState<number>(0);
  const [micInputLevel, setMicInputLevel] = useState<number>(0);
  const [trackMeters, setTrackMeters] = useState<{ [trackId: number]: number }>({});

  // Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const engineRef = useRef<AudioEngine>(AudioEngine.getInstance());

  // Keep audio graph and active project state in sync with project state
  useEffect(() => {
    engineRef.current.updateProjectState(project);
  }, [project]);

  // Load starter synthetic demo tracks on initial mount
  useEffect(() => {
    try {
      const sampleRate = 44100;
      const buffers = generateStarterProjectBuffers(sampleRate);

      const drumsWave = extractWaveformData(buffers.drums);
      const bassWave = extractWaveformData(buffers.bass);
      const chordsWave = extractWaveformData(buffers.chords);
      const leadWave = extractWaveformData(buffers.lead);

      const demoTracks: Track[] = [
        {
          id: 1,
          name: 'Track 1 (Drums)',
          color: '#38bdf8',
          volume: 1.0,
          pan: 0.0,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-drums',
            name: 'Drum Groove',
            buffer: buffers.drums,
            rawPeaks: drumsWave.peaks,
            startTime: 0,
            duration: buffers.drums.duration,
            trimStart: 0,
            trimEnd: buffers.drums.duration,
            gain: 1.0,
            fadeIn: 0.01,
            fadeOut: 0.02,
          },
          meterLevel: 0,
        },
        {
          id: 2,
          name: 'Track 2 (Bass)',
          color: '#fbbf24',
          volume: 0.95,
          pan: 0.0,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-bass',
            name: 'Synth Bass',
            buffer: buffers.bass,
            rawPeaks: bassWave.peaks,
            startTime: 0,
            duration: buffers.bass.duration,
            trimStart: 0,
            trimEnd: buffers.bass.duration,
            gain: 1.0,
            fadeIn: 0.01,
            fadeOut: 0.02,
          },
          meterLevel: 0,
        },
        {
          id: 3,
          name: 'Track 3 (Chords)',
          color: '#34d399',
          volume: 0.85,
          pan: -0.2,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-chords',
            name: 'Rhodes Chords',
            buffer: buffers.chords,
            rawPeaks: chordsWave.peaks,
            startTime: 0,
            duration: buffers.chords.duration,
            trimStart: 0,
            trimEnd: buffers.chords.duration,
            gain: 1.0,
            fadeIn: 0.02,
            fadeOut: 0.03,
          },
          meterLevel: 0,
        },
        {
          id: 4,
          name: 'Track 4 (Lead)',
          color: '#c084fc',
          volume: 0.8,
          pan: 0.25,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-lead',
            name: 'Arp Lead',
            buffer: buffers.lead,
            rawPeaks: leadWave.peaks,
            startTime: 0,
            duration: buffers.lead.duration,
            trimStart: 0,
            trimEnd: buffers.lead.duration,
            gain: 1.0,
            fadeIn: 0.01,
            fadeOut: 0.02,
          },
          meterLevel: 0,
        },
      ];

      setProject((prev) => ({
        ...prev,
        tracks: demoTracks,
      }));
    } catch (err) {
      console.warn('Initial demo synthesis deferred until user interaction', err);
    }
  }, []);

  // Register audio engine listeners
  useEffect(() => {
    const engine = engineRef.current;

    engine.onPlayheadUpdate = (time) => {
      setPlayheadTime(time);
    };

    engine.onMetronomeBeat = (beat, downbeat) => {
      setMetronomeBeat(beat);
      setIsDownbeat(downbeat);
      setTimeout(() => {
        setMetronomeBeat(0);
        setIsDownbeat(false);
      }, 100);
    };

    engine.onCountInTick = (remaining) => {
      setCountInRemaining(remaining);
    };

    engine.onTrackMetersUpdate = (trackMetersMap, masterPeak) => {
      setMasterMeterLevel(masterPeak);
      setTrackMeters(trackMetersMap);

      // Calculate mic level if armed
      if (engine.micAnalyserNode) {
        const data = new Uint8Array(64);
        engine.micAnalyserNode.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const val = Math.abs(data[i] - 128) / 128;
          if (val > peak) peak = val;
        }
        setMicInputLevel(peak);
      }
    };

    engine.onRecordingComplete = (trackId, newClip) => {
      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, clip: newClip } : t)),
      }));
      setIsRecording(false);
      setIsPlaying(false);
    };

    return () => {
      engine.cleanup();
    };
  }, []);

  // Recalculate timeline length if any clip exceeds current length
  useEffect(() => {
    let maxEnd = project.loopEnd;
    project.tracks.forEach((t) => {
      if (t.clip) {
        maxEnd = Math.max(maxEnd, t.clip.startTime + t.clip.duration + 4);
      }
    });
    setTimelineTotalSeconds(Math.max(20, Math.ceil(maxEnd / 4) * 4));
  }, [project.tracks, project.loopEnd]);

  // Transport handlers
  const handlePlayPause = useCallback(() => {
    const engine = engineRef.current;
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
    } else {
      engine.play(project);
      setIsPlaying(true);
    }
  }, [isPlaying, project]);

  const handleStop = useCallback(() => {
    const engine = engineRef.current;
    if (isRecording) {
      engine.stopRecording(project);
      setIsRecording(false);
    }
    engine.stop(project);
    setIsPlaying(false);
    setPlayheadTime(project.loopStart);
  }, [isRecording, project]);

  const handleRecord = useCallback(async () => {
    const engine = engineRef.current;

    if (isRecording) {
      engine.stopRecording(project);
      setIsRecording(false);
      setIsPlaying(false);
      return;
    }

    // Check which track is armed
    let armed = project.tracks.find((t) => t.armed);
    if (!armed) {
      // Auto-arm track 1 if none armed
      armed = project.tracks[0];
      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => ({ ...t, armed: t.id === 1 })),
      }));
    }

    try {
      setIsCountingIn(project.countInEnabled);
      await engine.startRecording(armed.id, project, (count) => {
        setCountInRemaining(count);
      });
      setIsCountingIn(false);
      setIsRecording(true);
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to start microphone recording:', err);
      setIsCountingIn(false);
      setIsRecording(false);
    }
  }, [isRecording, project]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleRecord();
      } else if (e.code === 'Enter' || e.code === 'KeyS') {
        e.preventDefault();
        handleStop();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setProject((prev) => ({ ...prev, isLooping: !prev.isLooping }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleRecord, handleStop]);

  // Arm track
  const handleArmTrack = (trackId: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => ({
        ...t,
        armed: t.id === trackId ? !t.armed : false, // arm single track at a time
      })),
    }));
  };

  // Update track attributes (volume, pan, solo, mute, name)
  const handleUpdateTrack = (trackId: number, updated: Partial<Track>) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...updated } : t)),
    }));
  };

  // Update clip attributes (startTime, gain, duration, trimStart, fades)
  const handleUpdateClip = (trackId: number, updatedClip: AudioClip) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, clip: updatedClip } : t)),
    }));
  };

  // Delete clip from track
  const handleDeleteClip = (trackId: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, clip: null } : t)),
    }));
  };

  // Import audio file to track
  const handleImportFileToTrack = async (trackId: number, file: File) => {
    try {
      const arrayBuf = await file.arrayBuffer();
      const ctx = engineRef.current.initContext();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      const waveform = extractWaveformData(decoded);

      const newClip: AudioClip = {
        id: `clip-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        buffer: decoded,
        rawPeaks: waveform.peaks,
        startTime: 0,
        duration: decoded.duration,
        trimStart: 0,
        trimEnd: decoded.duration,
        gain: 1.0,
        fadeIn: 0.01,
        fadeOut: 0.02,
      };

      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, clip: newClip } : t)),
      }));
    } catch (err) {
      console.error('Error importing audio file:', err);
    }
  };

  // Loop settings
  const handleSetLoopBars = (bars: number) => {
    const secPerBeat = 60.0 / project.bpm;
    const secPerBar = secPerBeat * project.timeSignatureNumerator;
    const newDuration = bars * secPerBar;
    setProject((prev) => ({
      ...prev,
      loopBars: bars,
      loopStart: 0,
      loopEnd: newDuration,
    }));
  };

  const handleUpdateLoop = (start: number, end: number) => {
    setProject((prev) => ({
      ...prev,
      loopStart: Math.max(0, start),
      loopEnd: Math.max(start + 0.2, end),
    }));
  };

  // Alignment helpers
  const handleAlignAllClipsToStart = () => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (!t.clip) return t;
        return {
          ...t,
          clip: {
            ...t.clip,
            startTime: 0,
          },
        };
      }),
    }));
  };

  const handleQuantizeClips = () => {
    const secPerBeat = 60.0 / project.bpm;
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (!t.clip) return t;
        const snapped = Math.round(t.clip.startTime / secPerBeat) * secPerBeat;
        return {
          ...t,
          clip: {
            ...t.clip,
            startTime: Math.max(0, snapped),
          },
        };
      }),
    }));
  };

  const handleNudgeActiveClips = (deltaSeconds: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (!t.clip) return t;
        return {
          ...t,
          clip: {
            ...t.clip,
            startTime: Math.max(0, t.clip.startTime + deltaSeconds),
          },
        };
      }),
    }));
  };

  // Reset project
  const handleResetProject = () => {
    handleStop();
    setProject((prev) => ({
      ...prev,
      tracks: createDefaultTracks(),
    }));
  };

  // Reload demo beat
  const handleLoadDemoProject = () => {
    handleStop();
    const buffers = generateStarterProjectBuffers();
    const drumsWave = extractWaveformData(buffers.drums);
    const bassWave = extractWaveformData(buffers.bass);
    const chordsWave = extractWaveformData(buffers.chords);
    const leadWave = extractWaveformData(buffers.lead);

    setProject((prev) => ({
      ...prev,
      bpm: 120,
      loopBars: 4,
      loopStart: 0,
      loopEnd: 8.0,
      tracks: [
        {
          id: 1,
          name: 'Track 1 (Drums)',
          color: '#38bdf8',
          volume: 1.0,
          pan: 0.0,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-drums-2',
            name: 'Drum Groove',
            buffer: buffers.drums,
            rawPeaks: drumsWave.peaks,
            startTime: 0,
            duration: buffers.drums.duration,
            trimStart: 0,
            trimEnd: buffers.drums.duration,
            gain: 1.0,
            fadeIn: 0.01,
            fadeOut: 0.02,
          },
          meterLevel: 0,
        },
        {
          id: 2,
          name: 'Track 2 (Bass)',
          color: '#fbbf24',
          volume: 0.95,
          pan: 0.0,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-bass-2',
            name: 'Synth Bass',
            buffer: buffers.bass,
            rawPeaks: bassWave.peaks,
            startTime: 0,
            duration: buffers.bass.duration,
            trimStart: 0,
            trimEnd: buffers.bass.duration,
            gain: 1.0,
            fadeIn: 0.01,
            fadeOut: 0.02,
          },
          meterLevel: 0,
        },
        {
          id: 3,
          name: 'Track 3 (Chords)',
          color: '#34d399',
          volume: 0.85,
          pan: -0.2,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-chords-2',
            name: 'Rhodes Chords',
            buffer: buffers.chords,
            rawPeaks: chordsWave.peaks,
            startTime: 0,
            duration: buffers.chords.duration,
            trimStart: 0,
            trimEnd: buffers.chords.duration,
            gain: 1.0,
            fadeIn: 0.02,
            fadeOut: 0.03,
          },
          meterLevel: 0,
        },
        {
          id: 4,
          name: 'Track 4 (Lead)',
          color: '#c084fc',
          volume: 0.8,
          pan: 0.25,
          muted: false,
          soloed: false,
          armed: false,
          clip: {
            id: 'clip-lead-2',
            name: 'Arp Lead',
            buffer: buffers.lead,
            rawPeaks: leadWave.peaks,
            startTime: 0,
            duration: buffers.lead.duration,
            trimStart: 0,
            trimEnd: buffers.lead.duration,
            gain: 1.0,
            fadeIn: 0.01,
            fadeOut: 0.02,
          },
          meterLevel: 0,
        },
      ],
    }));
  };

  const armedTrack = project.tracks.find((t) => t.armed);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Transport & Metronome Bar */}
      <TransportBar
        project={project}
        isPlaying={isPlaying}
        isRecording={isRecording}
        isCountingIn={isCountingIn}
        countInRemaining={countInRemaining}
        playheadTime={playheadTime}
        metronomeActiveBeat={metronomeBeat}
        isDownbeat={isDownbeat}
        masterVolume={masterVolume}
        masterMeterLevel={masterMeterLevel}
        hasArmedTrack={!!armedTrack}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onRecord={handleRecord}
        onUpdateBpm={(bpm) => setProject((p) => ({ ...p, bpm }))}
        onUpdateTimeSignature={(numerator) =>
          setProject((p) => ({ ...p, timeSignatureNumerator: numerator }))
        }
        onToggleMetronome={() =>
          setProject((p) => ({ ...p, metronomeEnabled: !p.metronomeEnabled }))
        }
        onUpdateMetronomeVolume={(vol) =>
          setProject((p) => ({ ...p, metronomeVolume: vol }))
        }
        onToggleCountIn={() =>
          setProject((p) => ({ ...p, countInEnabled: !p.countInEnabled }))
        }
        onUpdateMasterVolume={(vol) => {
          setMasterVolume(vol);
          engineRef.current.setMasterVolume(vol);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onLoadDemoProject={handleLoadDemoProject}
        onResetProject={handleResetProject}
      />

      {/* Main 4-Track Timeline & Waveform Editor */}
      <MultitrackTimeline
        project={project}
        playheadTime={playheadTime}
        pixelsPerSecond={pixelsPerSecond}
        timelineTotalSeconds={timelineTotalSeconds}
        isRecording={isRecording}
        isCountingIn={isCountingIn}
        countInRemaining={countInRemaining}
        armedTrackId={armedTrack?.id || null}
        micInputLevel={micInputLevel}
        trackMeters={trackMeters}
        onSeek={(time) => engineRef.current.seek(time, project)}
        onUpdateLoop={handleUpdateLoop}
        onToggleLooping={() =>
          setProject((p) => ({ ...p, isLooping: !p.isLooping }))
        }
        onZoomChange={(pps) => setPixelsPerSecond(pps)}
        onToggleSnap={() =>
          setProject((p) => ({ ...p, snapToGrid: !p.snapToGrid }))
        }
        onUpdateTrack={handleUpdateTrack}
        onArmTrack={handleArmTrack}
        onRecordTrigger={(trackId) => {
          // If already recording, stop
          if (isRecording) {
            handleRecord();
            return;
          }
          // Arm specified track and start recording
          setProject((prev) => ({
            ...prev,
            tracks: prev.tracks.map((t) => ({ ...t, armed: t.id === trackId })),
          }));
          setTimeout(() => {
            handleRecord();
          }, 50);
        }}
        onImportFileToTrack={handleImportFileToTrack}
        onClearTrack={(trackId) => handleDeleteClip(trackId)}
        onUpdateClip={handleUpdateClip}
        onDeleteClip={handleDeleteClip}
      />

      {/* Mixer Alignment & Utility Footer */}
      <MixerFooter
        project={project}
        onSetLoopBars={handleSetLoopBars}
        onAlignAllClipsToStart={handleAlignAllClipsToStart}
        onQuantizeClips={handleQuantizeClips}
        onNudgeActiveClips={handleNudgeActiveClips}
      />

      {/* High-Quality MP3 / WAV Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        project={project}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
