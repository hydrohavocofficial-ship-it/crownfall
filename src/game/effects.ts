import { drawAnimeCut, drawArcSlash, drawBossVfx } from './bossVfx';
import { drawSwing, swingParticles } from './animeFx';
import type { Swing, SwingProfile } from './animeFx';
import type { BossVfxKind, BossVfxOptions } from './bossVfx';
import type { Rect, TechniqueVisualStyle } from './types';

export type PKind = 'spark' | 'smoke' | 'ember' | 'glow' | 'shard' | 'streak';
export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number;
  color: string; kind: PKind; grav: number; drag: number;
}
interface Slash { x: number; y: number; r: number; a0: number; a1: number; facing: number; life: number; max: number; color: string; w: number; }
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; w: number; }
interface Bolt { x1: number; y1: number; x2: number; y2: number; life: number; max: number; color: string; w: number; }
interface Txt { x: number; y: number; text: string; life: number; max: number; color: string; size: number; }
interface Beam { x: number; y: number; ang: number; life: number; max: number; color: string; }
interface Cut { x: number; y: number; len: number; ang: number; life: number; max: number; delay: number; thick: number; seed: number; }
interface Arc extends Cut { curve: number; }
interface Impact { x: number; y: number; r: number; life: number; max: number; color: string; seed: number; }

const MAXP = 420;
interface Geometry { bounds: Rect; kind: BossVfxKind | TechniqueVisualStyle; boss: boolean; color: string; color2: string; life: number; max: number; options: BossVfxOptions; }

// Sparse line-work fills the true hit volume. Each style has a distinct silhouette.
function drawStrike(c: CanvasRenderingContext2D, s: Geometry) {
  const { bounds: b, kind, color, color2 } = s, t = 1 - s.life / s.max;
  c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(s.options.facing ?? 1, 1);
  c.beginPath(); c.rect(-b.w / 2, -b.h / 2, b.w, b.h); c.clip();
  c.globalAlpha *= Math.min(1, s.life / 3); c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'miter';
  const w = b.w * .48, h = b.h * .48;
  if (['blade', 'spirit', 'void', 'trio', 'water', 'flame'].includes(kind)) {
    const count = kind === 'trio' ? 3 : kind === 'blade' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * h * .4;
      c.beginPath(); c.moveTo(-w, -h + off); c.bezierCurveTo(w * .4, -h + off, w, h * .25 + off, -w * .2, h + off);
      c.strokeStyle = kind === 'void' ? '#100512' : color; c.lineWidth = kind === 'blade' ? 3 : 8; c.stroke();
      c.strokeStyle = color2; c.lineWidth = 1.4; c.stroke();
      if (kind === 'flame' || kind === 'water') for (let j = 0; j < 5; j++) {
        const x = -w + j * w * .38, y = Math.sin(j * .7 + t) * h * .45;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w * .3, y - h * .4, x + w * .19, y - h * (kind === 'flame' ? .9 : .2)); c.stroke();
      }
    }
  } else if (['storm', 'hero', 'curse', 'shadow'].includes(kind)) {
    for (let i = 0; i < 4; i++) {
      const y = (i / 3 - .5) * h * 1.5;
      c.beginPath(); c.moveTo(-w, y); c.lineTo(-w * .2, y - h * .12); c.lineTo(w * .05, y + h * .17); c.lineTo(w * .3, y - h * .15); c.lineTo(w, y * .65);
      c.strokeStyle = kind === 'curse' || kind === 'shadow' ? '#120619' : color; c.lineWidth = 5; c.stroke(); c.strokeStyle = color2; c.lineWidth = 1; c.stroke();
    }
  } else if (kind === 'twin' || kind === 'meteor' || kind === 'titan') {
    for (let i = 0; i < 5; i++) {
      const x = (i / 4 - .5) * w * 1.6;
      c.fillStyle = i % 2 ? color : color2; c.globalAlpha *= .9;
      c.beginPath(); c.moveTo(x - w * .15, h); c.lineTo(x, -h * (.5 + (i % 2) * .4)); c.lineTo(x + w * .25, h * .7); c.closePath(); c.fill();
      c.strokeStyle = '#effaff'; c.lineWidth = 1; c.stroke();
    }
  } else if (kind === 'saw') {
    c.beginPath(); c.moveTo(-w, h * .5);
    for (let i = 0; i < 12; i++) { const x = -w + i * w / 6; c.lineTo(x, i % 2 ? -h * .7 : -h * .2); }
    c.lineTo(w, h * .5); c.strokeStyle = '#171b25'; c.lineWidth = 8; c.stroke(); c.strokeStyle = color2; c.lineWidth = 2; c.stroke();
  } else if (kind === 'fox') {
    for (let i = 0; i < 5; i++) { c.strokeStyle = i % 2 ? color2 : color; c.beginPath(); c.moveTo(-w, h * .6); c.bezierCurveTo(-w * .5, -h, w * .4, h * (i / 4 - .5), w, h * (i / 2 - 1)); c.stroke(); }
  } else if (kind === 'rubber') {
    c.strokeStyle = '#160c16'; c.lineWidth = h * .4; c.beginPath(); c.moveTo(-w, h * .16); c.quadraticCurveTo(0, -h * .4, w * .65, 0); c.stroke();
    c.strokeStyle = color2; c.lineWidth = h * .26; c.stroke(); c.fillStyle = color; c.beginPath(); c.ellipse(w * .65, 0, w * .3, h * .45, 0, 0, Math.PI * 2); c.fill();
  } else {
    // Ki is a focused lens, pressure a forward shock front, singularity an orbit.
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = i % 2 ? color2 : color; c.lineWidth = i ? 1 : 3;
      c.beginPath(); c.ellipse((i - 1) * w * .37, 0, w * .42, h * (.9 - i * .17), kind === 'singularity' ? i * .8 : 0, -1.3, 1.3); c.stroke();
    }
  }
  c.restore();
}

