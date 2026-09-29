import { GameSession } from "./session";
import { GameRenderer } from "../render/renderer";
import { GameAudio } from "./audio";
import {
  EMPTY_INPUT,
  type SaveGame,
  type Settings,
  type Snapshot,
  type WeaponId,
} from "./types";
export class Runtime {
  session!: GameSession;
  renderer: GameRenderer;
  audio: GameAudio;
  paused = true;
  menu = true;
  yaw = 0;
  pitch = 0.07;
  private keys = new Set<string>();
  private mouse = new Set<number>();
  private dragging = false;
  private lastMouse = 0;
  private frame = 0;
  private last = 0;
  private publish = 0;
  private stepCount = 0;
  private constructor(
    readonly canvas: HTMLCanvasElement,
    private settings: Settings,
    private emit: (s: Snapshot) => void,
    private open: (panel: string) => void,
  ) {
    this.renderer = new GameRenderer(canvas, settings);
    this.audio = new GameAudio(settings);
  }
  static async create(
    canvas: HTMLCanvasElement,
    settings: Settings,
    emit: (s: Snapshot) => void,
    open: (panel: string) => void,
  ) {
    const runtime = new Runtime(canvas, settings, emit, open);
    runtime.session = await GameSession.create(settings);
    runtime.bind();
    runtime.last = performance.now();
    runtime.frame = requestAnimationFrame(runtime.loop);
    return runtime;
  }
  async start(save?: SaveGame) {
    const next = await GameSession.create(this.settings, save);
    this.session.dispose();
    this.session = next;
    this.renderer.reset();
    this.audio.reset();
    this.menu = false;
    this.paused = false;
    this.yaw = this.session.player.heading;
    this.pitch = 0.07;
    this.keys.clear();
    await this.audio.start();
    this.canvas.focus();
  }
  setPaused(p: boolean) {
    this.paused = p;
    this.keys.clear();
    this.mouse.clear();
    this.audio.pause(p);
    if (!p) this.canvas.focus();
  }
  configure(s: Settings) {
    this.settings = s;
    this.audio.setSettings(s);
    this.renderer.configure(s);
    this.session.configure(s);
  }
  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const p = this.session.player;
    if (!this.paused && !this.menu) {
      let mx =
          Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
          Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")),
        mz =
          Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
          Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
      const gamepad = navigator.getGamepads?.()[0];
      if (gamepad) {
        mx = Math.abs(gamepad.axes[0]) > 0.15 ? gamepad.axes[0] : mx;
        mz = Math.abs(gamepad.axes[1]) > 0.15 ? -gamepad.axes[1] : mz;
        this.yaw += gamepad.axes[2] * dt * 2;
        this.pitch = Math.max(
          -0.35,
          Math.min(0.9, this.pitch + gamepad.axes[3] * dt),
        );
      }
      const seated = p.vehicleId !== undefined,
        aim = this.mouse.has(2);
      if (seated && now - this.lastMouse > 1100) {
        this.yaw +=
          Math.atan2(
            Math.sin(p.heading - this.yaw),
            Math.cos(p.heading - this.yaw),
          ) * Math.min(1, dt * 3);
        this.pitch += (0.23 - this.pitch) * dt * 2;
      }
      this.session.step(
        {
          ...EMPTY_INPUT,
          throttle: Math.max(0, mz),
          brake: Math.max(0, -mz),
          steer: mx,
          handbrake: this.keys.has("Space"),
          moveX: mx * Math.cos(this.yaw) + mz * Math.sin(this.yaw),
          moveZ: mz * Math.cos(this.yaw) - mx * Math.sin(this.yaw),
          aimYaw: this.yaw,
          aimPitch: -this.pitch,
          aim,
          fire: this.mouse.has(0) || !!gamepad?.buttons[7]?.pressed,
          reload: this.keys.has("KeyR"),
          jump: this.keys.has("Space"),
          crouch: this.keys.has("ControlLeft") || this.keys.has("KeyC"),
          sprint: this.keys.has("ShiftLeft"),
          interact: this.keys.has("KeyE") || !!gamepad?.buttons[0]?.pressed,
          exit: this.keys.has("KeyF"),
          melee: this.keys.has("KeyV"),
          heal: this.keys.has("KeyH"),
          gadget: this.keys.has("KeyG"),
          horn: this.keys.has("KeyB"),
        },
        dt,
      );
      this.stepCount++;
    }
    const s = this.session.snapshot();
    s.fps = Math.round(this.renderer.fps());
    this.renderer.update(s, dt, this.yaw, this.pitch, this.menu);
    if (!this.paused) this.audio.update(s, dt);
    this.publish += dt;
    if (this.publish > 0.09) {
      this.emit(s);
      this.publish = 0;
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  private down = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    if (e.code === "Escape") {
      this.open("pause");
      return;
    }
    if (e.code === "Tab" || e.code === "KeyP") {
      this.open("phone");
      return;
    }
    if (e.code === "KeyM") {
      this.open("map");
      return;
    }
    if (e.code === "KeyQ") {
      if (!this.paused) this.session.toggleHolster();
      return;
    }
    if (e.code === "KeyK") {
      this.open("controls");
      return;
    }
    if (this.paused) return;
    if (e.code === "KeyE") {
      const interaction = this.session.snapshot().interaction;
      if (interaction?.kind === "shop") {
        this.open("shop");
        return;
      }
      if (interaction?.kind === "save") this.open("save");
    }
    this.keys.add(e.code);
  };
  private up = (e: KeyboardEvent) => {
    if (
      ["KeyE", "KeyF", "KeyR", "KeyV", "KeyG", "KeyH", "Space"].includes(e.code)
    )
      setTimeout(() => this.keys.delete(e.code), 75);
    else this.keys.delete(e.code);
  };
  private blur = () => {
    this.keys.clear();
    this.mouse.clear();
    if (!this.menu && !this.paused) {
      this.setPaused(true);
      this.open("pause");
    }
  };
  private pointerDown = (e: PointerEvent) => {
    if (this.paused) return;
    e.preventDefault();
    this.canvas.focus();
    this.mouse.add(e.button);
    this.dragging = true;
    this.canvas.setPointerCapture(e.pointerId);
  };
  private pointerUp = (e: PointerEvent) => {
    this.mouse.delete(e.button);
    this.dragging = this.mouse.size > 0;
  };
  private move = (e: PointerEvent) => {
    if (this.paused || !this.dragging) return;
    this.lastMouse = performance.now();
    this.yaw += e.movementX * 0.004 * this.settings.sensitivity;
    this.pitch = Math.max(
      -0.4,
      Math.min(
        0.8,
        this.pitch + e.movementY * 0.003 * this.settings.sensitivity,
      ),
    );
  };
  private context = (e: Event) => e.preventDefault();
  private bind() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    this.canvas.addEventListener("pointerdown", this.pointerDown);
    window.addEventListener("pointerup", this.pointerUp);
    this.canvas.addEventListener("pointermove", this.move);
    this.canvas.addEventListener("contextmenu", this.context);
    if (import.meta.env.DEV)
      Object.assign(window, {
        __meridian: {
          snapshot: () => this.session.snapshot(),
          camera: () => ({ yaw: this.yaw, pitch: this.pitch }),
          status: () => ({
            paused: this.paused,
            menu: this.menu,
            frames: this.stepCount,
          }),
        },
      });
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    window.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("contextmenu", this.context);
    this.renderer.dispose();
    this.session.dispose();
    this.audio.dispose();
  }
}
