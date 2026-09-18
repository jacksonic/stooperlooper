// Core Web Audio Engine for 4-Track Looper
import { AudioClip, Track, ProjectState } from '../types';
import { extractWaveformData } from './waveformUtils';

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  public audioCtx: AudioContext | null = null;

  // Transport State
  public isPlaying: boolean = false;
  public isRecording: boolean = false;
  public isCountingIn: boolean = false;
  public countInBeat: number = 0; // 1, 2, 3, 4
  public playheadTime: number = 0; // current position on timeline (seconds)
  private playbackAudioStartTime: number = 0; // audioCtx.currentTime when playback started
  private playheadStartOffset: number = 0; // timeline offset when playback started

  // Scheduled audio sources active in the Web Audio graph
  private activeScheduledSources: Array<{
    source: AudioBufferSourceNode;
    gainNode: GainNode;
  }> = [];

  // Lookahead playback scheduler
  private playbackSchedulerTimerId: number | null = null;
  private currentProject: ProjectState | null = null;
  private scheduledCyclesAhead: number = 0;
  private nextCycleAudioStartTime: number = 0;

  // Metronome Scheduling
  private metronomeNextNoteTime: number = 0;
  private metronomeCurrentBeat: number = 0;
  private metronomeTimerId: number | null = null;
  public onMetronomeBeat?: (beatNumber: number, isDownbeat: boolean) => void;

  // Track Web Audio Nodes
  private trackNodes: Map<
    number,
    {
      sourceNode: AudioBufferSourceNode | null;
      clipGainNode: GainNode;
      trackGainNode: GainNode;
      pannerNode: StereoPannerNode;
      analyserNode: AnalyserNode;
    }
  > = new Map();

  // Master Nodes
  public masterGainNode: GainNode | null = null;
  public masterAnalyserNode: AnalyserNode | null = null;

  // Microphone Recording
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  public micAnalyserNode: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingArmedTrackId: number | null = null;
  private recordingStartTime: number = 0;

  // Listeners / Callbacks
  public onPlayheadUpdate?: (time: number) => void;
  public onTrackMetersUpdate?: (meters: { [trackId: number]: number }, master: number) => void;
  public onRecordingComplete?: (trackId: number, clip: AudioClip) => void;
  public onCountInTick?: (beat: number, totalBeats: number) => void;

  private animationFrameId: number | null = null;
  private meterIntervalId: number | null = null;

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  constructor() {
    // Lazy initialized on first user interaction
  }

  public initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
      
      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.value = 1.0;

      this.masterAnalyserNode = this.audioCtx.createAnalyser();
      this.masterAnalyserNode.fftSize = 256;
      this.masterGainNode.connect(this.masterAnalyserNode);
      this.masterAnalyserNode.connect(this.audioCtx.destination);

      this.startMeterMonitor();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  /**
   * Initializes or updates track audio graph nodes
   */
  public syncTrackNodes(tracks: Track[]) {
    const ctx = this.initContext();

    tracks.forEach((track) => {
      let nodes = this.trackNodes.get(track.id);
      if (!nodes) {
        const clipGainNode = ctx.createGain();
        const trackGainNode = ctx.createGain();
        const pannerNode = ctx.createStereoPanner ? ctx.createStereoPanner() : (ctx as any).createPanner();
        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 256;

        clipGainNode.connect(trackGainNode);
        trackGainNode.connect(pannerNode);
        pannerNode.connect(analyserNode);
        analyserNode.connect(this.masterGainNode!);

        nodes = {
          sourceNode: null,
          clipGainNode,
          trackGainNode,
          pannerNode,
          analyserNode,
        };
        this.trackNodes.set(track.id, nodes);
      }

      // Compute actual track volume considering Mute & Solo
      const anySoloed = tracks.some((t) => t.soloed);
      let effectiveGain = track.volume;
      if (track.muted) {
        effectiveGain = 0;
      } else if (anySoloed && !track.soloed) {
        effectiveGain = 0;
      }

      // Smooth gain transition
      nodes.trackGainNode.gain.setValueAtTime(effectiveGain, ctx.currentTime);

      // Panning
      if (nodes.pannerNode.pan) {
        nodes.pannerNode.pan.setValueAtTime(track.pan, ctx.currentTime);
      }

      // Clip Gain
      if (track.clip) {
        nodes.clipGainNode.gain.setValueAtTime(track.clip.gain, ctx.currentTime);
      }
    });
  }

  /**
   * Starts playback from the given playhead time
   */
  public async play(project: ProjectState) {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // user interaction will resume
      }
    }

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentProject = project;

    // Synchronize current track volumes and pans
    this.syncTrackNodes(project.tracks);

    // Timeline offset
    let startOffset = this.playheadTime;
    if (project.isLooping) {
      if (startOffset < project.loopStart || startOffset >= project.loopEnd) {
        startOffset = project.loopStart;
        this.playheadTime = startOffset;
      }
    }
    this.playheadStartOffset = startOffset;
    this.playbackAudioStartTime = ctx.currentTime;

    // Initialize lookahead cycle state
    this.nextCycleAudioStartTime = ctx.currentTime;
    this.scheduledCyclesAhead = 0;

    // Start lookahead audio playback scheduler (runs on independent 25ms timer)
    this.startPlaybackScheduler();

    // Start metronome lookahead scheduler if enabled
    if (project.metronomeEnabled) {
      this.metronomeCurrentBeat = 0;
      this.metronomeNextNoteTime = ctx.currentTime;
      this.scheduleMetronome(project);
    }

    // Start UI playhead animation loop (purely for drawing playhead line)
    this.startPlayheadLoop(project);
  }

  /**
   * Update project reference dynamically (e.g. volume, loop points)
   */
  public updateProjectState(project: ProjectState) {
    this.currentProject = project;
    this.syncTrackNodes(project.tracks);
  }

  /**
   * Lookahead scheduler runs on a high-resolution interval and queues audio buffers
   * into the Web Audio API hardware clock 250ms ahead of time.
   * This guarantees 0 gap, 0 dropout, and sample-accurate seamless looping across cycles.
   */
  private startPlaybackScheduler() {
    if (this.playbackSchedulerTimerId) {
      window.clearInterval(this.playbackSchedulerTimerId);
    }

    const scheduleStep = () => {
      if (!this.isPlaying || !this.audioCtx || !this.currentProject) return;

      const project = this.currentProject;
      const now = this.audioCtx.currentTime;
      const lookaheadWindow = 0.25; // 250ms lookahead

      const loopLength = Math.max(0.1, project.loopEnd - project.loopStart);

      // Schedule cycles as long as the next cycle start is within our lookahead window
      while (this.nextCycleAudioStartTime < now + lookaheadWindow) {
        if (this.scheduledCyclesAhead === 0) {
          // Cycle 0: from playheadStartOffset to loopEnd (or full track if not looping)
          const startTimeline = this.playheadStartOffset;
          const endTimeline = project.isLooping ? project.loopEnd : 3600;
          const cycleDuration = project.isLooping ? Math.max(0.05, project.loopEnd - startTimeline) : 3600;

          this.scheduleClipsForWindow(
            startTimeline,
            endTimeline,
            this.nextCycleAudioStartTime,
            project
          );

          this.nextCycleAudioStartTime += cycleDuration;
          this.scheduledCyclesAhead++;

          if (!project.isLooping) {
            break;
          }
        } else {
          // Subsequent full loop cycles: strictly from loopStart to loopEnd
          if (!project.isLooping) {
            break;
          }

          this.scheduleClipsForWindow(
            project.loopStart,
            project.loopEnd,
            this.nextCycleAudioStartTime,
            project
          );

          this.nextCycleAudioStartTime += loopLength;
          this.scheduledCyclesAhead++;
        }
      }
    };

    // Run first batch immediately
    scheduleStep();
    this.playbackSchedulerTimerId = window.setInterval(scheduleStep, 25);
  }

  /**
   * Schedules clip sources that overlap with the timeline interval [windowStart, windowEnd]
   * to start at the exact audio clock time.
   */
  private scheduleClipsForWindow(
    windowStart: number,
    windowEnd: number,
    audioWindowStartTime: number,
    project: ProjectState
  ) {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    project.tracks.forEach((track) => {
      if (!track.clip || !track.clip.buffer) return;
      const nodes = this.trackNodes.get(track.id);
      if (!nodes) return;

      const clip = track.clip;
      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;

      // Overlap between clip and the active scheduling window
      const overlapStart = Math.max(clipStart, windowStart);
      const overlapEnd = Math.min(clipEnd, windowEnd);

      if (overlapEnd > overlapStart) {
        const source = ctx.createBufferSource();
        source.buffer = clip.buffer;

        // Dedicated gain node for this clip playback instance (allows independent fades and clip gain)
        const clipGain = ctx.createGain();

        // Exact scheduling timestamp on audio hardware clock
        const timeIntoWindow = overlapStart - windowStart;
        const scheduleTime = audioWindowStartTime + timeIntoWindow;

        // Exact offset in buffer
        const bufferOffset = clip.trimStart + (overlapStart - clipStart);
        const playDuration = overlapEnd - overlapStart;

        // Set initial clip gain
        clipGain.gain.setValueAtTime(Math.max(0, clip.gain), scheduleTime);

        // Apply fade-in if starting at or near the beginning of the clip
        if (clip.fadeIn > 0 && Math.abs(overlapStart - clipStart) < 0.005) {
          clipGain.gain.setValueAtTime(0.0001, scheduleTime);
          clipGain.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, clip.gain),
            scheduleTime + Math.min(clip.fadeIn, playDuration)
          );
        }

        // Apply fade-out if ending at or near the end of the clip
        if (clip.fadeOut > 0 && Math.abs(overlapEnd - clipEnd) < 0.005) {
          const fadeOutStart = scheduleTime + playDuration - clip.fadeOut;
          if (fadeOutStart > scheduleTime) {
            clipGain.gain.setValueAtTime(Math.max(0.0001, clip.gain), fadeOutStart);
            clipGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + playDuration);
          }
        }

        source.connect(clipGain);
        clipGain.connect(nodes.trackGainNode);

        // Start source
        source.start(scheduleTime, bufferOffset, playDuration);

        const scheduledItem = { source, gainNode: clipGain };
        this.activeScheduledSources.push(scheduledItem);

        source.onended = () => {
          try {
            source.disconnect();
            clipGain.disconnect();
          } catch {
            // Already disconnected
          }
          const idx = this.activeScheduledSources.indexOf(scheduledItem);
          if (idx !== -1) {
            this.activeScheduledSources.splice(idx, 1);
          }
        };
      }
    });
  }

  /**
   * Pause playback
   */
  public pause() {
    this.stopTrackSources();
    this.isPlaying = false;
    if (this.playbackSchedulerTimerId) {
      window.clearInterval(this.playbackSchedulerTimerId);
      this.playbackSchedulerTimerId = null;
    }
    if (this.metronomeTimerId) {
      window.clearTimeout(this.metronomeTimerId);
      this.metronomeTimerId = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.notifyPlayhead(this.playheadTime);
  }

  /**
   * Stop playback and reset playhead to start of loop or 0
   */
  public stop(project: ProjectState) {
    this.pause();
    this.playheadTime = project.loopStart;
    this.notifyPlayhead(this.playheadTime);
  }

  /**
   * Seek playhead to specific time
   */
  public seek(time: number, project: ProjectState) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.playheadTime = Math.max(0, time);
    this.notifyPlayhead(this.playheadTime);
    if (wasPlaying) {
      this.play(project);
    }
  }

  /**
   * Dispatches playhead updates to listener callbacks and high-performance custom DOM event
   */
  public notifyPlayhead(time: number) {
    if (this.onPlayheadUpdate) {
      this.onPlayheadUpdate(time);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('looper:playhead', {
          detail: { time, isPlaying: this.isPlaying },
        })
      );
    }
  }

  /**
   * Stops and disconnects all currently active or queued audio sources
   */
  public stopTrackSources() {
    for (const item of this.activeScheduledSources) {
      try {
        item.source.stop();
        item.source.disconnect();
        item.gainNode.disconnect();
      } catch {
        // Source already stopped
      }
    }
    this.activeScheduledSources = [];

    // Also stop legacy sourceNodes if any
    this.trackNodes.forEach((nodes) => {
      if (nodes.sourceNode) {
        try {
          nodes.sourceNode.stop();
          nodes.sourceNode.disconnect();
        } catch {}
        nodes.sourceNode = null;
      }
    });
  }

  /**
   * Visual playhead tracking loop (purely UI rendering, does NOT restart audio)
   */
  private startPlayheadLoop(project: ProjectState) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const update = () => {
      if (!this.isPlaying || !this.audioCtx) return;

      const currentProj = this.currentProject || project;
      const elapsed = Math.max(0, this.audioCtx.currentTime - this.playbackAudioStartTime);
      let newTime: number;

      if (currentProj.isLooping) {
        const loopLen = Math.max(0.05, currentProj.loopEnd - currentProj.loopStart);
        const rawOffset = this.playheadStartOffset - currentProj.loopStart + elapsed;
        const offsetInLoop = ((rawOffset % loopLen) + loopLen) % loopLen;
        newTime = currentProj.loopStart + offsetInLoop;
      } else {
        newTime = this.playheadStartOffset + elapsed;
        if (newTime >= currentProj.loopEnd) {
          this.stop(currentProj);
          return;
        }
      }

      this.playheadTime = newTime;
      this.notifyPlayhead(newTime);

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Metronome Click Synthesizer using Web Audio precision scheduling
   */
  private scheduleMetronome(project: ProjectState) {
    if (!this.isPlaying || !project.metronomeEnabled || !this.audioCtx) return;

    const secondsPerBeat = 60.0 / project.bpm;
    const scheduleAheadTime = 0.1; // 100ms lookahead

    while (this.metronomeNextNoteTime < this.audioCtx.currentTime + scheduleAheadTime) {
      this.playMetronomeClick(
        this.metronomeNextNoteTime,
        this.metronomeCurrentBeat % project.timeSignatureNumerator === 0,
        project.metronomeVolume
      );

      // Trigger UI callback
      const isDownbeat = this.metronomeCurrentBeat % project.timeSignatureNumerator === 0;
      const beatNum = (this.metronomeCurrentBeat % project.timeSignatureNumerator) + 1;
      const delayMs = Math.max(0, (this.metronomeNextNoteTime - this.audioCtx.currentTime) * 1000);
      setTimeout(() => {
        if (this.onMetronomeBeat) {
          this.onMetronomeBeat(beatNum, isDownbeat);
        }
      }, delayMs);

      this.metronomeNextNoteTime += secondsPerBeat;
      this.metronomeCurrentBeat++;
    }

    this.metronomeTimerId = window.setTimeout(() => {
      this.scheduleMetronome(project);
    }, 25);
  }

  private playMetronomeClick(time: number, isDownbeat: boolean, volume: number) {
    if (!this.audioCtx || volume <= 0.01) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // High woodblock tick on downbeat, punchy woodblock click on other beats
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isDownbeat ? 1400 : 900, time);
    osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 600 : 400, time + 0.04);

    const clickVol = (isDownbeat ? 0.9 : 0.6) * volume;
    gain.gain.setValueAtTime(clickVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGainNode!);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  /**
   * Real-time VU meter monitor
   */
  private startMeterMonitor() {
    const dataArray = new Uint8Array(128);

    const checkMeters = () => {
      const trackMeters: { [trackId: number]: number } = {};

      this.trackNodes.forEach((nodes, trackId) => {
        nodes.analyserNode.getByteTimeDomainData(dataArray);
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > peak) peak = val;
        }
        trackMeters[trackId] = peak;
      });

      let masterPeak = 0;
      if (this.masterAnalyserNode) {
        this.masterAnalyserNode.getByteTimeDomainData(dataArray);
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > masterPeak) masterPeak = val;
        }
      }

      if (this.onTrackMetersUpdate) {
        this.onTrackMetersUpdate(trackMeters, masterPeak);
      }
    };

    this.meterIntervalId = window.setInterval(checkMeters, 50);
  }

  /**
   * Arm track for microphone recording
   */
  public async requestMicrophone(): Promise<MediaStream> {
    if (!this.micStream) {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = this.initContext();
      this.micSourceNode = ctx.createMediaStreamSource(this.micStream);
      this.micAnalyserNode = ctx.createAnalyser();
      this.micAnalyserNode.fftSize = 128;
      this.micSourceNode.connect(this.micAnalyserNode);
    }
    return this.micStream;
  }

  /**
   * Starts Recording on the selected armed track with optional count-in
   */
  public async startRecording(
    armedTrackId: number,
    project: ProjectState,
    onCountIn?: (count: number) => void
  ) {
    const ctx = this.initContext();
    await this.requestMicrophone();

    this.recordingArmedTrackId = armedTrackId;
    this.recordedChunks = [];

    const secondsPerBeat = 60.0 / project.bpm;
    const countInBeats = project.countInEnabled ? project.countInBars * project.timeSignatureNumerator : 0;

    if (countInBeats > 0) {
      this.isCountingIn = true;
      let beatRemaining = countInBeats;

      for (let i = 0; i < countInBeats; i++) {
        const beatNum = i + 1;
        const isDownbeat = i % project.timeSignatureNumerator === 0;
        this.playMetronomeClick(ctx.currentTime + i * secondsPerBeat, isDownbeat, project.metronomeVolume || 0.8);
        
        setTimeout(() => {
          if (this.onCountInTick) {
            this.onCountInTick(beatRemaining, countInBeats);
          }
          if (onCountIn) {
            onCountIn(beatRemaining);
          }
          beatRemaining--;
        }, i * secondsPerBeat * 1000);
      }

      // Wait for count-in to finish before starting recorder
      await new Promise((resolve) => setTimeout(resolve, countInBeats * secondsPerBeat * 1000));
      this.isCountingIn = false;
    }

    // Begin recording
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

    this.mediaRecorder = new MediaRecorder(this.micStream!, { mimeType });
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      if (this.recordedChunks.length === 0 || !this.recordingArmedTrackId) return;

      const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      const arrayBuf = await blob.arrayBuffer();

      try {
        const decodedBuffer = await ctx.decodeAudioData(arrayBuf);
        const waveform = extractWaveformData(decodedBuffer);

        const newClip: AudioClip = {
          id: `clip-${Date.now()}`,
          name: `Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          buffer: decodedBuffer,
          rawPeaks: waveform.peaks,
          startTime: this.recordingStartTime,
          duration: decodedBuffer.duration,
          trimStart: 0,
          trimEnd: decodedBuffer.duration,
          gain: 1.0,
          fadeIn: 0.01,
          fadeOut: 0.02,
        };

        if (this.onRecordingComplete) {
          this.onRecordingComplete(this.recordingArmedTrackId, newClip);
        }
      } catch (err) {
        console.error('Failed to decode recorded audio:', err);
      } finally {
        this.isRecording = false;
        this.recordingArmedTrackId = null;
      }
    };

    this.recordingStartTime = this.playheadTime;
    this.mediaRecorder.start(100);
    this.isRecording = true;

    // Start playback of remaining tracks so artist can overdub
    this.play(project);
  }

  /**
   * Stops recording and finalizes clip
   */
  public stopRecording(project: ProjectState) {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
    this.pause();
  }

  /**
   * Sets master volume level (0.0 to 1.5)
   */
  public setMasterVolume(val: number) {
    if (this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setValueAtTime(val, this.audioCtx.currentTime);
    }
  }

  /**
   * Renders the entire project mixdown offline for MP3 or WAV export
   */
  public async renderProjectOffline(
    project: ProjectState,
    scope: 'loop' | 'full' = 'loop'
  ): Promise<AudioBuffer> {
    const sampleRate = 44100;
    
    // Determine export duration
    let renderStart = 0;
    let renderDuration = 8.0;

    if (scope === 'loop') {
      renderStart = project.loopStart;
      renderDuration = Math.max(0.5, project.loopEnd - project.loopStart);
    } else {
      // Find max clip end time
      let maxEnd = project.loopEnd;
      project.tracks.forEach((t) => {
        if (t.clip) {
          maxEnd = Math.max(maxEnd, t.clip.startTime + t.clip.duration);
        }
      });
      renderStart = 0;
      renderDuration = Math.max(1.0, maxEnd);
    }

    const totalSamples = Math.ceil(renderDuration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

    // Any soloed track check
    const anySoloed = project.tracks.some((t) => t.soloed);

    project.tracks.forEach((track) => {
      if (!track.clip || !track.clip.buffer) return;
      if (track.muted) return;
      if (anySoloed && !track.soloed) return;

      const clip = track.clip;
      const clipStart = clip.startTime;
      const clipEnd = clipStart + clip.duration;

      // If clip is outside export window, skip
      if (clipEnd <= renderStart || clipStart >= renderStart + renderDuration) {
        return;
      }

      // Track processing nodes in offline context
      const source = offlineCtx.createBufferSource();
      source.buffer = clip.buffer;

      const clipGain = offlineCtx.createGain();
      const trackGain = offlineCtx.createGain();
      const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;

      // Gain setup
      clipGain.gain.value = clip.gain;
      trackGain.gain.value = track.volume;

      // Panning
      if (panner) {
        panner.pan.value = track.pan;
        clipGain.connect(trackGain);
        trackGain.connect(panner);
        panner.connect(offlineCtx.destination);
      } else {
        clipGain.connect(trackGain);
        trackGain.connect(offlineCtx.destination);
      }

      // Timing calculations
      const offsetInExport = clipStart - renderStart;
      let startTime = Math.max(0, offsetInExport);
      let bufferOffset = clip.trimStart;

      if (offsetInExport < 0) {
        bufferOffset += Math.abs(offsetInExport);
      }

      const availableDuration = clip.duration - (bufferOffset - clip.trimStart);
      const playDuration = Math.min(availableDuration, renderDuration - startTime);

      // Apply Fades
      if (clip.fadeIn > 0 && offsetInExport >= 0) {
        clipGain.gain.setValueAtTime(0.001, startTime);
        clipGain.gain.exponentialRampToValueAtTime(clip.gain, startTime + clip.fadeIn);
      }

      if (clip.fadeOut > 0) {
        const fadeOutTime = startTime + playDuration - clip.fadeOut;
        if (fadeOutTime > 0) {
          clipGain.gain.setValueAtTime(clip.gain, fadeOutTime);
          clipGain.gain.exponentialRampToValueAtTime(0.001, startTime + playDuration);
        }
      }

      source.connect(clipGain);
      source.start(startTime, bufferOffset, playDuration);
    });

    return await offlineCtx.startRendering();
  }

  public cleanup() {
    this.stopTrackSources();
    if (this.playbackSchedulerTimerId) clearInterval(this.playbackSchedulerTimerId);
    if (this.meterIntervalId) clearInterval(this.meterIntervalId);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.metronomeTimerId) clearTimeout(this.metronomeTimerId);
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
  }
}
