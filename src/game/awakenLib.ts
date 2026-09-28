/**
 * THE AWAKENED ABILITY LIBRARY
 *
 * Every fighter's awakened kit used to come out of one template: the same three
 * hitbox shapes and the same travelling blob, recoloured. This file replaces
 * that template with a vocabulary of *real* techniques - beams, crescents,
 * eruptions, orbs, vortices, ground waves, giant summoned limbs, volleys,
 * fields, shockwaves, blink-strikes, grabs, barrages, dives, counters, buffs and
 * clones - each of which is rendered through the owner's MOTIF (lightning,
 * flame, ice, chakra, cursed energy...). `awakenKits.ts` then authors every
 * fighter's kit move by move from this vocabulary.
 *
 * Collision: straight-line and radial attacks test their true geometry here
 * (`MANUAL` entities); boxy ones use the engine's own projectile collision.
 */
import { sfx } from './audio';
import { SIGS } from './signatures';
import { registerVfx } from './vfx';
import { computePose, drawFighter } from './render';
import type { AnimName, HitDef, MoveDef } from './types';

export type Motif =
  | 'blade' | 'wind' | 'lightning' | 'flame' | 'sun' | 'ki' | 'chakra' | 'silver' | 'rose' | 'hero'
  | 'dark' | 'anti' | 'curse' | 'void' | 'infinity' | 'ice' | 'water' | 'blood' | 'rubber' | 'titan' | 'saw' | 'stand';
export interface Theme { c1: string; c2: string; c3?: string; motif: Motif; }
export interface Blow { dmg: number; ang: number; kb: number; sc: number; stun?: number; fx?: HitDef['fx'] }

const R = Math.random;
const TAU = Math.PI * 2;
const OL = '#0b0b10';
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function hexA(c: string, a: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
function shade(c: string, k: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16), m = (v: number) => clamp(Math.floor(v * k), 0, 255);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
const MANUAL = 100000;

const DARK: Motif[] = ['dark', 'anti', 'curse', 'void', 'blood'];
const SHARP: Motif[] = ['blade', 'wind', 'ice', 'saw'];
const FIERY: Motif[] = ['flame', 'sun'];
export const FX_OF: Record<Motif, HitDef['fx']> = {
  blade: 'slash', wind: 'slash', lightning: 'elec', flame: 'fire', sun: 'fire', ki: 'blunt', chakra: 'blunt', silver: 'blunt',
  rose: 'purple', hero: 'elec', dark: 'dark', anti: 'dark', curse: 'dark', void: 'purple', infinity: 'purple', ice: 'slash',
  water: 'slash', blood: 'dark', rubber: 'blunt', titan: 'blunt', saw: 'slash', stand: 'blunt',
};
export const SFX_OF: Record<Motif, string> = {
  blade: 'blade-cut', wind: 'blade-cut', lightning: 'storm-strike', flame: 'flame-strike', sun: 'flame-strike', ki: 'energy-strike',
  chakra: 'energy-strike', silver: 'energy-strike', rose: 'energy-strike', hero: 'storm-strike', dark: 'dark', anti: 'dark', curse: 'dark',
  void: 'purple', infinity: 'purple', ice: 'crystal-strike', water: 'blade-cut', blood: 'dark', rubber: 'pressure-strike',
  titan: 'pressure-strike', saw: 'saw-strike', stand: 'pressure-strike',
};

// ===========================================================================
// COLLISION HELPERS
// ===========================================================================

export function foes(g: any, owner: any) { return g.fighters.filter((T: any) => T !== owner && T.alive && g.canDamage(owner, T)); }
export function strike(g: any, p: any, T: any, b: Blow, dir: number, x: number, y: number, fx?: HitDef['fx']) {
  return g.applyHit(p.owner, T, { dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, fx: b.fx || fx || 'blunt', ultLocked: p.ultLocked }, dir, T.x, T.y - T.h / 2, false,
    { x, y, vx: 0, vy: 0, noMeter: p.ultLocked });
}
/** Hits everything whose body is within `half` of a segment; `rehit` 0 means once. */
export function segHits(g: any, p: any, x1: number, y1: number, x2: number, y2: number, half: number, b: Blow, rehit: number, fx?: HitDef['fx']) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (const T of foes(g, p.owner)) {
    const cx = T.x, cy = T.y - T.h / 2;
    const u = clamp(((cx - x1) * dx + (cy - y1) * dy) / L2, 0, 1);
    const px = x1 + dx * u, py = y1 + dy * u;
    if (Math.hypot(cx - px, cy - py) > half + T.hw + T.h * 0.28) continue;
    const last = p.hitMap.get(T);
    if (last !== undefined && (rehit <= 0 || p.t - last < rehit)) continue;
    p.hitMap.set(T, p.t);
    strike(g, p, T, b, Math.sign(dx) || p.dir, px, py, fx);
  }
}
/** Hits everything whose body is within `r` of a point. */
export function radHits(g: any, p: any, x: number, y: number, r: number, b: Blow, rehit: number, fx?: HitDef['fx'], outward = true) {
  for (const T of foes(g, p.owner)) {
    if (Math.hypot(T.x - x, T.y - T.h / 2 - y) > r + T.hw) continue;
    const last = p.hitMap.get(T);
    if (last !== undefined && (rehit <= 0 || p.t - last < rehit)) continue;
    p.hitMap.set(T, p.t);
    strike(g, p, T, b, outward ? (T.x >= x ? 1 : -1) : p.dir, x, y, fx);
  }
}
export const spawn = (g: any, f: any, sig: string, o: any) => g.spawnProj({
  owner: f, type: 'sig', sig, x: f.x, y: f.y, vx: 0, vy: 0, w: 40, h: 40, life: 40,
  dmg: 0, ang: 40, kb: 4, sc: 4, dir: f.facing, fx: 'blunt', ...o, data: { ...(o.data || {}) },
});

// ===========================================================================
// MOTIF RENDERING
// ===========================================================================

/** A radial glow blob. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 1) {
  if (!(r > 0)) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.3, hexA(col, a * 0.8)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function jagPts(pts: [number, number][], amp: number, seed: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === 0 || i === pts.length - 1) { out.push([x, y]); continue; }
    const o = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    out.push([x + (o - Math.floor(o) - 0.5) * amp, y + (Math.sin(i * 7.1 + seed) * 0.5) * amp]);
  }
  return out;
}
function stroke(ctx: CanvasRenderingContext2D, pts: [number, number][], col: string, w: number) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
}

/**
 * Draws an energy ribbon along `pts` in the theme's motif. This one function is
 * what makes the same beam read as a lightning spear on Killua, a flame lash on
 * Rengoku, a black anti-magic cleave on Asta and a frozen lance on Todoroki.
 */
export function motifPath(ctx: CanvasRenderingContext2D, pts: [number, number][], w: number, th: Theme, t: number, alpha = 1) {
  if (pts.length < 2 || !(w > 0)) return;
  const m = th.motif;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (m === 'lightning' || m === 'hero') {
    // A soft band the width of the attack, with thin jagged bolts running
    // through it. Wide bolts in additive blending just burn out to white.
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, w > 24 ? 0.16 : 0.3), w * 1.25);
    const bolts = w > 24 ? 4 : 2, bw = clamp(w * 0.12, 1.4, 4.5);
    for (let k = 0; k < bolts; k++) {
      const off = (k / Math.max(1, bolts - 1) - 0.5) * w * 0.55;
      const shifted = pts.map(([x, y], i) => {
        const [px, py] = pts[Math.max(0, i - 1)], [qx, qy] = pts[Math.min(pts.length - 1, i + 1)];
        const dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy) || 1;
        return [x - dy / L * off, y + dx / L * off] as [number, number];
      });
      const j = jagPts(shifted, Math.min(26, w * 0.5), Math.floor(t / 2) + k * 3);
      stroke(ctx, j, hexA(th.c1, 0.55), bw * 2.6);
      stroke(ctx, j, '#ffffff', bw * 0.7);
    }
    if (m === 'hero') stroke(ctx, pts, hexA(th.c1, 0.22), w * 0.7);
  } else if (FIERY.includes(m)) {
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.3), w * 2.3);
    const wob = pts.map(([x, y], i) => [x, y + Math.sin(t * 0.5 + i * 1.3) * w * 0.25] as [number, number]);
    stroke(ctx, wob, hexA(th.c1, 0.8), w * 1.2);
    stroke(ctx, wob, hexA(th.c2, 0.95), w * 0.6);
    stroke(ctx, pts, '#fff7e0', w * 0.22);
    if (m === 'sun') stroke(ctx, pts, hexA('#ffffff', 0.25), w * 3);
  } else if (DARK.includes(m)) {
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.5), w * 1.8);
    ctx.globalCompositeOperation = 'source-over';
    stroke(ctx, pts, m === 'blood' ? '#2a0006' : '#07030a', w * 0.95);
    stroke(ctx, pts, hexA(th.c1, 0.9), w * 0.18);
    if (m === 'anti') { const j = jagPts(pts, w * 0.6, Math.floor(t / 3)); stroke(ctx, j, hexA('#ffffff', 0.5), 1.2); }
  } else if (m === 'ice') {
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.35), w * 1.8);
    ctx.globalCompositeOperation = 'source-over';
    stroke(ctx, pts, hexA('#e8fbff', 0.95), w * 0.8);
    stroke(ctx, pts, hexA(th.c1, 0.9), w * 0.3);
    // Crystal teeth along the edge.
    ctx.fillStyle = hexA('#ffffff', 0.9);
    for (let i = 1; i < pts.length; i += 2) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], a = Math.atan2(y - py, x - px) + Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * w * 0.4, y + Math.sin(a) * w * 0.4); ctx.lineTo(x + Math.cos(a) * w * 1.1, y + Math.sin(a) * w * 1.1); ctx.lineTo(x + Math.cos(a - 0.6) * w * 0.4, y + Math.sin(a - 0.6) * w * 0.4); ctx.fill();
    }
  } else if (m === 'water') {
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.35), w * 1.9);
    const a = pts.map(([x, y], i) => [x, y + Math.sin(t * 0.4 + i * 0.9) * w * 0.35] as [number, number]);
    const b = pts.map(([x, y], i) => [x, y - Math.sin(t * 0.4 + i * 0.9) * w * 0.35] as [number, number]);
    stroke(ctx, a, hexA(th.c1, 0.9), w * 0.45);
    stroke(ctx, b, hexA(th.c2, 0.9), w * 0.35);
    stroke(ctx, pts, '#ffffff', w * 0.15);
  } else if (m === 'wind' && w > 20) {
    // Air pressure: a faint band with speed-lines streaming through it.
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.14), w * 1.1);
    for (let k = 0; k < 6; k++) {
      const off = (k / 5 - 0.5) * w * 0.8, lag = ((t * 0.9 + k * 13) % 30) / 30;
      const shifted = pts.map(([x, y], i) => {
        const [px, py] = pts[Math.max(0, i - 1)], [qx, qy] = pts[Math.min(pts.length - 1, i + 1)];
        const dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy) || 1;
        return [x - dy / L * off, y + dx / L * off] as [number, number];
      }).slice(Math.floor(lag * pts.length * 0.3));
      if (shifted.length > 1) { stroke(ctx, shifted, hexA(th.c1, 0.35), 4); stroke(ctx, shifted, hexA('#ffffff', 0.8), 1.4); }
    }
  } else if (SHARP.includes(m)) {
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.3), w * 1.4);
    stroke(ctx, pts, hexA(th.c2 || th.c1, 0.8), w * 0.5);
    ctx.globalCompositeOperation = 'source-over';
    stroke(ctx, pts, '#ffffff', Math.max(1.2, w * 0.18));
  } else if (m === 'rubber' || m === 'titan' || m === 'stand') {
    stroke(ctx, pts, OL, w + 3.5);
    stroke(ctx, pts, th.c1, w);
    stroke(ctx, pts, hexA('#ffffff', 0.3), w * 0.3);
  } else {
    // ki / chakra / silver / rose / void / infinity: a soft, bright plasma.
    ctx.globalCompositeOperation = 'lighter';
    stroke(ctx, pts, hexA(th.c1, 0.25), w * 2.2);
    stroke(ctx, pts, hexA(th.c1, 0.7), w * 1.2);
    stroke(ctx, pts, hexA(th.c2, 0.9), w * 0.6);
    stroke(ctx, pts, '#ffffff', w * 0.25);
    if (m === 'infinity') { stroke(ctx, pts.map(([x, y], i) => [x, y + Math.sin(i + t * 0.3) * w * 0.6] as [number, number]), hexA(th.c3 || '#ff5577', 0.6), w * 0.3); }
  }
  ctx.restore();
}

