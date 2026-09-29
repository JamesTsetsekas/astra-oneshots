import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowRight, Backpack, Check, Coins, Compass, Crosshair, Flask, Gear, Heart, Lightning,
  Lock, MapTrifold, Pause, Play, Scroll, Shield, SignOut, Sparkle, Star, Sword, Trash, User, X,
} from "@phosphor-icons/react";
import menuArt from "../assets/ashfall-menu.png";
import { abilities, classCopy, classLoadouts, enemies } from "../game/content";
import { itemPower } from "../game/loot";
import { clearSave, loadSave, saveCharacter } from "../game/persistence";
import { formatTime } from "../game/simulation";
import { GameRuntime, type RuntimeSettings } from "../game/runtime";
import type { CharacterSave, Difficulty, GameOptions, GameSnapshot, HeroClass, ItemRarity, LootItem, SkillId } from "../game/types";

type Screen = "boot" | "menu" | "create" | "game";
type Panel = "inventory" | "skills" | "character" | "quests" | "map" | "settings" | undefined;

const settingsDefault: RuntimeSettings = {
  sound: true,
  shadows: true,
  reducedMotion: false,
  damageNumbers: true,
  screenShake: true,
  quality: "high",
};

function loadSettings(): RuntimeSettings {
  try { return { ...settingsDefault, ...JSON.parse(localStorage.getItem("ashfall.settings") ?? "{}") }; }
  catch { return settingsDefault; }
}

function placeholderHero(heroClass: HeroClass, name = "Warden"): GameSnapshot["hero"] {
  return {
    class: heroClass, name, level: 1, xp: 0, xpNext: 100, hp: heroClass === "cinder" ? 230 : 175,
    maxHp: heroClass === "cinder" ? 230 : 175, focus: 75, maxFocus: 100, heat: 0, damage: 20,
    armor: 18, critChance: 0.1, x: -28, z: -20, attackTimer: 0, castTimer: 0, evadeCharges: 3,
    evadeRecovery: 0, invulnerable: 0, guard: 0, camouflage: 0, furnace: 0, potions: 3,
    maxPotions: 5, gold: 75, dust: 0, skillPoints: 1, attributePoints: 0, skills: {}, equipment: {},
    inventory: [], deaths: 0, kills: 0,
  };
}

function initialSnapshot(heroClass: HeroClass = "cinder", name = "Warden"): GameSnapshot {
  return {
    running: true, paused: false, time: 0, zone: "refuge", difficulty: "normal", hero: placeholderHero(heroClass, name),
    questStep: "keeper", questTitle: "A bell beneath the ash", questDetail: "Speak with Warden Maelin at the refuge gate.",
    enemiesAlive: 0, events: [], waypointActive: false, artificerRescued: false, veteranUnlocked: false,
    victory: false, seed: 0, fps: 60,
  };
}

const rarityLabel: Record<ItemRarity, string> = { worn: "Worn", tempered: "Tempered", inscribed: "Inscribed", relic: "Relic" };

