import type { CharacterSave, GameOptions, HeroState, QuestStep } from "./types";

const DATABASE = "ashfall-covenant";
const STORE = "characters";
const VERSION = 1;
const ACTIVE_KEY = "active";
const BACKUP_KEY = "backup";

export function checksum(payload: unknown): string {
  const source = JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getRecord(key: string): Promise<CharacterSave | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as CharacterSave | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function putRecord(key: string, value: CharacterSave): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function isValidSave(save: CharacterSave | undefined): save is CharacterSave {
  return Boolean(save && save.schemaVersion === VERSION && save.checksum === checksum(save.payload));
}

export async function loadSave(): Promise<{ save?: CharacterSave; recovered: boolean }> {
  try {
    const active = await getRecord(ACTIVE_KEY);
    if (isValidSave(active)) return { save: active, recovered: false };
    const backup = await getRecord(BACKUP_KEY);
    if (isValidSave(backup)) return { save: backup, recovered: true };
  } catch {
    // IndexedDB can be unavailable in strict privacy contexts. The game remains playable.
  }
  return { recovered: false };
}

export async function saveCharacter(
  options: GameOptions,
  hero: HeroState,
  questStep: QuestStep,
  waypointActive: boolean,
  artificerRescued: boolean,
  veteranUnlocked: boolean,
): Promise<void> {
  const payload: CharacterSave["payload"] = {
    heroClass: options.heroClass,
    heroName: options.heroName,
    difficulty: options.difficulty,
    seed: options.seed,
    hero: structuredClone(hero),
    questStep,
    waypointActive,
    artificerRescued,
    veteranUnlocked,
  };
  const record: CharacterSave = { schemaVersion: VERSION, savedAt: Date.now(), checksum: checksum(payload), payload };
  try {
    const current = await getRecord(ACTIVE_KEY);
    if (isValidSave(current)) await putRecord(BACKUP_KEY, current);
    await putRecord(ACTIVE_KEY, record);
  } catch {
    // Persistence errors are surfaced by the shell on the next save status refresh.
  }
}

export async function clearSave(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}
