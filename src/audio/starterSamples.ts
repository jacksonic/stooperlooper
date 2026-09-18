// Synthetic audio generator for starter demo tracks
// Synthesizes 4 bars of cohesive music at 120 BPM using Web Audio API

export function generateStarterProjectBuffers(sampleRate: number = 44100): {
  drums: AudioBuffer;
  bass: AudioBuffer;
  chords: AudioBuffer;
  lead: AudioBuffer;
} {
  const bpm = 120;
  const beatsPerBar = 4;
  const numBars = 4;
  const totalBeats = numBars * beatsPerBar;
  const beatDuration = 60 / bpm; // 0.5 sec per beat
  const totalDuration = totalBeats * beatDuration; // 8.0 sec
  const numSamples = Math.floor(sampleRate * totalDuration);

  // Helper to create empty stereo buffer cleanly without leaving active AudioContexts
  const createBuffer = (): AudioBuffer => {
    if (typeof AudioBuffer !== 'undefined') {
      try {
        return new AudioBuffer({
          numberOfChannels: 2,
          length: numSamples,
          sampleRate,
        });
      } catch {
        // Fallback for older environments
      }
    }
    const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);
    return offlineCtx.createBuffer(2, numSamples, sampleRate);
  };

  // 1. Drums: Kick on 1 & 3, Snare on 2 & 4, Hi-Hats on 8ths
  const drumsBuffer = createBuffer();
  const dL = drumsBuffer.getChannelData(0);
  const dR = drumsBuffer.getChannelData(1);

  // 2. Bass: Funky walking synth bass in D minor
  const bassBuffer = createBuffer();
  const bL = bassBuffer.getChannelData(0);
  const bR = bassBuffer.getChannelData(1);

  // 3. Chords: Lush warm electric rhodes chords (Dm7 - Bbmaj7 - Gm7 - C7)
  const chordsBuffer = createBuffer();
  const cL = chordsBuffer.getChannelData(0);
  const cR = chordsBuffer.getChannelData(1);

  // 4. Lead: Melodic guitar/synth riff
  const leadBuffer = createBuffer();
  const lL = leadBuffer.getChannelData(0);
  const lR = leadBuffer.getChannelData(1);

  // Synthesize Drums
  for (let beat = 0; beat < totalBeats; beat++) {
    const beatTime = beat * beatDuration;
    const startSample = Math.floor(beatTime * sampleRate);

    // Kick on beat 0, 1.5, 2, 2.75 etc (groovy kick pattern)
    const isKick = beat % 2 === 0 || (beat % 4 === 2.5);
    if (isKick) {
      const kickLength = Math.floor(0.25 * sampleRate);
      for (let i = 0; i < kickLength && startSample + i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = 120 * Math.exp(-t * 28) + 45;
        const amp = Math.exp(-t * 12) * 0.8;
        const sample = Math.sin(2 * Math.PI * freq * t) * amp;
        dL[startSample + i] += sample;
        dR[startSample + i] += sample;
      }
    }

    // Snare on beats 1 and 3 (2nd and 4th beat of measure)
    if (beat % 2 === 1) {
      const snareLength = Math.floor(0.22 * sampleRate);
      for (let i = 0; i < snareLength && startSample + i < numSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.45;
        const body = Math.sin(2 * Math.PI * 180 * Math.exp(-t * 20) * t) * Math.exp(-t * 15) * 0.4;
        const sample = noise + body;
        dL[startSample + i] += sample;
        dR[startSample + i] += sample;
      }
    }

    // Hi-Hats every 8th note
    for (let sub = 0; sub < 2; sub++) {
      const hatSample = startSample + Math.floor(sub * 0.5 * beatDuration * sampleRate);
      const hatLength = Math.floor(0.06 * sampleRate);
      const accent = sub === 0 ? 0.22 : 0.14;
      for (let i = 0; i < hatLength && hatSample + i < numSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 55) * accent;
        dL[hatSample + i] += noise * 0.85;
        dR[hatSample + i] += noise * 1.15; // slightly wider stereo
      }
    }
  }

  // Synthesize Bass (Notes: D1=36.7Hz, F1=43.6Hz, G1=49.0Hz, A1=55.0Hz, C2=65.4Hz)
  const bassNotes = [
    // Bar 1 (Dm)
    { beat: 0, dur: 0.8, freq: 73.4 }, // D2
    { beat: 1, dur: 0.4, freq: 73.4 },
    { beat: 1.5, dur: 0.4, freq: 87.3 }, // F2
    { beat: 2, dur: 0.8, freq: 98.0 }, // G2
    { beat: 3, dur: 0.8, freq: 110.0 }, // A2
    // Bar 2 (Bb)
    { beat: 4, dur: 0.8, freq: 58.3 }, // Bb1
    { beat: 5, dur: 0.4, freq: 58.3 },
    { beat: 5.5, dur: 0.4, freq: 87.3 },
    { beat: 6, dur: 0.8, freq: 73.4 },
    { beat: 7, dur: 0.8, freq: 65.4 },
    // Bar 3 (Gm)
    { beat: 8, dur: 0.8, freq: 49.0 }, // G1
    { beat: 9, dur: 0.4, freq: 73.4 },
    { beat: 9.5, dur: 0.4, freq: 87.3 },
    { beat: 10, dur: 0.8, freq: 98.0 },
    { beat: 11, dur: 0.8, freq: 110.0 },
    // Bar 4 (C)
    { beat: 12, dur: 0.8, freq: 65.4 }, // C2
    { beat: 13, dur: 0.4, freq: 65.4 },
    { beat: 13.5, dur: 0.4, freq: 73.4 },
    { beat: 14, dur: 0.8, freq: 82.4 }, // E2
    { beat: 15, dur: 0.8, freq: 65.4 },
  ];

  bassNotes.forEach(({ beat, dur, freq }) => {
    const start = Math.floor(beat * beatDuration * sampleRate);
    const length = Math.floor(dur * beatDuration * sampleRate);
    for (let i = 0; i < length && start + i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.min(1, t / 0.015) * Math.exp(-t / (dur * beatDuration * 0.9));
      // Sawtooth + sub sine wave
      const fundamental = Math.sin(2 * Math.PI * freq * t);
      const harmonic = Math.sin(4 * Math.PI * freq * t) * 0.4;
      const sub = Math.sin(Math.PI * freq * t) * 0.3;
      const sample = (fundamental + harmonic + sub) * env * 0.45;
      bL[start + i] += sample;
      bR[start + i] += sample;
    }
  });

  // Synthesize Chords: Dm7, Bbmaj7, Gm7, C7 chords
  const chordProgressions = [
    { beat: 0, notes: [293.66, 349.23, 440.0, 523.25] }, // D4, F4, A4, C5
    { beat: 4, notes: [233.08, 293.66, 349.23, 440.0] }, // Bb3, D4, F4, A4
    { beat: 8, notes: [196.0, 293.66, 349.23, 440.0] }, // G3, D4, F4, A4
    { beat: 12, notes: [261.63, 329.63, 392.0, 466.16] }, // C4, E4, G4, Bb4
  ];

  chordProgressions.forEach(({ beat, notes }) => {
    const start = Math.floor(beat * beatDuration * sampleRate);
    const length = Math.floor(3.6 * beatDuration * sampleRate);
    for (let i = 0; i < length && start + i < numSamples; i++) {
      const t = i / sampleRate;
      // Soft tremolo and warm envelope
      const trem = 1 + 0.15 * Math.sin(2 * Math.PI * 4 * t);
      const env = Math.min(1, t / 0.08) * Math.exp(-t / 2.2) * trem;
      let leftChord = 0;
      let rightChord = 0;
      notes.forEach((freq, idx) => {
        const phase = (idx * Math.PI) / 3;
        const wave = Math.sin(2 * Math.PI * freq * t + phase) + 0.3 * Math.sin(4 * Math.PI * freq * t);
        // spread notes in stereo field
        const pan = (idx / (notes.length - 1)) * 0.6 - 0.3;
        leftChord += wave * (0.5 - pan);
        rightChord += wave * (0.5 + pan);
      });
      cL[start + i] += (leftChord / notes.length) * env * 0.35;
      cR[start + i] += (rightChord / notes.length) * env * 0.35;
    }
  });

  // Synthesize Lead Riff
  const leadMelody = [
    { beat: 0.5, dur: 0.5, freq: 587.33 }, // D5
    { beat: 1.5, dur: 0.5, freq: 659.25 }, // E5
    { beat: 2.0, dur: 1.0, freq: 698.46 }, // F5
    { beat: 3.5, dur: 0.5, freq: 587.33 },
    { beat: 4.5, dur: 0.5, freq: 783.99 }, // G5
    { beat: 5.5, dur: 1.0, freq: 880.0 }, // A5
    { beat: 7.0, dur: 0.8, freq: 698.46 },
    { beat: 8.5, dur: 0.5, freq: 587.33 },
    { beat: 9.5, dur: 0.5, freq: 659.25 },
    { beat: 10.0, dur: 1.2, freq: 523.25 }, // C5
    { beat: 12.0, dur: 0.5, freq: 440.0 }, // A4
    { beat: 13.0, dur: 0.5, freq: 523.25 },
    { beat: 14.0, dur: 1.5, freq: 587.33 }, // D5
  ];

  leadMelody.forEach(({ beat, dur, freq }) => {
    const start = Math.floor(beat * beatDuration * sampleRate);
    const length = Math.floor((dur * beatDuration + 0.3) * sampleRate); // add slight reverb tail
    for (let i = 0; i < length && start + i < numSamples; i++) {
      const t = i / sampleRate;
      // Vibrato
      const vib = 1 + 0.015 * Math.sin(2 * Math.PI * 6 * t);
      const env = Math.min(1, t / 0.02) * Math.exp(-t / (dur * beatDuration));
      const s = Math.sin(2 * Math.PI * freq * vib * t) * 0.7 +
                Math.sin(4 * Math.PI * freq * vib * t) * 0.2 +
                Math.sin(6 * Math.PI * freq * vib * t) * 0.1;
      lL[start + i] += s * env * 0.3;
      lR[start + i] += s * env * 0.3;
    }
  });

  return {
    drums: drumsBuffer,
    bass: bassBuffer,
    chords: chordsBuffer,
    lead: leadBuffer,
  };
}