/** One flavour particle for the motif, used by every entity's update. */
export function motifMote(g: any, x: number, y: number, th: Theme, vx = 0, vy = 0) {
  const m = th.motif;
  const kind = FIERY.includes(m) ? 'ember' : m === 'ice' ? 'shard' : DARK.includes(m) ? (R() < 0.5 ? 'smoke' : 'glow') : m === 'lightning' || m === 'hero' ? 'spark' : SHARP.includes(m) ? 'streak' : m === 'titan' || m === 'rubber' ? 'smoke' : 'glow';
  const col = DARK.includes(m) && kind === 'smoke' ? '#0b0610' : R() < 0.5 ? th.c1 : th.c2;
  g.fx.add({ x, y, vx: vx + (R() - 0.5) * 2, vy: vy - R() * 1.5, color: col, kind, life: 14 + R() * 8, size: 3 + R() * 4 });
  if ((m === 'lightning' || m === 'hero') && R() < 0.25) g.fx.bolt(x, y, x + (R() - 0.5) * 60, y + (R() - 0.5) * 60, th.c1, 5, 1.5);
}

/** An impact bloom in the motif at a point. */
export function motifBurst(g: any, x: number, y: number, r: number, th: Theme) {
  g.fx.ring(x, y, 4, r, th.c1, 14, 4);
  g.fx.add({ x, y, color: th.c1, kind: 'glow', life: 12, size: r * 0.5 });
  for (let i = 0; i < 6; i++) motifMote(g, x, y, th, (R() - 0.5) * 8, (R() - 0.5) * 8);
  if (DARK.includes(th.motif)) g.fx.burst(x, y, 8, '#0b0610', 5, 'smoke', 22, 8);
  if (th.motif === 'lightning' || th.motif === 'hero') for (let i = 0; i < 3; i++) g.fx.bolt(x, y, x + (R() - 0.5) * r * 2, y + (R() - 0.5) * r * 2, th.c1, 6, 2);
}

// ===========================================================================
// ENTITIES
// ===========================================================================

/** BEAM: charges at its origin, then fires a motif ribbon along an angle. */
SIGS.awk_beam = {
  init: (p) => { p.delay = MANUAL; },
  update: (p, g) => {
    const d = p.data, o = p.owner, th: Theme = d.th;
    if (d.follow) {
      if (o.state !== 'attack' && p.t > 2 && p.t < d.charge + d.fire) p.life = Math.min(p.life, 4);
      p.x = o.x + o.facing * d.ox; p.y = o.y + d.oy;
    }
    const t = p.t;
    if (t < d.charge) {
      if (t % 2 === 0) { const a = R() * TAU, r = d.width * (1.4 + R()); g.fx.add({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, color: R() < 0.5 ? th.c1 : th.c2, kind: 'glow', life: 12, size: 3 + R() * 3 }); }
      if (t === 1) sfx('energy-strike');
    }
    if (t === d.charge) { sfx(d.big ? 'ult' : SFX_OF[th.motif]); g.shake(d.big ? 16 : 8); g.flashScreen(th.c1, d.big ? 0.3 : 0.12); if (d.big) g.punchIn(p.x, p.y, 0.07); }
    if (t >= d.charge && t < d.charge + d.fire) {
      const k = t - d.charge;
      d.W = d.width * Math.min(1, (k + 1) / 3) * Math.min(1, (d.fire - k) / 5 + 0.2);
      d.L = d.len * Math.min(1, (k + 1) / 3);
      const x2 = p.x + Math.cos(d.ang) * d.L, y2 = p.y + Math.sin(d.ang) * d.L;
      if (k === d.fire - 1 && d.fin) { p.hitMap.clear(); segHits(g, p, p.x, p.y, x2, y2, d.W * 0.5, d.fin, 0, FX_OF[th.motif]); }
      else segHits(g, p, p.x, p.y, x2, y2, d.W * 0.5, d.tick, d.rehit || 5, FX_OF[th.motif]);
      if (k % 2 === 0) { const u = R(); motifMote(g, p.x + Math.cos(d.ang) * d.L * u, p.y + Math.sin(d.ang) * d.L * u, th, Math.cos(d.ang) * 6, Math.sin(d.ang) * 6); }
      if (k % 3 === 0) g.shake(d.big ? 6 : 3);
    }
    if (t >= d.charge + d.fire) { d.W = 0; if (t > d.charge + d.fire + 8) p.life = 0; }
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    if (p.t < d.charge) {
      const k = p.t / d.charge;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, d.width * (0.4 + k * 0.9), th.c1, 0.9);
      ctx.restore();
      return;
    }
    if (!d.W) return;
    const n = 18, pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) pts.push([p.x + Math.cos(d.ang) * d.L * i / n, p.y + Math.sin(d.ang) * d.L * i / n]);
    motifPath(ctx, pts, d.W, th, t);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, p.x, p.y, d.W * 1.2, th.c1, 1);
    glow(ctx, pts[n][0], pts[n][1], d.W * 0.9, th.c1, 0.8);
    ctx.restore();
  },
};

/** CRESCENT: a flying slash, one or two arcs, in the motif. */
SIGS.awk_slash = {
  init: (p) => { p.data.trail = []; },
  update: (p, g) => {
    const th: Theme = p.data.th;
    p.data.trail.unshift([p.x, p.y]); if (p.data.trail.length > 6) p.data.trail.pop();
    if (p.t % 2 === 0) motifMote(g, p.x - p.dir * p.w * 0.3, p.y + (R() - 0.5) * p.h * 0.6, th, -p.vx * 0.2, 0);
    if (p.t === 1) sfx(SFX_OF[th.motif]);
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    const a = clamp(Math.min(p.life / 6, (p.t + 1) / 3), 0, 1), r = p.h * 0.55;
    const arcs = d.count === 2 ? [-0.45, 0.45] : [0];
    for (const tilt of arcs) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 14; i++) {
        const an = -1.25 + i / 14 * 2.5;
        const rx = Math.cos(an) * r * 0.55, ry = Math.sin(an) * r;
        const x = rx * Math.cos(tilt) - ry * Math.sin(tilt), y = rx * Math.sin(tilt) + ry * Math.cos(tilt);
        pts.push([p.x + x * p.dir, p.y + y]);
      }
      const taper = Math.max(4, p.w * 0.16);
      motifPath(ctx, pts, taper, th, t, a);
    }
  },
};

/** ERUPTION: telegraphed, then a column of the motif bursts out of the floor (or falls from the sky). */
SIGS.awk_pillar = {
  update: (p, g) => {
    const th: Theme = p.data.th;
    if (p.t === p.delay) {
      sfx(SFX_OF[th.motif]); g.shake(p.data.big ? 12 : 6);
      motifBurst(g, p.x, p.y - 10, 50, th);
      if (th.motif === 'lightning' || th.motif === 'hero') g.flashScreen('#e8fbff', 0.18);
    }
    if (p.t > p.delay && p.t < p.delay + p.activeFor && p.t % 2 === 0) motifMote(g, p.x + (R() - 0.5) * p.w, p.y - R() * p.h, th, 0, -3);
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th, m = th.motif;
    const a = clamp(p.life / 8, 0, 1);
    const k = clamp((p.t - p.delay + 3) / 5, 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    if (p.t < p.delay) {
      const q = p.t / p.delay;
      ctx.strokeStyle = hexA(th.c1, 0.4 + q * 0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 0.6 * (0.5 + q * 0.5), 5, 0, 0, TAU); ctx.stroke();
      if (m === 'lightning' || m === 'hero') { ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(p.x, p.y - 600); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      ctx.restore(); return;
    }
    const h = p.h * k, w = p.w;
    if (m === 'lightning' || m === 'hero') {
      motifPath(ctx, [[p.x, p.y - 620], [p.x - 10, p.y - 450], [p.x + 12, p.y - 300], [p.x - 8, p.y - 150], [p.x, p.y]], w * 0.35, th, t);
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, p.x, p.y - 10, w * 1.2, th.c1, 0.8);
    } else if (m === 'ice') {
      for (let i = 0; i < 5; i++) {
        const sx = p.x + (i - 2) * w * 0.22, sh = h * (0.55 + ((i * 37) % 10) / 22) * (i === 2 ? 1.15 : 1);
        ctx.beginPath(); ctx.moveTo(sx - w * 0.14, p.y); ctx.lineTo(sx + (i - 2) * 3, p.y - sh); ctx.lineTo(sx + w * 0.14, p.y); ctx.closePath();
        const g = ctx.createLinearGradient(sx, p.y - sh, sx, p.y); g.addColorStop(0, '#ffffff'); g.addColorStop(1, th.c1);
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = shade(th.c1, 0.6); ctx.lineWidth = 1.4; ctx.stroke();
      }
    } else if (m === 'titan' || m === 'rubber' || m === 'stand') {
      ctx.beginPath(); ctx.moveTo(p.x - w * 0.5, p.y); ctx.lineTo(p.x - w * 0.3, p.y - h * 0.8); ctx.lineTo(p.x + w * 0.05, p.y - h); ctx.lineTo(p.x + w * 0.35, p.y - h * 0.7); ctx.lineTo(p.x + w * 0.5, p.y); ctx.closePath();
      ctx.fillStyle = th.c1; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = shade(th.c1, 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x - w * 0.1, p.y - h * 0.2); ctx.lineTo(p.x + w * 0.05, p.y - h * 0.7); ctx.stroke();
    } else {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 8; i++) pts.push([p.x + Math.sin(t * 0.4 + i) * (FIERY.includes(m) ? w * 0.08 : 0), p.y - h * i / 8]);
      motifPath(ctx, pts, w * 0.8, th, t);
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, p.x, p.y - 6, w, th.c1, 0.7);
    }
    ctx.restore();
  },
};

