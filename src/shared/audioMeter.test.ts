import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimeDomainRms,
  computeVoiceBandEnergy,
  createVoiceActivityDetector,
  isPolitePeer,
  shouldConnectMicPeer,
} from './audioMeter.ts';

function makeSilenceSamples(len = 256): Uint8Array {
  return new Uint8Array(len).fill(128);
}

function makeSineSamples(amplitudeByte: number, len = 256): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(128 + amplitudeByte * Math.sin((i / len) * Math.PI * 8))));
  }
  return out;
}

function makeVoiceFreqBins(levelByte: number, len = 128): Uint8Array {
  const out = new Uint8Array(len).fill(0);
  // Populate speech bins ~ 2..20 (375Hz .. 3750Hz at 48kHz/256)
  for (let i = 2; i <= 20; i++) {
    out[i] = levelByte;
  }
  return out;
}

test('computeTimeDomainRms returns 0 on silence and positive RMS on signal', () => {
  assert.equal(computeTimeDomainRms(makeSilenceSamples()), 0);
  const rms = computeTimeDomainRms(makeSineSamples(30));
  assert.ok(rms > 0.14 && rms < 0.2, `expected ~0.165 rms, got ${rms}`);
});

test('computeVoiceBandEnergy isolates speech band', () => {
  const bins = makeVoiceFreqBins(128);
  const energy = computeVoiceBandEnergy(bins, 48000, 256);
  assert.ok(energy > 0.4 && energy < 0.6, `expected ~0.5 energy, got ${energy}`);

  const subBassOnly = new Uint8Array(128).fill(0);
  subBassOnly[0] = 200; // DC / <85Hz hum
  assert.equal(computeVoiceBandEnergy(subBassOnly, 48000, 256), 0);
});

test('VAD stays false on silence/noise, activates on speech, smooths short gaps, and cuts off on mute', () => {
  const vad = createVoiceActivityDetector({ holdoverMs: 250 });

  // Dead silence
  const r1 = vad.evaluate({
    timeSamples: makeSilenceSamples(),
    freqBins: new Uint8Array(128),
    nowMs: 100,
  });
  assert.equal(r1.speaking, false);

  // Subtle background noise (amplitude ~1 -> rms ~0.0055)
  const r2 = vad.evaluate({
    timeSamples: makeSineSamples(1),
    freqBins: makeVoiceFreqBins(4),
    nowMs: 150,
  });
  assert.equal(r2.speaking, false);

  // Real speech arrives
  const r3 = vad.evaluate({
    timeSamples: makeSineSamples(18),
    freqBins: makeVoiceFreqBins(64),
    nowMs: 200,
  });
  assert.equal(r3.speaking, true);
  assert.equal(r3.changed, true);

  // Brief 100ms pause between words -> stays true during holdover
  const r4 = vad.evaluate({
    timeSamples: makeSilenceSamples(),
    freqBins: new Uint8Array(128),
    nowMs: 300,
  });
  assert.equal(r4.speaking, true);
  assert.equal(r4.changed, false);

  // Sustained silence >= holdoverMs -> hides speaking ring
  const r5 = vad.evaluate({
    timeSamples: makeSilenceSamples(),
    freqBins: new Uint8Array(128),
    nowMs: 460,
  });
  assert.equal(r5.speaking, false);
  assert.equal(r5.changed, true);

  // Loud signal while muted -> strictly false immediately
  vad.evaluate({
    timeSamples: makeSineSamples(25),
    freqBins: makeVoiceFreqBins(80),
    nowMs: 500,
  });
  assert.equal(vad.isSpeaking(), true);

  const rMuted = vad.evaluate({
    timeSamples: makeSineSamples(25),
    freqBins: makeVoiceFreqBins(80),
    nowMs: 520,
    muted: true,
  });
  assert.equal(rMuted.speaking, false);
  assert.equal(rMuted.changed, true);
});

test('shouldConnectMicPeer connects only when at least one peer is seated on mic', () => {
  const seated = new Set(['user_a']);
  assert.equal(shouldConnectMicPeer({ meId: 'user_a', peerId: 'user_b', seatedUserIds: seated }), true);
  assert.equal(shouldConnectMicPeer({ meId: 'user_b', peerId: 'user_a', seatedUserIds: seated }), true);
  assert.equal(shouldConnectMicPeer({ meId: 'user_b', peerId: 'user_c', seatedUserIds: seated }), false);
  assert.equal(shouldConnectMicPeer({ meId: 'user_a', peerId: 'user_a', seatedUserIds: seated }), false);
  assert.notEqual(isPolitePeer('user_a', 'user_b'), isPolitePeer('user_b', 'user_a'));
});
