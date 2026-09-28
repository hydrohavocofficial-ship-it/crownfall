import { setClipVolume, playClip, preloadClips, fadeOutClip, type ClipId } from './sfx';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let volume = 0.55;
let lastPlay: Record<string, number> = {};

export function setVolume(v: number) { volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .55; if (master) master.gain.value = volume; setClipVolume(volume); }
export function getVolume() { return volume; }
export { preloadClips };

/**
 * Plays a recorded character sample. Returns false when the clip is not ready
 * so the caller can fall back to the synthesised palette.
 */
export function clip(name: ClipId, opts?: { rate?: number; volume?: number; gap?: number; force?: boolean }) { return playClip(name, opts); }

/**
 * Fades a running recorded clip out over `seconds`. Used when a sustained cue has
 * a scripted exit — e.g. the Malevolent Shrine roar clearing the mix four
 * seconds into Sukuna's domain — so it never stops dead mid-sample.
 */
export function fadeClip(name: ClipId, seconds = 1) { return fadeOutClip(name, seconds); }

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function unlockAudio() { ensure(); preloadClips(); }

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number, delay = 0) {
  const c = ensure(); if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}
function noise(dur: number, vol: number, freq: number, type: BiquadFilterType, slide?: number, delay = 0, q = 1) {
  const c = ensure(); if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
}

/**
 * A resonant bandpass sweep, detuned. This is the workhorse behind the
 * Ultra Instinct palette: it is the only primitive in the kit that can sound
 * like *glass ringing* rather than like an oscillator, and the very short
 * attack is what makes it read as supernatural instead of musical.
 */
function shimmer(freq: number, dur: number, vol: number, slide: number, delay = 0, voices = 3) {
  const c = ensure(); if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + delay;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 9;
  bp.frequency.setValueAtTime(freq, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(80, slide), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
  src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); };
  // Detuned partials: a handful of close sines beating against each other is
  // what turns a single chime into a chorus shimmer.
  for (let i = 0; i < voices; i++) {
    const o = c.createOscillator(); const og = c.createGain();
    o.type = 'sine';
    const f = freq * (1 + (i - (voices - 1) / 2) * 0.0075);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(80, f * (slide / freq)), t + dur);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vol * 0.5 / (1 + i * 0.5), t + Math.min(0.01, dur * 0.18));
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + dur + 0.02);
    o.onended = () => { o.disconnect(); og.disconnect(); };
  }
}

/** Original sound palettes, synthesized locally: no downloaded samples or network requests. */
export function attackSound(id: string, heavy = false): string {
  if (id === 'sukuna') return heavy ? 'sukuna-cleave' : 'sukuna-cut';
  if (id === 'gojo') return heavy ? 'gojo-red' : 'gojo-blue';
  if (['levi', 'zoro', 'ichigo', 'asta'].includes(id)) return 'blade-cut';
  if (['killua', 'sasuke', 'deku'].includes(id)) return 'storm-strike';
  if (['rengoku', 'madara'].includes(id)) return 'flame-strike';
  if (['tanjiro', 'todoroki'].includes(id)) return 'crystal-strike';
  if (id === 'denji') return 'saw-strike';
  // Ultra Instinct has its own attack cue so every clean hit lands with a
  // supernatural chime instead of the shared energy blip.
  if (id === 'goku_ui') return 'ui_punch';
  if (['goku', 'naruto'].includes(id)) return 'energy-strike';
  return heavy ? 'pressure-strike' : 'swing';
}

/**
 * Chooses between the basic and the powerful recorded cleave.
 * A blow counts as powerful when it belongs to a technique, awakening or
 * ultimate; when its damage is high enough to feel like a finisher; or when it
 * carries its damage on a travelling cleave instead of a melee hitbox.
 * Fuga is excluded because it has its own dedicated sample.
 */
export function slashTierFor(m: { hits?: any[]; ability?: string; vfx?: string }): 'light' | 'strong' {
  if (m.vfx === 'sukunaFuga') return 'strong';
  if (m.ability === 'ultimate' || m.ability === 'limit' || m.ability === 'awaken' || m.ability === 'awakened') return 'strong';
  const hits = m.hits || [];
  // A travelling Dismantle (no melee hitbox) is always a heavy, loud cut.
  if (!hits.length) return 'strong';
  let peak = 0, total = 0;
  for (const h of hits) { const d = (h && h.dmg) || 0; if (d > peak) peak = d; total += d; }
  if (peak >= 9 || total >= 14) return 'strong';
  return 'light';
}

