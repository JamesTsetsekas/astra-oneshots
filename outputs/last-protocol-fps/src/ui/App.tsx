import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  ArrowsClockwise,
  Crosshair,
  ShoppingCart,
  Shield,
  DiamondsFour,
  Skull,
  Check,
  X,
} from "@phosphor-icons/react";
import {
  cover,
  weapons,
  utilities,
  sites,
  price,
  TEAM_NAMES,
  locationAt,
  type Purchase,
  type Utility,
  type WeaponId,
} from "../game/data";
import { ProtocolRuntime, type Settings, type Options } from "../game/runtime";
import type { Snapshot } from "../game/simulation";
import artwork from "../assets/annex-keyart.png";
type Screen =
  | "menu"
  | "setup"
  | "settings"
  | "learn"
  | "history"
  | "playing"
  | "results";
type RecordItem = {
  id: string;
  score: [number, number];
  won: boolean;
  date: string;
  rounds: number;
  kills: number;
  deaths: number;
  plants: number;
  defuses: number;
  mode: string;
};
const defaults: Settings = {
  sensitivity: 1.5,
  fov: 90,
  sound: true,
  reducedMotion: false,
  reducedFlash: true,
  crosshair: "#c8f2df",
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Session is still playable. */
  }
};
const clock = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${String(Math.floor(Math.max(0, n) % 60)).padStart(2, "0")}`;
const dollars = (n: number) => "$" + n.toLocaleString("en-US");
export function App() {
  const [screen, setScreen] = useState<Screen>("menu"),
    [settings, setSettings] = useState<Settings>(() => ({
      ...defaults,
      ...read("protocol.settings", defaults),
    })),
    [options, setOptions] = useState<Options>({
      mode: "quick",
      difficulty: "normal",
      name: "Operator",
    }),
    [history, setHistory] = useState<RecordItem[]>(() => {
      const h = read<unknown>("protocol.history", []);
      return Array.isArray(h) ? h.slice(0, 30) : [];
    }),
    [snapshot, setSnapshot] = useState<Snapshot>(),
    [locked, setLocked] = useState(false),
    [buy, setBuy] = useState(false),
    [mapOpen, setMapOpen] = useState(false),
    [board, setBoard] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [fps, setFps] = useState(0),
    [spectating, setSpectating] = useState<string>(),
    [run, setRun] = useState(0);
  const host = useRef<HTMLDivElement>(null),
    map = useRef<HTMLCanvasElement>(null),
    runtime = useRef<ProtocolRuntime | undefined>(undefined),
    awarded = useRef(false);
  useEffect(() => save("protocol.settings", settings), [settings]);
  useEffect(() => save("protocol.history", history), [history]);
  const menu = () => {
    document.exitPointerLock();
    setScreen("menu");
  };
  const start = () => {
    setScreen("playing");
    setRun((v) => v + 1);
    setSnapshot(undefined);
    setLocked(false);
    setBuy(false);
    setError("");
    setBoard(false);
    awarded.current = false;
  };
  useEffect(() => {
    if (screen !== "playing" || !host.current) return;
    try {
      runtime.current = new ProtocolRuntime(host.current, options, settings, {
        state: (s, rate, spec) => {
          setSnapshot(s);
          setFps(rate);
          setSpectating(spec);
          if (s.winner && !awarded.current) {
            awarded.current = true;
            const me = s.players.find((p) => p.id === "local")!;
            const record: RecordItem = {
              id: s.matchId,
              score: s.score,
              won: s.winner === me.team,
              date: new Date().toISOString(),
              rounds: s.round,
              kills: me.kills,
              deaths: me.deaths,
              plants: me.plants,
              defuses: me.defuses,
              mode: s.rules.name,
            };
            setHistory((h) =>
              [record, ...h.filter((r) => r.id !== record.id)].slice(0, 30),
            );
            document.exitPointerLock();
            setScreen("results");
          }
        },
        lock: setLocked,
        buy: setBuy,
        map: setMapOpen,
        score: setBoard,
        error: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "WebGL initialization failed");
    }
    return () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    };
  }, [screen, run]);
  const hero = snapshot?.players.find((p) => p.id === "local"),
    gun = hero
      ? weapons[
          hero.slot === 0 && hero.primary ? hero.primary : hero.loadout.sidearm
        ]
      : undefined,
    attack = hero?.team === snapshot?.attacker;
  useEffect(() => {
    if (!map.current || !snapshot || !hero) return;
    const c = map.current,
      cx = c.getContext("2d");
    if (!cx) return;
    c.width = 220;
    c.height = 180;
    const point = (x: number, z: number) => [
      ((x + 57.5) / 115) * 220,
      ((47.5 - z) / 95) * 180,
    ];
    cx.fillStyle = "#182831";
    cx.fillRect(0, 0, 220, 180);
    cx.strokeStyle = "#34484e";
    for (let x = 0; x < 220; x += 22) {
      cx.beginPath();
      cx.moveTo(x, 0);
      cx.lineTo(x, 180);
      cx.stroke();
    }
    cx.fillStyle = "#77817b";
    for (const a of cover) {
      const [x, z] = point(a.x, a.z);
      cx.fillRect(
        x - (a.w / 115) * 110,
        z - (a.d / 95) * 90,
        (a.w / 115) * 220,
        (a.d / 95) * 180,
      );
    }
    for (const s of sites) {
      const [x, z] = point(s.x, s.z);
      cx.strokeStyle = "#d28eb5";
      cx.lineWidth = 2;
      cx.beginPath();
      cx.arc(x, z, 10, 0, Math.PI * 2);
      cx.stroke();
      cx.fillStyle = "#efddea";
      cx.font = "bold 12px Arial";
      cx.fillText(s.id, x - 4, z + 4);
    }
    for (const p of snapshot.players) {
      if (!p.alive || p.team !== hero.team) continue;
      const [x, z] = point(p.x, p.z);
      cx.fillStyle = p.id === "local" ? "#f0dfa7" : "#90d8d3";
      cx.beginPath();
      cx.arc(x, z, p.id === "local" ? 4 : 2.8, 0, Math.PI * 2);
      cx.fill();
    }
    if (
      snapshot.objective.state === "armed" ||
      (attack && snapshot.objective.state === "dropped")
    ) {
      const [x, z] = point(snapshot.objective.x, snapshot.objective.z);
      cx.fillStyle = "#e99bcc";
      cx.fillRect(x - 3, z - 3, 6, 6);
    }
  }, [snapshot, hero, mapOpen]);
  const purchase = (item: Purchase) => {
    const result = runtime.current?.purchase(item);
    setNotice(result?.reason ?? "Match unavailable");
    setTimeout(() => setNotice(""), 2000);
  };
  const hit = snapshot?.events.findLast(
    (e) =>
      (e.kind === "hit" || e.kind === "kill") &&
      e.actor === "local" &&
      snapshot.time - e.time < 0.25,
  );
  if (!["playing", "results"].includes(screen))
    return (
      <main
        className="shell"
        style={{
          backgroundImage: `linear-gradient(90deg,#101720f7 0%,#111921e8 30%,#17222d22 73%),url(${artwork})`,
        }}
      >
        <header className="topbar">
          <button className="wordmark" onClick={menu}>
            <DiamondsFour size={29} weight="bold" /> LAST<span>PROTOCOL</span>
          </button>
          <span className="top-location">
            APERTURE ANNEX / SECURE RESEARCH CAMPUS
          </span>
          <span className="local-label">LOCAL DEPLOYMENT</span>
        </header>
        {screen === "menu" && (
          <>
            <section className="hero">
              <p className="eyebrow">CIPHER BREACH / 5 V 5</p>
              <h1>
                ONE LIFE.
                <br />
                <em>EVERY ROUND.</em>
              </h1>
              <p className="lede">
                Buy carefully. Move deliberately.
                <br />
                Breach the vault, or hold the last line.
              </p>
              <button
                className="primary launch"
                onClick={() => setScreen("setup")}
              >
                <Play weight="fill" /> ENTER PROTOCOL <ArrowRight />
              </button>
              <nav className="menu-links">
                <button onClick={() => setScreen("learn")}>FIELD MANUAL</button>
                <button onClick={() => setScreen("history")}>
                  MATCH HISTORY
                </button>
                <button onClick={() => setScreen("settings")}>SETTINGS</button>
              </nav>
              <div className="mission-spec">
                <span>NO RESPAWNS</span>
                <span>TWO VAULTS</span>
                <span>ROUND ECONOMY</span>
              </div>
            </section>
            <aside className="campus-card">
              <small>OPERATION / APERTURE ANNEX</small>
              <strong>
                CONTROL
                <br />
                THE CIPHER.
              </strong>
              <p>Turbine hall · Garden lab · Calibration</p>
              <span>
                <i /> OFFLINE PRACTICE READY
              </span>
            </aside>
          </>
        )}
        {screen === "setup" && (
          <section className="panel">
            <PanelHeader title="Deployment" back={menu} />
            <p className="panel-copy">
              An original tactical match against bots. No public queue, rating
              service, or account is required.
            </p>
            <label>
              CALLSIGN
              <input
                value={options.name}
                maxLength={22}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, name: e.target.value }))
                }
              />
            </label>
            <div className="mode-grid">
              {(
                [
                  [
                    "quick",
                    "Rapid Practice",
                    "First to 5 · swap after 4",
                    "8s buy / 60s action",
                  ],
                  [
                    "standard",
                    "Full Protocol",
                    "First to 9 · swap after 8",
                    "20s buy / 105s action",
                  ],
                ] as const
              ).map(([id, name, line, times]) => (
                <button
                  className={options.mode === id ? "selected" : ""}
                  key={id}
                  onClick={() => setOptions((o) => ({ ...o, mode: id }))}
                >
                  <strong>{name}</strong>
                  <span>{line}</span>
                  <small>{times}</small>
                </button>
              ))}
            </div>
            <label>
              BOT DIFFICULTY
              <select
                value={options.difficulty}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    difficulty: e.target.value as Options["difficulty"],
                  }))
                }
              >
                <option value="easy">Recruit / slower reactions</option>
                <option value="normal">Regular / balanced</option>
                <option value="hard">Veteran / tighter aim</option>
              </select>
            </label>
            <button className="primary" onClick={start}>
              DEPLOY TO ANNEX <ArrowRight />
            </button>
            <p className="fine">
              Both formats require a two-round lead, with a round cap. The same
              weapons, economy, objective, and no-respawn rules apply.
            </p>
          </section>
        )}
        {screen === "settings" && (
          <section className="panel">
            <PanelHeader title="Settings" back={menu} />
            <label>
              MOUSE SENSITIVITY <b>{Number(settings.sensitivity).toFixed(1)}</b>
              <input
                type="range"
                min=".1"
                max="6"
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
            <label>
              HORIZONTAL FOV <b>{settings.fov}°</b>
              <input
                type="range"
                min="80"
                max="105"
                value={settings.fov}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, fov: Number(e.target.value) }))
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, sound: e.target.checked }))
                }
              />{" "}
              AUDIO CUES
            </label>
            <label className="check">
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
              REDUCED WEAPON MOTION
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.reducedFlash}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, reducedFlash: e.target.checked }))
                }
              />{" "}
              DARK FLASH OBSCURATION
            </label>
            <label>
              CROSSHAIR COLOR
              <input
                type="color"
                value={settings.crosshair}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, crosshair: e.target.value }))
                }
              />
            </label>
            <p className="fine">
              Dark flash changes the tint, not the duration or opacity. Gameplay
              smoke boundaries remain identical.
            </p>
          </section>
        )}
        {screen === "learn" && (
          <section className="panel wide">
            <PanelHeader title="Field manual" back={menu} />
            <div className="manual-grid">
              <article>
                <small>01 / INTRUSION</small>
                <h3>Take a vault.</h3>
                <p>
                  Carry the Cipher Spike to A / Turbine or B / Garden. Stop
                  inside the pink floor boundary and hold E for 3.2 seconds.
                  Defend it until upload completes. G drops the Spike for a
                  teammate.
                </p>
              </article>
              <article>
                <small>02 / CUSTODIANS</small>
                <h3>Hold, then retake.</h3>
                <p>
                  Prevent arming or eliminate Intrusion. After arming, the round
                  continues even if all attackers die. Hold E near the Spike for
                  8 seconds to disarm; a $400 kit cuts this to 5.
                </p>
              </article>
              <article>
                <small>03 / ECONOMY</small>
                <h3>Plan the next round.</h3>
                <p>
                  Start with $800. Wins pay $3,000. Consecutive losses raise
                  support from $1,900 to $3,100. Survive to keep your kit. Armor
                  matters; all weapon choices are available from the start.
                </p>
              </article>
              <article>
                <small>04 / PRECISION</small>
                <h3>Stop to shoot.</h3>
                <p>
                  Running and jumping widen your spread. Shift walks quietly;
                  Ctrl crouches. Rifles do not zoom. Only precision weapons
                  scope with right click. Use short bursts and control the
                  climb.
                </p>
              </article>
            </div>
            <Controls />
            <p className="fine">
              Original art, geometry and synthesized effects. React / Three.js /
              Phosphor. This build is local Practice; production matchmaking,
              rewind netcode and ranked services are not included.
            </p>
          </section>
        )}
        {screen === "history" && (
          <section className="panel wide">
            <PanelHeader title="Match history" back={menu} />
            {history.length ? (
              <div className="history-list">
                {history.map((r) => (
                  <article key={r.id}>
                    <strong className={r.won ? "win" : ""}>
                      {r.won ? "VICTORY" : "COMPLETE"}
                    </strong>
                    <b>{r.score.join(" : ")}</b>
                    <span>
                      {r.mode}
                      <small>{new Date(r.date).toLocaleDateString()}</small>
                    </span>
                    <span>
                      {r.kills} K / {r.deaths} D
                    </span>
                    <small>
                      {r.plants} plants · {r.defuses} disarms
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">
                <DiamondsFour size={36} />
                <h3>Your first protocol starts here.</h3>
                <p>Completed matches are saved only in this browser.</p>
                <button className="primary" onClick={() => setScreen("setup")}>
                  START PRACTICE <ArrowRight />
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    );
  if (screen === "results")
    return (
      <main
        className="debrief"
        style={{
          backgroundImage: `linear-gradient(90deg,#121a23f5,#17212cd0),url(${artwork})`,
        }}
      >
        <section className="debrief-content">
          <p className="eyebrow">
            PROTOCOL CLOSED / {snapshot?.rules.name.toUpperCase()}
          </p>
          <h1>
            {snapshot?.winner === hero?.team
              ? "VICTORY"
              : snapshot?.winner === "draw"
                ? "DEADLOCK"
                : "DEFEAT"}
          </h1>
          <div className="final-score">
            <span>
              AURORA<b>{snapshot?.score[0]}</b>
            </span>
            <DiamondsFour size={38} />
            <span>
              OBSIDIAN<b>{snapshot?.score[1]}</b>
            </span>
          </div>
          <div className="debrief-stats">
            <span>
              ELIMINATIONS<b>{hero?.kills}</b>
            </span>
            <span>
              DEATHS / ASSISTS
              <b>
                {hero?.deaths} / {hero?.assists}
              </b>
            </span>
            <span>
              OBJECTIVE ACTIONS
              <b>{(hero?.plants ?? 0) + (hero?.defuses ?? 0)}</b>
            </span>
            <span>
              CREDITS SPENT<b>{dollars(hero?.spent ?? 0)}</b>
            </span>
          </div>
          <h3>ROUND TIMELINE</h3>
          <div className="timeline">
            {snapshot?.history.map((r) => (
              <div
                key={r.round}
                title={`${r.reason} / ${TEAM_NAMES[r.winner]}`}
                className={r.winner === hero?.team ? "won" : "lost"}
              >
                <b>{r.round}</b>
                <small>
                  {r.reason.includes("CIPHER") ? (
                    <DiamondsFour size={13} />
                  ) : (
                    <Crosshair size={13} />
                  )}
                </small>
              </div>
            ))}
          </div>
          <p className="fine">
            {snapshot?.round} rounds · {clock(snapshot?.time ?? 0)} played ·
            Match saved locally. No ranked rating is assigned.
          </p>
          <div className="result-actions">
            <button className="primary" onClick={start}>
              <ArrowsClockwise /> PLAY AGAIN <ArrowRight />
            </button>
            <button className="text-button" onClick={menu}>
              RETURN TO MENU
            </button>
          </div>
        </section>
      </main>
    );
  const phase = snapshot?.phase,
    armed = snapshot?.objective.state === "armed",
    nearSite =
      hero &&
      sites.some((s) => Math.hypot(hero.x - s.x, hero.z - s.z) < s.radius),
    nearObjective =
      hero &&
      snapshot &&
      Math.hypot(hero.x - snapshot.objective.x, hero.z - snapshot.objective.z) <
        3;
  return (
    <main className="match">
      <div className="game-host" ref={host} />
      <div className="hud">
        {hero && snapshot && (
          <>
            <div
              className="damage"
              style={{
                opacity:
                  Math.max(0, 1 - (snapshot.time - hero.lastDamage) / 0.6) *
                  0.8,
              }}
            />
            {hero.flash > 0 && (
              <div
                className={`flash ${settings.reducedFlash ? "dark-flash" : ""}`}
                style={{ opacity: Math.min(0.96, hero.flash / 2) }}
              />
            )}
            <div className="round-top">
              <TeamStrip snapshot={snapshot} team="aurora" />
              <div className={`round-clock ${armed ? "armed" : ""}`}>
                <small>
                  ROUND {snapshot.round} / {snapshot.rules.maximum}
                </small>
                <div>
                  <b>{snapshot.score[0]}</b>
                  <strong>{clock(snapshot.remaining)}</strong>
                  <b>{snapshot.score[1]}</b>
                </div>
                <span>
                  {phase === "buy"
                    ? "BUY PHASE"
                    : armed
                      ? `CIPHER ARMED / ${snapshot.objective.site}`
                      : attack
                        ? "INTRUSION"
                        : "CUSTODIANS"}
                </span>
              </div>
              <TeamStrip snapshot={snapshot} team="obsidian" />
            </div>
            <div className={`minimap ${mapOpen ? "expanded" : ""}`}>
              <canvas ref={map} />
              <span>{locationAt(hero.x, hero.z)}</span>
            </div>
            <div className="killfeed">
              {snapshot.events
                .filter((e) => e.kind === "kill" && snapshot.time - e.time < 4)
                .slice(-4)
                .map((e) => (
                  <p className={e.actor === "local" ? "self" : ""} key={e.id}>
                    {e.text}
                  </p>
                ))}
            </div>
            <div
              className="aim"
              style={{ color: settings.crosshair, opacity: hero.ads ? 0.2 : 1 }}
            >
              <i />
              <i />
              <i />
              <i />
            </div>
            {hit && (
              <div
                className={`hit ${hit.kind === "kill" ? "elimination" : ""}`}
              >
                ×
              </div>
            )}
            <div className="bottom-hud">
              <div className="vitals">
                <small>HEALTH / ARMOR</small>
                <strong>
                  {Math.ceil(hero.hp)}
                  <span>
                    <Shield size={17} />
                    {Math.ceil(hero.armor)}
                  </span>
                </strong>
                <div>
                  <i style={{ width: `${hero.hp}%` }} />
                </div>
                <small>
                  {hero.helmet ? "HELMET" : "NO HELMET"} ·{" "}
                  {hero.kit ? "DISARM KIT" : "NO KIT"}
                </small>
              </div>
              <div className="utility-bar">
                {(Object.keys(utilities) as Utility[]).map((u, i) => (
                  <div key={u} className={hero.utility[u] ? "ready" : ""}>
                    <kbd>{i + 4}</kbd>
                    <span>{utilities[u].name.split(" ")[0]}</span>
                    <b>{hero.utility[u]}</b>
                  </div>
                ))}
              </div>
              <div className="ammunition">
                <small>{gun?.name}</small>
                <strong>
                  {hero.ammo}
                  <span>/ {hero.reserve}</span>
                </strong>
                <small>
                  {hero.reloadTime > 0
                    ? `RELOADING ${hero.reloadTime.toFixed(1)}s`
                    : hero.primary
                      ? "1 PRIMARY · 2 SIDEARM"
                      : "2 SIDEARM"}
                </small>
              </div>
            </div>
            <div className="economy">
              {dollars(hero.money)}
              <span>
                {hero.carry
                  ? "◆ CIPHER CARRIER"
                  : attack
                    ? "INTRUSION"
                    : "CUSTODIANS"}
              </span>
              {phase === "buy" && (
                <button onClick={() => runtime.current?.openBuy()}>
                  <ShoppingCart size={14} /> B / BUY EQUIPMENT
                </button>
              )}
            </div>
            {phase === "buy" && !buy && locked && (
              <div className="phase-callout">
                <small>ROUND {snapshot.round}</small>
                <h2>
                  {snapshot.reason.includes("HALFTIME")
                    ? "SIDES SWITCHED"
                    : "PREPARE YOUR KIT"}
                </h2>
                <p>Press B to buy · Starting gear carries if you survive.</p>
              </div>
            )}
            {phase === "end" && (
              <div className="round-result">
                <DiamondsFour size={28} />
                <small>
                  {snapshot.roundWinner === hero.team
                    ? "ROUND WON"
                    : "ROUND LOST"}
                </small>
                <h2>{snapshot.reason}</h2>
                <p>Next buy phase in {Math.ceil(snapshot.remaining)}</p>
              </div>
            )}
            {hero.alive &&
              phase !== "buy" &&
              phase !== "end" &&
              ((hero.carry && nearSite) ||
                (!attack && armed && nearObjective)) && (
                <div className="interaction">
                  <strong>
                    HOLD E / {hero.carry ? "ARM CIPHER" : "DISARM CIPHER"}
                  </strong>
                  <div>
                    <i
                      style={{ width: `${snapshot.objective.progress * 100}%` }}
                    />
                  </div>
                  <small>
                    {hero.carry
                      ? "3.2 SECONDS"
                      : hero.kit
                        ? "5 SECONDS WITH KIT"
                        : "8 SECONDS"}
                  </small>
                </div>
              )}
            {hero.alive &&
              attack &&
              snapshot.objective.state === "dropped" &&
              nearObjective && (
                <div className="interaction">
                  <strong>E / RECOVER CIPHER</strong>
                </div>
              )}
            {!hero.alive && (
              <div className="spectator">
                <Skull size={17} />
                <span>
                  ELIMINATED BY {hero.killer} / {hero.killedWith}
                </span>
                <strong>SPECTATING {spectating?.toUpperCase()}</strong>
                <small>
                  LEFT CLICK / NEXT TEAMMATE · NO RESPAWN THIS ROUND
                </small>
              </div>
            )}
            {board && <Scoreboard snapshot={snapshot} />}{" "}
            {buy && phase === "buy" && (
              <BuyMenu
                snapshot={snapshot}
                purchase={purchase}
                refund={() => {
                  const r = runtime.current?.refund();
                  setNotice(r?.reason ?? "Unavailable");
                }}
                drop={() => {
                  const r = runtime.current?.dropPrimary();
                  setNotice(r?.reason ?? "Unavailable");
                }}
                close={() => runtime.current?.lock()}
              />
            )}
          </>
        )}
        {!locked && !buy && !error && phase !== "finished" && (
          <div className="pause-card">
            <small>LOCAL PRACTICE PAUSED</small>
            <h2>
              {snapshot && snapshot.time > 1
                ? "BACK TO THE ANNEX."
                : "READY FOR PROTOCOL."}
            </h2>
            <p>
              One life per round. Press B during the buy phase.
              <br />
              Stop before firing. Hold E at a vault to interact.
            </p>
            <button className="primary" onClick={() => runtime.current?.lock()}>
              <Play weight="fill" />
              {snapshot && snapshot.time > 1 ? "RESUME" : "DEPLOY"}
              <ArrowRight />
            </button>
            <button className="text-button" onClick={menu}>
              LEAVE MATCH
            </button>
          </div>
        )}
        {error && (
          <div className="pause-card">
            <h2>INPUT / GRAPHICS NOTICE</h2>
            <p>{error}</p>
            <button
              className="primary"
              onClick={() => {
                setError("");
                runtime.current?.lock();
              }}
            >
              TRY RESUME
            </button>
            <button className="text-button" onClick={menu}>
              RETURN TO MENU
            </button>
          </div>
        )}
        <button
          className="pause-button"
          aria-label="Pause match"
          onClick={() => runtime.current?.pause()}
        >
          <Pause size={18} />
        </button>
        <span className="fps">{fps} FPS · LOCAL 64 HZ</span>
        {notice && <div className="toast">{notice}</div>}
      </div>
    </main>
  );
}
function PanelHeader({ title, back }: { title: string; back(): void }) {
  return (
    <header className="panel-header">
      <h2>{title}</h2>
      <button onClick={back}>
        <X size={18} />
        BACK
      </button>
    </header>
  );
}
function Controls() {
  return (
    <div className="controls">
      WASD move · Shift walk · Ctrl/C crouch · Space jump · Left click fire ·
      Right click scope (precision only)
      <br />R reload · E arm/disarm/pickup · G drop weapon/Spike · 1/2 weapon ·
      Q switch · 4–8 utility
      <br />B buy · Tab scoreboard · M tactical map · Esc pause · Left click
      cycles teammates after death
    </div>
  );
}
function TeamStrip({
  snapshot,
  team,
}: {
  snapshot: Snapshot;
  team: "aurora" | "obsidian";
}) {
  return (
    <div className={`team-strip ${team}`}>
      <span>{TEAM_NAMES[team]}</span>
      <div>
        {snapshot.players
          .filter((p) => p.team === team)
          .map((p) => (
            <i
              key={p.id}
              className={`${p.alive ? "alive" : ""} ${p.id === "local" ? "you" : ""}`}
              title={`${p.name} / ${p.alive ? "alive" : "eliminated"}`}
            >
              {p.alive ? <Shield size={12} /> : <X size={12} />}
            </i>
          ))}
      </div>
    </div>
  );
}
function BuyMenu({
  snapshot,
  purchase,
  refund,
  drop,
  close,
}: {
  snapshot: Snapshot;
  purchase(p: Purchase): void;
  refund(): void;
  drop(): void;
  close(): void;
}) {
  const [category, setCategory] = useState("Rifle");
  const p = snapshot.players.find((p) => p.id === "local")!;
  const items: Purchase[] =
    category === "Utility"
      ? (Object.keys(utilities) as Utility[])
      : category === "Armor"
        ? ["vest", "helmet", "kit"]
        : Object.values(weapons)
            .filter((w) => w.role === category)
            .map((w) => w.id);
  return (
    <div className="buy-overlay">
      <section className="buy-window">
        <header>
          <div>
            <small>REQUISITION / ROUND {snapshot.round}</small>
            <h2>BUILD YOUR PLAN.</h2>
          </div>
          <div className="buy-money">
            <strong>{dollars(p.money)}</strong>
            <span>{clock(snapshot.remaining)} BUY REMAINING</span>
          </div>
          <button aria-label="Close buy menu" onClick={close}>
            <X size={24} />
          </button>
        </header>
        <div className="buy-layout">
          <nav>
            {[
              "Sidearm",
              "SMG",
              "Rifle",
              "Precision",
              "Heavy",
              "Armor",
              "Utility",
            ].map((c) => (
              <button
                key={c}
                className={c === category ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
                <ArrowRight size={14} />
              </button>
            ))}
          </nav>
          <div className="purchase-grid">
            {items.map((id) => {
              const w = id in weapons ? weapons[id as WeaponId] : undefined,
                u = id in utilities ? utilities[id as Utility] : undefined,
                cost = price(id),
                name =
                  w?.name ??
                  u?.name ??
                  (id === "vest"
                    ? "Ballistic vest"
                    : id === "helmet"
                      ? "Vest + helmet"
                      : "Disarm kit"),
                disabled =
                  p.money < cost ||
                  (id === "kit" && p.team === snapshot.attacker);
              return (
                <button
                  key={id}
                  disabled={disabled}
                  onClick={() => purchase(id)}
                >
                  <small>{w?.role ?? category}</small>
                  {w ? (
                    <div
                      className={`weapon-silhouette ${w.role === "Sidearm" ? "pistol" : ""}`}
                    >
                      <i />
                      <b />
                      <em />
                    </div>
                  ) : (
                    <div className="item-icon">
                      {category === "Armor" ? (
                        <Shield size={42} weight="duotone" />
                      ) : (
                        <DiamondsFour size={42} weight="duotone" />
                      )}
                    </div>
                  )}
                  <h3>{name}</h3>
                  <p>
                    {w
                      ? `${w.damage} damage · ${w.mag} rounds · ${w.rpm} RPM`
                      : (u?.description ??
                        (id === "kit"
                          ? "Custodians only / 5 second disarm"
                          : id === "helmet"
                            ? "Full armor plus head protection"
                            : "100 ballistic armor"))}
                  </p>
                  <strong>
                    {dollars(cost)}
                    <span>{disabled ? "UNAVAILABLE" : "PURCHASE +"}</span>
                  </strong>
                </button>
              );
            })}
          </div>
          <aside>
            <small>CURRENT EQUIPMENT</small>
            <h3>{p.primary ? weapons[p.primary].name : "NO PRIMARY"}</h3>
            <p>{weapons[p.loadout.sidearm].name}</p>
            <hr />
            <p>
              Armor <b>{Math.ceil(p.armor)}</b>
            </p>
            <p>
              Helmet <b>{p.helmet ? "YES" : "NO"}</b>
            </p>
            <p>
              Disarm kit <b>{p.kit ? "YES" : "NO"}</b>
            </p>
            <hr />
            {Object.entries(p.utility)
              .filter(([, n]) => n > 0)
              .map(([id, n]) => (
                <p key={id}>
                  {utilities[id as Utility].name}
                  <b>{n}</b>
                </p>
              ))}
            <button className="refund" onClick={refund}>
              REFUND LAST PURCHASE
            </button>
            {p.primary && (
              <button className="refund" onClick={drop}>
                DROP PRIMARY / REPLACE
              </button>
            )}
            <p className="fine">
              Win: +$3,000
              <br />
              Loss support: $1,900–$3,100
              <br />
              Maximum carried: $12,000
            </p>
          </aside>
        </div>
        <footer>
          <span>Survive to keep equipment · Up to four utility items</span>
          <button className="primary" onClick={close}>
            READY / CLOSE <ArrowRight />
          </button>
        </footer>
      </section>
    </div>
  );
}
function Scoreboard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="scoreboard">
      <h2>
        CIPHER BREACH <span>ROUND {snapshot.round}</span>
      </h2>
      {(["aurora", "obsidian"] as const).map((team) => (
        <section key={team}>
          <h3>
            {TEAM_NAMES[team]} /{" "}
            {team === snapshot.attacker ? "INTRUSION" : "CUSTODIANS"}
            <b>{snapshot.score[team === "aurora" ? 0 : 1]}</b>
          </h3>
          <div className="score-labels">
            <span>OPERATOR</span>
            <span>K</span>
            <span>D</span>
            <span>A</span>
            <span>OBJECTIVE</span>
            <span>CREDITS</span>
          </div>
          {snapshot.players
            .filter((p) => p.team === team)
            .map((p) => (
              <div
                className={`score-row ${p.id === "local" ? "self" : ""}`}
                key={p.id}
              >
                <span>
                  {p.name} <small>{p.bot ? "BOT" : "YOU"}</small>
                </span>
                <span>{p.kills}</span>
                <span>{p.deaths}</span>
                <span>{p.assists}</span>
                <span>{p.plants + p.defuses}</span>
                <span>{dollars(p.money)}</span>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
