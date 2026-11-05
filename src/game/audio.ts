import { GAME_CONFIG } from './config';

export class SoundFX {
  private ctx: AudioContext | null = null;
  public muted = false;
  private initialized = false;
  private engineOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private musicMasterGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private beatStep = 0;
  private electricGain: GainNode | null = null;
  private lowFuelBeepAccum = 0;

  public init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.musicMasterGain = this.ctx.createGain();
      this.musicMasterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.musicMasterGain.connect(this.ctx.destination);

      this.initEngineSound();
      this.initElectricHum();
      this.startBackgroundBeat();
      this.initialized = true;

      const unlockAudio = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  /**
   * Ducks the background music briefly on pickup collection so pickup sound effects pop clearly.
   */
  public duckMusic(durationSec: number = 0.45) {
    if (!this.ctx || !this.musicMasterGain) return;
    const now = this.ctx.currentTime;
    this.musicMasterGain.gain.cancelScheduledValues(now);
    this.musicMasterGain.gain.setValueAtTime(0.22, now);
    this.musicMasterGain.gain.linearRampToValueAtTime(1.0, now + durationSec);
  }

  private initEngineSound() {
    if (!this.ctx) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(34, this.ctx.currentTime);

    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'triangle';
    this.subOsc.frequency.setValueAtTime(17, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(190, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineOsc.connect(this.engineFilter);
    this.subOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
    this.subOsc.start();
  }

  private initElectricHum() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);

    this.electricGain = this.ctx.createGain();
    this.electricGain.gain.setValueAtTime(0, this.ctx.currentTime);

    osc.connect(this.electricGain);
    this.electricGain.connect(this.ctx.destination);
    osc.start();
  }

  public setElectricHumVolume(vol: number) {
    if (!this.ctx || !this.electricGain || this.muted) return;
    this.electricGain.gain.setTargetAtTime(Math.min(0.2, vol), this.ctx.currentTime, 0.1);
  }

  private startBackgroundBeat() {
    if (!this.ctx || this.musicTimer !== null) return;
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 98, 123.47];
    const beatInterval = 145; // ~104 BPM energetic funk runner groove
    const dest = this.musicMasterGain || this.ctx.destination;

    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const step = this.beatStep % 8;

      // Kick drum (Dhool kick)
      if (step % 2 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.frequency.setValueAtTime(120, now);
        kick.frequency.exponentialRampToValueAtTime(32, now + 0.08);
        kGain.gain.setValueAtTime(0.22, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        kick.connect(kGain);
        kGain.connect(dest);
        kick.start(now);
        kick.stop(now + 0.08);
      }

      // Snare / Clap
      if (step === 2 || step === 6) {
        const snare = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        snare.type = 'triangle';
        snare.frequency.setValueAtTime(240, now);
        sGain.gain.setValueAtTime(0.14, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        snare.connect(sGain);
        sGain.connect(dest);
        snare.start(now);
        snare.stop(now + 0.07);
      }

      // Bassline note
      const bass = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(bassNotes[step] * 0.5, now);
      bGain.gain.setValueAtTime(0.07, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      bass.connect(bGain);
      bGain.connect(dest);
      bass.start(now);
      bass.stop(now + 0.12);

      this.beatStep++;
    }, beatInterval);
  }

