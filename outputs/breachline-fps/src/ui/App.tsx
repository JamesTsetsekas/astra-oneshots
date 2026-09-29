import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Crosshair,
  Medal,
  Pause,
  Play,
  Skull,
  Users,
  X,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import {
  cover,
  defaultLoadouts,
  validLoadout,
  primaryIds,
  sidearmIds,
  TEAM_NAMES,
  weapons,
  type Loadout,
  type Team,
} from "../game/data";
import { MatchRuntime, type Settings, type Practice } from "../game/runtime";
import { type Snapshot } from "../game/simulation";
import menuArt from "../assets/breachline-menu.png";
type Screen =
  | "menu"
  | "practice"
  | "loadouts"
  | "profile"
  | "settings"
  | "credits"
  | "playing"
  | "results";
type Profile = {
  name: string;
  level: number;
  xp: number;
  matches: number;
  wins: number;
  kills: number;
  best: number;
};
const initialProfile: Profile = {
  name: "Operator",
  level: 1,
  xp: 0,
  matches: 0,
  wins: 0,
  kills: 0,
  best: 0,
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value && typeof value === "object"
      ? { ...fallback, ...value }
      : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Session remains playable if storage is unavailable. */
  }
};
const clock = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
const initialSettings: Settings = {
  sensitivity: 1.5,
  fov: 90,
  sound: true,
  reducedMotion: false,
};
const readLoadouts = () => {
  try {
    const data = JSON.parse(
      localStorage.getItem("breachline.loadouts") ?? "null",
    );
    return Array.isArray(data) && data.length === 5 && data.every(validLoadout)
      ? data
      : defaultLoadouts;
  } catch {
    return defaultLoadouts;
  }
};

