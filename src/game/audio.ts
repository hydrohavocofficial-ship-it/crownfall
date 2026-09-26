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

/** Original sound palettes, synthesized locally: no downloaded samples or network requests. */
export function attackSound(id: string, heavy = false): string {
  if (id === 'sukuna') return heavy ? 'sukuna-cleave' : 'sukuna-cut';
  if (id === 'gojo') return heavy ? 'gojo-red' : 'gojo-blue';
  if (['levi', 'zoro', 'ichigo', 'asta'].includes(id)) return 'blade-cut';
  if (['killua', 'sasuke', 'deku'].includes(id)) return 'storm-strike';
  if (['rengoku', 'madara'].includes(id)) return 'flame-strike';
  if (['tanjiro', 'todoroki'].includes(id)) return 'crystal-strike';
  if (id === 'denji') return 'saw-strike';
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
  }
}
