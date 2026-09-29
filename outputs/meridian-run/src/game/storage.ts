import { DEFAULT_SETTINGS, type SaveGame, type Settings } from "./types";
import { MISSIONS, VEHICLES, WEAPONS } from "./content";
type Envelope = { version: 1; payload: string; checksum: string };
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
export function encodeSave(save: SaveGame): Envelope {
  const payload = JSON.stringify(save);
  return { version: 1, payload, checksum: hash(payload) };
}
export function decodeSave(data: unknown): SaveGame {
  const e = data as Envelope;
  if (
    e?.version !== 1 ||
    typeof e.payload !== "string" ||
    hash(e.payload) !== e.checksum
  )
    throw new Error("Save checksum mismatch.");
  const s = JSON.parse(e.payload) as SaveGame;
  if (!s?.player || !Object.hasOwn(WEAPONS, s.player.weapon))
    throw new Error("Unknown equipped weapon.");
  if (
    ![
      s.player.armor,
      s.player.stamina,
      s.player.ammo,
      s.player.reserve,
      s.player.medkits,
      s.player.gadgets,
      s.player.trust,
      s.player.heading,
    ].every(Number.isFinite)
  )
    throw new Error("Invalid equipment or character values.");
  if (
    s.player.armor < 0 ||
    s.player.armor > 100 ||
    s.player.stamina < 0 ||
    s.player.stamina > 8 ||
    s.player.ammo < 0 ||
    s.player.ammo > WEAPONS[s.player.weapon].mag ||
    s.player.reserve < 0 ||
    s.player.trust < 0 ||
    s.player.trust > 5
  )
    throw new Error("Character values outside allowed ranges.");
  if (s.mission) {
    const def = MISSIONS.find((m) => m.id === s.mission!.id);
    if (
      !def ||
      !Number.isInteger(s.mission.stage) ||
      s.mission.stage < 0 ||
      s.mission.stage >= def.stages.length ||
      !Number.isFinite(s.mission.elapsed)
    )
      throw new Error("Invalid mission checkpoint.");
  }
  if (
    s.alert &&
    (!Number.isInteger(s.alert.tier) ||
      s.alert.tier < 0 ||
      s.alert.tier > 5 ||
      !Number.isFinite(s.alert.heat) ||
      !Number.isFinite(s.alert.lastKnown?.x) ||
      !Number.isFinite(s.alert.lastKnown?.z))
  )
    throw new Error("Invalid wanted evidence.");
  if (
    s.vehicle &&
    (!VEHICLES.some((v) => v.id === s.vehicle!.definition) ||
      ![s.vehicle.x, s.vehicle.z, s.vehicle.condition, s.vehicle.heading].every(
        Number.isFinite,
      ) ||
      s.vehicle.condition < 0 ||
      s.vehicle.condition > 100)
  )
    throw new Error("Invalid saved vehicle.");
  if (
    s.version !== 1 ||
    !s.player ||
    !Array.isArray(s.completed) ||
    !Array.isArray(s.results) ||
    ![
      s.player.x,
      s.player.y,
      s.player.z,
      s.player.health,
      s.player.cash,
      s.time,
    ].every(Number.isFinite)
  )
    throw new Error("Unsupported save format.");
  if (
    s.player.cash < 0 ||
    s.player.health < 0 ||
    s.player.health > 100 ||
    Math.abs(s.player.x) > 450 ||
    Math.abs(s.player.z) > 450
  )
    throw new Error("Save values are invalid.");
  return s;
}
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("meridian-run", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read(key: string) {
  const d = await db();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const q = d.transaction("data").objectStore("data").get(key);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  } finally {
    d.close();
  }
}
async function write(key: string, value: unknown) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("data", "readwrite");
      tx.objectStore("data").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    d.close();
  }
}
export async function loadSave() {
  for (const slot of ["save", "backup"]) {
    const data = await read(slot);
    if (data)
      try {
        return decodeSave(data);
      } catch {
        continue;
      }
  }
  return undefined;
}
export async function saveGame(save: SaveGame) {
  const envelope = encodeSave(structuredClone(save));
  const previous = await read("save");
  if (previous) {
    try {
      decodeSave(previous);
      await write("backup", previous);
    } catch {
      /* Keep last verified backup. */
    }
  }
  await write("save", envelope);
}
export function loadSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem("meridian-settings") ?? "{}");
    return {
      ...DEFAULT_SETTINGS,
      ...value,
      quality: ["low", "medium", "high"].includes(value.quality)
        ? value.quality
        : "high",
      music: Math.max(0, Math.min(1, value.music ?? 0.25)),
      effects: Math.max(0, Math.min(1, value.effects ?? 0.7)),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(settings: Settings) {
  localStorage.setItem("meridian-settings", JSON.stringify(settings));
}