export function App() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [heroClass, setHeroClass] = useState<HeroClass>("cinder");
  const [heroName, setHeroName] = useState("Eira Voss");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => initialSnapshot());
  const [panel, setPanel] = useState<Panel>();
  const [paused, setPaused] = useState(false);
  const [save, setSave] = useState<CharacterSave>();
  const [recovered, setRecovered] = useState(false);
  const [settings, setSettings] = useState<RuntimeSettings>(loadSettings);
  const [matchNonce, setMatchNonce] = useState(0);
  const [selectedItem, setSelectedItem] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [victoryDismissed, setVictoryDismissed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const activeOptions = useRef<GameOptions>({ heroClass, heroName, difficulty, seed: Date.now() >>> 0 });
  const restorePayload = useRef<CharacterSave["payload"] | undefined>(undefined);
  const pausedRef = useRef(false);
  const panelRef = useRef<Panel>(undefined);
  useEffect(()=>{panelRef.current=panel;},[panel]);

  useEffect(() => {
    let active = true;
    void loadSave().then((result) => {
      if (!active) return;
      setSave(result.save);
      setRecovered(result.recovered);
      window.setTimeout(() => active && setScreen("menu"), 450);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem("ashfall.settings", JSON.stringify(settings));
    runtime.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (screen !== "game" || !host.current || !minimap.current) return;
    let instance: GameRuntime;
    instance = new GameRuntime(
      host.current,
      minimap.current,
      activeOptions.current,
      {
        onSnapshot: (next) => setSnapshot(next),
        onPanel: (next) => openPanel(next),
        onPause: () => {if(panelRef.current){setPanel(undefined);instance.setPaused(false);}else togglePause(instance);},
        onSaveRequested: () => persist(instance),
      },
      settings,
      restorePayload.current,
    );
    runtime.current = instance;
    setSnapshot(instance.simulation.getSnapshot(60));
    const saveTimer = window.setInterval(() => persist(instance), 12000);
    return () => {
      window.clearInterval(saveTimer);
      void persist(instance);
      instance.destroy();
      if (runtime.current === instance) runtime.current = null;
    };
  }, [screen, matchNonce]);

  const persist = (instance = runtime.current) => {
    if (!instance) return;
    const sim = instance.simulation;
    void saveCharacter(activeOptions.current, sim.hero, sim.questStep, sim.waypointActive, sim.artificerRescued, sim.veteranUnlocked).then(async () => {
      const latest = await loadSave();
      if (latest.save) setSave(latest.save);
    });
  };

  const togglePause = (instance = runtime.current) => {
    setPaused((value) => {
      const next = !value;
      pausedRef.current = next;
      instance?.setPaused(next);
      return next;
    });
  };

  const openPanel = (next: Exclude<Panel, undefined>) => {
    setPanel((current) => {
      const nextPanel = current === next ? undefined : next;
      runtime.current?.setPaused(Boolean(nextPanel) || pausedRef.current);
      return nextPanel;
    });
  };

  const closePanel = () => {
    setPanel(undefined);
    runtime.current?.setPaused(pausedRef.current);
  };

  const begin = (targetHunt = false, difficultyOverride?: Difficulty) => {
    const options: GameOptions = { heroClass, heroName: heroName.trim() || "Warden", difficulty: difficultyOverride ?? difficulty, seed: (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0, targetHunt };
    activeOptions.current = options;
    const previous=runtime.current?.simulation;
    restorePayload.current = targetHunt && previous ? {heroClass:previous.hero.class,heroName:previous.hero.name,difficulty:options.difficulty,seed:options.seed,hero:structuredClone(previous.hero),questStep:'orison',waypointActive:true,artificerRescued:true,veteranUnlocked:true} : undefined;
    setVictoryDismissed(false);
    setSnapshot(initialSnapshot(options.heroClass, options.heroName));
    setPaused(false);
    pausedRef.current = false;
    setPanel(undefined);
    setScreen("game");
    setMatchNonce((value) => value + 1);
  };

  const continueGame = () => {
    if (!save) return;
    const options: GameOptions = {
      heroClass: save.payload.heroClass,
      heroName: save.payload.heroName,
      difficulty: save.payload.difficulty,
      seed: save.payload.seed,
    };
    activeOptions.current = options;
    restorePayload.current = save.payload;
    setHeroClass(options.heroClass);
    setHeroName(options.heroName);
    setDifficulty(options.difficulty);
    setPaused(false);
    pausedRef.current = false;
    setPanel(undefined);
    setScreen("game");
    setMatchNonce((value) => value + 1);
  };

  const returnToMenu = () => {
    setPanel(undefined);
    setPaused(false);
    pausedRef.current = false;
    setScreen("menu");
  };

  const deleteCharacter = async () => {
    await clearSave();
    setSave(undefined);
    setRecovered(false);
    setToast("Local character removed.");
  };

  if (screen === "boot") return <BootScreen />;
  if (screen === "menu") return (
    <MainMenu
      save={save}
      recovered={recovered}
      onContinue={continueGame}
      onCreate={() => setScreen("create")}
      onSettings={() => setPanel("settings")}
      onDelete={deleteCharacter}
      panel={panel}
      settings={settings}
      setSettings={setSettings}
      onClose={() => setPanel(undefined)}
      toast={toast}
    />
  );
  if (screen === "create") return (
    <CharacterCreate
      heroClass={heroClass}
      setHeroClass={setHeroClass}
      heroName={heroName}
      setHeroName={setHeroName}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      veteranUnlocked={save?.payload.veteranUnlocked ?? false}
      onBack={() => setScreen("menu")}
      onBegin={() => begin(false)}
    />
  );

  const selected = [...snapshot.hero.inventory,...Object.values(snapshot.hero.equipment)].find((item) => item?.id === selectedItem);
  return (
    <main className={`game-shell class-${snapshot.hero.class}`}>
      <div ref={host} className="world-host" />
      <GameHud
        snapshot={snapshot}
        minimap={minimap}
        runtime={runtime.current}
        onPanel={openPanel}
        onPause={() => togglePause()}
      />
      {paused && !snapshot.victory && !panel && <PauseScreen onResume={() => togglePause()} onSettings={() => openPanel("settings")} onMenu={returnToMenu} />}
      {panel && (
        <PanelShell title={panelTitle(panel)} onClose={closePanel} wide={panel === "inventory" || panel === "skills" || panel === "map"}>
          {panel === "inventory" && <InventoryPanel snapshot={snapshot} runtime={runtime.current} selected={selected} setSelected={setSelectedItem} />}
          {panel === "skills" && <SkillsPanel snapshot={snapshot} runtime={runtime.current} />}
          {panel === "character" && <CharacterPanel snapshot={snapshot} runtime={runtime.current} />}
          {panel === "quests" && <QuestPanel snapshot={snapshot} />}
          {panel === "map" && <FullMap snapshot={snapshot} />}
          {panel === "settings" && <SettingsPanel settings={settings} setSettings={setSettings} />}
        </PanelShell>
      )}
      {snapshot.victory && !victoryDismissed && (
        <VictoryScreen
          snapshot={snapshot}
          onVeteran={() => begin(true, "veteran")}
          onReplay={() => begin(true)}
          onMenu={returnToMenu}
          onLoot={()=>setVictoryDismissed(true)}
        />
      )}
      <div className="field-guide"><span>CLICK <b>move / attack</b></span><span>RMB <b>core skill</b></span><span>Q W E R <b>abilities</b></span><span>F <b>interact / loot</b></span><span>SCROLL <b>zoom</b></span></div>
      {snapshot.zone==='refuge' && <button className="refuge-supplies" onClick={()=>runtime.current?.simulation.restock()}>Refuge supplies · heal & refill · 15 gold</button>}
      {snapshot.victory&&victoryDismissed&&<button className="refuge-supplies" onClick={()=>setVictoryDismissed(false)}>Act complete · review expedition / begin hunt</button>}
    </main>
  );
}

function BootScreen() {
  return (
    <main className="boot-screen">
      <div className="boot-sigil"><span /><span /><span /></div>
      <p>READING THE ASH</p>
      <div className="boot-line"><i /></div>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-sigil"><span /><i /></div>
      <div><small>VARROW FRONTIER</small><strong>ASHFALL COVENANT</strong></div>
    </div>
  );
}

function MainMenu({ save, recovered, onContinue, onCreate, onSettings, onDelete, panel, settings, setSettings, onClose, toast }: {
  save?: CharacterSave; recovered: boolean; onContinue(): void; onCreate(): void; onSettings(): void; onDelete(): void;
  panel: Panel; settings: RuntimeSettings; setSettings(value: RuntimeSettings): void; onClose(): void; toast?: string;
}) {
  return (
    <main className="main-menu" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,8,9,.98) 0%, rgba(7,8,9,.86) 30%, rgba(7,8,9,.1) 70%), url(${menuArt})` }}>
      <header className="menu-header"><Brand /><button className="icon-button" onClick={onSettings} aria-label="Settings"><Gear size={21} /></button></header>
      <section className="menu-content">
        <p className="kicker">AN ORIGINAL BROWSER ACTION RPG</p>
        <h1>ENTER VARROW.<br /><span>END THE ORISON.</span></h1>
        <p className="menu-lede">Build a Warden, break the buried engine, and return stronger.</p>
        <div className="menu-actions">
          {save && <button className="primary-button" onClick={onContinue}><Play weight="fill" /><span>CONTINUE</span><small>{save.payload.heroName} / LEVEL {save.payload.hero.level}</small></button>}
          <button className={save ? "secondary-button" : "primary-button"} onClick={onCreate}><Sword /><span>CREATE WARDEN</span><small>Begin a new expedition</small></button>
        </div>
        {save && (
          <div className="save-summary">
            <div><small>LAST WAYPOINT</small><strong>{save.payload.waypointActive ? "ASHWAY RESTORED" : "EMBER REFUGE"}</strong></div>
            <div><small>DIFFICULTY</small><strong>{save.payload.difficulty.toUpperCase()}</strong></div>
            <button onClick={onDelete}><Trash size={15} /> Delete local character</button>
          </div>
        )}
        {recovered && <div className="recovery-note"><Check /> Recovered from the last valid backup.</div>}
        {toast && <div className="menu-toast">{toast}</div>}
      </section>
      <footer className="menu-footer"><span>CLICK TO MOVE</span><span>RIGHT CLICK CORE SKILL</span><span>Q W E R ABILITIES</span><span>SPACE EVADE</span></footer>
      {panel === "settings" && <PanelShell title="SETTINGS" onClose={onClose}><SettingsPanel settings={settings} setSettings={setSettings} /></PanelShell>}
    </main>
  );
}

function CharacterCreate({ heroClass, setHeroClass, heroName, setHeroName, difficulty, setDifficulty, veteranUnlocked, onBack, onBegin }: {
  heroClass: HeroClass; setHeroClass(value: HeroClass): void; heroName: string; setHeroName(value: string): void;
  difficulty: Difficulty; setDifficulty(value: Difficulty): void; veteranUnlocked: boolean; onBack(): void; onBegin(): void;
}) {
  return (
    <main className="create-screen">
      <div className="create-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,10,11,.14), rgba(9,10,11,.82)), url(${menuArt})` }} />
      <header className="create-header"><Brand /><button onClick={onBack}><X /> CANCEL</button></header>
      <section className="create-panel">
        <p className="kicker">CREATE YOUR WARDEN</p>
        <h1>Choose how you face the ash.</h1>
        <div className="class-selector">
          {(["cinder", "ranger"] as const).map((value) => (
            <button key={value} className={heroClass === value ? "class-choice active" : "class-choice"} onClick={() => setHeroClass(value)}>
              <span className="class-glyph">{value === "cinder" ? <Shield size={34} /> : <Crosshair size={34} />}</span>
              <small>{classCopy[value].epithet}</small>
              <strong>{classCopy[value].name}</strong>
              <p>{classCopy[value].description}</p>
              <i>{heroClass === value ? "SELECTED" : "CHOOSE"}</i>
            </button>
          ))}
        </div>
        <div className="create-form">
          <label><span>WARDEN NAME</span><input value={heroName} maxLength={22} onChange={(event) => setHeroName(event.target.value)} /></label>
          <fieldset><legend>EXPEDITION</legend>
            <button className={difficulty === "normal" ? "active" : ""} onClick={() => setDifficulty("normal")}>NORMAL</button>
            <button className={difficulty === "veteran" ? "active" : ""} disabled={!veteranUnlocked} onClick={() => setDifficulty("veteran")}><Lock size={14} /> VETERAN</button>
          </fieldset>
        </div>
        <button className="deploy-button" onClick={onBegin}><span>TAKE THE COVENANT</span><ArrowRight /></button>
      </section>
    </main>
  );
}

