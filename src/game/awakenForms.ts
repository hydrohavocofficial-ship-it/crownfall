/**
 * AWAKENED FORMS
 *
 * What a fighter *looks like* while the Awakening is open. Each entry can swap
 * parts of the palette (Gear Fifth's white hair, Kurama's gold cloak, Super
 * Saiyan Blue), draw behind the body (a Susanoo ribcage, a flame silhouette, a
 * black wing) and draw over it (a Hollow mask, titan marks, a chainsaw through
 * the forehead). All drawing is in the fighter's body space, facing right.
 */
import type { Look, Skeleton } from './render';

type Pt = [number, number];
export interface FormCtx {
  f: any; L: Look; time: number;
  head: Pt; neck: Pt; sh: Pt; hx: number; hy: number;
  elF: Pt; haF: Pt; elB: Pt; haB: Pt; kneeF: Pt; footF: Pt; kneeB: Pt; footB: Pt;
  hr: number;
}
export interface FormArt {
  look?: Partial<Look>;
  /** Colour of the backlight aura while awakened. */
  aura: string;
  back?: (ctx: CanvasRenderingContext2D, k: FormCtx) => void;
  front?: (ctx: CanvasRenderingContext2D, k: FormCtx) => void;
}

const TAU = Math.PI * 2;
const OL = '#0b0b10';
function hexA(c: string, a: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------------------
// SHARED PIECES
// ---------------------------------------------------------------------------

/** Flame tongues rising behind the body. */
function flameAura(ctx: CanvasRenderingContext2D, k: FormCtx, c1: string, c2: string, scale = 1, dark = false) {
  const { hy, time } = k;
  ctx.save(); ctx.globalCompositeOperation = dark ? 'source-over' : 'lighter';
  // A teardrop of flame: pinched at the feet, widest at the shoulders, tongues
  // licking up past the head. Faded at both ends so it never shows an edge.
  for (let layer = 0; layer < 2; layer++) {
    const n = 9, base = hy + 36, w = 34 * scale * (layer ? 0.75 : 1);
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.quadraticCurveTo(-w * 1.1, hy - 4, -w, hy - 40 * scale);
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = -w + u * w * 2;
      const h = (72 + Math.sin(u * Math.PI) * 50 + Math.sin(time * 0.35 + i * 1.7 + layer) * 14) * scale * (layer ? 0.75 : 1);
      ctx.quadraticCurveTo(x - 5 * scale, hy - 40 * scale - h * 0.3, x + Math.sin(time * 0.2 + i) * 4, hy + 6 - h);
    }
    ctx.quadraticCurveTo(w * 1.1, hy - 4, 0, base);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base, 0, hy - 130 * scale);
    const c = dark ? c1 : layer ? c2 : c1;
    g.addColorStop(0, hexA(c, 0)); g.addColorStop(0.18, hexA(c, dark ? 0.5 : 0.42)); g.addColorStop(0.6, hexA(dark ? c2 : c, 0.3)); g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.restore();
}

