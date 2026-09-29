import { Session } from "./session";
import { GameView } from "../render/game-view";
import { GameAudio } from "./audio";
import {
  EMPTY_INPUT,
  type Options,
  type Settings,
  type Snapshot,
} from "./types";
import { saveResult } from "./storage";
export type Overlay = "none" | "pause" | "map" | "inventory";
export class Runtime {
  session: Session;
  view: GameView;
  private audio: GameAudio;
  private keys = new Set<string>();
  private fire = false;
  private ads = false;
  private yaw = Math.PI;
  private pitch = 0.07;
  private overlay: Overlay = "none";
  private frame = 0;
  private running = true;
  private last = 0;
  private uiTime = 0;
  private eventId = 0;
  private resultSaved = false;
  private lastPhase = "";
  private mouseHeld = false;
  private cleanup: Array<() => void> = [];
  private shoulderPending = false;
  static async create(
    canvas: HTMLCanvasElement,
    options: Options,
    settings: Settings,
    onSnapshot: (s: Snapshot) => void,
    onOverlay: (o: Overlay) => void,
  ) {
    const session = await Session.create(options);
    let runtime: Runtime | undefined;
    try {
      runtime = new Runtime(canvas, session, settings, onSnapshot, onOverlay);
      // Probe the rendering/camera path before reporting ready. Missing engine
      // registrations must reject startup, not leave a silent frozen HUD.
      runtime.view.aim();
      runtime.view.update(0, { ...EMPTY_INPUT, yaw: session.player.yaw, pitch: .07 });
      return runtime;
    } catch (error) {
      if (runtime) runtime.dispose();
      else session.dispose();
      throw error;
    }
  }
  private constructor(
    private canvas: HTMLCanvasElement,
    session: Session,
    public settings: Settings,
    private onSnapshot: (s: Snapshot) => void,
    private onOverlay: (o: Overlay) => void,
  ) {
    this.session = session;
    this.view = new GameView(canvas, session, settings);
    this.audio = new GameAudio(settings);
    this.yaw = session.player.yaw;
    this.listen(window, "resize", () => this.view.resize());
    this.listen(window, "keydown", (e) => this.key(e as KeyboardEvent, true));
    this.listen(window, "keyup", (e) => this.key(e as KeyboardEvent, false));
    this.listen(window, "blur", () => {
      this.keys.clear();
      this.fire = false;
      if (this.overlay === "none") this.setOverlay("pause");
    });
    this.listen(canvas, "contextmenu", (e) => e.preventDefault());
    this.listen(canvas, "pointerdown", (e) => {
      const event = e as PointerEvent;
      if (this.overlay !== "none") return;
      this.mouseHeld = true;
      this.audio.unlock();
      if (event.button === 0) this.fire = true;
      if (event.button === 2) this.ads = true;
      if (document.pointerLockElement !== canvas) {
        const result = canvas.requestPointerLock();
        if (result && "catch" in result) void result.catch(() => {});
      }
    });
    this.listen(window, "pointerup", (e) => {
      const event = e as PointerEvent;
      if (event.button === 0) this.fire = false;
      if (event.button === 2) this.ads = false;
      this.mouseHeld = false;
    });
    this.listen(window, "mousemove", (e) => {
      const event = e as MouseEvent;
      if (
        this.overlay !== "none" ||
        (document.pointerLockElement !== canvas && !this.mouseHeld)
      )
        return;
      const sensitivity =
        0.0022 * this.settings.sensitivity * (this.ads ? 0.7 : 1);
      this.yaw += event.movementX * sensitivity;
      this.pitch = Math.max(
        -1.1,
        Math.min(
          1.15,
          this.pitch +
            event.movementY * sensitivity * (settings.invertY ? -1 : 1),
        ),
      );
    });
    this.listen(document, "pointerlockchange", () => {
      if (document.pointerLockElement !== canvas) {
        this.fire = false;
        this.ads = false;
        this.keys.clear();
        if (this.running && this.overlay === "none" && !this.session.result)
          this.setOverlay("pause");
      }
    });
    this.onSnapshot(session.snapshot());
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }
  private listen(target: EventTarget, type: string, handler: EventListener) {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }
  private key(e: KeyboardEvent, down: boolean) {
    if (["Tab", "Space", "ArrowUp", "ArrowDown"].includes(e.code))
      e.preventDefault();
    if (down) {
      if (e.repeat) return;
      if (e.code === "Escape") {
        this.setOverlay(this.overlay === "none" ? "pause" : "none");
        return;
      }
      if (e.code === "KeyM") {
        this.setOverlay(this.overlay === "map" ? "none" : "map");
        return;
      }
      if (e.code === "Tab") {
        this.setOverlay(this.overlay === "inventory" ? "none" : "inventory");
        return;
      }
      if (this.overlay !== "none") return;
      if (e.code === this.settings.bindings.shoulder)
        this.shoulderPending = true;
      this.keys.add(e.code);
    } else this.keys.delete(e.code);
  }
  setOverlay(overlay: Overlay) {
    this.overlay = overlay;
    this.session.paused = overlay !== "none";
    this.keys.clear();
    this.fire = false;
    this.ads = false;
    if (overlay !== "none" && document.pointerLockElement)
      document.exitPointerLock();
    this.onOverlay(overlay);
    this.onSnapshot(this.session.snapshot());
  }
  private loop(time: number) {
    if (!this.running) return;
    const dt = Math.min(0.06, this.last ? (time - this.last) / 1000 : 1 / 60);
    this.last = time;
    const b = this.settings.bindings,
      pressed = (action: string) => this.keys.has(b[action]);
    const input = {
      ...EMPTY_INPUT,
      yaw: this.yaw,
      pitch: this.pitch,
      forward: Number(pressed("forward")) - Number(pressed("back")),
      right: Number(pressed("right")) - Number(pressed("left")),
      sprint: pressed("sprint"),
      crouch: pressed("crouch"),
      jump: pressed("jump"),
      interact: pressed("interact"),
      reload: pressed("reload"),
      melee: pressed("melee"),
      glide: pressed("glide"),
      fire: this.fire,
      ads: this.ads,
      ...this.view.aim(),
    };
    for (let slot = 0; slot < 5; slot++)
      if (this.keys.has("Digit" + (slot + 1))) input.slot = slot;
    if (this.shoulderPending) {
      this.view.swapShoulder();
      this.shoulderPending = false;
    }
    this.session.step(input, dt);
    if (this.lastPhase !== this.session.phase) {
      if (this.session.phase === "dropping") this.yaw = this.session.player.yaw;
      this.lastPhase = this.session.phase;
    }
    for (const e of this.session.events) {
      if (e.id <= this.eventId) continue;
      this.eventId = e.id;
      this.audio.event(e);
      this.view.event(e);
    }
    this.audio.step(
      this.session.time,
      this.session.player.speed,
      this.session.player.grounded,
    );
    this.view.update(dt, input);
    this.uiTime += dt;
    if (this.uiTime > 0.09) {
      this.onSnapshot(this.session.snapshot(this.view.engine.getFps()));
      this.uiTime = 0;
    }
    if (this.session.result && !this.resultSaved) {
      this.resultSaved = true;
      saveResult(this.session.result);
      if (document.pointerLockElement) document.exitPointerLock();
      this.onSnapshot(this.session.snapshot());
    }
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }
  dispose() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.cleanup.forEach((fn) => fn());
    this.audio.dispose();
    this.view.dispose();
    this.session.dispose();
  }
}