function GameHud({ snapshot, minimap, runtime, onPanel, onPause }: {
  snapshot: GameSnapshot; minimap: RefObject<HTMLCanvasElement | null>; runtime: GameRuntime | null;
  onPanel(panel: Exclude<Panel, undefined>): void; onPause(): void;
}) {
  const loadout = classLoadouts[snapshot.hero.class];
  return (
    <div className="hud">
      <header className="hud-top">
        <div className="zone-lockup"><small>{snapshot.difficulty.toUpperCase()} EXPEDITION</small><strong>{zoneName(snapshot.zone)}</strong><span>{formatTime(snapshot.time)}</span></div>
        {snapshot.boss && <div className="boss-frame"><div><small>PHASE {snapshot.boss.phase}</small><strong>{snapshot.boss.name}</strong></div><div className="boss-health"><i style={{ width: `${Math.max(0, snapshot.boss.hp / snapshot.boss.maxHp) * 100}%` }} /></div></div>}
        <button className="pause-button" onClick={onPause}><Pause size={17} weight="fill" /></button>
      </header>
      <aside className="quest-tracker"><div><Scroll size={17} /><small>CURRENT VOW</small></div><strong>{snapshot.questTitle}</strong><p>{snapshot.questDetail}</p></aside>
      <aside className="minimap-frame"><canvas ref={minimap} /><div><span>{snapshot.enemiesAlive} THREATS</span><span>{snapshot.fps} FPS</span></div></aside>
      <aside className="event-feed">
        {snapshot.events.slice(0, 4).map((event) => <div key={event.id} className={event.kind}><span>{event.kind === "danger" ? "!" : event.kind === "loot" ? "+" : "◆"}</span><p>{event.text}<small>{formatTime(event.time)}</small></p></div>)}
      </aside>
      {snapshot.nearbyPickup?.kind === "item" && <div className={`ground-label rarity-${snapshot.nearbyPickup.rarity}`}><strong>{snapshot.nearbyPickup.label}</strong><span>F TO COLLECT</span></div>}
      <div className="hud-bottom">
        <Orb kind="health" current={snapshot.hero.hp} max={snapshot.hero.maxHp} label="HEALTH" icon={<Heart weight="fill" />} />
        <div className="skill-deck">
          <div className="utility-buttons">
            <button onClick={() => onPanel("inventory")}><Backpack /><kbd>I</kbd></button>
            <button onClick={() => onPanel("skills")}><Sparkle /><kbd>K</kbd></button>
            <button onClick={() => onPanel("character")}><User /><kbd>C</kbd></button>
          </div>
          <div className="ability-row">
            <AbilityButton id={loadout.core} hotkey="RMB" runtime={runtime} snapshot={snapshot} />
            {loadout.keys.map((id, index) => <AbilityButton key={id} id={id} hotkey={["Q", "W", "E", "R"][index]} runtime={runtime} snapshot={snapshot} />)}
            <AbilityButton id={snapshot.hero.class==='cinder'?'ashenStandard':'horizonCall'} hotkey="V" runtime={runtime} snapshot={snapshot} />
            <button className="potion-slot" onClick={() => runtime?.usePotion()}><Flask weight="fill" /><kbd>1</kbd><b>{snapshot.hero.potions}</b></button>
          </div>
          <div className="xp-bar"><i style={{ width: `${snapshot.hero.xp / snapshot.hero.xpNext * 100}%` }} /><span>LEVEL {snapshot.hero.level}</span></div>
        </div>
        <Orb kind="focus" current={snapshot.hero.focus} max={snapshot.hero.maxFocus} label={snapshot.hero.class === "cinder" ? `FOCUS / HEAT ${Math.round(snapshot.hero.heat)}` : "FOCUS / TRACE"} icon={<Lightning weight="fill" />} />
      </div>
      <div className="evade-charges"><span>SPACE</span>{[0, 1, 2].map((value) => <i key={value} className={snapshot.hero.evadeCharges > value ? "ready" : ""} />)}</div>
    </div>
  );
}

