import { DEFAULT_SETTINGS, type GameResult, type Profile, type Replay, type Settings } from './types';

const DATABASE = 'farestorm-local';
const STORE = 'saves';
const FORMAT = 'farestorm-save';
const MAX_RECORDS = 60;
type SaveKind = 'settings' | 'profile';
type Envelope = { format: typeof FORMAT; version: 1; writtenAt: number; payload: unknown; checksum: string };
let database: Promise<IDBDatabase> | undefined;
let writeQueue = Promise.resolve();
let notice: string | null = null;

export function getPersistenceNotice(): string | null { return notice; }
export function emptyProfile(): Profile {
  return { version: 1, records: [], discovered: [], lessons: [], medals: {}, totalDeliveries: 0, bestScore: 0 };
}
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown, min = 0, max = 1e12): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number => finite(value, min, max) && Number.isInteger(value);
const bounded = (value: unknown, fallback: number, min: number, max: number) => finite(value, min, max) ? value : fallback;
const member = <T extends string>(value: unknown, choices: readonly T[]): value is T => typeof value === 'string' && choices.includes(value as T);
const numberIds = (value: unknown, max: number): number[] => Array.isArray(value) ? [...new Set(value.filter((v): v is number => integer(v, 0, max)))] : [];

/** A corruption check, not a signature or anti-cheat mechanism. */
export function checksum(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function encodeEnvelope(payload: unknown, writtenAt = Date.now()): Envelope {
  return { format: FORMAT, version: 1, writtenAt, payload, checksum: checksum({ version: 1, payload }) };
}
export function decodeEnvelope(raw: unknown): unknown {
  if (!isObject(raw) || raw.format !== FORMAT || raw.version !== 1 || !finite(raw.writtenAt, 0, 1e14) || typeof raw.checksum !== 'string') throw new Error('Unsupported or malformed save format.');
  if (checksum({ version: raw.version, payload: raw.payload }) !== raw.checksum) throw new Error('Save checksum does not match.');
  return raw.payload;
}
export function validateSettings(raw: unknown): Settings {
  if (!isObject(raw)) return { ...DEFAULT_SETTINGS };
  const defaults = DEFAULT_SETTINGS;
  const flag = (key: keyof Settings) => typeof raw[key] === 'boolean' ? raw[key] as boolean : defaults[key] as boolean;
  return {
    quality: member(raw.quality, ['low', 'medium', 'high']) ? raw.quality : defaults.quality,
    sound: flag('sound'), music: bounded(raw.music, defaults.music, 0, 1), effects: bounded(raw.effects, defaults.effects, 0, 1),
    sensitivity: bounded(raw.sensitivity, defaults.sensitivity, .2, 2), steeringAssist: flag('steeringAssist'), reducedMotion: flag('reducedMotion'),
    subtitles: flag('subtitles'), colorblind: flag('colorblind'), traffic: bounded(raw.traffic, defaults.traffic, 0, 2),
    camera: integer(raw.camera, 0, 2) ? raw.camera as 0 | 1 | 2 : defaults.camera, showMinimap: flag('showMinimap'), vibration: flag('vibration'),
  };
}
export function validateResult(raw: unknown): raw is GameResult {
  if (!isObject(raw)) return false;
  return typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 160 &&
    member(raw.mode, ['arcade', 'quick', 'trial', 'school']) && member(raw.taxi, ['gull', 'breaker', 'tempest']) &&
    finite(raw.seed, 0, 0xffffffff) && finite(raw.score, 0, 1e9) && finite(raw.fares, 0, 1e9) && finite(raw.tips, 0, 1e9) &&
    integer(raw.deliveries, 0, 10000) && finite(raw.bestChain, 0, 1e9) && integer(raw.collisions, 0, 100000) &&
    Array.isArray(raw.shortcuts) && raw.shortcuts.length <= 128 && raw.shortcuts.every((v) => integer(v, 0, 127)) &&
    finite(raw.duration, 0, 86400) && member(raw.rank, ['S', 'A', 'B', 'C', 'D']) && finite(raw.efficiency, 0, 10000) &&
    typeof raw.assist === 'boolean' && integer(raw.trial, 0, 20) && finite(raw.date, 0, 1e14) &&
    (raw.medal === undefined || member(raw.medal, ['gold', 'silver', 'bronze'])) && (raw.lesson === undefined || integer(raw.lesson, 0, 9));
}
export function validateReplay(raw: unknown): raw is Replay {
  if (!isObject(raw) || raw.version !== 1 || !isObject(raw.options) || !Array.isArray(raw.frames) || !Array.isArray(raw.samples)) return false;
  const options = raw.options;
  if (!member(options.mode, ['arcade', 'quick', 'trial', 'school']) || !member(options.taxi, ['gull', 'breaker', 'tempest']) ||
    typeof options.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(options.color) || !finite(options.seed, 0, 0xffffffff) ||
    !integer(options.trial, 0, 20) || !integer(options.lesson, 0, 9) || !finite(options.traffic, 0, 2) || typeof options.assists !== 'boolean') return false;
  if (raw.frames.length > 86400 || raw.samples.length > 30000) return false;
  if (!raw.frames.every((frame) => Array.isArray(frame) && frame.length === 4 && integer(frame[0], 0, 255) && integer(frame[1], 0, 255) && integer(frame[2], -127, 127) && integer(frame[3], 0, 31))) return false;
  let previousTime = -1;
  for (const sample of raw.samples) {
    if (!isObject(sample) || !finite(sample.t, 0, 86400) || sample.t < previousTime || !finite(sample.x, -10000, 10000) || !finite(sample.y, -1000, 10000) ||
      !finite(sample.z, -10000, 10000) || !finite(sample.heading, -1e9, 1e9) || !finite(sample.speed, -1000, 1000)) return false;
    previousTime = sample.t;
  }
  return raw.result === undefined || validateResult(raw.result);
}
export function validateProfile(raw: unknown): Profile {
  if (!isObject(raw) || (raw.version !== 1 && raw.version !== 0)) throw new Error('Unsupported profile version.');
  if (!Array.isArray(raw.records) || !raw.records.every(validateResult)) throw new Error('The saved record list is damaged.');
  const records = raw.records.slice(-MAX_RECORDS) as GameResult[];
  const medals: Record<string, string> = {};
  if (isObject(raw.medals)) for (const [key, value] of Object.entries(raw.medals)) {
    if (/^\d{1,2}$/.test(key) && member(value, ['gold', 'silver', 'bronze'])) medals[key] = value;
  }
  const profile: Profile = {
    version: 1, records, discovered: numberIds(raw.discovered, 127), lessons: numberIds(raw.lessons, 9), medals,
    totalDeliveries: integer(raw.totalDeliveries, 0, 1e9) ? raw.totalDeliveries : records.reduce((sum, item) => sum + item.deliveries, 0),
    bestScore: bounded(raw.bestScore, Math.max(0, ...records.map((item) => item.score)), 0, 1e9),
  };
  if (raw.ghost !== undefined) {
    if (validateReplay(raw.ghost)) profile.ghost = raw.ghost;
    else notice = 'A damaged ghost was skipped. Your scores and settings are still available.';
  }
  return profile;
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable.')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined; }; resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error('Cannot open local saves.'));
    request.onblocked = () => reject(new Error('Another Farestorm tab is preventing a save upgrade.'));
  }).catch((error: unknown) => { database = undefined; throw error; });
  return database;
}
async function readPair(kind: SaveKind): Promise<[unknown, unknown]> {
  try {
    const db = await openDatabase();
    return await new Promise<[unknown, unknown]>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const store = transaction.objectStore(STORE);
      const active = store.get(kind), backup = store.get(`${kind}:backup`);
      transaction.oncomplete = () => resolve([active.result, backup.result]);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Save read was interrupted.'));
    });
  } catch {
    try {
      const raw = localStorage.getItem(`${DATABASE}:${kind}`);
      notice = 'This browser is using a limited local save fallback.';
      if (raw) { const pair: unknown = JSON.parse(raw); if (Array.isArray(pair)) return [pair[0], pair[1]]; }
    } catch { notice = 'Local saves are unavailable in this browser session.'; }
    return [undefined, undefined];
  }
}
async function load(kind: SaveKind): Promise<unknown> {
  const pair = await readPair(kind);
  let damaged = false;
  for (let index = 0; index < pair.length; index++) {
    if (pair[index] === undefined || pair[index] === null) continue;
    try {
      const payload = decodeEnvelope(pair[index]);
      const value = kind === 'profile' ? validateProfile(payload) : validateSettings(payload);
      if (index === 1) notice = 'Recovered your previous local save after a damaged record was detected.';
      return value;
    } catch { damaged = true; }
  }
  if (damaged) notice = 'The local save was damaged. A fresh profile is available; existing data has not been overwritten.';
  return kind === 'profile' ? emptyProfile() : { ...DEFAULT_SETTINGS };
}
async function write(kind: SaveKind, payload: unknown, keepBackup = true): Promise<void> {
  const envelope = encodeEnvelope(payload);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const previous = store.get(kind);
      previous.onsuccess = () => {
        if (!keepBackup) store.delete(`${kind}:backup`);
        else if (previous.result !== undefined) try { decodeEnvelope(previous.result); store.put(previous.result, `${kind}:backup`); } catch { /* Keep the last intact backup. */ }
        store.put(envelope, kind);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('The save was interrupted.'));
    });
  } catch {
    try {
      const key = `${DATABASE}:${kind}`;
      const previousRaw = localStorage.getItem(key);
      let backup: unknown;
      if (previousRaw && keepBackup) try { const pair = JSON.parse(previousRaw) as unknown[]; decodeEnvelope(pair[0]); backup = pair[0]; } catch { /* Retain no corrupt record. */ }
      localStorage.setItem(key, JSON.stringify([envelope, backup]));
      notice = 'Saved using the browser local-storage fallback. Large ghosts may exceed its quota.';
    } catch {
      notice = 'Saving failed because browser storage is unavailable or full.';
      throw new Error(notice);
    }
  }
}
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(action, action);
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}
export async function loadSettings(): Promise<Settings> { return await load('settings') as Settings; }
export async function loadProfile(): Promise<Profile> { return await load('profile') as Profile; }
export function saveSettings(settings: Settings): Promise<void> { return serialize(() => write('settings', validateSettings(settings))); }
export function recordResult(result: GameResult, replay?: Replay): Promise<Profile> {
  return serialize(async () => {
    if (!validateResult(result)) throw new Error('This result is invalid and cannot be saved.');
    const profile = await loadProfile();
    if (profile.records.some((record) => record.id === result.id)) return profile;
    profile.records = [...profile.records, result].slice(-MAX_RECORDS);
    profile.totalDeliveries += result.deliveries;
    profile.bestScore = Math.max(profile.bestScore, result.score);
    profile.discovered = [...new Set([...profile.discovered, ...result.shortcuts])].sort((a, b) => a - b);
    if (result.mode === 'school' && result.lesson !== undefined && result.rank !== 'D') profile.lessons = [...new Set([...profile.lessons, result.lesson])].sort((a, b) => a - b);
    if (result.medal) {
      const order: Record<string, number> = { bronze: 1, silver: 2, gold: 3 };
      const key = String(result.trial);
      if ((order[profile.medals[key]] ?? 0) < order[result.medal]) profile.medals[key] = result.medal;
    }
    if (replay && validateReplay(replay) && replay.samples.length > 1) profile.ghost = { ...replay, result };
    await write('profile', profile);
    return profile;
  });
}
export function clearRecords(): Promise<void> { return serialize(() => write('profile', emptyProfile(), false)); }
export async function loadGhost(): Promise<Replay | undefined> { return (await loadProfile()).ghost; }
export async function exportProfile(): Promise<string> { return JSON.stringify(encodeEnvelope(await loadProfile()), null, 2); }
