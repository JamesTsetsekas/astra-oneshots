import type { Replay, Result } from "./simulation";
import { HEROES } from "./content";
export interface Profile {
  version: 1;
  history: Result[];
  mastery: Record<string, number>;
  replay?: Replay;
}
const empty = (): Profile => ({ version: 1, history: [], mastery: {} });
export function decodeProfile(record: unknown): Profile | undefined {
  try {
    const r = record as { data?: Profile; checksum?: string };
    const p = r?.data;
    if (
      !p ||
      p.version !== 1 ||
      r.checksum !== checksum(p) ||
      !Array.isArray(p.history) ||
      p.history.length > 30 ||
      !p.mastery ||
      typeof p.mastery !== "object"
    )
      return;
    if (
      p.history.some(
        (result) =>
          !result ||
          typeof result.id !== "string" ||
          !HEROES.some((h) => h.id === result.hero) ||
          ![0, 1].includes(result.winner) ||
          !Number.isFinite(result.duration) ||
          !Array.isArray(result.scoreboard),
      )
    )
      return;
    if (Object.values(p.mastery).some((n) => !Number.isFinite(n) || n < 0))
      return;
    if (
      p.replay &&
      (p.replay.version !== 1 ||
        !Array.isArray(p.replay.commands) ||
        p.replay.commands.length > 20000)
    )
      return;
    return structuredClone(p);
  } catch {
    return;
  }
}
export const checksum = (data: unknown) => {
  let h = 2166136261;
  for (const c of JSON.stringify(data)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const q = indexedDB.open("crownfall-local", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("profile");
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
export async function loadProfile(): Promise<Profile> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const tx = d.transaction("profile"),
        store = tx.objectStore("profile");
      const active = store.get("active"),
        backup = store.get("backup");
      tx.oncomplete = () => {
        d.close();
        resolve(
          decodeProfile(active.result) ??
            decodeProfile(backup.result) ??
            empty(),
        );
      };
      tx.onerror = () => {
        d.close();
        resolve(empty());
      };
    });
  } catch {
    return empty();
  }
}
export async function recordResult(
  result: Result,
  replay: Replay,
): Promise<Profile> {
  const profile = await loadProfile();
  if (profile.history.some((r) => r.id === result.id)) return profile;
  const previous = structuredClone(profile);
  profile.history = [result, ...profile.history].slice(0, 30);
  profile.mastery[result.hero] =
    (profile.mastery[result.hero] ?? 0) + (result.winner === 0 ? 120 : 65);
  profile.replay = replay;
  const data = structuredClone(profile);
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("profile", "readwrite");
    tx.objectStore("profile").put(
      { data: previous, checksum: checksum(previous) },
      "backup",
    );
    tx.objectStore("profile").put({ data, checksum: checksum(data) }, "active");
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => {
      d.close();
      reject(tx.error);
    };
  });
  return profile;
}
export function downloadReplay(replay: Replay) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(replay, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `crownfall-${replay.options.seed}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