/** ORB: a travelling sphere that bursts when it lands or when its time is up. */
SIGS.awk_orb = {
  init: (p) => { p.data.trail = []; },
  update: (p, g) => {
    const th: Theme = p.data.th;
    p.data.trail.unshift([p.x, p.y]); if (p.data.trail.length > 8) p.data.trail.pop();
    if (p.data.grav) p.vy += p.data.grav;
    if (p.t % 2 === 0) motifMote(g, p.x, p.y, th, -p.vx * 0.2, -p.vy * 0.2);
    const gy = g.groundBelow(p.x, p.y - 30);
    if (gy !== null && p.y + p.h * 0.3 >= gy && p.t > 3) p.life = 0;
  },
  onHit: (p) => { if (!p.data.pierce) p.life = 0; },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th, m = th.motif, r = p.w * 0.5;
    const a = clamp(Math.min(p.life / 4, (p.t + 1) / 3), 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'lighter';
    d.trail.forEach(([x, y]: [number, number], i: number) => glow(ctx, x, y, r * (1 - i / 9), th.c1, 0.25));
    if (DARK.includes(m)) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#07030a'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = th.c1; ctx.lineWidth = 3; ctx.stroke();
    } else {
      glow(ctx, p.x, p.y, r * 1.3, th.c1, 1);
      // Spiralling surface: the Rasengan / genki-dama read.
      ctx.strokeStyle = hexA(th.c2, 0.85); ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(p.x, p.y, r * (0.35 + i * 0.15), t * 0.3 + i, t * 0.3 + i + 2.4); ctx.stroke(); }
    }
    if (m === 'wind' || m === 'chakra') {
      // Shuriken blades of wind around the core.
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA('#ffffff', 0.55);
      for (let i = 0; i < 4; i++) {
        const an = t * 0.45 + i * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(an) * r * 0.5, p.y + Math.sin(an) * r * 0.5);
        ctx.quadraticCurveTo(p.x + Math.cos(an + 0.5) * r * 1.8, p.y + Math.sin(an + 0.5) * r * 1.8, p.x + Math.cos(an + 1.1) * r * 2.4, p.y + Math.sin(an + 1.1) * r * 2.4);
        ctx.quadraticCurveTo(p.x + Math.cos(an + 0.4) * r * 1.1, p.y + Math.sin(an + 0.4) * r * 1.1, p.x + Math.cos(an) * r * 0.5, p.y + Math.sin(an) * r * 0.5);
        ctx.fill();
      }
    }
    ctx.restore();
  },
};

/** VORTEX: pulls foes in, grinds them, then detonates. */
SIGS.awk_vortex = {
  init: (p) => { p.delay = MANUAL; },
  update: (p, g) => {
    const d = p.data, th: Theme = d.th;
    if (d.follow) { p.x = p.owner.x + p.owner.facing * d.ox; p.y = p.owner.y + d.oy; }
    if (p.t === 1) sfx(SFX_OF[th.motif]);
    if (p.t < d.dur) {
      for (const T of foes(g, p.owner)) {
        const dx = p.x - T.x, dy = p.y - (T.y - T.h / 2), L = Math.hypot(dx, dy) || 1;
        if (L > d.r * 1.8) continue;
        T.vx = clamp(T.vx + dx / L * d.pull, -9, 9); T.vy = clamp(T.vy + dy / L * d.pull * 0.6 - 0.3, -9, 9);
      }
      if (p.t % d.every === 0) radHits(g, p, p.x, p.y, d.r, d.tick, d.every - 1, FX_OF[th.motif], false);
      if (p.t % 2 === 0) { const a = R() * TAU, r = d.r * (1 + R()); motifMote(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, th, -Math.cos(a) * 5, -Math.sin(a) * 5); }
      if (p.t % 6 === 0) g.shake(2);
    }
    if (p.t === d.dur) {
      p.hitMap.clear(); radHits(g, p, p.x, p.y, d.r * 1.35, d.fin, 0, FX_OF[th.motif]);
      motifBurst(g, p.x, p.y, d.r * 1.6, th); g.shake(14); g.flashScreen(th.c1, 0.2); sfx('heavyhit');
      p.life = Math.min(p.life, 10);
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    const post = p.t >= d.dur, a = post ? clamp(p.life / 10, 0, 1) : clamp(p.t / 5, 0, 1);
    const r = post ? d.r * (1 + (10 - p.life) * 0.12) : d.r * (0.6 + 0.4 * Math.min(1, p.t / 10));
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x, p.y);
    for (let i = 0; i < 5; i++) {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12, an = t * 0.18 + i * TAU / 5 + u * 3.2; pts.push([Math.cos(an) * r * (1.25 - u), Math.sin(an) * r * (1.25 - u) * 0.8]); }
      motifPath(ctx, pts, 5, th, t, 0.8);
    }
    ctx.globalCompositeOperation = 'lighter';
    if (DARK.includes(th.motif)) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#05020a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, TAU); ctx.fill(); }
    else glow(ctx, 0, 0, r * 0.6, th.c1, 0.9);
    ctx.restore();
  },
};

/** GROUND WAVE: rolls along the floor in the motif. */
SIGS.awk_wave = {
  update: (p, g) => {
    const th: Theme = p.data.th;
    const gy = g.groundBelow(p.x, p.y - 60);
    if (gy === null) p.life = Math.min(p.life, 4); else p.y = gy;
    if (p.t % 2 === 0) motifMote(g, p.x + (R() - 0.5) * p.w, p.y - R() * p.h * 0.8, th, p.vx * 0.2, -2);
    if (p.t % 6 === 0) g.shake(2);
    if (p.t === 1) sfx(SFX_OF[th.motif]);
  },
  draw: (p, ctx, t) => {
    const th: Theme = p.data.th, m = th.motif;
    const a = clamp(Math.min(p.life / 6, (p.t + 1) / 3), 0, 1), w = p.w, h = p.h;
    ctx.save(); ctx.globalAlpha *= a;
    if (FIERY.includes(m) || m === 'blood') {
      // A rolling wall of flame: tongues leaning with the direction of travel.
      ctx.globalCompositeOperation = 'lighter';
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y);
        const n = 8;
        for (let i = 0; i <= n; i++) {
          const u = i / n, x = p.x - w / 2 + u * w;
          const hh = h * (0.45 + Math.sin(u * Math.PI) * 0.55) * (layer ? 0.7 : 1) * (0.85 + Math.sin(t * 0.5 + i * 1.9) * 0.15);
          ctx.quadraticCurveTo(x - p.dir * 6, p.y - hh * 0.6, x + p.dir * hh * 0.18, p.y - hh);
        }
        ctx.lineTo(p.x + w / 2, p.y); ctx.closePath();
        const g = ctx.createLinearGradient(0, p.y, 0, p.y - h);
        g.addColorStop(0, hexA(layer ? th.c2 : th.c1, 0.85)); g.addColorStop(1, hexA(th.c1, 0));
        ctx.fillStyle = g; ctx.fill();
      }
    } else if (m === 'ice' || m === 'titan' || m === 'stand') {
      for (let i = 0; i < 6; i++) {
        const u = i / 5, x = p.x - w / 2 + u * w, sh = h * (0.45 + Math.sin(u * Math.PI) * 0.55);
        ctx.beginPath(); ctx.moveTo(x - 8, p.y); ctx.lineTo(x + p.dir * 4, p.y - sh); ctx.lineTo(x + 8, p.y); ctx.closePath();
        ctx.fillStyle = m === 'ice' ? hexA('#eafcff', 0.95) : th.c1; ctx.fill(); ctx.strokeStyle = m === 'ice' ? th.c1 : OL; ctx.lineWidth = 1.6; ctx.stroke();
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const pts: [number, number][] = [];
        for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([p.x - w / 2 + u * w, p.y - Math.sin(u * Math.PI) * h * (1 - i * 0.25) - Math.sin(t * 0.4 + k) * 2]); }
        motifPath(ctx, pts, 7 - i * 1.5, th, t + i * 5);
      }
    }
    ctx.restore();
  },
};

/**
 * GIANT: a summoned body part - a fist the size of a car, a titan's foot, a
 * Susanoo's hand, a chainsaw blade - travelling along a path and hitting
 * everything it passes.
 */
