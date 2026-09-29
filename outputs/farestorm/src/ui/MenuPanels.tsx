import { useState, type ReactNode } from "react";
import { TAXIS, LESSONS, TRIALS } from "../game/content";
import type { Profile, Settings, TaxiId } from "../game/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  GameController,
  Lightning,
  SpeakerHigh,
  Trophy,
} from "./icons";
import { GaragePreview } from "./GaragePreview";
import { clockTime, money } from "./Hud";

export function Panel({
  title,
  subtitle,
  onBack,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  onBack(): void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`menu-panel ${className}`}>
      <header className="panel-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft weight="bold" /> Back
        </button>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

const colors = [
  { name: "Coral rush", value: "#ef715b" },
  { name: "Sea glass", value: "#19aaa4" },
  { name: "Pacific blue", value: "#4479db" },
  { name: "Cream soda", value: "#f4e6c5" },
  { name: "Guava punch", value: "#d55c98" },
  { name: "Solar flare", value: "#f1ae44" },
];
export function Garage({
  taxi,
  color,
  settings,
  onTaxi,
  onColor,
  onBack,
}: {
  taxi: TaxiId;
  color: string;
  settings: Settings;
  onTaxi(id: TaxiId): void;
  onColor(color: string): void;
  onBack(): void;
}) {
  const definition = TAXIS.find((t) => t.id === taxi)!;
  return (
    <Panel
      title="Your ride. Your rules."
      subtitle="Three storm cabs. Three ways to tear up Galeport."
      onBack={onBack}
      className="garage-panel"
    >
      <div className="garage-layout">
        <div className="garage-display">
          <GaragePreview
            taxi={taxi}
            color={color}
            reducedMotion={settings.reducedMotion}
          />
          <div className="color-swatches">
            <span>Paint</span>
            {colors.map((c) => (
              <button
                title={c.name}
                aria-label={c.name}
                aria-pressed={color === c.value}
                className={color === c.value ? "selected" : ""}
                style={{ backgroundColor: c.value }}
                key={c.value}
                onClick={() => onColor(c.value)}
              >
                {color === c.value && <Check weight="bold" />}
              </button>
            ))}
          </div>
        </div>
        <div className="garage-detail">
          <div className="taxi-tabs" role="tablist" aria-label="Taxi models">
            {TAXIS.map((t) => (
              <button
                role="tab"
                aria-selected={taxi === t.id}
                onClick={() => onTaxi(t.id)}
                key={t.id}
              >
                {t.name.split(" ")[0]}
              </button>
            ))}
          </div>
          <span className="section-label">{definition.tagline}</span>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
          <div className="handling-bars">
            {[
              ["Agility", definition.handling],
              ["Drift", definition.drift],
              ["Acceleration", definition.acceleration],
            ].map(([label, v]) => (
              <div key={label}>
                <span>{label}</span>
                <div>
                  {Array.from({ length: 7 }, (_, i) => (
                    <i
                      key={i}
                      className={
                        i <
                        Math.round(
                          label === "Acceleration" ? Number(v) / 9 * 7 : Number(v) / 100 * 7,
                        )
                          ? "filled"
                          : ""
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="taxi-numbers">
            <div>
              <strong>
                {definition.topSpeed}
                <small> km/h</small>
              </strong>
              <span>Top speed</span>
            </div>
            <div>
              <strong>
                {definition.mass.toLocaleString()}
                <small> kg</small>
              </strong>
              <span>Mass</span>
            </div>
            <div>
              <strong>
                {definition.wheelbase.toFixed(1)}
                <small> m</small>
              </strong>
              <span>Wheelbase</span>
            </div>
          </div>
          <button className="primary-button garage-done" onClick={onBack}>
            Take this ride <ArrowRight weight="bold" />
          </button>
        </div>
      </div>
    </Panel>
  );
}

export function ModeSelect({
  kind,
  profile,
  onBack,
  onSelect,
}: {
  kind: "trial" | "school";
  profile: Profile;
  onBack(): void;
  onSelect(index: number): void;
}) {
  const trial = kind === "trial";
  return (
    <Panel
      title={trial ? "Beat the route." : "Learn the good stuff."}
      subtitle={
        trial
          ? "Six passenger chains. Fixed traffic. Chase the gold."
          : "Ten short lessons to turn a driver into a storm cab legend."
      }
      onBack={onBack}
      className="mode-panel"
    >
      <div className={trial ? "trial-grid" : "lesson-grid"}>
        {trial
          ? TRIALS.map((t, i) => (
              <button
                className="trial-card"
                key={t.name}
                onClick={() => onSelect(i)}
              >
                <div className="trial-heading">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {profile.medals[String(i)] && (
                    <span className="medal-badge">
                      <Trophy weight="fill" /> {profile.medals[String(i)]}
                    </span>
                  )}
                  <ArrowRight />
                </div>
                <h2>{t.name}</h2>
                <p>{t.description}</p>
                <div className="trial-meta">
                  <span>{t.destinations.length} fares</span>
                  <span>
                    <Trophy weight="fill" /> Gold {clockTime(t.gold)}
                  </span>
                </div>
              </button>
            ))
          : LESSONS.map((l, i) => (
              <button
                className="lesson-card"
                key={l.title}
                onClick={() => onSelect(i)}
              >
                <span
                  className={`lesson-number ${profile.lessons.includes(i) ? "done" : ""}`}
                >
                  {profile.lessons.includes(i) ? (
                    <Check weight="bold" />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  <h2>{l.title}</h2>
                  <p>{l.description}</p>
                </div>
                <ArrowRight />
              </button>
            ))}
      </div>
    </Panel>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className="setting-toggle"
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <i className={checked ? "on" : ""}>
        <b />
      </i>
    </button>
  );
}
function Range({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  display: string;
  onChange(value: number): void;
}) {
  return (
    <label className="setting-range">
      <span>
        <strong>{label}</strong>
        <b>{display}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
export function SettingsPanel({
  settings: s,
  onChange,
  onBack,
}: {
  settings: Settings;
  onChange(s: Settings): void;
  onBack(): void;
}) {
  const [tab, setTab] = useState<"drive" | "look" | "sound">("drive");
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...s, [key]: value });
  return (
    <Panel
      title="Make it your ride."
      subtitle="Changes are saved automatically on this device."
      onBack={onBack}
      className="settings-panel"
    >
      <div className="settings-layout">
        <nav className="settings-tabs">
          <button
            aria-current={tab === "drive"}
            onClick={() => setTab("drive")}
          >
            <GameController /> Driving
          </button>
          <button aria-current={tab === "look"} onClick={() => setTab("look")}>
            <Lightning /> Picture & access
          </button>
          <button
            aria-current={tab === "sound"}
            onClick={() => setTab("sound")}
          >
            <SpeakerHigh /> Sound
          </button>
        </nav>
        <div className="settings-content">
          {tab === "drive" && (
            <>
              <Range
                label="Steering sensitivity"
                min={0.5}
                max={1.6}
                step={0.05}
                value={s.sensitivity}
                display={`${s.sensitivity.toFixed(2)}×`}
                onChange={(v) => change("sensitivity", v)}
              />
              <Range
                label="Traffic density (next shift)"
                min={0.4}
                max={1.4}
                step={0.2}
                value={s.traffic}
                display={
                  s.traffic < 0.8
                    ? "Relaxed"
                    : s.traffic > 1.1
                      ? "Busy"
                      : "Normal"
                }
                onChange={(v) => change("traffic", v)}
              />
              <Toggle
                label="Steering assist"
                description="Applies next shift. Helps settle the car after turns and is recorded in your run category."
                checked={s.steeringAssist}
                onChange={(v) => change("steeringAssist", v)}
              />
              <Toggle
                label="Gamepad vibration"
                checked={s.vibration}
                onChange={(v) => change("vibration", v)}
              />
              <label className="setting-select">
                <span>Default camera</span>
                <select
                  value={s.camera}
                  onChange={(e) =>
                    change("camera", Number(e.target.value) as 0 | 1 | 2)
                  }
                >
                  <option value={0}>Chase</option>
                  <option value={1}>Wide chase</option>
                  <option value={2}>Bumper</option>
                </select>
              </label>
              <Controls compact />
            </>
          )}
          {tab === "look" && (
            <>
              <div className="quality-select">
                <span>Graphics quality</span>
                <div>
                  {(["low", "medium", "high"] as const).map((q) => (
                    <button
                      aria-pressed={s.quality === q}
                      key={q}
                      onClick={() => change("quality", q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <small>
                  Lower quality reduces rendering resolution and visual detail.
                </small>
              </div>
              <Toggle
                label="Reduced motion"
                description="Calmer camera and interface transitions."
                checked={s.reducedMotion}
                onChange={(v) => change("reducedMotion", v)}
              />
              <Toggle
                label="Colorblind support"
                description="High contrast HUD with shape and text cues."
                checked={s.colorblind}
                onChange={(v) => change("colorblind", v)}
              />
              <Toggle
                label="Show minimap"
                checked={s.showMinimap}
                onChange={(v) => change("showMinimap", v)}
              />
              <Toggle
                label="Passenger subtitles"
                checked={s.subtitles}
                onChange={(v) => change("subtitles", v)}
              />
            </>
          )}
          {tab === "sound" && (
            <>
              <Toggle
                label="Master sound"
                checked={s.sound}
                onChange={(v) => change("sound", v)}
              />
              <Range
                label="Music"
                value={s.music}
                display={`${Math.round(s.music * 100)}%`}
                onChange={(v) => change("music", v)}
              />
              <Range
                label="Engine & sound effects"
                value={s.effects}
                display={`${Math.round(s.effects * 100)}%`}
                onChange={(v) => change("effects", v)}
              />
              <p className="settings-note">
                Original surf rhythm, engine layers and arcade cues are
                synthesized in your browser. Sound starts when you begin a
                shift.
              </p>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function Controls({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`controls-reference ${compact ? "compact" : ""}`}>
      <h3>Get moving</h3>
      <div>
        {[
          ["W / S", "Throttle / brake & reverse"],
          ["A / D", "Steer"],
          ["SPACE", "Handbrake drift"],
          ["SHIFT", "Tailwind boost"],
          ["E", "Confirm pickup"],
          ["R (hold)", "Recover your cab"],
          ["C", "Cycle camera"],
          ["X", "Look behind"],
          ["M", "City map"],
          ["ESC", "Pause"],
        ].map(([key, label]) => (
          <span key={key}>
            <kbd>{key}</kbd>
            {label}
          </span>
        ))}
      </div>
      <p>
        <GameController /> Gamepad: RT / LT pedals, left stick steer, A drift, B
        boost, Y look behind.
      </p>
      <p>Look around: drag the right mouse button, Q / Z to glance left, V to glance right, X to look behind.</p>
    </div>
  );
}

export function Records({
  profile,
  onBack,
  onClear,
  onReplay,
}: {
  profile: Profile;
  onBack(): void;
  onClear(): void;
  onReplay(): void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Panel
      title="Leave your mark."
      subtitle="Your local records. All scores stay on this device."
      onBack={onBack}
      className="records-panel"
    >
      <div className="record-highlights">
        <div>
          <span>Personal best</span>
          <strong>{money(profile.bestScore)}</strong>
        </div>
        <div>
          <span>Fares delivered</span>
          <strong>{profile.totalDeliveries}</strong>
        </div>
        <div>
          <span>Shortcuts found</span>
          <strong>
            {profile.discovered.length}
            <small> / 18</small>
          </strong>
        </div>
      </div>
      {profile.records.length ? (
        <div className="records-table">
          <div className="record-row record-heading">
            <span>Rank</span>
            <span>Mode / taxi</span>
            <span>Delivered</span>
            <span>Score</span>
          </div>
          {[...profile.records]
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map((r, i) => (
              <div className="record-row" key={r.id}>
                <span>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <em>{r.rank}</em>
                </span>
                <span>
                  <strong>
                    {r.mode === "arcade"
                      ? "Arcade shift"
                      : r.mode === "quick"
                        ? "Quick shift"
                        : r.mode === "trial"
                          ? "Time trial"
                          : "Skill school"}
                  </strong>
                  <small>
                    {TAXIS.find((t) => t.id === r.taxi)?.name} ·{" "}
                    {r.assist ? "Assisted" : "Standard"}
                  </small>
                </span>
                <span>{r.deliveries}</span>
                <strong>{money(r.score)}</strong>
              </div>
            ))}
        </div>
      ) : (
        <div className="empty-records">
          <Trophy size={64} weight="duotone" />
          <h2>A fresh road ahead.</h2>
          <p>Finish your first shift to set the score to beat.</p>
          <button className="primary-button" onClick={onBack}>
            Let's drive <ArrowRight />
          </button>
        </div>
      )}
      <div className="records-actions">
        {profile.ghost && (
          <button className="secondary-button" onClick={onReplay}>
            Watch saved route <ArrowRight />
          </button>
        )}
        {profile.records.length > 0 &&
          (confirm ? (
            <span>
              Clear all local records?{" "}
              <button
                onClick={() => {
                  onClear();
                  setConfirm(false);
                }}
              >
                Clear records
              </button>
              <button onClick={() => setConfirm(false)}>Cancel</button>
            </span>
          ) : (
            <button className="quiet-button" onClick={() => setConfirm(true)}>
              Clear local records
            </button>
          ))}
      </div>
    </Panel>
  );
}

export function Credits({ onBack }: { onBack(): void }) {
  return (
    <Panel title="Made for the ride." onBack={onBack} className="credits-panel">
      <p className="credits-intro">
        An original arcade driving game set in the sunlit streets of Galeport.
      </p>
      <div className="credits-grid">
        <section>
          <h2>Farestorm</h2>
          <p>
            Original city, storm cabs, passengers and route challenges. Inspired
            by the joy of arcade driving.
          </p>
        </section>
        <section>
          <h2>Sound & picture</h2>
          <p>
            Procedural vehicle and city models. Original synthesized soundtrack
            and audio. AI generated menu artwork.
          </p>
        </section>
        <section>
          <h2>Under the hood</h2>
          <p>
            Babylon.js · Rapier · React · TypeScript
            <br />
            Barlow by Jeremy Tribby · Phosphor Icons
          </p>
        </section>
        <section>
          <h2>Keep it local</h2>
          <p>
            No account required. Your settings, records and saved route live in
            this browser.
          </p>
        </section>
      </div>
      <div className="credits-signoff">
        <CheckCircle weight="fill" /> See you at the next fare.
      </div>
    </Panel>
  );
}
