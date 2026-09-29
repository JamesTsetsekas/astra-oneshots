import {
  ArrowUp,
  FlagCheckered,
  Lightning,
  MapTrifold,
  Pause,
  Wind,
} from "./icons";
import { PASSENGER_ARCHETYPES } from "../game/content";
import type { GameSnapshot, SessionOptions, Settings } from "../game/types";
import { MiniMap } from "./MiniMap";

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const clockTime = (n: number) => {
  const seconds = Math.ceil(Math.max(0, n));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
const modeNames = {
  arcade: "Arcade shift",
  quick: "Quick shift",
  trial: "Time trial",
  school: "Skill school",
};

export function Hud({
  snapshot: s,
  options,
  settings,
  onPause,
  onMap,
}: {
  snapshot: GameSnapshot;
  options: SessionOptions;
  settings: Settings;
  onPause(): void;
  onMap(): void;
}) {
  const fare = s.activeFare;
  const destination = fare?.destination;
  const target =
    s.route.find(
      (p) => Math.hypot(p.x - s.vehicle.x, p.z - s.vehicle.z) > 15,
    ) ?? s.target;
  const bearing = target
    ? Math.atan2(target.x - s.vehicle.x, target.z - s.vehicle.z) -
      s.vehicle.heading
    : 0;
  const distance = destination
    ? Math.hypot(destination.x - s.vehicle.x, destination.z - s.vehicle.z)
    : target
      ? Math.hypot(target.x - s.vehicle.x, target.z - s.vehicle.z)
      : 0;
  const passenger = fare
    ? PASSENGER_ARCHETYPES.find((p) => p.id === fare.passenger.archetype)
    : undefined;
  const events = s.events
    .filter((event) => s.time - event.time < 3.2)
    .slice(-3);
  const receipt =
    s.delivery && s.time - s.delivery.time < 3.8 ? s.delivery : undefined;
  const pulsePercent = Math.max(0, Math.min(100, s.pulse));
  const tailwindPercent = Math.max(0, Math.min(100, s.tailwind));
  return (
    <div className={`hud ${settings.colorblind ? "colorblind" : ""}`}>
      <div className="hud-score">
        <span className="hud-label">Total earned</span>
        <strong>{money(s.score)}</strong>
        <span className="fare-count">
          <FlagCheckered weight="fill" /> {s.deliveries}{" "}
          {s.deliveries === 1 ? "fare" : "fares"} delivered
        </span>
      </div>
      <div className={`hud-clock ${s.shiftRemaining < 15 ? "urgent" : ""}`}>
        <span className="hud-label">{modeNames[options.mode]}</span>
        <strong>{clockTime(s.shiftRemaining)}</strong>
        <div className="clock-dashes">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="hud-place">
        <span>{s.district || "Galeport"}</span>
        <button aria-label="Pause game" onClick={onPause}>
          <Pause size={20} weight="fill" />
        </button>
      </div>
      <div className={`route-guidance ${fare ? "carrying" : ""}`}>
        <div className="route-arrow">
          <ArrowUp
            size={42}
            weight="bold"
            style={{ transform: `rotate(${(bearing * 180) / Math.PI}deg)` }}
          />
        </div>
        <div>
          <span className="hud-label">
            {s.status === "boarding"
              ? "All aboard!"
              : fare
                ? "Take them to"
                : "Pick up a passenger"}
          </span>
          <strong>{destination?.name ?? "Find a fare"}</strong>
          <span className="route-distance">
            {distance > 999
              ? `${(distance / 1000).toFixed(1)} km`
              : `${Math.round(distance)} m`}{" "}
            <span>
              {" "}
              ·{" "}
              {fare
                ? "Stop inside the arrival ring"
                : "Stop inside a colored ring"}
            </span>
          </span>
        </div>
        {fare && (
          <div className="patience">
            <span>{Math.ceil(Math.max(0, fare.remaining))}s</span>
            <div>
              <i
                style={{
                  width: `${Math.max(0, (fare.remaining / fare.par) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
      {s.lesson && (
        <div className="lesson-hud">
          <span className="hud-label">Lesson {s.lesson.index + 1}</span>
          <strong>{s.lesson.title}</strong>
          <p>{s.lesson.description}</p>
          <div className="lesson-track">
            <i
              style={{ width: `${Math.min(100, s.lesson.progress * 100)}%` }}
            />
          </div>
        </div>
      )}
      <div className={`pulse-hud ${s.multiplier > 1 ? "active" : ""}`}>
        <div>
          <Lightning weight="fill" />
          <span>Pulse</span>
          <strong>
            {s.multiplier}
            <small>×</small>
          </strong>
        </div>
        <div className="pulse-track">
          <i style={{ width: `${pulsePercent}%` }} />
        </div>
        <span className="pulse-hint">
          {s.multiplier > 1
            ? "Keep the style flowing"
            : "Drift. Thread traffic. Fly."}
        </span>
      </div>
      <div className="style-events" aria-live="polite">
        {events.map((e) => (
          <div className={`style-event ${e.kind}`} key={e.id}>
            <span>{e.label}</span>
            {e.points > 0 && (
              <strong>+{Math.round(e.points).toLocaleString()}</strong>
            )}
          </div>
        ))}
      </div>
      {receipt && (
        <div className="delivery-receipt" key={receipt.id}>
          <span>Fare delivered</span>
          <strong>{receipt.grade}!</strong>
          <div>
            <b>{money(receipt.total)}</b>
            <em>+{receipt.timeBonus}s</em>
          </div>
          <p>{receipt.destination}</p>
        </div>
      )}
      <div className="hud-bottom-left">
        {settings.showMinimap && (
          <button
            className="map-button"
            aria-label="Open city map"
            onClick={onMap}
          >
            <MiniMap snapshot={s} />
            <span>
              <MapTrifold size={14} /> Galeport <kbd>M</kbd>
            </span>
          </button>
        )}
        <div className="ride-status">
          {fare ? (
            <>
              <span
                className="passenger-dot"
                style={{ backgroundColor: passenger?.color }}
              />
              <span>
                {passenger?.name ?? "Passenger"}
                <small>{passenger?.role ?? "On board"}</small>
              </span>
            </>
          ) : (
            <>
              <span className="available-light" />
              <span>
                FOR HIRE<small>Find your next fare</small>
              </span>
            </>
          )}
        </div>
      </div>
      <div className="drive-hints">
        <span>
          <kbd>W A S D</kbd> Drive
        </span>
        <span>
          <kbd>SPACE</kbd> Drift
        </span>
        <span>
          <kbd>SHIFT</kbd> Tailwind
        </span>
        <span>
          <kbd>C</kbd> Camera
        </span>
      </div>
      <div className="hud-speed">
        <div className="speed-readout">
          <strong>{Math.round(Math.abs(s.vehicle.speedKmh))}</strong>
          <span>
            km/h<small>{s.vehicle.speed < -1 ? "R" : "D"}</small>
          </span>
        </div>
        <div className={`tailwind ${tailwindPercent >= 25 ? "ready" : ""}`}>
          <div>
            <Wind weight="bold" />
            <strong>Tailwind</strong>
            <kbd>SHIFT</kbd>
          </div>
          <div className="tailwind-track">
            <i style={{ width: `${tailwindPercent}%` }} />
          </div>
          <span>
            {s.vehicle.boost
              ? "RIDE THE WIND"
              : tailwindPercent >= 25
                ? "Ready to fly"
                : "Build charge with style"}
          </span>
        </div>
      </div>
      {settings.subtitles && fare?.line && (
        <div className="passenger-subtitle">
          <span>{passenger?.name ?? "Passenger"}</span> “{fare.line}”
        </div>
      )}
      {s.countdown > 0 && (
        <div className="start-countdown">
          <strong key={Math.ceil(s.countdown)}>
            {s.countdown > 0.7 ? Math.ceil(s.countdown) : "GO!"}
          </strong>
          <span>Make every second count.</span>
        </div>
      )}
    </div>
  );
}
