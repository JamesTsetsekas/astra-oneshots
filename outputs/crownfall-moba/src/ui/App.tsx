import { useEffect, useRef, useState } from "react";
import {
  Crown,
  ArrowRight,
  ArrowLeft,
  Play,
  BookOpen,
  Shield,
  Sword,
  Feather,
  Eye,
  Lightning,
  Gear,
  X,
  Plus,
  Coins,
  Target,
  Pause,
  Backpack,
  ChartBar,
  Download,
  Check,
  Flag,
  Heart,
  Waveform,
  Skull,
} from "@phosphor-icons/react";
import keyArt from "../assets/crownfall-keyart.png";
import {
  HEROES,
  ITEMS,
  TALENTS,
  heroById,
  TEAM_NAMES,
  distance,
  type HeroId,
  type Talent,
  type Item,
} from "../game/content";
import {
  Simulation,
  type Options,
  type Snapshot,
  type Result,
} from "../game/simulation";
import { Runtime, DEFAULT_SETTINGS, type Settings } from "../game/runtime";
import {
  loadProfile,
  recordResult,
  downloadReplay,
  type Profile,
} from "../game/persistence";
import { HeroPreview } from "./Preview";
const time = (n: number) =>
  `${Math.floor(n / 60)}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
const roleIcon = (id: HeroId) =>
  id === "brannoch" ? (
    <Shield />
  ) : id === "suri" ? (
    <Target />
  ) : id === "oru" ? (
    <Feather />
  ) : id === "kesh" ? (
    <Sword />
  ) : id === "ilyra" ? (
    <BookOpen />
  ) : (
    <Lightning />
  );
type Screen = "menu" | "draft" | "game" | "history" | "guide";
type Panel = "shop" | "scoreboard" | "pause" | "settings" | undefined;
const initialOptions: Options = {
  hero: "suri",
  mode: "skirmish",
  seed: 1,
  talents: ["Blink", "Mend"],
};
export function App() {
  const [screen, setScreen] = useState<Screen>("menu"),
    [hero, setHero] = useState<HeroId>("suri"),
    [mode, setMode] = useState<Options["mode"]>("skirmish"),
    [talents, setTalents] = useState<[Talent, Talent]>(["Blink", "Mend"]);
  const [snapshot, setSnapshot] = useState<Snapshot>(() =>
      new Simulation(initialOptions).snapshot(),
    ),
    [panel, setPanel] = useState<Panel>(),
    [result, setResult] = useState<Result>(),
    [nonce, setNonce] = useState(0),
    [profile, setProfile] = useState<Profile>({
      version: 1,
      history: [],
      mastery: {},
    }),
    [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(localStorage.getItem("crownfall.settings") ?? "{}"),
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const host = useRef<HTMLDivElement>(null),
    minimap = useRef<HTMLCanvasElement>(null),
    runtime = useRef<Runtime | undefined>(undefined),
    panelRef = useRef<Panel>(undefined),
    options = useRef(initialOptions),
    settingsRef = useRef(settings);
  useEffect(() => {
    void loadProfile().then(setProfile);
  }, []);
  useEffect(() => {
    settingsRef.current = settings;
    runtime.current?.setSettings(settings);
    try {
      localStorage.setItem("crownfall.settings", JSON.stringify(settings));
    } catch {
      /* Game remains playable. */
    }
  }, [settings]);
  const openPanel = (next: Panel) => {
    const p = panelRef.current === next ? undefined : next;
    panelRef.current = p;
    setPanel(p);
    runtime.current?.setPaused(Boolean(p));
  };
  useEffect(() => {
    if (screen !== "game" || !host.current || !minimap.current) return;
    let r: Runtime;
    try {
      r = new Runtime(
        host.current,
        minimap.current,
        options.current,
        settingsRef.current,
        {
          snapshot: setSnapshot,
          panel: (p) => openPanel(p),
          result: (value) => {
            setResult(value);
            void recordResult(value, r.sim.replay())
              .then(setProfile)
              .catch(() =>
                setError(
                  "Match complete. Browser storage is unavailable; export the replay to keep it.",
                ),
              );
          },
        },
      );
      runtime.current = r;
      setSnapshot(r.sim.snapshot());
    } catch (e) {
      setError(
        `The 3D renderer could not start: ${e instanceof Error ? e.message : "unknown error"}`,
      );
      return;
    }
    return () => {
      r.dispose();
      runtime.current = undefined;
    };
  }, [screen, nonce]);
  const begin = () => {
    options.current = {
      hero,
      mode,
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0,
      talents,
    };
    setResult(undefined);
    setError("");
    setPanel(undefined);
    panelRef.current = undefined;
    setScreen("game");
    setNonce((n) => n + 1);
  };
  const menu = () => {
    setScreen("menu");
    setPanel(undefined);
    panelRef.current = undefined;
    setResult(undefined);
  };
  const draft = (m: Options["mode"]) => {
    setMode(m);
    setScreen("draft");
  };
  if (screen === "menu")
    return (
      <main
        className="menu"
        style={{
          backgroundImage: `linear-gradient(90deg,#112e49e8 0%,#183c5599 43%,transparent 76%),url(${keyArt})`,
        }}
      >
        <header>
          <Brand />
          <nav>
            <button onClick={() => setScreen("guide")}>FIELD GUIDE</button>
            <button onClick={() => setScreen("history")}>MATCH HISTORY</button>
            <button aria-label="Settings" onClick={() => setPanel("settings")}>
              <Gear size={21} />
            </button>
          </nav>
        </header>
        <section className="menu-copy">
          <p className="eyebrow">THE BROKEN DIADEM · LOCAL 3v3</p>
          <h1>
            CROWN<span>FALL</span>
          </h1>
          <p className="lede">
            Six heroes. Two lanes.
            <br />
            One engine worth fighting for.
          </p>
          <button className="play-button" onClick={() => draft("skirmish")}>
            <Play weight="fill" />
            <span>
              ENTER THE DIADEM<small>YOU + 2 ALLIED BOTS · 3 ENEMY BOTS</small>
            </span>
            <ArrowRight />
          </button>
          <div className="menu-secondary">
            <button onClick={() => draft("tutorial")}>
              <BookOpen /> LEARN TO PLAY
            </button>
            <button onClick={() => draft("practice")}>
              <Target /> PRACTICE
            </button>
          </div>
          <div className="menu-note">
            <span className="status-dot" /> All heroes unlocked. No account. No
            matchmaking wait.
          </div>
        </section>
        <footer>
          <span>AN ORIGINAL LANE & OBJECTIVE GAME</span>
          <span>ASTRA EDITION · OFFLINE BOT MATCHES</span>
        </footer>
        {panel === "settings" && (
          <Modal title="Settings" onClose={() => setPanel(undefined)}>
            <SettingsPanel value={settings} onChange={setSettings} />
          </Modal>
        )}
      </main>
    );
  if (screen === "draft") {
    const def = heroById(hero);
    return (
      <main className="draft">
        <header>
          <Brand />
          <button className="text-button" onClick={menu}>
            <ArrowLeft /> BACK
          </button>
        </header>
        <div className="draft-layout">
          <section className="draft-roster">
            <p className="eyebrow">{mode.toUpperCase()} · PICK YOUR HERO</p>
            <h1>A place in the fight.</h1>
            <p>
              Choose your kit. Your allies and rivals are local bots using the
              same combat rules.
            </p>
            <div className="hero-roster">
              {HEROES.map((h) => (
                <button
                  key={h.id}
                  className={`hero-card ${hero === h.id ? "selected" : ""}`}
                  onClick={() => setHero(h.id)}
                  style={{ "--hero-color": h.color } as React.CSSProperties}
                >
                  <span className="hero-icon">{roleIcon(h.id)}</span>
                  <span>
                    <strong>{h.name}</strong>
                    <small>{h.title}</small>
                    <em>{h.role}</em>
                  </span>
                  {hero === h.id && <Check />}
                </button>
              ))}
            </div>
            <div className="talent-select">
              <div>
                <small>UNIVERSAL TALENT · D</small>
                <select
                  value={talents[0]}
                  onChange={(e) =>
                    setTalents([e.target.value as Talent, talents[1]])
                  }
                >
                  {TALENTS.filter((t) => t !== talents[1]).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <small>UNIVERSAL TALENT · F</small>
                <select
                  value={talents[1]}
                  onChange={(e) =>
                    setTalents([talents[0], e.target.value as Talent])
                  }
                >
                  {TALENTS.filter((t) => t !== talents[0]).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="play-button" onClick={begin}>
              <Flag />
              <span>
                LOCK IN {def.name.toUpperCase()}
                <small>START A LOCAL {mode.toUpperCase()} MATCH</small>
              </span>
              <ArrowRight />
            </button>
          </section>
          <section className="draft-hero">
            <HeroPreview hero={hero} />
            <div className="hero-summary">
              <p className="eyebrow">{def.role}</p>
              <h2>{def.name}</h2>
              <p>{def.passive}</p>
              <div className="kit-preview">
                {def.abilities.map((a, i) => (
                  <article key={a.name}>
                    <kbd>{["Q", "W", "E", "R"][i]}</kbd>
                    <strong>{a.name}</strong>
                    <p>{a.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }
  if (screen === "guide")
    return (
      <main className="archive-page">
        <header>
          <Brand />
          <button onClick={menu}>
            <ArrowLeft /> BACK
          </button>
        </header>
        <section className="guide">
          <p className="eyebrow">A WARDEN’S FIRST MATCH</p>
          <h1>
            Win the map.
            <br />
            Then break the Crown.
          </h1>
          <div className="guide-grid">
            {[
              [
                "01",
                "Travel with your wave",
                "Right-click to move or attack. Your minions absorb tower fire. Going alone into a tower is costly.",
              ],
              [
                "02",
                "Grow your hero",
                "Last-hit for gold; nearby enemies grant XP. Ctrl + Q/W/E/R ranks a skill. Your ultimate opens at level 6.",
              ],
              [
                "03",
                "Spend with purpose",
                "P opens the shop. You must be at the fountain to buy. B recalls after 7 uninterrupted seconds.",
              ],
              [
                "04",
                "See the next fight",
                "4 places a 90-second ward at your cursor. Brush hides enemies unless allies are close or a ward reveals them.",
              ],
              [
                "05",
                "Create a siege window",
                "Catalysts arrive at 3:30, the Colossus at 9:00. Claim them for team gold and empowered minion waves.",
              ],
              [
                "06",
                "Finish the match",
                "Break a lane’s three towers and Seal. Destroy both Core Towers. Only then is the Crown Engine vulnerable.",
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span>{n}</span>
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <button className="play-button" onClick={() => draft("tutorial")}>
            <BookOpen />
            <span>START GUIDED MATCH</span>
            <ArrowRight />
          </button>
          <p className="muted">
            Q W E R cast · D F talents · 1–3/5–6 items · 4 ward · S stop · Y
            camera lock · Space follow · arrow keys pan · Tab scoreboard ·
            Escape pause
          </p>
        </section>
      </main>
    );
  if (screen === "history")
    return (
      <main className="archive-page">
        <header>
          <Brand />
          <button onClick={menu}>
            <ArrowLeft /> BACK
          </button>
        </header>
        <section className="history">
          <p className="eyebrow">LOCAL MATCH RECORD</p>
          <h1>Your time on the Diadem.</h1>
          {profile.history.length === 0 ? (
            <div className="empty">
              <Crown size={52} />
              <h2>No battles recorded yet.</h2>
              <p>
                Complete a match to record hero mastery, builds, objectives and
                the result on this browser.
              </p>
              <button onClick={() => draft("skirmish")}>
                Choose a hero <ArrowRight />
              </button>
            </div>
          ) : (
            profile.history.map((r) => (
              <article className="history-row" key={r.id}>
                <span className={r.winner === 0 ? "win" : "loss"}>
                  {r.winner === 0 ? "VICTORY" : "DEFEAT"}
                </span>
                <strong>{heroById(r.hero).name}</strong>
                <span>{time(r.duration)}</span>
                <span>
                  {r.scoreboard.find((h) => h.team === 0 && h.hero === r.hero)
                    ?.kills ?? 0}{" "}
                  kills
                </span>
                <small>SEED {r.seed.toString(16).toUpperCase()}</small>
              </article>
            ))
          )}
          {profile.replay && (
            <button
              className="export"
              onClick={() => downloadReplay(profile.replay!)}
            >
              <Download /> EXPORT LAST MATCH INPUT LOG
            </button>
          )}
        </section>
      </main>
    );
  const player = snapshot.player,
    def = heroById(player.hero!);
  return (
    <main className="game">
      <div className="world-host" ref={host} />
      <div className="match-top">
        <span>
          <i className="team-dot dawn" />
          DAWNWRIGHT
        </span>
        <b>{snapshot.alliedKills}</b>
        <div>
          <strong>{time(snapshot.time)}</strong>
          <small>LOCAL {mode.toUpperCase()}</small>
        </div>
        <b>{snapshot.enemyKills}</b>
        <span>
          VESPER
          <i className="team-dot vesper" />
        </span>
      </div>
      <button
        className="pause-control"
        aria-label="Pause"
        onClick={() => openPanel("pause")}
      >
        <Pause />
      </button>
      <div className="objective-card">
        <small>THE CROWN’S DEFENSES</small>
        <strong>Push a lane. Break its Seal.</strong>
        <p>Then destroy both Core Towers and the Crown Engine.</p>
        <div>
          <span>
            Catalysts{" "}
            <b>
              {snapshot.objectiveTimers[0] > 900
                ? "ACTIVE"
                : time(Math.max(0, snapshot.objectiveTimers[0]))}
            </b>
          </span>
          <span>
            Colossus{" "}
            <b>
              {snapshot.objectiveTimers[2] > 900
                ? "ACTIVE"
                : time(Math.max(0, snapshot.objectiveTimers[2]))}
            </b>
          </span>
        </div>
        {snapshot.buffs[0] > 0 && (
          <em>EMPOWERED WAVES · {time(snapshot.buffs[0])}</em>
        )}
      </div>
      <div className="event-feed">
        {snapshot.events
          .filter((e) => e.text && snapshot.time - e.time < 10)
          .slice(0, 3)
          .map((e) => (
            <p key={e.id} className={`team-${e.team}`}>
              {e.text}
            </p>
          ))}
      </div>
      {mode === "tutorial" && (
        <div className="tutorial-card">
          <BookOpen />
          <span>{snapshot.message}</span>
        </div>
      )}
      <div className="hud">
        <section className="hero-hud">
          <div className="portrait" style={{ color: def.color }}>
            {roleIcon(player.hero!)}
            <b>{player.level}</b>
          </div>
          <div className="vitals">
            <strong>
              {def.name}
              <small>
                {player.kills} / {player.deaths} / {player.assists}
              </small>
            </strong>
            <div className="health-bar">
              <i style={{ width: `${(player.hp / player.maxHp) * 100}%` }} />
              <span>
                {Math.ceil(player.hp)} / {Math.round(player.maxHp)}
              </span>
            </div>
            <div className="mana-bar">
              <i
                style={{ width: `${(player.mana / player.maxMana) * 100}%` }}
              />
              <span>
                {Math.floor(player.mana)} / {player.maxMana}
              </span>
            </div>
            <div className="statline">
              <span>
                <Sword />
                {Math.round(player.damage)}
              </span>
              <span>
                <Shield />
                {Math.round(player.armor)}
              </span>
              <span>
                <Lightning />
                {Math.round(player.power)}
              </span>
              <span>
                <Target />
                {player.lastHits} CS
              </span>
            </div>
          </div>
        </section>
        <section className="actions">
          <div className="abilities">
            {def.abilities.map((a, i) => (
              <div className="ability-wrap" key={a.name}>
                {player.points > 0 &&
                  player.ranks[i] < (i === 3 ? 2 : 4) &&
                  (i !== 3 || player.level >= 6) && (
                    <button
                      className="rank-button"
                      aria-label={`Rank ${a.name}`}
                      onClick={() => runtime.current?.command("rank", i)}
                    >
                      <Plus />
                      {player.points}
                    </button>
                  )}
                <button
                  className={`ability a-${i} ${player.ranks[i] ? "learned" : ""}`}
                  disabled={
                    !player.ranks[i] ||
                    player.cooldowns[i] > 0 ||
                    player.mana < a.cost ||
                    player.hp <= 0
                  }
                  title={`${a.name} · ${a.description} · ${a.cost} mana / ${a.cooldown}s`}
                  onClick={() => runtime.current?.cast(i)}
                >
                  <kbd>{["Q", "W", "E", "R"][i]}</kbd>
                  <span>
                    {[<Sword />, <Waveform />, <Feather />, <Crown />][i]}
                  </span>
                  {player.cooldowns[i] > 0 && (
                    <b>{player.cooldowns[i].toFixed(1)}</b>
                  )}
                  <small>{a.name}</small>
                  <div className="rank-dots">
                    {Array.from({ length: i === 3 ? 2 : 4 }, (_, n) => (
                      <i key={n} className={player.ranks[i] > n ? "on" : ""} />
                    ))}
                  </div>
                </button>
              </div>
            ))}
            <div className="talent-buttons">
              {talents.map((t, i) => (
                <button
                  key={i}
                  disabled={snapshot.talentCds[i] > 0}
                  onClick={() => runtime.current?.talent(i)}
                  title={t}
                >
                  <kbd>{i === 0 ? "D" : "F"}</kbd>
                  {t === "Mend" ? (
                    <Heart />
                  ) : t === "Farsight" ? (
                    <Eye />
                  ) : (
                    <Lightning />
                  )}
                  <small>
                    {snapshot.talentCds[i] > 0
                      ? Math.ceil(snapshot.talentCds[i])
                      : t}
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="inventory-bar">
            {Array.from({ length: 6 }, (_, i) => {
              const item = ITEMS.find((item) => item.id === player.items[i]);
              return (
                <button
                  key={i}
                  className={item ? "occupied" : ""}
                  onClick={() => runtime.current?.command("item", i)}
                  title={
                    item
                      ? `${item.name}: ${item.description}`
                      : "Empty item slot"
                  }
                >
                  <kbd>{i + 1}</kbd>
                  {item && <ItemIcon item={item} />}
                </button>
              );
            })}
            <button
              className="ward-button"
              title="4 · Place a ward at your cursor"
              onClick={() =>
                runtime.current?.command("ward", {
                  x: player.x + 3,
                  z: player.z,
                })
              }
            >
              <Eye />
              <b>{snapshot.wardCharges}</b>
            </button>
            <button className="shop-shortcut" onClick={() => openPanel("shop")}>
              <Coins />
              <b>{Math.floor(player.gold)}</b>
              <kbd>P</kbd>
            </button>
          </div>
          <div className="xp-bar">
            <i
              style={{
                width: `${(player.xp / (120 + player.level * 60)) * 100}%`,
              }}
            />
          </div>
        </section>
        <section className="minimap">
          <canvas ref={minimap} width={260} height={190} />
          <div>
            <span>THE BROKEN DIADEM</span>
            <button
              onClick={() => runtime.current?.command("auto")}
              className={snapshot.auto ? "active" : ""}
            >
              {snapshot.auto ? "PILOT ON" : "BOT PILOT"}
            </button>
            {snapshot.auto && (
              <button
                aria-label="Bot simulation speed"
                onClick={() =>
                  runtime.current?.command(
                    "speed",
                    snapshot.speed === 1 ? 2 : snapshot.speed === 2 ? 4 : 1,
                  )
                }
              >
                {snapshot.speed}×
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="quick-help">
        RMB move / attack · CTRL + Q W E R learn · 4 ward · B recall · Y camera
        lock
      </div>
      {player.recall > 0 && (
        <div className="recall-state">
          RETURNING TO FOUNTAIN <b>{player.recall.toFixed(1)}</b>
          <i style={{ width: `${(1 - player.recall / 7) * 100}%` }} />
        </div>
      )}
      {player.hp <= 0 && (
        <div className="death-state">
          <Skull />
          <h2>Return to the fight.</h2>
          <p>
            Respawning at your fountain in <b>{Math.ceil(player.dead)}</b>{" "}
            seconds.
          </p>
        </div>
      )}
      {panel && (
        <Modal
          title={
            panel === "shop"
              ? "The fountain exchange"
              : panel === "scoreboard"
                ? "Battle ledger"
                : panel === "settings"
                  ? "Settings"
                  : "A moment above the clouds"
          }
          wide={panel === "shop" || panel === "scoreboard"}
          onClose={() => openPanel(panel)}
        >
          {panel === "shop" && (
            <Shop snapshot={snapshot} runtime={runtime.current} />
          )}{" "}
          {panel === "scoreboard" && <Scoreboard heroes={snapshot.heroes} />}{" "}
          {panel === "settings" && (
            <SettingsPanel value={settings} onChange={setSettings} />
          )}{" "}
          {panel === "pause" && (
            <div className="pause-menu">
              <p>The local simulation is paused.</p>
              <button
                className="play-button"
                onClick={() => openPanel("pause")}
              >
                <Play />
                <span>RESUME MATCH</span>
              </button>
              <button onClick={() => openPanel("settings")}>
                <Gear /> SETTINGS
              </button>
              <button onClick={menu}>
                <ArrowLeft /> LEAVE MATCH
              </button>
              <small>Incomplete matches are not recorded.</small>
            </div>
          )}
        </Modal>
      )}
      {result && (
        <div className="result-layer">
          <section>
            <p className="eyebrow">
              {result.winner === 0
                ? "THE DIADEM IS YOURS"
                : "THE ENGINE HAS FALLEN"}
            </p>
            <Crown size={44} />
            <h1>{result.winner === 0 ? "VICTORY" : "DEFEAT"}</h1>
            <p>
              {TEAM_NAMES[result.winner as 0 | 1]} claimed the Crown Engine ·{" "}
              {time(result.duration)}
            </p>
            <Scoreboard heroes={snapshot.heroes} />
            <div className="result-actions">
              <button
                className="play-button"
                onClick={() => {
                  setScreen("draft");
                  setResult(undefined);
                }}
              >
                <Play />
                <span>PLAY AGAIN</span>
                <ArrowRight />
              </button>
              <button
                onClick={() =>
                  runtime.current &&
                  downloadReplay(runtime.current.sim.replay())
                }
              >
                <Download /> EXPORT MATCH LOG
              </button>
              <button onClick={menu}>RETURN TO MENU</button>
            </div>
          </section>
        </div>
      )}
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={menu}>Return to menu</button>
        </div>
      )}
    </main>
  );
}
function Brand() {
  return (
    <div className="brand">
      <Crown weight="duotone" />
      <span>
        CROWNFALL<small>THE BROKEN DIADEM</small>
      </span>
    </div>
  );
}
function Modal({
  title,
  wide,
  children,
  onClose,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
  onClose(): void;
}) {
  return (
    <div className="modal-layer">
      <section className={`modal ${wide ? "wide" : ""}`}>
        <header>
          <div>
            <small>LOCAL GAME PAUSED</small>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function ItemIcon({ item }: { item: Item }) {
  return item.category === "attack" || item.damage ? (
    <Sword />
  ) : item.category === "ability" || item.power ? (
    <BookOpen />
  ) : item.category === "boots" ? (
    <Feather />
  ) : item.category === "consumable" ? (
    <Heart />
  ) : (
    <Shield />
  );
}
function Shop({
  snapshot,
  runtime,
}: {
  snapshot: Snapshot;
  runtime?: Runtime;
}) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0);
  const player = snapshot.player,
    item = ITEMS.find((i) => i.id === selected)!,
    atHome = distance(player, player.home) < 8,
    cost = runtime?.sim.itemCost(player, item.id) ?? item.cost;
  const buy = () => {
    if (runtime) {
      runtime.sim.paused = false;
      runtime.command("buy", item.id);
      runtime.sim.paused = true;
    }
  };
  const sell = (i: number) => {
    if (runtime) {
      runtime.sim.paused = false;
      runtime.command("sell", i);
      runtime.sim.paused = true;
    }
  };
  return (
    <div className="shop-layout">
      <section className="shop-list">
        <div className="shop-tools">
          <input
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {[
              "all",
              "recommended",
              "starter",
              "component",
              "attack",
              "ability",
              "defense",
              "support",
              "boots",
              "consumable",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="shop-grid">
          {ITEMS.filter(
            (i) =>
              (filter === "all" ||
                (filter === "recommended" &&
                  runtime?.sim.recommend(player).includes(i.id)) ||
                i.category === filter) &&
              i.name.toLowerCase().includes(query.toLowerCase()),
          ).map((i) => (
            <button
              key={i.id}
              className={selected === i.id ? "selected" : ""}
              onClick={() => setSelected(i.id)}
            >
              <span className={`item-icon ${i.category}`}>
                <ItemIcon item={i} />
              </span>
              <strong>{i.name}</strong>
              <small>
                <Coins />
                {runtime?.sim.itemCost(player, i.id) ?? i.cost}
              </small>
            </button>
          ))}
        </div>
      </section>
      <aside className="item-detail">
        <span className={`item-icon large ${item.category}`}>
          <ItemIcon item={item} />
        </span>
        <small>{item.category.toUpperCase()}</small>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="item-stats">
          {(
            [
              "damage",
              "power",
              "hp",
              "armor",
              "ward",
              "speed",
              "haste",
              "attackSpeed",
            ] as const
          )
            .filter((k) => item[k])
            .map((k) => (
              <div key={k}>
                <b>+{item[k]}</b>
                <span>{k.replace(/([A-Z])/g, " $1")}</span>
              </div>
            ))}
        </div>
        {item.recipe && (
          <div className="recipe">
            <small>BUILDS FROM</small>
            {item.recipe.map((id) => (
              <span key={id}>
                {player.items.includes(id) && <Check />}
                {ITEMS.find((i) => i.id === id)!.name}
              </span>
            ))}
          </div>
        )}
        <button
          className="buy-button"
          disabled={
            !atHome ||
            player.gold < cost ||
            (player.items.length >= 6 &&
              !item.recipe?.some((id) => player.items.includes(id)))
          }
          onClick={buy}
        >
          BUY · {cost} GOLD
        </button>
        <p className="shop-status">
          {atHome
            ? `${Math.floor(player.gold)} gold available`
            : "Return to your fountain to purchase."}
        </p>
        <h4>YOUR EQUIPMENT · SELL 65%</h4>
        {player.items.map((id, i) => (
          <button
            className="sell-row"
            key={`${id}-${i}`}
            onClick={() => sell(i)}
            disabled={!atHome}
          >
            <span>{ITEMS.find((v) => v.id === id)!.name}</span>
            <Coins />
            {Math.floor(ITEMS.find((v) => v.id === id)!.cost * 0.65)}
          </button>
        ))}
      </aside>
    </div>
  );
}
function Scoreboard({ heroes }: { heroes: Snapshot["heroes"] }) {
  return (
    <div className="scoreboard">
      <div className="score-row heading">
        <span>HERO / LEVEL</span>
        <span>K / D / A</span>
        <span>CS</span>
        <span>DAMAGE</span>
        <span>STRUCTURES</span>
        <span>BUILD</span>
      </div>
      {[0, 1].map((team) => (
        <section key={team}>
          <h3 className={`team-${team}`}>{TEAM_NAMES[team]}</h3>
          {heroes
            .filter((h) => h.team === team)
            .map((h) => (
              <div key={h.id} className="score-row">
                <strong>
                  {roleIcon(h.hero!)}
                  {h.name}
                  <small>{h.level}</small>
                </strong>
                <span>
                  {h.kills} / {h.deaths} / {h.assists}
                </span>
                <span>{h.lastHits}</span>
                <span>{Math.round(h.damageDone).toLocaleString()}</span>
                <span>{h.structures}</span>
                <div>
                  {h.items.map((id, i) => (
                    <span
                      className="mini-item"
                      title={ITEMS.find((v) => v.id === id)?.name}
                      key={i}
                    >
                      <ItemIcon item={ITEMS.find((v) => v.id === id)!} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
function SettingsPanel({
  value,
  onChange,
}: {
  value: Settings;
  onChange(v: Settings): void;
}) {
  return (
    <div className="settings-panel">
      {(["sound", "reducedMotion", "damageNumbers", "cameraLock"] as const).map(
        (k) => (
          <label key={k}>
            <span>{k.replace(/([A-Z])/g, " $1")}</span>
            <input
              type="checkbox"
              checked={value[k]}
              onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
            />
          </label>
        ),
      )}
      <label>
        <span>Graphics quality</span>
        <select
          value={value.quality}
          onChange={(e) =>
            onChange({
              ...value,
              quality: e.target.value as Settings["quality"],
            })
          }
        >
          <option>high</option>
          <option>medium</option>
          <option>low</option>
        </select>
      </label>
      <p>
        Reduced motion keeps the camera follow immediate. Low quality removes
        shadow maps and reduces render resolution. Mandatory targeting and
        damage boundaries remain visible.
      </p>
    </div>
  );
}
