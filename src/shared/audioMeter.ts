export interface VoiceActivityOptions {
  /** Minimum RMS amplitude (0..1) required to trigger speaking even in dead silence */
  minStartRms?: number;
  /** Minimum RMS amplitude (0..1) below which speaking can release */
  minStopRms?: number;
  /** Multiplier over adaptive noise floor required to start speaking */
  startNoiseMultiplier?: number;
  /** Multiplier over adaptive noise floor to sustain speaking */
  stopNoiseMultiplier?: number;
  /** Minimum normalized energy (0..1) in 85Hz-4000Hz voice band */
  minVoiceBandEnergy?: number;
  /** Holdover duration in ms before transitioning true -> false on silence */
  holdoverMs?: number;
}

export interface VoiceActivitySample {
  timeSamples: Uint8Array;
  freqBins?: Uint8Array;
  sampleRate?: number;
  fftSize?: number;
  nowMs: number;
  muted?: boolean;
}

export interface VoiceActivityResult {
  speaking: boolean;
  level: number;
  rms: number;
  voiceBandEnergy: number;
  changed: boolean;
}

/**
 * Computes normalized Root-Mean-Square amplitude [0..1] from 8-bit unsigned
 * time-domain PCM samples (where 128 represents zero amplitude).
 */
export function computeTimeDomainRms(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const centered = (samples[i]! - 128) / 128;
    sumSq += centered * centered;
  }
  return Math.sqrt(sumSq / samples.length);
}

/**
 * Computes normalized average magnitude [0..1] across the human speech frequency
 * band (85Hz - 4000Hz) from FFT byte frequency bins.
 */
export function computeVoiceBandEnergy(
  freqBins: Uint8Array,
  sampleRate = 48000,
  fftSize = 256
): number {
  if (freqBins.length === 0 || sampleRate <= 0 || fftSize <= 0) return 0;
  const binHz = sampleRate / fftSize;
  const minBin = Math.max(1, Math.floor(85 / binHz));
  const maxBin = Math.min(freqBins.length - 1, Math.ceil(4000 / binHz));
  if (maxBin < minBin) return 0;

  let sum = 0;
  let count = 0;
  for (let i = minBin; i <= maxBin; i++) {
    sum += freqBins[i]! / 255;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Stateful voice-activity detector with adaptive noise-floor tracking,
 * hysteresis thresholds, holdover smoothing, and instant mute cut-off.
 */
export function createVoiceActivityDetector(options: VoiceActivityOptions = {}) {
  const minStartRms = options.minStartRms ?? 0.022;
  const minStopRms = options.minStopRms ?? 0.013;
  const startNoiseMultiplier = options.startNoiseMultiplier ?? 2.4;
  const stopNoiseMultiplier = options.stopNoiseMultiplier ?? 1.6;
  const minVoiceBandEnergy = options.minVoiceBandEnergy ?? 0.035;
  const holdoverMs = options.holdoverMs ?? 280;

  let speaking = false;
  let noiseFloor = 0.008;
  let lastVoiceAt = 0;

  return {
    evaluate(sample: VoiceActivitySample): VoiceActivityResult {
      if (sample.muted) {
        const changed = speaking;
        speaking = false;
        lastVoiceAt = 0;
        return {
          speaking: false,
          level: 0,
          rms: 0,
          voiceBandEnergy: 0,
          changed,
        };
      }

      const rms = computeTimeDomainRms(sample.timeSamples);
      const voiceBandEnergy = sample.freqBins
        ? computeVoiceBandEnergy(sample.freqBins, sample.sampleRate, sample.fftSize)
        : 1;

      const startThreshold = Math.max(minStartRms, noiseFloor * startNoiseMultiplier);
      const stopThreshold = Math.max(minStopRms, noiseFloor * stopNoiseMultiplier);

      const hasVoiceFreq = sample.freqBins ? voiceBandEnergy >= minVoiceBandEnergy : true;
      const prevSpeaking = speaking;

      if (!speaking) {
        if (rms >= startThreshold && hasVoiceFreq) {
          speaking = true;
          lastVoiceAt = sample.nowMs;
        } else {
          // Adapt noise floor slowly during silence (clamped to avoid masking real speech)
          noiseFloor = Math.min(0.025, Math.max(0.004, noiseFloor * 0.94 + rms * 0.06));
        }
      } else {
        if (rms >= stopThreshold && hasVoiceFreq) {
          lastVoiceAt = sample.nowMs;
        } else if (sample.nowMs - lastVoiceAt >= holdoverMs) {
          speaking = false;
        }
      }

      // Normalized meter level 0..1 for subtle visual feedback if needed
      const level = Math.min(1, Math.max(0, (rms - noiseFloor) / 0.14));

      return {
        speaking,
        level,
        rms,
        voiceBandEnergy,
        changed: speaking !== prevSpeaking,
      };
    },

    reset(): boolean {
      const wasSpeaking = speaking;
      speaking = false;
      noiseFloor = 0.008;
      lastVoiceAt = 0;
      return wasSpeaking;
    },

    isSpeaking(): boolean {
      return speaking;
    },
  };
}

/**
 * Determines whether a WebRTC peer connection is needed between `meId` and `peerId`
 * in the active room (only when at least one of them holds a mic seat).
 */
export function shouldConnectMicPeer(params: {
  meId: string;
  peerId: string;
  seatedUserIds: Set<string>;
}): boolean {
  const { meId, peerId, seatedUserIds } = params;
  if (!meId || !peerId || meId === peerId) return false;
  return seatedUserIds.has(meId) || seatedUserIds.has(peerId);
}

/**
 * Deterministic Perfect-Negotiation role to avoid WebRTC offer glare.
 */
export function isPolitePeer(meId: string, peerId: string): boolean {
  return meId < peerId;
}
