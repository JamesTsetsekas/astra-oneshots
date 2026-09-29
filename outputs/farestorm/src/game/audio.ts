import type { GameSnapshot, Settings, StyleEvent } from './types';

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
type Tone = OscillatorType;

/** Original procedural score and a small, bounded Web Audio vehicle mixer. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private music?: GainNode;
  private motorGain?: GainNode;
  private motorLow?: OscillatorNode;
  private motorHigh?: OscillatorNode;
  private tireGain?: GainNode;
  private tireFilter?: BiquadFilterNode;
  private windGain?: GainNode;
  private noise?: AudioBuffer;
  private loops: AudioScheduledSourceNode[] = [];
  private voices = new Set<AudioScheduledSourceNode>();
  private settings: Settings;
  private disposed = false;
  private paused = false;
  private nextStep = 0;
  private step = 0;
  private lastEvent = -1;
  private lastDelivery = -1;
  private lastResult = '';
  private lastSecond = -1;
  private lastHorn = -10;
  private lastBoost = false;
  private lastSpeed = 0;
  private duckUntil = 0;

  constructor(settings: Settings) { this.settings = { ...settings }; }
  async resume(): Promise<void> {
    if (this.disposed) return;
    if (!this.context) this.initialize();
    if (this.context?.state === 'suspended') await this.context.resume();
    this.paused = false;
    this.nextStep = Math.max(this.nextStep, this.context?.currentTime ?? 0);
    this.applySettings();
  }
  async pause(): Promise<void> {
    this.paused = true;
    if (this.context?.state === 'running') await this.context.suspend();
  }
  setSettings(settings: Settings): void { this.settings = { ...settings }; this.applySettings(); }
  private initialize(): void {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const ctx = new Context();
    this.context = ctx;
    this.master = ctx.createGain(); this.effects = ctx.createGain(); this.music = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 16; limiter.ratio.value = 6; limiter.attack.value = .005; limiter.release.value = .18;
    this.music.connect(this.master); this.effects.connect(this.master); this.master.connect(limiter); limiter.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 48931, brown = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      brown = (brown + white * .04) / 1.025;
      data[i] = white * .7 + brown * .4;
    }
    this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0;
    const motorFilter = ctx.createBiquadFilter(); motorFilter.type = 'lowpass'; motorFilter.frequency.value = 680; motorFilter.Q.value = .4;
    this.motorGain.connect(motorFilter); motorFilter.connect(this.effects);
    this.motorLow = ctx.createOscillator(); this.motorLow.type = 'triangle'; this.motorLow.frequency.value = 38;
    this.motorHigh = ctx.createOscillator(); this.motorHigh.type = 'sine'; this.motorHigh.frequency.value = 76;
    const highGain = ctx.createGain(); highGain.gain.value = .3;
    this.motorLow.connect(this.motorGain); this.motorHigh.connect(highGain); highGain.connect(this.motorGain);
    this.motorLow.start(); this.motorHigh.start(); this.loops.push(this.motorLow, this.motorHigh);
    const tire = ctx.createBufferSource(); tire.buffer = this.noise; tire.loop = true;
    this.tireFilter = ctx.createBiquadFilter(); this.tireFilter.type = 'bandpass'; this.tireFilter.frequency.value = 1300; this.tireFilter.Q.value = .8;
    this.tireGain = ctx.createGain(); this.tireGain.gain.value = 0;
    tire.connect(this.tireFilter); this.tireFilter.connect(this.tireGain); this.tireGain.connect(this.effects); tire.start(); this.loops.push(tire);
    const wind = ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 580;
    this.windGain = ctx.createGain(); this.windGain.gain.value = .012;
    wind.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.effects); wind.start(); this.loops.push(wind);
    this.nextStep = ctx.currentTime + .03;
    this.applySettings();
  }
  private applySettings(): void {
    const ctx = this.context;
    if (!ctx) return;
    this.master?.gain.setTargetAtTime(this.settings.sound && !this.paused ? .68 : 0, ctx.currentTime, .06);
    this.effects?.gain.setTargetAtTime(clamp(this.settings.effects), ctx.currentTime, .04);
    this.music?.gain.setTargetAtTime(clamp(this.settings.music) * .7, ctx.currentTime, .06);
  }
  private tracked(source: AudioScheduledSourceNode, nodes: AudioNode[], end: number): void {
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); for (const node of nodes) node.disconnect(); };
    source.stop(end);
  }
  private note(midi: number, start: number, duration: number, volume: number, bus: GainNode | undefined, type: Tone = 'triangle', cutoff = 2400): void {
    const ctx = this.context;
    if (!ctx || !bus || this.voices.size >= 42) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    oscillator.type = type; oscillator.frequency.value = frequency(midi);
    filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .4;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(bus); oscillator.start(start);
    this.tracked(oscillator, [filter, gain], start + duration + .025);
  }
  private percussion(start: number, kind: 'kick' | 'snare' | 'hat' | 'crash', volume: number, bus = this.music): void {
    const ctx = this.context;
    if (!ctx || !bus || this.voices.size >= 42) return;
    if (kind === 'kick') {
      const source = ctx.createOscillator(), gain = ctx.createGain();
      source.frequency.setValueAtTime(112, start); source.frequency.exponentialRampToValueAtTime(42, start + .09);
      gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.001, start + .22);
      source.connect(gain); gain.connect(bus); source.start(start); this.tracked(source, [gain], start + .24); return;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise!;
    const duration = kind === 'hat' ? .045 : kind === 'crash' ? .35 : .13;
    filter.type = kind === 'hat' ? 'highpass' : 'bandpass'; filter.frequency.value = kind === 'hat' ? 5800 : kind === 'crash' ? 850 : 1900; filter.Q.value = .55;
    gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start(start, (this.step % 13) * .09); this.tracked(source, [filter, gain], start + duration + .02);
    if (kind === 'snare') this.note(48, start, .08, volume * .12, bus, 'triangle', 1600);
  }
  private sequence(now: number, intensity: number): void {
    const sixteenth = 60 / 126 / 4;
    if (this.nextStep < now - .25) this.nextStep = now + .015;
    const roots = [38, 38, 34, 34, 36, 36, 33, 33];
    let scheduled = 0;
    while (this.nextStep < now + .13 && scheduled++ < 4) {
      const step = this.step % 16, bar = Math.floor(this.step / 16) % 8, root = roots[bar], at = this.nextStep + (step % 2 ? .008 : 0);
      if ([0, 6, 8, 11].includes(step)) this.percussion(at, 'kick', .35);
      if (step === 4 || step === 12) this.percussion(at, 'snare', .45);
      if (step % 2 === 0 || intensity > .65) this.percussion(at, 'hat', step % 4 === 2 ? .24 : .14);
      if ([0, 3, 6, 8, 10, 14].includes(step)) this.note(root + (step === 14 ? 12 : step === 10 ? 7 : 0), at, sixteenth * 1.8, .22, this.music, 'triangle', 1000);
      if ([2, 7, 10, 15].includes(step)) {
        const third = bar === 2 || bar === 3 || bar === 4 || bar === 5 ? 4 : 3;
        [12, 12 + third, 19, 22].forEach((interval) => this.note(root + interval, at, .15, .036, this.music, 'sawtooth', 1350 + intensity * 900));
      }
      if (bar % 2 === 1 && [1, 5, 9, 13, 14].includes(step)) {
        const melody = [74, 77, 79, 81, 77];
        this.note(melody[[1, 5, 9, 13, 14].indexOf(step)], at, .19, .07, this.music, 'sine', 2200);
      }
      this.step++; this.nextStep += sixteenth;
    }
  }
  private chime(notes: number[], volume = .1, spacing = .075): void {
    const now = this.context?.currentTime ?? 0;
    notes.forEach((note, index) => this.note(note, now + index * spacing, .3, volume, this.effects, 'sine'));
  }
  horn(): void {
    const now = this.context?.currentTime ?? 0;
    if (now - this.lastHorn < .65) return;
    this.lastHorn = now;
    this.note(62, now, .24, .09, this.effects, 'triangle', 1100); this.note(67, now + .01, .22, .065, this.effects, 'triangle', 1100);
  }
  private event(event: StyleEvent): void {
    switch (event.kind) {
      case 'pickup': this.chime([62, 69, 74], .085); this.duckUntil = (this.context?.currentTime ?? 0) + .5; break;
      case 'nearMiss': this.chime([81, 86], .055, .045); break;
      case 'shortcut': this.chime([62, 65, 69, 74], .085); break;
      case 'surge': this.chime([50, 62, 69], .07, .045); break;
      case 'air': this.chime([74, 77, 81], .05, .06); break;
      case 'clean': this.chime([69, 74], .06); break;
      case 'collision': this.percussion(this.context?.currentTime ?? 0, 'crash', .8, this.effects); this.duckUntil = (this.context?.currentTime ?? 0) + .4; break;
      case 'info': if (/horn/i.test(event.label)) this.horn(); break;
      default: break;
    }
  }
  update(snapshot: GameSnapshot, dt: number): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.disposed || this.paused) return;
    const now = ctx.currentTime, vehicle = snapshot.vehicle, speed = Math.abs(vehicle.speedKmh), intensity = clamp(speed / 170);
    const finished = snapshot.status === 'finished';
    const acceleration = clamp((speed - this.lastSpeed) / Math.max(.016, dt) / 45, -.5, 1);
    this.lastSpeed = speed;
    const gear = Math.min(4, Math.floor(speed / 38)), revs = 35 + speed * .75 - gear * 13 + Math.max(0, acceleration) * 9;
    this.motorLow?.frequency.setTargetAtTime(revs, now, .08);
    this.motorHigh?.frequency.setTargetAtTime(revs * 2.03, now, .065);
    this.motorGain?.gain.setTargetAtTime(finished ? 0 : .09 + intensity * .055 + Math.max(0, acceleration) * .025, now, .1);
    this.tireGain?.gain.setTargetAtTime(vehicle.drift && speed > 25 ? .38 * intensity : 0, now, .06);
    this.tireFilter?.frequency.setTargetAtTime(vehicle.surface === 'sand' ? 500 : 950 + intensity * 850, now, .08);
    this.windGain?.gain.setTargetAtTime(finished ? .007 : .012 + intensity * intensity * .19 + (vehicle.boost ? .12 : 0), now, .16);
    this.music?.gain.setTargetAtTime(clamp(this.settings.music) * (now < this.duckUntil ? .48 : .7), now, .08);
    this.sequence(now, finished ? .2 : intensity);
    if (vehicle.boost && !this.lastBoost) this.chime([50, 57, 62, 69], .055, .035);
    this.lastBoost = vehicle.boost;
    for (const event of snapshot.events) if (event.id > this.lastEvent) { this.event(event); this.lastEvent = event.id; }
    if (snapshot.delivery && snapshot.delivery.id !== this.lastDelivery) {
      this.lastDelivery = snapshot.delivery.id;
      this.chime(snapshot.delivery.grade === 'BLAZING' ? [62, 66, 69, 74, 81] : [62, 66, 69, 74], .105, .085);
    }
    const second = Math.ceil(snapshot.shiftRemaining);
    if (!finished && second !== this.lastSecond && second > 0 && second <= 10) this.note(74, now, .075, .06, this.effects, 'sine');
    this.lastSecond = second;
    if (snapshot.result && snapshot.result.id !== this.lastResult) {
      this.lastResult = snapshot.result.id; this.chime([62, 66, 69, 74, 78, 81], .09, .13);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of [...this.loops, ...this.voices]) { try { source.stop(); } catch { /* A completed source is already silent. */ } source.disconnect(); }
    this.loops = []; this.voices.clear();
    void this.context?.close().catch(() => undefined); this.context = undefined;
  }
}
