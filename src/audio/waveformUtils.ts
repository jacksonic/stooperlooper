// Waveform analysis and peak extraction helpers

export interface WaveformData {
  peaks: Float32Array; // alternating min, max values for each pixel/bin
  length: number; // number of bins
  maxPeak: number; // max absolute peak value (0..1)
  rms: number; // root-mean-square amplitude
}

/**
 * Extracts waveform peak data (min and max per bucket) from AudioBuffer for efficient canvas drawing
 */
export function extractWaveformData(buffer: AudioBuffer, targetBins: number = 800): WaveformData {
  const numChannels = buffer.numberOfChannels;
  const channelData0 = buffer.getChannelData(0);
  const channelData1 = numChannels > 1 ? buffer.getChannelData(1) : null;
  const totalSamples = buffer.length;

  const bins = Math.max(100, Math.min(targetBins, 2000));
  const samplesPerBin = Math.max(1, Math.floor(totalSamples / bins));
  const peaks = new Float32Array(bins * 2);

  let globalMaxPeak = 0;
  let sumSquare = 0;

  for (let i = 0; i < bins; i++) {
    const start = i * samplesPerBin;
    const end = Math.min(start + samplesPerBin, totalSamples);

    let min = 1.0;
    let max = -1.0;

    for (let s = start; s < end; s++) {
      let sample = channelData0[s];
      if (channelData1) {
        sample = (sample + channelData1[s]) * 0.5;
      }
      
      sumSquare += sample * sample;
      const absSample = Math.abs(sample);
      if (absSample > globalMaxPeak) globalMaxPeak = absSample;

      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    if (min > max) {
      min = 0;
      max = 0;
    }

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  const rms = Math.sqrt(sumSquare / totalSamples);

  return {
    peaks,
    length: bins,
    maxPeak: globalMaxPeak,
    rms,
  };
}

/**
 * Calculates the normalization gain multiplier to bring maximum peak to 0.98 (-0.2 dBFS)
 */
export function calculateNormalizationGain(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak < 0.0001) return 1.0;
  const targetPeak = 0.98;
  return targetPeak / peak;
}

/**
 * Formats time in seconds to mm:ss.ms and bar.beat.fraction
 */
export function formatTimeSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
}

export function formatBarsBeats(seconds: number, bpm: number, numerator: number = 4): string {
  const beatDuration = 60 / bpm;
  const totalBeats = Math.max(0, seconds / beatDuration);
  const bar = Math.floor(totalBeats / numerator) + 1;
  const beat = Math.floor(totalBeats % numerator) + 1;
  const sixteenth = Math.floor((totalBeats % 1) * 4) + 1;
  return `${bar.toString().padStart(2, '0')}.${beat}.${sixteenth}`;
}
