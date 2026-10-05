const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function noteFromPitch(pitch: number, a4: number) {
  const midi = Math.round(69 + 12 * Math.log2(pitch / a4));
  const target = a4 * Math.pow(2, (midi - 69) / 12);
  return {
    midi,
    name: noteNames[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    target,
    cents: Math.round(1200 * Math.log2(pitch / target)),
  };
}

export function frequencyForMidi(midi: number, a4: number) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function detectPitch(buffer: Float32Array, sampleRate: number) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return -1;

  const minOffset = Math.floor(sampleRate / 1200);
  const maxOffset = Math.min(Math.floor(sampleRate / 38), Math.floor(buffer.length / 2));
  let bestOffset = -1;
  let bestCorrelation = 0;
  let previousCorrelation = 0;
  const correlations: number[] = [];

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let difference = 0;
    const length = buffer.length - offset;
    for (let i = 0; i < length; i += 2) {
      difference += Math.abs(buffer[i] - buffer[i + offset]);
    }
    const correlation = 1 - difference / (length / 2);
    correlations[offset] = correlation;

    if (correlation > 0.88 && correlation > previousCorrelation && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
    previousCorrelation = correlation;
  }

  if (bestOffset < 0 || bestCorrelation < 0.9) return -1;
  const left = correlations[bestOffset - 1] ?? bestCorrelation;
  const right = correlations[bestOffset + 1] ?? bestCorrelation;
  const shift = (right - left) / Math.max(0.0001, 2 * (2 * bestCorrelation - left - right));
  return sampleRate / (bestOffset + Math.max(-0.5, Math.min(0.5, shift)));
}