/** Recorded samples are addressed through the same `sfx` entry point. */
const CLIP_ALIAS: Record<string, ClipId> = {
  'clip/slash': 'sukuna-slash',
  'clip/strong-slash': 'sukuna-strong-slash',
  'clip/fuga': 'sukuna-fuga',
  'clip/domain': 'sukuna-domain',
  'clip/laugh': 'sukuna-laugh',
  'clip/appear': 'shadowdio-appear',
  'clip/death': 'shadowdio-death',
  'clip/timestop': 'shadowdio-timestop',
  'clip/time-resume': 'shadowdio-time-resume',
};

export function sfx(name: string, power = 1) {
  const alias = CLIP_ALIAS[name];
  if (alias) return playClip(alias, { volume: Math.max(0, Math.min(1.5, power)) });
  const now = performance.now();
  if (lastPlay[name] && now - lastPlay[name] < 30) return;
  lastPlay[name] = now;
  const p = Math.min(2, power);
  switch (name) {
    case 'sukuna-cut':
      noise(.055, .42, 8200, 'highpass', 2600, 0, 3); tone(2100, .075, 'triangle', .11, 320); noise(.08, .2, 800, 'bandpass', 180, .025); break;
    case 'sukuna-cleave':
      for (let i = 0; i < 3; i++) { noise(.07, .27, 7200 - i * 1100, 'highpass', 1600, i * .045, 2); tone(1200 - i * 170, .1, 'triangle', .1, 160, i * .045); }
      tone(65, .28, 'sine', .32, 26, .09); break;
    case 'sukuna-fuga':
      noise(.3, .3, 450, 'bandpass', 4600, 0, 2); tone(160, .3, 'sawtooth', .08, 650);
      noise(.52, .52, 2000, 'lowpass', 120, .19); tone(75, .6, 'sine', .4, 24, .2); break;
    case 'domain': case 'sukuna-domain':
      [55, 82.4, 110].forEach((f, i) => tone(f, 1.1, 'sine', .14, f * .75, i * .04));
      tone(540, 1.1, 'triangle', .1, 155); noise(.8, .22, 1600, 'bandpass', 180);
      for (let i = 0; i < 5; i++) noise(.06, .18, 6500, 'highpass', 1200, .3 + i * .11); break;
    case 'gojo-blue':
      tone(170, .27, 'sine', .23, 650); tone(173, .3, 'sine', .14, 660);
      noise(.24, .15, 400, 'bandpass', 3200, 0, 5); tone(1050, .15, 'sine', .08, 430, .15); break;
    case 'gojo-red':
      tone(880, .11, 'triangle', .2, 95); noise(.13, .38, 5000, 'lowpass', 500, .04);
      tone(80, .34, 'sine', .4, 28, .035); noise(.25, .14, 600, 'bandpass', 120, .1); break;
    case 'gojo-purple':
      tone(190, .35, 'sine', .15, 950); tone(570, .35, 'triangle', .09, 950);
      noise(.25, .2, 1800, 'bandpass', 7000, 0, 3); tone(65, .8, 'sine', .42, 24, .22);
      noise(.7, .27, 4200, 'lowpass', 220, .24); tone(1300, .55, 'sine', .08, 160, .24); break;
    case 'gojo-void':
      [220, 329.6, 440, 659.2].forEach((f, i) => tone(f, 1.15, 'sine', .075, f * .5, i * .075));
      noise(.9, .1, 5800, 'highpass', 900); tone(42, 1.2, 'sine', .32, 28); break;
    // ---- W. D. Gaster ----
    case 'blaster-charge':
      tone(220, .32, 'sawtooth', .07, 1320); tone(223, .32, 'square', .04, 1330);
      noise(.3, .12, 900, 'bandpass', 5200, 0, 4); break;
    case 'blaster-fire':
      noise(.55, .42, 2600, 'lowpass', 300); tone(95, .55, 'sawtooth', .22, 48);
      tone(1400, .3, 'square', .05, 700); tone(52, .7, 'sine', .45, 30, .05); break;
    case 'glitch':
      for (let i = 0; i < 4; i++) tone(300 + ((i * 677) % 1900), .03, 'square', .07, undefined, i * .028);
      noise(.1, .16, 5200, 'highpass', 1800); break;
    case 'soul':
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, .32, 'sine', .07, f * 1.01, i * .035)); break;
    case 'void':
      tone(70, .5, 'sine', .3, 34); noise(.45, .18, 380, 'lowpass', 90); tone(420, .3, 'triangle', .05, 110, .05); break;
    // ---- Donquixote Doflamingo ----
    case 'string':
      tone(2400, .06, 'triangle', .07, 900); noise(.07, .24, 7800, 'highpass', 3000, 0, 4); break;
    case 'string-whip':
      noise(.16, .34, 3000, 'bandpass', 9000, 0, 3); tone(1800, .12, 'sawtooth', .05, 260); break;
    case 'birdcage':
      for (let i = 0; i < 6; i++) tone(1800 - i * 160, .5, 'triangle', .04, 1700 - i * 160, i * .05);
      noise(.8, .18, 6000, 'highpass', 1500); tone(60, .9, 'sine', .3, 30); break;
    case 'blade-cut': noise(.09, .3, 4800, 'bandpass', 1100, 0, 3); tone(1800, .1, 'triangle', .06, 620); break;
    case 'storm-strike': for (let i = 0; i < 3; i++) { tone(1500 + i * 340, .045, 'square', .06, 180, i * .025); } noise(.1, .2, 6800, 'highpass'); break;
    case 'flame-strike': noise(.24, .32, 1000, 'lowpass', 240); tone(120, .16, 'sawtooth', .09, 45); break;
    case 'crystal-strike': [1250, 1880, 2500].forEach((f, i) => tone(f, .18, 'sine', .065, f * .8, i * .015)); noise(.14, .15, 3800, 'bandpass', 1200); break;
    case 'saw-strike': for (let i = 0; i < 4; i++) tone(110 + i * 40, .065, 'sawtooth', .1, 80, i * .03); noise(.16, .18, 2100, 'bandpass'); break;
    case 'energy-strike': tone(220, .18, 'triangle', .18, 850); noise(.12, .2, 2200, 'bandpass', 5000); break;
    case 'pressure-strike': tone(85, .22, 'sine', .34, 28); noise(.17, .4, 1900, 'lowpass', 140); break;
    case 'swing': noise(0.12, 0.25, 1800, 'bandpass', 5000, 0, 2); break;
    case 'swingH': noise(0.22, 0.35, 700, 'bandpass', 3000, 0, 1.5); break;
    case 'hit': tone(180, 0.1, 'square', 0.25, 60); noise(0.08, 0.5, 3000, 'lowpass', 500); break;
    case 'heavyhit':
      tone(120 , 0.25, 'sawtooth', 0.35 * p, 35); noise(0.25, 0.7 * p, 2500, 'lowpass', 200); tone(60, 0.35, 'sine', 0.6, 30); break;
    case 'jump': tone(300, 0.1, 'triangle', 0.15, 600); break;
    case 'djump': tone(420, 0.12, 'triangle', 0.15, 900); noise(0.1, 0.1, 3000, 'highpass'); break;
    case 'land': noise(0.07, 0.15, 600, 'lowpass'); break;
    case 'dodge': noise(0.18, 0.2, 4000, 'highpass', 8000); tone(900, 0.1, 'sine', 0.06, 1500); break;
    case 'dash': noise(0.14, 0.2, 1200, 'bandpass', 4000, 0, 1); break;
    case 'ko':
      tone(80, 0.9, 'sawtooth', 0.5, 25); noise(1.0, 0.8, 1500, 'lowpass', 80); tone(1200, 0.4, 'sine', 0.2, 200); break;
    case 'elec':
      for (let i = 0; i < 4; i++) tone(800 + Math.random() * 1500, 0.05, 'square', 0.12, 200, i * 0.03);
      noise(0.2, 0.3, 5000, 'highpass'); break;
    case 'fire': noise(0.4, 0.45, 900, 'lowpass', 300); tone(90, 0.3, 'sawtooth', 0.15, 50); break;
    case 'dark': tone(70, 0.4, 'sawtooth', 0.3, 40); noise(0.3, 0.35, 400, 'lowpass', 100); tone(160, 0.3, 'square', 0.1, 80); break;
    case 'purple': tone(110, 0.6, 'sawtooth', 0.25, 55); tone(220, 0.6, 'triangle', 0.15, 110); noise(0.4, 0.3, 600, 'bandpass', 200); break;
    case 'counter': tone(1400, 0.25, 'sine', 0.25, 2800); tone(700, 0.25, 'triangle', 0.2, 1400); break;
    case 'ult':
      tone(200, 1.0, 'sawtooth', 0.25, 1200); noise(1.0, 0.3, 500, 'bandpass', 6000); tone(100, 1.1, 'sine', 0.4, 50); break;
    case 'select': tone(660, 0.07, 'square', 0.12, 880); break;
    case 'confirm': tone(520, 0.08, 'square', 0.15); tone(780, 0.14, 'square', 0.15, undefined, 0.07); break;
    case 'back': tone(400, 0.1, 'square', 0.12, 250); break;
    case 'count': tone(440, 0.15, 'square', 0.2); break;
    case 'go': tone(660, 0.1, 'square', 0.2); tone(990, 0.35, 'square', 0.25, undefined, 0.1); noise(0.4, 0.3, 3000, 'highpass'); break;
    case 'game': tone(300, 0.8, 'sawtooth', 0.3, 80); noise(0.8, 0.5, 2000, 'lowpass', 100); break;
    case 'whoosh': noise(0.35, 0.35, 400, 'bandpass', 3000, 0, 1); break;

    // ==========================================================================
    // ULTRA INSTINCT — the Dragon Ball Super silver palette.
    // Six cues, all built from the same shimmer primitive, so the whole form
    // reads as one supernatural sound world rather than a bag of noises.
    // ==========================================================================
    case 'ui_chime':
      // Ethereal glass. A 3.2 kHz bandpass swept up through a ring of detuned
      // partials, with a lower voice a fifth underneath. Plays on every
      // autonomous slip, counter and ultimate startup.
      shimmer(3200, 0.5, 0.12, 6200);
      shimmer(1900, 0.62, 0.07, 4600, 0.035, 2);
      tone(4800, 0.38, 'sine', 0.05, 7400, 0.01);
      noise(0.34, 0.05, 5200, 'bandpass', 9000, 0, 6);
      break;
    case 'ui_aura':
      // Low cosmic hum: a slow-beating detuned drone under a white-noise pulse,
      // so the aura is felt in the chest as much as it is heard.
      [55, 55.9, 82.4, 110.6, 164.8].forEach((f, i) => tone(f, 1.5, 'sine', 0.13 / (1 + i * 0.35), f * 0.97, i * 0.012));
      tone(41, 1.7, 'sine', 0.3, 30, 0.02);
      noise(0.85, 0.09, 320, 'bandpass', 900, 0, 2.5);
      for (let i = 0; i < 6; i++) shimmer(4200 + i * 260, 0.3, 0.035, 7000, i * 0.17, 2);
      break;
    case 'ui_punch':
      // Meaty low end plus a sonic-boom crack layered on the transient.
      tone(96, 0.2, 'sine', 0.42, 34);
      tone(58, 0.3, 'sine', 0.5, 26, 0.008);
      noise(0.09, 0.52, 2600, 'lowpass', 260);
      noise(0.16, 0.26, 8000, 'highpass', 2600, 0, 1.6);
      shimmer(6400, 0.2, 0.06, 2600, 0.01, 2);
      break;
    case 'ui_beam':
      // Piercing high harmonic that climbs, then collapses into a sub-bass
      // detonation. The whole point is the pitch cliff at the end.
      tone(300, 1.0, 'sawtooth', 0.2, 2400);
      tone(600, 1.0, 'square', 0.08, 4200);
      shimmer(5200, 0.95, 0.13, 9000, 0, 3);
      noise(0.9, 0.2, 1400, 'bandpass', 7000, 0, 3);
      tone(52, 1.3, 'sine', 0.68, 22, 0.82);
      tone(78, 1.1, 'triangle', 0.3, 30, 0.86);
      noise(1.1, 0.5, 1800, 'lowpass', 120, 0.84);
      break;
    case 'ui_slip':
      // The instant slip itself: a supersonic whoosh with the chime riding it.
      noise(0.22, 0.34, 600, 'bandpass', 7000, 0, 1.2);
      tone(1500, 0.18, 'sine', 0.09, 3200);
      shimmer(5600, 0.3, 0.09, 8800, 0.02, 2);
      break;
    case 'ui_ult':
      // Supreme Godly Display: a universe-scale swell, an internal collapse,
      // and then a reversed-gravity detonation.
      [40, 60, 90, 135, 202].forEach((f, i) => tone(f, 2.2, 'sine', 0.16 / (1 + i * 0.3), f * 1.5, i * 0.05));
      shimmer(3600, 1.9, 0.16, 8800, 0.1, 4);
      noise(1.6, 0.16, 700, 'bandpass', 6000, 0.1, 2);
      tone(34, 1.6, 'sine', 0.5, 120, 1.0);
      noise(1.2, 0.62, 2400, 'lowpass', 90, 1.02);
      shimmer(8800, 0.8, 0.2, 2400, 1.04, 3);
      break;
  }
}
