// Audio types and interfaces
export interface AudioClip {
  id: string;
  name: string;
  buffer: AudioBuffer;
  rawPeaks?: Float32Array;
  startTime: number; // in seconds on the timeline
  duration: number; // in seconds
  trimStart: number; // in seconds from start of buffer
  trimEnd: number; // in seconds from start of buffer
  gain: number; // amplitude multiplier (1.0 = 0dB)
  fadeIn: number; // fade in duration in seconds
  fadeOut: number; // fade out duration in seconds
}

export interface Track {
  id: number; // 1 to 4
  name: string;
  color: string;
  volume: number; // 0.0 to 1.5 (1.0 = unity)
  pan: number; // -1.0 (L) to 1.0 (R)
  muted: boolean;
  soloed: boolean;
  armed: boolean; // ready for mic recording
  clip: AudioClip | null;
  meterLevel: number; // current peak meter value 0..1
}

export interface ProjectState {
  bpm: number;
  timeSignatureNumerator: number; // e.g. 4
  timeSignatureDenominator: number; // e.g. 4
  loopBars: number; // e.g. 4 bars
  loopStart: number; // in seconds
  loopEnd: number; // in seconds
  isLooping: boolean;
  metronomeEnabled: boolean;
  metronomeVolume: number;
  countInEnabled: boolean;
  countInBars: number;
  snapToGrid: boolean;
  gridSnapDivision: number; // 1 = 1 beat, 0.5 = 1/8 note, 0.25 = 1/16 note, 4 = 1 bar
  tracks: Track[];
}
