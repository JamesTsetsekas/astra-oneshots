import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowLeft,
  Play,
  MapTrifold,
  Briefcase,
  Sliders,
  House,
  Motorcycle,
  Shield,
  Phone,
  FloppyDisk,
  X,
  SpeakerHigh,
  Compass,
  Package,
  Check,
  WarningCircle,
} from "@phosphor-icons/react";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "./style.css";
import { Runtime } from "./game/runtime";
import { MISSIONS, VEHICLES, WEAPONS, CONTACTS } from "./game/content";
import { BUILDINGS, ROAD_X, ROAD_Z, INTERIORS } from "./game/world";
import {
  loadSave,
  saveGame,
  loadSettings,
  saveSettings,
  encodeSave,
  decodeSave,
} from "./game/storage";
import type { Snapshot, Settings, SaveGame, WeaponId } from "./game/types";
type Panel =
  | "title"
  | "none"
  | "pause"
  | "phone"
  | "map"
  | "controls"
  | "settings"
  | "shop";
const cash = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const length = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function DistrictMap({ s, full = false }: { s?: Snapshot; full?: boolean }) {
  const p = s?.player ?? { x: -184, z: -300, heading: 0 };
  const size = full ? 940 : 220;
  const view = full
    ? "-470 -470 940 940"
    : `${p.x - size / 2} ${-p.z - size / 2} ${size} ${size}`;
  return (
    <svg
      className={full ? "map-large" : "minimap"}
      viewBox={view}
      aria-label="South Quay map"
    >
      <rect x="-470" y="-470" width="940" height="940" fill="#243b3e" />
      <rect x="-450" y="-450" width="900" height="900" rx="8" fill="#3b4a46" />
      {BUILDINGS.map((b) => (
        <rect
          key={b.id}
          x={b.x - b.width / 2}
          y={-b.z - b.depth / 2}
          width={b.width}
          height={b.depth}
          fill="#54615a"
        />
      ))}
      {ROAD_X.map((x) => (
        <rect
          key={"x" + x}
          x={x - 12}
          y="-415"
          width="24"
          height="830"
          fill="#939786"
        />
      ))}
      {ROAD_Z.map((z) => (
        <rect
          key={"z" + z}
          x="-410"
          y={-z - 12}
          width="820"
          height="24"
          fill="#939786"
        />
      ))}
      {INTERIORS.map((b) => (
        <rect
          key={b.id}
          x={b.x - b.w / 2}
          y={-b.z - b.d / 2}
          width={b.w}
          height={b.d}
          fill="#bd9a67"
        />
      ))}
      {s?.route.length ? (
        <polyline
          points={s.route.map((t) => `${t.x},${-t.z}`).join(" ")}
          fill="none"
          stroke="#f2bf74"
          strokeWidth={full ? 3 : 2.4}
          strokeLinejoin="round"
        />
      ) : null}
      {CONTACTS.map((c) => (
        <g key={c.id}>
          <circle cx={c.x} cy={-c.z} r={full ? 5 : 3} fill="#ded1ad" />
          {full && (
            <text x={c.x + 9} y={-c.z + 4} fontSize="9" fill="#f2e5c9">
              {c.name}
            </text>
          )}
        </g>
      ))}
      {s?.alert.tier ? (
        <circle
          cx={s.alert.lastKnown.x}
          cy={-s.alert.lastKnown.z}
          r={55}
          fill="#c3684c22"
          stroke="#d17d5a"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
      ) : null}
      {s?.enemies
        .filter((e) => e.hp > 0)
        .map((e) => (
          <circle
            key={e.id}
            cx={e.x}
            cy={-e.z}
            r={full ? 4 : 2.5}
            fill={e.role === "police" ? "#89b7ce" : "#e88e73"}
          />
        ))}
      {s?.target && (
        <g>
          <circle
            cx={s.target.x}
            cy={-s.target.z}
            r={full ? 9 : 6}
            fill="none"
            stroke="#f4c47f"
            strokeWidth="2"
          />
          <circle cx={s.target.x} cy={-s.target.z} r="2" fill="#f4c47f" />
        </g>
      )}
      <g
        transform={`translate(${p.x} ${-p.z}) rotate(${(p.heading * 180) / Math.PI})`}
      >
        <path
          d="M0 -7 L5 5 L0 3 L-5 5 Z"
          fill="#fff2d4"
          stroke="#253939"
          strokeWidth="1"
        />
      </g>
      {full && (
        <>
          <text x="-390" y="440" fontSize="16" fill="#84acac" letterSpacing="8">
            PORT MERIDIAN / SOUTH QUAY
          </text>
          <path
            d="M420 -430v30m-8-20 8-10 8 10"
            stroke="#dfd2b3"
            fill="none"
            strokeWidth="2"
          />
          <text x="415" y="-439" fontSize="12" fill="#dfd2b3">
            N
          </text>
        </>
      )}
    </svg>
  );
}
function App() {
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<Runtime | null>(null),
    saving = useRef(false),
    lastStage = useRef("");
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [panel, setPanel] = useState<Panel>("title"),
    [s, setS] = useState<Snapshot>(),
    [settings, setSettings] = useState<Settings>(loadSettings),
    [save, setSave] = useState<SaveGame>(),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmNew, setConfirmNew] = useState(false);
  const panelRef = useRef<Panel>("title");
  panelRef.current = panel;
  const message = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 4500);
  };
  const open = (next: string) => {
    const r = runtime.current;
    if (!r || r.menu) return;
    if (next === "save") {
      void persist();
      return;
    }
    const value = next as Panel;
    setPanel(panelRef.current === value ? "none" : value);
    r.setPaused(panelRef.current !== value);
  };
  const persist = async () => {
    const r = runtime.current;
    if (!r || saving.current) return;
    saving.current = true;
    try {
      const snapshot = r.session.save();
      snapshot.settings = settings;
      await saveGame(snapshot);
      setSave(snapshot);
      message("Checkpoint saved on this device.");
    } catch (e) {
      message("Could not save: " + String(e));
    } finally {
      saving.current = false;
    }
  };
  useEffect(() => {
    let cancelled = false;
    void loadSave()
      .then((s) => {
        if (!cancelled) setSave(s);
      })
      .catch(() =>
        message(
          "Local storage unavailable. You can still play and export a save.",
        ),
      );
    Runtime.create(
      canvas.current!,
      settings,
      (snapshot) => {
        if (!cancelled) setS(snapshot);
      },
      open,
    )
      .then((r) => {
        if (cancelled) r.dispose();
        else {
          runtime.current = r;
          setReady(true);
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      runtime.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!s || runtime.current?.menu) return;
    const state = `${s.completed.join(",")}:${s.mission?.id}:${s.mission?.stage}`;
    if (lastStage.current && lastStage.current !== state) void persist();
    lastStage.current = state;
  }, [s?.mission?.id, s?.mission?.stage, s?.completed.length]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        runtime.current &&
        !runtime.current.menu &&
        !runtime.current.paused &&
        !runtime.current.session.player.dead
      )
        void persist();
    }, 45000);
    return () => clearInterval(timer);
  }, [settings]);
  const start = async (continued = false) => {
    if (!runtime.current) return;
    if (!continued && save && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    setBusy(true);
    try {
      await runtime.current.start(continued ? save : undefined);
      setPanel("none");
      setConfirmNew(false);
      message(
        continued
          ? "Welcome back, Rowan."
          : "First shift. Your Needle motorcycle is parked beside the courier office.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const resume = () => {
    setPanel("none");
    runtime.current?.setPaused(false);
  };
  const setOption = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    runtime.current?.configure(next);
  };
  const exportSave = () => {
    const data = runtime.current?.menu ? save : runtime.current?.session.save();
    if (!data) {
      message("Start a shift before exporting.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(encodeSave(data), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "meridian-run-checkpoint.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const importSave = async (file?: File) => {
    if (!file) return;
    try {
      const decoded = decodeSave(JSON.parse(await file.text()));
      await saveGame(decoded);
      setSave(decoded);
      if (runtime.current) {
        runtime.current.menu = true;
        runtime.current.setPaused(true);
      }
      setPanel("title");
      message("Save imported. Choose Continue to load it.");
    } catch (e) {
      message("Import rejected: " + String(e));
    }
  };
  const active = s?.mission,
    definition = s?.missionDefinition,
    stage = definition?.stages[active?.stage ?? 0],
    p = s?.player;
  const notification = s?.events
    .filter(
      (e) =>
        ["info", "mission", "crime", "reward", "pickup"].includes(e.kind) &&
        s.time - e.time < 5,
    )
    .slice(-1)[0];
  return (
    <main className={`game ${panel === "title" ? "on-title" : ""}`}>
      <canvas ref={canvas} tabIndex={0} aria-label="Meridian Run 3D game" />
      {panel === "title" && (
        <div className="title-screen">
          <header className="masthead">
            <span className="seal">
              MR<span>PORT MERIDIAN</span>
            </span>
            <span className="edition">
              A SOUTH QUAY STORY
              <br />
              <b>SINGLE-PLAYER / LOCAL SAVE</b>
            </span>
          </header>
          <section className="title-copy">
            <div className="eyebrow">
              <span /> THE CITY HAS A MEMORY.
            </div>
            <h1>
              MERIDIAN
              <br />
              <span>RUN.</span>
            </h1>
            <p>
              One courier. A stolen contract.
              <br />
              Nine hundred metres of possibility.
            </p>
            <div className="title-actions">
              {save && (
                <button
                  className="primary"
                  disabled={!ready || busy}
                  onClick={() => start(true)}
                >
                  CONTINUE YOUR STORY <ArrowUpRight size={26} />
                  <small>
                    {save.completed.length}/4 cases closed ·{" "}
                    {cash(save.player.cash)}
                  </small>
                </button>
              )}
              <button
                className={save ? "secondary" : "primary"}
                disabled={!ready || busy}
                onClick={() => start()}
              >
                {busy
                  ? "OPENING SOUTH QUAY…"
                  : !ready
                    ? "BUILDING THE DISTRICT…"
                    : confirmNew
                      ? "START FRESH — REPLACE CHECKPOINT"
                      : "START A NEW SHIFT"}
                <ArrowUpRight size={26} />
              </button>
              {confirmNew && (
                <button className="quiet" onClick={() => setConfirmNew(false)}>
                  Keep my current story
                </button>
              )}
            </div>
          </section>
          <aside className="title-caption">
            <span>27° / LATE AFTERNOON</span>
            <b>SOUTH QUAY</b>
            <p>
              “A good route is one
              <br />
              you can come home from.”
            </p>
            <small>— INEZ SALVO</small>
          </aside>
          <footer className="title-footer">
            <button onClick={() => setPanel("controls")}>
              <Compass />
              How to play
            </button>
            <button onClick={() => setPanel("settings")}>
              <Sliders />
              Options & saves
            </button>
            <span>
              ORIGINAL WORLD • NO ACCOUNT REQUIRED{" "}
              <span className="status-dot" />
            </span>
          </footer>
        </div>
      )}
      {error && (
        <div className="error">
          <WarningCircle />
          <h2>Could not open South Quay</h2>
          <p>{error}</p>
          <p>Use a desktop browser with WebGL enabled, then reload.</p>
          <button onClick={() => location.reload()}>Reload game</button>
        </div>
      )}
      {panel === "none" && s && p && (
        <div className="hud">
          <header className="hud-top">
            <div className="location">
              <span>PORT MERIDIAN</span>
              <strong>{s.district.toUpperCase()}</strong>
              <small>
                {p.inside
                  ? INTERIORS.find((i) => i.id === p.inside)?.name
                  : "SOUTH QUAY / " + (s.vehicle ? "ON THE ROAD" : "ON FOOT")}
              </small>
            </div>
            <div className="wanted">
              <span
                className={s.alert.tier ? "alert-label active" : "alert-label"}
              >
                {s.alert.state.toUpperCase()}
              </span>
              <div className="segments">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={s.alert.tier >= n ? "lit" : ""} />
                ))}
              </div>
              <small>
                {s.alert.tier
                  ? `${Math.round(s.alert.unseen)}s unseen · break line of sight`
                  : "CIVIC SAFETY NETWORK"}
              </small>
            </div>
            <div className="wallet">
              <strong>{cash(p.cash)}</strong>
              <span>NEIGHBORHOOD TRUST {p.trust}/5</span>
              <button onClick={() => open("pause")}>
                ESC <span>PAUSE</span>
              </button>
            </div>
          </header>
          <section className="objective">
            <div className="objective-index">
              {definition
                ? "CASE " +
                  String(MISSIONS.indexOf(definition) + 1).padStart(2, "0")
                : "OFF DUTY"}
            </div>
            <div>
              <h2>{definition?.name ?? "THE DISTRICT IS YOURS"}</h2>
              <p>
                {stage?.text ??
                  "Explore South Quay, or open your phone to pick up a job."}
              </p>
              {active && (
                <div className="objective-progress">
                  {definition?.stages.map((_, i) => (
                    <i
                      key={i}
                      className={
                        i < active.stage
                          ? "done"
                          : i === active.stage
                            ? "current"
                            : ""
                      }
                    />
                  ))}
                  <span>
                    {active.stage + 1}/{definition?.stages.length}
                  </span>
                </div>
              )}
              {stage?.duration && active && (
                <div className="upload">
                  <div
                    style={{
                      width: `${Math.min(100, (active.progress / stage.duration) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </section>
          {p.aiming && (
            <div className="crosshair">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {p.reload > 0 && (
            <div className="reload">RELOADING {p.reload.toFixed(1)}</div>
          )}
          <div className="hud-bottom">
            <section className="navigation">
              <div className="map-frame">
                <DistrictMap s={s} />
                <span className="north">N</span>
              </div>
              <div className="map-caption">
                <button onClick={() => open("map")}>
                  M <MapTrifold /> MAP
                </button>
                <span>
                  {s.target
                    ? Math.round(
                        Math.hypot(s.target.x - p.x, s.target.z - p.z),
                      ) + " m TO OBJECTIVE"
                    : "FREE ROAM"}
                </span>
              </div>
            </section>
            <section className="context">
              <div className="interaction">
                {s.interaction?.label ??
                  (s.vehicle
                    ? "F — Exit when stopped"
                    : "Q — Holster / ready equipment")}
              </div>
              <div className="quick-help">
                {s.vehicle ? (
                  <>
                    <kbd>W S</kbd> throttle / brake <kbd>A D</kbd> steer{" "}
                    <kbd>SPACE</kbd> handbrake
                  </>
                ) : (
                  <>
                    <kbd>WASD</kbd> move <kbd>SHIFT</kbd> sprint <kbd>E</kbd>{" "}
                    interact <kbd>RMB + DRAG</kbd> aim
                  </>
                )}
              </div>
              {notification && settings.subtitles && (
                <p className="notification" key={notification.id}>
                  {notification.text}
                </p>
              )}
            </section>
            <section className="status">
              {s.vehicle ? (
                <>
                  <div className="speed">
                    {String(Math.round(s.vehicle.speedKmh)).padStart(3, "0")}
                    <span>KM/H</span>
                  </div>
                  <span>
                    {
                      VEHICLES.find(
                        (d) =>
                          d.id ===
                          s.vehicles.find((v) => v.id === p.vehicleId)
                            ?.definition,
                      )?.name
                    }
                  </span>
                  <div className="meter">
                    <i
                      style={{
                        width: `${s.vehicles.find((v) => v.id === p.vehicleId)?.condition ?? 100}%`,
                      }}
                    />
                  </div>
                  <small>VEHICLE CONDITION</small>
                </>
              ) : (
                <>
                  <div className="ammo">
                    {p.holstered ? "—" : p.ammo}
                    <span>/ {p.reserve}</span>
                  </div>
                  <span>
                    {p.holstered
                      ? "EQUIPMENT HOLSTERED"
                      : WEAPONS[p.weapon].name}
                  </span>
                </>
              )}
              <div className="vitals">
                <span>HP {Math.ceil(p.health)}</span>
                <div>
                  <i style={{ width: `${p.health}%` }} />
                </div>
                <span>
                  <Shield size={13} />
                  {Math.ceil(p.armor)}
                </span>
              </div>
              <div className="stamina">
                <i style={{ width: `${(p.stamina / 8) * 100}%` }} />
              </div>
              <button className="phone-button" onClick={() => open("phone")}>
                <Phone /> TAB · CONTACTS & JOBS
              </button>
            </section>
          </div>
          <div className="fps">{s.fps} FPS</div>
          {(s.result || p.dead || active?.fail) && (
            <div className="modal-dimmer">
              <section className="result">
                <span className="eyebrow">
                  {s.result ? "DELIVERY CONFIRMED" : "SHIFT INTERRUPTED"}
                </span>
                <h2>{s.result?.name ?? "A ROUTE TOO FAR."}</h2>
                {s.result ? (
                  <>
                    <div className="grade">
                      {s.result.grade}
                      <span>MISSION GRADE</span>
                    </div>
                    <div className="result-stats">
                      <div>
                        <b>{cash(s.result.reward)}</b>
                        <span>
                          {s.result.replay
                            ? "REPLAY / NO EXTRA PAYOUT"
                            : "EARNED"}
                        </span>
                      </div>
                      <div>
                        <b>{length(s.result.duration)}</b>
                        <span>ELAPSED</span>
                      </div>
                      <div>
                        <b>+{s.result.trust}</b>
                        <span>TRUST</span>
                      </div>
                    </div>
                    <p>
                      {s.completed.length === 4
                        ? "The ledger is public. South Quay has its story back. Keep exploring or replay a case from your phone."
                        : "The district remembers a job done well. Your next case is waiting in your phone."}
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        runtime.current?.session.dismissResult();
                        void persist();
                      }}
                    >
                      BACK TO SOUTH QUAY <ArrowUpRight />
                    </button>
                    <button
                      onClick={() => {
                        runtime.current?.session.dismissResult();
                        open("phone");
                      }}
                    >
                      Open contacts & jobs
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      {active?.fail ??
                        "You were incapacitated. Return to the office and try again."}
                    </p>
                    <button
                      className="primary"
                      onClick={() => runtime.current?.session.retry()}
                    >
                      RESTART MISSION <ArrowUpRight />
                    </button>
                    <button
                      onClick={() => {
                        runtime.current?.session.retry();
                        runtime.current?.session.abandon();
                      }}
                    >
                      Return to free roam
                    </button>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      )}
      {panel !== "title" && panel !== "none" && (
        <div className="panel-dimmer">
          <section className={`panel ${panel === "map" ? "wide" : ""}`}>
            <header>
              <div>
                <span className="eyebrow">VEY COURIER / SOUTH QUAY</span>
                <h2>
                  {
                    {
                      pause: "TAKE A BREATHER.",
                      phone: "PEOPLE. PLACES. JOBS.",
                      map: "KNOW YOUR DISTRICT.",
                      controls: "LEARN THE ROUTE.",
                      settings: "MAKE IT YOURS.",
                      shop: "NIGHT SHIFT SUPPLIES.",
                    }[panel]
                  }
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close panel"
                onClick={() =>
                  runtime.current?.menu ? setPanel("title") : resume()
                }
              >
                <X size={24} />
              </button>
            </header>
            {panel === "pause" && (
              <div className="pause-layout">
                <div>
                  <p className="lead">The city can wait.</p>
                  <p>
                    Your simulation is paused. Mission time, traffic, and police
                    response stop while this screen is open.
                  </p>
                  <div className="menu-list">
                    <button className="primary" onClick={resume}>
                      RESUME SHIFT <Play weight="fill" />
                    </button>
                    <button onClick={() => setPanel("phone")}>
                      <Briefcase /> Contacts & jobs <ArrowUpRight />
                    </button>
                    <button onClick={() => setPanel("map")}>
                      <MapTrifold /> District map <ArrowUpRight />
                    </button>
                    <button onClick={() => setPanel("controls")}>
                      <Compass /> Controls <ArrowUpRight />
                    </button>
                    <button onClick={() => setPanel("settings")}>
                      <Sliders /> Options & saves <ArrowUpRight />
                    </button>
                    <button onClick={() => void persist()}>
                      <FloppyDisk /> Save checkpoint
                    </button>
                    <button
                      onClick={() => {
                        void persist();
                        runtime.current!.menu = true;
                        setPanel("title");
                      }}
                    >
                      <House /> Save & return to title
                    </button>
                  </div>
                </div>
                <div className="pause-map">
                  <DistrictMap s={s} full />
                  <p>
                    {s?.completed.length ?? 0} / 4 CASES CLOSED{" "}
                    <span>{length(s?.time ?? 0)} ON SHIFT</span>
                  </p>
                </div>
              </div>
            )}
            {panel === "phone" && (
              <>
                <div className="phone-intro">
                  <p className="lead">
                    A city is the people
                    <br />
                    who pick up the phone.
                  </p>
                  <p>
                    Story cases unlock in sequence. Side jobs are always
                    available. Replaying a closed case never duplicates its cash
                    reward.
                  </p>
                </div>
                <div className="job-list">
                  {MISSIONS.map((m, i) => {
                    const complete = s?.completed.includes(m.id),
                      locked =
                        m.kind === "story" &&
                        i > 0 &&
                        !s?.completed.includes(MISSIONS[i - 1].id);
                    return (
                      <article key={m.id} className={locked ? "locked" : ""}>
                        <div className="job-num">
                          {m.kind === "story" ? (
                            String(i + 1).padStart(2, "0")
                          ) : (
                            <Package />
                          )}
                        </div>
                        <div>
                          <span className="eyebrow">
                            {m.contact} /{" "}
                            {m.kind === "story"
                              ? "STORY CASE"
                              : "REPEATABLE JOB"}
                          </span>
                          <h3>
                            {m.name}
                            {complete && <Check />}
                          </h3>
                          <p>{m.description}</p>
                        </div>
                        <div className="job-pay">
                          {cash(m.reward)}
                          <button
                            disabled={locked || runtime.current?.menu}
                            onClick={() => {
                              runtime.current?.session.startMission(
                                m.id,
                                complete,
                              );
                              resume();
                            }}
                          >
                            {locked
                              ? "LOCKED"
                              : complete
                                ? "REPLAY CASE"
                                : active?.id === m.id
                                  ? "RESTART"
                                  : "ACCEPT JOB"}{" "}
                            <ArrowUpRight />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {active && (
                  <button
                    className="quiet"
                    onClick={() => {
                      runtime.current?.session.abandon();
                      resume();
                    }}
                  >
                    Abandon current job and free roam
                  </button>
                )}
              </>
            )}
            {panel === "map" && (
              <>
                <div className="full-map">
                  <DistrictMap s={s} full />
                </div>
                <div className="map-legend">
                  <span>
                    <i /> You & your route
                  </span>
                  <span>
                    <i /> Enterable locations
                  </span>
                  <span>
                    <i /> Last known position / search area
                  </span>
                  <span>900 × 900 m · NO FAST TRAVEL</span>
                </div>
              </>
            )}
            {panel === "controls" && (
              <>
                <p className="lead">
                  Walk the lanes. Ride the coast. Keep your head.
                </p>
                <div className="controls-grid">
                  {[
                    [
                      "ON FOOT",
                      [
                        ["W A S D / ARROWS", "Move relative to camera"],
                        ["SHIFT", "Sprint (uses stamina)"],
                        ["SPACE", "Jump / step over low ledges"],
                        ["CTRL or C", "Crouch"],
                        ["E", "Interact / enter stopped vehicle"],
                        ["F", "Exit vehicle at low speed"],
                      ],
                    ],
                    [
                      "EQUIPMENT",
                      [
                        ["Q", "Holster / ready equipped weapon"],
                        ["RIGHT MOUSE + DRAG", "Aim and rotate camera"],
                        ["LEFT MOUSE", "Fire equipped weapon"],
                        ["R / V", "Reload / melee strike"],
                        ["G / H", "Smoke screen / medical kit"],
                        ["TAB / M / ESC", "Jobs / map / pause"],
                      ],
                    ],
                    [
                      "BEHIND THE WHEEL",
                      [
                        ["W / S", "Accelerate / brake, then reverse"],
                        ["A / D", "Steer"],
                        ["SPACE", "Handbrake"],
                        ["MOUSE DRAG", "Look around (camera recentres)"],
                        ["E at garage", "Repair a nearby vehicle ($90)"],
                        [
                          "GAMEPAD",
                          "Left stick moves, right stick looks; A interacts",
                        ],
                      ],
                    ],
                  ].map(([title, rows]) => (
                    <section key={title as string}>
                      <h3>{title as string}</h3>
                      {(rows as string[][]).map(([key, value]) => (
                        <div className="control" key={key}>
                          <kbd>{key}</kbd>
                          <span>{value}</span>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
                <div className="note">
                  <Shield />
                  <p>
                    Crimes need witnesses, cameras, or a nearby officer. Break
                    line of sight, use cover or smoke, and let the search cool.
                    Civilians are never targets or a source of rewards. The
                    default stun projector is nonlethal.
                  </p>
                </div>
              </>
            )}
            {panel === "settings" && (
              <div className="settings">
                <section>
                  <h3>DISPLAY & HANDLING</h3>
                  <label>
                    Quality{" "}
                    <select
                      value={settings.quality}
                      onChange={(e) =>
                        setOption(
                          "quality",
                          e.target.value as Settings["quality"],
                        )
                      }
                    >
                      <option>low</option>
                      <option>medium</option>
                      <option>high</option>
                    </select>
                  </label>
                  <small>
                    Quality applies fully after reloading. Lower quality reduces
                    render resolution and shadows.
                  </small>
                  <label>
                    Camera sensitivity{" "}
                    <input
                      type="range"
                      min=".3"
                      max="2"
                      step=".1"
                      value={settings.sensitivity}
                      onChange={(e) =>
                        setOption("sensitivity", +e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Driving camera{" "}
                    <select
                      value={settings.camera}
                      onChange={(e) =>
                        setOption("camera", +e.target.value as 0 | 1 | 2)
                      }
                    >
                      <option value="0">Chase</option>
                      <option value="1">Wide chase</option>
                      <option value="2">Close chase</option>
                    </select>
                  </label>
                  {(["steeringAssist", "subtitles", "sound"] as const).map(
                    (k) => (
                      <label key={k}>
                        {k === "steeringAssist"
                          ? "Steering assistance"
                          : k === "subtitles"
                            ? "Dialogue captions"
                            : "Sound enabled"}
                        <input
                          type="checkbox"
                          checked={settings[k]}
                          onChange={(e) => setOption(k, e.target.checked)}
                        />
                      </label>
                    ),
                  )}
                  <label>
                    Traffic density{" "}
                    <input
                      type="range"
                      min=".3"
                      max="1.2"
                      step=".1"
                      value={settings.traffic}
                      onChange={(e) => setOption("traffic", +e.target.value)}
                    />
                  </label>
                  <small>
                    Traffic density applies when starting or continuing a shift.
                  </small>
                </section>
                <section>
                  <h3>AUDIO & YOUR SAVE</h3>
                  <label>
                    Original score{" "}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={settings.music}
                      onChange={(e) => setOption("music", +e.target.value)}
                    />
                  </label>
                  <label>
                    Sound effects{" "}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={settings.effects}
                      onChange={(e) => setOption("effects", +e.target.value)}
                    />
                  </label>
                  <p>
                    Checkpoints are saved on this device at mission transitions
                    and every 45 seconds. Continue returns Rowan safely to the
                    courier office, preserving mission stage, money, and
                    completed cases.
                  </p>
                  <p>
                    A verified backup is retained. Export a copy before clearing
                    browser data.
                  </p>
                  <button className="secondary" onClick={exportSave}>
                    <FloppyDisk /> Export checkpoint
                  </button>
                  <label className="import-button">
                    Import checkpoint
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => void importSave(e.target.files?.[0])}
                    />
                  </label>
                  <div className="note">
                    LOCAL SINGLE-PLAYER. No accounts, analytics, external fonts,
                    or online-only services.
                  </div>
                </section>
              </div>
            )}
            {panel === "shop" && (
              <>
                <p className="lead">Good equipment. No questions.</p>
                <p>
                  Visit Night Shift Supplies on Lantern Street to purchase gear.
                  Weapons replace your current equipment. Reload after
                  equipping.
                </p>
                <div className="shop-grid">
                  {[
                    ...Object.entries(WEAPONS).map(([id, w]) => ({
                      id,
                      name: w.name,
                      price: w.price,
                    })),
                    { id: "ammo", name: "AMMUNITION · 72 ROUNDS", price: 60 },
                    { id: "medkit", name: "MEDICAL KIT", price: 45 },
                    { id: "armor", name: "LIGHT BODY ARMOR", price: 110 },
                  ].map((item) => (
                    <button
                      key={item.id}
                      disabled={
                        !p ||
                        Math.hypot(p.x + 180, p.z + 80) > 16 ||
                        p.cash < item.price
                      }
                      onClick={() => {
                        runtime.current?.session.buy(item.id as WeaponId);
                        setS(runtime.current?.session.snapshot());
                      }}
                    >
                      <span>{item.name}</span>
                      <b>{cash(item.price)}</b>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check /> {toast}
        </div>
      )}
      <div className="vignette" />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
