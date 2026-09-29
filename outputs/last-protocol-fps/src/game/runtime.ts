import { ProtocolRenderer } from "./renderer";
import { CombatAudio } from "./audio";
import {
  ProtocolMatch,
  idleInput,
  type Input,
  type Snapshot,
} from "./simulation";
import type { Purchase, Utility } from "./data";
export type Settings = {
  sensitivity: number;
  fov: number;
  sound: boolean;
  reducedMotion: boolean;
  reducedFlash: boolean;
  crosshair: string;
};
export type Options = {
  mode: "standard" | "quick";
  difficulty: "easy" | "normal" | "hard";
  name: string;
};
type Callbacks = {
  state(s: Snapshot, fps: number, spectating?: string): void;
  lock(value: boolean): void;
  buy(value: boolean): void;
  map(value: boolean): void;
  score(value: boolean): void;
  error(message: string): void;
};
declare global {
  interface Window {
    __protocolDebug?: {
      read(): {
        snapshot: Snapshot;
        yaw: number;
        pitch: number;
        fps: number;
        drawCalls: number;
      };
    };
  }
}
export class ProtocolRuntime {
  readonly match: ProtocolMatch;
  private view: ProtocolRenderer;
  private audio: CombatAudio;
  private frame = 0;
  private last = performance.now();
  private elapsed = 0;
  private publish = 0;
  private active = true;
  private keys = new Set<string>();
  private input = idleInput();
  private yaw = 0;
  private pitch = 0;
  private lastRound = 1;
  private buyOpen = false;
  private spectate = 0;
  private state: Snapshot;
  constructor(
    host: HTMLElement,
    options: Options,
    private settings: Settings,
    private cb: Callbacks,
  ) {
    this.view = new ProtocolRenderer(
      host,
      settings.fov,
      settings.reducedMotion,
    );
    this.audio = new CombatAudio(settings.sound);
    this.match = new ProtocolMatch(
      Date.now() >>> 0,
      options.mode,
      options.difficulty,
    );
    const p = this.match.addHuman(options.name);
    this.yaw = p.yaw;
    this.state = this.match.snapshot();
    cb.state(this.state, 60);
    if (import.meta.env.DEV)
      window.__protocolDebug = {
        read: () => ({
          snapshot: this.match.snapshot(),
          yaw: this.yaw,
          pitch: this.pitch,
          fps: this.view.fps,
          drawCalls: this.view.drawCalls,
        }),
      };
    document.addEventListener("pointerlockchange", this.lockChange);
    document.addEventListener("pointerlockerror", this.lockError);
    document.addEventListener("visibilitychange", this.blur);
    window.addEventListener("blur", this.blur);
    window.addEventListener("mousemove", this.mouse);
    window.addEventListener("mousedown", this.down);
    window.addEventListener("mouseup", this.up);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    this.view.canvas.addEventListener("contextmenu", this.context);
    this.view.canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.frame = requestAnimationFrame(this.tick);
  }
  get locked() {
    return document.pointerLockElement === this.view.canvas;
  }
  lock() {
    this.buyOpen = false;
    this.cb.buy(false);
    void this.audio.resume();
    try {
      const r = this.view.canvas.requestPointerLock();
      if (r) void r.catch(this.lockError);
    } catch {
      this.lockError();
    }
  }
  pause() {
    this.buyOpen = false;
    this.cb.buy(false);
    if (this.locked) document.exitPointerLock();
    this.clear();
  }
  openBuy() {
    if (this.match.phase !== "buy") return;
    this.buyOpen = true;
    document.exitPointerLock();
    this.clear();
    this.cb.buy(true);
  }
  purchase(item: Purchase) {
    const result = this.match.buy("local", item, crypto.randomUUID());
    this.state = this.match.snapshot();
    this.cb.state(this.state, this.view.fps);
    return result;
  }
  refund() {
    const result = this.match.refund("local");
    this.cb.state(this.match.snapshot(), this.view.fps);
    return result;
  }
  dropPrimary() {
    const result = this.match.dropPrimary("local");
    this.cb.state(this.match.snapshot(), this.view.fps);
    return result;
  }
  throw(item: Utility) {
    this.input.throw = item;
  }
  private clear = () => {
    this.keys.clear();
    this.input = { ...idleInput(), yaw: this.yaw, pitch: this.pitch };
    this.cb.map(false);
    this.cb.score(false);
  };
  private lockChange = () => {
    if (!this.locked) this.clear();
    this.cb.lock(this.locked);
  };
  private lockError = () =>
    this.cb.error(
      "Pointer lock was refused. Click Resume again or allow mouse capture in this browser.",
    );
  private blur = () => {
    if (document.hidden || !document.hasFocus()) this.pause();
  };
  private mouse = (e: MouseEvent) => {
    if (
      !this.locked ||
      !this.match.players.find((p) => p.id === "local")?.alive
    )
      return;
    this.yaw -= e.movementX * this.settings.sensitivity * 0.0015;
    this.pitch = Math.max(
      -1.3,
      Math.min(
        1.3,
        this.pitch + e.movementY * this.settings.sensitivity * 0.0015,
      ),
    );
  };
  private down = (e: MouseEvent) => {
    if (!this.locked) return;
    const p = this.match.players.find((p) => p.id === "local");
    if (!p?.alive && e.button === 0) {
      this.spectate++;
      return;
    }
    if (e.button === 0) this.input.fire = true;
    if (e.button === 2) this.input.ads = true;
  };
  private up = (e: MouseEvent) => {
    if (e.button === 0) this.input.fire = false;
    if (e.button === 2) this.input.ads = false;
  };
  private context = (e: Event) => e.preventDefault();
  private wheel = (e: WheelEvent) => {
    if (this.locked) {
      e.preventDefault();
      this.input.swap = true;
    }
  };
  private keyDown = (e: KeyboardEvent) => {
    if (e.code === "Escape" && this.buyOpen) {
      this.pause();
      return;
    }
    if (!this.locked) return;
    if (["Space", "Tab", "ControlLeft"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "Tab") this.cb.score(true);
    if (e.code === "KeyM") this.cb.map(true);
    if (e.repeat) return;
    if (e.code === "KeyB") {
      this.openBuy();
      return;
    }
    if (e.code === "KeyR") this.input.reload = true;
    if (e.code === "Space") this.input.jump = true;
    if (e.code === "KeyQ") this.input.swap = true;
    if (e.code === "KeyG") this.input.drop = true;
    if (e.code === "Digit1") this.input.slot = 0;
    if (e.code === "Digit2") this.input.slot = 1;
    const utility: Record<string, Utility> = {
      Digit4: "veil",
      Digit5: "flash",
      Digit6: "thermite",
      Digit7: "pulse",
      Digit8: "frag",
    };
    if (utility[e.code]) this.input.throw = utility[e.code];
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "Tab") this.cb.score(false);
    if (e.code === "KeyM") this.cb.map(false);
  };
  private tick = (now: number) => {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.publish += dt;
    const i = this.input;
    i.x = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    i.z = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    i.walk = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    i.crouch = this.keys.has("ControlLeft") || this.keys.has("KeyC");
    i.interact = this.keys.has("KeyE");
    i.yaw = this.yaw;
    i.pitch = this.pitch;
    if (this.locked || (this.buyOpen && this.match.phase === "buy")) {
      this.elapsed += dt;
      this.match.setInput(
        "local",
        this.locked ? i : { ...idleInput(), yaw: this.yaw, pitch: this.pitch },
      );
      while (this.elapsed >= 1 / 64) {
        this.match.step(1 / 64);
        this.elapsed -= 1 / 64;
      }
      this.clearActions();
      this.state = this.match.snapshot();
    }
    if (this.state.round !== this.lastRound) {
      this.lastRound = this.state.round;
      const p = this.state.players.find((p) => p.id === "local")!;
      this.yaw = p.yaw;
      this.pitch = 0;
      this.clear();
    }
    if (this.buyOpen && this.state.phase !== "buy") {
      this.buyOpen = false;
      this.cb.buy(false);
    }
    const me = this.state.players.find((p) => p.id === "local")!,
      allies = this.state.players.filter((p) => p.team === me.team && p.alive),
      camera = me.alive
        ? me
        : (allies[this.spectate % Math.max(1, allies.length)] ?? me);
    this.view.render(
      this.state,
      camera.id,
      camera === me ? this.yaw : camera.yaw,
      camera === me ? this.pitch : camera.pitch,
      dt,
    );
    this.audio.update(this.state, "local");
    if (this.publish >= 0.08) {
      this.publish = 0;
      this.cb.state(
        this.state,
        this.view.fps,
        me.alive ? undefined : camera.name,
      );
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  private clearActions() {
    this.input.reload =
      this.input.jump =
      this.input.swap =
      this.input.drop =
        false;
    this.input.slot = undefined;
    this.input.throw = undefined;
  }
  dispose() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    if (import.meta.env.DEV) delete window.__protocolDebug;
    this.audio.dispose();
    document.removeEventListener("pointerlockchange", this.lockChange);
    document.removeEventListener("pointerlockerror", this.lockError);
    document.removeEventListener("visibilitychange", this.blur);
    window.removeEventListener("blur", this.blur);
    window.removeEventListener("mousemove", this.mouse);
    window.removeEventListener("mousedown", this.down);
    window.removeEventListener("mouseup", this.up);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    this.view.canvas.removeEventListener("contextmenu", this.context);
    this.view.canvas.removeEventListener("wheel", this.wheel);
    this.view.dispose();
  }
}
