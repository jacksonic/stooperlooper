// MP3 and WAV Audio Exporter utility
import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Converts Float32Array audio samples (-1.0 to 1.0) to 16-bit PCM Int16Array
 */
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Encodes an AudioBuffer into an MP3 Blob with chosen bitrate (default 320 kbps)
 */
export async function encodeAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  bitrateKbps: number = 320,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  
  const mp3encoder = new Mp3Encoder(channels, sampleRate, bitrateKbps);

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

  const leftPcm = floatTo16BitPCM(leftChannel);
  const rightPcm = floatTo16BitPCM(rightChannel);

  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152; // standard MP3 frame size
  const totalSamples = leftPcm.length;

  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const leftChunk = leftPcm.subarray(i, i + sampleBlockSize);
    const rightChunk = rightPcm.subarray(i, i + sampleBlockSize);

    let mp3buf: Uint8Array | Int8Array;
    if (channels === 1) {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    if (onProgress && i % (sampleBlockSize * 10) === 0) {
      onProgress(Math.min(0.95, i / totalSamples));
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  if (onProgress) onProgress(1.0);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/**
 * Lossless WAV encoder for high-fidelity export
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const length = audioBuffer.length * numChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Interleave channels
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < audioBuffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
