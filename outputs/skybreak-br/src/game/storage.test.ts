import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSettings, saveSettings, loadCareer, saveResult } from "./storage";
import { DEFAULT_SETTINGS, type MatchResult } from "./types";
afterEach(() => vi.unstubAllGlobals());
const memory = () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  return data;
};
describe("private local persistence", () => {
  it("recovers from malformed storage and clamps settings", () => {
    const data = memory();
    data.set("skybreak.settings.v1", "{broken");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    data.set(
      "skybreak.settings.v1",
      JSON.stringify({
        sensitivity: 90,
        fov: -40,
        quality: "ultra",
        music: { bad: true },
        bindings: { forward: 42, back: "KeyJ" },
      }),
    );
    const s = loadSettings();
    expect(s.sensitivity).toBe(3);
    expect(s.fov).toBe(70);
    expect(s.quality).toBe("high");
    expect(s.music).toBe(true);
    expect(s.bindings.forward).toBe("KeyW");
    expect(s.bindings.back).toBe("KeyJ");
  });
  it("stores settings, deduplicates results, and retains at most 40 records", () => {
    memory();
    expect(saveSettings({ ...DEFAULT_SETTINGS, sound: false })).toBe(true);
    expect(loadSettings().sound).toBe(false);
    for (let i = 0; i < 45; i++)
      saveResult({ version: 1, id: "test-" + i, kills: 1 } as MatchResult);
    saveResult({ version: 1, id: "test-44", kills: 1 } as MatchResult);
    expect(loadCareer()).toHaveLength(40);
  });
  it("degrades gracefully when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("disabled");
      },
      setItem: () => {
        throw Error("disabled");
      },
    });
    expect(loadCareer()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS)).toBe(false);
  });
});