export class Effects {
  geometry: Geometry[] = [];
  parts: Particle[] = [];
  slashes: Slash[] = [];
  cuts: Cut[] = [];
  arcs: Arc[] = [];
  swings: Swing[] = [];
  rings: Ring[] = [];
  bolts: Bolt[] = [];
  texts: Txt[] = [];
  beams: Beam[] = [];
  impacts: Impact[] = [];

  shape(kind: BossVfxKind, bounds: Rect, life = 8, options: BossVfxOptions = {}) {
    if (this.geometry.length >= 64) this.geometry.shift();
    this.geometry.push({ kind, bounds: { ...bounds }, boss: true, color: '', color2: '', life, max: life, options });
  }
  strike(kind: TechniqueVisualStyle, bounds: Rect, color: string, color2: string, facing: number, life = 5) {
    if (this.geometry.length >= 64) this.geometry.shift();
    this.geometry.push({ kind, bounds: { ...bounds }, boss: false, color, color2, life, max: life, options: { facing } });
  }

  impact(x: number, y: number, r: number, color: string) {
    if (this.impacts.length >= 28) this.impacts.shift();
    this.impacts.push({ x, y, r, color, life: 13, max: 13, seed: Math.random() * 10 });
  }

  add(p: Partial<Particle> & { x: number; y: number }) {
    if (this.parts.length >= MAXP) this.parts.shift();
    const q = { vx: 0, vy: 0, life: 30, size: 4, color: '#fff', kind: 'spark', grav: 0, drag: 0.94, ...p } as Particle;
    q.max = q.life;
    this.parts.push(q);
  }
  burst(x: number, y: number, n: number, color: string, speed = 6, kind: PKind = 'spark', life = 24, size = 4, grav = 0) {
    for (let i = 0; i < Math.min(n, 36); i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.9);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, kind, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), grav });
    }
  }
  directional(x: number, y: number, n: number, ang: number, spread: number, color: string, speed = 8, kind: PKind = 'streak', life = 18, size = 3) {
    for (let i = 0; i < Math.min(n, 28); i++) {
      const a = ang + (Math.random() - 0.5) * spread, s = speed * (0.5 + Math.random() * 0.8);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, kind, life: life * (0.6 + Math.random() * 0.6), size, drag: 0.9 });
    }
  }
  slash(x: number, y: number, r: number, a0: number, a1: number, facing: number, color: string, w = 14, life = 12) {
    if (this.slashes.length >= 36) this.slashes.shift();
    this.slashes.push({ x, y, r, a0, a1, facing, color, w, life, max: life });
  }
  /** Anime-style melee swing / impact; a0 to a1 are world angles (equal for fist impacts). */
  swing(x: number, y: number, r: number, a0: number, a1: number, p: SwingProfile, facing: number, life = 14, thick = 1) {
    if (this.swings.length >= 40) this.swings.shift();
    this.swings.push({ x, y, r, a0, a1, p, life, max: life, seed: Math.random() * 10, thick });
    swingParticles(this, x, y, r, p, facing);
  }
  /** Animated anime-style cut (Sukuna's Dismantle/Cleave). */
  cut(x: number, y: number, len: number, ang: number, life = 20, thick = 1, delay = 0) {
    if (this.cuts.length >= 48) this.cuts.shift();
    this.cuts.push({ x, y, len, ang, life, max: life, delay, thick, seed: Math.random() * 10 });
  }
  /**
   * Anime sweep-cut: a curved, whip-thin crescent in black and white. Used for
   * every heavy Dismantle so Sukuna's blade language is one consistent shape.
   */
  arcCut(x: number, y: number, len: number, ang: number, curve: number, life = 22, thick = 1, delay = 0) {
    if (this.arcs.length >= 32) this.arcs.shift();
    this.arcs.push({ x, y, len, ang, curve, life, max: life, delay, thick, seed: Math.random() * 10 });
  }
  ring(x: number, y: number, r0: number, r1: number, color: string, life = 20, w = 6) {
    if (this.rings.length >= 32) this.rings.shift();
    this.rings.push({ x, y, r0, r1, color, life, max: life, w });
  }
  bolt(x1: number, y1: number, x2: number, y2: number, color = '#8fe3ff', life = 8, w = 3) {
    if (this.bolts.length >= 32) this.bolts.shift();
    this.bolts.push({ x1, y1, x2, y2, color, life, max: life, w });
  }
  text(x: number, y: number, text: string, color = '#fff', size = 28, life = 50) {
    if (this.texts.length >= 16) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life, max: life });
  }
  beam(x: number, y: number, ang: number, color: string) {
    if (this.beams.length >= 6) this.beams.shift();
    this.beams.push({ x, y, ang, color, life: 45, max: 45 });
  }

  update() {
    this.geometry.forEach(s => s.life--); this.geometry = this.geometry.filter(s => s.life > 0);
    for (const p of this.parts) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav; p.x += p.vx; p.y += p.vy; p.life--;
      if (p.kind === 'ember') p.vy -= 0.08;
      if (p.kind === 'smoke') p.size *= 1.02;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.swings.forEach((s) => s.life--); this.swings = this.swings.filter((s) => s.life > 0);
    this.cuts.forEach((s) => { if (s.delay > 0) s.delay--; else s.life--; }); this.cuts = this.cuts.filter((s) => s.life > 0);
    this.arcs.forEach((s) => { if (s.delay > 0) s.delay--; else s.life--; }); this.arcs = this.arcs.filter((s) => s.life > 0);
    this.slashes.forEach((s) => s.life--); this.slashes = this.slashes.filter((s) => s.life > 0);
    this.rings.forEach((s) => s.life--); this.rings = this.rings.filter((s) => s.life > 0);
    this.bolts.forEach((s) => s.life--); this.bolts = this.bolts.filter((s) => s.life > 0);
    this.texts.forEach((s) => { s.life--; s.y -= 0.8; }); this.texts = this.texts.filter((s) => s.life > 0);
    this.beams.forEach((s) => s.life--); this.beams = this.beams.filter((s) => s.life > 0);
    this.impacts.forEach((s) => s.life--); this.impacts = this.impacts.filter((s) => s.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const s of this.geometry) {
      if (s.boss) drawBossVfx(ctx, s.kind as BossVfxKind, s.bounds, s.max - s.life, { ...s.options, alpha: (s.options.alpha ?? 1) * Math.min(1, s.life / 3) });
      else drawStrike(ctx, s);
    }
    // beams (KO)
    for (const b of this.beams) {
      const t = b.life / b.max;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang);
      ctx.globalCompositeOperation = 'lighter';
      const w = 160 * t;
      const g = ctx.createLinearGradient(0, 0, 2600, 0);
      g.addColorStop(0, b.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = t; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -w * 0.2); ctx.lineTo(2600, -w); ctx.lineTo(2600, w); ctx.lineTo(0, w * 0.2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = t * 0.9;
      ctx.beginPath(); ctx.moveTo(0, -w * 0.05); ctx.lineTo(2600, -w * 0.3); ctx.lineTo(2600, w * 0.3); ctx.lineTo(0, w * 0.05); ctx.fill();
      ctx.restore();
    }
    // manga impact stars (normal blend, drawn under additive layer)
    for (const im of this.impacts) {
      const t = im.life / im.max, k = 1 - t;
      const R = im.r * (0.45 + k * 0.85);
      ctx.save(); ctx.translate(im.x, im.y); ctx.rotate(im.seed);
      ctx.globalAlpha = Math.min(1, t * 1.6);
      const spikes = 11;
      const shape = (scale: number) => {
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * Math.PI * 2;
          const rr = (i % 2 ? R * 0.42 : R * (0.85 + ((i * 37 + im.seed * 11) % 10) / 28)) * scale;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.86;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
      };
      shape(1); ctx.fillStyle = '#0d0d14'; ctx.fill();
      shape(0.92); ctx.fillStyle = im.color; ctx.fill();
      shape(0.55); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    }
    for (const s of this.swings) drawSwing(ctx, s);
    for (const s of this.cuts) if (s.delay <= 0) drawAnimeCut(ctx, s.x, s.y, s.len, s.ang, 1 - s.life / s.max, s.thick, s.seed);
    for (const s of this.arcs) if (s.delay <= 0) drawArcSlash(ctx, s.x, s.y, s.len, s.ang, s.curve, 1 - s.life / s.max, s.thick, s.seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.slashes) this.drawSlash(ctx, s);
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - t) * 0.9; ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 3)), 0, Math.PI * 2); ctx.stroke();
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = b.life / b.max;
      const dx = b.x2 - b.x1, dy = b.y2 - b.y1, len = Math.hypot(dx, dy) || 1, n = Math.min(28, Math.max(3, Math.floor(len / 18)));
      const nx = -dy / len, ny = dx / len;
      const pts: [number, number][] = [[b.x1, b.y1]];
      for (let i = 1; i < n; i++) { const o = Math.sin(i * 31.7 + b.x1 + Math.floor(b.life / 3)) * 13; pts.push([b.x1 + dx * i / n + nx * o, b.y1 + dy * i / n + ny * o]); }
      pts.push([b.x2, b.y2]);
      for (const [w, c] of [[b.w * 3, b.color], [b.w, '#ffffff']] as [number, string][]) {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
    }
    for (const p of this.parts) {
      if (p.kind === 'smoke') continue;
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      if (p.kind === 'streak') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * t + 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
      } else if (p.kind === 'glow' || p.kind === 'ember') {
        const r = p.size * (p.kind === 'glow' ? 2.5 : 1.6) * (0.4 + t * 0.6);
        // Two flat discs avoid hundreds of per-frame gradient allocations.
        ctx.globalAlpha *= .22; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.min(1, t * 1.5) * .8; ctx.beginPath(); ctx.arc(p.x, p.y, r * .34, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 0.3);
        ctx.fillRect(-p.size, -p.size * 0.3, p.size * 2, p.size * 0.6); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.3 + t * 0.7), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // smoke (normal blend)
    ctx.save();
    for (const p of this.parts) {
      if (p.kind !== 'smoke') continue;
      ctx.globalAlpha = (p.life / p.max) * 0.45; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life / 15);
      ctx.font = `italic 900 ${t.size}px Bangers, Impact, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  private drawSlash(ctx: CanvasRenderingContext2D, s: Slash) {
    const t = s.life / s.max;
    const prog = 1 - t;
    const N = 18;
    const a0 = s.a0, a1 = s.a0 + (s.a1 - s.a0) * Math.min(1, prog * 3 + 0.35);
    const pass = (w: number, color: string, alpha: number) => {
      ctx.globalAlpha = alpha * t;
      ctx.fillStyle = color;
      ctx.beginPath();
      const outer: [number, number][] = [], inner: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const a = a0 + (a1 - a0) * k;
        const th = w * Math.sin(Math.PI * Math.pow(k, 0.7));
        const ca = s.facing > 0 ? a : Math.PI - a;
        outer.push([s.x + Math.cos(ca) * (s.r + th * 0.5), s.y + Math.sin(ca) * (s.r + th * 0.5)]);
        inner.push([s.x + Math.cos(ca) * (s.r - th * 0.5), s.y + Math.sin(ca) * (s.r - th * 0.5)]);
      }
      outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.closePath(); ctx.fill();
    };
    pass(s.w * 1.8, s.color, 0.55);
    pass(s.w * 0.6, '#ffffff', 0.95);
  }
}
