import { type CombatEvent, type Snapshot } from "./simulation";
import { clearLine } from "./navigation";
/** One reusable audio graph. All synthesis is original; no external samples. */
export class CombatAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private last = 0;
  private voices = 0;
  private nextBeep = 0;
  private footsteps = new Map<
    string,
    { x: number; z: number; travel: number }
  >();
  constructor(private enabled: boolean) {}
  async resume() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.38;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 5;
        this.master.connect(compressor).connect(this.context.destination);
        this.noise = this.context.createBuffer(
          1,
          this.context.sampleRate,
          this.context.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      await this.context.resume();
    } catch {
      /* Visual feedback remains available. */
    }
  }
  update(s: Snapshot, id: string) {
    const local = s.players.find((p) => p.id === id);
    if (!local) return;
    for (const p of s.players) {
      const previous = this.footsteps.get(p.id) ?? {
          x: p.x,
          z: p.z,
          travel: 0,
        },
        moved = Math.hypot(p.x - previous.x, p.z - previous.z);
      previous.travel += moved < 1 ? moved : 0;
      previous.x = p.x;
      previous.z = p.z;
      this.footsteps.set(p.id, previous);
      if (!p.alive || p.y > 0.04 || previous.travel < 1.15) continue;
      previous.travel = 0;
      const distance = Math.hypot(p.x - local.x, p.z - local.z),
        quiet = p.crouch || Math.hypot(p.vx, p.vz) < 3;
      if (distance > (quiet ? 5 : 22)) continue;
      const pan =
        -Math.sin(Math.atan2(p.x - local.x, p.z - local.z) - local.yaw) * 0.7;
      this.sound(
        { id: 0, kind: "reload", text: "STEP", time: s.time, source: "step" },
        (quiet ? 0.035 : 0.22) *
          Math.max(0, 1 - distance / 24) *
          (clearLine(local, p) ? 1 : 0.3),
        pan,
      );
    }
    if (s.objective.state === "armed" && s.time >= this.nextBeep) {
      this.nextBeep =
        s.time +
        (s.objective.remaining < 5
          ? 0.22
          : s.objective.remaining < 12
            ? 0.5
            : 1);
      this.sound(
        { id: 0, kind: "support", text: "CIPHER", time: s.time },
        0.65,
        0,
      );
    }
    for (const e of s.events)
      if (e.id > this.last) {
        this.last = e.id;
        const distance =
          e.x === undefined
            ? 0
            : Math.hypot(e.x - local.x, (e.z ?? 0) - local.z);
        if (distance > 60) continue;
        const own = e.actor === id,
          pan =
            e.x === undefined
              ? 0
              : Math.sin(
                  Math.atan2(e.x - local.x, (e.z ?? 0) - local.z) - local.yaw,
                ) * -0.7;
        if (e.kind === "shot")
          this.sound(
            e,
            own ? 1 : 0.35 * Math.max(0.05, 1 - distance / 60),
            own ? 0 : pan,
          );
        else if (
          (e.kind === "hit" ||
            e.kind === "kill" ||
            e.kind === "reload" ||
            e.kind === "support") &&
          own
        )
          this.sound(e, 0.6, 0);
        else if (e.kind === "explosion")
          this.sound(e, Math.max(0.08, 1 - distance / 65), pan);
      }
  }
  private sound(e: CombatEvent, volume: number, pan: number) {
    const c = this.context;
    if (
      !c ||
      !this.master ||
      !this.noise ||
      this.voices > 28 ||
      c.state !== "running"
    )
      return;
    const now = c.currentTime,
      gain = c.createGain(),
      panner = c.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner).connect(this.master);
    const noisy = ["shot", "reload", "explosion"].includes(e.kind),
      duration =
        e.source === "step"
          ? 0.075
          : e.kind === "explosion"
            ? 0.6
            : e.kind === "shot"
              ? 0.14
              : 0.09;
    gain.gain.setValueAtTime(volume * (noisy ? 0.52 : 0.1), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    this.voices++;
    if (noisy) {
      const source = c.createBufferSource();
      source.buffer = this.noise;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(
        e.source === "step"
          ? 420
          : e.kind === "explosion"
            ? 850
            : e.kind === "reload"
              ? 3000
              : 5500,
        now,
      );
      filter.frequency.exponentialRampToValueAtTime(120, now + duration);
      source.connect(filter).connect(gain);
      source.start(now);
      source.stop(now + duration);
      source.onended = () => {
        this.voices--;
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner.disconnect();
      };
    } else {
      const tone = c.createOscillator();
      tone.type = "sine";
      tone.frequency.setValueAtTime(
        e.kind === "kill" ? 880 : e.kind === "hit" ? 620 : 450,
        now,
      );
      tone.frequency.exponentialRampToValueAtTime(
        e.kind === "kill" ? 1320 : 420,
        now + duration,
      );
      tone.connect(gain);
      tone.start(now);
      tone.stop(now + duration);
      tone.onended = () => {
        this.voices--;
        tone.disconnect();
        gain.disconnect();
        panner.disconnect();
      };
    }
  }
  dispose() {
    void this.context?.close();
    this.context = undefined;
  }
}
