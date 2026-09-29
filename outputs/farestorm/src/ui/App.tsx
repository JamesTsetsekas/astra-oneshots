import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRuntime } from "../game/runtime";
import { TAXIS, TRIALS } from "../game/content";
import {
  clearRecords,
  getPersistenceNotice,
  loadProfile,
  loadSettings,
  recordResult,
  saveSettings,
} from "../game/persistence";
import {
  DEFAULT_SETTINGS,
  type GameMode,
  type GameResult,
  type GameSnapshot,
  type Profile,
  type Replay,
  type SessionOptions,
  type Settings,
  type TaxiId,
} from "../game/types";
import {
  ArrowLeft,
  ArrowRight,
  ArrowClockwise,
  CarProfile,
  CheckCircle,
  DownloadSimple,
  FlagCheckered,
  GearSix,
  GraduationCap,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  Timer,
  Trophy,
  WarningCircle,
  Wind,
  X,
} from "./icons";
import { Hud, clockTime, money } from "./Hud";
import {
  Controls,
  Credits,
  Garage,
  ModeSelect,
  Panel,
  Records,
  SettingsPanel,
} from "./MenuPanels";
import { MiniMap } from "./MiniMap";

type Page =
  | "home"
  | "garage"
  | "trials"
  | "school"
  | "settings"
  | "records"
  | "credits"
  | "replay";
