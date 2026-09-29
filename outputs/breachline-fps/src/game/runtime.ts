import { BreachRenderer } from "./renderer";
import { CombatAudio } from "./audio";
import {
  MatchSimulation,
  idleInput,
  type Input,
  type Snapshot,
} from "./simulation";
import { type Loadout } from "./data";
export type Settings = {
  sensitivity: number;
  fov: number;
  sound: boolean;
  reducedMotion: boolean;
};
export type Practice = {
  duration: number;
  score: number;
  difficulty: "easy" | "normal" | "hard";
};
declare global {
  interface Window {
    __breachlineDebug?: {
      read(): {
        snapshot: Snapshot | undefined;
        yaw: number;
        pitch: number;
        id: string;
        fps: number;
        drawCalls: number;
      };
    };
  }
}
type Callbacks = {
  state(s: Snapshot, id: string, fps: number): void;
  lock(locked: boolean): void;
  error(message: string): void;
  connected(): void;
  scoreboard(open: boolean): void;
};
export class MatchRuntime {
  private view: BreachRenderer;
  private audio: CombatAudio;
  private sim?: MatchSimulation;
  private socket?: WebSocket;
  private frame = 0;
  private last = performance.now();
  private accumulator = 0;
  private publish = 0;
  private send = 0;
  private active = true;
  private keys = new Set<string>();
  private input = idleInput();
  private yaw = 0;
  private pitch = 0;
  private id = "local";
  private state?: Snapshot;
  private deaths = 0;
  private wasAlive = true;
  private seeded = false;
  private seq = 0;
  constructor(
    host: HTMLElement,
    private mode: "practice" | "online",
    name: string,
    loadout: Loadout,
    private settings: Settings,
    practice: Practice,
    private callbacks: Callbacks,
  ) {
    this.view = new BreachRenderer(host, settings.fov, settings.reducedMotion);
    this.audio = new CombatAudio(settings.sound);
    if (import.meta.env.DEV)
      window.__breachlineDebug = {
        read: () => ({
          snapshot: this.state,
          yaw: this.yaw,
          pitch: this.pitch,
          id: this.id,
          fps: this.view.fps,
          drawCalls: this.view.drawCalls,
        }),
      };
    if (mode === "practice") {
      this.sim = new MatchSimulation(
        Date.now() >>> 0,
        practice.duration,
        practice.score,
        practice.difficulty,
      );
      const p = this.sim.addHuman(this.id, name, loadout);
      this.yaw = p.yaw;
      this.sim.fillBots();
      this.state = this.sim.snapshot();
      callbacks.connected();
      callbacks.state(this.state, this.id, 60);
    } else {
      this.socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/relay`,
      );
      this.socket.onopen = () =>
        this.socket?.send(JSON.stringify({ type: "join", name, loadout }));
      this.socket.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "error") callbacks.error(String(m.message));
          if (m.id) this.id = m.id;
          if (m.snapshot) {
            this.state = m.snapshot;
            callbacks.connected();
          }
        } catch {
          callbacks.error(
            "Received an invalid room snapshot. Return to menu and reconnect.",
          );
        }
      };
      this.socket.onerror = () =>
        callbacks.error(
          "The local relay server is unavailable. Start it with npm run server, or use Practice.",
        );
      this.socket.onclose = () => {
        if (this.active)
          callbacks.error(
            "Connection closed. Your local profile is safe. Rejoin or start Practice.",
          );
      };
    }
    document.addEventListener("pointerlockchange", this.lockChange);
    document.addEventListener("pointerlockerror", this.lockError);
    document.addEventListener("visibilitychange", this.blur);
    window.addEventListener("blur", this.blur);
    window.addEventListener("mousemove", this.mouse);
    window.addEventListener("mousedown", this.mouseDown);
    window.addEventListener("mouseup", this.mouseUp);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    this.view.canvas.addEventListener("contextmenu", this.context);
    this.view.canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.view.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.frame = requestAnimationFrame(this.tick);
  }
  get locked() {
    return document.pointerLockElement === this.view.canvas;
  }
  lock() {
    void this.audio.resume();
    try {
      const result = this.view.canvas.requestPointerLock();
      if (result) void result.catch(() => this.lockError());
    } catch {
      this.lockError();
    }
  }
  pause() {
    if (this.locked) document.exitPointerLock();
    this.clear();
  }
  setLoadout(loadout: Loadout) {
    if (this.sim) this.sim.setLoadout(this.id, loadout);
    else if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "loadout", loadout }));
  }
  private clear = () => {
    this.keys.clear();
    this.input = { ...idleInput(), yaw: this.yaw, pitch: this.pitch };
    this.callbacks.scoreboard(false);
  };
  private lockChange = () => {
    if (!this.locked) this.clear();
    this.callbacks.lock(this.locked);
  };
  private lockError = () =>
    this.callbacks.error(
      "Mouse capture was refused. Click Resume again, or allow pointer lock in this browser.",
    );
  private blur = () => {
    if (document.hidden || !document.hasFocus()) this.pause();
  };
  private mouse = (e: MouseEvent) => {
    if (!this.locked) return;
    this.yaw -= e.movementX * this.settings.sensitivity * 0.0015;
    this.pitch = Math.max(
      -1.3,
      Math.min(
        1.3,
        this.pitch + e.movementY * this.settings.sensitivity * 0.0015,
      ),
    );
  };
  private mouseDown = (e: MouseEvent) => {
    if (!this.locked) return;
    if (e.button === 0) this.input.fire = true;
    if (e.button === 2) this.input.ads = true;
  };
  private mouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.input.fire = false;
    if (e.button === 2) this.input.ads = false;
  };
  private context = (e: Event) => e.preventDefault();
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.callbacks.error(
      "Graphics context lost. Return to menu to rebuild the renderer.",
    );
  };
  private wheel = (e: WheelEvent) => {
    if (this.locked) {
      e.preventDefault();
      this.input.swap = true;
    }
  };
  private keyDown = (e: KeyboardEvent) => {
    if (!this.locked) return;
    if (["Space", "Tab", "ControlLeft", "ControlRight"].includes(e.code))
      e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "Tab") this.callbacks.scoreboard(true);
    if (e.repeat) return;
    const action: Record<string, keyof Input> = {
      KeyR: "reload",
      Space: "jump",
      KeyG: "lethal",
      KeyQ: "tactical",
      Digit4: "support",
      KeyF: "melee",
    };
    if (action[e.code]) Object.assign(this.input, { [action[e.code]]: true });
    if (e.code === "Digit1") this.input.slot = 0;
    if (e.code === "Digit2") this.input.slot = 1;
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "Tab") this.callbacks.scoreboard(false);
  };
  private tick = (now: number) => {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.publish += dt;
    this.send += dt;
    const i = this.input;
    i.x = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    i.z = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    i.yaw = this.yaw;
    i.pitch = this.pitch;
    i.sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    i.crouch = this.keys.has("ControlLeft") || this.keys.has("KeyC");
    if (this.sim && this.locked) {
      this.accumulator += dt;
      this.sim.setInput(this.id, i);
      while (this.accumulator >= 1 / 60) {
        this.sim.step(1 / 60);
        this.accumulator -= 1 / 60;
      }
      this.state = this.sim.snapshot();
      this.clearActions();
    } else if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.send >= 1 / 30
    ) {
      this.send = 0;
      this.socket.send(
        JSON.stringify({
          type: "input",
          input: {
            ...(this.locked
              ? i
              : { ...idleInput(), yaw: this.yaw, pitch: this.pitch }),
            seq: ++this.seq,
          },
        }),
      );
      this.clearActions();
    }
    if (this.state) {
      const p = this.state.players.find((p) => p.id === this.id);
      if (p) {
        if (!this.seeded || (!this.wasAlive && p.alive)) {
          this.yaw = p.yaw;
          this.pitch = p.pitch;
          this.seeded = true;
        }
        this.wasAlive = p.alive;
        this.deaths = p.deaths;
      }
      this.view.render(this.state, this.id, this.yaw, this.pitch, dt);
      this.audio.update(this.state, this.id);
      if (this.publish >= 0.08) {
        this.publish = 0;
        this.callbacks.state(this.state, this.id, this.view.fps);
      }
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  private clearActions() {
    for (const key of [
      "reload",
      "jump",
      "swap",
      "lethal",
      "tactical",
      "support",
      "melee",
    ] as const)
      this.input[key] = false;
    this.input.slot = undefined;
  }
  dispose() {
    this.active = false;
    if (import.meta.env.DEV) delete window.__breachlineDebug;
    cancelAnimationFrame(this.frame);
    this.socket?.close();
    this.audio.dispose();
    document.removeEventListener("pointerlockchange", this.lockChange);
    document.removeEventListener("pointerlockerror", this.lockError);
    document.removeEventListener("visibilitychange", this.blur);
    window.removeEventListener("blur", this.blur);
    window.removeEventListener("mousemove", this.mouse);
    window.removeEventListener("mousedown", this.mouseDown);
    window.removeEventListener("mouseup", this.mouseUp);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    this.view.canvas.removeEventListener("contextmenu", this.context);
    this.view.canvas.removeEventListener("wheel", this.wheel);
    this.view.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.view.dispose();
  }
}
