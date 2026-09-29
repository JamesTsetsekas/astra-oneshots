import { DEFAULT_SETTINGS, type MatchResult, type Settings } from "./types";
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(
      localStorage.getItem("skybreak.settings.v1") ?? "null",
    );
    if (!raw || typeof raw !== "object")
      return {
        ...DEFAULT_SETTINGS,
        bindings: { ...DEFAULT_SETTINGS.bindings },
      };
    const normalized: Settings = {
      ...DEFAULT_SETTINGS,
      quality: ["low", "medium", "high"].includes(raw.quality)
        ? raw.quality
        : "high",
      sensitivity: Math.max(0.3, Math.min(3, Number(raw.sensitivity) || 1)),
      fov: Math.max(70, Math.min(110, Number(raw.fov) || 90)),
      bindings: { ...DEFAULT_SETTINGS.bindings },
    };
    for (const key of [
      "sound",
      "music",
      "reducedMotion",
      "colorblind",
      "shadows",
      "invertY",
    ] as const) {
      if (typeof raw[key] === "boolean") normalized[key] = raw[key];
    }
    for (const key of Object.keys(normalized.bindings)) {
      const value = raw.bindings?.[key];
      if (
        typeof value === "string" &&
        /^[A-Za-z][A-Za-z0-9]{0,25}$/.test(value)
      )
        normalized.bindings[key] = value;
    }
    return normalized;
  } catch {
    return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_SETTINGS.bindings } };
  }
}
export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem("skybreak.settings.v1", JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
export function loadCareer(): MatchResult[] {
  try {
    const data = JSON.parse(localStorage.getItem("skybreak.career.v1") ?? "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (r) =>
              r?.version === 1 &&
              typeof r.id === "string" &&
              typeof r.kills === "number",
          )
          .slice(-40)
      : [];
  } catch {
    return [];
  }
}
export function saveResult(result: MatchResult) {
  const history = loadCareer();
  if (!history.some((r) => r.id === result.id)) history.push(result);
  try {
    localStorage.setItem(
      "skybreak.career.v1",
      JSON.stringify(history.slice(-40)),
    );
    return true;
  } catch {
    return false;
  }
}