const emptyProfile: Profile = {
  version: 1,
  records: [],
  discovered: [],
  lessons: [],
  medals: {},
  totalDeliveries: 0,
  bestScore: 0,
};
const keyart = new URL("../assets/farestorm-keyart.png", import.meta.url).href;

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [taxi, setTaxi] = useState<TaxiId>("breaker");
  const [color, setColor] = useState("#19aaa4");
  const [options, setOptions] = useState<SessionOptions | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gameSettings, setGameSettings] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("");
  const [replay, setReplay] = useState<Replay>();
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const settingsRef = useRef(settings);
  const pauseStateRef = useRef(false);
  pauseStateRef.current = paused || mapOpen || gameSettings;
  const savedResult = useRef("");

  useEffect(() => {
    let active = true;
    const offlineUnavailable = () => setNotice("Offline caching is unavailable. Keep your connection active to reload the game.");
    window.addEventListener("farestorm:offline-unavailable", offlineUnavailable);
    Promise.all([loadSettings(), loadProfile()])
      .then(([savedSettings, savedProfile]) => {
        if (!active) return;
        setSettings(savedSettings);
        setProfile(savedProfile);
        const storageNotice = getPersistenceNotice();
        if (storageNotice) setNotice(storageNotice);
      })
      .catch(() => {
        if (active)
          setNotice(
            "Saved data could not be read. You can still play this session.",
          );
      });
    return () => {
      active = false;
      window.removeEventListener("farestorm:offline-unavailable", offlineUnavailable);
    };
  }, []);

  const changeSettings = useCallback((next: Settings) => {
    setSettings(next);
    settingsRef.current = next;
    runtime.current?.setSettings(next);
    saveSettings(next).catch(() =>
      setNotice(
        "Your settings could not be saved. They still apply to this session.",
      ),
    );
  }, []);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const start = useCallback(
    (mode: GameMode, index = 0) => {
      savedResult.current = "";
      setSnapshot(null);
      setReady(false);
      setPaused(false);
      setMapOpen(false);
      setGameSettings(false);
      setError("");
      setSaveState("");
      setReplay(undefined);
      setOptions({
        mode,
        taxi,
        color,
        seed:
          mode === "trial"
            ? TRIALS[index].seed
            : Math.floor(Math.random() * 2147483647),
        trial: mode === "trial" ? index : 0,
        lesson: mode === "school" ? index : 0,
        traffic: settings.traffic,
        assists: settings.steeringAssist,
      });
    },
    [taxi, color, settings.traffic, settings.steeringAssist],
  );

  useEffect(() => {
    if (!options || !host.current) return;
    let alive = true;
    let game: GameRuntime | undefined;
    const container = host.current;
    import("../game/runtime")
      .then(async ({ GameRuntime: Runtime }) => {
        if (!alive) return;
        game = new Runtime(container, options, settingsRef.current, {
          onSnapshot: (next) => {
            if (alive) setSnapshot(next);
          },
          onReady: () => {
            if (alive) {
              game?.setPaused(pauseStateRef.current);
              setReady(true);
            }
          },
          onError: (message) => {
            if (alive) {
              setError(message);
              setReady(false);
            }
          },
        });
        runtime.current = game;
        await game.initialize();
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : "The city could not start. Please try again.",
          );
      });
    return () => {
      alive = false;
      game?.dispose();
      if (runtime.current === game) runtime.current = null;
    };
  }, [options]);

  useEffect(() => {
    runtime.current?.setPaused(paused || mapOpen || gameSettings);
  }, [paused, mapOpen, gameSettings]);

  useEffect(() => {
    const result = snapshot?.result;
    if (!result || result.id === savedResult.current) return;
    savedResult.current = result.id;
    const currentReplay = runtime.current?.getReplay();
    setReplay(currentReplay);
    setSaveState("Saving your run...");
    recordResult(result, currentReplay)
      .then((p) => {
        setProfile(p);
        setSaveState("Run saved on this device");
      })
      .catch(() =>
        setSaveState("Run finished, but local storage was unavailable"),
      );
  }, [snapshot?.result]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea"))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (options && !snapshot?.result) {
          if (gameSettings) setGameSettings(false);
          else if (mapOpen) setMapOpen(false);
          else setPaused((v) => !v);
        } else if (!options) setPage("home");
      } else if (
        options &&
        !snapshot?.result &&
        event.key.toLowerCase() === "m"
      ) {
        event.preventDefault();
        setMapOpen((v) => !v);
      } else if (options && !paused && event.key.toLowerCase() === "c")
        runtime.current?.cycleCamera();
      else if (snapshot?.result && event.key === "Enter" && options) {
        start(
          options.mode,
          options.mode === "trial" ? options.trial : options.lesson,
        );
      }
    };
    const onHidden = () => {
      if (document.hidden && options && !snapshot?.result) setPaused(true);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [options, snapshot?.result, gameSettings, mapOpen, paused, start]);

  const home = () => {
    setOptions(null);
    setSnapshot(null);
    setReady(false);
    setPaused(false);
    setMapOpen(false);
    setGameSettings(false);
    setError("");
    setPage("home");
  };
  const retry = () =>
    options &&
    start(
      options.mode,
      options.mode === "trial" ? options.trial : options.lesson,
    );
  const clear = async () => {
    await clearRecords();
    setProfile(await loadProfile());
  };
  return (
    <main className={`app ${settings.reducedMotion ? "reduce-motion" : ""}`}>
      {options ? (
        <>
          <div ref={host} className="game-host" />
          {ready && snapshot && !snapshot.result && (
            <Hud
              snapshot={snapshot}
              options={options}
              settings={settings}
              onPause={() => setPaused(true)}
              onMap={() => setMapOpen(true)}
            />
          )}
          {!ready && !error && (
            <div className="loading-screen">
              <div className="mini-brand">FARESTORM</div>
              <div className="loading-road">
                <i />
                <i />
                <i />
                <CarProfile size={58} weight="fill" />
              </div>
              <h1>Galeport, here we come.</h1>
              <p>
                Starting your {options.mode === "school" ? "lesson" : "shift"}
                ...
              </p>
              <div className="loading-tip">
                <kbd>SPACE</kbd> + steer at speed to slide through a corner.
              </div>
            </div>
          )}
          {error && (
            <div className="modal-shade">
              <section className="error-dialog">
                <WarningCircle size={48} />
                <h1>A bump in the road.</h1>
                <p>{error}</p>
                <div>
                  <button className="primary-button" onClick={retry}>
                    Try again <ArrowClockwise />
                  </button>
                  <button className="secondary-button" onClick={home}>
                    Main menu
                  </button>
                </div>
              </section>
            </div>
          )}
          {paused && !snapshot?.result && !gameSettings && !mapOpen && (
            <div className="modal-shade">
              <section className="pause-panel">
                <div className="pause-menu">
                  <span className="section-label">Take a breather</span>
                  <h1>Parked.</h1>
                  <button
                    className="primary-button"
                    onClick={() => setPaused(false)}
                  >
                    Back to the streets <Play weight="fill" />
                  </button>
                  <button onClick={retry}>
                    <ArrowClockwise /> Restart shift
                  </button>
                  <button onClick={() => setGameSettings(true)}>
                    <GearSix /> Settings
                  </button>
                  <button
                    onClick={() => {
                      setPaused(false);
                      runtime.current?.finish();
                    }}
                  >
                    <FlagCheckered /> Finish & see results
                  </button>
                  <button onClick={home}>
                    <ArrowLeft /> Main menu
                  </button>
                </div>
                <Controls />
              </section>
            </div>
          )}
          {gameSettings && !snapshot?.result && (
            <div className="modal-shade settings-shade">
              <SettingsPanel
                settings={settings}
                onChange={changeSettings}
                onBack={() => setGameSettings(false)}
              />
            </div>
          )}
          {mapOpen && snapshot && !snapshot.result && (
            <div className="modal-shade">
              <section className="map-panel">
                <header>
                  <div>
                    <span className="section-label">Know your city</span>
                    <h1>Galeport.</h1>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setMapOpen(false)}
                    aria-label="Close map"
                  >
                    <X />
                  </button>
                </header>
                <MiniMap snapshot={snapshot} full />
                <footer>
                  <span>
                    <i className="legend-player" /> Your cab
                  </span>
                  <span>
                    <i className="legend-fare" /> Passenger
                  </span>
                  <span>
                    <i className="legend-route" /> Suggested route
                  </span>
                  <kbd>M</kbd> Resume
                </footer>
              </section>
            </div>
          )}
          {snapshot?.result && (
            <Results
              result={snapshot.result}
              replay={replay}
              saveState={saveState}
              onRetry={retry}
              onHome={home}
              onReplay={() => {
                setOptions(null);
                setPage("replay");
              }}
              onNext={
                snapshot.result.mode === "school" &&
                (snapshot.result.lesson ?? 0) < 9
                  ? () => start("school", (snapshot.result!.lesson ?? 0) + 1)
                  : undefined
              }
            />
          )}
        </>
      ) : (
        <>
          <img className="menu-art" src={keyart} alt="" />
          <div className={`menu-tint ${page !== "home" ? "inner-page" : ""}`} />
          {page === "home" ? (
            <section className="home-screen">
              <div className="home-content">
                <div className="brand-lockup">
                  <span className="brand-kicker">
                    <Wind size={23} weight="bold" /> GALEPORT IS CALLING
                  </span>
                  <h1>
                    FARESTORM<span aria-hidden="true">FARESTORM</span>
                  </h1>
                  <p>Big fares. Sharp turns. Make every second count.</p>
                </div>
                <nav className="main-menu" aria-label="Game modes">
                  <button
                    className="mode-button featured"
                    onClick={() => start("arcade")}
                  >
                    <span className="mode-icon">
                      <FlagCheckered weight="fill" />
                    </span>
                    <span>
                      <strong>ARCADE SHIFT</strong>
                      <small>60 seconds. Keep the fares coming.</small>
                    </span>
                    <ArrowRight size={29} weight="bold" />
                  </button>
                  <button
                    className="mode-button"
                    onClick={() => start("quick")}
                  >
                    <span className="mode-icon">
                      <Timer weight="fill" />
                    </span>
                    <span>
                      <strong>QUICK SHIFT</strong>
                      <small>Five minutes. The whole city is yours.</small>
                    </span>
                    <ArrowRight />
                  </button>
                  <button
                    className="mode-button"
                    onClick={() => setPage("trials")}
                  >
                    <span className="mode-icon">
                      <Trophy weight="fill" />
                    </span>
                    <span>
                      <strong>TIME TRIAL</strong>
                      <small>Six routes. One perfect run.</small>
                    </span>
                    <ArrowRight />
                  </button>
                  <button
                    className="mode-button"
                    onClick={() => setPage("school")}
                  >
                    <span className="mode-icon">
                      <GraduationCap weight="fill" />
                    </span>
                    <span>
                      <strong>SKILL SCHOOL</strong>
                      <small>Learn to drive a little wilder.</small>
                    </span>
                    <ArrowRight />
                  </button>
                </nav>
                <nav className="utility-menu" aria-label="Game options">
                  <button onClick={() => setPage("garage")}>
                    <CarProfile /> Garage
                  </button>
                  <button onClick={() => setPage("records")}>
                    <Trophy /> Records
                  </button>
                  <button onClick={() => setPage("settings")}>
                    <GearSix /> Settings
                  </button>
                </nav>
              </div>
              <div className="home-best">
                <span>PERSONAL BEST</span>
                <strong>
                  {profile.bestScore
                    ? money(profile.bestScore)
                    : "YOUR ROAD AWAITS"}
                </strong>
              </div>
              <button className="ride-picker" onClick={() => setPage("garage")}>
                <span className="ride-swatch" style={{ background: color }} />
                <span>
                  YOUR RIDE
                  <strong>{TAXIS.find((t) => t.id === taxi)?.name}</strong>
                </span>
                <ArrowRight />
              </button>
              <footer className="menu-footer">
                <span>
                  <kbd>W A S D</kbd> DRIVE <kbd>SPACE</kbd> DRIFT{" "}
                  <kbd>SHIFT</kbd> BOOST
                </span>
                <div>
                  <button onClick={() => setPage("credits")}>Credits</button>
                  <button
                    aria-label={settings.sound ? "Mute sound" : "Enable sound"}
                    onClick={() =>
                      changeSettings({ ...settings, sound: !settings.sound })
                    }
                  >
                    {settings.sound ? (
                      <SpeakerHigh size={21} />
                    ) : (
                      <SpeakerSlash size={21} />
                    )}
                  </button>
                </div>
              </footer>
            </section>
          ) : (
            <>
              <div className="inner-brand">
                <button onClick={() => setPage("home")}>FARESTORM</button>
              </div>
              {page === "garage" && (
                <Garage
                  taxi={taxi}
                  color={color}
                  settings={settings}
                  onTaxi={setTaxi}
                  onColor={setColor}
                  onBack={() => setPage("home")}
                />
              )}
              {(page === "trials" || page === "school") && (
                <ModeSelect
                  kind={page === "trials" ? "trial" : "school"}
                  profile={profile}
                  onBack={() => setPage("home")}
                  onSelect={(i) =>
                    start(page === "trials" ? "trial" : "school", i)
                  }
                />
              )}
              {page === "settings" && (
                <SettingsPanel
                  settings={settings}
                  onChange={changeSettings}
                  onBack={() => setPage("home")}
                />
              )}
              {page === "records" && (
                <Records
                  profile={profile}
                  onBack={() => setPage("home")}
                  onClear={() =>
                    void clear().catch(() =>
                      setNotice("Records could not be cleared."),
                    )
                  }
                  onReplay={() => setPage("replay")}
                />
              )}
              {page === "credits" && <Credits onBack={() => setPage("home")} />}
              {page === "replay" && (
                <ReplayViewer
                  replay={replay ?? profile.ghost}
                  onBack={() => setPage("records")}
                />
              )}
            </>
          )}
        </>
      )}
      {notice && (
        <div className="storage-notice" role="status">
          <WarningCircle />
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      )}
    </main>
  );
}