/** Crackling bolts jumping around the body. */
function boltAura(ctx: CanvasRenderingContext2D, k: FormCtx, col: string, n = 4) {
  const { hy, time } = k;
  const tick = Math.floor(time / 2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const a = hash(tick * 3 + i) * TAU, r0 = 18 + hash(tick + i * 7) * 16;
    let x = Math.cos(a) * r0, y = hy - 24 + Math.sin(a) * r0 * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += Math.cos(a) * 8 + (hash(tick * 5 + i * 3 + s) - 0.5) * 14; y += Math.sin(a) * 8 + (hash(tick * 7 + i + s * 11) - 0.5) * 14; ctx.lineTo(x, y); }
    ctx.strokeStyle = hexA(col, 0.5); ctx.lineWidth = 3.2; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

/** A Susanoo ribcage of chakra closing around the torso. */
function ribcage(ctx: CanvasRenderingContext2D, k: FormCtx, col: string) {
  const { sh, hy, head, time } = k;
  const pulse = 0.75 + Math.sin(time * 0.12) * 0.1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.strokeStyle = hexA(col, 0.18 * pulse); ctx.lineWidth = 14;
  ctx.beginPath(); ctx.ellipse(sh[0] - 2, (sh[1] + hy) / 2 - 4, 34, 46, 0, 0, TAU); ctx.stroke();
  // Spine.
  ctx.strokeStyle = hexA(col, 0.7 * pulse); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, hy + 6); ctx.quadraticCurveTo(-20, sh[1], -8, head[1] - 22); ctx.stroke();
  // Ribs.
  for (let i = 0; i < 5; i++) {
    const y = sh[1] - 4 + i * 8.5, w = 30 - Math.abs(i - 1.5) * 3;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-16, y); ctx.quadraticCurveTo(w * 0.4, y - 10, w, y + 4); ctx.stroke();
  }
  // Skull crest looming over the head.
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(head[0] - 4, head[1] - 6, 24, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(head[0] + 14, head[1] - 22); ctx.lineTo(head[0] + 26, head[1] - 36); ctx.stroke();
  ctx.restore();
}