function Orb({ kind, current, max, label, icon }: { kind: "health" | "focus"; current: number; max: number; label: string; icon: ReactNode }) {
  const ratio = Math.max(0, Math.min(1, current / max));
  return <div className={`resource-orb ${kind}`}><div className="orb-liquid" style={{ clipPath: `inset(${(1 - ratio) * 100}% 0 0)` }} /><div className="orb-shine" /><span>{icon}</span><strong>{Math.ceil(current)}</strong><small>{label}</small></div>;
}

function AbilityButton({ id, hotkey, runtime, snapshot }: { id: SkillId; hotkey: string; runtime: GameRuntime | null; snapshot: GameSnapshot }) {
  const definition = abilities[id];
  const cooldown = runtime?.simulation.cooldowns.get(id) ?? 0;
  const disabled = cooldown > 0 || snapshot.hero.focus < definition.cost;
  return (
    <button className={`ability-button damage-${definition.damageType}`} disabled={disabled} onClick={() => runtime?.castSkill(id)} title={`${definition.name}: ${definition.description}`}>
      <span>{abilityGlyph(id)}</span><kbd>{hotkey}</kbd>{cooldown > 0 && <b>{cooldown.toFixed(1)}</b>}<small>{definition.name}</small>
    </button>
  );
}

function InventoryPanel({ snapshot, runtime, selected, setSelected }: { snapshot: GameSnapshot; runtime: GameRuntime | null; selected?: LootItem; setSelected(id?: string): void }) {
  const equipped = Object.entries(snapshot.hero.equipment).filter((entry) => entry[1]);
  return (
    <div className="inventory-layout">
      <section className="equipment-pane"><h3>EQUIPPED</h3><div className="paper-doll"><div className="silhouette"><User size={92} weight="thin" /></div>{equipped.map(([slot, item]) => <button key={slot} className={`equip-slot slot-${slot} rarity-${item!.rarity}`} onClick={() => setSelected(item!.id)}><small>{slot}</small><strong>{item!.name}</strong></button>)}</div><div className="wallet"><span><Coins /> {snapshot.hero.gold}</span><span><Sparkle /> {snapshot.hero.dust} dust</span></div></section>
      <section className="grid-pane"><div className="panel-section-heading"><div><h3>FIELD PACK</h3><p>Items are packed automatically.</p></div><span>{snapshot.hero.inventory.length} / 24</span></div><div className="inventory-grid">
        {Array.from({ length: 60 }, (_, index) => <i key={index} />)}
        {snapshot.hero.inventory.map((item) => <button key={item.id} className={`inventory-item rarity-${item.rarity} ${selected?.id === item.id ? "selected" : ""}`} style={{ left: `${(item.x ?? 0) * 10}%`, top: `${(item.y ?? 0) * 16.666}%`, width: `${item.size[0] * 10}%`, height: `${item.size[1] * 16.666}%` }} onClick={() => setSelected(item.id)}><span>{itemIcon(item)}</span><small>{item.itemLevel}</small>{item.favorite && <Star weight="fill" />}</button>)}
      </div></section>
      <section className="item-inspector">{selected ? <ItemInspector item={selected} snapshot={snapshot} runtime={runtime} setSelected={setSelected} /> : <div className="empty-inspector"><Backpack size={42} weight="thin" /><p>Select an item to compare, equip, favorite, or salvage.</p></div>}</section>
    </div>
  );
}