function downloadReplay(replay: Replay) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(replay)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `farestorm-${replay.result?.id ?? "replay"}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Results({
  result: r,
  replay,
  saveState,
  onRetry,
  onHome,
  onReplay,
  onNext,
}: {
  result: GameResult;
  replay?: Replay;
  saveState: string;
  onRetry(): void;
  onHome(): void;
  onReplay(): void;
  onNext?: () => void;
}) {
  const headline =
    r.mode === "school"
      ? r.rank === "D"
        ? "ONE MORE TRY."
        : "LESSON LEARNED!"
      : r.rank === "S"
        ? "STORM LEGEND!"
        : r.rank === "A"
          ? "WHAT A RIDE!"
          : r.rank === "B"
            ? "MAKING WAVES."
            : r.rank === "C"
              ? "GOOD HUSTLE."
              : "THE FIRST OF MANY.";
  return (
    <div className="results-screen">
      <div className="results-streaks" />
      <div className="results-shell">
        <header>
          <span className="section-label">
            {r.mode === "school" ? "Skill school" : "Shift complete"}
          </span>
          <h1>{headline}</h1>
        </header>
        <div className="results-main">
          <div className={`rank-sticker rank-${r.rank}`}>
            <span>DRIVER RANK</span>
            <strong>{r.rank}</strong>
            {r.medal && (
              <em>
                <Trophy weight="fill" /> {r.medal}
              </em>
            )}
          </div>
          <div className="results-score">
            <span>TOTAL EARNED</span>
            <strong>{money(r.score)}</strong>
            <div className="fare-breakdown">
              <span>
                Fares <b>{money(r.fares)}</b>
              </span>
              <span>
                Style & tips <b>{money(r.tips)}</b>
              </span>
            </div>
            <div className="results-stats">
              {[
                ["Fares delivered", r.deliveries],
                ["Best chain", r.bestChain],
                ["Collisions", r.collisions],
                ["Shortcuts", r.shortcuts.length],
                [
                  "Route efficiency",
                  `${Math.round(r.efficiency * 100)}%`,
                ],
                ["Time on the road", clockTime(r.duration)],
              ].map(([label, value]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="results-actions">
          {onNext && r.rank !== "D" && (
            <button className="primary-button" onClick={onNext}>
              Next lesson <ArrowRight />
            </button>
          )}
          <button
            className={
              onNext && r.rank !== "D" ? "secondary-button" : "primary-button"
            }
            onClick={onRetry}
          >
            Go again <ArrowClockwise />
          </button>
          <button className="secondary-button" onClick={onHome}>
            Main menu
          </button>
          {replay && (
            <button className="quiet-button" onClick={onReplay}>
              Watch route <Play weight="fill" />
            </button>
          )}
        </div>
        <footer>
          <span>
            <CheckCircle /> {saveState}
          </span>
          <span>
            {r.assist ? "Assisted" : "Standard"} ·{" "}
            {TAXIS.find((t) => t.id === r.taxi)?.name}
          </span>
        </footer>
      </div>
    </div>
  );
}

function ReplayViewer({ replay, onBack }: { replay?: Replay; onBack(): void }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const duration = replay?.samples.at(-1)?.t ?? 0;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(),
      handle = 0;
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = Math.min(duration, t + dt);
        if (next >= duration) setPlaying(false);
        return next;
      });
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [playing, duration]);
  if (!replay)
    return (
      <Panel title="No route saved yet." onBack={onBack}>
        <p>Finish a shift to record your drive through Galeport.</p>
      </Panel>
    );
  const sample =
    replay.samples.find((s) => s.t >= time) ?? replay.samples.at(-1);
  return (
    <Panel
      title="Take another look."
      subtitle="Your recorded route through Galeport. Drag the timeline to explore."
      onBack={onBack}
      className="replay-panel"
    >
      <div className="replay-layout">
        <MiniMap full replay={replay} sample={sample} />
        <div>
          <span className="section-label">Saved route</span>
          <h2>{TAXIS.find((t) => t.id === replay.options.taxi)?.name}</h2>
          <strong className="replay-score">
            {money(replay.result?.score ?? 0)}
          </strong>
          <p>
            {replay.result?.deliveries ?? 0} deliveries · {clockTime(duration)}{" "}
            on the road
          </p>
          <div className="replay-transport">
            <button
              className="primary-button"
              onClick={() => {
                if (time >= duration) setTime(0);
                setPlaying((v) => !v);
              }}
            >
              {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
              {playing ? "Pause" : "Play route"}
            </button>
            <span>
              {clockTime(time)} / {clockTime(duration)}
            </span>
            <input
              type="range"
              aria-label="Replay timeline"
              min={0}
              max={duration}
              step={0.1}
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
            />
          </div>
          <button
            className="secondary-button"
            onClick={() => downloadReplay(replay)}
          >
            Download replay <DownloadSimple />
          </button>
        </div>
      </div>
    </Panel>
  );
}
