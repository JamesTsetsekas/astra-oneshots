import { Crosshair } from "@phosphor-icons/react/dist/csr/Crosshair";
import { Shield } from "@phosphor-icons/react/dist/csr/Shield";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { Wind } from "@phosphor-icons/react/dist/csr/Wind";
import { ITEMS, isWeapon, itemName, RARITIES, WEAPONS } from "../game/content";
import type { Item, Snapshot } from "../game/types";
import { TacticalMap } from "./Map";
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function EquipmentIcon({ item }: { item: Item | null }) {
  if (!item) return <span className="empty-icon">—</span>;
  return isWeapon(item.id) ? (
    <svg viewBox="0 0 110 50" aria-hidden="true">
      <path
        d="M13 17h19l8-5h31v6h24v5H73v5H54l-5 14H38l4-14H26l-7 7H8V23Z"
        fill="currentColor"
      />
      <path d="M47 14V9h15v5M62 28l-2 11h9l4-11" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 110 50" aria-hidden="true">
      <path d="M43 6h24v9l6 5v22H37V20l6-5Z" fill="currentColor" />
      <path d="M52 21h7v5h6v6h-6v6h-7v-6h-6v-6h6Z" fill="#233e41" />
    </svg>
  );
}
export function Hud({
  snapshot: s,
  mode,
  onPause,
  onMap,
  onInventory,
}: {
  snapshot: Snapshot;
  mode: "solo" | "practice";
  onPause: () => void;
  onMap: () => void;
  onInventory: () => void;
}) {
  const p = s.player,
    item = p.inventory[p.slot],
    weapon = item && isWeapon(item.id) ? WEAPONS[item.id] : null;
  const heading = (180 - (p.yaw * 180) / Math.PI + 3600) % 360;
  return (
    <div className="hud">
      <div className="top-left">
        <span className="eyebrow">
          THE HIGHWAKE / {mode === "practice" ? "PRACTICE" : "LOCAL SOLO"}
        </span>
        <h2>{s.location}</h2>
        <div className="match-count">
          <Users size={16} />
          <strong>{s.alive}</strong>{" "}
          {mode === "practice" ? "training targets + you" : "remaining"}
          <span> / </span>
          <Crosshair size={16} />
          <strong>{p.kills}</strong>
        </div>
      </div>
      <div className="compass">
        <span>W</span>
        <span>NW</span>
        <b>{Math.round(heading).toString().padStart(3, "0")}°</b>
        <span>NE</span>
        <span>E</span>
        <i />
      </div>
      <div className="map-corner">
        <button
          onClick={onMap}
          className="mini-map"
          aria-label="Open tactical map"
        >
          <TacticalMap snapshot={s} />
          <span>M · TACTICAL MAP</span>
        </button>
        <div className={"storm-status " + (s.outside ? "warning" : "")}>
          <Wind size={18} />
          <span>
            {mode === "practice"
              ? "CALMFIELD STABLE"
              : s.storm.moving
                ? "CALMFIELD CLOSING"
                : "NEXT CALMFIELD"}
          </span>
          <strong>
            {mode === "practice" ? "∞" : clock(s.storm.remaining)}
          </strong>
        </div>
      </div>
      <div className="kill-feed">
        {s.events
          .filter((e) => e.type === "kill")
          .slice(-3)
          .map((e) => (
            <p key={e.id}>{e.text}</p>
          ))}
      </div>
      <div
        className={"reticle " + (s.hitMarker > 0 ? "hit" : "")}
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
        <i />
        {s.hitMarker > 0 && <b>×</b>}
      </div>
      {s.phase === "staging" && (
        <div className="phase-banner">
          <span className="eyebrow">
            DEPARTURE IN {Math.ceil(s.stageTime)}s
          </span>
          <h2>Your next story starts below.</h2>
          <p>
            Explore the staging meadow, or press <kbd>E</kbd> to board the
            transit skiff.
          </p>
        </div>
      )}
      {s.phase === "skiff" && (
        <div className="phase-banner">
          <span className="eyebrow">
            TRANSIT SKIFF · {Math.ceil(s.stageTime)}s
          </span>
          <h2>Pick a place. Make your move.</h2>
          <p>
            <kbd>Space</kbd> Jump <span> / </span>
            <kbd>M</kbd> Mark landing
          </p>
        </div>
      )}
      {s.phase === "dropping" && (
        <div className="drop-banner">
          <Wind size={25} />
          <b>{p.stance === "glide" ? "WING-SAIL DEPLOYED" : "FREEFALL"}</b>
          <span>
            <kbd>WASD</kbd> Steer · <kbd>Z</kbd> Wing-sail
          </span>
        </div>
      )}
      {!p.alive && s.phase !== "ended" && (
        <div className="phase-banner eliminated">
          <span className="eyebrow">ELIMINATED · SPECTATING LOCAL RIVALS</span>
          <h2>Your story isn’t their ending.</h2>
          <p>
            The match continues to one survivor. <kbd>Esc</kbd> for results or
            return to lobby.
          </p>
        </div>
      )}
      {s.nearby && s.phase === "playing" && p.alive && (
        <div
          className="interact"
          style={{ borderColor: RARITIES[s.nearby.rarity ?? 0].color }}
        >
          <kbd>E</kbd>
          <div>
            <strong>{s.nearby.label}</strong>
            <span>{s.nearby.detail}</span>
          </div>
        </div>
      )}
      {(p.reload > 0 || p.action > 0) && (
        <div className="action-progress">
          <span>
            {p.reload > 0
              ? "RELOADING"
              : p.actionItem
                ? itemName(p.actionItem).toUpperCase()
                : "USING ITEM"}
          </span>
          <strong>{(p.reload || p.action).toFixed(1)}s</strong>
        </div>
      )}
      {s.outside && mode === "solo" && s.phase === "playing" && p.alive && (
        <div className="storm-warning">
          <Wind size={19} /> IN THE RIFTSTORM · MOVE TO THE CALMFIELD
        </div>
      )}
      <div className="survival">
        <div className="player-id">
          <span className="player-diamond">01</span>
          <div>
            <b>YOU</b>
            <small>
              {p.stance === "glide"
                ? "Wing-sail"
                : p.stance === "slide"
                  ? "Sliding"
                  : p.stance === "crouch"
                    ? "Crouched"
                    : mode === "practice"
                      ? "Training flight"
                      : "Independent scavenger"}
            </small>
          </div>
        </div>
        <div className="bar-row aegis">
          <Shield size={15} />
          <div className="bar">
            <i style={{ width: `${p.aegis * 2}%` }} />
          </div>
          <b>{Math.ceil(p.aegis)}</b>
          <small>AEGIS</small>
        </div>
        <div className="bar-row reserve">
          <span>◇</span>
          <div className="bar">
            <i style={{ width: `${p.reserve * 2}%` }} />
          </div>
          <b>{Math.ceil(p.reserve)}</b>
          <small>RESERVE</small>
        </div>
        <div className="bar-row health">
          <span>+</span>
          <div className="bar">
            <i style={{ width: `${p.hp}%` }} />
          </div>
          <b>{Math.ceil(p.hp)}</b>
          <small>HEALTH</small>
        </div>
        <div className="stamina">
          <i style={{ width: `${p.stamina * 20}%` }} />
        </div>
        <small className="recharge">
          Aegis recharges after 8s without damage
        </small>
      </div>
      <div className="loadout">
        <div className="ammo-readout">
          {weapon && item ? (
            <>
              <span>{weapon.name}</span>
              <b>
                {item.loaded.toString().padStart(2, "0")}
                <small> / {p.ammo[weapon.ammo]}</small>
              </b>
              <em>{weapon.ammo.toUpperCase()} AMMO</em>
            </>
          ) : (
            <>
              <span>{item ? itemName(item.id) : "Windblade"}</span>
              <b>{item ? "×" + item.quantity : "∞"}</b>
              <em>
                {item && !isWeapon(item.id)
                  ? ITEMS[item.id].description
                  : "F · MELEE / FIND YOUR FIRST WEAPON"}
              </em>
            </>
          )}
        </div>
        <button
          className="inventory-strip"
          onClick={onInventory}
          aria-label="Open inventory"
        >
          {p.inventory.map((slot, i) => (
            <span
              key={i}
              className={"slot " + (i === p.slot ? "active" : "")}
              style={
                {
                  "--rarity": RARITIES[slot?.rarity ?? 0].color,
                } as React.CSSProperties
              }
            >
              <kbd>{i + 1}</kbd>
              <EquipmentIcon item={slot} />
              <small>{slot ? RARITIES[slot.rarity].shape : "EMPTY"}</small>
              {slot && !isWeapon(slot.id) && <b>×{slot.quantity}</b>}
            </span>
          ))}
        </button>
        <span className="loadout-help">
          LMB fire / use · RMB aim · R reload · Tab inventory
        </span>
      </div>
      <div className="hud-bottom">
        <button onClick={onPause}>Esc · Menu & controls</button>
        <span>
          {mode === "practice"
            ? "Practice · Storm disabled"
            : `23 local bots · ${clock(s.time)}`}
        </span>
        <span>{Math.round(s.fps)} FPS</span>
      </div>
      <div className="field-notices">
        {s.events
          .filter((e) =>
            ["pickup", "heal", "info", "storm", "land"].includes(e.type),
          )
          .slice(-2)
          .map((e) => (
            <p key={e.id}>{e.text}</p>
          ))}
      </div>
      {s.damageFlash > 0 && <div className="damage-vignette" />}
    </div>
  );
}
