import type { GameEvent, Settings } from "./types";
export class GameAudio {
  private ctx?: AudioContext;
  private bus?: GainNode;
  private ambience?: OscillatorNode;
  private lastStep = 0;
  constructor(private settings: Settings) {}
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.bus = this.ctx.createGain();
      this.bus.gain.value = 0.13;
      this.bus.connect(this.ctx.destination);
      this.ambience = this.ctx.createOscillator();
      this.ambience.type = "sine";
      this.ambience.frequency.value = 73.42;
      const gain = this.ctx.createGain();
      gain.gain.value = this.settings.music ? 0.025 : 0;
      this.ambience.connect(gain).connect(this.bus);
      this.ambience.start();
    }
    void this.ctx.resume();
  }
  private tone(
    frequency: number,
    length: number,
    type: OscillatorType = "sine",
    gain = 0.3,
    fall = 0,
  ) {
    if (!this.ctx || !this.bus || !this.settings.sound) return;
    const osc = this.ctx.createOscillator(),
      amp = this.ctx.createGain(),
      now = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (fall)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, frequency * fall),
        now + length,
      );
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + length);
    osc.connect(amp).connect(this.bus);
    osc.start();
    osc.stop(now + length + 0.01);
  }
  event(e: GameEvent) {
    switch (e.type) {
      case "shot":
        this.tone(
          e.actor === 0 ? 125 : 88,
          0.085,
          "sawtooth",
          e.actor === 0 ? 0.3 : 0.09,
          0.3,
        );
        break;
      case "hit":
        this.tone(e.shield ? 850 : 430, 0.08, "triangle", 0.22, 0.6);
        break;
      case "kill":
        this.tone(330, 0.15);
        setTimeout(() => this.tone(495, 0.2), 110);
        break;
      case "pickup":
        this.tone(650, 0.12, "sine", 0.15);
        break;
      case "reload":
        if (e.actor === 0) this.tone(270, 0.12, "square", 0.06);
        break;
      case "heal":
        this.tone(540, 0.3, "sine", 0.15, 1.5);
        break;
      case "storm":
        this.tone(100, 0.8, "triangle", 0.15, 0.5);
        break;
    }
  }
  step(time: number, speed: number, grounded: boolean) {
    if (
      speed > 1 &&
      grounded &&
      time - this.lastStep > (speed > 6 ? 0.25 : 0.35)
    ) {
      this.lastStep = time;
      this.tone(65, 0.06, "triangle", 0.09, 0.6);
    }
  }
  dispose() {
    this.ambience?.stop();
    void this.ctx?.close();
    this.ctx = undefined;
  }
}
