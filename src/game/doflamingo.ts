/**
 * DONQUIXOTE DOFLAMINGO — One Piece.
 *
 * The Heavenly Demon. The String-String Fruit turns every finger into a spool:
 * he cuts with threads finer than wire, hangs from the clouds, marionettes the
 * people he fights, and - awakened - turns the world itself into string.
 *
 *   BASE       Tamaito · Overheat · Parasite · Spider's Nest · Sora no Michi
 *   AWAKENED   J  Tamaito Barrage · Overheat Lash · Needle Floor · Fulbright
 *              K  Black Knight · Goshikito · Surging Wave · Sixteen Holy Bullets
 *              L  Birdcage · God Thread · Rolling Tide · Fulbright Storm
 *
 * Every awakened move is authored here; nothing in this kit is generated.
 */
import { sfx } from './audio';
import { makePortrait } from './portraits';
import { installTechniques } from './techniques';
import { SIGS } from './signatures';
import { registerVfx } from './vfx';
import { computePose, drawFighter } from './render';
import type { CharDef, CoreKit, MoveKey } from './characters';
import type { AnimName, HitDef, MoveDef } from './types';
import type { Look } from './render';
import { PINK, PINK_HI, THREAD, HEAT, thread } from './doflamingoArt';

const R = Math.random;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function hexA(c: string, a: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
/** Goshikito's five colours. */
const FIVE = ['#ff3b3b', '#ff9b2e', '#ffe23a', '#3ee07a', '#4a8cff'];

interface Blow { dmg: number; ang: number; kb: number; sc: number; stun?: number; fx?: HitDef['fx'] }
function strike(g: any, p: any, T: any, b: Blow, dir: number, x: number, y: number) {
  return g.applyHit(p.owner, T, { dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, fx: b.fx || 'slash', ultLocked: p.ultLocked }, dir, T.x, T.y - T.h / 2, false,
    { x, y, vx: 0, vy: 0, noMeter: p.ultLocked });
}
const foes = (g: any, owner: any) => g.fighters.filter((T: any) => T !== owner && T.alive && g.canDamage(owner, T));
function segHits(g: any, p: any, x1: number, y1: number, x2: number, y2: number, half: number, b: Blow, rehit: number) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (const T of foes(g, p.owner)) {
    const cx = T.x, cy = T.y - T.h / 2;
    const u = clamp(((cx - x1) * dx + (cy - y1) * dy) / L2, 0, 1);
    const px = x1 + dx * u, py = y1 + dy * u;
    if (Math.hypot(cx - px, cy - py) > half + T.hw + T.h * 0.28) continue;
    const last = p.hitMap.get(T);
    if (last !== undefined && (rehit <= 0 || p.t - last < rehit)) continue;
    p.hitMap.set(T, p.t);
    strike(g, p, T, b, Math.sign(dx) || p.dir, px, py);
  }
}
const spawn = (g: any, f: any, sig: string, o: any) => g.spawnProj({
  owner: f, type: 'sig', sig, x: f.x, y: f.y, vx: 0, vy: 0, w: 40, h: 40, life: 40,
  dmg: 0, ang: 40, kb: 4, sc: 4, dir: f.facing, fx: 'slash', ...o, data: { ...(o.data || {}) },
});
const MANUAL = 100000;
/** Where his lead hand is this frame, as published by the renderer. */
const hand = (f: any): [number, number] => [Number.isFinite(f.handX) && f.handX ? f.handX : f.x + f.facing * 26, Number.isFinite(f.handY) && f.handY ? f.handY : f.y - 52];

// ===========================================================================
// ENTITIES
// ===========================================================================

/** TAMAITO. A bullet of wound string, fired off a fingertip. */
SIGS.tamaito = {
  init: (p) => { p.data.trail = []; },
  update: (p, g) => {
    p.data.trail.unshift([p.x, p.y]); if (p.data.trail.length > 6) p.data.trail.pop();
    const gy = g.groundBelow(p.x, p.y - 30);
    if (gy !== null && p.y >= gy) { p.life = 0; g.fx.burst(p.x, p.y, 5, THREAD, 3, 'spark', 12, 2); }
  },
  onHit: (p, _t, g) => { p.life = 0; g.fx.burst(p.x, p.y, 8, THREAD, 5, 'streak', 12, 2); },
  draw: (p, ctx) => {
    const a = clamp(Math.min(p.life / 5, (p.t + 1) / 2), 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'lighter';
    const tr = p.data.trail;
    if (tr.length > 1) thread(ctx, tr[tr.length - 1][0], tr[tr.length - 1][1], p.x, p.y, THREAD, 1.6, 0, 0.4);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, hexA(PINK_HI, 0.7)); g.addColorStop(1, hexA(PINK, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, TAU); ctx.moveTo(p.x - 3.4, p.y); ctx.lineTo(p.x + 3.4, p.y); ctx.stroke();
    ctx.restore();
  },
};

/**
 * OVERHEAT. A single rope of twisted string, red-hot, lashed out from his hand.
 * It unrolls, holds, and snaps back; the whole length cuts.
 */
SIGS.overheat = {
  init: (p) => { p.delay = MANUAL; p.data.len ??= 440; p.data.out ??= 8; p.data.hold ??= 10; },
  update: (p, g) => {
    const d = p.data, o = p.owner;
    const [hx, hy] = hand(o);
    p.x = hx; p.y = hy;
    const t = p.t, out = d.out, hold = d.hold;
    const k = t < out ? t / out : t < out + hold ? 1 : Math.max(0, 1 - (t - out - hold) / 6);
    d.L = d.len * (1 - Math.pow(1 - k, 2));
    d.ang = (p.dir > 0 ? 0 : Math.PI) + (d.tilt || 0);
    if (t === 1) sfx('string-whip');
    if (t <= out + hold) {
      const x2 = hx + Math.cos(d.ang) * d.L, y2 = hy + Math.sin(d.ang) * d.L;
      if (t === out + hold && d.fin) { p.hitMap.clear(); segHits(g, p, hx, hy, x2, y2, 12, d.fin, 0); g.shake(6); }
      else segHits(g, p, hx, hy, x2, y2, 12, d.tick || { dmg: 2.4, ang: 40, kb: 1.4, sc: 0, stun: 8, fx: 'fire' }, 4);
      if (t % 2 === 0) g.fx.add({ x: hx + Math.cos(d.ang) * R() * d.L, y: hy + Math.sin(d.ang) * R() * d.L, vy: -1.2, color: R() < 0.5 ? HEAT : '#ffd24a', kind: 'ember', life: 14, size: 3 });
    }
    if (t > out + hold + 6) p.life = 0;
  },
  draw: (p, ctx, t) => {
    const d = p.data; if (!d.L) return;
    const n = 26;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, along = d.L * u;
      const wob = Math.sin(u * 9 - t * 0.6) * 7 * u * (1 - u * 0.6);
      pts.push([p.x + Math.cos(d.ang) * along - Math.sin(d.ang) * wob, p.y + Math.sin(d.ang) * along + Math.cos(d.ang) * wob]);
    }
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pass = (w: string, lw: number) => { ctx.strokeStyle = w; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
    ctx.globalCompositeOperation = 'lighter';
    pass(hexA(HEAT, 0.35), 16);
    pass(hexA('#ffb03a', 0.7), 7);
    ctx.globalCompositeOperation = 'source-over';
    pass('#2a0a06', 4.2);
    pass('#ff6a2a', 2.6);
    // The twist of the rope.
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1;
    for (let i = 1; i < n; i += 2) { const [x, y] = pts[i]; ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.stroke(); }
    ctx.restore();
  },
};

/**
 * GOSHIKITO. Five strings, one of each colour, rake down through the space in
 * front of him like the claws of something enormous.
 */
SIGS.goshikito = {
  update: (p, g) => {
    if (p.t === p.delay) { sfx('string-whip'); g.shake(8); g.flashScreen('#ffffff', 0.08); }
  },
  draw: (p, ctx) => {
    const k = clamp((p.t - p.delay + 4) / 8, 0, 1), a = clamp(p.life / 8, 0, 1);
    const r = p.rect();
    ctx.save(); ctx.globalAlpha *= a;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x0 = r.x + r.w * (0.1 + i * 0.2) - p.dir * 40, y0 = r.y - 60;
      const x1 = x0 + p.dir * 90, y1 = r.y + r.h;
      const ex = x0 + (x1 - x0) * k, ey = y0 + (y1 - y0) * k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(FIVE[i], 0.4); ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = FIVE[i]; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.restore();
  },
};

/** FULBRIGHT. A string shot straight down out of the sky onto one spot. */
SIGS.fulbright = {
  update: (p, g) => {
    if (p.t === p.delay) { sfx('string'); g.fx.burst(p.x, p.y, 6, THREAD, 4, 'streak', 12, 2); }
  },
  draw: (p, ctx) => {
    const top = p.y - 620;
    const k = clamp((p.t - p.delay + 5) / 5, 0, 1), a = clamp(p.life / 8, 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    if (p.t < p.delay) {
      // Telegraph: a thin sight line and a mark on the floor.
      ctx.strokeStyle = hexA(THREAD, 0.25); ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = hexA(PINK, 0.8); ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 3, 0, 0, TAU); ctx.stroke();
    } else {
      const ey = top + (p.y - top) * k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(PINK_HI, 0.5); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x, ey); ctx.stroke();
    }
    ctx.restore();
  },
};

