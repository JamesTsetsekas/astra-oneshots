import { GameSession } from "./session";
import { GameAudio } from "./audio";
import { GameRenderer } from "../render/renderer";
import { loadProfile } from "./persistence";
import {
  EMPTY_INPUT,
  type GameSnapshot,
  type InputFrame,
  type Replay,
  type SessionOptions,
  type Settings,
} from "./types";
type Callbacks = {
  onSnapshot(snapshot: GameSnapshot): void;
  onReady(): void;
  onError(message: string): void;
};
const drivingKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyE",
  "KeyX",
  "KeyR",
  "KeyH",
  "KeyQ",
  "KeyZ",
  "KeyV",
]);
export class GameRuntime {
  private session?: GameSession;
  private renderer?: GameRenderer;
  private audio: GameAudio;
  private keys = new Set<string>();
  private settings: Settings;
  private input: InputFrame = { ...EMPTY_INPUT };
  private disposed = false;
  private paused = false;
  private last = 0;
  private accumulator = 0;
  private lastPublish = 0;
  private forceReset = 0;
  private lastHorn = false;
  private padButtons: boolean[] = [];
  private fps = 60;
  private latest?: GameSnapshot;
  private dragging = false;
  private mouseLook = 0;
  private mouseLast = 0;
  private mouseUntil = 0;
  private lastCollisions = 0;
  private lastBoost = false;
  constructor(
    private host: HTMLElement,
    private options: SessionOptions,
    settings: Settings,
    private callbacks: Callbacks,
  ) {
    this.settings = { ...settings };
    this.audio = new GameAudio(settings);
  }
  async initialize(): Promise<void> {
    try {
      void this.audio.resume();
      this.session = await GameSession.create(this.options);
      if (this.disposed) {
        this.session.dispose();
        return;
      }
      this.renderer = new GameRenderer(this.host, this.options, this.settings);
      this.renderer.canvas.addEventListener("pointerdown", this.pointerdown);
      this.renderer.canvas.addEventListener("contextmenu", this.contextmenu);
      this.renderer.canvas.addEventListener(
        "webglcontextlost",
        this.contextlost,
      );
      window.addEventListener("pointermove", this.pointermove);
      window.addEventListener("pointerup", this.pointerup);
      window.addEventListener("keydown", this.keydown);
      window.addEventListener("keyup", this.keyup);
      window.addEventListener("blur", this.clearKeys);
      document.addEventListener("visibilitychange", this.visibility);
      if (this.options.mode === "trial")
        void loadProfile().then((p) => {
          if (
            !this.disposed &&
            p.ghost?.options.mode === "trial" &&
            p.ghost.options.trial === this.options.trial
          )
            this.renderer?.setGhost(p.ghost);
        });
      this.latest = this.session.snapshot();
      this.callbacks.onSnapshot(this.latest);
      this.callbacks.onReady();
      this.last = performance.now();
      if (import.meta.env.DEV)
        (window as unknown as Record<string, unknown>).__FARESTORM__ = {
          snapshot: () => this.latest,
          metrics: () => ({
            fps: this.fps,
            meshes: this.renderer?.scene.meshes.length,
            activeMeshes: this.renderer?.scene.getActiveMeshes().length,
            drawCalls: this.renderer?.engine._drawCalls.current,
          }),
          options: this.options,
        };
      this.renderer.engine.runRenderLoop(this.frame);
    } catch (error) {
      if (!this.disposed)
        this.callbacks.onError(
          error instanceof Error
            ? error.message
            : "The driving engine could not start. Try another browser or lower graphics quality.",
        );
    }
  }
  private keydown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.matches("input,select,textarea")
    )
      return;
    if (drivingKeys.has(e.code)) {
      e.preventDefault();
      this.keys.add(e.code);
    }
    if (!this.paused) void this.audio.resume();
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private clearKeys = () => {
    this.keys.clear();
  };
  private contextmenu = (e: Event) => e.preventDefault();
  private contextlost = (e: Event) => {
    e.preventDefault();
    this.setPaused(true);
    this.callbacks.onError(
      "The graphics context was interrupted. Your saved runs are safe. Choose Try again to reload the city.",
    );
  };
  private pointerdown = (e: PointerEvent) => {
    if (e.button !== 2) return;
    this.dragging = true;
    this.mouseLast = e.clientX;
    this.mouseUntil = performance.now() + 800;
  };
  private pointermove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.mouseLook = Math.max(
      -1,
      Math.min(1, this.mouseLook + (e.clientX - this.mouseLast) * 0.004),
    );
    this.mouseLast = e.clientX;
    this.mouseUntil = performance.now() + 800;
  };
  private pointerup = () => {
    this.dragging = false;
  };
  private visibility = () => {
    if (document.hidden) {
      this.clearKeys();
      this.setPaused(true);
    }
  };
  private readInput(dt: number): InputFrame {
    const held = (...keys: string[]) => keys.some((k) => this.keys.has(k));
    let throttle = held("KeyW", "ArrowUp") ? 1 : 0,
      brake = held("KeyS", "ArrowDown") ? 1 : 0,
      steer =
        (held("KeyD", "ArrowRight") ? 1 : 0) -
        (held("KeyA", "ArrowLeft") ? 1 : 0);
    if (!this.dragging && performance.now() > this.mouseUntil)
      this.mouseLook *= Math.exp(-dt * 5);
    let handbrake = held("Space"),
      boost = held("ShiftLeft", "ShiftRight"),
      interact = held("KeyE"),
      reset = held("KeyR") || this.forceReset > 0,
      lookX =
        (held("KeyV") ? 0.6 : 0) -
        (held("KeyQ", "KeyZ") ? 0.6 : 0) +
        this.mouseLook,
      lookBack = held("KeyX"),
      horn = held("KeyH");
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (pad) {
      const button = (i: number) => pad.buttons[i]?.pressed ?? false,
        axis = (i: number) =>
          Math.abs(pad.axes[i] ?? 0) > 0.14 ? pad.axes[i] : 0;
      throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0);
      brake = Math.max(brake, pad.buttons[6]?.value ?? 0);
      if (Math.abs(axis(0)) > 0.1) steer = axis(0);
      handbrake ||= button(0);
      boost ||= button(1);
      interact ||= button(2);
      reset ||= button(8);
      if (Math.abs(axis(2)) > 0.1) lookX = axis(2);
      horn ||= button(12);
      lookBack ||= button(3) || button(11);
      if (button(15) && !this.padButtons[15]) this.cycleCamera();
      if (button(14) && !this.padButtons[14])
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "m", code: "KeyM" }),
        );
      if (button(9) && !this.padButtons[9])
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }),
        );
      this.padButtons = pad.buttons.map((b) => b.pressed);
    } else this.padButtons = [];
    this.forceReset = Math.max(0, this.forceReset - dt);
    return {
      throttle,
      brake,
      steer: Math.max(-1, Math.min(1, steer * this.settings.sensitivity)),
      handbrake,
      boost,
      interact,
      reset,
      lookX,
      lookBack,
      horn,
    };
  }
  private frame = () => {
    if (this.disposed || !this.session || !this.renderer) return;
    const now = performance.now(),
      raw = (now - this.last) / 1000,
      dt = Math.min(0.1, Math.max(0, raw));
    this.last = now;
    this.fps += (1 / Math.max(0.001, raw) - this.fps) * 0.04;
    this.input = this.readInput(dt);
    if (!this.paused && this.latest?.status !== "finished") {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= 1 / 60 && steps < 6) {
        this.session.step(this.input, 1 / 60);
        this.accumulator -= 1 / 60;
        steps++;
      }
      this.latest = this.session.snapshot();
      this.latest.fps = Math.round(this.fps);
      this.audio.update(this.latest, dt);
      if (this.input.horn && !this.lastHorn) this.audio.horn();
      this.lastHorn = this.input.horn;
      if (
        this.settings.vibration &&
        (this.latest.collisions > this.lastCollisions ||
          (this.latest.vehicle.boost && !this.lastBoost))
      ) {
        const actuator = navigator
          .getGamepads?.()
          .find((p) => p?.connected)?.vibrationActuator;
        void actuator
          ?.playEffect("dual-rumble", {
            startDelay: 0,
            duration: this.latest.collisions > this.lastCollisions ? 140 : 70,
            weakMagnitude: 0.28,
            strongMagnitude:
              this.latest.collisions > this.lastCollisions ? 0.55 : 0.12,
          })
          .catch(() => {});
      }
      this.lastCollisions = this.latest.collisions;
      this.lastBoost = this.latest.vehicle.boost;
      if (this.latest.status === "finished")
        setTimeout(() => {
          if (!this.disposed) void this.audio.pause();
        }, 750);
    } else this.accumulator = 0;
    if (this.latest) {
      this.renderer.render(
        this.latest,
        this.paused ? EMPTY_INPUT : this.input,
        this.paused ? 0 : dt,
      );
      if (now - this.lastPublish > 90 || this.latest.status === "finished") {
        this.lastPublish = now;
        this.callbacks.onSnapshot(this.latest);
      }
    }
  };
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.keys.clear();
    this.accumulator = 0;
    this.last = performance.now();
    if (paused) void this.audio.pause();
    else void this.audio.resume();
  }
  setSettings(settings: Settings): void {
    this.settings = { ...settings };
    this.renderer?.setSettings(settings);
    this.audio.setSettings(settings);
  }
  cycleCamera(): void {
    this.settings.camera = ((this.settings.camera + 1) % 3) as 0 | 1 | 2;
    this.renderer?.setSettings(this.settings);
  }
  reset(): void {
    this.forceReset = 1.7;
  }
  finish(): void {
    if (!this.session) return;
    this.session.finish();
    this.latest = this.session.snapshot();
    this.callbacks.onSnapshot(this.latest);
    void this.audio.pause();
  }
  getReplay(): Replay | undefined {
    return this.session?.replay();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.clearKeys);
    window.removeEventListener("pointermove", this.pointermove);
    window.removeEventListener("pointerup", this.pointerup);
    document.removeEventListener("visibilitychange", this.visibility);
    this.renderer?.engine.stopRenderLoop(this.frame);
    this.renderer?.dispose();
    this.session?.dispose();
    this.audio.dispose();
    if (import.meta.env.DEV)
      delete (window as unknown as Record<string, unknown>).__FARESTORM__;
  }
}