function steam(ctx: CanvasRenderingContext2D, k: FormCtx, col = '#ffffff', n = 7) {
  const { hy, time } = k;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const p = ((time * 0.012 + i / n) % 1);
    const x = Math.sin(i * 2.3 + time * 0.02) * 26, y = hy + 10 - p * 110;
    ctx.fillStyle = hexA(col, 0.32 * (1 - p));
    ctx.beginPath(); ctx.arc(x, y, 7 + p * 14, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function eyeGlow(ctx: CanvasRenderingContext2D, k: FormCtx, col: string, trail = 0) {
  const x = k.head[0] + 6, y = k.head[1];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, hexA(col, 0.95)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
  if (trail) {
    ctx.strokeStyle = hexA(col, 0.6); ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 10, y - 2 + Math.sin(k.time * 0.3) * 2, x - 10 - trail, y - 4); ctx.stroke();
  }
  ctx.restore();
}

/** Rinnegan: pale violet iris with concentric rings. */
function rinnegan(ctx: CanvasRenderingContext2D, k: FormCtx) {
  const x = k.head[0] + 6.4, y = k.head[1];
  ctx.save();
  ctx.fillStyle = '#c9b6ff'; ctx.beginPath(); ctx.ellipse(x, y, 3, 2.6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5a3aa8'; ctx.lineWidth = 0.6;
  for (let r = 0.8; r < 3; r += 0.8) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.86, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// THE FORMS
// ---------------------------------------------------------------------------

export const FORMS: Record<string, FormArt> = {
  levi: {
    aura: '#bff0ff',
    back: (ctx, k) => {
      // Two ghost crescents circling him: the blades that are always already moving.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const a = k.time * 0.12 + i * Math.PI;
        ctx.strokeStyle = hexA('#d8f6ff', 0.45); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, k.hy - 20, 44, a, a + 1.4); ctx.stroke();
      }
      ctx.restore();
    },
    front: (ctx, k) => eyeGlow(ctx, k, '#d8f6ff', 14),
  },
  killua: {
    aura: '#8fe6ff',
    look: { hair: '#f2fbff', hair2: '#9fe8ff' },
    back: (ctx, k) => boltAura(ctx, k, '#8fe6ff', 5),
    front: (ctx, k) => { eyeGlow(ctx, k, '#8fe6ff', 8); boltAura(ctx, k, '#dff8ff', 2); },
  },
  rengoku: {
    aura: '#ff7a1a',
    back: (ctx, k) => flameAura(ctx, k, '#ff5a1a', '#ffd24a', 1.25),
    front: (ctx, k) => eyeGlow(ctx, k, '#ffb020'),
  },
  tanjiro: {
    aura: '#ffad35',
    look: { hair: '#5a1e16', hair2: '#d0301e' },
    back: (ctx, k) => {
      // The sun halo behind his head, turning.
      const { head, time } = k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA('#ffad35', 0.6); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(head[0] - 2, head[1] - 2, 22, 0, TAU); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = time * 0.03 + i * TAU / 12;
        ctx.beginPath(); ctx.moveTo(head[0] - 2 + Math.cos(a) * 24, head[1] - 2 + Math.sin(a) * 24); ctx.lineTo(head[0] - 2 + Math.cos(a) * 32, head[1] - 2 + Math.sin(a) * 32); ctx.stroke();
      }
      ctx.restore();
      flameAura(ctx, k, '#ff7a1a', '#ffd24a', 0.9);
    },
    front: (ctx, k) => {
      // The Demon Slayer Mark flaring across the forehead.
      const { head } = k;
      ctx.save(); ctx.fillStyle = '#d0301e';
      ctx.beginPath(); ctx.moveTo(head[0] - 4, head[1] - 6); ctx.quadraticCurveTo(head[0] + 2, head[1] - 12, head[0] + 7, head[1] - 9); ctx.quadraticCurveTo(head[0] + 3, head[1] - 7, head[0] + 5, head[1] - 4); ctx.quadraticCurveTo(head[0], head[1] - 6, head[0] - 4, head[1] - 6); ctx.fill();
      ctx.restore();
    },
  },
  madara: {
    aura: '#5b8cff',
    back: (ctx, k) => ribcage(ctx, k, '#5b8cff'),
    front: (ctx, k) => rinnegan(ctx, k),
  },
  sasuke: {
    aura: '#9a6bff',
    back: (ctx, k) => { ribcage(ctx, k, '#9a6bff'); boltAura(ctx, k, '#c9b6ff', 2); },
    front: (ctx, k) => rinnegan(ctx, k),
  },
  naruto: {
    aura: '#ffb52e',
    look: { top: '#ffb52e', top2: '#1b1b1b', sleeve: '#ffc94a', fore: '#ffc94a', pants: '#ff9c2e', hair: '#ffe14a', eye: '#ff7a1a' },
    back: (ctx, k) => {
      // The Kurama cloak: a golden flame outline hugging the whole body.
      flameAura(ctx, k, '#ffb52e', '#fff0a0', 1.1);
      const { time } = k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // Chakra tails fanning off the lower back, each a tapered plume.
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + 0.45 + i * 0.32 + Math.sin(time * 0.08 + i) * 0.12;
        const tx = Math.cos(a) * 60, ty = k.hy - 30 + Math.sin(a) * 44;
        const g = ctx.createLinearGradient(-6, k.hy, tx, ty);
        g.addColorStop(0, hexA('#ffcf4a', 0.5)); g.addColorStop(1, hexA('#fff0a0', 0.1));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-8, k.hy - 8); ctx.quadraticCurveTo(tx * 0.5 - 6, ty + 20, tx, ty); ctx.quadraticCurveTo(tx * 0.5 + 4, ty + 34, -2, k.hy + 2); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    front: (ctx, k) => {
      // Black seal lines and magatama on the chest.
      const { sh, hy, head } = k;
      ctx.save(); ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(sh[0] + 1, sh[1] + 10, 5, 0, TAU); ctx.stroke();
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(sh[0] + 1 + Math.cos(a) * 8, sh[1] + 10 + Math.sin(a) * 8, 1.6, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(sh[0] - 6, sh[1] + 20); ctx.lineTo(0, hy - 2); ctx.stroke();
      // Heavier whiskers and slit pupils.
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(head[0] + 3, head[1] + 1 + i * 2.2); ctx.lineTo(head[0] + 10, head[1] + i * 2.6); ctx.stroke(); }
      ctx.restore();
    },
  },
  luffy: {
    aura: '#ffffff',
    look: { hair: '#f8f8f8', top: '#f4f0f0', top2: '#ffffff', sleeve: 'none', pants: '#e9e9f1', eye: '#ff3a3a' },
    back: (ctx, k) => {
      // The Drums of Liberation: white steam plumes rolling off him.
      steam(ctx, k, '#ffffff', 9);
      const { time } = k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const a = time * 0.05 + i * 1.3; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(Math.cos(a) * 30, k.hy - 30 + Math.sin(a) * 26, 10, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    front: (ctx, k) => {
      // The cloud scarf around his neck.
      const { sh, neck, time } = k;
      ctx.save();
      const puffs: [number, number, number][] = [];
      for (let i = 0; i < 7; i++) { const a = Math.PI * (1 + i / 6); puffs.push([neck[0] + Math.cos(a) * 12, sh[1] + 2 + Math.sin(a) * 5 + Math.sin(time * 0.2 + i) * 0.8, 5 + (i % 2)]); }
      puffs.push([sh[0] - 16, sh[1] + 8, 5], [sh[0] - 22 - Math.sin(time * 0.15) * 3, sh[1] + 14, 4]);
      ctx.fillStyle = OL; for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r + 1.3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
  },
  zoro: {
    aura: '#b86bff',
    back: (ctx, k) => flameAura(ctx, k, '#3a0a4a', '#b86bff', 1.2, true),
    front: (ctx, k) => {
      // The scarred left eye opens, burning red.
      const { head } = k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(head[0] + 1, head[1] - 1, 0, head[0] + 1, head[1] - 1, 7);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#ff2040'); g.addColorStop(1, 'rgba(255,32,64,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head[0] + 1, head[1] - 1, 7, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },
  saitama: {
    aura: '#fff3c0',
    back: (ctx, k) => {
      // Wind lines streaming off him.
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) { const y = k.hy - 70 + i * 14, o = (k.time * 3 + i * 17) % 40; ctx.beginPath(); ctx.moveTo(-30 - o, y); ctx.lineTo(-10 - o, y); ctx.stroke(); }
      ctx.restore();
    },
    front: (ctx, k) => {
      // Serious face: shadow over the brow and a hard, level stare.
      const { head } = k;
      ctx.save();
      ctx.fillStyle = 'rgba(40,30,20,.28)'; ctx.beginPath(); ctx.ellipse(head[0] + 3, head[1] - 4, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(head[0] + 2, head[1] - 4.5); ctx.lineTo(head[0] + 10, head[1] - 3); ctx.stroke();
      ctx.restore();
    },
  },
  gojo: {
    aura: '#5fd2ff',
    look: { mark: 'none', eye: '#6fe3ff', eyeStyle: 'glowing' },
    back: (ctx, k) => {
      // The Infinity: concentric, slowly turning rings of blue and red.
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = hexA(i === 1 ? '#ff5577' : '#5fd2ff', 0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, k.hy - 24, 44 + i * 10, 60 + i * 10, k.time * 0.01 * (i + 1), 0, TAU); ctx.stroke(); }
      ctx.restore();
    },
    front: (ctx, k) => eyeGlow(ctx, k, '#6fe3ff', 10),
  },
  yuji: {
    aura: '#ff315a',
    back: (ctx, k) => boltAura(ctx, k, '#ff1a3a', 3),
    front: (ctx, k) => {
      // Black-flash sparks crackling black and red around the fists.
      const { haF, head } = k;
      ctx.save(); ctx.strokeStyle = '#0a0006'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const a = hash(Math.floor(k.time / 2) + i) * TAU; ctx.beginPath(); ctx.moveTo(haF[0], haF[1]); ctx.lineTo(haF[0] + Math.cos(a) * 12, haF[1] + Math.sin(a) * 12); ctx.stroke(); }
      // Sukuna's marks surfacing under the eyes.
      ctx.strokeStyle = '#2a0610'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(head[0] + 3, head[1] + 3); ctx.lineTo(head[0] + 9, head[1] + 4); ctx.stroke();
      ctx.restore();
    },
  },
  deku: {
    aura: '#8dffb0',
    back: (ctx, k) => boltAura(ctx, k, '#6dff9a', 6),
    front: (ctx, k) => {
      // Full Cowl lines running down his limbs.
      const { sh, elF, haF, kneeF, footF } = k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(141,255,176,.7)'; ctx.lineWidth = 1.4;
      for (const [a, b] of [[sh, elF], [elF, haF], [kneeF, footF]] as [Pt, Pt][]) {
        const mx = (a[0] + b[0]) / 2 + (hash(k.time + a[0]) - 0.5) * 6, my = (a[1] + b[1]) / 2 + (hash(k.time + a[1]) - 0.5) * 6;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(mx, my); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
      eyeGlow(ctx, k, '#8dffb0');
    },
  },
  todoroki: {
    aura: '#bfe6ff',
    back: (ctx, k) => {
      // Ice spikes on his right, fire on his left.
      const { hy, time } = k;
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 7, h = 34 + (i % 2) * 18;
        ctx.fillStyle = 'rgba(223,246,255,.75)'; ctx.strokeStyle = '#7ab8e0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 4, hy + 30); ctx.lineTo(x + 2, hy + 30 - h); ctx.lineTo(x + 6, hy + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(-80, -200, 80, 260); ctx.clip();
      flameAura(ctx, k, '#ff5a2a', '#ffd08a', 1);
      ctx.restore();
      void time;
    },
  },
  eren: {
    aura: '#ffd9a0',
    look: { eye: '#2ad4c8' },
    back: (ctx, k) => steam(ctx, k, '#ffffff', 10),
    front: (ctx, k) => {
      // Titan marks: the long lines running from the eyes to the cheekbones.
      const { head } = k;
      ctx.save(); ctx.strokeStyle = '#6a2c26'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(head[0] + 4, head[1] + 2); ctx.quadraticCurveTo(head[0] + 3, head[1] + 6, head[0] - 3, head[1] + 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(head[0] + 10, head[1] + 2); ctx.quadraticCurveTo(head[0] + 11, head[1] + 5, head[0] + 9, head[1] + 8); ctx.stroke();
      ctx.restore();
      eyeGlow(ctx, k, '#2ad4c8');
    },
  },
  denji: {
    aura: '#ff3a3a',
    back: (ctx, k) => flameAura(ctx, k, '#5a0006', '#ff3a3a', 1, true),
    front: (ctx, k) => {
      // The chainsaw through the forehead, and the saw-toothed grin.
      const { head, time } = k;
      ctx.save();
      ctx.translate(head[0] + 4, head[1] - 10); ctx.rotate(-0.35);
      ctx.fillStyle = '#9aa0aa'; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(-2, -26, 9, 28, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8ecf2';
      for (let i = 0; i < 6; i++) { const y = -24 + i * 4 + (time % 4); ctx.beginPath(); ctx.moveTo(7, y); ctx.lineTo(11, y + 1.5); ctx.lineTo(7, y + 3); ctx.fill(); }
      ctx.restore();
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OL; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(head[0] + 2, head[1] + 5); ctx.lineTo(head[0] + 11, head[1] + 4); ctx.lineTo(head[0] + 10, head[1] + 8); ctx.lineTo(head[0] + 3, head[1] + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(head[0] + 3 + i * 2, head[1] + 5); ctx.lineTo(head[0] + 4 + i * 2, head[1] + 7.6); ctx.stroke(); }
      ctx.restore();
    },
  },
  asta: {
    aura: '#e0203a',
    look: { hair: '#e8e8ee' },
    back: (ctx, k) => {
      // One ragged black devil wing, and anti-magic smoke.
      const { sh, time } = k;
      flameAura(ctx, k, '#0b0206', '#5a0010', 1, true);
      ctx.save();
      const flap = Math.sin(time * 0.15) * 0.2;
      ctx.translate(sh[0] - 6, sh[1] + 2); ctx.rotate(-0.5 + flap);
      ctx.fillStyle = '#0d0208'; ctx.strokeStyle = '#e0203a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -42); ctx.lineTo(-44, -50); ctx.lineTo(-34, -30); ctx.lineTo(-58, -26); ctx.lineTo(-40, -12); ctx.lineTo(-54, 4); ctx.lineTo(-20, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    front: (ctx, k) => {
      const { head } = k;
      ctx.save(); ctx.fillStyle = '#0d0208'; ctx.strokeStyle = '#e0203a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(head[0] - 5, head[1] - 9); ctx.quadraticCurveTo(head[0] - 12, head[1] - 22, head[0] - 4, head[1] - 30); ctx.quadraticCurveTo(head[0] - 5, head[1] - 20, head[0] + 1, head[1] - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Black markings over the eye.
      ctx.strokeStyle = '#0d0208'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(head[0] + 3, head[1] + 3); ctx.lineTo(head[0] + 6, head[1] + 9); ctx.stroke();
      ctx.restore();
      eyeGlow(ctx, k, '#ff2040');
    },
  },
  ichigo: {
    aura: '#ff2d4a',
    look: { top: '#0e0e14', top2: '#b0142a', sleeve: '#0e0e14', fore: '#0e0e14', pants: '#0e0e14', cape: '#0e0e14', capeLen: 46 },
    back: (ctx, k) => flameAura(ctx, k, '#0a0008', '#ff2d4a', 1.15, true),
    front: (ctx, k) => {
      // The Hollow mask: white, with the red stripes over the left eye.
      const { head } = k;
      const x = head[0], y = head[1];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 11); ctx.quadraticCurveTo(x + 12, y - 11, x + 12, y); ctx.quadraticCurveTo(x + 11, y + 10, x + 2, y + 11);
      ctx.lineTo(x + 2, y - 11); ctx.closePath();
      ctx.fillStyle = '#f4f2ec'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#b0142a';
      ctx.beginPath(); ctx.moveTo(x + 4, y - 11); ctx.lineTo(x + 6, y - 11); ctx.lineTo(x + 5.5, y + 6); ctx.lineTo(x + 4.2, y + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0a0008'; ctx.beginPath(); ctx.ellipse(x + 7.5, y - 1, 2.6, 1.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(x + 7.8, y - 1, 0.9, 0, TAU); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 5 + i * 1.6, y + 5); ctx.lineTo(x + 5 + i * 1.6, y + 8); ctx.stroke(); }
      ctx.restore();
    },
  },
  goku: {
    aura: '#ff3030',
    look: { hair: '#3ec8ff', hair2: '#1f7fd8', eye: '#3ec8ff' },
    back: (ctx, k) => { flameAura(ctx, k, '#ff2020', '#ff9090', 1.3); flameAura(ctx, k, '#3ec8ff', '#bff0ff', 0.8); },
    front: (ctx, k) => eyeGlow(ctx, k, '#3ec8ff'),
  },
  gokublack: {
    aura: '#ec4899',
    back: (ctx, k) => flameAura(ctx, k, '#ec4899', '#f9a8d4', 1.25),
  },
  goku_ui: {
    aura: '#e2e8f0',
  },
  sukuna: {
    aura: '#ff2347',
    back: (ctx, k) => flameAura(ctx, k, '#2a0006', '#ff2347', 1.15, true),
  },
  shadowdio: {
    aura: '#ffe45c',
    back: (ctx, k) => {
      flameAura(ctx, k, '#ffe45c', '#8affd0', 1.1);
      // Menacing: little diamond sparks drifting off him.
      const { time, hy } = k;
      ctx.save(); ctx.fillStyle = 'rgba(160,80,255,.7)';
      for (let i = 0; i < 4; i++) { const p = (time * 0.01 + i / 4) % 1; const x = 30 + i * 6, y = hy - 30 - p * 60; ctx.save(); ctx.translate(x, y); ctx.rotate(0.3); ctx.globalAlpha = 1 - p; ctx.fillRect(-3, -6, 6, 12); ctx.restore(); }
      ctx.restore();
    },
  },
};

/** Builds the form context from the renderer's skeleton. */
export function formCtx(k: Skeleton, hr: number): FormCtx {
  return { f: k.f, L: k.L, time: k.time, head: k.head, neck: k.neck, sh: k.sh, hx: k.hx, hy: k.hy, elF: k.elF, haF: k.haF, elB: k.elB, haB: k.haB, kneeF: k.kneeF, footF: k.footF, kneeB: k.kneeB, footB: k.footB, hr };
}
