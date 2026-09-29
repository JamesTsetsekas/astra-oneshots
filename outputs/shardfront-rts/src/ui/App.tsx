import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildOrder, buildings, factionCopy, factionNames, units } from "../game/data";
import { formatTime } from "../game/simulation";
import { GameRuntime, type RuntimeSettings } from "../game/runtime";
import { readRecord, writeRecord, type SavedMatch, type SavedReplay } from '../game/storage';
import { FactionPreview } from './FactionPreview';
import type { BuildingType, Difficulty, Faction, GameOptions, GameSnapshot, MatchMode, UnitType } from "../game/types";

type Screen = "menu" | "game";
type MenuModal = "archive" | "history" | "settings" | undefined;

const defaultSettings: RuntimeSettings = {
  shadows: true,
  edgeScroll: false,
  sound: true,
  reducedMotion: false,
  quality: "high",
};

function loadSettings(): RuntimeSettings {
  try {
    return { ...defaultSettings, ...(JSON.parse(localStorage.getItem("shardfront.settings") ?? "{}") as Partial<RuntimeSettings>) };
  } catch {
    return defaultSettings;
  }
}

const initialSnapshot: GameSnapshot = {
  running: true,
  paused: false,
  time: 0,
  faction: "helix",
  difficulty: "normal",
  mode: "skirmish",
  economy: {
    ore: 300,
    flux: 0,
    supplyUsed: 7,
    supplyCap: 12,
    attackLevel: 0,
    armorLevel: 0,
    gatheredOre: 0,
    gatheredFlux: 0,
    unitsCreated: 7,
    unitsLost: 0,
    structuresBuilt: 1,
  },
  selectedIds: [],
  selectedLabel: "No selection",
  selectedHp: "",
  selectedQueue: [],
  canBuild: false,
  alerts: [],
  tutorialStep: 0,
  fps: 60,
  entityCount: 0,
};

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [faction, setFaction] = useState<Faction>("helix");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [mode, setMode] = useState<MatchMode>("skirmish");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);
  const [buildMenu, setBuildMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  const [modal, setModal] = useState<MenuModal>();
  const [settings, setSettings] = useState<RuntimeSettings>(loadSettings);
  const [matchNonce, setMatchNonce] = useState(0);
  const gameHost = useRef<HTMLDivElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const activeOptions = useRef<GameOptions>({ faction, difficulty, mode });
  const [savedMatch,setSavedMatch]=useState<SavedMatch>();
  const [lastReplay,setLastReplay]=useState<SavedReplay>();
  const [notice,setNotice]=useState('');
  const [speed,setSpeed]=useState(1);
  const initialState=useRef<string|undefined>(undefined);
  const resultSaved=useRef(false);

  useEffect(()=>{void readRecord<SavedMatch>('match').then(setSavedMatch).catch(e=>setNotice(String(e.message)));void readRecord<SavedReplay>('replay').then(setLastReplay).catch(e=>setNotice(String(e.message)));},[]);
  const saveMatch=async()=>{const sim=runtime.current?.simulation;if(!sim||sim.result||activeOptions.current.replay)return;const save={options:{...activeOptions.current},serialized:sim.save(),date:new Date().toISOString()};try{await writeRecord('match',save);setSavedMatch(save);setNotice('Expedition saved on this device.');}catch{setNotice('Storage is unavailable. Keep this tab open to retain your match.');}};

  useEffect(() => {
    try{localStorage.setItem("shardfront.settings", JSON.stringify(settings));}catch{/* Storage denial must not prevent gameplay. */}
    runtime.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (screen !== "game" || !gameHost.current || !minimap.current) return;
    const options = activeOptions.current;
    let instance: GameRuntime;
    resultSaved.current=false;
    try {
    instance = new GameRuntime(
      gameHost.current,
      minimap.current,
      options,
      {
        onError: setNotice,
        onSnapshot: (next) => {
          setSnapshot(next);
          if (next.result) setPaused(false);
          if(next.result&&!resultSaved.current&&!options.replay){resultSaved.current=true;const replay:SavedReplay={options:{...options},commands:instance.simulation.commands,duration:next.time,hash:instance.simulation.stateHash(),date:new Date().toISOString()};void writeRecord('replay',replay).then(()=>setLastReplay(replay)).catch(()=>setNotice('Replay could not be saved.'));}
        },
        onHotkey: (action) => {
          if (action === "build") setBuildMenu((value) => !value);
          if (action === "pause") {
            setPaused((value) => {
              instance.setPaused(!value);
              return !value;
            });
          }
          if (action === "settings") setModal("settings");
        },
      },
      settings,
      initialState.current,
    );
    }catch(error){setNotice(error instanceof Error?error.message:'Graphics initialization failed. Try low quality or a WebGL 2-capable desktop browser.');setScreen('menu');return;}
    runtime.current = instance;
    initialState.current=undefined;
    setSnapshot(instance.simulation.getSnapshot(60));
    return () => {
      instance.destroy();
      if (runtime.current === instance) runtime.current = null;
    };
  }, [screen, matchNonce]);

  const startMatch = (nextMode: MatchMode = mode) => {
    initialState.current=undefined;setSpeed(1);setNotice('');
    const nextOptions = { faction, difficulty: nextMode === "tutorial" ? "easy" : difficulty, mode: nextMode };
    activeOptions.current = nextOptions;
    setSnapshot({ ...initialSnapshot, faction, difficulty: nextOptions.difficulty, mode: nextMode });
    setBuildMenu(false);
    setPaused(false);
    setMode(nextMode);
    setScreen("game");
    setMatchNonce((value) => value + 1);
  };

  const returnToMenu = () => {
    setScreen("menu");
    setPaused(false);
    setBuildMenu(false);
  };

  const rematch = () => {
    activeOptions.current={faction:activeOptions.current.faction,difficulty:activeOptions.current.difficulty,mode:activeOptions.current.mode};initialState.current=undefined;setSpeed(1);
    setPaused(false);
    setBuildMenu(false);
    setSnapshot({ ...initialSnapshot, faction: activeOptions.current.faction, difficulty: activeOptions.current.difficulty, mode: activeOptions.current.mode });
    setMatchNonce((value) => value + 1);
  };

  const togglePause = () => {
    setPaused((value) => {
      runtime.current?.setPaused(!value);
      return !value;
    });
  };

  if (screen === "menu") {
    return (
      <main className="app menu-screen">
        <MenuBackdrop />
        <header className="menu-topbar">
          <div className="brand-lockup">
            <ShardMark />
            <div>
              <span>GLASS RAVINE COMMAND</span>
              <strong>SHARDFRONT</strong>
            </div>
          </div>
          <div className="build-chip"><span /> VERTICAL SLICE · WEBGL 2</div>
        </header>

        <section className="menu-content">
          <div className="hero-copy">
            <p className="overline">ORIGINAL BROWSER REAL-TIME STRATEGY</p>
            <h1>CLAIM THE<br /><em>RAVINE.</em></h1>
            <p className="hero-description">
              Build an economy. Read the fog. Shape a combined-arms force, take the watch network, and break the enemy command core.
            </p>
            <div className="menu-actions">
              <button className="primary-action" onClick={() => startMatch("skirmish")}>
                <span>DEPLOY</span>
                <small>Start skirmish</small>
                <b>↗</b>
              </button>
              <button className="secondary-action" onClick={() => startMatch("tutorial")}>
                <span>FIELD ORIENTATION</span>
                <small>Guided tutorial</small>
              </button>
            </div>
            <nav className="utility-nav" aria-label="Additional options">
              {savedMatch&&<button onClick={()=>{activeOptions.current={...savedMatch.options};initialState.current=savedMatch.serialized;setSpeed(1);setPaused(false);setScreen('game');setMatchNonce(v=>v+1);}}>Continue saved expedition</button>}
              {lastReplay&&<button onClick={()=>{activeOptions.current={...lastReplay.options,replay:lastReplay.commands};initialState.current=undefined;setSpeed(1);setPaused(false);setScreen('game');setMatchNonce(v=>v+1);}}>Watch last replay</button>}
              <button onClick={() => setModal("archive")}>Tech archive</button>
              <button onClick={() => setModal("history")}>Match records</button>
              <button onClick={() => setModal("settings")}>Settings</button>
            </nav>
          </div>

          <div className="deployment-card">
            <div className="card-heading">
              <span>01</span>
              <div><small>EXPEDITION CONFIG</small><strong>Choose command doctrine</strong></div>
            </div>
            <div className="faction-grid">
              {(["helix", "chorus"] as Faction[]).map((item) => (
                <button
                  key={item}
                  className={`faction-card ${faction === item ? "active" : ""}`}
                  data-faction={item}
                  onClick={() => setFaction(item)}
                >
                  <FactionPreview faction={item} />
                  <small>{factionCopy[item].eyebrow}</small>
                  <strong>{factionNames[item]}</strong>
                  <p>{factionCopy[item].description}</p>
                  <span className="select-line">{faction === item ? "SELECTED" : "SELECT"}<i /></span>
                </button>
              ))}
            </div>
            <div className="difficulty-row">
              <div><small>AI DOCTRINE</small><strong>{difficulty.toUpperCase()}</strong></div>
              <div className="segmented-control">
                {(["easy", "normal", "hard"] as Difficulty[]).map((item) => (
                  <button key={item} className={difficulty === item ? "active" : ""} onClick={() => setDifficulty(item)}>{item}</button>
                ))}
              </div>
            </div>
            <div className="map-brief">
              <div className="mini-map-art"><span /><span /><i /><i /></div>
              <div><small>THEATER</small><strong>Glass Ravine</strong><p>1v1 · Two resources · Watch network · 12–20 min</p></div>
            </div>
            <div className="system-strip">
              <span><b>20</b> SIM TPS</span>
              <span><b>60</b> FPS TARGET</span>
              <span><b>2</b> FACTIONS</span>
            </div>
          </div>
        </section>
        {notice&&<div className="system-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification">×</button></div>}

        <footer className="menu-footer">
          <span>WASD / ARROWS — CAMERA</span><span>DRAG — SELECT</span><span>RIGHT CLICK — ORDER</span><span>A — ATTACK MOVE</span>
        </footer>
        {modal && <MenuModalView modal={modal} onClose={() => setModal(undefined)} settings={settings} setSettings={setSettings} />}
      </main>
    );
  }

  return (
    <main className={`app game-screen faction-${snapshot.faction}`}>
      <div className="game-host" ref={gameHost} />
      {notice&&<div className="system-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification">×</button></div>}
      {activeOptions.current.replay&&<div className="replay-controls"><strong>COMMAND REPLAY</strong><button onClick={()=>{const next=speed===1?2:speed===2?4:1;setSpeed(next);runtime.current?.setSpeed(next);}}>{speed}× playback</button></div>}
      <div className="objective-ribbon">
        <small>PRIMARY OBJECTIVE</small>
        <span>Destroy the enemy {snapshot.faction === "helix" ? "Heartgrove" : "Core Relay"}</span>
      </div>
      <div className="match-clock"><span>{formatTime(snapshot.time)}</span><small>{snapshot.mode === "tutorial" ? "ORIENTATION" : "SKIRMISH"}</small></div>
      <div className="resource-bar">
        <ResourcePill icon="◆" label="PRISM" value={Math.floor(snapshot.economy.ore)} color="cyan" />
        <ResourcePill icon="◉" label="FLUX" value={Math.floor(snapshot.economy.flux)} color="violet" />
        <ResourcePill
          icon="⌁"
          label="SUPPLY"
          value={`${snapshot.economy.supplyUsed}/${snapshot.economy.supplyCap}`}
          color={snapshot.economy.supplyUsed >= snapshot.economy.supplyCap ? "danger" : "amber"}
        />
        <button className="hud-menu-button" onClick={togglePause}>Ⅱ</button>
      </div>

      <div className="alerts-stack">
        {snapshot.alerts.slice().reverse().map((alert, index) => (
          <div className={`alert-line ${alert.kind}`} key={`${alert.time}-${alert.text}-${index}`}>
            <span>{alert.kind === "warning" ? "!" : alert.kind === "combat" ? "×" : "◇"}</span>
            <p>{alert.text}</p>
            <time>{formatTime(alert.time)}</time>
          </div>
        ))}
      </div>

      {snapshot.tutorialText && (
        <div className="tutorial-card">
          <div className="tutorial-progress"><span style={{ width: `${((snapshot.tutorialStep + 1) / 9) * 100}%` }} /></div>
          <small>FIELD ORIENTATION · STEP {snapshot.tutorialStep + 1}/9</small>
          <strong>{snapshot.tutorialText}</strong>
        </div>
      )}

      <aside className="minimap-panel">
        <div className="minimap-heading"><span>GLASS RAVINE</span><small>LIVE TACTICAL</small></div>
        <canvas ref={minimap} aria-label="Tactical minimap" />
        <div className="minimap-legend"><span className="friendly-dot" /> YOU <span className="enemy-dot" /> HOSTILE <span className="pylon-dot" /> PYLON</div>
      </aside>

      <section className="selection-panel">
        <div className="selection-emblem"><FactionGlyph faction={snapshot.faction} /></div>
        <div className="selection-copy">
          <small>ACTIVE SELECTION</small>
          <strong>{snapshot.selectedLabel}</strong>
          <span>{snapshot.selectedHp || "Issue orders from the field"}</span>
        </div>
        {snapshot.selectedIds.length > 0 && (
          <div className="selection-meta"><b>{snapshot.selectedIds.length}</b><small>SELECTED</small></div>
        )}
      </section>

      <CommandPanel
        snapshot={snapshot}
        runtime={runtime.current}
        buildMenu={buildMenu}
        setBuildMenu={setBuildMenu}
      />

      <div className="performance-chip" title="Rendering telemetry">
        <span className={snapshot.fps >= 50 ? "good" : "warn"} /> {snapshot.fps} FPS · {snapshot.entityCount} ENT
      </div>

      {paused && !snapshot.result && (
        <div className="overlay-shell">
          <div className="pause-panel">
            <p className="overline">LOCAL SIMULATION PAUSED</p>
            <h2>COMMAND LINK<br />SUSPENDED</h2>
            <button className="primary-action compact" onClick={togglePause}><span>RESUME</span><b>▶</b></button>
            <button onClick={() => setModal("settings")}>Settings</button>
            {!activeOptions.current.replay&&<button onClick={()=>void saveMatch()}>Save expedition</button>}
            <button onClick={returnToMenu}>Abandon match</button>
            <div className="controls-list"><span>A · attack move</span><span>S · stop</span><span>H · hold</span><span>Ctrl+1–9 · groups</span></div>
          </div>
        </div>
      )}

      {snapshot.result && (
        <ResultScreen snapshot={snapshot} onRematch={rematch} onMenu={returnToMenu} />
      )}
      {modal === "settings" && <MenuModalView modal="settings" onClose={() => setModal(undefined)} settings={settings} setSettings={setSettings} />}
    </main>
  );
}

