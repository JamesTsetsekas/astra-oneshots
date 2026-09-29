export class AshfallAudio {
  private context?: AudioContext;
  private enabled = true;
  private musicGain?: GainNode;
  private ambience?: OscillatorNode;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.musicGain) this.musicGain.gain.value = enabled ? 0.045 : 0;
  }

  async resume(): Promise<void> {
    if (!this.enabled) return;
    if (!this.context) this.createContext();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  private createContext(): void {
    this.context = new AudioContext();
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.045;
    this.musicGain.connect(this.context.destination);
    this.ambience = this.context.createOscillator();
    this.ambience.type = "sine";
    this.ambience.frequency.value = 52;
    const low = this.context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 130;
    this.ambience.connect(low);
    low.connect(this.musicGain);
    this.ambience.start();
  }

  cue(kind: "hit" | "crit" | "cast" | "loot" | "danger" | "heal" | "waypoint" | "victory"): void {
    if (!this.enabled) return;
    if (!this.context) this.createContext();
    const context = this.context!;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const frequencies = { hit: 130, crit: 260, cast: 180, loot: 540, danger: 84, heal: 420, waypoint: 320, victory: 620 };
    oscillator.type = kind === "danger" ? "sawtooth" : kind === "loot" || kind === "victory" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequencies[kind], now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequencies[kind] * (kind === "hit" ? 0.55 : 1.45)), now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "danger" ? 0.12 : 0.07, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "victory" ? 0.7 : 0.2));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === "victory" ? 0.72 : 0.22));
  }

  dispose(): void {
    this.ambience?.stop();
    void this.context?.close();
  }
}