  /**
   * Updates engine synthesizer pitch and handles sputtering (< 15% fuel), stalling (0% fuel),
   * and underpass low-pass echo when driving beneath an elevated flyover deck.
   */
  public updateEngine(
    speed: number,
    isRunning: boolean,
    basePitch: number = 34,
    fuelPct: number = 100,
    dt: number = 1 / 60,
    inUnderpass: boolean = false
  ) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.subOsc || !this.engineFilter) return;
    if (this.muted || !isRunning) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }

    const now = this.ctx.currentTime;

    // Low fuel repeating warning beep (< 25%)
    if (fuelPct > 0 && fuelPct < GAME_CONFIG.FUEL_LOW_WARNING_PCT) {
      this.lowFuelBeepAccum += dt;
      const beepInterval = fuelPct < 12 ? 0.45 : 0.75;
      if (this.lowFuelBeepAccum >= beepInterval) {
        this.lowFuelBeepAccum = 0;
        this.playLowFuelBeep();
      }
    } else {
      this.lowFuelBeepAccum = 0;
    }

    // Engine dead / stalled at 0% fuel
    if (fuelPct <= 0) {
      this.engineOsc.frequency.setTargetAtTime(14, now, 0.15);
      this.subOsc.frequency.setTargetAtTime(7, now, 0.15);
      this.engineGain.gain.setTargetAtTime(0.005, now, 0.12);
      return;
    }

    const ratio = Math.max(0.1, speed / GAME_CONFIG.BASE_SPEED);
    let targetFreq = basePitch + ratio * 28;
    let targetGain = inUnderpass ? 0.095 : 0.07;

    // Below 15% fuel: engine sputters (stuttering oscillator & pitch dips)
    if (fuelPct < GAME_CONFIG.FUEL_SPUTTER_PCT) {
      const stutterWave = Math.sin(now * 38) * Math.cos(now * 17);
      if (stutterWave < -0.15) {
        targetGain = 0.01;
        targetFreq *= 0.68;
      }
    }

    const filterCutoff = inUnderpass ? 115 + ratio * 75 : 180 + ratio * 160;
    this.engineFilter.Q.setTargetAtTime(inUnderpass ? 6.5 : 1.0, now, 0.08);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    this.subOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  /**
   * Fuel pickup: a liquid glug-glug followed by a bright chime.
   */
  public playFuelPickup(isGolden = false) {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.5);
    const now = this.ctx.currentTime;

    // 1. Two liquid "glug" bubbles (bandpass-filtered pitch-swept sine)
    [0, 0.09].forEach((offset, idx) => {
      const glug = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + offset;
      glug.type = 'sine';
      glug.frequency.setValueAtTime(190 + idx * 35, t);
      glug.frequency.exponentialRampToValueAtTime(420 + idx * 50, t + 0.075);
      gain.gain.setValueAtTime(0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      glug.connect(gain);
      gain.connect(this.ctx!.destination);
      glug.start(t);
      glug.stop(t + 0.08);
    });

    // 2. Bright metallic chime after the glug
    const chimeNotes = isGolden ? [880, 1174.66, 1396.91, 1760] : [880, 1318.51];
    chimeNotes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + 0.18 + i * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /**
   * Low fuel repeating dashboard beep (< 25% fuel).
   */
  public playLowFuelBeep() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.setValueAtTime(740, now + 0.05);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Engine restart cough when collecting fuel at 0% empty tank.
   */
  public playEngineRestartCough() {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.55);
    const now = this.ctx.currentTime;
    // Two starter cranks followed by a roaring ignition rev
    [0, 0.12, 0.25].forEach((offset, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + offset;
      osc.type = 'sawtooth';
      if (idx < 2) {
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.linearRampToValueAtTime(32, t + 0.09);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.095);
      } else {
        // Ignition roar
        osc.frequency.setValueAtTime(48, t);
        osc.frequency.exponentialRampToValueAtTime(165, t + 0.26);
        gain.gain.setValueAtTime(0.32, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      }
    });
  }

  /**
   * Shield pickup: rising harmonic shimmer on pickup.
   */
  public playShieldPickup() {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.45);
    const now = this.ctx.currentTime;
    const shimmerNotes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    shimmerNotes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.22);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /**
   * Shield hit: crystalline glass-shatter burst on impact.
   */
  public playShieldShatter() {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.4);
    const now = this.ctx.currentTime;
    // High-pitched crystalline shards + descending impact sweep
    const shardFreqs = [1950, 1480, 1120, 860, 540];
    shardFreqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.028;
      osc.type = idx % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.16);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  /**
   * Jump boost pickup & boosted jump: springy elastic boing with pitch modulation.
   */
  public playJumpPickup() {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.45);
    this.playJump(true);
  }

  public playJump(isSuper = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    if (isSuper) {
      // Springy coil boing with vibrato wobble
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.20);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.28);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.30);
    } else {
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.22);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  }

  public playSpeedUp() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playMysteryBox() {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.45);
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.06;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playHorn() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.setValueAtTime(420, now);
    osc2.frequency.setValueAtTime(540, now);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  public playCoin() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const notes = [987.77, 1174.66, 1318.51, 1567.98, 1760.0];
    const freq = notes[Math.floor(Math.random() * notes.length)];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playCrash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.6);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playJetpack() {
    if (this.muted || !this.ctx) return;
    this.duckMusic(0.45);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playClick() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playSiren() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(940, now + 0.16);
    osc.frequency.linearRampToValueAtTime(620, now + 0.32);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playThunder() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, now);
    filter.frequency.linearRampToValueAtTime(70, now + 1.2);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  public playWaterSplash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.2);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playBedfordAirHorn() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const frequencies = [340, 440, 520];

    frequencies.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startTime = now + idx * 0.12;
      const dur = 0.18;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, startTime);

      gain.gain.setValueAtTime(0.24, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  public playCloseCall() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.18);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playQuestComplete() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startT = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.2, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startT);
      osc.stop(startT + 0.35);
    });
  }

  public speakCallout(phrase: string) {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.pitch = 1.25;
      utterance.rate = 1.15;
      utterance.volume = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const subcontinentalVoice = voices.find((v) => v.lang.includes('ur') || v.lang.includes('hi') || v.lang.includes('pa'));
      if (subcontinentalVoice) {
        utterance.voice = subcontinentalVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Graceful fallback
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.engineGain && this.muted) {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return !this.muted;
  }
}