function ResourcePill({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return <div className={`resource-pill ${color}`}><i>{icon}</i><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function CommandPanel({
  snapshot,
  runtime,
  buildMenu,
  setBuildMenu,
}: {
  snapshot: GameSnapshot;
  runtime: GameRuntime | null;
  buildMenu: boolean;
  setBuildMenu: (value: boolean) => void;
}) {
  const producible = runtime?.getProducibleTypes() ?? [];
  const canBuild = snapshot.canBuild;
  const faction = snapshot.faction;

  return (
    <aside className="command-panel">
      <div className="command-heading">
        <span>COMMAND GRID</span>
        <small>{snapshot.selectedIds.length ? "READY" : "NO LINK"}</small>
      </div>
      {snapshot.selectedIds.length === 0 ? (
        <div className="empty-command"><i>⌖</i><p>Select units or structures to reveal available commands.</p></div>
      ) : (
        <>
          <div className="command-grid">
            {canBuild && (
              <CommandButton icon="⌂" label="Construct" hotkey="B" onClick={() => setBuildMenu(!buildMenu)} active={buildMenu} />
            )}
            {!snapshot.selectedBuilding && <CommandButton icon="⌁" label="Attack move" hotkey="A" onClick={() => runtime?.setAttackMoveMode()} />}
            {!snapshot.selectedBuilding && <CommandButton icon="■" label="Stop" hotkey="S" onClick={() => runtime?.stop()} />}
            {!snapshot.selectedBuilding && <CommandButton icon="◇" label="Hold" hotkey="H" onClick={() => runtime?.hold()} />}
            {!snapshot.selectedBuilding && (
              <CommandButton icon="▰" label={snapshot.canBuild?'Emergency repair':snapshot.selectedLabel.includes('Mender')||snapshot.selectedLabel.includes('Sage')?'Restore':snapshot.selectedLabel.includes('Kestrel')||snapshot.selectedLabel.includes('Glimmer')?'Sensor sweep':'Brace / root'} hotkey="Q" onClick={() => runtime?.brace()} />
            )}
            {snapshot.selectedBuilding && producible.map((type) => {
              const def = units[type];
              const disabled = snapshot.economy.ore < def.cost.ore || snapshot.economy.flux < def.cost.flux || snapshot.economy.supplyUsed + (def.cost.supply ?? 0) > snapshot.economy.supplyCap;
              return <CommandButton key={type} icon={unitIcon(type)} label={def.label[faction]} hotkey={def.hotkey} disabled={disabled} subtitle={`${def.cost.ore}◆ ${def.cost.flux ? `${def.cost.flux}◉` : ""}`} onClick={() => runtime?.train(type)} />;
            })}
            {snapshot.selectedBuilding === "tech" && (
              <>
                <CommandButton icon="↑" label={`Attack ${snapshot.economy.attackLevel + 1}`} disabled={snapshot.economy.attackLevel >= 2} subtitle="150◆ 100◉" onClick={() => runtime?.research("attackUpgrade")} />
                <CommandButton icon="⬡" label={`Armor ${snapshot.economy.armorLevel + 1}`} disabled={snapshot.economy.armorLevel >= 2} subtitle="150◆ 100◉" onClick={() => runtime?.research("armorUpgrade")} />
              </>
            )}
            {snapshot.selectedBuilding && <CommandButton icon="⌖" label="Set rally" hotkey="R" onClick={() => runtime?.setRallyMode()} />}
          </div>
          {snapshot.selectedQueue.length > 0 && (
            <div className="production-queue">
              <small>PRODUCTION QUEUE</small>
              {snapshot.selectedQueue.map((item, index) => {
                const progress = Math.min(100, (item.elapsed / item.duration) * 100);
                const label = item.type === "attackUpgrade" ? "Weapon lattice" : item.type === "armorUpgrade" ? "Armor weave" : units[item.type].label[faction];
                return (
                  <button key={`${item.type}-${index}`} onClick={() => index === 0 && runtime?.cancelQueue()} title="Click the active item to cancel for 75% refund">
                    <span style={{ width: `${progress}%` }} />
                    <b>{label}</b><i>{Math.ceil(item.duration - item.elapsed)}s</i>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {buildMenu && canBuild && (
        <div className="build-drawer">
          <div className="drawer-heading"><small>FIELD CONSTRUCTION</small><button onClick={() => setBuildMenu(false)}>×</button></div>
          {buildOrder.map((type) => {
            const def = buildings[type];
            const disabled = snapshot.economy.ore < def.cost.ore || snapshot.economy.flux < def.cost.flux;
            return (
              <button key={type} disabled={disabled} onClick={() => { runtime?.setBuildMode(type); setBuildMenu(false); }}>
                <i>{buildingIcon(type)}</i>
                <div><strong>{def.label[faction]}</strong><small>{def.role}</small></div>
                <span>{def.cost.ore}◆{def.cost.flux ? ` ${def.cost.flux}◉` : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function CommandButton({
  icon,
  label,
  hotkey,
  subtitle,
  disabled,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  hotkey?: string;
  subtitle?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`command-button ${active ? "active" : ""}`} disabled={disabled} onClick={onClick}>
      <i>{icon}</i><strong>{label}</strong>{subtitle && <small>{subtitle}</small>}{hotkey && <kbd>{hotkey}</kbd>}
    </button>
  );
}

function ResultScreen({ snapshot, onRematch, onMenu }: { snapshot: GameSnapshot; onRematch: () => void; onMenu: () => void }) {
  const victory = snapshot.result?.winner === "player";
  return (
    <div className={`overlay-shell result-overlay ${victory ? "victory" : "defeat"}`}>
      <section className="result-panel">
        <p className="overline">GLASS RAVINE · AFTER ACTION</p>
        <h2>{victory ? "THE RAVINE\nIS YOURS" : "EXPEDITION\nBROKEN"}</h2>
        <p>{snapshot.result?.reason}</p>
        <div className="result-stats">
          <ResultStat label="Duration" value={formatTime(snapshot.time)} />
          <ResultStat label="Prism gathered" value={snapshot.economy.gatheredOre.toLocaleString()} />
          <ResultStat label="Flux gathered" value={snapshot.economy.gatheredFlux.toLocaleString()} />
          <ResultStat label="Units fielded" value={snapshot.economy.unitsCreated.toString()} />
          <ResultStat label="Units lost" value={snapshot.economy.unitsLost.toString()} />
          <ResultStat label="Structures" value={snapshot.economy.structuresBuilt.toString()} />
        </div>
        <div className="result-actions">
          <button className="primary-action compact" onClick={onRematch}><span>REMATCH</span><b>↻</b></button>
          <button onClick={onMenu}>Return to command</button>
        </div>
      </section>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function MenuModalView({
  modal,
  onClose,
  settings,
  setSettings,
}: {
  modal: Exclude<MenuModal, undefined>;
  onClose: () => void;
  settings: RuntimeSettings;
  setSettings: (settings: RuntimeSettings) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-panel">
        <button className="modal-close" onClick={onClose}>×</button>
        {modal === "archive" && <TechArchive />}
        {modal === "history" && <MatchHistory />}
        {modal === "settings" && <Settings settings={settings} setSettings={setSettings} />}
      </section>
    </div>
  );
}

function TechArchive() {
  const [tab, setTab] = useState<Faction>("helix");
  return (
    <div className="archive-view">
      <p className="overline">COMMAND INTELLIGENCE</p><h2>TECH ARCHIVE</h2>
      <div className="archive-tabs">
        {(["helix", "chorus"] as Faction[]).map((faction) => <button className={tab === faction ? "active" : ""} onClick={() => setTab(faction)} key={faction}>{factionNames[faction]}</button>)}
      </div>
      <p className="archive-intro">{factionCopy[tab].description}</p>
      <div className="archive-list">
        {(Object.keys(units) as UnitType[]).filter(type=>type!=='guard'||tab==='chorus').map((type) => (
          <article key={type}><i>{unitIcon(type)}</i><div><strong>{units[type].label[tab]}</strong><small>{units[type].role}</small><p>{units[type].hp} HP · {units[type].damage} DMG · {units[type].range} RNG</p></div></article>
        ))}
      </div>
    </div>
  );
}

function MatchHistory() {
  const matches = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("shardfront.matchHistory") ?? "[]") as Array<{ date: string; faction: Faction; difficulty: Difficulty; result?: { winner: string; duration: number }; economy: { unitsCreated: number } }>; }
    catch { return []; }
  }, []);
  return (
    <div className="history-view">
      <p className="overline">LOCAL RECORDS</p><h2>MATCH HISTORY</h2>
      {matches.length === 0 ? <div className="empty-history"><i>◇</i><p>No expeditions recorded yet. Complete a match to create an after-action record.</p></div> : (
        <div className="history-list">{matches.map((match, index) => (
          <article key={`${match.date}-${index}`}><span className={match.result?.winner === "player" ? "win" : "loss"}>{match.result?.winner === "player" ? "VICTORY" : "DEFEAT"}</span><div><strong>{factionNames[match.faction]}</strong><small>{new Date(match.date).toLocaleString()} · {match.difficulty}</small></div><b>{formatTime(match.result?.duration ?? 0)}</b></article>
        ))}</div>
      )}
    </div>
  );
}

function Settings({ settings, setSettings }: { settings: RuntimeSettings; setSettings: (settings: RuntimeSettings) => void }) {
  const update = <K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) => setSettings({ ...settings, [key]: value });
  return (
    <div className="settings-view">
      <p className="overline">SYSTEM CONFIGURATION</p><h2>SETTINGS</h2>
      <SettingRow title="Graphics quality" description="Changes pixel density and ambient density.">
        <div className="segmented-control">{(["low", "medium", "high"] as const).map((value) => <button key={value} className={settings.quality === value ? "active" : ""} onClick={() => update("quality", value)}>{value}</button>)}</div>
      </SettingRow>
      <SettingRow title="Dynamic shadows" description="Disable for a large GPU performance gain."><Toggle value={settings.shadows} onChange={(value) => update("shadows", value)} /></SettingRow>
      <SettingRow title="Sound effects" description="Synthesized spatial and interface feedback."><Toggle value={settings.sound} onChange={(value) => update("sound", value)} /></SettingRow>
      <SettingRow title="Edge scrolling" description="Camera movement at the canvas edge; WASD and drag always work."><Toggle value={settings.edgeScroll} onChange={(value) => update("edgeScroll", value)} /></SettingRow>
      <SettingRow title="Reduced motion" description="Suppresses nonessential camera and UI motion."><Toggle value={settings.reducedMotion} onChange={(value) => update("reducedMotion", value)} /></SettingRow>
      <div className="keymap-card"><small>COMMAND REFERENCE</small><div><kbd>DRAG</kbd><span>Box select</span><kbd>RIGHT CLICK</kbd><span>Context order</span><kbd>A</kbd><span>Attack move</span><kbd>Ctrl+1–9</kbd><span>Assign group</span><kbd>F</kbd><span>Focus selection</span><kbd>F11</kbd><span>Fullscreen</span></div></div>
    </div>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="setting-row"><div><strong>{title}</strong><small>{description}</small></div>{children}</div>;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <button className={`toggle ${value ? "on" : ""}`} onClick={() => onChange(!value)}><span /></button>;
}

function MenuBackdrop() {
  return <div className="menu-backdrop" aria-hidden="true"><div className="planet" /><div className="ravine-grid" /><div className="orb orb-a" /><div className="orb orb-b" /><div className="scan-line" /></div>;
}

function ShardMark() {
  return <svg className="shard-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 2 43 14v20L24 46 5 34V14L24 2Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m24 8 10 12-10 20L14 20 24 8Z" fill="currentColor" opacity=".9"/><path d="m14 20 10 5 10-5" fill="none" stroke="#071019" strokeWidth="2"/></svg>;
}

function FactionGlyph({ faction }: { faction: Faction }) {
  if (faction === "helix") return <svg className="faction-glyph" viewBox="0 0 64 64" aria-hidden="true"><path d="M11 42 32 8l21 34-21 14L11 42Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M20 39 32 19l12 20-12 8-12-8Z" fill="currentColor" opacity=".82"/></svg>;
  return <svg className="faction-glyph" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c5 13 19 15 19 29 0 11-8 20-19 23-11-3-19-12-19-23C13 21 27 19 32 6Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M32 18c3 8 10 10 10 18 0 6-4 11-10 14-6-3-10-8-10-14 0-8 7-10 10-18Z" fill="currentColor" opacity=".82"/></svg>;
}

function unitIcon(type: UnitType): string {
  return { worker: "⌬", scout: "⌁", soldier: "▰", lancer: "↯", healer: "✦", siege: "◒", heavy: "⬢",guard:'⬡' }[type];
}

function buildingIcon(type: BuildingType): string {
  return { hq: "⬡", supply: "⌁", barracks: "▦", tech: "◫", turret: "⌖", extractor: "◉" }[type];
}
