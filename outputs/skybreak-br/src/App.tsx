import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { Flag } from "@phosphor-icons/react/dist/csr/Flag";
import { Gear } from "@phosphor-icons/react/dist/csr/Gear";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Wind } from "@phosphor-icons/react/dist/csr/Wind";
import { X } from "@phosphor-icons/react/dist/csr/X";
import keyart from "./assets/skybreak-keyart.png";
import { Runtime, type Overlay } from "./game/runtime";
import { loadCareer, loadSettings, saveSettings } from "./game/storage";
import {
  DEFAULT_SETTINGS,
  type Options,
  type Settings,
  type Snapshot,
} from "./game/types";
import {
  ITEMS,
  isWeapon,
  itemName,
  RARITIES,
  SKINS,
  WEAPONS,
} from "./game/content";
import { Hud, EquipmentIcon, clock } from "./ui/Hud";
import { TacticalMap } from "./ui/Map";
type Page = "home" | "wardrobe" | "career" | "settings" | "guide";
const controls = [
  ["W A S D", "Move"],
  ["Mouse", "Look"],
  ["LMB / RMB", "Fire or use / Aim"],
  ["Shift", "Sprint"],
  ["Ctrl", "Crouch / Slide while sprinting"],
  ["Space", "Jump / Leave skiff"],
  ["E", "Loot / Chest / Cable / Wind vent"],
  ["R / F", "Reload / Melee"],
  ["1 – 5", "Select equipment"],
  ["Tab / M", "Inventory / Tactical map"],
  ["Z / X", "Wing-sail / Swap shoulder"],
  ["Esc", "Pause and release pointer"],
];
export default function App() {
  const [page, setPage] = useState<Page>("home"),
    [settings, setSettings] = useState(loadSettings),
    [skin, setSkin] = useState(0),
    [pace, setPace] = useState<Options["pace"]>("quick"),
    [options, setOptions] = useState<Options>(),
    [snapshot, setSnapshot] = useState<Snapshot>(),
    [overlay, setOverlay] = useState<Overlay>("none"),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [career, setCareer] = useState(loadCareer),
    [bind, setBind] = useState<string>(),
    [swap, setSwap] = useState<number>();
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<Runtime | undefined>(undefined),
    startId = useRef(0);
  const start = (mode: Options["mode"]) => {
    setError("");
    setPage("home");
    setSnapshot(undefined);
    setOverlay("none");
    setOptions({
      mode,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      skin,
      pace,
    });
  };
  useEffect(() => {
    if (!options || !canvas.current) return;
    const id = ++startId.current;
    let disposed = false;
    setLoading(true);
    Runtime.create(canvas.current, options, settings, setSnapshot, setOverlay)
      .then((value) => {
        if (disposed || id !== startId.current) {
          value.dispose();
          return;
        }
        runtime.current = value;
        setLoading(false);
        if (import.meta.env.DEV)
          (window as unknown as { __skybreak?: unknown }).__skybreak = {
            snapshot: () => value.session.snapshot(),
            world: () => ({
              actors: value.session.actors.map((a) => ({
                id: a.id,
                x: a.x,
                y: a.y,
                z: a.z,
                hp: a.hp,
                alive: a.alive,
                weapon: a.inventory[a.slot]?.id,
              })),
              loot: value.session.loot.filter((l) => l.active).length,
            }),
          };
      })
      .catch((e) => {
        if (!disposed) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
          setOptions(undefined);
        }
      });
    return () => {
      disposed = true;
      runtime.current?.dispose();
      runtime.current = undefined;
      if (import.meta.env.DEV)
        delete (window as unknown as { __skybreak?: unknown }).__skybreak;
    };
  }, [options]);
  useEffect(() => {
    if (!bind) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.code === "Escape") {
        setBind(undefined);
        return;
      }
      if (
        [
          "Tab",
          "KeyM",
          ...Array.from({ length: 5 }, (_, i) => "Digit" + (i + 1)),
        ].includes(event.code)
      ) {
        setError("That key is reserved for inventory, map or equipment.");
        return;
      }
      const existing = Object.entries(settings.bindings).find(
        ([key, value]) => key !== bind && value === event.code,
      );
      if (existing) {
        setError(`Already bound to ${existing[0]}. Choose another key.`);
        return;
      }
      const next = {
        ...settings,
        bindings: { ...settings.bindings, [bind]: event.code },
      };
      setSettings(next);
      if (!saveSettings(next))
        setError(
          "Browser storage is unavailable; settings apply for this visit only.",
        );
      setBind(undefined);
      setError("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bind, settings]);
  const exit = () => {
    setOptions(undefined);
    setSnapshot(undefined);
    setOverlay("none");
    setCareer(loadCareer());
  };
  const configure = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (!saveSettings(next))
      setError(
        "Browser storage is unavailable; settings apply for this visit only.",
      );
  };
  const result = snapshot?.result;
  if (options)
    return (
      <div
        className={
          "game-screen" + (settings.colorblind ? " high-contrast" : "")
        }
      >
        <canvas
          ref={canvas}
          id="game-canvas"
          aria-label="Skybreak third-person battle royale. Click to capture pointer. Press Escape to release."
          tabIndex={0}
        />
        {loading && (
          <div className="loading-screen">
            <Wind size={52} />
            <span className="eyebrow">CHARTING THE HIGHWAKE</span>
            <h1>Catch your breath.</h1>
            <p>Preparing island, equipment and flight systems…</p>
          </div>
        )}
        {snapshot && !result && (
          <Hud
            snapshot={snapshot}
            mode={options.mode}
            onPause={() => runtime.current?.setOverlay("pause")}
            onMap={() => runtime.current?.setOverlay("map")}
            onInventory={() => runtime.current?.setOverlay("inventory")}
          />
        )}
        {snapshot && overlay !== "none" && !result && (
          <div className="game-overlay">
            <section
              className={
                "overlay-panel " + (overlay === "map" ? "map-panel" : "")
              }
            >
              <button
                className="close"
                aria-label="Resume game"
                onClick={() => runtime.current?.setOverlay("none")}
              >
                <X size={23} />
              </button>
              <span className="eyebrow">
                {overlay === "pause"
                  ? "FLIGHT PAUSED"
                  : overlay === "map"
                    ? "THE HIGHWAKE / FIELD CHART"
                    : "SCAVENGER EQUIPMENT"}
              </span>
              <h1>
                {overlay === "pause"
                  ? "Take a breath."
                  : overlay === "map"
                    ? "Know your next move."
                    : "Travel light. Hit hard."}
              </h1>
              {overlay === "pause" && (
                <>
                  <div className="pause-actions">
                    <button
                      className="primary"
                      onClick={() => runtime.current?.setOverlay("none")}
                    >
                      Resume flight <Play weight="fill" />
                    </button>
                    <button
                      onClick={() => {
                        runtime.current?.session.finish();
                        runtime.current?.setOverlay("none");
                      }}
                    >
                      Finish & view results
                    </button>
                    <button onClick={exit}>Return to lobby</button>
                  </div>
                  <div className="control-grid">
                    {controls.map(([key, text]) => (
                      <div key={key}>
                        <kbd>{key}</kbd>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    Local simulation pauses while this menu, inventory or map is
                    open. Click the world after closing to capture your mouse.
                    If capture is unavailable, hold a mouse button and drag to
                    aim.
                  </p>
                </>
              )}
              {overlay === "map" && (
                <div className="map-layout">
                  <TacticalMap
                    snapshot={snapshot}
                    full
                    onMarker={(p) => runtime.current?.session.setMarker(p)}
                  />
                  <aside>
                    <h3>One island. No second chances.</h3>
                    <p>
                      Click the chart to place a landing marker. Your gold
                      beacon is visible from the skiff and during descent.
                    </p>
                    <dl>
                      <dt>Solid violet circle</dt>
                      <dd>Current Calmfield</dd>
                      <dt>Dashed ivory circle</dt>
                      <dd>Next safe area</dd>
                      <dt>White arrow</dt>
                      <dd>Your position and facing</dd>
                    </dl>
                    <p>
                      Storm phase {snapshot.storm.phase + 1}
                      <br />
                      {clock(snapshot.storm.remaining)} until{" "}
                      {snapshot.storm.moving ? "closure" : "movement"}
                    </p>
                    <button
                      className="primary"
                      onClick={() => runtime.current?.setOverlay("none")}
                    >
                      Back to the sky <ArrowRight />
                    </button>
                  </aside>
                </div>
              )}
              {overlay === "inventory" && (
                <>
                  <p className="muted">
                    Five universal slots. Select one, then select another to
                    swap. Equipment keeps its ammunition.
                  </p>
                  <div className="inventory-grid">
                    {snapshot.player.inventory.map((item, i) => (
                      <article
                        key={i}
                        className={swap === i ? "chosen" : ""}
                        style={
                          {
                            "--rarity": RARITIES[item?.rarity ?? 0].color,
                          } as React.CSSProperties
                        }
                      >
                        <button
                          className="inventory-item"
                          onClick={() => {
                            if (swap === undefined) setSwap(i);
                            else {
                              runtime.current?.session.swapSlots(swap, i);
                              setSwap(undefined);
                              setSnapshot(runtime.current?.session.snapshot());
                            }
                          }}
                        >
                          <span className="eyebrow">SLOT 0{i + 1}</span>
                          <EquipmentIcon item={item} />
                          <h3>{item ? itemName(item.id) : "Empty slot"}</h3>
                          <p>
                            {item
                              ? `${RARITIES[item.rarity].shape} ${RARITIES[item.rarity].name}`
                              : "Ready for anything"}
                          </p>
                          <small>
                            {item
                              ? isWeapon(item.id)
                                ? `${item.loaded} loaded · ${WEAPONS[item.id].description}`
                                : `×${item.quantity} · ${ITEMS[item.id].description}`
                              : "Pick up gear with E."}
                          </small>
                        </button>
                        {item && (
                          <button
                            className="drop-item"
                            onClick={() => {
                              runtime.current?.session.dropSlot(i);
                              setSnapshot(runtime.current?.session.snapshot());
                              setSwap(undefined);
                            }}
                          >
                            Drop item
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className="ammo-stores">
                    {Object.entries(snapshot.player.ammo).map(
                      ([name, count]) => (
                        <span key={name}>
                          {name.toUpperCase()} <b>{count}</b>
                        </span>
                      ),
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
        {result && (
          <div className="game-overlay results">
            <section className="result-panel">
              <span className="eyebrow">
                {result.mode === "practice"
                  ? "TRAINING FLIGHT COMPLETE"
                  : result.victory
                    ? "THE LAST LIGHT IN THE STORM"
                    : "FLIGHT REPORT / LOCAL SOLO"}
              </span>
              <h1>
                {result.mode === "practice"
                  ? "Ready for the real drop."
                  : result.victory
                    ? "THE SKY IS YOURS."
                    : result.place
                      ? `PLACED #${result.place}`
                      : "FLIGHT ENDED"}
              </h1>
              <p>
                {result.mode === "practice"
                  ? "Every flight makes a better scavenger."
                  : `Winner: ${result.winner}`}
              </p>
              <div className="result-stats">
                <div>
                  <b>{result.kills}</b>
                  <span>ELIMINATIONS</span>
                </div>
                <div>
                  <b>{result.damage}</b>
                  <span>DAMAGE DEALT</span>
                </div>
                <div>
                  <b>{result.accuracy}%</b>
                  <span>ACCURACY</span>
                </div>
                <div>
                  <b>{clock(result.survival)}</b>
                  <span>SURVIVAL</span>
                </div>
              </div>
              <div className="result-secondary">
                <span>{result.distance} m travelled</span>
                <span>{result.loot} items recovered</span>
                <span>{result.stormDamage} storm damage</span>
              </div>
              <div className="result-buttons">
                <button className="primary" onClick={() => start(options.mode)}>
                  Drop again <ArrowRight />
                </button>
                <button onClick={exit}>Return to lobby</button>
              </div>
              <small className="muted">
                Saved to local career history when browser storage is available.
                No account required.
              </small>
              <details>
                <summary>Flight timeline</summary>
                {result.timeline.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </details>
            </section>
          </div>
        )}
      </div>
    );
  return (
    <div className="lobby" style={{ backgroundImage: `url(${keyart})` }}>
      <div className="lobby-shade" />
      <header className="main-header">
        <button className="brand" onClick={() => setPage("home")}>
          <Wind weight="bold" size={29} />
          <b>SKYBREAK</b>
        </button>
        <nav>
          {(["home", "wardrobe", "career", "guide"] as Page[]).map((value) => (
            <button
              key={value}
              className={page === value ? "selected" : ""}
              onClick={() => setPage(value)}
            >
              {value === "home"
                ? "PLAY"
                : value === "wardrobe"
                  ? "APPEARANCE"
                  : value.toUpperCase()}
            </button>
          ))}
        </nav>
        <button
          className="settings-link"
          aria-label="Settings"
          onClick={() => setPage("settings")}
        >
          <Gear size={24} />
          <span>SETTINGS</span>
        </button>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {page === "home" ? (
        <>
          <main className="hero">
            <div className="edition">
              <span /> ORIGINAL NO-BUILD BATTLE ROYALE
            </div>
            <h1>
              OWN
              <br />
              THE OPEN
              <br />
              <em>SKY.</em>
            </h1>
            <p>
              Drop into the Highwake. Gear up among the ruins.
              <br />
              Outrun the Riftstorm. Be the last light standing.
            </p>
            <div className="flight-config">
              <span>
                <UsersIcon /> SOLO · 23 LOCAL BOTS
              </span>
              <select
                aria-label="Match pace"
                value={pace}
                onChange={(e) => setPace(e.target.value as Options["pace"])}
              >
                <option value="quick">Quick flight · ~6 min</option>
                <option value="standard">Full flight · ~13 min</option>
              </select>
            </div>
            <button
              className="primary play-button"
              onClick={() => start("solo")}
            >
              TAKE THE DROP <ArrowRight size={28} />
            </button>
            <button
              className="practice-button"
              onClick={() => start("practice")}
            >
              <CrosshairIcon /> Visit the practice range{" "}
              <ArrowRight size={19} />
            </button>
            <div className="hero-facts">
              <span>24 SCAVENGERS</span>
              <i />
              <span>6 LANDMARKS</span>
              <i />
              <span>1 SURVIVOR</span>
            </div>
          </main>
          <div className="island-label">
            <span className="eyebrow">DESTINATION / 001</span>
            <h2>THE HIGHWAKE</h2>
            <span>A little paradise. A lot to lose.</span>
          </div>
          <footer className="lobby-footer">
            <span>LOCAL EDITION / 1.0</span>
            <span>DESKTOP · KEYBOARD & MOUSE · ORIGINAL WORLD</span>
            <span>
              <i /> ALL SYSTEMS READY
            </span>
          </footer>
        </>
      ) : (
        <main className="lobby-page">
          <button className="back-link" onClick={() => setPage("home")}>
            <ArrowLeft /> BACK TO FLIGHT DECK
          </button>
          <span className="eyebrow">SKYBREAK / {page.toUpperCase()}</span>
          <h1>
            {page === "wardrobe"
              ? "Make your mark."
              : page === "career"
                ? "Every flight counts."
                : page === "settings"
                  ? "Your flight. Your way."
                  : "A field guide to survival."}
          </h1>
          {page === "wardrobe" && (
            <>
              <p className="muted">
                Four original scavenger palettes. Cosmetic only; every scavenger
                fights on equal terms.
              </p>
              <div className="skin-grid">
                {SKINS.map((s, i) => (
                  <button
                    key={s.name}
                    className={i === skin ? "active" : ""}
                    onClick={() => setSkin(i)}
                  >
                    <div
                      className="skin-portrait"
                      style={
                        {
                          "--coat": s.coat,
                          "--accent": s.accent,
                          "--pants": s.pants,
                        } as React.CSSProperties
                      }
                    >
                      <div className="skin-head" />
                      <div className="skin-body" />
                      <div className="skin-scarf" />
                      <div className="skin-legs" />
                    </div>
                    <span className="eyebrow">SCAVENGER / 0{i + 1}</span>
                    <h3>{s.name}</h3>
                    <p>{i === skin ? "EQUIPPED" : "SELECT LOOK"}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "career" && (
            <>
              {career.length ? (
                <>
                  <div className="career-totals">
                    <div>
                      <b>{career.filter((r) => r.mode === "solo").length}</b>
                      <span>SOLO FLIGHTS</span>
                    </div>
                    <div>
                      <b>{career.filter((r) => r.victory).length}</b>
                      <span>VICTORIES</span>
                    </div>
                    <div>
                      <b>{career.reduce((n, r) => n + r.kills, 0)}</b>
                      <span>ELIMINATIONS</span>
                    </div>
                  </div>
                  <div className="career-table">
                    <div className="table-head">
                      <span>FLIGHT</span>
                      <span>PLACEMENT</span>
                      <span>ELIMS</span>
                      <span>DAMAGE</span>
                      <span>TIME</span>
                    </div>
                    {[...career]
                      .reverse()
                      .slice(0, 12)
                      .map((r) => (
                        <div key={r.id}>
                          <span>
                            {r.mode === "practice"
                              ? "Practice range"
                              : "Local solo"}
                            <small>
                              {new Date(r.date).toLocaleDateString()}
                            </small>
                          </span>
                          <b>
                            {r.mode === "practice"
                              ? "—"
                              : r.victory
                                ? "VICTORY"
                                : r.place
                                  ? "#" + r.place
                                  : "DNF"}
                          </b>
                          <span>{r.kills}</span>
                          <span>{r.damage}</span>
                          <span>{clock(r.survival)}</span>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Flag size={46} />
                  <h2>A blank chart. An open sky.</h2>
                  <p>
                    Your flight reports will appear here after a match or
                    practice session.
                  </p>
                  <button className="primary" onClick={() => start("solo")}>
                    Make your first drop <ArrowRight />
                  </button>
                </div>
              )}
            </>
          )}
          {page === "guide" && (
            <>
              <div className="guide-grid">
                <article>
                  <span>01 / DESCEND</span>
                  <h3>Choose your ground.</h3>
                  <p>
                    Board with E. Mark the map with M, then press Space to jump.
                    Steer with WASD and mouse. Your wing-sail opens
                    automatically near the ground, or deploy early with Z.
                  </p>
                </article>
                <article>
                  <span>02 / SCAVENGE</span>
                  <h3>A good start is earned.</h3>
                  <p>
                    Solo starts unarmed. Look for rotating gear outside
                    buildings and resonance chests inside. E picks up items.
                    Five slots hold weapons or consumables; Tab lets you swap or
                    drop them.
                  </p>
                </article>
                <article>
                  <span>03 / SURVIVE</span>
                  <h3>The Calmfield is shrinking.</h3>
                  <p>
                    The violet boundary is dangerous. Rotate toward the dashed
                    ivory circle on your map. Aegis recharges after 8 seconds;
                    use flasks for Reserve Shield and injectors for Health.
                  </p>
                </article>
                <article>
                  <span>04 / COMMIT</span>
                  <h3>Make the last shot yours.</h3>
                  <p>
                    Aim with RMB, fire with LMB, reload with R. Slide by
                    crouching while sprinting. Use cover and manage range.
                    Eliminated scavengers drop their gear; the last living
                    scavenger wins.
                  </p>
                </article>
              </div>
              <div className="control-grid">
                {controls.map(([key, text]) => (
                  <div key={key}>
                    <kbd>{key}</kbd>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              <p className="muted">
                This edition runs entirely on your device. All 23 opponents are
                local bots, not online players. Practice has five stationary
                targets, every weapon, no storm, and no bot return fire.
              </p>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="settings-grid">
                <section>
                  <h3>Display & feel</h3>
                  <label>
                    Rendering quality
                    <select
                      value={settings.quality}
                      onChange={(e) =>
                        configure({
                          quality: e.target.value as Settings["quality"],
                        })
                      }
                    >
                      <option value="low">Performance</option>
                      <option value="medium">Balanced</option>
                      <option value="high">Quality</option>
                    </select>
                  </label>
                  <label>
                    Field of view <b>{settings.fov}°</b>
                    <input
                      type="range"
                      min="70"
                      max="110"
                      value={settings.fov}
                      onChange={(e) =>
                        configure({ fov: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Mouse sensitivity <b>{settings.sensitivity.toFixed(1)}</b>
                    <input
                      type="range"
                      min="0.3"
                      max="3"
                      step="0.1"
                      value={settings.sensitivity}
                      onChange={(e) =>
                        configure({ sensitivity: Number(e.target.value) })
                      }
                    />
                  </label>
                  {(
                    [
                      "sound",
                      "music",
                      "reducedMotion",
                      "colorblind",
                      "shadows",
                      "invertY",
                    ] as const
                  ).map((key) => (
                    <label key={key} className="toggle-label">
                      {
                        {
                          sound: "Game sound",
                          music: "Ambient tone",
                          reducedMotion: "Reduced decorative motion",
                          colorblind: "High-contrast status labels",
                          shadows: "Contact shadows",
                          invertY: "Invert vertical look",
                        }[key]
                      }
                      <input
                        type="checkbox"
                        checked={settings[key]}
                        onChange={(e) => configure({ [key]: e.target.checked })}
                      />
                    </label>
                  ))}
                </section>
                <section>
                  <h3>Keyboard bindings</h3>
                  <p className="muted">
                    Select a binding, then press a key. Escape cancels. Map,
                    inventory and slots keep their dedicated keys.
                  </p>
                  <div className="binding-grid">
                    {Object.entries(settings.bindings).map(([action, key]) => (
                      <button
                        key={action}
                        onClick={() => setBind(action)}
                        className={bind === action ? "listening" : ""}
                      >
                        <span>{action}</span>
                        <kbd>
                          {bind === action
                            ? "PRESS A KEY"
                            : key.replace("Key", "").replace("Left", "")}
                        </kbd>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      configure({
                        ...DEFAULT_SETTINGS,
                        bindings: { ...DEFAULT_SETTINGS.bindings },
                      })
                    }
                  >
                    Restore defaults
                  </button>
                </section>
              </div>
              <p className="muted">
                Settings are saved locally and apply to your next flight. No
                personal data is sent anywhere.
              </p>
            </>
          )}
        </main>
      )}
    </div>
  );
}
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="6" r="3" fill="currentColor" />
      <path d="M4 17v-3a6 6 0 0 1 12 0v3" fill="currentColor" />
    </svg>
  );
}
function CrosshairIcon() {
  return <Compass size={20} />;
}
