import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_KEY, MAX_SAVE_BYTES, MAX_OFFLINE_SECONDS, encodeSave, decodeSave, readSession, writeSession} from '../src/session-store.mjs';

const revision = 'a'.repeat(64);
const opts = {revision, now: 1_000_000, validate: s => Number.isInteger(s.energy) && s.energy >= 0 && Array.isArray(s.board)};
const initial = () => ({energy: 97, board: [{type: '201', uid: 1}, null], weights: {'106': [34, 2, 1, 5]}, seed: 42});
function memoryStore(value = null) {
  const values = new Map(value === null ? [] : [[SAVE_KEY, value]]);
  return {values, removals: 0, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); }, removeItem() { this.removals++; }};
}
const envelope = overrides => JSON.stringify({schemaVersion: 1, revision, savedAtMs: opts.now, state: initial(), ...overrides});

test('round-trip preserves generator deck/RNG state and reports whole elapsed seconds without advancing gameplay', () => {
  const state = initial(), original = structuredClone(state), storage = memoryStore();
  assert.equal(writeSession(storage, state, opts).ok, true);
  const loaded = readSession(storage, {...opts, now: opts.now + 120_999});
  assert.equal(loaded.ok, true); assert.equal(loaded.elapsedSeconds, 120); assert.equal(loaded.capped, false);
  assert.deepEqual(loaded.state, original); assert.deepEqual(state, original);
  loaded.state.weights['106'][0] = 0;
  assert.equal(state.weights['106'][0], 34);
  assert.equal(readSession(storage, opts).state.weights['106'][0], 34);
});

test('corrupt, incompatible and model-invalid saves are rejected without deleting the existing record', () => {
  const cases = [
    ['{', 'invalid-json'], [JSON.stringify([]), 'unsupported-schema'],
    [envelope({schemaVersion: 99}), 'unsupported-schema'], [envelope({revision: 'old'}), 'revision-mismatch'],
    [envelope({savedAtMs: -1}), 'invalid-timestamp'], [envelope({savedAtMs: 0.5}), 'invalid-timestamp'],
    [envelope({savedAtMs: null}), 'invalid-timestamp'], [envelope({state: {energy: -1, board: []}}), 'invalid-state'],
    [envelope({state: []}), 'invalid-state'],
  ];
  for (const [raw, reason] of cases) {
    const storage = memoryStore(raw), loaded = readSession(storage, opts);
    assert.equal(loaded.ok, false, raw); assert.equal(loaded.reason, reason); assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(storage.removals, 0);
  }
  assert.equal(readSession(memoryStore(), opts).reason, 'missing');
});

test('clock rollback is rejected and the seven-day offline bound is explicit simulator policy', () => {
  const raw = encodeSave(initial(), opts).raw;
  assert.equal(decodeSave(raw, {...opts, now: opts.now - 1}).reason, 'clock-rollback');
  assert.equal(decodeSave(raw, {...opts, now: opts.now + MAX_OFFLINE_SECONDS * 1000}).capped, false);
  const capped = decodeSave(raw, {...opts, now: opts.now + (MAX_OFFLINE_SECONDS + 123) * 1000});
  assert.equal(capped.elapsedSeconds, MAX_OFFLINE_SECONDS); assert.equal(capped.capped, true); assert.equal(capped.state.energy, 97);
});

test('denied storage and quota errors return recoverable messages without throwing or overwriting', () => {
  const previous = envelope(), storage = memoryStore(previous);
  storage.setItem = () => { const error = new Error('secret detail'); error.name = 'QuotaExceededError'; throw error; };
  const quota = writeSession(storage, initial(), opts);
  assert.equal(quota.reason, 'storage-quota'); assert.equal(storage.getItem(SAVE_KEY), previous); assert.ok(!quota.message.includes('secret'));
  assert.equal(readSession({getItem() { throw new Error('blocked'); }}, opts).reason, 'storage-unavailable');
  assert.equal(writeSession(null, initial(), opts).reason, 'storage-unavailable');
  assert.equal(storage.removals, 0);
});

test('oversized or lossy states and invalid scalar metadata never reach storage', () => {
  const storage = memoryStore('previous');
  for (const state of [{energy: NaN}, {energy: Infinity}, {missing: undefined}, {fn() {}}, {n: 1n}, {d: new Date()}, {items: Array(2)}, {x: new Map()}]) {
    assert.equal(encodeSave(state, {...opts, validate: undefined}).ok, false);
  }
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(encodeSave(cyclic, opts).reason, 'invalid-state');
  const sparseWithProperty = Array(2); sparseWithProperty[0] = 'x'; sparseWithProperty.extra = 'discarded';
  assert.equal(encodeSave({items: sparseWithProperty}, {...opts, validate: undefined}).reason, 'invalid-state');
  assert.equal(writeSession(storage, {energy: 1, board: [], large: '가'.repeat(MAX_SAVE_BYTES / 2)}, opts).reason, 'too-large');
  assert.equal(decodeSave(' '.repeat(MAX_SAVE_BYTES + 1), opts).reason, 'too-large');
  for (const now of [NaN, Infinity, -1, 1.5, null]) assert.equal(encodeSave(initial(), {...opts, now}).reason, 'invalid-options');
  for (const value of ['', '  ', null, 42]) assert.equal(encodeSave(initial(), {...opts, revision: value}).reason, 'invalid-options');
  assert.equal(storage.getItem(SAVE_KEY), 'previous');
});

test('validation callbacks cannot mutate caller state or the returned decoded snapshot', () => {
  const state = initial(), original = structuredClone(state);
  const validate = candidate => { candidate.energy = 0; candidate.weights['106'][0] = 0; return true; };
  const encoded = encodeSave(state, {...opts, validate});
  assert.equal(encoded.ok, true); assert.deepEqual(state, original);
  const decoded = decodeSave(encoded.raw, {...opts, validate});
  assert.deepEqual(decoded.state, original);
  assert.equal(encodeSave(state, {...opts, validate: () => { throw new Error(); }}).reason, 'invalid-state');
  assert.equal(decodeSave(encoded.raw, {...opts, validate: () => 1}).reason, 'invalid-state');
});
