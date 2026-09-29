import type { Settings, Snapshot } from "./types";
/** Original synthesized score and Foley. Browser audio starts only after user interaction. */
export class GameAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private timer = 0;
  private beat = 0;
  private lastEvent = 0;
  private voices = 0;
  constructor(private settings: Settings) {}
  async start() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    const c = (this.ctx = new AudioContext());
    this.master = c.createGain();
    this.master.gain.value = this.settings.sound ? 0.45 : 0;
    this.master.connect(c.destination);
    this.engine = c.createOscillator();
    this.engine.type = "sawtooth";
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engine.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engine.start();
  }
  private tone(
    frequency: number,
    duration: number,
    gain: number,
    type: OscillatorType = "sine",
    slide = 0,
  ) {
    const c = this.ctx;
    if (!c || !this.master || this.voices > 24) return;
    this.voices++;
    const osc = c.createOscillator(),
      volume = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime);
    if (slide)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, frequency + slide),
        c.currentTime + duration,
      );
    volume.gain.setValueAtTime(0.0001, c.currentTime);
    volume.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, gain),
      c.currentTime + 0.008,
    );
    volume.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(volume);
    volume.connect(this.master);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
    osc.onended = () => {
      this.voices--;
      osc.disconnect();
      volume.disconnect();
    };
  }
  update(s: Snapshot, dt: number) {
    const c = this.ctx;
    if (!c || !this.master) return;
    this.master.gain.setTargetAtTime(
      this.settings.sound ? 0.45 : 0,
      c.currentTime,
      0.1,
    );
    this.engine?.frequency.setTargetAtTime(
      40 + s.player.speed * 4,
      c.currentTime,
      0.08,
    );
    this.engineGain?.gain.setTargetAtTime(
      s.vehicle ? 0.045 * this.settings.effects : 0,
      c.currentTime,
      0.1,
    );
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.43;
      const notes = [110, 130.81, 164.81, 146.83];
      const n = notes[Math.floor(this.beat / 8) % 4];
      this.tone(
        n,
        this.beat % 4 === 0 ? 0.65 : 0.18,
        0.026 * this.settings.music,
        "triangle",
      );
      if (this.beat % 2 === 0)
        this.tone(n * 4, 0.16, 0.018 * this.settings.music);
      if (s.alert.tier > 0 && this.beat % 4 === 0)
        this.tone(
          440 + s.alert.tier * 110,
          0.25,
          0.045 * this.settings.effects,
          "triangle",
          -100,
        );
      this.beat++;
    }
    for (const e of s.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        const g = this.settings.effects;
        if (e.kind === "shot") this.tone(150, 0.11, 0.17 * g, "sawtooth", -110);
        if (e.kind === "hit") this.tone(950, 0.055, 0.11 * g, "triangle", -600);
        if (e.kind === "collision")
          this.tone(75, 0.22, 0.2 * g, "sawtooth", -48);
        if (e.kind === "pickup") this.tone(740, 0.2, 0.08 * g);
        if (e.kind === "mission" || e.kind === "reward") {
          this.tone(440, 0.2, 0.09 * g);
          setTimeout(() => this.tone(660, 0.35, 0.075 * g), 130);
        }
      }
  }
  pause(paused: boolean) {
    if (paused) this.ctx?.suspend();
    else this.ctx?.resume();
  }
  reset() {
    this.lastEvent = 0;
    this.timer = 0;
    this.beat = 0;
  }
  setSettings(s: Settings) {
    this.settings = s;
  }
  dispose() {
    this.ctx?.close();
    this.ctx = undefined;
  }
}