export function App() {
  const [screen, setScreen] = useState<Screen>("menu"),
    [mode, setMode] = useState<"practice" | "online">("practice");
  const [settings, setSettings] = useState<Settings>(() => {
    const s = read("breachline.settings", initialSettings);
    return {
      ...s,
      fov: Math.max(75, Math.min(110, Number(s.fov) || 90)),
      sensitivity: Math.max(0.1, Math.min(10, Number(s.sensitivity) || 1.5)),
    };
  });
  const [profile, setProfile] = useState<Profile>(() =>
      read("breachline.profile", initialProfile),
    ),
    [loadouts, setLoadouts] = useState<Loadout[]>(readLoadouts),
    [selected, setSelected] = useState(0);
  const [practice, setPractice] = useState<Practice>({
      duration: 480,
      score: 75,
      difficulty: "normal",
    }),
    [snapshot, setSnapshot] = useState<Snapshot>(),
    [localId, setLocalId] = useState("local"),
    [locked, setLocked] = useState(false),
    [scoreboard, setScoreboard] = useState(false),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [run, setRun] = useState(0),
    [fps, setFps] = useState(0),
    [resetConfirm, setResetConfirm] = useState(false);
  const host = useRef<HTMLDivElement>(null),
    map = useRef<HTMLCanvasElement>(null),
    runtime = useRef<MatchRuntime | undefined>(undefined),
    awarded = useRef(false);
  useEffect(() => save("breachline.settings", settings), [settings]);
  useEffect(() => save("breachline.profile", profile), [profile]);
  useEffect(() => save("breachline.loadouts", loadouts), [loadouts]);
  const start = (next: "practice" | "online") => {
    setMode(next);
    setSnapshot(undefined);
    setError("");
    setConnected(false);
    setLocked(false);
    setScoreboard(false);
    awarded.current = false;
    setRun((v) => v + 1);
    setScreen("playing");
  };
  const menu = () => {
    document.exitPointerLock();
    setScreen("menu");
  };
  useEffect(() => {
    if (screen !== "playing" || !host.current) return;
    try {
      runtime.current = new MatchRuntime(
        host.current,
        mode,
        profile.name,
        loadouts[selected],
        settings,
        practice,
        {
          state: (state, id, rate) => {
            setSnapshot(state);
            setLocalId(id);
            setFps(rate);
            if (state.winner && !awarded.current) {
              awarded.current = true;
              const me = state.players.find((p) => p.id === id);
              setProfile((old) => {
                const xp =
                  old.xp +
                  120 +
                  (me?.kills ?? 0) * 30 +
                  (me?.assists ?? 0) * 15 +
                  (me?.team === state.winner ? 150 : 0);
                return {
                  ...old,
                  xp,
                  level: Math.min(30, 1 + Math.floor(xp / 500)),
                  matches: old.matches + 1,
                  wins: old.wins + Number(me?.team === state.winner),
                  kills: old.kills + (me?.kills ?? 0),
                  best: Math.max(old.best, me?.best ?? 0),
                };
              });
              document.exitPointerLock();
              setScreen("results");
            }
          },
          lock: setLocked,
          error: setError,
          connected: () => setConnected(true),
          scoreboard: setScoreboard,
        },
      );
    } catch (e) {
      setError(
        `Renderer could not start: ${e instanceof Error ? e.message : "WebGL unavailable"}`,
      );
    }
    return () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    };
  }, [screen, run]);
  const hero = snapshot?.players.find((p) => p.id === localId),
    gun = hero
      ? weapons[hero.slot === 0 ? hero.loadout.primary : hero.loadout.sidearm]
      : undefined;
  useEffect(() => {
    if (!map.current || !snapshot || !hero) return;
    const ctx = map.current.getContext("2d");
    if (!ctx) return;
    const w = 184,
      h = 150;
    map.current.width = w;
    map.current.height = h;
    const point = (x: number, z: number) => [
      ((x + 57.5) / 115) * w,
      ((47.5 - z) / 95) * h,
    ];
    ctx.fillStyle = "#152d33";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3e5960";
    for (let x = 0; x < w; x += 23) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let z = 0; z < h; z += 25) {
      ctx.beginPath();
      ctx.moveTo(0, z);
      ctx.lineTo(w, z);
      ctx.stroke();
    }
    ctx.fillStyle = "#6c7a77";
    for (const c of cover) {
      const [x, z] = point(c.x, c.z);
      ctx.fillRect(
        x - ((c.w / 115) * w) / 2,
        z - ((c.d / 95) * h) / 2,
        (c.w / 115) * w,
        (c.d / 95) * h,
      );
    }
    for (const p of snapshot.players) {
      if (
        !p.alive ||
        p.id === localId ||
        (p.team !== hero.team &&
          p.spotted <= 0 &&
          (snapshot.time - p.lastShot > 1.1 ||
            p.loadout.barrel === "suppressor"))
      )
        continue;
      const [x, z] = point(p.x, p.z);
      ctx.fillStyle = p.team === hero.team ? "#73ced3" : "#f29250";
      ctx.beginPath();
      ctx.arc(x, z, p.team === hero.team ? 2.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const [x, z] = point(hero.x, hero.z);
    ctx.save();
    ctx.translate(x, z);
    ctx.rotate(hero.yaw);
    ctx.fillStyle = "#fff2ce";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.fill();
    ctx.restore();
  }, [snapshot, localId]);
  const edit = (key: keyof Loadout, value: string) =>
    setLoadouts((all) =>
      all.map((l, i) => (i === selected ? { ...l, [key]: value } : l)),
    );
  const latestKills =
    snapshot?.events
      .filter((e) => e.kind === "kill" && snapshot.time - e.time < 4)
      .slice(-4)
      .reverse() ?? [];
  const hit = snapshot?.events.findLast(
    (e) =>
      (e.kind === "hit" || e.kind === "kill") &&
      e.actor === localId &&
      snapshot.time - e.time < 0.3,
  );
  const notice = snapshot?.events.findLast(
    (e) =>
      (e.kind === "support" || e.kind === "info") &&
      (e.actor === localId || !e.actor) &&
      snapshot.time - e.time < 2.2,
  );
  const field = (
    label: string,
    key: keyof Loadout,
    options: ReadonlyArray<readonly [string, string]>,
  ) => (
    <label className="loadout-field">
      {label}
      <select
        value={loadouts[selected][key]}
        onChange={(e) => edit(key, e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  if (!["playing", "results"].includes(screen))
    return (
      <main
        className="menu"
        style={{
          backgroundImage: `linear-gradient(90deg,#08171ff7 0%,#08171fe5 35%,#08171c22 78%),url(${menuArt})`,
        }}
      >
        <header className="menu-header">
          <div className="brand">
            <Crosshair size={28} weight="bold" />
            BREACHLINE
          </div>
          <span>RELAY STATION K-17 / NORTH ATLANTIC</span>
          <span className="operator-tag">
            LV {String(profile.level).padStart(2, "0")} · {profile.name}
          </span>
        </header>
        {screen === "menu" && (
          <>
            <section className="menu-content">
              <p className="eyebrow">06 / 06 · TEAM CLASH</p>
              <h1>
                HOLD THE
                <br />
                <em>LINE.</em>
              </h1>
              <p className="menu-sub">
                Storm cleared. Signal contested.
                <br />
                Take your kit into a fast, close-quarters fight above the open
                sea.
              </p>
              <div className="menu-actions">
                <button
                  className="primary"
                  onClick={() => setScreen("practice")}
                >
                  <Play weight="fill" /> DEPLOY / PRACTICE <ArrowRight />
                </button>
                <button onClick={() => start("online")}>
                  <Users /> JOIN LOCAL RELAY <small>SERVER REQUIRED</small>
                </button>
                <button onClick={() => setScreen("loadouts")}>
                  <Crosshair /> ARMORY{" "}
                  <span>{loadouts[selected].name.toUpperCase()}</span>
                </button>
              </div>
              <nav className="menu-secondary">
                <button onClick={() => setScreen("profile")}>OPERATOR</button>
                <button onClick={() => setScreen("settings")}>SETTINGS</button>
                <button onClick={() => setScreen("credits")}>
                  FIELD GUIDE
                </button>
              </nav>
            </section>
            <aside className="mission-card">
              <small>ACTIVE LOCATION / 01</small>
              <strong>
                RELAY STATION
                <br />
                K—17
              </strong>
              <span>Operations wing · Dish courtyard · Maintenance</span>
              <div>
                <i /> OFFLINE PRACTICE READY
              </div>
            </aside>
          </>
        )}
        {screen === "practice" && (
          <section className="menu-panel narrow">
            <Head title="MISSION SETUP" back={menu} />
            <p className="panel-copy">
              You and five squadmates against six opponents. Bots use the same
              weapons, health, collision, and respawn rules.
            </p>
            <div className="mode-presets">
              <button
                className={practice.score === 75 ? "active" : ""}
                onClick={() =>
                  setPractice((p) => ({ ...p, duration: 480, score: 75 }))
                }
              >
                <strong>TEAM CLASH</strong>
                <span>8 minutes · First to 75</span>
              </button>
              <button
                className={practice.score === 30 ? "active" : ""}
                onClick={() =>
                  setPractice((p) => ({ ...p, duration: 180, score: 30 }))
                }
              >
                <strong>QUICK SKIRMISH</strong>
                <span>3 minutes · First to 30</span>
              </button>
            </div>
            <label className="loadout-field">
              BOT DIFFICULTY
              <select
                value={practice.difficulty}
                onChange={(e) =>
                  setPractice((p) => ({
                    ...p,
                    difficulty: e.target.value as Practice["difficulty"],
                  }))
                }
              >
                <option value="easy">Recruit / slower reactions</option>
                <option value="normal">Regular / balanced</option>
                <option value="hard">Veteran / faster aim</option>
              </select>
            </label>
            <label className="loadout-field">
              DEPLOYMENT KIT
              <select
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                {loadouts.map((l, i) => (
                  <option key={i} value={i}>
                    {l.name} / {weapons[l.primary].name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" onClick={() => start("practice")}>
              <Play weight="fill" /> ENTER RELAY STATION <ArrowRight />
            </button>
            <p className="small-copy">
              Practice pauses when mouse capture is released. Press Esc to
              pause.
            </p>
          </section>
        )}
        {screen === "loadouts" && (
          <section className="menu-panel">
            <Head title="ARMORY" back={menu} />
            <div className="loadout-tabs">
              {loadouts.map((l, i) => (
                <button
                  key={i}
                  className={selected === i ? "active" : ""}
                  onClick={() => setSelected(i)}
                >
                  {String(i + 1).padStart(2, "0")}
                  <strong>{l.name}</strong>
                </button>
              ))}
            </div>
            <div className="loadout-body">
              <div>
                {field(
                  "PRIMARY",
                  "primary",
                  primaryIds.map((id) => [
                    id,
                    weapons[id].name + " / " + weapons[id].role,
                  ]),
                )}
                {field(
                  "SIDEARM",
                  "sidearm",
                  sidearmIds.map((id) => [id, weapons[id].name]),
                )}
                {field("OPTIC", "optic", [
                  ["iron", "Iron sights / unobstructed view"],
                  ["reflex", "Reflex sight / clear aiming dot"],
                  ["2x", "2× optic / stronger zoom"],
                ])}
                {field("BARREL", "barrel", [
                  ["standard", "Standard / balanced"],
                  ["suppressor", "Suppressor / no firing reveal on minimap"],
                  ["compensator", "Compensator / 17% tighter spread"],
                ])}
              </div>
              <div>
                {field("FIELD PERK", "perk", [
                  ["fleet", "Fleet Boots / 8% movement speed"],
                  ["patch", "Field Patch / healing starts 0.8s sooner"],
                  ["scavenger", "Scavenger Rig / extra reserve and kill ammo"],
                ])}
                {field("LETHAL", "lethal", [
                  ["frag", "Fragmentation / larger radius, 2s fuse"],
                  ["adhesive", "Adhesive / sticks to walls, 1.5s fuse"],
                ])}
                {field("TACTICAL", "tactical", [
                  ["flash", "Flash pulse / visible targets disoriented"],
                  ["signal", "Signal pulse / nearby minimap reveal"],
                ])}
                <div className="weapon-profile">
                  <span>{weapons[loadouts[selected].primary].role}</span>
                  <strong>{weapons[loadouts[selected].primary].name}</strong>
                  <p>
                    {weapons[loadouts[selected].primary].damage} body damage ·{" "}
                    {weapons[loadouts[selected].primary].mag} rounds
                    <br />
                    {weapons[loadouts[selected].primary].rpm} RPM ·{" "}
                    {weapons[loadouts[selected].primary].reload}s reload
                  </p>
                </div>
              </div>
            </div>
            <p className="small-copy">
              All equipment is available in Practice. Progression is cosmetic
              and never raises base damage or health.
            </p>
            <button
              className="primary compact"
              onClick={() => setScreen("practice")}
            >
              DEPLOY WITH THIS KIT <ArrowRight />
            </button>
          </section>
        )}
        {screen === "profile" && (
          <section className="menu-panel narrow">
            <Head title="OPERATOR" back={menu} />
            <label className="field-label">
              CALLSIGN
              <input
                maxLength={22}
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
              />
            </label>
            <div className="profile-level">
              <Medal size={40} />
              <strong>{String(profile.level).padStart(2, "0")}</strong>
              <span>
                FIELD LEVEL
                <br />
                {profile.xp} TOTAL XP
              </span>
            </div>
            <div className="profile-stats">
              <span>
                MATCHES<b>{profile.matches}</b>
              </span>
              <span>
                WINS<b>{profile.wins}</b>
              </span>
              <span>
                ELIMINATIONS<b>{profile.kills}</b>
              </span>
              <span>
                BEST MOMENTUM<b>{profile.best}</b>
              </span>
            </div>
            <p className="small-copy">
              Stored only in this browser. No account, telemetry, or remote
              profile service.
            </p>
            <button
              className="plain"
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(
                  new Blob(
                    [JSON.stringify({ profile, loadouts, settings }, null, 2)],
                    { type: "application/json" },
                  ),
                );
                a.download = "breachline-profile.json";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              EXPORT PROFILE
            </button>
            <button
              className="plain danger"
              onClick={() => {
                if (resetConfirm) {
                  setProfile(initialProfile);
                  setResetConfirm(false);
                } else setResetConfirm(true);
              }}
            >
              {resetConfirm
                ? "CONFIRM — ERASE LOCAL STATS"
                : "RESET LOCAL STATS"}
            </button>
          </section>
        )}
        {screen === "settings" && (
          <section className="menu-panel narrow">
            <Head title="SETTINGS" back={menu} />
            <label className="field-label">
              MOUSE SENSITIVITY<b>{settings.sensitivity.toFixed(1)}</b>
              <input
                type="range"
                min=".1"
                max="10"
                step=".1"
                value={settings.sensitivity}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    sensitivity: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="field-label">
              HORIZONTAL FIELD OF VIEW<b>{settings.fov}°</b>
              <input
                type="range"
                min="75"
                max="110"
                value={settings.fov}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, fov: Number(e.target.value) }))
                }
              />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, sound: e.target.checked }))
                }
              />{" "}
              AUDIO FEEDBACK
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    reducedMotion: e.target.checked,
                  }))
                }
              />{" "}
              REDUCED MOTION
            </label>
            <p className="small-copy">
              Reduced motion removes weapon recoil and locomotion bob. FOV
              converts correctly for the viewport aspect ratio.
            </p>
            <Controls />
          </section>
        )}
        {screen === "credits" && (
          <section className="menu-panel narrow">
            <Head title="FIELD GUIDE" back={menu} />
            <p className="panel-copy">
              Three lanes. Multiple connectors. Fight through Operations, circle
              the dish courtyard, or flank through Maintenance. Jump near low
              crates to mantle. Crouch behind waist cover; aim at exposed heads.
            </p>
            <h3>MOMENTUM / RESETS ON DEATH</h3>
            <p className="panel-copy">
              3 eliminations: Recon Sweep.
              <br />
              5: Ammo Pod, replenishing equipment.
              <br />
              8: Interdiction, a short-range line-of-sight strike.
              <br />
              Press 4 to deploy the highest unused tier.
            </p>
            <Controls />
            <p className="small-copy">
              Original fictional world, procedural models and synthesized
              effects. Menu artwork generated for this project. Three.js, React,
              Phosphor icons. This local build supports Practice and a
              self-hosted relay; there is no public matchmaking or remote
              account service.
            </p>
          </section>
        )}
      </main>
    );
  if (screen === "results")
    return (
      <main
        className="result-screen"
        style={{
          backgroundImage: `linear-gradient(90deg,#07141cf5,#07141c9c),url(${menuArt})`,
        }}
      >
        <section className="result-content">
          <p className="eyebrow">DEBRIEF / MATCH COMPLETE</p>
          <h1>
            {snapshot?.winner === hero?.team
              ? "VICTORY"
              : snapshot?.winner === "draw"
                ? "DRAW"
                : "DEFEAT"}
          </h1>
          <div className="result-score">
            <b>{snapshot?.score[0]}</b>
            <span>ATLAS / COBALT</span>
            <b>{snapshot?.score[1]}</b>
          </div>
          <div className="result-stats">
            <span>
              ELIMINATIONS<b>{hero?.kills ?? 0}</b>
            </span>
            <span>
              DEATHS / ASSISTS
              <b>
                {hero?.deaths ?? 0} / {hero?.assists ?? 0}
              </b>
            </span>
            <span>
              ACCURACY
              <b>
                {hero?.shots ? Math.round((hero.hits / hero.shots) * 100) : 0}%
              </b>
            </span>
            <span>
              BEST MOMENTUM<b>{hero?.best ?? 0}</b>
            </span>
          </div>
          <p className="small-copy">
            {clock(snapshot?.time ?? 0)} played · Field level {profile.level} ·{" "}
            {profile.xp} total XP
            <br />
            Progress saved locally.
          </p>
          <button className="primary" onClick={() => start(mode)}>
            <ArrowsClockwise /> PLAY AGAIN <ArrowRight />
          </button>
          <button className="plain" onClick={menu}>
            RETURN TO MENU
          </button>
        </section>
      </main>
    );
  const damage =
    hero && snapshot
      ? Math.max(0, 1 - (snapshot.time - hero.lastDamage) / 0.65)
      : 0;
  return (
    <main className="match">
      <div ref={host} className="game-host" />
      <div className="hud">
        <div
          className="damage-vignette"
          style={{ opacity: damage * 0.8 + (hero && hero.hp < 30 ? 0.3 : 0) }}
        />
        {hero && hero.flash > 0 && (
          <div
            className="flash-overlay"
            style={{ opacity: Math.min(0.8, hero.flash / 2) }}
          />
        )}
        <div className="hud-top">
          <div className="map-frame">
            <canvas ref={map} />
            <span>K—17 / RELAY STATION</span>
          </div>
          <div className="match-score">
            <small>{snapshot?.overtime ? "OVERTIME" : "TEAM CLASH"}</small>
            <div>
              <b>{snapshot?.score[0] ?? 0}</b>
              <span>{clock(snapshot?.remaining ?? practice.duration)}</span>
              <b>{snapshot?.score[1] ?? 0}</b>
            </div>
            <small>FIRST TO {snapshot?.scoreLimit ?? practice.score}</small>
          </div>
          <div className="kill-feed">
            {latestKills.map((e) => (
              <p key={e.id} className={e.actor === localId ? "your-kill" : ""}>
                {e.text}
              </p>
            ))}
          </div>
        </div>
        {hero && (
          <>
            <div className={`crosshair ${hero.ads ? "aiming" : ""}`}>
              <i />
              <i />
              <i />
              <i />
            </div>
            {hit && (
              <div className={`hitmarker ${hit.kind === "kill" ? "kill" : ""}`}>
                ×
              </div>
            )}
            {damage > 0 && (
              <div
                className="damage-direction"
                style={{
                  transform: `translate(-50%,-50%) rotate(${(-(hero.damageYaw - hero.yaw) * 180) / Math.PI}deg)`,
                }}
              >
                ▲
              </div>
            )}
            <div className="hud-bottom">
              <div className="health">
                <span>{TEAM_NAMES[hero.team]} / HEALTH</span>
                <strong>{Math.ceil(hero.hp)}</strong>
                <div className="meter">
                  <i style={{ width: `${hero.hp}%` }} />
                </div>
                <small>
                  {hero.kills} K · {hero.deaths} D · {hero.assists} A
                </small>
              </div>
              <div className="momentum">
                <span>MOMENTUM</span>
                <strong>
                  {hero.momentum}
                  <em> / 8</em>
                </strong>
                <div className="momentum-pips">
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} className={hero.momentum > i ? "filled" : ""} />
                  ))}
                </div>
                <small>
                  {hero.momentum >= 3
                    ? "4 · DEPLOY HIGHEST READY SUPPORT"
                    : "3 RECON · 5 AMMO · 8 INTERDICTION"}
                </small>
              </div>
              <div className="ammo">
                <span>{gun?.name}</span>
                <div>
                  <strong>{hero.ammo}</strong>
                  <small> / {hero.reserve}</small>
                </div>
                <small>
                  {hero.reloadTime > 0
                    ? `RELOADING · ${hero.reloadTime.toFixed(1)}s`
                    : `Q ${hero.tactical ? "TACTICAL" : "USED"} · G ${hero.lethal ? "CHARGE" : "USED"}`}
                </small>
              </div>
            </div>
            {hero.reloadTime > 0 && (
              <div className="reload-meter">
                <i
                  style={{
                    width: `${(1 - hero.reloadTime / (gun?.reload ?? 1)) * 100}%`,
                  }}
                />
              </div>
            )}
            {hero.protection > 0 && (
              <div className="protection">
                SPAWN PROTECTION · FIRING ENDS IT
              </div>
            )}
            {!hero.alive && (
              <div className="death">
                <Skull size={36} />
                <strong>OPERATOR DOWN</strong>
                <span>
                  {hero.killer} / {hero.killedWith}
                </span>
                <p>RESPAWNING IN {Math.ceil(hero.respawn)}</p>
                <label>
                  Next kit
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(Number(e.target.value));
                      runtime.current?.setLoadout(
                        loadouts[Number(e.target.value)],
                      );
                    }}
                  >
                    {loadouts.map((l, i) => (
                      <option key={i} value={i}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}
        {!locked && connected && !error && (
          <div className="pause-panel">
            <small>
              {mode === "practice"
                ? "PRACTICE PAUSED"
                : "RELAY MATCH CONTINUES"}
            </small>
            <h2>
              {snapshot && snapshot.time > 1
                ? "BACK IN THE FIGHT."
                : "READY TO DEPLOY."}
            </h2>
            <p>
              WASD move · Mouse aim · Left click fire
              <br />
              Right click aim · Shift sprint · R reload
            </p>
            <button className="primary" onClick={() => runtime.current?.lock()}>
              <Play weight="fill" />
              {snapshot && snapshot.time > 1 ? "RESUME" : "DEPLOY"}
              <ArrowRight />
            </button>
            <button className="plain" onClick={menu}>
              LEAVE MATCH
            </button>
          </div>
        )}
        {!connected && !error && (
          <div className="connection">
            <Users size={30} />
            <h2>JOINING RELAY</h2>
            <p>Connecting to the self-hosted room.</p>
            <button className="plain" onClick={menu}>
              CANCEL
            </button>
          </div>
        )}
        {error && (
          <div className="connection">
            <X size={28} />
            <h2>CONNECTION / INPUT NOTICE</h2>
            <p>{error}</p>
            {connected && (
              <button
                className="primary"
                onClick={() => {
                  setError("");
                  runtime.current?.lock();
                }}
              >
                TRY RESUME
              </button>
            )}
            <button className="primary" onClick={() => start("practice")}>
              START PRACTICE
            </button>
            <button className="plain" onClick={menu}>
              RETURN TO MENU
            </button>
          </div>
        )}
        {scoreboard && snapshot && (
          <Scoreboard snapshot={snapshot} localId={localId} />
        )}
        <button
          className="pause-control"
          aria-label="Pause match"
          onClick={() => runtime.current?.pause()}
        >
          <Pause size={18} />
        </button>
        <div className="performance">
          {fps} FPS · {mode === "practice" ? "LOCAL 60 HZ" : "RELAY 60 HZ"}
        </div>
        {notice && locked && <div className="notice">{notice.text}</div>}
      </div>
    </main>
  );
}
function Head({ title, back }: { title: string; back(): void }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <button onClick={back}>
        <X size={18} />
        BACK
      </button>
    </div>
  );
}
function Controls() {
  return (
    <div className="controls-note">
      WASD move · Mouse aim · Left click fire · Right click ADS
      <br />
      Shift sprint · Ctrl/C crouch · Space jump/mantle · R reload
      <br />
      1/2 weapon · Q tactical · G charge · F melee · 4 support
      <br />
      Tab scoreboard · Esc pause / release mouse
    </div>
  );
}
function Scoreboard({
  snapshot,
  localId,
}: {
  snapshot: Snapshot;
  localId: string;
}) {
  return (
    <div className="scoreboard">
      <h2>
        TEAM CLASH<span>{clock(snapshot.remaining)}</span>
      </h2>
      {(["atlas", "cobalt"] as Team[]).map((team) => (
        <section key={team}>
          <h3>
            {TEAM_NAMES[team]}
            <b>{snapshot.score[team === "atlas" ? 0 : 1]}</b>
          </h3>
          <div className="score-columns">
            OPERATOR<span>K</span>
            <span>D</span>
            <span>ASSISTS</span>
          </div>
          {snapshot.players
            .filter((p) => p.team === team)
            .sort((a, b) => b.kills - a.kills)
            .map((p) => (
              <div
                className={`score-row ${p.id === localId ? "self" : ""}`}
                key={p.id}
              >
                <div>
                  {p.name} <small>{p.bot ? "BOT" : "YOU"}</small>
                </div>
                <span>{p.kills}</span>
                <span>{p.deaths}</span>
                <span>{p.assists}</span>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
