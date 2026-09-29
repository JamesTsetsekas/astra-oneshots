export class AudioDirector {
  private ctx?: AudioContext;
  private master?: GainNode;
  private timer?: number;
  private enabled = true;
  private beat = 0;
  async resume() {
    if (!this.enabled) return;
    this.ctx ??= new AudioContext();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.ctx.destination);
    }
    await this.ctx.resume();
    if (!this.timer) this.timer = window.setInterval(() => this.music(), 850);
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (this.master) this.master.gain.value = value ? 0.14 : 0;
  }
  cue(kind: string) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const notes: Record<string, [number, number, OscillatorType]> = {
      cast: [440, 0.12, "triangle"],
      hit: [125, 0.07, "triangle"],
      kill: [660, 0.28, "sine"],
      structure: [180, 0.45, "triangle"],
      objective: [520, 0.65, "sine"],
      level: [780, 0.2, "sine"],
      victory: [880, 0.8, "sine"],
      ward: [740, 0.13, "sine"],
      shop: [540, 0.15, "triangle"],
    };
    const [frequency, duration, type] = notes[kind] ?? notes.hit;
    this.tone(frequency, duration, type, 0.2);
    if (["kill", "objective", "victory"].includes(kind))
      this.tone(frequency * 1.25, duration * 1.2, "sine", 0.12, 0.08);
  }
  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const oscillator = c.createOscillator(),
      gain = c.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const t = c.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.03);
    oscillator.onended = () => {
      gain.disconnect();
      oscillator.disconnect();
    };
  }
  private music() {
    if (!this.enabled) return;
    const roots = [146.83, 130.81, 174.61, 164.81],
      root = roots[Math.floor(this.beat / 8) % 4];
    this.tone(root / 2, 0.7, "sine", 0.06);
    if (this.beat % 2 === 0)
      this.tone(
        root * [2, 2.5, 3, 2.5][Math.floor(this.beat / 2) % 4],
        1.4,
        "sine",
        0.045,
      );
    this.beat++;
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
  }
}