/**
 * PARASITE. Threads from each finger hook the target's limbs, and for a moment
 * their body is his: it walks where he pulls it, then he throws it.
 */
SIGS.parasite = {
  init: (p) => { p.delay = MANUAL; p.data.hold ??= 44; },
  update: (p, g) => {
    const d = p.data, T = d.target, o = p.owner;
    if (!T || !T.alive || !o.alive) { p.life = 0; return; }
    if (p.t === 3) {
      const ok = strike(g, p, T, { dmg: 3, ang: 70, kb: 0, sc: 0, stun: 14 }, o.facing, T.x, T.y - 40);
      if (!ok) { p.life = Math.min(p.life, 6); return; }
      d.caught = true; sfx('string');
      g.fx.text(T.x, T.y - 110, 'PARASITE', PINK_HI, 20, 30);
    }
    if (!d.caught) return;
    if (p.t < d.hold) {
      const gx = o.x + o.facing * 72;
      T.x += (gx - T.x) * 0.05; T.vx = 0; T.vy = Math.min(T.vy, 0) * 0;
      T.state = 'hitstun'; T.hitstun = Math.max(T.hitstun, 6); T.move = null; T.moveKey = null;
      // The puppet dance: jerked left and right on the strings.
      T.tumble = Math.sin(p.t * 0.5) * 0.35;
    }
    if (p.t === d.hold) {
      T.tumble = 0;
      strike(g, p, T, d.fin || { dmg: 7, ang: 76, kb: 7.6, sc: 7.6 }, o.facing, T.x, T.y - 40);
      g.shake(8); sfx('string-whip');
      p.life = Math.min(p.life, 6);
    }
  },
  draw: (p, ctx) => {
    const d = p.data, T = d.target, o = p.owner; if (!T) return;
    const reach = clamp(p.t / 4, 0, 1), a = clamp(p.life / 6, 0, 1);
    const [hx, hy] = hand(o);
    const pts: [number, number][] = [[T.x, T.y - T.h + 6], [T.x - 12, T.y - T.h * 0.55], [T.x + 12, T.y - T.h * 0.55], [T.x - 7, T.y - 4], [T.x + 7, T.y - 4]];
    ctx.save(); ctx.globalAlpha *= a;
    pts.forEach(([x, y], i) => thread(ctx, hx, hy - 2 + i, hx + (x - hx) * reach, hy + (y - hy) * reach, THREAD, 1, -18 - i * 3, 0.45));
    ctx.restore();
  },
};

/** SPIDER'S NEST (Kumo no Sugaki). A web strung across the space ahead. */
SIGS.spiderNest = {
  update: (p, g) => { if (p.t === p.delay) sfx('string'); void g; },
  draw: (p, ctx, t) => {
    const k = clamp((p.t + 1) / p.delay, 0, 1), a = clamp(p.life / 8, 0, 1);
    const r = Math.max(p.w, p.h) * 0.5 * k;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x, p.y);
    ctx.strokeStyle = hexA(THREAD, 0.9); ctx.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + 0.1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); ctx.stroke(); }
    for (let ring = 1; ring <= 4; ring++) {
      const rr = r * ring / 4;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const an = i / 10 * TAU + 0.1; const x = Math.cos(an) * rr, y = Math.sin(an) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(PINK, 0.35 + Math.sin(t * 0.3) * 0.1); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  },
};

