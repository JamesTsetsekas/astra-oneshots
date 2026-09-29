import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRecords, decodeEnvelope, emptyProfile, encodeEnvelope, loadProfile, loadSettings, recordResult, saveSettings, validateProfile, validateReplay, validateSettings } from './persistence';
import { DEFAULT_SETTINGS, type GameResult, type Replay } from './types';

function result(id = 'test-run', score = 12000): GameResult {
  return { id, mode: 'arcade', taxi: 'breaker', seed: 1942, score, fares: score - 1000, tips: 1000, deliveries: 3, bestChain: 5,
    collisions: 2, shortcuts: [0, 3], duration: 95, rank: 'A', efficiency: .84, assist: true, trial: 0, date: 1790700000000 };
}
function replay(): Replay {
  return { version: 1, options: { mode: 'arcade', taxi: 'breaker', color: '#fe6b48', seed: 1942, trial: 0, lesson: 0, traffic: 1, assists: true },
    frames: [[255, 0, 0, 0], [255, 0, 51, 0]], samples: [{ t: 0, x: 0, y: 1, z: 0, heading: 0, speed: 0 }, { t: 1, x: 0, y: 1, z: 5, heading: 0, speed: 5 }] };
}
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe('versioned local saves', () => {
  it('detects data corruption and rejects unknown envelope versions', () => {
    const original = encodeEnvelope({ ...emptyProfile(), records: [result()] }, 1000);
    expect(decodeEnvelope(original)).toMatchObject({ records: [{ score: 12000 }] });
    const damaged = structuredClone(original);
    (damaged.payload as { records: GameResult[] }).records[0].score = 12001;
    expect(() => decodeEnvelope(damaged)).toThrow('checksum');
    expect(() => decodeEnvelope({ ...original, version: 99 })).toThrow('format');
  });
  it('recovers the preceding profile when the active record is corrupt', async () => {
    await recordResult(result('one'));
    await recordResult(result('two', 14000));
    const pair = JSON.parse(storage.get('farestorm-local:profile')!) as Array<{ checksum: string }>;
    pair[0].checksum = 'broken';
    storage.set('farestorm-local:profile', JSON.stringify(pair));
    const recovered = await loadProfile();
    expect(recovered.records.map((record) => record.id)).toEqual(['one']);
    expect(recovered.totalDeliveries).toBe(3);
  });
  it('serializes simultaneous writes, avoids duplicate results, and retains discoveries', async () => {
    await Promise.all([recordResult(result('one')), recordResult(result('two', 18000)), recordResult(result('one'))]);
    const profile = await loadProfile();
    expect(profile.records).toHaveLength(2);
    expect(profile.totalDeliveries).toBe(6);
    expect(profile.bestScore).toBe(18000);
    expect(profile.discovered).toEqual([0, 3]);
  });
  it('drops malformed ghosts without discarding valid scores', () => {
    const ghost = replay();
    ghost.samples[1].t = -1;
    expect(validateReplay(ghost)).toBe(false);
    const restored = validateProfile({ ...emptyProfile(), records: [result()], ghost });
    expect(restored.records).toHaveLength(1);
    expect(restored.ghost).toBeUndefined();
    const nonfinite = replay(); nonfinite.samples[1].x = Infinity;
    expect(validateReplay(nonfinite)).toBe(false);
    const brokenFrame = replay(); brokenFrame.frames[1][3] = 128;
    expect(validateReplay(brokenFrame)).toBe(false);
  });
  it('bounds settings and preserves preferences when records are cleared', async () => {
    expect(validateSettings({ music: Infinity, effects: -1, sensitivity: 'wide', camera: 10, sound: false })).toMatchObject({ music: DEFAULT_SETTINGS.music, effects: DEFAULT_SETTINGS.effects, sensitivity: 1, camera: 0, sound: false });
    await saveSettings({ ...DEFAULT_SETTINGS, music: .2, reducedMotion: true });
    await recordResult(result());
    await clearRecords();
    expect((await loadProfile()).records).toHaveLength(0);
    expect(await loadSettings()).toMatchObject({ music: .2, reducedMotion: true });
    expect(JSON.parse(storage.get('farestorm-local:profile')!)[1]).toBeNull();
  });
  it('migrates version zero aggregates and persists a valid ghost with its result', async () => {
    const migrated = validateProfile({ version: 0, records: [result()], discovered: [3, 3, -1], lessons: [] });
    expect(migrated).toMatchObject({ version: 1, totalDeliveries: 3, bestScore: 12000, discovered: [3] });
    await recordResult(result(), replay());
    expect((await loadProfile()).ghost?.result?.id).toBe('test-run');
  });
  it('never replaces an earned medal with a lower medal', async () => {
    await recordResult({ ...result('gold'), mode: 'trial', trial: 2, medal: 'gold' });
    await recordResult({ ...result('bronze'), mode: 'trial', trial: 2, medal: 'bronze' });
    expect((await loadProfile()).medals['2']).toBe('gold');
  });
});