SIGS.awk_giant = {
  init: (p) => { p.delay = MANUAL; const d = p.data; d.x0 = p.x; d.y0 = p.y; },
  update: (p, g) => {
    const d = p.data, th: Theme = d.th;
    const k = clamp((p.t - d.wind) / d.travel, 0, 1), e = 1 - Math.pow(1 - k, 2);
    p.x = d.x0 + (d.x1 - d.x0) * e; p.y = d.y0 + (d.y1 - d.y0) * e;
    if (p.t === 1) sfx('whoosh');
    if (p.t === d.wind) sfx(SFX_OF[th.motif]);
    if (p.t >= d.wind && p.t <= d.wind + d.travel) {
      const last = p.t === d.wind + d.travel;
      if (last && d.fin) { p.hitMap.clear(); radHits(g, p, p.x, p.y, d.size, d.fin, 0, FX_OF[th.motif]); motifBurst(g, p.x, p.y, d.size * 1.4, th); g.shake(16); g.flashScreen(th.c1, 0.2); sfx('heavyhit', 2); g.punchIn(p.x, p.y, 0.08); }
      else radHits(g, p, p.x, p.y, d.size * 0.9, d.tick, d.rehit || 5, FX_OF[th.motif]);
      if (p.t % 2 === 0) motifMote(g, p.x, p.y, th, -(d.x1 - d.x0) * 0.02, -(d.y1 - d.y0) * 0.02);
    }
    if (p.t > d.wind + d.travel + 12) p.life = 0;
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th, s = d.size;
    const end = d.wind + d.travel;
    const a = p.t > end ? clamp(1 - (p.t - end) / 12, 0, 1) : clamp((p.t + 1) / 5, 0, 1);
    const ang = Math.atan2(d.y1 - d.y0, d.x1 - d.x0);
    ctx.save(); ctx.globalAlpha *= a;
    // Motion smear behind it.
    const tail: [number, number][] = [[p.x - Math.cos(ang) * s * 2.2, p.y - Math.sin(ang) * s * 2.2], [p.x, p.y]];
    motifPath(ctx, tail, s * 0.9, th, t, 0.45);
    ctx.translate(p.x, p.y); ctx.rotate(ang);
    const body = d.body || th.c1;
    // Energy constructs (a chakra tail, a One For All fist, a ki dragon) glow;
    // physical ones (a rubber fist, a titan's foot, a saw) are solid and inked.
    const energy = !d.body && !['rubber', 'titan', 'stand', 'saw'].includes(th.motif) && d.form !== 'roller' && d.form !== 'saw';
    const edge = (fill: string) => {
      if (energy) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6);
        eg.addColorStop(0, 'rgba(255,255,255,.9)'); eg.addColorStop(0.45, hexA(th.c1, 0.75)); eg.addColorStop(1, hexA(th.c1, 0.25));
        ctx.fillStyle = eg; ctx.fill();
        ctx.strokeStyle = hexA('#ffffff', 0.85); ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = Math.max(2, s * 0.06); ctx.stroke();
    };
    const lit = (x: number, y: number, rr: number) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, rr, th.c1, 0.6); ctx.restore(); };
    lit(0, 0, s * 1.4);
    if (d.form === 'fist' || d.form === 'arm') {
      if (d.form === 'arm') { ctx.beginPath(); ctx.roundRect(-s * 2.6, -s * 0.45, s * 2.2, s * 0.9, s * 0.3); edge(shade(body, 0.85)); }
      ctx.beginPath(); ctx.roundRect(-s * 0.7, -s * 0.8, s * 1.55, s * 1.6, s * 0.45); edge(body);
      ctx.strokeStyle = hexA('#000000', 0.35); ctx.lineWidth = Math.max(1, s * 0.05);
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(s * 0.35, -s * 0.8 + i * s * 0.4); ctx.lineTo(s * 0.85, -s * 0.8 + i * s * 0.4); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(s * 0.05, s * 0.45, s * 0.55, s * 0.26, -0.2, 0, TAU); edge(shade(body, 0.9));
      ctx.fillStyle = hexA('#ffffff', 0.3); ctx.beginPath(); ctx.ellipse(s * 0.3, -s * 0.5, s * 0.4, s * 0.14, 0, 0, TAU); ctx.fill();
    } else if (d.form === 'palm' || d.form === 'bonehand') {
      for (let i = 0; i < 4; i++) {
        const fy = (i - 1.5) * s * 0.36;
        ctx.beginPath(); ctx.roundRect(s * 0.2, fy - s * 0.14, s * (1.3 - Math.abs(i - 1.5) * 0.2), s * 0.28, s * 0.14);
        edge(d.form === 'bonehand' ? hexA(body, 0.85) : body);
      }
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.72, 0, 0, TAU); edge(d.form === 'bonehand' ? hexA(body, 0.85) : body);
      if (d.form === 'bonehand') { ctx.strokeStyle = hexA('#ffffff', 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.5, 0, 0, TAU); ctx.stroke(); }
    } else if (d.form === 'foot') {
      ctx.beginPath(); ctx.roundRect(-s * 0.9, -s * 0.55, s * 1.9, s * 1.1, s * 0.5); edge(body);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(s * 0.95, (i - 2) * s * 0.2, s * 0.13, 0, TAU); edge(body); }
    } else if (d.form === 'blade' || d.form === 'susanooblade') {
      ctx.beginPath(); ctx.moveTo(-s * 1.8, -s * 0.12); ctx.lineTo(s * 1.6, -s * 0.18); ctx.lineTo(s * 2.1, 0); ctx.lineTo(s * 1.6, s * 0.18); ctx.lineTo(-s * 1.8, s * 0.12); ctx.closePath();
      if (d.form === 'susanooblade') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(th.c1, 0.8); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      else edge('#e8eef5');
    } else if (d.form === 'saw') {
      ctx.rotate(t * 0.5);
      ctx.fillStyle = '#c9ccd4'; ctx.strokeStyle = OL; ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.beginPath(); ctx.moveTo(s * 0.7, -s * 0.12); ctx.lineTo(s * 1.05, 0); ctx.lineTo(s * 0.7, s * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, TAU); edge('#8d929c');
      ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); edge(th.c1);
    } else if (d.form === 'tail') {
      // A tailed beast's tail: a long tapered plume curling at the tip.
      ctx.beginPath();
      ctx.moveTo(-s * 2.6, -s * 0.45);
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.9, s * 0.9, -s * 0.5);
      ctx.quadraticCurveTo(s * 1.6, -s * 0.2, s * 1.3, s * 0.3);
      ctx.quadraticCurveTo(s * 0.4, s * 0.8, -s * 2.6, s * 0.45);
      ctx.closePath();
      edge(body);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-s * 2.2 + i * s * 0.9, -s * 0.2); ctx.quadraticCurveTo(-s * 1.6 + i * s * 0.9, s * 0.1, -s * 1.2 + i * s * 0.9, s * 0.25); ctx.stroke(); }
      ctx.restore();
    } else if (d.form === 'dragon') {
      // A serpentine head with jaws open, trailing its body in the smear.
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.45); ctx.quadraticCurveTo(s * 0.4, -s * 0.8, s * 1.3, -s * 0.2); ctx.lineTo(s * 0.4, 0); ctx.lineTo(s * 1.2, s * 0.35); ctx.quadraticCurveTo(0, s * 0.6, -s, s * 0.45); ctx.closePath();
      edge(body);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.35, s * 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = shade(body, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.5); ctx.lineTo(-s * 1.2, -s * 1.0); ctx.stroke();
    } else if (d.form === 'roller') {
      // A road roller: yellow cab over a heavy steel drum, falling nose-first.
      ctx.rotate(-ang + Math.PI / 2 * 0.15);
      ctx.beginPath(); ctx.roundRect(-s * 1.1, -s * 0.9, s * 2.2, s * 1.1, s * 0.12); edge('#f2c21b');
      ctx.fillStyle = '#1b1b22'; ctx.fillRect(-s * 0.9, -s * 0.72, s * 0.7, s * 0.4);
      ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(s * 0.28)}px sans-serif`; ctx.fillText('ROAD', -s * 0.05, -s * 0.44);
      ctx.beginPath(); ctx.roundRect(-s * 1.2, s * 0.15, s * 2.4, s * 0.85, s * 0.4); edge('#6e737c');
      ctx.strokeStyle = hexA('#ffffff', 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s, s * 0.35); ctx.lineTo(s, s * 0.35); ctx.stroke();
    } else {
      // 'ball': a boulder or a frozen meteor.
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); edge(body);
      ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(Math.cos(i * 1.6) * s * 0.2, Math.sin(i * 1.6) * s * 0.2); ctx.lineTo(Math.cos(i * 1.6) * s * 0.85, Math.sin(i * 1.6 + 0.3) * s * 0.85); ctx.stroke(); }
    }
    ctx.restore();
  },
};

/** VOLLEY SHARD: knives, kunai, feathers, bullets, ice darts, bolts, spears. */
SIGS.awk_shard = {
  update: (p, g) => {
    const d = p.data, th: Theme = d.th;
    if (d.grav) p.vy += d.grav;
    d.ang = Math.atan2(p.vy, p.vx);
    if (p.t % 3 === 0) motifMote(g, p.x, p.y, th, -p.vx * 0.1, -p.vy * 0.1);
    const gy = g.groundBelow(p.x, p.y - 30);
    if (gy !== null && p.y >= gy && p.t > 2) { p.life = 0; motifBurst(g, p.x, gy - 4, d.form === 'spear' ? 50 : 14, th); if (d.form === 'spear') g.shake(8); }
  },
  onHit: (p, _t, g) => { p.life = 0; motifBurst(g, p.x, p.y, p.data.form === 'spear' ? 50 : 16, p.data.th); },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th, s = Math.max(p.w, p.h) * 0.6;
    const a = clamp(Math.min(p.life / 4, (p.t + 1) / 2), 0, 1);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x, p.y); ctx.rotate(d.ang ?? (p.dir > 0 ? 0 : Math.PI));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, -s * 0.2, 0, s * 1.2, th.c1, 0.55);
    stroke(ctx, [[-s * 2.4, 0], [-s * 0.4, 0]], hexA(th.c1, 0.4), s * 0.4); ctx.restore();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
    switch (d.form) {
      case 'knife': case 'kunai':
        ctx.fillStyle = '#e9edf5'; ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.2, -s * 0.28); ctx.lineTo(-s * 0.2, s * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.form === 'kunai' ? '#2a2a33' : '#e8c33a'; ctx.fillRect(-s * 0.9, -s * 0.12, s * 0.7, s * 0.24); ctx.strokeRect(-s * 0.9, -s * 0.12, s * 0.7, s * 0.24);
        if (d.form === 'kunai') { ctx.beginPath(); ctx.arc(-s * 1.05, 0, s * 0.16, 0, TAU); ctx.stroke(); }
        break;
      case 'feather':
        ctx.fillStyle = th.c1; ctx.beginPath(); ctx.moveTo(s, 0); ctx.quadraticCurveTo(0, -s * 0.5, -s, 0); ctx.quadraticCurveTo(0, s * 0.5, s, 0); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 1.1, 0); ctx.stroke();
        break;
      case 'ice':
        ctx.fillStyle = '#eafcff'; ctx.beginPath(); ctx.moveTo(s * 1.2, 0); ctx.lineTo(0, -s * 0.34); ctx.lineTo(-s * 0.8, 0); ctx.lineTo(0, s * 0.34); ctx.closePath(); ctx.fill(); ctx.strokeStyle = th.c1; ctx.stroke();
        break;
      case 'spear':
        ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = s * 0.18; ctx.beginPath(); ctx.moveTo(-s * 1.6, 0); ctx.lineTo(s * 0.4, 0); ctx.stroke();
        ctx.fillStyle = '#d7dde6'; ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s * 1.3, 0); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 0.3, s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'star': {
        ctx.rotate(t * 0.6); ctx.fillStyle = '#c9ccd6';
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.3 : s; const an = i * Math.PI / 4; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      default: {
        // bullet / bolt / flame: a hot slug with a motif core.
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, s * 0.9, th.c1, 1); ctx.restore();
        ctx.fillStyle = th.c2 || '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.26, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  },
};

/** FIELD: a zone that grinds anything inside it, following its owner or fixed. */
SIGS.awk_field = {
  init: (p) => { p.delay = MANUAL; },
  update: (p, g) => {
    const d = p.data, th: Theme = d.th;
    if (d.follow) { p.x = p.owner.x; p.y = p.owner.y - 44; }
    if (p.t === 1) sfx(SFX_OF[th.motif]);
    if (p.t < d.dur) {
      if (p.t % d.every === 0) radHits(g, p, p.x, p.y, d.r, d.tick, d.every - 1, FX_OF[th.motif]);
      for (let i = 0; i < 2; i++) { const a = R() * TAU, r = R() * d.r; motifMote(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, th, 0, -1); }
    }
    if (p.t === d.dur && d.fin) { p.hitMap.clear(); radHits(g, p, p.x, p.y, d.r * 1.1, d.fin, 0, FX_OF[th.motif]); motifBurst(g, p.x, p.y, d.r * 1.3, th); g.shake(12); sfx('heavyhit'); }
    if (p.t >= d.dur) p.life = Math.min(p.life, 10);
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    const a = p.t >= d.dur ? clamp(p.life / 10, 0, 1) : clamp(p.t / 6, 0, 1);
    const r = d.r * (0.8 + 0.2 * Math.min(1, p.t / 8));
    ctx.save(); ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
    g.addColorStop(0, hexA(th.c1, 0.06)); g.addColorStop(0.8, hexA(th.c1, 0.18)); g.addColorStop(1, hexA(th.c1, 0.4));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.restore();
    const n = 28, pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const an = i / n * TAU + t * 0.03; pts.push([p.x + Math.cos(an) * r, p.y + Math.sin(an) * r]); }
    motifPath(ctx, pts, 4, th, t, a);
    // Inner slashes / sparks so the zone reads as dangerous, not decorative.
    for (let i = 0; i < 4; i++) {
      const an = t * 0.2 + i * 1.7, rr = r * (0.3 + ((i * 29 + Math.floor(t / 4)) % 10) / 16);
      motifPath(ctx, [[p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr], [p.x + Math.cos(an + 0.9) * rr * 0.6, p.y + Math.sin(an + 0.9) * rr * 0.6]], 3, th, t, a * 0.9);
    }
  },
};

/** SHOCKWAVE: an expanding ring that hits each foe once as it passes them. */
SIGS.awk_ring = {
  init: (p) => { p.delay = MANUAL; },
  update: (p, g) => {
    const d = p.data, th: Theme = d.th;
    d.rr = d.r * Math.min(1, (p.t + 1) / d.grow);
    if (p.t === 1) { sfx(SFX_OF[th.motif]); g.shake(d.big ? 14 : 7); }
    if (p.t <= d.grow) radHits(g, p, p.x, p.y, d.rr, d.blow, 0, FX_OF[th.motif]);
    if (p.t > d.grow + 8) p.life = 0;
  },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    const a = clamp(1 - (p.t - d.grow) / 8, 0, 1);
    const n = 32, pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const an = i / n * TAU; pts.push([p.x + Math.cos(an) * d.rr, p.y + Math.sin(an) * d.rr * (d.flat ? 0.3 : 1)]); }
    const physical = ['rubber', 'titan', 'stand', 'saw'].includes(th.motif);
    // Physical shockwaves are pressure, not energy: a pale distortion ring with
    // a dust skirt, tinted by the owner's colour.
    const look: Theme = physical ? { c1: th.c1 === '#ffffff' ? '#fff3c0' : th.c1, c2: '#ffffff', motif: 'wind' } : th;
    motifPath(ctx, pts, 6 * a + 2, look, t, a);
    if (physical || d.flat) {
      ctx.save(); ctx.globalAlpha *= a * 0.5;
      const g = ctx.createRadialGradient(p.x, p.y, d.rr * 0.6, p.x, p.y, d.rr);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, hexA(look.c1, 0.35));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, d.rr, d.rr * (d.flat ? 0.3 : 1), 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  },
};

/** AFTERIMAGE: a frozen ghost of the owner left behind by a blink. Visual only. */
SIGS.awk_ghost = {
  init: (p) => {
    p.delay = MANUAL;
    const o = p.owner;
    p.data.mock = mockOf(o, p.x, p.y, p.dir);
    p.data.mock.state = 'attack'; p.data.mock.move = { anim: p.data.anim || 'slash', startup: 1, dur: 10, hits: [], turns: 0 }; p.data.mock.moveFrame = 3; p.data.mock.moveActiveEnd = 4;
  },
  draw: (p, ctx, t) => {
    const a = clamp(p.life / 12, 0, 1) * 0.55;
    ctx.save(); ctx.globalAlpha *= a;
    drawFighter(ctx, p.data.mock, computePose(p.data.mock), t);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, p.x, p.y - 44, 40, p.data.th.c1, 0.3 * a); ctx.restore();
  },
};

function mockOf(o: any, x: number, y: number, facing: number) {
  return {
    x, y, vx: 0, vy: 0, facing, scale: o.scale, look: o.look, def: o.def, idx: o.idx,
    grounded: true, state: 'idle', stateT: 0, animT: o.animT || 0, runPhase: 0, devilT: 0, godT: 0, auraT: 0, djumpT: 99, landT: 0, tumble: 0,
    hw: o.hw, h: o.h, move: null, moveFrame: 0, moveActiveEnd: 0, tipX: 0, tipY: 0, footX: 0, footY: 0, handX: 0, handY: 0,
    awakened: true, trail: [], ghosts: [],
  };
}

/**
 * CLONE: a full copy of the fighter that runs the nearest foe down and performs
 * its own short string (shadow clones, afterimage doubles, a Stand's rush).
 */
SIGS.awk_clone = {
  init: (p) => { p.delay = MANUAL; p.data.mock = mockOf(p.owner, p.x, p.y, p.dir); },
  update: (p, g) => {
    const d = p.data, m = d.mock, o = p.owner, th: Theme = d.th;
    m.animT++;
    const T = g.nearestEnemy(o, 800);
    if (!d.air) { const gy = g.groundBelow(m.x, m.y - 60); if (gy !== null) m.y = gy; }
    if (p.t < 5) return;
    const seq: { at: number; anim: AnimName; blow: Blow }[] = d.seq;
    if (d.phase === undefined) {
      if (T) m.facing = T.x >= m.x ? 1 : -1;
      const close = T && Math.abs(T.x - m.x) < 56 && Math.abs(T.y - m.y) < 90;
      if (close || p.t > (d.runFor || 34)) { d.phase = 0; d.start = p.t; }
      else {
        m.state = 'run'; m.x += m.facing * (d.speed || 11); m.runPhase += 0.4;
        if (d.air && T) m.y += clamp(T.y - m.y, -6, 6);
      }
      return;
    }
    const k = p.t - d.start;
    const cur = seq.slice().reverse().find(s => k >= s.at);
    const endAt = seq[seq.length - 1].at + 14;
    if (cur && k - cur.at < 12 && k < endAt) {
      m.state = 'attack'; m.move = { anim: cur.anim, startup: 3, dur: 12, hits: [], turns: 1 }; m.moveFrame = k - cur.at; m.moveActiveEnd = 6;
      if (k - cur.at === 3) {
        for (const E of foes(g, o)) {
          if (Math.abs(E.x - (m.x + m.facing * 40)) < 56 && Math.abs(E.y - E.h / 2 - (m.y - 44)) < 64) {
            strike(g, p, E, cur.blow, m.facing, E.x, E.y - 40, FX_OF[th.motif]);
            motifBurst(g, E.x, E.y - 40, 30, th);
          }
        }
        sfx('swingH');
      }
    } else if (k >= endAt) {
      if (k === endAt) { g.fx.burst(m.x, m.y - 40, 16, th.c1, 5, 'smoke', 20, 8); if (d.poof) g.fx.text(m.x, m.y - 90, d.poof, '#ffffff', 16, 18); }
      p.life = 0;
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data, m = d.mock, th: Theme = d.th;
    const a = clamp((p.t + 1) / 5, 0, 1);
    ctx.save(); ctx.globalAlpha *= a * (d.alpha ?? 0.9);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, m.x, m.y - 44, 46, th.c1, 0.35); ctx.restore();
    drawFighter(ctx, m, computePose(m), t);
    ctx.restore();
  },
};

/** A grab's reach: a line (or a snapping hand of energy) shot out and reeled back. Visual only. */
SIGS.awk_reach = {
  init: (p) => { p.delay = MANUAL; },
  update: (p) => { const o = p.owner; p.x = o.x + o.facing * 20; p.y = o.y - 50; },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    const k = p.t < 5 ? p.t / 5 : Math.max(0, 1 - (p.t - 5) / 7);
    const ex = p.x + (d.tx - p.x) * k, ey = p.y + (d.ty - p.y) * k;
    if (d.tether) motifPath(ctx, [[p.x, p.y], [(p.x + ex) / 2, (p.y + ey) / 2 + 6], [ex, ey]], 3, th, t);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, ex, ey, 16 + k * 10, th.c1, 0.7); ctx.restore();
  },
};

/** Fists (or blades) blurring in front of a barrage. Visual only. */
SIGS.awk_blur = {
  init: (p) => { p.delay = MANUAL; },
  update: (p) => { p.x = p.owner.x + p.owner.facing * p.data.ox; p.y = p.owner.y + p.data.oy; p.dir = p.owner.facing; },
  draw: (p, ctx, t) => {
    const d = p.data, th: Theme = d.th;
    const a = clamp(Math.min(p.life / 6, (p.t + 1) / 3), 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < 7; i++) {
      const s = Math.sin(t * 1.9 + i * 2.3), c = Math.cos(t * 1.3 + i * 1.7);
      const x = p.x + p.dir * (s * 0.5 + 0.5) * d.reach, y = p.y + c * d.spread;
      if (d.blades) motifPath(ctx, [[x - p.dir * 26, y - 10], [x + p.dir * 10, y + 8]], 3, th, t);
      else {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 12, th.c1, 0.5); ctx.restore();
        ctx.fillStyle = d.skin || '#f0c8a0'; ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.roundRect(x - 6, y - 5.5, 12, 11, 4); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  },
};

// ===========================================================================
// MOVE BUILDERS
// ===========================================================================

export type Tier = 'awaken' | 'awakenLight' | 'awakenHeavy' | 'awakened';
export type Stance = 'neutral' | 'side' | 'down' | 'air';
export interface KitCtx { id: string; th: Theme; }
type Part = Partial<MoveDef> & Record<string, any>;

const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, b: Blow, extra: Partial<HitDef> = {}): HitDef =>
  ({ f: [f0, f1], x, y, w, h, dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, ...extra });

/** Where to put a summon: under the nearest foe, or a set distance ahead. */
export function aimPoint(g: any, f: any, range: number, ahead: number) {
  const t = g.nearestEnemy(f, range);
  const x = t ? t.x : f.x + f.facing * ahead;
  const gy = g.groundBelow(x, (t ? t.y : f.y) - 60);
  return { t, x, y: gy ?? (t ? t.y : f.y), ty: t ? t.y - t.h / 2 : f.y - 50 };
}
function aimAngle(f: any, sx: number, sy: number, t: any, spread: number) {
  const base = f.facing > 0 ? 0 : Math.PI;
  if (!t || (t.x - f.x) * f.facing < -10) return base;
  let d = Math.atan2(t.y - t.h / 2 - sy, t.x - sx) - base;
  while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
  return base + clamp(d, -spread, spread);
}
const at = (frame: number, fn: (f: any, g: any) => void) => (f: any, fr: number, g: any) => { if (fr === frame) fn(f, g); };

/** Energy beam from the hand. `aim`: 'fwd' | 'aim' | 'down' | 'up' | 'diag'. */
export function beam(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; aim?: 'fwd' | 'aim' | 'down' | 'up' | 'diag'; len?: number; width?: number; charge?: number; fire?: number; tick?: Blow; fin?: Blow; oy?: number; ox?: number; big?: boolean; follow?: boolean; rehit?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 8, charge = o.charge ?? 10, fire = o.fire ?? 18;
  return {
    anim: o.anim ?? 'cast', startup: su, dur: o.dur ?? Math.max(su + charge + fire + 6, 40), hits: [], grav: 0.2,
    onFrame: at(su, (f, g) => {
      const ox = o.ox ?? 36, oy = o.oy ?? -50;
      const sx = f.x + f.facing * ox, sy = f.y + oy;
      const t = g.nearestEnemy(f, 900);
      const fwd = f.facing > 0 ? 0 : Math.PI;
      const ang = o.aim === 'aim' ? aimAngle(f, sx, sy, t, 0.6) : o.aim === 'down' ? Math.PI / 2 : o.aim === 'up' ? -Math.PI / 2 : o.aim === 'diag' ? (f.facing > 0 ? 0.75 : Math.PI - 0.75) : fwd;
      spawn(g, f, 'awk_beam', { x: sx, y: sy, life: charge + fire + 12, data: { th: c.th, ang, len: o.len ?? 800, width: o.width ?? 44, charge, fire, tick: o.tick ?? { dmg: 2.2, ang: 45, kb: 1.4, sc: 0, stun: 8 }, fin: o.fin ?? { dmg: 10, ang: 40, kb: 8.4, sc: 8.6 }, follow: o.follow ?? true, ox, oy, big: o.big, rehit: o.rehit } });
    }),
  };
}

/** Flying crescent slash(es). */
export function crescent(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; size?: number; speed?: number; n?: number; x?: boolean; blow?: Blow; rehit?: number; life?: number; oy?: number; vy?: number; gap?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 7, n = o.n ?? 1, gap = o.gap ?? 5;
  return {
    anim: o.anim ?? 'slash', startup: su, dur: o.dur ?? su + (n - 1) * gap + 22, hits: [],
    onFrame: (f: any, fr: number, g: any) => {
      for (let i = 0; i < n; i++) if (fr === su + i * gap) {
        const size = o.size ?? 90;
        spawn(g, f, 'awk_slash', { x: f.x + f.facing * 46, y: f.y + (o.oy ?? -48), vx: f.facing * (o.speed ?? 14), vy: o.vy ?? 0, w: size * 0.7, h: size, life: o.life ?? 36,
          dmg: (o.blow ?? { dmg: 8 }).dmg, ang: o.blow?.ang ?? 40, kb: o.blow?.kb ?? 6, sc: o.blow?.sc ?? 6, stun: o.blow?.stun, rehit: o.rehit, fx: FX_OF[c.th.motif], data: { th: c.th, count: o.x ? 2 : 1 } });
      }
    },
  };
}

/** Eruptions: one under the target, a line marching forward, or a rain across an area. */
export function eruption(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; mode?: 'target' | 'line' | 'rain' | 'self'; n?: number; spacing?: number; stagger?: number; w?: number; h?: number; delay?: number; active?: number; blow?: Blow; last?: Blow; big?: boolean; range?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 9, n = o.n ?? 1;
  return {
    anim: o.anim ?? 'castUp', startup: su, dur: o.dur ?? su + (n - 1) * (o.stagger ?? 4) + 26, hits: [],
    onFrame: at(su, (f, g) => {
      const ap = aimPoint(g, f, o.range ?? 600, 160);
      for (let i = 0; i < n; i++) {
        let x: number;
        if (o.mode === 'line') x = f.x + f.facing * (70 + i * (o.spacing ?? 60));
        else if (o.mode === 'rain') x = ap.x + (i - (n - 1) / 2) * (o.spacing ?? 55);
        else if (o.mode === 'self') x = f.x + (i - (n - 1) / 2) * (o.spacing ?? 70);
        else x = ap.x + (i - (n - 1) / 2) * (o.spacing ?? 40);
        const y = g.groundBelow(x, f.y - 80) ?? ap.y;
        const b = i === n - 1 && o.last ? o.last : o.blow ?? { dmg: 8, ang: 84, kb: 7, sc: 7 };
        spawn(g, f, 'awk_pillar', { x, y, w: o.w ?? 56, h: o.h ?? 170, ground: true, life: (o.delay ?? 10) + i * (o.stagger ?? 4) + (o.active ?? 10) + 8,
          delay: (o.delay ?? 10) + i * (o.stagger ?? 4), activeFor: o.active ?? 10, dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, fx: FX_OF[c.th.motif], data: { th: c.th, big: o.big } });
      }
    }),
  };
}

/** A thrown or fired sphere that bursts on contact or when it lands. */
export function orb(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; r?: number; speed?: number; vy?: number; grav?: number; blow?: Blow; fin?: Blow; life?: number; aim?: boolean; pierce?: boolean; rehit?: number; oy?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 9;
  return {
    anim: o.anim ?? 'thrust', startup: su, dur: o.dur ?? su + 24, hits: [],
    onFrame: at(su, (f, g) => {
      const r = o.r ?? 30, sp = o.speed ?? 10;
      let vy = o.vy ?? 0;
      if (o.aim) { const t = g.nearestEnemy(f, 700); if (t && (t.x - f.x) * f.facing > 0) vy = clamp((t.y - t.h / 2 - (f.y - 50)) / Math.max(40, Math.abs(t.x - f.x)) * sp, -sp * 0.7, sp * 0.7); }
      const b = o.blow ?? { dmg: 4, ang: 40, kb: 2, sc: 0, stun: 8 };
      spawn(g, f, 'awk_orb', { x: f.x + f.facing * 44, y: f.y + (o.oy ?? -50), vx: f.facing * sp, vy, w: r * 2, h: r * 2, life: o.life ?? 50,
        dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, rehit: o.rehit ?? (o.pierce ? 5 : 0), pull: !!o.pierce, fx: FX_OF[c.th.motif], fin: o.fin ?? { dmg: 11, ang: 45, kb: 8.4, sc: 8.6 },
        data: { th: c.th, grav: o.grav, pierce: o.pierce } });
    }),
  };
}

export function vortex(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; at?: 'target' | 'ahead' | 'self'; ahead?: number; r?: number; last?: number; pull?: number; every?: number; tick?: Blow; fin?: Blow; oy?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 10;
  return {
    anim: o.anim ?? 'cast', startup: su, dur: o.dur ?? su + 30, hits: [],
    onFrame: at(su, (f, g) => {
      const t = o.at === 'target' ? g.nearestEnemy(f, 650) : null;
      const self = o.at === 'self';
      const x = self ? f.x : t ? t.x : f.x + f.facing * (o.ahead ?? 150);
      const y = self ? f.y - 44 : t ? t.y - t.h / 2 : f.y + (o.oy ?? -60);
      const last = o.last ?? 40;
      spawn(g, f, 'awk_vortex', { x, y, life: last + 14, data: { th: c.th, r: o.r ?? 70, dur: last, pull: o.pull ?? 0.8, every: o.every ?? 7, tick: o.tick ?? { dmg: 1.6, ang: 70, kb: 0.5, sc: 0, stun: 10 }, fin: o.fin ?? { dmg: 11, ang: 80, kb: 8.8, sc: 8.8 }, follow: self, ox: 0, oy: -44 } });
    }),
  };
}

export function groundWave(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; w?: number; h?: number; speed?: number; both?: boolean; life?: number; blow?: Blow; fin?: Blow; rehit?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 9;
  return {
    anim: o.anim ?? 'slam', startup: su, dur: o.dur ?? su + 26, hits: [],
    onFrame: at(su, (f, g) => {
      for (const dir of o.both ? [1, -1] : [f.facing]) {
        const b = o.blow ?? { dmg: 2.6, ang: 80, kb: 2, sc: 0, stun: 8 };
        spawn(g, f, 'awk_wave', { x: f.x + dir * 50, y: f.y, vx: dir * (o.speed ?? 10), dir, w: o.w ?? 90, h: o.h ?? 80, ground: true, life: o.life ?? 42, rehit: o.rehit ?? 7,
          dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, pull: !o.fin ? false : true, fx: FX_OF[c.th.motif], fin: o.fin ?? { dmg: 9, ang: 82, kb: 8.4, sc: 8.4 }, data: { th: c.th } });
      }
      g.shake(8);
    }),
  };
}

/** A giant summoned limb or object. `path`: 'forward' | 'sky' | 'rise' | 'diag'. */
export function giant(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; form: string; size?: number; path?: 'forward' | 'sky' | 'rise' | 'diag'; wind?: number; travel?: number; reach?: number; tick?: Blow; fin?: Blow; body?: string; rehit?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 10;
  return {
    anim: o.anim ?? 'thrust', startup: su, dur: o.dur ?? su + (o.wind ?? 4) + (o.travel ?? 14) + 12, hits: [],
    onFrame: at(su, (f, g) => {
      const size = o.size ?? 44, ap = aimPoint(g, f, 700, 200);
      let x0: number, y0: number, x1: number, y1: number;
      if (o.path === 'sky') { x0 = ap.x - f.facing * 40; y0 = ap.y - 460; x1 = ap.x; y1 = ap.y - size * 0.6; }
      else if (o.path === 'rise') { x0 = ap.x; y0 = ap.y + size * 1.4; x1 = ap.x; y1 = ap.y - 190; }
      else if (o.path === 'diag') { x0 = f.x - f.facing * 20; y0 = f.y - 260; x1 = ap.x; y1 = ap.y - size * 0.5; }
      else { x0 = f.x - f.facing * 30; y0 = f.y - 52; x1 = f.x + f.facing * (o.reach ?? 460); y1 = f.y - 52; }
      spawn(g, f, 'awk_giant', { x: x0, y: y0, life: (o.wind ?? 4) + (o.travel ?? 14) + 16, data: { th: c.th, form: o.form, size, x1, y1, wind: o.wind ?? 4, travel: o.travel ?? 14, body: o.body, rehit: o.rehit,
        tick: o.tick ?? { dmg: 2.6, ang: 45, kb: 2, sc: 0, stun: 9 }, fin: o.fin ?? { dmg: 11, ang: 40, kb: 9, sc: 9 } } });
    }),
  };
}

/** A volley: `n` shards thrown in a fan or a stream. */
export function volley(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; form: string; n?: number; every?: number; spread?: number; speed?: number; size?: number; blow?: Blow; aim?: boolean; grav?: number; down?: boolean }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 6, n = o.n ?? 3, every = o.every ?? 2;
  return {
    anim: o.anim ?? 'thrust', startup: su, dur: o.dur ?? su + n * every + 18, hits: [],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr < su || fr >= su + n * every || (fr - su) % every !== 0) return;
      const i = (fr - su) / every;
      const sp = o.speed ?? 15;
      let base = o.down ? (f.facing > 0 ? 0.9 : Math.PI - 0.9) : f.facing > 0 ? 0 : Math.PI;
      if (o.aim) { const t = g.nearestEnemy(f, 700); if (t && (t.x - f.x) * f.facing > 0) base = aimAngle(f, f.x, f.y - 52, t, 0.7); }
      const spr = o.spread ?? 0.12;
      const an = base + (n > 1 ? (i / (n - 1) - 0.5) * spr * 2 : 0) * (f.facing > 0 ? 1 : -1);
      const b = o.blow ?? { dmg: 3.2, ang: 38, kb: 2.4, sc: 1, stun: 6 };
      const s = o.size ?? 22;
      spawn(g, f, 'awk_shard', { x: f.x + f.facing * 36, y: f.y - 52, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, w: s, h: s, life: 44,
        dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, fx: FX_OF[c.th.motif], data: { th: c.th, form: o.form, grav: o.grav } });
      if (i % 2 === 0) sfx('whoosh');
    },
  };
}

export function field(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; r?: number; last?: number; every?: number; follow?: boolean; at?: 'self' | 'target' | 'ahead'; tick?: Blow; fin?: Blow; invuln?: boolean }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 8;
  return {
    anim: o.anim ?? 'castUp', startup: su, dur: o.dur ?? su + 26, hits: [],
    invuln: o.invuln ? [su, su + 12] : undefined,
    onFrame: at(su, (f, g) => {
      const t = o.at === 'target' ? g.nearestEnemy(f, 600) : null;
      const x = o.at === 'ahead' ? f.x + f.facing * 140 : t ? t.x : f.x;
      const y = t ? t.y - t.h / 2 : f.y - 44;
      const last = o.last ?? 48;
      spawn(g, f, 'awk_field', { x, y, life: last + 12, data: { th: c.th, r: o.r ?? 90, dur: last, every: o.every ?? 8, follow: o.follow ?? (o.at !== 'target' && o.at !== 'ahead'), tick: o.tick ?? { dmg: 1.8, ang: 70, kb: 1, sc: 0, stun: 9 }, fin: o.fin } });
    }),
  };
}

export function shock(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; r?: number; grow?: number; blow?: Blow; flat?: boolean; big?: boolean; oy?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 8;
  return {
    anim: o.anim ?? 'slam', startup: su, dur: o.dur ?? su + 24, hits: [],
    onFrame: at(su, (f, g) => {
      spawn(g, f, 'awk_ring', { x: f.x, y: f.y + (o.oy ?? -30), life: (o.grow ?? 10) + 12, data: { th: c.th, r: o.r ?? 150, grow: o.grow ?? 10, flat: o.flat, big: o.big, blow: o.blow ?? { dmg: 8, ang: 60, kb: 7.6, sc: 7.4 } } });
      motifBurst(g, f.x, f.y - 40, 40, c.th);
    }),
  };
}

/**
 * Blink strikes: the body vanishes and re-appears on alternating sides of the
 * target, hitting each time, leaving afterimages behind.
 */
export function blink(c: KitCtx, o: { su?: number; n?: number; every?: number; range?: number; blow?: Blow; fin?: Blow; anim?: AnimName; slash?: boolean }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 5, n = o.n ?? 3, every = o.every ?? 6;
  return {
    anim: o.anim ?? 'slash', startup: su, dur: su + n * every + 16, hits: [], grav: 0, invuln: [su, su + n * every],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr === su) f.blinkTarget = g.nearestEnemy(f, (o.range ?? 300) * 1.25);
      const T = f.blinkTarget;
      if (fr < su || fr >= su + n * every || (fr - su) % every !== 0) return;
      const i = (fr - su) / every;
      spawn(g, f, 'awk_ghost', { x: f.x, y: f.y, life: 12, dir: f.facing, data: { th: c.th, anim: o.anim ?? 'slash' } });
      if (!T || !T.alive) { if (i === 0) { f.x += f.facing * 120; } return; }
      const side = i % 2 === 0 ? -Math.sign(T.x - f.x) || 1 : Math.sign(T.x - f.x) || -1;
      const nx = T.x + side * 54;
      if (g.groundBelow(nx, T.y - 60) !== null || !T.grounded) { f.x = nx; f.y = T.y; }
      f.vx = 0; f.vy = 0; f.facing = T.x >= f.x ? 1 : -1;
      const last = i === n - 1;
      const b = last ? o.fin ?? { dmg: 9, ang: 45, kb: 8, sc: 8 } : o.blow ?? { dmg: 3.2, ang: 70, kb: 1, sc: 0, stun: 12 };
      g.applyHit(f, T, { ...b, fx: FX_OF[c.th.motif] }, f.facing, T.x, T.y - T.h / 2);
      if (o.slash !== false) g.fx.cut(T.x, T.y - T.h / 2, 110, (i * 1.3) % Math.PI, 12, 0.6);
      motifBurst(g, T.x, T.y - T.h / 2, 30, c.th);
      sfx(SFX_OF[c.th.motif]);
    },
  };
}

/** A command grab: seize the nearest foe in front, `n` held hits, then a throw. */
export function grab(c: KitCtx, o: { su?: number; range?: number; n?: number; every?: number; blow?: Blow; fin?: Blow; anim?: AnimName; tether?: boolean; lift?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 6, n = o.n ?? 3, every = o.every ?? 6;
  return {
    anim: o.anim ?? 'palm', startup: su, dur: su + n * every + 20, hits: [],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr === su) {
        const T = g.nearestEnemy(f, o.range ?? 120);
        f.grabT = T && (T.x - f.x) * f.facing > -20 && T.invuln <= 0 ? T : null;
        // The reach is always shown, so a whiff reads as a miss rather than a pause.
        const reach = o.range ?? 120;
        const tx = f.grabT ? f.grabT.x : f.x + f.facing * reach, ty = f.grabT ? f.grabT.y - 40 : f.y - 50;
        spawn(g, f, 'awk_reach', { life: 12, data: { th: c.th, tx, ty, tether: o.tether } });
        if (f.grabT) { sfx('counter'); g.fx.text(f.x, f.y - 120, 'CAUGHT', c.th.c1, 18, 22); if (o.tether) g.fx.bolt(f.x + f.facing * 20, f.y - 50, f.grabT.x, f.grabT.y - 40, c.th.c1, 10, 2); }
      }
      const T = f.grabT;
      if (!T || !T.alive || fr < su) return;
      const k = fr - su;
      if (k < n * every) {
        T.x = f.x + f.facing * 46; T.y = f.y - (o.lift ?? 0) * Math.min(1, k / 8); T.vx = 0; T.vy = 0;
        T.state = 'hitstun'; T.hitstun = Math.max(T.hitstun, 8); T.move = null; T.moveKey = null;
        if (k % every === every - 1) { g.applyHit(f, T, { ...(o.blow ?? { dmg: 2.8, ang: 70, kb: 0.4, sc: 0, stun: 12 }), fx: FX_OF[c.th.motif] }, f.facing, T.x, T.y - 40, true); motifBurst(g, T.x, T.y - 40, 26, c.th); T.x = f.x + f.facing * 46; T.vx = 0; T.vy = 0; }
      }
      if (k === n * every) { g.applyHit(f, T, { ...(o.fin ?? { dmg: 10, ang: 40, kb: 9, sc: 9 }), fx: FX_OF[c.th.motif] }, f.facing, T.x, T.y - 40, true); motifBurst(g, T.x, T.y - 40, 60, c.th); g.shake(12); sfx('heavyhit'); f.grabT = null; }
    },
  };
}

/** A rapid melee barrage with the fists (or blades) blurring in front. */
export function barrage(c: KitCtx, o: { su?: number; len?: number; x?: number; y?: number; w?: number; h?: number; tick?: number; fin?: Blow; anim?: AnimName; blades?: boolean; vel?: MoveDef['vel']; skin?: string }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 5, len = o.len ?? 22;
  const b = o.fin ?? { dmg: 8, ang: 40, kb: 7.4, sc: 7.8 };
  return {
    anim: o.anim ?? 'flurry', startup: su, dur: su + len + 14, vel: o.vel, quietHits: true,
    hits: [H(su, su + len, o.x ?? 50, o.y ?? -48, o.w ?? 80, o.h ?? 60, { dmg: o.tick ?? 1.8, ang: 80, kb: 1.4, sc: 0 }, { rehit: 3, pull: true, g: 0, fx: FX_OF[c.th.motif] }),
      H(su + len + 1, su + len + 4, o.x ?? 50, o.y ?? -48, (o.w ?? 80) * 1.1, (o.h ?? 60) * 1.1, b, { g: 1, fx: FX_OF[c.th.motif] })],
    onFrame: at(su, (f, g) => spawn(g, f, 'awk_blur', { life: len + 2, data: { th: c.th, ox: (o.x ?? 50) - 20, oy: o.y ?? -48, reach: 46, spread: 16, blades: o.blades, skin: o.skin || f.look.glove || f.look.skin } })),
  };
}

/** A diving attack that detonates a shockwave where it lands. */
export function dive(c: KitCtx, o: { su?: number; vx?: number; vy?: number; blow?: Blow; land?: Blow; r?: number; anim?: AnimName }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 5;
  return {
    anim: o.anim ?? 'dive', startup: su, dur: su + 34, grav: 0.9, land: false,
    vel: [[0, 0, -3], [su, o.vx ?? 6, o.vy ?? 16]],
    hits: [H(su, su + 30, 20, -24, 70, 70, o.blow ?? { dmg: 7, ang: -55, kb: 5, sc: 5 }, { fx: FX_OF[c.th.motif] })],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr > su && fr < su + 30 && fr % 2 === 0) motifMote(g, f.x, f.y - 30, c.th, 0, -3);
      if (fr > su + 1 && f.grounded && !f.diveLanded) {
        f.diveLanded = true;
        spawn(g, f, 'awk_ring', { x: f.x, y: f.y - 10, life: 20, data: { th: c.th, r: o.r ?? 130, grow: 8, flat: true, big: true, blow: o.land ?? { dmg: 9, ang: 70, kb: 7.8, sc: 7.6 } } });
        g.shake(14); sfx('heavyhit');
        f.moveDur = Math.min(f.moveDur, fr + 12);
      }
      if (fr === 0) f.diveLanded = false;
    },
  };
}

/** A lunging rush with a single committed hitbox travelling with the body. */
export function rush(c: KitCtx, o: { su?: number; speed?: number; len?: number; blow?: Blow; anim?: AnimName; w?: number; h?: number; vy?: number; multi?: boolean }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 5, len = o.len ?? 12;
  const b = o.blow ?? { dmg: 8, ang: 38, kb: 6.6, sc: 7 };
  return {
    anim: o.anim ?? 'thrust', startup: su, dur: su + len + 14, grav: 0,
    vel: [[0, 0, 0], [su, o.speed ?? 20, o.vy ?? 0], [su + len, 2, null]],
    hits: o.multi
      ? [H(su, su + len, 40, -46, o.w ?? 76, o.h ?? 60, { dmg: 2, ang: 60, kb: 1.4, sc: 0 }, { rehit: 3, pull: true, g: 0, fx: FX_OF[c.th.motif] }), H(su + len + 1, su + len + 4, 44, -46, o.w ?? 80, o.h ?? 64, b, { g: 1, fx: FX_OF[c.th.motif] })]
      : [H(su, su + len, 40, -46, o.w ?? 76, o.h ?? 60, b, { fx: FX_OF[c.th.motif] })],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr >= su && fr < su + len) { motifMote(g, f.x - f.facing * 20, f.y - 40 + (R() - 0.5) * 40, c.th, -f.facing * 4, 0); if (fr % 3 === 0) spawn(g, f, 'awk_ghost', { x: f.x, y: f.y, life: 10, dir: f.facing, data: { th: c.th, anim: o.anim ?? 'thrust' } }); }
    },
  };
}

/** A counter stance: struck inside the window, retaliate with `blow`. */
export function counter(c: KitCtx, o: { window?: [number, number]; blow?: Blow; teleport?: boolean; anim?: AnimName; dur?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const win = o.window ?? [2, 20];
  return {
    anim: o.anim ?? 'counter', startup: 2, dur: o.dur ?? 40, hits: [], counter: win,
    onCounter: (f: any, a: any, g: any) => {
      sfx('counter'); g.flashScreen(c.th.c1, 0.3);
      if (o.teleport) { f.x = a.x - a.facing * 52; f.y = a.y; }
      f.facing = a.x > f.x ? 1 : -1; f.invuln = 18;
      g.applyHit(f, a, { ...(o.blow ?? { dmg: 13, ang: 45, kb: 8, sc: 8.6 }), fx: FX_OF[c.th.motif] }, f.facing, a.x, a.y - 42);
      motifBurst(g, a.x, a.y - 42, 60, c.th); g.shake(10);
      g.fx.text(f.x, f.y - 120, 'COUNTER', c.th.c1, 22, 26);
      f.moveFrame = Math.max(f.moveFrame, win[1] + 2);
    },
  };
}

/** A timed power-up: speed and damage for `dur` frames, with a burst on activation. */
export function buff(c: KitCtx, o: { su?: number; dur?: number; last?: number; speed?: number; dmg?: number; label?: string; blow?: Blow; r?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 8;
  return {
    anim: 'castUp', startup: su, dur: o.dur ?? su + 22, hits: [], invuln: [0, su + 4],
    onFrame: at(su, (f, g) => {
      f.buffT = o.last ?? 420; f.buffSpeed = o.speed ?? 1.15; f.buffDmg = o.dmg ?? 1.12; f.buffCol = c.th.c1;
      spawn(g, f, 'awk_ring', { x: f.x, y: f.y - 44, life: 20, data: { th: c.th, r: o.r ?? 110, grow: 8, big: true, blow: o.blow ?? { dmg: 6, ang: 60, kb: 6.4, sc: 5 } } });
      if (o.label) g.fx.text(f.x, f.y - 150, o.label, '#ffffff', 22, 40);
      g.flashScreen(c.th.c1, 0.2); sfx('confirm');
    }),
  };
}

/** Clones (shadow clones, afterimages, a Stand) that run the foe down and hit. */
export function clones(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; n?: number; seq?: { at: number; anim: AnimName; blow: Blow }[]; speed?: number; poof?: string; alpha?: number; air?: boolean; runFor?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 8, n = o.n ?? 1;
  const seq = o.seq ?? [{ at: 0, anim: 'punch' as AnimName, blow: { dmg: 4, ang: 40, kb: 2, sc: 0.5, stun: 10 } }, { at: 10, anim: 'kick' as AnimName, blow: { dmg: 7, ang: 60, kb: 7, sc: 7 } }];
  return {
    anim: o.anim ?? 'cast', startup: su, dur: o.dur ?? su + 24, hits: [],
    onFrame: at(su, (f, g) => {
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 34;
        spawn(g, f, 'awk_clone', { x: f.x + f.facing * (20 + Math.abs(off)) + off * 0.3, y: f.y, life: 110, data: { th: c.th, seq, speed: (o.speed ?? 11) + i * 1.2, poof: o.poof, alpha: o.alpha, air: o.air, runFor: (o.runFor ?? 34) + i * 4 } });
      }
      g.fx.burst(f.x, f.y - 40, 20, '#ffffff', 5, 'smoke', 22, 10);
    }),
  };
}

/** A heavy single or multi-hit melee strike with the motif painted on it. */
export function melee(c: KitCtx, o: { su?: number; dur?: number; anim?: AnimName; x?: number; y?: number; w?: number; h?: number; blow?: Blow; multi?: number; tick?: number; vel?: MoveDef['vel']; active?: number }, alt?: Theme): Part {
  if (alt) c = { id: c.id, th: alt };
  const su = o.su ?? 5, active = o.active ?? 7;
  const b = o.blow ?? { dmg: 7, ang: 40, kb: 5, sc: 4.6 };
  const hits = o.multi
    ? [H(su, su + o.multi, o.x ?? 50, o.y ?? -46, o.w ?? 80, o.h ?? 56, { dmg: o.tick ?? 2, ang: 80, kb: 1.4, sc: 0 }, { rehit: 4, pull: true, g: 0, fx: FX_OF[c.th.motif] }), H(su + o.multi + 1, su + o.multi + 4, o.x ?? 50, o.y ?? -46, (o.w ?? 80) * 1.08, (o.h ?? 56) * 1.08, b, { g: 1, fx: FX_OF[c.th.motif] })]
    : [H(su, su + active, o.x ?? 50, o.y ?? -46, o.w ?? 80, o.h ?? 56, b, { fx: FX_OF[c.th.motif] })];
  return { anim: o.anim ?? 'slash', startup: su, dur: o.dur ?? su + active + (o.multi ?? 0) + 14, hits, vel: o.vel };
}

// ===========================================================================
// MELEE VISUALS
// ===========================================================================

/** Registers the per-fighter hit visual used by every awakened melee hitbox. */
export function registerKitVfx(id: string, th: Theme) {
  registerVfx(`awk:${id}`, (f: any, g: any, fr: number, m: any) => {
    const s = f.scale || 1;
    for (const h of m.hits || []) {
      const opens = fr === h.f[0] || (h.rehit && fr > h.f[0] && fr <= h.f[1] && (fr - h.f[0]) % Math.max(3, h.rehit) === 0);
      if (!opens) continue;
      const cx = f.x + h.x * s * f.facing, cy = f.y + h.y * s, r = Math.max(h.w, h.h) * s * 0.5;
      motifBurst(g, cx, cy, r, th);
      if (SHARP.includes(th.motif) || th.motif === 'lightning' || FIERY.includes(th.motif)) g.fx.cut(cx, cy, r * 2, f.facing > 0 ? -0.4 : Math.PI + 0.4, 12, 0.6);
    }
    if (fr < (m.startup || 0) && fr % 2 === 0) motifMote(g, f.x + f.facing * (10 + R() * 30), f.y - 30 - R() * 40, th, 0, -1);
  });
}