function ItemInspector({ item, snapshot, runtime, setSelected }: { item: LootItem; snapshot: GameSnapshot; runtime: GameRuntime | null; setSelected(id?: string): void }) {
  const equipped = snapshot.hero.equipment[item.slot];
  const owned = snapshot.hero.inventory.some((entry) => entry.id === item.id);
  return (
    <div className={`item-card rarity-${item.rarity}`}>
      <small>{rarityLabel[item.rarity]} {item.slot}</small><h3>{item.name}</h3><p>ITEM LEVEL {item.itemLevel}</p>
      <div className="item-primary">{item.damage > 0 && <span><b>{item.damage}</b> DAMAGE</span>}{item.armor > 0 && <span><b>{item.armor}</b> ARMOR</span>}<span><b>{Math.round(itemPower(item))}</b> POWER</span></div>
      <div className="affix-list">{item.affixes.map((affix) => <p key={`${affix.id}-${affix.tier}`}><span>+{affix.value}{affix.stat.includes("Chance") || affix.stat.includes("Damage") ? "%" : ""}</span> {affix.name}<small>T{affix.tier}</small></p>)}</div>
      {item.special && <div className="relic-power"><Star weight="fill" />{item.special}</div>}
      {owned && snapshot.artificerRescued && <button className="refine-button" disabled={snapshot.hero.dust<4||snapshot.hero.gold<20} onClick={()=>runtime?.simulation.refine(item.id)}>SABLE: REFINE +{item.slot==='weapon'?'3 DAMAGE':'2 ARMOR'} · 4 DUST / 20 GOLD</button>}
      {equipped && equipped.id !== item.id && <div className="comparison"><small>CURRENT {item.slot.toUpperCase()}</small><strong>{equipped.name}</strong><span>{Math.round(itemPower(item) - itemPower(equipped)) >= 0 ? "+" : ""}{Math.round(itemPower(item) - itemPower(equipped))} power</span></div>}
      {owned && <div className="item-actions"><button onClick={() => { runtime?.simulation.equip(item.id); setSelected(undefined); }}><Check /> EQUIP</button><button onClick={() => runtime?.simulation.toggleFavorite(item.id)}><Star weight={item.favorite ? "fill" : "regular"} /> FAVORITE</button><button disabled={item.favorite} onClick={() => { runtime?.simulation.salvage(item.id); setSelected(undefined); }}><Trash /> SALVAGE</button></div>}
    </div>
  );
}

