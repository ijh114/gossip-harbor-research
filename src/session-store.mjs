// Local research-session persistence only. No network, game-account or device data.
export const SAVE_KEY = 'harbor-research-play-v1';
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;
// Simulator policy, not an observed Gossip Harbor offline/server limit.
export const MAX_OFFLINE_SECONDS = 7 * 86400;
const encoder = new TextEncoder();
const failure = (reason, message) => ({ok: false, reason, message});
const plainObject = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const timestamp = value => Number.isSafeInteger(value) && value >= 0;
const validRevision = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value;

function optionsFor(options) {
  if (!plainObject(options) || !validRevision(options.revision) ||
      (options.validate !== undefined && typeof options.validate !== 'function')) return null;
  const now = options.now === undefined ? Date.now() : options.now;
  return timestamp(now) ? {...options, now} : null;
}

// Reject lossy JSON encodings and custom toJSON behavior, and isolate callbacks
// from the caller's object. Shared references are allowed; cycles are not.
function cloneJson(value, ancestors = new Set(), depth = 0) {
  if (depth > 80) throw new TypeError('State nesting limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Non-finite state number');
    return value;
  }
  if ((!Array.isArray(value) && !plainObject(value)) || ancestors.has(value)) throw new TypeError('State is not JSON data');
  ancestors.add(value);
  const result = Array.isArray(value) ? [] : {};
  const keys = Object.keys(value);
  // Sparse arrays and custom array properties are both lossy in JSON.
  if (Array.isArray(value) && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) throw new TypeError('State array is not dense');
  for (const key of keys) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError('Reserved state key');
    result[key] = cloneJson(value[key], ancestors, depth + 1);
  }
  ancestors.delete(value);
  return result;
}

function checkedState(state, validate) {
  if (!plainObject(state)) throw new TypeError('State must be an object');
  const snapshot = cloneJson(state);
  if (validate && validate(cloneJson(snapshot)) !== true) throw new TypeError('State validation failed');
  return snapshot;
}

/** Returns {ok:true,raw,savedAtMs} or a non-throwing error result. */
export function encodeSave(state, options = {}) {
  try {
    const opts = optionsFor(options);
    if (!opts) return failure('invalid-options', '저장 설정이나 시각이 올바르지 않습니다.');
    const snapshot = checkedState(state, opts.validate);
    const raw = JSON.stringify({schemaVersion: 1, revision: opts.revision, savedAtMs: opts.now, state: snapshot});
    if (encoder.encode(raw).byteLength > MAX_SAVE_BYTES) return failure('too-large', '저장 자료가 2MB 한도를 초과했습니다.');
    return {ok: true, raw, savedAtMs: opts.now};
  } catch {
    return failure('invalid-state', '시뮬레이션 상태를 저장 형식으로 확인하지 못했습니다.');
  }
}

/** Elapsed time is returned only; this module never advances gameplay. */
export function decodeSave(raw, options = {}) {
  try {
    const opts = optionsFor(options);
    if (!opts) return failure('invalid-options', '복원 설정이나 시각이 올바르지 않습니다.');
    if (typeof raw !== 'string') return failure('invalid-save', '저장 자료의 형식이 올바르지 않습니다.');
    if (encoder.encode(raw).byteLength > MAX_SAVE_BYTES) return failure('too-large', '저장 자료가 2MB 한도를 초과했습니다.');
    let envelope;
    try { envelope = JSON.parse(raw); }
    catch { return failure('invalid-json', '저장 자료를 읽지 못했습니다. 기존 자료는 유지됩니다.'); }
    if (!plainObject(envelope) || envelope.schemaVersion !== 1) return failure('unsupported-schema', '지원하지 않는 저장 형식입니다. 기존 자료는 유지됩니다.');
    if (!validRevision(envelope.revision) || envelope.revision !== opts.revision) return failure('revision-mismatch', '분석 설정 버전이 달라 자동 복원하지 않았습니다. 기존 자료는 유지됩니다.');
    if (!timestamp(envelope.savedAtMs)) return failure('invalid-timestamp', '저장 시각이 올바르지 않습니다. 기존 자료는 유지됩니다.');
    if (envelope.savedAtMs > opts.now) return failure('clock-rollback', '현재 시각보다 미래에 저장된 자료입니다. 기기 시각을 확인하세요. 기존 자료는 유지됩니다.');
    const state = checkedState(envelope.state, opts.validate);
    const actualSeconds = Math.floor((opts.now - envelope.savedAtMs) / 1000);
    return {ok: true, state, savedAtMs: envelope.savedAtMs,
      elapsedSeconds: Math.min(actualSeconds, MAX_OFFLINE_SECONDS), capped: actualSeconds > MAX_OFFLINE_SECONDS};
  } catch {
    return failure('invalid-state', '저장된 시뮬레이션 상태가 올바르지 않습니다. 기존 자료는 유지됩니다.');
  }
}

export function readSession(storage, options = {}) {
  let raw;
  try {
    if (!storage || typeof storage.getItem !== 'function') return failure('storage-unavailable', '이 브라우저에서 로컬 저장소에 접근할 수 없습니다.');
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return failure('storage-unavailable', '이 브라우저에서 로컬 저장소에 접근할 수 없습니다.');
  }
  if (raw === null || raw === undefined) return failure('missing', '저장된 시뮬레이션이 없습니다.');
  return decodeSave(raw, options);
}

export function writeSession(storage, state, options = {}) {
  const encoded = encodeSave(state, options);
  if (!encoded.ok) return encoded;
  try {
    if (!storage || typeof storage.setItem !== 'function') return failure('storage-unavailable', '로컬 저장소를 사용할 수 없어 현재 실행 중에만 상태를 유지합니다.');
    storage.setItem(SAVE_KEY, encoded.raw);
    return {...encoded, message: '이 브라우저에 시뮬레이션을 저장했습니다.'};
  } catch (error) {
    const quota = error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 22 || error?.code === 1014;
    return failure(quota ? 'storage-quota' : 'storage-unavailable', quota ? '브라우저 저장 공간이 부족합니다. 기존 자료는 유지됩니다.' : '로컬 저장이 차단되어 현재 실행 중에만 상태를 유지합니다.');
  }
}
