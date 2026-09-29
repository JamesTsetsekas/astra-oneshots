export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private enabled = true;
  private voices=0;
  private lastShot=0;
  private lastChord=-10;
  private noise?:AudioBuffer;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.16 : 0;
  }

  unlock(): void {
    if (!this.enabled || this.voices>=28) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  tone(frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.4, delay = 0): void {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.82), now + duration);
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
    this.voices++;oscillator.onended=()=>{this.voices--;oscillator.disconnect();envelope.disconnect();};
  }

  select(): void {
    this.tone(420, 0.06, "triangle", 0.18);
  }

  order(): void {
    this.tone(260, 0.07, "sine", 0.16);
    this.tone(350, 0.05, "sine", 0.12, 0.04);
  }

  alert(): void {
    this.tone(180, 0.13, "sawtooth", 0.18);
    this.tone(145, 0.17, "sawtooth", 0.15, 0.12);
  }

  complete(): void {
    this.tone(420, 0.12, "triangle", 0.18);
    this.tone(620, 0.18, "triangle", 0.16, 0.08);
  }

  impact(heavy = false): void {
    this.tone(heavy ? 70 : 115, heavy ? 0.22 : 0.1, "square", heavy ? 0.32 : 0.16);
  }

  invalid(): void {
    this.tone(95, 0.12, "square", 0.16);
  }

  shot(organic:boolean,pan:number,distance:number,heavy=false):void{
    if(!this.enabled||!this.context||!this.master||this.context.currentTime-this.lastShot<.045||this.voices>=28)return;
    const ctx=this.context,now=ctx.currentTime;this.lastShot=now;
    if(!this.noise){this.noise=ctx.createBuffer(1,ctx.sampleRate*.4,ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);}
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),panner=ctx.createStereoPanner();source.buffer=this.noise;source.playbackRate.value=organic?.6:heavy?.55:1.8;filter.type='bandpass';filter.frequency.value=organic?600:heavy?180:1900;filter.Q.value=.7;panner.pan.value=Math.max(-1,Math.min(1,pan));gain.gain.setValueAtTime(Math.min(.7,1/(1+distance*.07))*(heavy?.8:.34),now);gain.gain.exponentialRampToValueAtTime(.001,now+(heavy?.35:.12));source.connect(filter).connect(gain).connect(panner).connect(this.master);source.start();source.stop(now+.4);this.voices++;source.onended=()=>{this.voices--;source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
  }
  update(time:number,intense:boolean):void{
    if(!this.enabled||!this.context||time-this.lastChord<4)return;this.lastChord=time;
    const chord=[[65.41,98,130.81],[58.27,87.31,116.54],[73.42,110,146.83],[55,82.41,110]][Math.floor(time/16)%4];
    for(const [i,note]of chord.entries())this.tone(note,3.8,'sine',intense?.025:.018,i*.12);
  }
  dispose():void{void this.context?.close();this.context=undefined;this.master=undefined;}
}