function SkillsPanel({ snapshot, runtime }: { snapshot: GameSnapshot; runtime: GameRuntime | null }) {
  const all = (Object.values(abilities) as typeof abilities[SkillId][]).filter((ability) => ability.class === snapshot.hero.class);
  return (
    <div className="skills-layout"><header><div><small>{classCopy[snapshot.hero.class].epithet}</small><h2>{classCopy[snapshot.hero.class].name}</h2><p>{classCopy[snapshot.hero.class].description}</p></div><div className="point-counter"><b>{snapshot.hero.skillPoints}</b><span>POINTS READY</span></div></header><div className="skill-path">
      {all.map((ability, index) => { const rank = snapshot.hero.skills[ability.id] ?? 0; return <article key={ability.id} className={rank > 0 ? "unlocked" : ""}><button onClick={() => runtime?.simulation.allocateSkill(ability.id)} disabled={snapshot.hero.skillPoints <= 0 || rank >= 3}><span>{abilityGlyph(ability.id)}</span><i>{rank}/3</i></button><div><small>{ability.tags.join(" / ")}</small><h3>{ability.name}</h3><p>{ability.description}</p><footer><span>{ability.cost ? `${ability.cost} FOCUS` : "NO COST"}</span><span>{ability.cooldown ? `${ability.cooldown}s CD` : "BASIC"}</span><span>{ability.coefficient}x</span></footer></div>{index < all.length - 1 && <i className="skill-connector" />}</article>; })}
      <div className="capstone-row"><button disabled={snapshot.hero.level<15} onClick={()=>runtime?.simulation.selectCapstone(1)}><Sparkle /><strong>{snapshot.hero.class === "cinder" ? "LIVING CRUCIBLE" : "THOUSAND TRAILS"}</strong><span>{snapshot.hero.skills.capstone===1?'SELECTED':snapshot.hero.level<15?'Unlocks at level 15':snapshot.hero.class==='cinder'?'+25% damage above 30 Heat':'+15% all attack damage'}</span></button><em>CHOOSE ONE</em><button disabled={snapshot.hero.level<15} onClick={()=>runtime?.simulation.selectCapstone(2)}><Shield /><strong>{snapshot.hero.class === "cinder" ? "UNBROKEN OATH" : "PATIENT HUNTER"}</strong><span>{snapshot.hero.skills.capstone===2?'SELECTED':snapshot.hero.level<15?'Unlocks at level 15':'12% damage reduction; stronger Guard'}</span></button></div>
    </div><button className="respec-button" onClick={() => runtime?.simulation.respec()}>REFUND ALL POINTS</button></div>
  );
}

