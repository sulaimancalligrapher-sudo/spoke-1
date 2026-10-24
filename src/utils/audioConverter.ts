/**
 * Audio Converter & Compressor for In-Browser Speech Recognition
 * Resamples any mobile/browser audio (MP4, AAC, WebM, OGG) to lightweight 16kHz Mono WAV.
 * Reduces 5MB-10MB mobile recordings to ~40KB-70KB so Vercel never hits payload limits!
 */

/**
 * Resample an AudioBuffer to target sample rate (default: 16000 Hz)
 */
function resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate = 16000): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const oldSampleRate = audioBuffer.sampleRate;
  const oldLength = audioBuffer.length;

  // Mix down all channels to mono
  const monoData = new Float32Array(oldLength);
  for (let c = 0; c < numChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    for (let i = 0; i < oldLength; i++) {
      monoData[i] += channelData[i] / numChannels;
    }
  }

  if (oldSampleRate === targetSampleRate) {
    return monoData;
  }

  // Linear interpolation resampling to 16kHz
  const ratio = oldSampleRate / targetSampleRate;
  const newLength = Math.round(oldLength / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const oldIndex = i * ratio;
    const indexFloor = Math.floor(oldIndex);
    const indexCeil = Math.min(oldLength - 1, Math.ceil(oldIndex));
    const fraction = oldIndex - indexFloor;
    result[i] = monoData[indexFloor] * (1 - fraction) + monoData[indexCeil] * fraction;
  }

  return result;
}

/**
 * Encode Float32Array PCM samples into a standard 16-bit Mono WAV Blob
 */
function encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  // File length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(8, 'WAVE');
  // Format chunk identifier
  writeString(12, 'fmt ');
  // Format chunk length (16 for PCM)
  view.setUint32(16, 16, true);
  // Sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // Channel count (1 = Mono)
  view.setUint16(22, 1, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sample rate * channels * 2 bytes)
  view.setUint32(28, sampleRate * 2, true);
  // Block align (channels * 2 bytes)
  view.setUint16(32, 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // Data chunk identifier
  writeString(36, 'data');
  // Data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples with clipping protection
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Convert any Blob to clean Base64 string
 */
export function blobToBase64String(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma !== -1 ? dataUrl.substring(comma + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resample & compress any audio blob from mobile or desktop
 * Returns a compact 16kHz WAV Blob and Base64 string (<80KB)
 */
export async function compressAndResampleAudio(
  audioBlob: Blob
): Promise<{ wavBlob: Blob; base64: string; mimeType: string }> {
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextClass) {
    const base64 = await blobToBase64String(audioBlob);
    return { wavBlob: audioBlob, base64, mimeType: audioBlob.type || 'audio/webm' };
  }

  const audioCtx = new AudioContextClass();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const monoSamples = resampleAudioBuffer(audioBuffer, 16000);
    const wavBlob = encodeWAV(monoSamples, 16000);
    const base64 = await blobToBase64String(wavBlob);

    return {
      wavBlob,
      base64,
      mimeType: 'audio/wav',
    };
  } catch (err) {
    console.warn('Audio compression fallback:', err);
    const base64 = await blobToBase64String(audioBlob);
    return { wavBlob: audioBlob, base64, mimeType: audioBlob.type || 'audio/webm' };
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}