/** A wave of living string rolling along the floor. */
SIGS.stringWave = {
  update: (p, g) => {
    const gy = g.groundBelow(p.x, p.y - 60);
    if (gy === null) { p.life = Math.min(p.life, 4); } else p.y = gy;
    if (p.t % 3 === 0) g.fx.add({ x: p.x + (R() - 0.5) * p.w, y: p.y - R() * p.h, vx: p.vx * 0.3, vy: -2, color: R() < 0.5 ? THREAD : PINK_HI, kind: 'streak', life: 12, size: 2 });
    if (p.t % 6 === 0) g.shake(3);
  },
  draw: (p, ctx, t) => {
    const a = clamp(Math.min(p.life / 8, (p.t + 1) / 4), 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    const w = p.w, h = p.h;
    for (let i = 0; i < 22; i++) {
      const u = i / 21, x = p.x - w / 2 + u * w;
      const crest = Math.sin(u * Math.PI) * h * (0.8 + Math.sin(t * 0.3 + i) * 0.15);
      const lean = p.dir * crest * 0.45;
      ctx.strokeStyle = i % 3 === 0 ? hexA(PINK_HI, 0.9) : hexA(THREAD, 0.95); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - p.dir * 8, p.y); ctx.quadraticCurveTo(x, p.y - crest * 0.7, x + lean, p.y - crest); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y - h * 0.4, 0, p.x, p.y - h * 0.4, w * 0.7);
    g.addColorStop(0, hexA(PINK, 0.3)); g.addColorStop(1, hexA(PINK, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y - h * 0.4, w * 0.7, h * 0.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

/** A needle of string driven down at an angle - one of the Sixteen Holy Bullets. */
SIGS.holyBullet = {
  init: (p) => { p.delay = MANUAL; },
  update: (p, g) => {
    const d = p.data, k = p.t - d.at;
    if (k === 0) sfx('string');
    if (k >= 0 && k < 5) {
      const u = Math.min(1, (k + 1) / 3);
      segHits(g, p, d.x1, d.y1, d.x1 + (d.x2 - d.x1) * u, d.y1 + (d.y2 - d.y1) * u, 8, d.blow, 0);
    }
    if (k === 2) g.fx.burst(d.x2, d.y2, 4, THREAD, 3, 'spark', 10, 2);
    if (k > 14) p.life = 0;
  },
  draw: (p, ctx) => {
    const d = p.data, k = p.t - d.at;
    if (k < -6) return;
    ctx.save();
    if (k < 0) {
      ctx.strokeStyle = hexA(THREAD, 0.2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(d.x1, d.y1); ctx.lineTo(d.x2, d.y2); ctx.stroke();
    } else {
      const u = Math.min(1, (k + 1) / 3), a = clamp(1 - (k - 6) / 8, 0, 1);
      ctx.globalAlpha *= a;
      const ex = d.x1 + (d.x2 - d.x1) * u, ey = d.y1 + (d.y2 - d.y1) * u;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(PINK, 0.45); ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(d.x1, d.y1); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x1, d.y1); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.restore();
  },
};

/**
 * BIRDCAGE. Threads drop out of the sky and close into a dome around the
 * battlefield. Nothing inside can leave; touching the bars cuts; and the cage
 * shrinks until it closes on whoever is left.
 */
SIGS.birdcage = {
  init: (p) => { p.delay = MANUAL; p.behind = true; p.data.r0 ??= 430; p.data.r1 ??= 150; p.data.dur ??= 180; },
  update: (p, g) => {
    const d = p.data;
    const k = clamp(p.t / d.dur, 0, 1);
    const drop = clamp(p.t / 20, 0, 1);
    d.r = d.r0 + (d.r1 - d.r0) * (k * k * (3 - 2 * k));
    if (p.t === 1) { sfx('birdcage'); g.flashScreen('#ffffff', 0.25); }
    if (drop < 1 || p.t >= d.dur) return;
    for (const T of foes(g, p.owner)) {
      const dx = T.x - p.x;
      if (Math.abs(dx) > d.r + 60) continue;
      const edge = d.r - T.hw - 4;
      if (Math.abs(dx) > edge) {
        // The bars: shoved back in, and cut for touching them.
        T.x = p.x + Math.sign(dx) * edge;
        T.vx = -Math.sign(dx) * Math.max(2, Math.abs(T.vx));
        const last = p.hitMap.get(T);
        if (last === undefined || p.t - last >= 14) {
          p.hitMap.set(T, p.t);
          strike(g, p, T, { dmg: 2.4, ang: 50, kb: 3, sc: 0, stun: 6 }, -Math.sign(dx) || 1, T.x, T.y - 40);
        }
      }
      const roof = p.y - d.r * 1.25;
      if (T.y - T.h < roof) { T.y = roof + T.h; T.vy = Math.max(T.vy, 2); }
    }
    if (p.t === d.dur - 1) {
      for (const T of foes(g, p.owner)) {
        if (Math.abs(T.x - p.x) > d.r + 10) continue;
        strike(g, p, T, { dmg: 13, ang: 80, kb: 9.4, sc: 9.2, stun: 8 }, T.x >= p.x ? 1 : -1, T.x, T.y - 40);
      }
      g.shake(20); g.flashScreen(PINK, 0.35); sfx('birdcage'); sfx('heavyhit');
      g.fx.ring(p.x, p.y - 60, 20, d.r * 1.4, THREAD, 22, 8);
      p.life = Math.min(p.life, 18);
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data; if (!d.r) return;
    const r = d.r, drop = clamp(p.t / 20, 0, 1), end = p.t >= d.dur;
    const a = end ? clamp(p.life / 18, 0, 1) : 1;
    const apexY = p.y - r * 1.25 - 40;
    const N = 22;
    ctx.save(); ctx.globalAlpha *= a;
    // The threads the cage hangs from, running up out of frame.
    ctx.strokeStyle = hexA(THREAD, 0.35); ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const x = p.x - 40 + i * 16; ctx.beginPath(); ctx.moveTo(p.x, apexY); ctx.lineTo(x + (i - 2.5) * 40, apexY - 700); ctx.stroke(); }
    // Meridians: each bar grows down from the apex.
    for (let i = 0; i <= N; i++) {
      const u = i / N, gx = p.x + (u * 2 - 1) * r;
      const bulge = (u * 2 - 1) * r * 0.35;
      const len = drop;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(PINK, 0.18); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(p.x, apexY);
      const cx1 = gx + bulge, cy1 = apexY + (p.y - apexY) * 0.35;
      const ex = p.x + (gx - p.x) * len, ey = apexY + (p.y - apexY) * len;
      ctx.quadraticCurveTo(p.x + (cx1 - p.x) * len, apexY + (cy1 - apexY) * len, ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hexA('#ffffff', 0.85); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, apexY);
      ctx.quadraticCurveTo(p.x + (cx1 - p.x) * len, apexY + (cy1 - apexY) * len, ex, ey); ctx.stroke();
    }
    // Latitude rings.
    if (drop >= 1) {
      ctx.strokeStyle = hexA(THREAD, 0.4); ctx.lineWidth = 1;
      for (let j = 1; j <= 4; j++) {
        const v = j / 5, y = apexY + (p.y - apexY) * v;
        const w = r * Math.sin(v * Math.PI * 0.5) * 1.06;
        ctx.beginPath(); ctx.ellipse(p.x, y, w, 6 + j * 2, 0, 0, TAU); ctx.stroke();
      }
      // A shimmer running down the bars.
      ctx.globalCompositeOperation = 'lighter';
      const sy = apexY + ((t * 6) % (p.y - apexY));
      ctx.fillStyle = hexA(PINK_HI, 0.12); ctx.fillRect(p.x - r, sy - 6, r * 2, 12);
    }
    ctx.restore();
  },
};

/**
 * GOD THREAD. Sixteen strings twisted into one rope as thick as a man and
 * driven forward like a punch from a god.
 */
SIGS.godThread = {
  init: (p) => { p.delay = MANUAL; p.data.len ??= 780; },
  update: (p, g) => {
    const d = p.data, o = p.owner;
    p.x = o.x + o.facing * 24; p.y = o.y - 56;
    const out = 10, hold = 16;
    const k = p.t < out ? p.t / out : p.t < out + hold ? 1 : Math.max(0, 1 - (p.t - out - hold) / 8);
    d.L = d.len * (1 - Math.pow(1 - k, 3));
    if (p.t === 1) { sfx('string-whip'); sfx('ult'); }
    if (p.t <= out + hold) {
      const x2 = p.x + p.dir * d.L;
      if (p.t === out + hold) { p.hitMap.clear(); segHits(g, p, p.x, p.y, x2, p.y, 30, { dmg: 13, ang: 36, kb: 9.6, sc: 9.6, stun: 6 }, 0); g.shake(18); g.flashScreen('#ffffff', 0.3); g.punchIn(x2, p.y, 0.1); }
      else segHits(g, p, p.x, p.y, x2, p.y, 30, { dmg: 2.4, ang: 40, kb: 1.6, sc: 0, stun: 9 }, 5);
      if (p.t % 3 === 0) g.shake(6);
    }
    if (p.t > out + hold + 8) p.life = 0;
  },
  draw: (p, ctx, t) => {
    const d = p.data; if (!d.L) return;
    const L = d.L, n = 30;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createLinearGradient(p.x, 0, p.x + p.dir * L, 0);
    glow.addColorStop(0, hexA(PINK, 0.1)); glow.addColorStop(1, hexA(PINK, 0.45));
    ctx.strokeStyle = glow; ctx.lineWidth = 64;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.dir * L, p.y); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // Sixteen strands braided around the axis.
    for (let s = 0; s < 16; s++) {
      const ph = s / 16 * TAU;
      ctx.strokeStyle = s % 4 === 0 ? PINK_HI : '#ffffff'; ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = p.x + p.dir * L * u;
        const r = 8 + u * 16;
        const y = p.y + Math.sin(ph + u * 14 - t * 0.5) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // The knot at the head: a fist of string.
    const hx = p.x + p.dir * L;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = PINK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, p.y, 30, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hexA(PINK, 0.7); ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(hx, p.y, 8 + i * 4, i, i + 3.6); ctx.stroke(); }
    ctx.restore();
  },
};

/**
 * THE BLACK KNIGHT. A full-size copy of him woven out of string, which runs the
 * target down on its own and kicks them into the air.
 */
SIGS.blackKnight = {
  init: (p) => {
    p.delay = MANUAL;
    const o = p.owner;
    p.data.mock = {
      x: p.x, y: p.y, vx: 0, vy: 0, facing: p.dir, scale: o.scale, look: o.look, def: o.def, idx: o.idx,
      grounded: true, state: 'idle', stateT: 0, animT: 0, runPhase: 0, devilT: 0, godT: 0, auraT: 0, djumpT: 99, landT: 0, tumble: 0,
      hw: o.hw, h: o.h, move: null, moveFrame: 0, moveActiveEnd: 0, tipX: 0, tipY: 0, footX: 0, footY: 0, handX: 0, handY: 0,
      stringClone: true, awakened: false,
    };
  },
  update: (p, g) => {
    const d = p.data, m = d.mock, o = p.owner;
    m.animT++;
    if (p.t === 1) { sfx('string'); g.fx.text(p.x, p.y - 120, 'BLACK KNIGHT', '#ffffff', 20, 30); }
    const T = g.nearestEnemy(o, 700);
    const gy = g.groundBelow(m.x, m.y - 60);
    if (gy !== null) m.y = gy;
    if (p.t < 8) return;
    // Run in, then two kicks and a rising launcher.
    const ATK = [
      { at: 0, anim: 'roundhouse', dmg: 4.5, ang: 40, kb: 2.4, sc: 0.8 },
      { at: 12, anim: 'kick', dmg: 5, ang: 38, kb: 3, sc: 1.2 },
      { at: 24, anim: 'uppercut', dmg: 8, ang: 84, kb: 8.2, sc: 8 },
    ];
    if (d.phase === undefined) {
      if (T) m.facing = T.x >= m.x ? 1 : -1;
      const close = T && Math.abs(T.x - m.x) < 58;
      if (close || p.t > 40) { d.phase = 0; d.start = p.t; m.vx = 0; }
      else { m.state = 'run'; m.vx = m.facing * 10; m.x += m.vx; m.runPhase += 0.35; }
      return;
    }
    const k = p.t - d.start;
    const cur = ATK.slice().reverse().find(a => k >= a.at);
    if (cur && k - cur.at < 12) {
      m.state = 'attack'; m.move = { anim: cur.anim, startup: 3, dur: 12, hits: [], turns: 1 }; m.moveFrame = k - cur.at; m.moveActiveEnd = 6;
      if (k - cur.at === 3) {
        sfx('swingH');
        for (const E of foes(g, o)) {
          if (Math.abs(E.x - (m.x + m.facing * 40)) < 52 && Math.abs(E.y - E.h / 2 - (m.y - 44)) < 60) {
            strike(g, p, E, cur, m.facing, E.x, E.y - 40);
            g.fx.impact(E.x, E.y - 40, 40, THREAD);
          }
        }
      }
    } else if (k >= 36) {
      m.state = 'idle'; m.move = null;
      if (k === 36) { g.fx.burst(m.x, m.y - 40, 26, THREAD, 6, 'streak', 20, 2); }
      if (k > 44) p.life = 0;
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data, m = d.mock;
    const a = clamp(Math.min((p.t + 1) / 8, d.phase !== undefined && p.t - d.start > 36 ? 1 - (p.t - d.start - 36) / 8 : 1), 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    if (p.t < 8) {
      // Weaving itself together, thread by thread.
      ctx.beginPath(); ctx.rect(m.x - 80, m.y - 140 * (p.t / 8), 160, 200); ctx.clip();
    }
    drawFighter(ctx, m, computePose(m), t);
    ctx.restore();
  },
};

/** Threads run from his hands up into the clouds while he climbs. Visual only. */
SIGS.skyThreads = {
  init: (p) => { p.delay = MANUAL; },
  update: (p) => { p.x = p.owner.x; p.y = p.owner.y; },
  draw: (p, ctx) => {
    const a = clamp(p.life / 10, 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < 3; i++) thread(ctx, p.x - 8 + i * 8, p.y - 60, p.x - 40 + i * 40, p.y - 700, THREAD, 1, 0, 0.35);
    ctx.restore();
  },
};

/** Needles of string erupting from the floor ahead. Visual only; the move carries the hitbox. */
SIGS.needleFloor = {
  init: (p) => { p.delay = MANUAL; },
  draw: (p, ctx) => {
    const k = clamp(p.t / 4, 0, 1), a = clamp(p.life / 8, 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < 11; i++) {
      const x = p.x + (i - 5) * 11, h = (40 + ((i * 37) % 30)) * k;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x + p.dir * h * 0.25, p.y - h); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA(PINK, 0.25); ctx.beginPath(); ctx.ellipse(p.x, p.y - 20, 70, 26, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

// ===========================================================================
// MOVE VISUALS
// ===========================================================================

/** String cuts: a thin white slash line at every hitbox as it opens. */
registerVfx('doffyString', (f: any, g: any, fr: number, m: any) => {
  const s = f.scale || 1;
  for (const h of m.hits || []) {
    const opens = fr === h.f[0] || (h.rehit && fr > h.f[0] && fr <= h.f[1] && (fr - h.f[0]) % h.rehit === 0);
    if (!opens) continue;
    const cx = f.x + h.x * s * f.facing, cy = f.y + h.y * s;
    const ang = m.heat ? 0 : (h.ang > 60 ? -1.2 : h.ang < 0 ? 1.2 : -0.35) * f.facing;
    g.fx.cut(cx, cy, Math.max(h.w, h.h) * s * 1.1, f.facing > 0 ? ang : Math.PI - ang, 12, 0.5);
    g.fx.directional(cx, cy, 4, f.facing > 0 ? 0 : Math.PI, 0.5, m.heat ? HEAT : '#ffffff', 9, 'streak', 10, 2);
  }
});
registerVfx('doffyCast', (f: any, g: any, fr: number, m: any) => {
  if (fr < (m.startup || 0) && fr % 2 === 0) {
    g.fx.add({ x: f.x + f.facing * (18 + R() * 16), y: f.y - 50 - R() * 20, vx: f.facing * 2, vy: -0.6, color: R() < 0.5 ? THREAD : PINK_HI, kind: 'streak', life: 10, size: 2 });
  }
});

// ===========================================================================
// THE KIT
// ===========================================================================

const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, extra: Partial<HitDef> = {}): HitDef =>
  ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, fx: 'slash', ...extra });
const MULTI = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, fin: number, ang: number, kb: number, sc: number, rehit = 4, fx: HitDef['fx'] = 'slash'): HitDef[] => [
  H(f0, f1, x, y, w, h, dmg, 80, 1.6, 0, { rehit, pull: true, fx, g: 0 }),
  H(f1 + 1, f1 + 4, x, y, w * 1.08, h * 1.08, fin, ang, kb, sc, { fx, g: 1 }),
];
const mv = (name: string, anim: AnimName, dur: number, su: number, hits: HitDef[], o: Partial<MoveDef> & Record<string, any> = {}): MoveDef =>
  ({ name, anim, dur, startup: su, hits, vfx: 'doffyString', ...o } as MoveDef);

const cN = (w: [number, number]) => ({ light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cN2 = (w: [number, number]) => ({ light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cS = (w: [number, number]) => ({ light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cS2 = (w: [number, number]) => ({ special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cD = (w: [number, number]) => ({ light: 'dlight2', special: 'dlight_spec', window: w });
const cA = (w: [number, number]) => ({ light: 'nair2', special: 'nair_spec', window: w });
const cSA = (w: [number, number]) => ({ light: 'sair2', special: 'sair_spec', window: w });

function tamaito(f: any, g: any, vx: number, vy: number, o: any = {}) {
  const [hx, hy] = hand(f);
  spawn(g, f, 'tamaito', { x: hx, y: hy, vx: f.facing * vx, vy, w: 20, h: 20, life: 44, dmg: 4, ang: 36, kb: 3.2, sc: 2.2, stun: 4, ...o });
  sfx('string');
}
function aimVy(g: any, f: any, speed: number, range = 700) {
  const t = g.nearestEnemy(f, range); if (!t || (t.x - f.x) * f.facing < 0) return 0;
  const [hx, hy] = hand(f);
  const dx = Math.abs(t.x - hx) || 1;
  return clamp((t.y - t.h / 2 - hy) / dx * speed, -speed * 0.6, speed * 0.6);
}
function overheat(g: any, f: any, o: { len?: number; out?: number; hold?: number; tilt?: number; tick?: Blow; fin?: Blow } = {}) {
  const life = (o.out ?? 8) + (o.hold ?? 10) + 10;
  spawn(g, f, 'overheat', { life, data: { ...o } });
}
function fulbright(g: any, f: any, x: number, at: number, o: any = {}) {
  const y = g.groundBelow(x, f.y - 60) ?? f.y;
  spawn(g, f, 'fulbright', { x, y, w: 26, h: 260, ground: true, life: at + 14, delay: at, activeFor: 5, dmg: 6, ang: 82, kb: 5.6, sc: 5.4, ...o });
}

const core: CoreKit = {
  // ---- neutral: string cuts and his long legs ----
  nlight: mv('String Slice', 'slash', 16, 4, [H(4, 7, 50, -50, 66, 40, 5, 38, 3.0, 1.8)], { chains: cN([4, 14]) }),
  nlight2: mv('Backhand Thread', 'backslash', 17, 3, [H(3, 7, 54, -48, 70, 44, 5.5, 42, 3.3, 2.1)], { chains: cN2([3, 15]) }),
  nlight3: mv('Heavenly Demon Kick', 'roundhouse', 26, 5, [H(5, 11, 46, -44, 78, 56, 9.5, 42, 6.2, 7.2, { fx: 'blunt' })], { threads: false }),
  nlight_spec: mv('Tamaito', 'palm', 26, 6, [], {
    vfx: 'doffyCast', desc: 'A single bullet of wound string off the fingertip.',
    onFrame: (f, fr, g) => { if (fr === 6) tamaito(f, g, 15, aimVy(g, f, 15), { dmg: 7, kb: 5.6, sc: 6 }); },
  }),
  nlight_heavy: mv('Rising Thread', 'upslash', 28, 5, [H(5, 13, 36, -72, 64, 96, 10.5, 86, 7.0, 8.0)], {}),

  // ---- side ----
  slight: mv('Stride Kick', 'kick', 20, 4, [H(4, 9, 56, -40, 72, 40, 6, 28, 3.8, 2.2, { fx: 'blunt' })], { vel: [[3, 10, null], [10, 2, null]], threads: false, chains: cS([4, 16]) }),
  slight2: mv('Thread Lash', 'slash', 21, 3, [H(3, 8, 66, -48, 96, 42, 7, 34, 4.6, 3.8)], { vel: [[3, 6, null]], chains: cS2([3, 16]) }),
  slight_spec: mv('Sora no Michi Rush', 'thrust', 26, 4, [H(4, 14, 44, -46, 70, 52, 9.5, 34, 6.2, 6.8, { fx: 'blunt' })], {
    vel: [[4, 22, -2], [15, 3, null]], threads: false,
    onFrame: (f, fr, g) => { if (fr === 4) spawn(g, f, 'skyThreads', { life: 12 }); },
  }),
  slight_heavy: mv('Five-Finger Rake', 'slash', 31, 6, [H(6, 14, 64, -48, 100, 70, 12.5, 40, 7.4, 8.8)], { vel: [[6, 8, null]] }),

  // ---- down ----
  dlight: mv('Low Thread', 'lowslash', 20, 4, [H(4, 9, 52, -12, 86, 26, 6, 76, 4.0, 1.8)], { vel: [[3, 8, null], [11, 2, null]], chains: cD([4, 16]) }),
  dlight2: mv('Rising Heel', 'axeKick', 22, 4, [H(4, 10, 34, -60, 60, 80, 8, 86, 5.6, 4.6, { fx: 'blunt' })], { vel: [[4, 1, -8]], threads: false }),
  dlight_spec: mv('Floor Needles', 'slam', 28, 7, MULTI(7, 16, 64, -26, 110, 56, 2.2, 6.5, 80, 5.8, 6.4, 3), {
    onFrame: (f, fr, g) => { if (fr === 7) spawn(g, f, 'needleFloor', { x: f.x + f.facing * 64, y: g.groundBelow(f.x + f.facing * 64, f.y - 60) ?? f.y, life: 20 }); },
  }),

  // ---- air ----
  nair: mv('Sky Walk Spin', 'spinKick', 22, 3, [H(3, 11, 0, -42, 104, 88, 6, 66, 3.4, 2.1, { fx: 'blunt', rehit: 6 })], { land: true, turns: 1, threads: false, chains: cA([3, 17]) }),
  nair2: mv('Heel Drop', 'axeKick', 23, 3, [H(3, 11, 24, -20, 64, 58, 8, -52, 4.4, 3.6, { fx: 'blunt' })], { land: true, vel: [[3, 2, 8]], threads: false }),
  nair_spec: mv('Fulbright', 'castUp', 28, 6, [], {
    vfx: 'doffyCast', desc: 'Two strings shot down out of the sky onto the ground ahead.',
    onFrame: (f, fr, g) => { if (fr === 6) { fulbright(g, f, f.x + f.facing * 70, 8, { dmg: 6, ang: -60, kb: 5, sc: 5 }); fulbright(g, f, f.x + f.facing * 130, 12, { dmg: 6, ang: -60, kb: 5, sc: 5 }); } },
  }),
  sair: mv('Aerial Thread', 'slash', 19, 3, [H(3, 8, 54, -46, 76, 44, 6.5, 30, 3.8, 2.5)], { land: true, chains: cSA([3, 16]) }),
  sair2: mv('Aerial Kick', 'kick', 21, 3, [H(3, 10, 50, -40, 70, 42, 8, 34, 4.8, 4.2, { fx: 'blunt' })], { land: true, threads: false }),
  sair_spec: mv('Cloud Swing', 'spin', 25, 4, [H(4, 13, 44, -42, 86, 66, 9.5, 38, 6.2, 6.8)], {
    turns: 1, vel: [[4, 15, -3]],
    onFrame: (f, fr, g) => { if (fr === 4) spawn(g, f, 'skyThreads', { life: 14 }); },
  }),
  dair: mv('Stomp from the Sky', 'stomp', 26, 5, [H(5, 15, 10, -6, 54, 50, 8.5, -58, 4.4, 3.2, { fx: 'blunt' })], { land: true, vel: [[5, 3, 12]], threads: false }),

  // ---- heavies ----
  nsig: mv('Overhead Heel', 'axeKick', 40, 10, [H(10, 16, 34, -60, 70, 92, 12.5, 84, 6.8, 8.4, { fx: 'blunt' })], { threads: false }),
  ssig: mv('Five-Finger Flurry', 'flurry', 44, 10, MULTI(10, 24, 60, -48, 96, 60, 2.3, 8.5, 38, 6.5, 8.4, 3), { vel: [[10, 6, null], [25, 1, null]] }),
  dsig: mv("Spider's Nest", 'cast', 42, 10, [], {
    vfx: 'doffyCast', desc: 'Kumo no Sugaki: a web strung across the space in front of him that shreds whatever runs into it.',
    onFrame: (f, fr, g) => {
      if (fr === 10) spawn(g, f, 'spiderNest', { x: f.x + f.facing * 74, y: f.y - 50, w: 110, h: 110, life: 40, delay: 6, activeFor: 26, rehit: 6, dmg: 2.6, ang: 70, kb: 1.4, sc: 0, stun: 8, pull: true, fin: { dmg: 7, ang: 40, kb: 7, sc: 7.2 } });
    },
  }),
  rec: mv('Sora no Michi', 'rise', 34, 5, MULTI(5, 20, 10, -52, 70, 90, 2.6, 7, 82, 5.4, 7.2, 5, 'blunt'), {
    turns: 1, grav: 0.38, vel: [[5, 3, -16]], threads: false,
    onFrame: (f, fr, g) => { if (fr === 5) { spawn(g, f, 'skyThreads', { life: 22 }); sfx('string'); } },
  }),
  gp: mv('Falling Heel', 'stomp', 38, 7, [H(7, 32, 16, -12, 62, 60, 10, -62, 5.4, 7.2, { fx: 'blunt' })], { land: true, vel: [[7, 3, 18]], threads: false }),

  // ---- specials ----
  nspec: mv('Tamaito', 'palm', 44, 8, [], {
    cd: 150, vfx: 'doffyCast', grav: 0.25,
    desc: 'Five bullets of wound string, one off each fingertip, fired at the nearest foe.',
    onFrame: (f, fr, g) => {
      if (fr < 8 || fr > 20 || (fr - 8) % 3 !== 0) return;
      const vy = aimVy(g, f, 16);
      tamaito(f, g, 16, vy + ((fr - 8) / 3 - 2) * 0.5, { dmg: 3.6 });
    },
  }),
  sspec: mv('Overheat', 'slash', 42, 9, [], {
    cd: 150, vfx: 'doffyCast', heat: true,
    desc: 'A rope of twisted string, red-hot, lashed out across a huge distance. Everything along it burns.',
    onFrame: (f, fr, g) => { if (fr === 9) { overheat(g, f, { len: 470, out: 8, hold: 10, fin: { dmg: 10, ang: 38, kb: 8, sc: 8.4, fx: 'fire' } }); g.fx.text(f.x, f.y - 140, 'OVERHEAT', HEAT, 20, 30); } },
  }),
  dspec: mv('Parasite', 'castUp', 40, 8, [], {
    cd: 180, vfx: 'doffyCast',
    desc: 'Threads from each finger hook the nearest foe\'s limbs. For a moment their body is his puppet: it walks where he pulls it, and then he throws it.',
    onFrame: (f, fr, g) => {
      if (fr !== 8) return;
      const t = g.nearestEnemy(f, 420);
      if (t) spawn(g, f, 'parasite', { life: 56, data: { target: t, hold: 42 } });
      else g.fx.text(f.x + f.facing * 60, f.y - 90, 'fufufu', PINK_HI, 16, 24);
    },
  }),
};

// ---------------------------------------------------------------------------
// AWAKENED
// ---------------------------------------------------------------------------

type Tier = 'awaken' | 'awakenLight' | 'awakenHeavy' | 'awakened';
type Stance = 'neutral' | 'side' | 'down' | 'air';
const LABEL: Record<Tier, string> = {
  awaken: 'AWAKEN · R AT FULL GAUGE', awakenLight: 'AWAKENED LIGHT · J', awakenHeavy: 'AWAKENED HEAVY · K', awakened: 'AWAKENED SPECIAL · L',
};
const SPECIAL_KEY: Record<Stance, MoveKey> = { neutral: 'nfu', side: 'sfu', down: 'dfu', air: 'afu' };
function aw(tier: Tier, stance: Stance, m: Partial<MoveDef> & Record<string, any>): MoveDef {
  return {
    hits: [], anim: 'cast', vfx: 'doffyString', ...m,
    ability: tier, stance, techniqueProfile: 'doflamingo', techniqueStyle: 'blade', variantOf: 'Awakening: String World', chainLabel: LABEL[tier],
    cd: tier === 'awakened' ? 260 : tier === 'awakenHeavy' ? 90 : m.cd,
    land: stance === 'air' ? true : m.land,
    chains: tier === 'awakenHeavy' ? { special: SPECIAL_KEY[stance], window: [Math.max(4, (m.startup ?? 8) - 1), Math.min((m.dur ?? 40) - 2, 30)] } : m.chains,
  } as MoveDef;
}

function transformation(stance: Stance, name: string, desc: string, extra: Partial<MoveDef> = {}): MoveDef {
  return aw('awaken', stance, {
    name, desc, anim: 'castUp', dur: 38, startup: 14, grav: stance === 'air' ? 0.2 : 0.6, invuln: [0, 16], vfx: 'doffyCast',
    hits: [H(14, 20, 0, -40, 200, 150, 7, 70, 6.2, 5.4)],
    ...extra,
    onFrame: (f: any, fr: number, g: any) => {
      if (fr === 1) { sfx('string'); g.fx.text(f.x, f.y - 120, 'fufufufu...', PINK_HI, 18, 26); }
      if (fr === 14) {
        f.auraT = Math.max(f.auraT, 60);
        g.fx.text(f.x, f.y - 170, 'AWAKENING', '#ffffff', 30, 60);
        g.fx.ring(f.x, f.y - 30, 10, 240, PINK, 24, 8);
        g.fx.ring(f.x, f.y, 10, 320, THREAD, 22, 4);
        for (let i = 0; i < 24; i++) { const a = R() * Math.PI; g.fx.add({ x: f.x, y: f.y - 4, vx: Math.cos(a) * (6 + R() * 10), vy: -Math.sin(a) * (4 + R() * 8), color: R() < 0.6 ? THREAD : PINK_HI, kind: 'streak', life: 24, size: 2.4 }); }
        g.shake(18); g.flashScreen(PINK, 0.35); g.punchIn(f.x, f.y - 44, 0.08);
        sfx('birdcage');
      }
    },
  });
}

const awakened: Partial<Record<MoveKey, MoveDef>> = {
  naw: transformation('neutral', 'Awakening: String World', 'The fruit awakens: the ground under him turns to living string, and every thread he casts is thicker, hotter and faster.'),
  saw: transformation('side', 'Awakening: String World · Surge', 'Awakens striding forward on a wave of string.', { vel: [[14, 11, null], [24, 2, null]] }),
  daw: transformation('down', 'Awakening: String World · Nest', 'Awakens with the floor unravelling in a ring around him.'),
  aaw: transformation('air', 'Awakening: String World · Sky', 'Awakens hanging from the clouds.'),

  nwl: aw('awakenLight', 'neutral', {
    name: 'Tamaito Barrage', dur: 24, startup: 4, vfx: 'doffyCast', anim: 'palm',
    desc: 'Three string bullets in a quick tight burst.',
    onFrame: (f: any, fr: number, g: any) => { if (fr === 4 || fr === 7 || fr === 10) tamaito(f, g, 17, aimVy(g, f, 17), { dmg: 3.8, stun: 5 }); },
  }),
  swl: aw('awakenLight', 'side', {
    name: 'Overheat Lash', dur: 26, startup: 5, anim: 'slash', vfx: 'doffyCast', heat: true,
    desc: 'A short, fast crack of the burning rope.',
    onFrame: (f: any, fr: number, g: any) => { if (fr === 5) overheat(g, f, { len: 280, out: 5, hold: 5, tick: { dmg: 2.6, ang: 36, kb: 2.2, sc: 1, stun: 6, fx: 'fire' }, fin: { dmg: 4.5, ang: 36, kb: 4.4, sc: 3.4, fx: 'fire' } }); },
  }),
  dwl: aw('awakenLight', 'down', {
    name: 'Needle Floor', dur: 26, startup: 5, anim: 'slam',
    desc: 'The awakened floor answers him: a bed of string needles spikes up in front of him.',
    hits: [H(5, 13, 60, -24, 130, 52, 5.6, 78, 3.6, 2.4, { rehit: 5 })],
    onFrame: (f: any, fr: number, g: any) => { if (fr === 5) spawn(g, f, 'needleFloor', { x: f.x + f.facing * 60, y: g.groundBelow(f.x + f.facing * 60, f.y - 60) ?? f.y, life: 18 }); },
  }),
  awl: aw('awakenLight', 'air', {
    name: 'Fulbright', dur: 26, startup: 4, anim: 'castUp', vfx: 'doffyCast',
    desc: 'Three strings shot down out of the sky in a line beneath him.',
    onFrame: (f: any, fr: number, g: any) => { if (fr === 4) for (let i = 0; i < 3; i++) fulbright(g, f, f.x + f.facing * (20 + i * 50), 4 + i * 3, { dmg: 4.6, ang: -58, kb: 4, sc: 3.6 }); },
  }),

  nwh: aw('awakenHeavy', 'neutral', {
    name: 'Black Knight', dur: 40, startup: 8, anim: 'cast', vfx: 'doffyCast',
    desc: 'A full-size copy of himself, woven from string, runs the nearest foe down and kicks them into the sky while he stands and watches.',
    onFrame: (f: any, fr: number, g: any) => { if (fr === 8) spawn(g, f, 'blackKnight', { x: f.x + f.facing * 30, y: f.y, life: 100 }); },
  }),
  swh: aw('awakenHeavy', 'side', {
    name: 'Goshikito', dur: 44, startup: 10, anim: 'slash', vfx: 'doffyCast',
    desc: 'Five-Coloured String: five threads, one of each colour, rake down through everything in front of him like the claws of a beast.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 10) return;
      spawn(g, f, 'goshikito', { x: f.x + f.facing * 120, y: f.y - 60, w: 200, h: 150, life: 24, delay: 4, activeFor: 10, rehit: 5, dmg: 3, ang: 70, kb: 1.4, sc: 0, stun: 8, pull: true, fin: { dmg: 10, ang: 80, kb: 8.6, sc: 8.6 } });
      g.fx.text(f.x, f.y - 150, 'GOSHIKITO', '#ffffff', 22, 34);
    },
  }),
  dwh: aw('awakenHeavy', 'down', {
    name: 'Surging Wave', dur: 42, startup: 9, anim: 'slam', vfx: 'doffyCast',
    desc: 'The floor itself peels up into a breaking wave of string and rolls forward, carrying whatever it hits up and over.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 9) return;
      spawn(g, f, 'stringWave', { x: f.x + f.facing * 50, y: f.y, vx: f.facing * 10, w: 96, h: 90, ground: true, life: 44, rehit: 7, dmg: 2.6, ang: 80, kb: 2, sc: 0, stun: 8, pull: true, fin: { dmg: 9, ang: 84, kb: 8.6, sc: 8.4 } });
      g.shake(8); sfx('string-whip');
    },
  }),
  awh: aw('awakenHeavy', 'air', {
    name: 'Sixteen Holy Bullets', dur: 44, startup: 6, anim: 'cast', grav: 0.15, vfx: 'doffyCast',
    desc: 'Sixteen thick strings driven down from his hand one after another, stapling the ground and anyone on it.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 6) return;
      const t = g.nearestEnemy(f, 520);
      const cx = t ? t.x : f.x + f.facing * 150;
      const cy = t ? t.y - t.h / 2 : (g.groundBelow(cx, f.y) ?? f.y + 150) - 30;
      const [hx, hy] = hand(f);
      for (let i = 0; i < 16; i++) {
        const last = i === 15;
        const tx = cx + (R() - 0.5) * 70, ty = cy + (R() - 0.5) * 50;
        const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1;
        spawn(g, f, 'holyBullet', { life: 40, data: { at: 2 + i * 2, x1: hx, y1: hy, x2: hx + dx / L * (L + 40), y2: hy + dy / L * (L + 40),
          blow: last ? { dmg: 7, ang: -45, kb: 7.6, sc: 7.4 } : { dmg: 1.2, ang: 60, kb: 0.6, sc: 0, stun: 8 } } });
      }
    },
  }),

  nfu: aw('awakened', 'neutral', {
    name: 'Birdcage', dur: 60, startup: 14, anim: 'castUp', vfx: 'doffyCast', cin: 34, invuln: [0, 16],
    desc: 'Torikago. Threads drop out of the sky and close into a dome around the fight. Nobody inside can leave, the bars cut anyone who touches them, and the cage slowly shrinks until it closes on whoever is left.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 14) return;
      const y = g.groundBelow(f.x, f.y - 60) ?? f.y;
      spawn(g, f, 'birdcage', { x: f.x, y, life: 200, data: { r0: 430, r1: 150, dur: 180 } });
      g.fx.text(f.x, f.y - 180, 'BIRDCAGE', '#ffffff', 34, 70);
    },
  }),
  sfu: aw('awakened', 'side', {
    name: 'God Thread', dur: 56, startup: 12, anim: 'thrust', vfx: 'doffyCast', invuln: [0, 14],
    desc: 'Sixteen strings twisted into a single rope as thick as a man, driven straight ahead like the fist of a god.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 12) return;
      spawn(g, f, 'godThread', { life: 40, data: { len: 800 } });
      g.fx.text(f.x, f.y - 170, 'GOD THREAD', '#ffffff', 30, 56);
      g.flashScreen(PINK, 0.25);
    },
  }),
  dfu: aw('awakened', 'down', {
    name: 'Rolling Tide', dur: 58, startup: 12, anim: 'slam', vfx: 'doffyCast', invuln: [0, 14],
    desc: 'The whole floor around him awakens at once: two breaking waves of string roll out in both directions and crash down on anything in their way.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 12) return;
      for (const dir of [1, -1]) {
        spawn(g, f, 'stringWave', { x: f.x + dir * 60, y: f.y, vx: dir * 9, dir, w: 130, h: 130, ground: true, life: 52, rehit: 6, dmg: 2.6, ang: 82, kb: 2, sc: 0, stun: 8, pull: true, fin: { dmg: 11, ang: 86, kb: 9.2, sc: 9 } });
      }
      g.shake(16); g.flashScreen('#ffffff', 0.2); sfx('birdcage');
      g.fx.text(f.x, f.y - 170, 'ROLLING TIDE', '#ffffff', 26, 48);
    },
  }),
  afu: aw('awakened', 'air', {
    name: 'Fulbright Storm', dur: 56, startup: 10, anim: 'castUp', vfx: 'doffyCast', grav: 0.1, invuln: [0, 12],
    desc: 'He tears the clouds open: strings rain down across the whole stage beneath him, one after another.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 10) return;
      const t = g.nearestEnemy(f, 800);
      const cx = t ? t.x : f.x + f.facing * 120;
      for (let i = 0; i < 11; i++) {
        const x = cx + (i - 5) * 44 + (R() - 0.5) * 16;
        fulbright(g, f, x, 6 + Math.abs(i - 5) * 3 + (i % 2) * 2, i === 5 ? { dmg: 11, ang: 80, kb: 8.4, sc: 8.4 } : { dmg: 3.4, ang: 78, kb: 2.6, sc: 1.4, stun: 8 });
      }
      g.fx.text(f.x, f.y - 160, 'FULBRIGHT', '#ffffff', 26, 44);
    },
  }),
};

// ---------------------------------------------------------------------------
// DEFINITION
// ---------------------------------------------------------------------------

const look: Look = {
  skin: '#e7b286', hair: '#f4d046', hairStyle: 'spikeShort',
  top: '#f6f2e6', top2: PINK, sleeve: '#f6f2e6', fore: '#e7b286', pants: '#f2a53a', boots: '#efe6d2',
  cape: PINK, eye: '#ff4a3a', weapon: 'fists', mark: 'none',
  energy: PINK, energy2: '#ffffff',
  pose: 'dancer', idle: 'sway', run: 'skater', eyeStyle: 'narrow', accent: PINK_HI,
  build: { shoulder: 1.18, chest: 1.05, limb: 1.2, head: 0.98, torso: 1.1, hip: 1 },
};

const generated = installTechniques('doflamingo', look, core) as Record<MoveKey, MoveDef>;
const moves = { ...generated, ...awakened } as Record<MoveKey, MoveDef>;

export const DOFLAMINGO: CharDef = {
  id: 'doflamingo', styleId: 'doflamingo', name: 'Donquixote Doflamingo', short: 'Doflamingo', anime: 'One Piece', title: 'The Heavenly Demon', tier: 'S', color: PINK,
  desc: 'The Heavenly Demon of Dressrosa. The String-String Fruit turns every finger into a blade: he cuts with thread, walks on the clouds, marionettes his opponents - and, awakened, turns the whole world into string and drops the Birdcage over it.',
  portrait: makePortrait('doflamingo', look, PINK),
  stats: { speed: 7.0, air: 7.4, jump: 14.2, weight: 1.06, scale: 1.14, gravity: 0.58 },
  statBars: { power: 4, speed: 4, range: 5, defense: 3 },
  look, moves,
  moveBranches: [
    { input: 'J → J → J', name: 'String Slice Chain', desc: 'String Slice → Backhand Thread → Heavenly Demon Kick.' },
    { input: 'J → L', name: 'Tamaito', desc: 'Cancels the string into a single string bullet.' },
    { input: '→ J → L', name: 'Sora no Michi Rush', desc: 'Strides forward on the sky mid-string.' },
    { input: 'L / → L / ↓ L', name: 'Tamaito · Overheat · Parasite', desc: 'String bullets, the burning rope, and the puppet hold.' },
    { input: 'R @ full gauge', name: 'Awakening: String World', desc: 'Every button reaches for a bigger string technique.' },
    { input: 'AWAKENED · K → L', name: 'Launcher → Birdcage / God Thread / Rolling Tide / Fulbright Storm', desc: 'Each awakened heavy chains into its stance\'s awakened special.' },
  ],
  abilities: [
    { key: 'L · Neutral Special', name: moves.nspec.name!, desc: moves.nspec.desc! },
    { key: 'L · Side Special', name: moves.sspec.name!, desc: moves.sspec.desc! },
    { key: 'L · Down Special', name: moves.dspec.name!, desc: moves.dspec.desc! },
    { key: 'R · Awaken (full gauge)', name: moves.naw.name!, desc: `${moves.naw.desc} The gauge drains from full to empty over about thirty seconds; at zero the Awakening ends.` },
    { key: 'AWAKENED · J · Light', name: `${moves.nwl.name} / ${moves.swl.name}`, desc: `${moves.nwl.desc} Side: ${moves.swl.desc} Down: ${moves.dwl.desc} Air: ${moves.awl.desc}` },
    { key: 'AWAKENED · K · Heavy', name: `${moves.nwh.name} / ${moves.swh.name}`, desc: `${moves.nwh.desc} Side: ${moves.swh.desc} Down: ${moves.dwh.desc} Air: ${moves.awh.desc}` },
    { key: 'AWAKENED · L · Special', name: `${moves.nfu.name} / ${moves.sfu.name}`, desc: `${moves.nfu.desc} Side: ${moves.sfu.desc} Down: ${moves.dfu.desc} Air: ${moves.afu.desc}` },
  ],
  passives: [
    { name: 'String-String Fruit', desc: 'Most of his normals are string cuts that reach far past his hands, and his kicks come off very long legs.' },
    { name: 'Sora no Michi', desc: 'He walks on the clouds: his recovery and air rush hang from threads in the sky.' },
    { name: 'Birdcage', desc: 'His neutral awakened special cages the fight, cuts anyone at the bars, and shrinks until it closes.' },
  ],
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: undefined, ultRange: 520 },
};