function CharacterPanel({ snapshot, runtime }: { snapshot: GameSnapshot;runtime:GameRuntime|null }) {
  const stats = [
    ["Damage", snapshot.hero.damage], ["Armor", snapshot.hero.armor], ["Critical chance", `${Math.round(snapshot.hero.critChance * 100)}%`],
    ["Maximum health", Math.round(snapshot.hero.maxHp)], ["Maximum Focus", snapshot.hero.maxFocus], ["Evade charges", snapshot.hero.evadeCharges],
    ["Enemies defeated", snapshot.hero.kills], ["Deaths", snapshot.hero.deaths],
  ];
  return <div className="character-panel"><div className="character-banner"><div className="portrait-mark">{snapshot.hero.class === "cinder" ? <Shield /> : <Crosshair />}</div><div><small>LEVEL {snapshot.hero.level} {classCopy[snapshot.hero.class].name.toUpperCase()}</small><h2>{snapshot.hero.name}</h2><p>{snapshot.difficulty.toUpperCase()} / {snapshot.hero.attributePoints} ATTRIBUTE POINTS READY</p></div></div><div className="attribute-row">{(['might','finesse','will','vigor'] as const).map((name,index)=><div key={name}><strong>{snapshot.hero.attributes?.[name]??0}</strong><span>{name}</span><button disabled={!snapshot.hero.attributePoints} title={['+2 damage','+1% critical chance','+8 maximum Focus','+15 maximum health'][index]} onClick={()=>runtime?.simulation.allocateAttribute(name)}>+ {['2 DMG','1% CRIT','8 FOCUS','15 HP'][index]}</button></div>)}</div><div className="stat-grid">{stats.map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div></div>;
}

function QuestPanel({ snapshot }: { snapshot: GameSnapshot }) {
  const steps = ["keeper", "waypoint", "tollKeeper", "artificer", "orison", "complete"] as const;
  const activeIndex = steps.indexOf(snapshot.questStep);
  const labels = ["Take the covenant", "Restore the Ashway", "Break the Toll-Keeper", "Free Artificer Sable", "Silence the Engine", "Return to the frontier"];
  return <div className="quest-panel"><h2>The Buried Star</h2><p>Varrow's machines are waking beneath the ash. Follow the old causeway into the Hollow Archive.</p><div className="quest-chain">{labels.map((label, index) => <div key={label} className={index < activeIndex || snapshot.questStep === "complete" ? "done" : index === activeIndex ? "active" : "locked"}><span>{index < activeIndex || snapshot.questStep === "complete" ? <Check /> : index + 1}</span><div><strong>{label}</strong><small>{index === activeIndex ? snapshot.questDetail : index < activeIndex ? "Completed" : "Unknown"}</small></div></div>)}</div></div>;
}

function FullMap({ snapshot }: { snapshot: GameSnapshot }) {
  return <div className="full-map"><div className="map-path"><i className="path-line" /><MapNode className="refuge" label="Ember Refuge" active={snapshot.zone === "refuge"} complete /><MapNode className="waypoint" label="Ashway" active={snapshot.zone === "march"} complete={snapshot.waypointActive} /><MapNode className="toll" label="Broken Toll" active={snapshot.questStep === "tollKeeper"} complete={["artificer", "orison", "complete"].includes(snapshot.questStep)} /><MapNode className="archive" label="Hollow Archive" active={snapshot.zone === "archive"} complete={snapshot.artificerRescued} /><MapNode className="engine" label="Orison Engine" active={snapshot.zone === "engine"} complete={snapshot.victory} /></div><footer><Compass /><span>Discovered paths are retained by this Warden.</span></footer></div>;
}

function MapNode({ className, label, active, complete }: { className: string; label: string; active: boolean; complete: boolean }) {
  return <div className={`map-node ${className} ${active ? "active" : ""} ${complete ? "complete" : ""}`}><span>{complete ? <Check /> : <Lock />}</span><strong>{label}</strong></div>;
}

function SettingsPanel({ settings, setSettings }: { settings: RuntimeSettings; setSettings(value: RuntimeSettings): void }) {
  const toggle = (key: keyof RuntimeSettings) => setSettings({ ...settings, [key]: !settings[key] });
  return <div className="settings-panel"><Setting label="Master audio" detail="Procedural ambience, combat, loot, and warning cues"><button className={settings.sound ? "toggle on" : "toggle"} onClick={() => toggle("sound")}><i /></button></Setting><Setting label="Dynamic shadows" detail="Moonlight shadows on actors and architecture"><button className={settings.shadows ? "toggle on" : "toggle"} onClick={() => toggle("shadows")}><i /></button></Setting><Setting label="Screen shake" detail="Brief impact movement for critical hits and heavy skills"><button className={settings.screenShake ? "toggle on" : "toggle"} onClick={() => toggle("screenShake")}><i /></button></Setting><Setting label="Reduced motion" detail="Disables camera shake and decorative motion"><button className={settings.reducedMotion ? "toggle on" : "toggle"} onClick={() => toggle("reducedMotion")}><i /></button></Setting><Setting label="Quality preset" detail="Adjusts resolution and effects budget"><select value={settings.quality} onChange={(event) => setSettings({ ...settings, quality: event.target.value as RuntimeSettings["quality"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Setting></div>;
}

function Setting({ label, detail, children }: { label: string; detail: string; children: ReactNode }) { return <div className="setting-row"><div><strong>{label}</strong><p>{detail}</p></div>{children}</div>; }

function PanelShell({ title, onClose, children, wide = false }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-layer"><section className={`modal-panel ${wide ? "wide" : ""}`}><header><div><small>WARDEN RECORD</small><h2>{title}</h2></div><button onClick={onClose} aria-label="Close"><X /></button></header><div className="modal-content">{children}</div><footer><span>ESC TO CLOSE</span><span>LOCAL GAME PAUSED</span></footer></section></div>;
}

function PauseScreen({ onResume, onSettings, onMenu }: { onResume(): void; onSettings(): void; onMenu(): void }) {
  return <div className="pause-layer"><section><small>LOCAL EXPEDITION PAUSED</small><h2>The ash waits.</h2><button className="primary-button" onClick={onResume}><Play weight="fill" /><span>RESUME</span></button><button onClick={onSettings}><Gear /> SETTINGS</button><button onClick={onMenu}><SignOut /> RETURN TO MENU</button></section></div>;
}

function VictoryScreen({ snapshot, onVeteran, onReplay, onMenu, onLoot }: { snapshot: GameSnapshot; onVeteran(): void; onReplay(): void; onMenu(): void;onLoot():void }) {
  return <div className="victory-layer"><div className="victory-radiance" /><section><Star size={36} weight="fill" /><small>ACT COMPLETE</small><h1>THE ENGINE<br />IS SILENT.</h1><p>Varrow holds for another night. Your Warden, levels and equipment carry into every hunt.</p><div className="run-stats"><div><b>{formatTime(snapshot.time)}</b><span>RUN TIME</span></div><div><b>{snapshot.hero.kills}</b><span>DEFEATED</span></div><div><b>{snapshot.hero.level}</b><span>LEVEL</span></div><div><b>{snapshot.hero.deaths}</b><span>DEATHS</span></div></div><button className="primary-button" onClick={onLoot}><Backpack /><span>COLLECT YOUR REWARDS</span></button><button onClick={onVeteran}><Sword /> BEGIN VETERAN HUNT</button><button onClick={onReplay}><Crosshair /> TARGET HUNT</button><button onClick={onMenu}><SignOut /> RETURN TO MENU</button></section></div>;
}

function panelTitle(panel: Exclude<Panel, undefined>): string { return { inventory: "INVENTORY", skills: "SKILLS", character: "CHARACTER", quests: "QUEST LOG", map: "AUTOMAP", settings: "SETTINGS" }[panel]; }
function zoneName(zone: GameSnapshot["zone"]): string { return { refuge: "EMBER REFUGE", march: "THE SOOT MARCH", archive: "HOLLOW ARCHIVE", engine: "ENGINE VAULT" }[zone]; }
function abilityGlyph(id: SkillId): string { const glyphs: Partial<Record<SkillId, string>> = { ironLitany: "III", brandArc: "⌁", bastionStep: "▰", cinderRing: "◉", vowChain: "⌇", furnaceHeart: "△", ashenStandard: "⚑", quickshot: "➶", splinterVolley: "≪", ghostline: "↝", snareBloom: "✣", mothcloak: "◇", backstepFlask: "◒", horizonCall: "⇊" }; return glyphs[id] ?? "◆"; }
function itemIcon(item: LootItem): string { return item.slot === "weapon" ? "†" : item.slot === "offhand" ? "◇" : item.slot === "ring" ? "○" : item.slot === "amulet" ? "◈" : item.slot === "head" ? "⌃" : item.slot === "chest" ? "▣" : item.slot === "boots" ? "⌄" : "◆"; }
