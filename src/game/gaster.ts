/**
 * W. D. GASTER — Glitchtale.
 *
 * The Royal Scientist, pulled back out of the void. He barely moves his own body
 * to fight: the disembodied hands with the holes through their palms do the
 * striking, the Gaster Blasters he invented do the killing, and the void is a
 * door he can step through whenever he likes.
 *
 * BASE: normal Gaster. Floating hands, Gaster Blasters, void rifts.
 *
 * AWAKENED — SEVEN SOULS: every awakened move is a different human SOUL's
 * power, channelled through a hand dyed that SOUL's colour:
 *
 *   J  light    Justice (volley) · Bravery (knuckle) · Kindness (shield) · Integrity (gravity)
 *   K  heavy    Patience (stasis) · Perseverance (binding) · Determination (crush) · all seven (barrage)
 *   L  special  Spectrum Blaster Array · Prismatic Blaster · Void Collapse · Determination Descent
 *
 * Nothing in this kit is generated: every awakened move is authored here.
 */
import { sfx } from './audio';
import { makePortrait } from './portraits';
import { installTechniques } from './techniques';
import { SIGS } from './signatures';
import { registerVfx } from './vfx';
import type { CharDef, CoreKit, MoveKey } from './characters';
import type { AnimName, HitDef, MoveDef } from './types';
import type { Look } from './render';
import {
  SOULS, SOUL, VOID_BLACK, VOID_VIOLET, BONE,
  drawBlaster, drawBeam, drawHand, drawHeart, drawGlitch, heartPath,
} from './gasterArt';

const R = Math.random;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function hexA(c: string, a: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
const WHITE_HOT = '#eaf6ff';

// ===========================================================================
// SHARED HIT HELPERS
// ===========================================================================

interface Blow { dmg: number; ang: number; kb: number; sc: number; stun?: number; fx?: HitDef['fx'] }

/** Every enemy of `owner` whose body is within `r` of (x, y). */
function enemiesNear(g: any, owner: any, x: number, y: number, r: number) {
  return g.fighters.filter((T: any) => T !== owner && T.alive && g.canDamage(owner, T) && Math.hypot(T.x - x, T.y - T.h / 2 - y) < r + T.hw);
}

function strike(g: any, p: any, T: any, b: Blow, dir: number, x: number, y: number) {
  return g.applyHit(p.owner, T, { dmg: b.dmg, ang: b.ang, kb: b.kb, sc: b.sc, stun: b.stun, fx: b.fx || 'dark', ultLocked: p.ultLocked }, dir, T.x, T.y - T.h / 2, false,
    { x, y, vx: 0, vy: 0, noMeter: p.ultLocked });
}

/**
 * Beam collision along an arbitrary angle. The engine's own projectile test is
 * an axis-aligned box, which is useless for a diagonal Gaster Blaster, so the
 * beam entities disable it and test the segment themselves.
 */
function beamHits(g: any, p: any, x1: number, y1: number, ang: number, len: number, half: number, b: Blow, rehit: number) {
  const x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (const T of g.fighters) {
    if (T === p.owner || !T.alive || !g.canDamage(p.owner, T)) continue;
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
  owner: f, type: 'sig', sig, x: f.x, y: f.y, vx: 0, vy: 0, w: 60, h: 60, life: 40,
  dmg: 0, ang: 40, kb: 4, sc: 4, dir: f.facing, fx: 'dark', ...o, data: { ...(o.data || {}) },
});
/** An entity that owns its own collision: the engine never sees it as active. */
const MANUAL = 100000;

// ===========================================================================
// SIGNATURE ENTITIES
// ===========================================================================

/**
 * GASTER BLASTER.
 * Materialises out of the void with a quarter turn, locks its aim, drops its
 * jaw while the socket and throat charge, then fires. The beam is tested along
 * its real angle, ticks while it holds, and ends on a heavier final blow.
 */
SIGS.gasterBlaster = {
  init: (p) => {
    const d = p.data;
    d.ang ??= p.dir > 0 ? 0 : Math.PI;
    d.size ??= 34; d.charge ??= 22; d.fire ??= 20; d.len ??= 900; d.width ??= 44;
    d.tx = p.x; d.ty = p.y;
    // Slide in from behind the aim line, turned a quarter away.
    d.sx = p.x - Math.cos(d.ang) * 70; d.sy = p.y - Math.sin(d.ang) * 70 - 20;
    d.spin = (R() < 0.5 ? -1 : 1) * 1.6;
    p.x = d.sx; p.y = d.sy;
    p.delay = MANUAL;
  },
  update: (p, g) => {
    const d = p.data, t = p.t;
    const col: string = d.rainbow ? SOUL(Math.floor(t / 3)) : (d.col || WHITE_HOT);
    if (t <= d.charge) {
      const k = clamp(t / Math.max(1, d.charge - 6), 0, 1), e = 1 - Math.pow(1 - k, 3);
      p.x = d.sx + (d.tx - d.sx) * e; p.y = d.sy + (d.ty - d.sy) * e;
      d.turn = d.spin * (1 - e);
      d.jaw = clamp((t - (d.charge - 9)) / 9, 0, 1);
      d.glow = clamp(t / d.charge, 0, 1);
      if (t === 1) { sfx('blaster-charge'); g.fx.ring(d.tx, d.ty, 6, d.size * 1.6, col, 12, 3); }
      // Motes pulled into the throat.
      if (t % 2 === 0) {
        const a = R() * TAU, r = d.size * (1.6 + R());
        const mx = p.x + Math.cos(d.ang) * d.size * 0.6, my = p.y + Math.sin(d.ang) * d.size * 0.6;
        g.fx.add({ x: mx + Math.cos(a) * r, y: my + Math.sin(a) * r, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, color: R() < 0.5 ? col : '#ffffff', kind: 'glow', life: 12, size: 3 + R() * 3 });
      }
    }
    const firing = t >= d.charge && t < d.charge + d.fire;
    if (t === d.charge) {
      sfx('blaster-fire');
      g.shake(d.big ? 16 : 9); g.flashScreen(col, d.big ? 0.32 : 0.14);
      if (d.big) g.punchIn(p.x, p.y, 0.08);
      g.fx.ring(p.x + Math.cos(d.ang) * d.size, p.y + Math.sin(d.ang) * d.size, 8, d.width * 2.4, col, 16, 6);
    }
    if (firing) {
      const k = t - d.charge;
      d.beamW = d.width * Math.min(1, (k + 1) / 4) * Math.min(1, (d.fire - k) / 5 + 0.2);
      d.beamL = d.len * Math.min(1, (k + 1) / 3);
      // Recoil: the skull rocks back along its aim while it fires.
      p.x = d.tx - Math.cos(d.ang) * Math.min(12, k * 2); p.y = d.ty - Math.sin(d.ang) * Math.min(12, k * 2);
      const mx = p.x + Math.cos(d.ang) * d.size * 0.95, my = p.y + Math.sin(d.ang) * d.size * 0.95;
      const last = k === d.fire - 1 && d.fin;
      if (last) { p.hitMap.clear(); beamHits(g, p, mx, my, d.ang, d.beamL, d.beamW * 0.5, d.fin, 0); }
      else beamHits(g, p, mx, my, d.ang, d.beamL, d.beamW * 0.5, d.tick || { dmg: 2.2, ang: 55, kb: 1.4, sc: 0, stun: 8 }, d.rehit || 5);
      if (k % 3 === 0) g.shake(d.big ? 7 : 4);
      for (let i = 0; i < 3; i++) {
        const u = R() * d.beamL;
        g.fx.add({ x: mx + Math.cos(d.ang) * u, y: my + Math.sin(d.ang) * u + (R() - 0.5) * d.beamW * 0.6, vx: Math.cos(d.ang) * 7, vy: Math.sin(d.ang) * 7, color: R() < 0.5 ? col : '#ffffff', kind: 'streak', life: 10, size: 2.4 });
      }
    }
    if (t >= d.charge + d.fire) {
      d.beamW = 0;
      d.jaw = Math.max(0, (d.jaw ?? 1) - 0.12);
      p.x -= Math.cos(d.ang) * 1.5; p.y -= Math.sin(d.ang) * 1.5;
    }
    if (t > d.charge + d.fire + 16) p.life = 0;
  },
  draw: (p, ctx, t) => {
    const d = p.data;
    const col: string = d.rainbow ? SOUL(Math.floor(p.t / 3)) : (d.col || WHITE_HOT);
    const end = d.charge + d.fire;
    const a = p.t > end ? clamp(1 - (p.t - end) / 16, 0, 1) : clamp(p.t / 5, 0, 1);
    if (d.beamW > 0) drawBeam(ctx, p.x + Math.cos(d.ang) * d.size * 0.95, p.y + Math.sin(d.ang) * d.size * 0.95, d.ang, d.beamL, d.beamW, col, t, 1);
    else if (p.t < d.charge) {
      // Aim telegraph: a thin dotted sight line that brightens as it charges.
      ctx.save();
      ctx.globalAlpha = 0.18 + d.glow * 0.3;
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(d.ang) * d.len, p.y + Math.sin(d.ang) * d.len); ctx.stroke();
      ctx.restore();
    }
    if (d.rainbow || d.col) drawGlitch(ctx, p.x, p.y, d.size * 2.4, d.size * 1.6, t, 6, ['#ffffff', col], a * 0.7, p.x);
    drawBlaster(ctx, p.x, p.y, d.size, d.ang + (d.turn || 0), d.jaw || 0, d.glow || 0, col, a);
  },
};

/**
 * VOID GRASP. A pool of void opens under the target, and two giant hands rise
 * out of it and clap shut. `crimson` is Determination's version: one colossal
 * red hand that closes into a fist and throws them skyward.
 */
SIGS.gasterGrasp = {
  init: (p) => { p.data.size ??= 1; },
  update: (p, g) => {
    const d = p.data;
    if (p.t === 1) { sfx('void'); g.fx.ring(p.x, p.y - 2, 6, 60 * d.size, d.col || VOID_VIOLET, 14, 3); }
    if (p.t === p.delay) {
      sfx(d.crimson ? 'heavyhit' : 'swingH'); g.shake(d.crimson ? 12 : 7);
      g.fx.burst(p.x, p.y - 10, 12, d.col || VOID_VIOLET, 6, 'shard', 20, 4, 0.2);
    }
    if (p.t > 2 && p.t < p.delay && p.t % 2 === 0) {
      g.fx.add({ x: p.x + (R() - 0.5) * 80 * d.size, y: p.y - 2, vy: -2 - R() * 3, color: R() < 0.5 ? (d.col || VOID_VIOLET) : '#ffffff', kind: 'glow', life: 14, size: 3 });
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data, s = d.size, col = d.col || VOID_VIOLET;
    const a = clamp(Math.min(p.life / 8, (p.t + 1) / 4), 0, 1);
    const rise = clamp((p.t - p.delay + 8) / 10, 0, 1);
    const close = clamp((p.t - p.delay) / 8, 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    // Pool.
    ctx.fillStyle = VOID_BLACK;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 58 * s, 10 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 2; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 70 * s);
    pg.addColorStop(0, hexA(col, 0.35)); pg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(p.x, p.y - 8, 70 * s, 26 * s, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // The hands, clipped at the floor so they emerge from the pool.
    ctx.beginPath(); ctx.rect(p.x - 200, p.y - 400, 400, 400); ctx.clip();
    const hsz = (d.crimson ? 34 : 24) * s;
    const up = p.y + hsz * 2.4 - rise * (hsz * 2.4 + 58 * s);
    if (d.crimson) {
      drawHand(ctx, p.x, up, hsz, 0, { grip: close, col: d.col, glow: d.col });
    } else {
      const off = (1 - close) * 34 * s + 8 * s;
      drawHand(ctx, p.x - off, up, hsz, 0.35 - close * 0.5, { grip: close * 0.6, col: BONE, glow: col, mirror: true });
      drawHand(ctx, p.x + off, up, hsz, -0.35 + close * 0.5, { grip: close * 0.6, col: BONE, glow: col });
    }
    ctx.restore();
    if (p.t >= p.delay && p.t < p.delay + 4) drawGlitch(ctx, p.x, p.y - 60, 140 * s, 110 * s, t, 10, ['#ffffff', col], 0.8, p.x);
  },
};

/** A void bullet, or - with `heart` - a SOUL-shaped shot in that SOUL's colour. */
SIGS.gasterOrb = {
  init: (p) => { p.data.trail = []; },
  update: (p, g) => {
    const d = p.data;
    d.trail.unshift([p.x, p.y]); if (d.trail.length > 7) d.trail.pop();
    if (p.t % 2 === 0) g.fx.add({ x: p.x, y: p.y, vx: -p.vx * 0.15, vy: -p.vy * 0.15, color: d.col || VOID_VIOLET, kind: 'glow', life: 10, size: 3 });
    const gy = g.groundBelow(p.x, p.y - 30);
    if (gy !== null && p.y >= gy) { p.life = 0; g.fx.burst(p.x, p.y, 6, d.col || VOID_VIOLET, 3, 'spark', 14, 3); }
  },
  onHit: (p, _t, g) => { p.life = 0; g.fx.burst(p.x, p.y, 10, p.data.col || VOID_VIOLET, 5, 'shard', 16, 3); },
  draw: (p, ctx) => {
    const d = p.data, col = d.col || VOID_VIOLET, r = p.w * 0.5;
    const a = clamp(Math.min(p.life / 6, (p.t + 1) / 3), 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'lighter';
    d.trail.forEach(([x, y]: [number, number], i: number) => {
      ctx.fillStyle = hexA(col, 0.3 * (1 - i / d.trail.length));
      ctx.beginPath(); ctx.arc(x, y, r * (1 - i / 9), 0, TAU); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    if (d.heart) drawHeart(ctx, p.x, p.y, r * 0.8, col, 1, !!d.flip);
    else {
      ctx.fillStyle = VOID_BLACK; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.75, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.24, r * 0.4, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  },
};

/** A column of void that erupts out of the floor. */
SIGS.voidPillar = {
  update: (p, g) => {
    if (p.t === p.delay) { sfx('void'); g.shake(5); g.fx.burst(p.x, p.y - 4, 10, VOID_VIOLET, 5, 'shard', 18, 4, 0.25); }
  },
  draw: (p, ctx, t) => {
    const a = clamp(p.life / 8, 0, 1);
    const rise = clamp((p.t - p.delay + 3) / 5, 0, 1);
    ctx.save(); ctx.globalAlpha *= a;
    // Telegraph crack.
    ctx.strokeStyle = hexA(VOID_VIOLET, 0.7); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - p.w * 0.6, p.y - 1); ctx.lineTo(p.x + p.w * 0.6, p.y - 1); ctx.stroke();
    if (rise > 0) {
      const h = p.h * rise, w = p.w * 0.5;
      ctx.fillStyle = VOID_BLACK;
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y);
      ctx.lineTo(p.x - w * 0.8, p.y - h * 0.85);
      ctx.lineTo(p.x, p.y - h);
      ctx.lineTo(p.x + w * 0.8, p.y - h * 0.85);
      ctx.lineTo(p.x + w, p.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = VOID_VIOLET; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
      g.addColorStop(0, hexA(VOID_VIOLET, 0.5)); g.addColorStop(0.5, hexA(VOID_VIOLET, 0)); g.addColorStop(1, hexA(VOID_VIOLET, 0.5));
      ctx.fillStyle = g; ctx.fillRect(p.x - w, p.y - h, w * 2, h);
      ctx.globalCompositeOperation = 'source-over';
      drawGlitch(ctx, p.x, p.y - h * 0.5, w * 3, h, t, 7, ['#ffffff', '#c9c0ff'], 0.8, p.x);
    }
    ctx.restore();
  },
};

/**
 * PATIENCE. A cyan clockface locks around the target and holds them perfectly
 * still, then lets time back in all at once.
 */
SIGS.soulStasis = {
  init: (p) => { p.delay = MANUAL; p.data.hold ??= 38; },
  update: (p, g) => {
    const d = p.data, T = d.target;
    if (!T || !T.alive) { p.life = 0; return; }
    if (p.t === 1) {
      const ok = strike(g, p, T, { dmg: 3, ang: 80, kb: 0, sc: 0, stun: 12, fx: 'elec' }, p.dir, T.x, T.y - 40);
      if (!ok) { p.life = 0; return; }
      d.px = T.x; d.py = T.y; d.caught = true; sfx('soul');
      g.fx.ring(T.x, T.y - T.h / 2, 10, 90, SOUL(4), 18, 5);
    }
    if (!d.caught) return;
    p.x = d.px; p.y = d.py - T.h / 2;
    if (p.t < d.hold) {
      T.x = d.px; T.y = d.py; T.vx = 0; T.vy = 0;
      T.state = 'hitstun'; T.hitstun = Math.max(T.hitstun, 6); T.move = null; T.moveKey = null;
      if (p.t % 6 === 0) g.fx.add({ x: T.x + (R() - 0.5) * 50, y: T.y - R() * T.h, vy: -0.6, color: SOUL(4), kind: 'shard', life: 20, size: 3 });
    }
    if (p.t === d.hold) {
      strike(g, p, T, { dmg: 9, ang: 82, kb: 8.4, sc: 8.2, stun: 6, fx: 'elec' }, p.dir, T.x, T.y - 40);
      g.shake(10); g.flashScreen(SOUL(4), 0.2); sfx('heavyhit');
      g.fx.ring(p.x, p.y, 10, 130, SOUL(4), 18, 8);
      p.life = Math.min(p.life, 8);
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data; if (!d.caught) return;
    const col = SOUL(4), a = clamp(Math.min(p.life / 8, p.t / 4), 0, 1), r = 44;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const an = i / 12 * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(an) * (r - 6), Math.sin(an) * (r - 6)); ctx.lineTo(Math.cos(an) * (r - (i % 3 ? 10 : 14)), Math.sin(an) * (r - (i % 3 ? 10 : 14))); ctx.stroke();
    }
    // The hand stops, then swings round when time comes back.
    const k = p.t < d.hold ? 0.2 : 0.2 + (p.t - d.hold) * 0.8;
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k - Math.PI / 2) * (r - 12), Math.sin(k - Math.PI / 2) * (r - 12)); ctx.stroke();
    // Frost crystals pinned on the ring.
    for (let i = 0; i < 6; i++) {
      const an = i / 6 * TAU + t * 0.01;
      ctx.save(); ctx.translate(Math.cos(an) * r, Math.sin(an) * r); ctx.rotate(an);
      ctx.fillStyle = hexA(col, 0.7);
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(3, 0); ctx.lineTo(0, 7); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    drawHeart(ctx, 0, -r - 12, 6, col, 1);
    ctx.restore();
  },
};

/**
 * PERSEVERANCE. A line of glyphs - Gaster's own script - spells itself across
 * the gap, wraps the target, and reels them in to his hand.
 */
SIGS.soulBind = {
  init: (p) => { p.delay = MANUAL; },
  update: (p, g) => {
    const d = p.data, T = d.target, o = p.owner;
    if (!T || !T.alive) { p.life = 0; return; }
    if (p.t === 4) {
      const ok = strike(g, p, T, { dmg: 3, ang: 70, kb: 0, sc: 0, stun: 14, fx: 'purple' }, p.dir, T.x, T.y - 40);
      if (!ok) { p.life = Math.min(p.life, 6); return; }
      d.caught = true; sfx('string');
    }
    if (d.caught && p.t > 4 && p.t < 22) {
      const gx = o.x + o.facing * 52;
      T.x += (gx - T.x) * 0.2; T.y += (o.y - T.y) * 0.12; T.vx = 0; T.vy = 0;
      T.state = 'hitstun'; T.hitstun = Math.max(T.hitstun, 6); T.move = null; T.moveKey = null;
    }
    if (d.caught && p.t === 22) {
      strike(g, p, T, { dmg: 10, ang: 78, kb: 8, sc: 8, stun: 4, fx: 'purple' }, o.facing, T.x, T.y - 40);
      g.shake(9); g.flashScreen(SOUL(6), 0.18); sfx('heavyhit');
      p.life = Math.min(p.life, 8);
    }
    p.x = o.x; p.y = o.y;
  },
  draw: (p, ctx) => {
    const d = p.data, T = d.target, o = p.owner; if (!T) return;
    const col = SOUL(6);
    const x1 = o.x + o.facing * 30, y1 = o.y - 56, x2 = T.x, y2 = T.y - T.h / 2;
    const reach = clamp(p.t / 5, 0, 1), a = clamp(p.life / 8, 0, 1);
    const n = 16;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.strokeStyle = hexA(col, 0.6); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * reach, y1 + (y2 - y1) * reach); ctx.stroke();
    for (let i = 0; i < n * reach; i++) {
      const u = i / n, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u + Math.sin(i * 1.7 + p.t * 0.3) * 3;
      glyph(ctx, x, y, 4.2, i, col);
    }
    if (d.caught) {
      // Glyph ring wrapped around the target.
      for (let i = 0; i < 10; i++) {
        const an = i / 10 * TAU + p.t * 0.12;
        glyph(ctx, x2 + Math.cos(an) * 26, y2 + Math.sin(an) * 34, 4, i + 3, col);
      }
    }
    ctx.restore();
  },
};
/** One character of Gaster's script: small abstract runes, never real text. */
function glyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, i: number, col: string) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  switch (i % 6) {
    case 0: ctx.arc(0, 0, s * 0.8, 0, TAU); ctx.moveTo(0, -s); ctx.lineTo(0, s); break;
    case 1: ctx.rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(s * 0.7, 0); break;
    case 2: ctx.moveTo(-s, s); ctx.lineTo(0, -s); ctx.lineTo(s, s); ctx.moveTo(-s * 0.5, s * 0.1); ctx.lineTo(s * 0.5, s * 0.1); break;
    case 3: heartPath(ctx, 0, 0, s * 0.8); break;
    case 4: ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.moveTo(-s, 0); ctx.arc(0, 0, s * 0.35, 0, TAU); break;
    default: ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 1.4, s, 0); ctx.quadraticCurveTo(0, s * 1.4, -s, 0); break;
  }
  ctx.stroke();
  ctx.restore();
}

/** KINDNESS. A green barrier dome that shoves everything off him. */
SIGS.soulShield = {
  update: (p, g) => {
    if (p.t % 4 === 0) {
      const a = R() * TAU;
      g.fx.add({ x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 60, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, color: SOUL(3), kind: 'glow', life: 14, size: 4 });
    }
  },
  draw: (p, ctx, t) => {
    const col = SOUL(3), a = clamp(Math.min(p.life / 8, (p.t + 1) / 3), 0, 1);
    const r = 58 + Math.min(1, p.t / 5) * 10;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
    g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.85, hexA(col, 0.28)); g.addColorStop(1, hexA(col, 0.6));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // Hex lattice.
    ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const an = i / 12 * TAU + t * 0.01;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) { const b = j / 6 * TAU; const x = Math.cos(an) * r * 0.62 + Math.cos(b) * 10, y = Math.sin(an) * r * 0.62 + Math.sin(b) * 10; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    drawHeart(ctx, 0, 0, 7, col, 0.9);
    ctx.restore();
  },
};

/**
 * VOID COLLAPSE. A pinhole in the world opens, drinks everything near it, and
 * then implodes with all seven SOULs flaring at once.
 */
SIGS.voidCollapse = {
  init: (p) => { p.delay = MANUAL; p.data.pull ??= 42; },
  update: (p, g) => {
    const d = p.data;
    if (p.t === 1) { sfx('void'); g.flashScreen('#000000', 0.25); }
    if (p.t < d.pull) {
      for (const T of enemiesNear(g, p.owner, p.x, p.y, 240)) {
        const dx = p.x - T.x, dy = p.y - (T.y - T.h / 2), L = Math.hypot(dx, dy) || 1;
        T.vx += dx / L * 0.95; T.vy += dy / L * 0.6 - 0.35;
        T.vx = clamp(T.vx, -9, 9); T.vy = clamp(T.vy, -9, 9);
      }
      if (p.t % 8 === 4) for (const T of enemiesNear(g, p.owner, p.x, p.y, 110)) strike(g, p, T, { dmg: 1.6, ang: 70, kb: 0.4, sc: 0, stun: 10 }, p.dir, p.x, p.y);
      if (p.t % 2 === 0) {
        const a = R() * TAU, r = 120 + R() * 80;
        g.fx.add({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: -Math.cos(a) * 7, vy: -Math.sin(a) * 7, color: SOUL(Math.floor(R() * 7)), kind: 'streak', life: 16, size: 2.6 });
      }
      if (p.t % 5 === 0) g.shake(3);
    }
    if (p.t === d.pull) {
      for (const T of enemiesNear(g, p.owner, p.x, p.y, 150)) strike(g, p, T, { dmg: 15, ang: 84, kb: 9.4, sc: 9.2, stun: 8 }, T.x >= p.x ? 1 : -1, p.x, p.y);
      g.shake(22); g.flashScreen('#ffffff', 0.55); g.punchIn(p.x, p.y, 0.12); sfx('blaster-fire'); sfx('soul');
      for (let i = 0; i < 7; i++) g.fx.ring(p.x, p.y, 10, 120 + i * 26, SOUL(i), 22, 7);
      g.fx.burst(p.x, p.y, 40, '#ffffff', 14, 'shard', 30, 5);
      p.life = Math.min(p.life, 14);
    }
  },
  draw: (p, ctx, t) => {
    const d = p.data;
    const k = clamp(p.t / d.pull, 0, 1), post = p.t >= d.pull;
    const a = post ? clamp(p.life / 14, 0, 1) : clamp(p.t / 6, 0, 1);
    const r = post ? 30 + (14 - p.life) * 12 : 16 + k * 38;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = hexA(SOUL(i), 0.75); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.9 + i * 3, r * 0.55 + i, t * 0.05 + i * 0.45, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!post) {
      ctx.fillStyle = VOID_BLACK; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
    drawGlitch(ctx, p.x, p.y, 220, 160, t, 12, ['#ffffff', SOUL(Math.floor(t / 5))], a, p.x);
  },
};

/** Seven SOULs spiralling into him: the transformation's entrance. Visual only. */
SIGS.soulGather = {
  init: (p) => { p.delay = MANUAL; },
  update: (p) => { p.x = p.owner.x; p.y = p.owner.y - 44; },
  draw: (p, ctx) => {
    const k = clamp(p.t / 16, 0, 1), e = k * k;
    for (let i = 0; i < 7; i++) {
      const an = i / 7 * TAU + e * 4;
      const r = (1 - e) * 230 + 6;
      drawHeart(ctx, p.x + Math.cos(an) * r, p.y + Math.sin(an) * r * 0.8, 8 - e * 3, SOUL(i), 1 - Math.max(0, (p.t - 16) / 8));
    }
  },
};

/** Glitch tear left where he stepped out of the world. Visual only. */
SIGS.gasterTear = {
  init: (p) => { p.delay = MANUAL; },
  draw: (p, ctx, t) => {
    const a = clamp(p.life / 14, 0, 1);
    drawGlitch(ctx, p.x, p.y, 90, 120, t, 16, ['#ffffff', '#ffffff', '#c9c0ff', VOID_VIOLET], a, p.x * 0.3);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = VOID_BLACK; ctx.beginPath(); ctx.ellipse(p.x, p.y + 44, 34 * a + 6, 6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

// ===========================================================================
// MOVE VISUALS
// ===========================================================================

/**
 * One visual pass for every hand strike: a void-violet (or SOUL-coloured) palm
 * print at the hitbox the frame it opens, a white glitch splinter, and a small
 * ring. The hands themselves are animated by the body renderer.
 */
function handStrikeVfx(f: any, g: any, fr: number, m: any) {
  const s = f.scale || 1;
  const col = m.soul !== undefined ? SOUL(m.soul) : m.soulAll ? SOUL(Math.floor(fr / 3)) : VOID_VIOLET;
  for (const h of m.hits || []) {
    const cx = f.x + h.x * s * f.facing, cy = f.y + h.y * s;
    if (fr === h.f[0] || (h.rehit && fr > h.f[0] && fr <= h.f[1] && (fr - h.f[0]) % h.rehit === 0)) {
      g.fx.ring(cx, cy, 4, Math.max(h.w, h.h) * 0.55 * s, col, 10, 3);
      g.fx.directional(cx, cy, 5, f.facing > 0 ? 0 : Math.PI, 0.9, '#ffffff', 7, 'shard', 12, 2.5);
      g.fx.add({ x: cx, y: cy, color: col, kind: 'glow', life: 10, size: 18 });
    }
  }
  if (fr < (m.startup || 0) && fr % 3 === 0) {
    g.fx.add({ x: f.x + f.facing * (20 + R() * 20), y: f.y - 50 - R() * 30, vy: -1, color: col, kind: 'glow', life: 12, size: 3 });
  }
}
registerVfx('gasterHand', handStrikeVfx);
registerVfx('gasterCast', (f: any, g: any, fr: number, m: any) => {
  if (fr < (m.startup || 0) && fr % 2 === 0) {
    const a = R() * TAU;
    g.fx.add({ x: f.x + Math.cos(a) * 40, y: f.y - 60 + Math.sin(a) * 40, vx: -Math.cos(a) * 2, vy: -Math.sin(a) * 2, color: m.soul !== undefined ? SOUL(m.soul) : VOID_VIOLET, kind: 'glow', life: 12, size: 3 });
  }
});

// ===========================================================================
// THE KIT
// ===========================================================================

const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, extra: Partial<HitDef> = {}): HitDef =>
  ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, fx: 'dark', ...extra });
const MULTI = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, fin: number, ang: number, kb: number, sc: number, rehit = 4, fx: HitDef['fx'] = 'dark'): HitDef[] => [
  H(f0, f1, x, y, w, h, dmg, 80, 1.6, 0, { rehit, pull: true, fx, g: 0 }),
  H(f1 + 1, f1 + 4, x, y, w * 1.08, h * 1.08, fin, ang, kb, sc, { fx, g: 1 }),
];
/** A hand move. `gh` tells the body which floating hand performs it. */
type Hands = 'front' | 'back' | 'both' | 'cast' | 'spin' | 'barrage';
const hm = (name: string, anim: AnimName, dur: number, su: number, hits: HitDef[], gh: Hands, o: Partial<MoveDef> & Record<string, any> = {}): MoveDef =>
  ({ name, anim, dur, startup: su, hits, vfx: 'gasterHand', gh, ...o } as MoveDef);

const cN = (w: [number, number]) => ({ light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cN2 = (w: [number, number]) => ({ light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cS = (w: [number, number]) => ({ light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cS2 = (w: [number, number]) => ({ special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cD = (w: [number, number]) => ({ light: 'dlight2', special: 'dlight_spec', window: w });
const cA = (w: [number, number]) => ({ light: 'nair2', special: 'nair_spec', window: w });
const cSA = (w: [number, number]) => ({ light: 'sair2', special: 'sair_spec', window: w });

/** A small void bullet from the palm hole. */
const palmShot = (f: any, g: any, vx: number, vy: number, o: any = {}) => spawn(g, f, 'gasterOrb', {
  x: f.x + f.facing * 40, y: f.y - 54, vx: f.facing * vx, vy, w: 24, h: 24, life: 46, dmg: 6, ang: 38, kb: 4.4, sc: 3.6, stun: 4, ...o,
});

/** Where a summon lands: under the nearest enemy, or a fixed step ahead. */
function aimPoint(g: any, f: any, range: number, ahead: number) {
  const t = g.nearestEnemy(f, range);
  const x = t ? t.x : f.x + f.facing * ahead;
  const gy = g.groundBelow(x, (t ? t.y : f.y) - 60);
  return { t, x, y: gy ?? (t ? t.y : f.y), air: !!t && !t.grounded };
}

function blaster(g: any, f: any, o: { x: number; y: number; ang: number; size?: number; charge?: number; fire?: number; len?: number; width?: number; col?: string; rainbow?: boolean; big?: boolean; tick?: Blow; fin?: Blow; rehit?: number; life?: number }) {
  const { x, y, ...data } = o;
  const life = o.life ?? ((o.charge ?? 22) + (o.fire ?? 20) + 20);
  return spawn(g, f, 'gasterBlaster', { x, y, w: 80, h: 80, life, dir: Math.cos(o.ang) >= 0 ? 1 : -1, data });
}

/** Clamp an aim so a blaster never fires backwards over his own shoulder. */
function aimAt(f: any, sx: number, sy: number, t: any, spread = 0.7) {
  const base = f.facing > 0 ? 0 : Math.PI;
  if (!t || (t.x - f.x) * f.facing < -10) return base;
  const a = Math.atan2(t.y - t.h / 2 - sy, t.x - sx);
  let d = a - base; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
  return base + clamp(d, -spread, spread);
}

/** VOID STEP: sink into a rift, surface behind the target. */
function voidStep(f: any, fr: number, g: any, sinkAt: number, moveAt: number, riseAt: number, fallbackDist: number) {
  if (fr === 0) f.gasterSink = 0;
  if (fr >= sinkAt && fr < moveAt) f.gasterSink = (fr - sinkAt + 1) / (moveAt - sinkAt);
  if (fr === sinkAt) {
    sfx('void'); f.invuln = Math.max(f.invuln, riseAt - sinkAt + 4);
    spawn(g, f, 'gasterTear', { x: f.x, y: f.y - 44, life: 16, dmg: 0 });
  }
  if (fr === moveAt) {
    const t = g.nearestEnemy(f, 540);
    let nx: number, ny: number;
    if (t) {
      const side = f.x <= t.x ? 1 : -1;
      nx = t.x + side * 58; ny = t.y;
      if (g.groundBelow(nx, t.y - 60) === null) nx = t.x - side * 58;
      f.facing = t.x >= nx ? 1 : -1;
    } else {
      nx = f.x + f.facing * fallbackDist; ny = f.y;
      if (g.groundBelow(nx, f.y - 60) === null) nx = f.x;
    }
    f.x = nx; f.y = ny; f.vx = 0; f.vy = 0;
    sfx('glitch');
    spawn(g, f, 'gasterTear', { x: f.x, y: f.y - 44, life: 16, dmg: 0 });
  }
  if (fr >= moveAt && fr < riseAt) f.gasterSink = 1 - (fr - moveAt + 1) / (riseAt - moveAt);
  if (fr >= riseAt) f.gasterSink = 0;
}

const core: CoreKit = {
  // ---- neutral string: palm, backhand, clap ----
  nlight: hm('Phantom Palm', 'palm', 16, 4, [H(4, 8, 46, -52, 58, 42, 5, 38, 3.0, 1.8)], 'front', { chains: cN([4, 14]) }),
  nlight2: hm('Backhand Rebuke', 'backfist', 17, 3, [H(3, 7, 50, -50, 62, 44, 5.5, 42, 3.3, 2.1)], 'back', { chains: cN2([3, 15]) }),
  nlight3: hm('Clap of the Void', 'cast', 27, 5, MULTI(5, 16, 54, -52, 72, 60, 1.9, 6.5, 46, 5.8, 6.8, 3), 'both', { ghGrip: 0.3 }),
  nlight_spec: hm('Holed Palm Shot', 'palm', 26, 6, [], 'front', {
    desc: 'The hole in his palm fires a single void round.',
    onFrame: (f, fr, g) => { if (fr === 6) { palmShot(f, g, 12, 0, { dmg: 8, kb: 6, sc: 6.4 }); sfx('dark'); } },
  }),
  nlight_heavy: hm('Rising Hands', 'castUp', 29, 5, [H(5, 13, 36, -72, 64, 92, 10.5, 86, 7.0, 8.0)], 'both', { ghGrip: 0.1 }),

  // ---- side string ----
  slight: hm('Drifting Palm', 'palm', 20, 4, [H(4, 9, 52, -48, 66, 42, 6, 28, 3.8, 2.2)], 'front', { vel: [[3, 10, null], [10, 2, null]], chains: cS([4, 16]) }),
  slight2: hm('Twin Palm Thrust', 'palm', 21, 3, [H(3, 8, 58, -48, 74, 48, 7, 34, 4.6, 3.8)], 'both', { vel: [[3, 7, null]], chains: cS2([3, 16]) }),
  slight_spec: hm('Void Step Strike', 'palm', 30, 12, [H(12, 17, 42, -48, 68, 54, 10, 36, 6.4, 7.2)], 'front', {
    desc: 'Steps through the void to the far side of the target and palms them on the way out.',
    onFrame: (f, fr, g) => voidStep(f, fr, g, 2, 6, 11, 150),
  }),
  slight_heavy: hm('Crushing Grip', 'cast', 31, 6, [H(6, 14, 62, -48, 84, 62, 12.5, 40, 7.4, 8.8)], 'both', { ghGrip: 0.9, vel: [[6, 8, null]] }),

  // ---- down string ----
  dlight: hm('Floor Swipe', 'sweep', 20, 4, [H(4, 9, 42, -14, 70, 28, 6, 76, 4.0, 1.8)], 'front', { vel: [[3, 9, null], [11, 2, null]], chains: cD([4, 16]) }),
  dlight2: hm('Upheaval Palm', 'uppercut', 22, 4, [H(4, 10, 34, -60, 58, 76, 8, 86, 5.6, 4.6)], 'front', { vel: [[4, 1, -9]] }),
  dlight_spec: hm('Grave Hands', 'slam', 30, 8, [], 'cast', {
    desc: 'Opens a small void pool ahead; two hands clap shut out of it.',
    onFrame: (f, fr, g) => {
      if (fr !== 8) return;
      const x = f.x + f.facing * 110, y = g.groundBelow(x, f.y - 60) ?? f.y;
      spawn(g, f, 'gasterGrasp', { x, y, w: 80, h: 110, ground: true, life: 34, delay: 12, activeFor: 12, rehit: 5, dmg: 2.4, ang: 80, kb: 1.5, sc: 0, stun: 8, pull: true, fin: { dmg: 7, ang: 84, kb: 7.2, sc: 7.4 }, data: { size: 0.7 } });
    },
  }),

  // ---- air ----
  nair: hm('Orbiting Hands', 'spin', 22, 3, [H(3, 11, 0, -42, 98, 88, 6, 66, 3.4, 2.1, { rehit: 6 })], 'spin', { land: true, turns: 0, chains: cA([3, 17]) }),
  nair2: hm('Descending Palm', 'dive', 23, 3, [H(3, 11, 24, -22, 62, 58, 8, -52, 4.4, 3.6)], 'front', { land: true, vel: [[3, 2, 8]] }),
  nair_spec: hm('Blaster Pellet', 'palm', 25, 5, [], 'front', {
    desc: 'A palm round angled down at the floor beneath him.',
    onFrame: (f, fr, g) => { if (fr === 5) { palmShot(f, g, 9, 5, { dmg: 8, ang: -40, kb: 5, sc: 5 }); sfx('dark'); } },
  }),
  sair: hm('Aerial Palm', 'palm', 19, 3, [H(3, 8, 48, -46, 66, 46, 6.5, 30, 3.8, 2.5)], 'front', { land: true, chains: cSA([3, 16]) }),
  sair2: hm('Aerial Backhand', 'backfist', 21, 3, [H(3, 10, 50, -44, 70, 46, 8, 34, 4.8, 4.2)], 'back', { land: true }),
  sair_spec: hm('Void Lunge', 'palm', 25, 4, [H(4, 13, 46, -42, 74, 56, 9.5, 38, 6.2, 6.8)], 'both', {
    vel: [[4, 16, 1]],
    onFrame: (f, fr, g) => { if (fr === 3) { sfx('glitch'); spawn(g, f, 'gasterTear', { x: f.x, y: f.y - 44, life: 12, dmg: 0 }); } },
  }),
  dair: hm('Hand Guillotine', 'dive', 26, 5, [H(5, 15, 16, -8, 60, 50, 8.5, -58, 4.4, 3.2)], 'both', { land: true, vel: [[5, 3, 11]], ghGrip: 0 }),

  // ---- heavies ----
  nsig: hm('Skyward Blaster', 'castUp', 42, 10, [H(8, 12, 22, -70, 60, 70, 6, 86, 5.4, 4.8)], 'cast', {
    desc: 'A small blaster snaps into place over his head and fires straight up.',
    onFrame: (f, fr, g) => {
      if (fr === 4) blaster(g, f, { x: f.x + f.facing * 18, y: f.y - 96, ang: -Math.PI / 2, size: 22, charge: 12, fire: 12, len: 420, width: 34, tick: { dmg: 2.2, ang: 88, kb: 2.2, sc: 0, stun: 8 }, fin: { dmg: 7, ang: 88, kb: 7.6, sc: 7.8 } });
    },
  }),
  ssig: hm('Hand Barrage', 'flurry', 44, 10, MULTI(10, 24, 50, -48, 76, 60, 2.3, 8.5, 38, 6.5, 8.4, 3), 'barrage', { vel: [[10, 6, null], [25, 1, null]] }),
  dsig: hm('Void Pillars', 'slam', 46, 10, [], 'cast', {
    desc: 'Three columns of void erupt in a line ahead of him.',
    onFrame: (f, fr, g) => {
      for (const [at, d] of [[10, 70], [16, 135], [22, 200]] as [number, number][]) {
        if (fr !== at) continue;
        const x = f.x + f.facing * d, y = g.groundBelow(x, f.y - 60) ?? f.y;
        spawn(g, f, 'voidPillar', { x, y, w: 46, h: 150, ground: true, life: 24, delay: 6, activeFor: 10, dmg: 7.5, ang: 86, kb: 6.8, sc: 7.2 });
      }
    },
  }),
  rec: hm('Void Ascent', 'rise', 34, 5, MULTI(5, 20, 10, -52, 70, 90, 2.6, 7, 82, 5.4, 7.2, 5), 'cast', {
    turns: 0, grav: 0.38, vel: [[5, 3, -15.5]],
    onFrame: (f, fr, g) => { if (fr === 5) { sfx('glitch'); spawn(g, f, 'gasterTear', { x: f.x, y: f.y - 30, life: 14, dmg: 0 }); } },
  }),
  gp: hm('Falling Hands', 'dive', 38, 7, [H(7, 32, 20, -22, 62, 60, 10, -62, 5.4, 7.2)], 'both', { land: true, vel: [[7, 3, 18]], ghGrip: 0.9 }),

  // ---- specials ----
  nspec: hm('Gaster Blaster', 'cast', 44, 8, [], 'cast', {
    cd: 170, grav: 0.25, vfx: 'gasterCast',
    desc: 'Summons a Gaster Blaster over his shoulder. It locks onto the nearest foe, drops its jaw and fires a beam across the stage.',
    onFrame: (f, fr, g) => {
      if (fr !== 8) return;
      const bx = f.x - f.facing * 46, by = f.y - 138;
      const t = g.nearestEnemy(f, 900);
      blaster(g, f, { x: bx, y: by, ang: aimAt(f, bx, by, t, 0.55), size: 34, charge: 22, fire: 20, len: 950, width: 46,
        tick: { dmg: 2.2, ang: 50, kb: 1.4, sc: 0, stun: 8 }, fin: { dmg: 9, ang: 38, kb: 8.2, sc: 8.6 } });
      g.fx.text(f.x, f.y - 150, 'GASTER BLASTER', '#ffffff', 20, 36);
    },
  }),
  sspec: hm('Void Rift', 'palm', 40, 22, [H(22, 28, 44, -48, 72, 56, 11, 40, 6.6, 7.4)], 'both', {
    cd: 150, invuln: [3, 20],
    desc: 'Sinks into a rift in the floor, surfaces behind the nearest foe and slams both hands into them.',
    onFrame: (f, fr, g) => voidStep(f, fr, g, 3, 12, 20, 220),
  }),
  dspec: hm('Grasp of the Void', 'castUp', 40, 8, [], 'cast', {
    cd: 170,
    desc: 'A void pool opens beneath the nearest foe, and two giant hands rise out of it and clap shut on them.',
    onFrame: (f, fr, g) => {
      if (fr !== 8) return;
      const a = aimPoint(g, f, 560, 180);
      spawn(g, f, 'gasterGrasp', { x: a.x, y: a.y, w: 100, h: 150, ground: true, life: 44, delay: 16, activeFor: 16, rehit: 5, dmg: 2.6, ang: 80, kb: 1.4, sc: 0, stun: 8, pull: true, fin: { dmg: 10, ang: 86, kb: 8.4, sc: 8.8 }, data: { size: 1 } });
    },
  }),
};

// ---------------------------------------------------------------------------
// AWAKENED — SEVEN SOULS
// ---------------------------------------------------------------------------

type Tier = 'awaken' | 'awakenLight' | 'awakenHeavy' | 'awakened';
type Stance = 'neutral' | 'side' | 'down' | 'air';
const LABEL: Record<Tier, string> = {
  awaken: 'AWAKEN · R AT FULL GAUGE', awakenLight: 'AWAKENED LIGHT · J', awakenHeavy: 'AWAKENED HEAVY · K', awakened: 'AWAKENED SPECIAL · L',
};
const SPECIAL_KEY: Record<Stance, MoveKey> = { neutral: 'nfu', side: 'sfu', down: 'dfu', air: 'afu' };
function aw(tier: Tier, stance: Stance, m: Partial<MoveDef> & Record<string, any>): MoveDef {
  return {
    hits: [], anim: 'cast', vfx: 'gasterHand', ...m,
    ability: tier, stance, techniqueProfile: 'gaster', techniqueStyle: 'void', variantOf: 'Seven Souls', chainLabel: LABEL[tier],
    cd: tier === 'awakened' ? 260 : tier === 'awakenHeavy' ? 90 : m.cd,
    land: stance === 'air' ? true : m.land,
    chains: tier === 'awakenHeavy' ? { special: SPECIAL_KEY[stance], window: [Math.max(4, (m.startup ?? 8) - 1), Math.min((m.dur ?? 40) - 2, 30)] } : m.chains,
  } as MoveDef;
}

function transformation(stance: Stance, name: string, desc: string, extra: Partial<MoveDef> = {}): MoveDef {
  return aw('awaken', stance, {
    name, desc, anim: 'castUp', dur: 40, startup: 16, grav: stance === 'air' ? 0.2 : 0.6, invuln: [0, 18], vfx: 'gasterCast', gh: 'cast',
    hits: [H(16, 22, 0, -44, 190, 170, 7, 70, 6.2, 5.4, { fx: 'purple' })],
    ...extra,
    onFrame: (f: any, fr: number, g: any) => {
      if (fr === 1) {
        spawn(g, f, 'soulGather', { x: f.x, y: f.y - 44, life: 26, dmg: 0 });
        sfx('soul'); g.flashScreen('#000000', 0.35);
        g.cinematic(f, 'SEVEN SOULS', 52);
      }
      if (fr === 16) {
        f.auraT = Math.max(f.auraT, 60);
        g.fx.text(f.x, f.y - 170, 'SEVEN SOULS', '#ffffff', 30, 60);
        for (let i = 0; i < 7; i++) g.fx.ring(f.x, f.y - 44, 10, 140 + i * 22, SOUL(i), 24, 6);
        g.fx.burst(f.x, f.y - 44, 44, '#ffffff', 13, 'shard', 34, 5);
        g.shake(20); g.flashScreen('#ffffff', 0.45); g.punchIn(f.x, f.y - 44, 0.1);
        sfx('blaster-fire'); sfx('glitch');
      }
      extra.onFrame?.(f, fr, g);
    },
  });
}

const awakened: Partial<Record<MoveKey, MoveDef>> = {
  naw: transformation('neutral', 'Seven Souls', 'The seven human SOULs answer him at once. Every hand he summons now carries one of them.'),
  saw: transformation('side', 'Seven Souls · Onslaught', 'Awakens while surging forward through the burst.', { vel: [[16, 12, null], [26, 2, null]] }),
  daw: transformation('down', 'Seven Souls · Rupture', 'Awakens with the void cracking open under his feet.'),
  aaw: transformation('air', 'Seven Souls · Ascension', 'Awakens in the air, hanging in the burst.'),

  // ---- J: the four "fast" SOULs ----
  nwl: aw('awakenLight', 'neutral', {
    name: 'Justice · Bullet Volley', soul: 2, gh: 'cast', ghAt: [40, -60], dur: 24, startup: 5,
    desc: 'The yellow hand fires three upturned SOUL rounds in a tight spread. Justice shoots.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 5 && fr !== 8 && fr !== 11) return;
      const i = (fr - 5) / 3;
      palmShot(f, g, 13, (i - 1) * 1.6, { w: 26, h: 26, dmg: 4.2, kb: 3.4, sc: 2.2, stun: 5, fx: 'elec', data: { heart: true, flip: true, col: SOUL(2) } });
      sfx('string');
    },
  }),
  swl: aw('awakenLight', 'side', {
    name: 'Bravery · Blazing Knuckle', soul: 1, gh: 'front', ghGrip: 1, anim: 'jab', dur: 25, startup: 5,
    desc: 'The orange hand balls into a fist and rockets forward in a trail of fire. Bravery punches.',
    hits: [H(5, 12, 56, -48, 86, 52, 7.5, 34, 4.8, 4.0, { fx: 'fire' })], vel: [[4, 14, null], [13, 2, null]],
    onFrame: (f: any, fr: number, g: any) => { if (fr > 4 && fr < 13) g.fx.add({ x: f.x + f.facing * (40 + R() * 30), y: f.y - 48 + (R() - 0.5) * 20, vx: -f.facing * 3, vy: -1, color: R() < 0.5 ? SOUL(1) : '#ffd24a', kind: 'ember', life: 16, size: 6 }); },
  }),
  dwl: aw('awakenLight', 'down', {
    name: 'Kindness · Guardian Pulse', soul: 3, gh: 'cast', dur: 28, startup: 6, invuln: [2, 12],
    desc: 'The green hand throws up a barrier that shoves everything away and mends a little of the damage he has taken. Kindness protects.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 6) return;
      spawn(g, f, 'soulShield', { follow: true, ox: 0, oy: -44, w: 150, h: 140, life: 20, delay: 0, activeFor: 8, dmg: 5, ang: 42, kb: 7, sc: 5, fx: 'blunt' });
      f.damage = Math.max(0, f.damage - 5);
      const hp = g.health?.get?.(f); if (hp) hp.current = Math.min(hp.max, hp.current + 5);
      g.fx.text(f.x, f.y - 120, 'MENDED', SOUL(3), 18, 30); sfx('soul');
    },
  }),
  awl: aw('awakenLight', 'air', {
    name: 'Integrity · Gravity Palm', soul: 5, gh: 'front', ghGrip: 0.1, anim: 'dive', dur: 25, startup: 4,
    desc: 'The blue hand slaps down and the target\'s SOUL turns blue: they drop like a stone. Integrity weighs.',
    hits: [H(4, 11, 28, -18, 84, 70, 6.5, -62, 4.2, 3.8, { fx: 'elec' })], vel: [[4, 2, 9]],
    onHit: (_f: any, t: any, g: any) => { t.vy = Math.max(t.vy, 12); g.fx.ring(t.x, t.y - 40, 6, 60, SOUL(5), 12, 4); },
  }),

  // ---- K: the launchers ----
  nwh: aw('awakenHeavy', 'neutral', {
    name: 'Patience · Stasis Lock', soul: 4, gh: 'cast', ghAt: [70, -60], dur: 44, startup: 9,
    desc: 'The cyan hand stops the clock on the nearest foe: they hang frozen in a ring of frost until time snaps back and throws them upward. Patience waits.',
    hits: [H(9, 14, 50, -50, 72, 64, 5, 82, 5.4, 5)],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 9) return;
      const t = g.nearestEnemy(f, 400);
      if (t) spawn(g, f, 'soulStasis', { x: t.x, y: t.y - 40, life: 50, dmg: 0, data: { target: t, hold: 36 } });
      sfx('soul');
    },
  }),
  swh: aw('awakenHeavy', 'side', {
    name: 'Perseverance · Binding Script', soul: 6, gh: 'front', ghAt: [60, -56], dur: 42, startup: 8,
    desc: 'The purple hand writes a line of his script across the gap; it wraps the target and reels them into his grip before throwing them. Perseverance holds on.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 8) return;
      const t = g.nearestEnemy(f, 440);
      if (t && (t.x - f.x) * f.facing > -20) spawn(g, f, 'soulBind', { life: 34, dmg: 0, data: { target: t } });
      else g.fx.text(f.x + f.facing * 60, f.y - 90, '...', SOUL(6), 18, 20);
    },
  }),
  dwh: aw('awakenHeavy', 'down', {
    name: 'Determination · Crimson Crush', soul: 0, gh: 'cast', dur: 44, startup: 9,
    desc: 'A colossal red hand erupts under the nearest foe and closes into a fist around them. Determination refuses.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 9) return;
      const a = aimPoint(g, f, 480, 150);
      spawn(g, f, 'gasterGrasp', { x: a.x, y: a.y, w: 110, h: 170, ground: true, life: 38, delay: 12, activeFor: 12, rehit: 6, dmg: 3, ang: 84, kb: 1.6, sc: 0, stun: 8, pull: true, fin: { dmg: 11, ang: 88, kb: 9, sc: 9 }, data: { size: 1.1, crimson: true, col: SOUL(0) } });
      sfx('soul');
    },
  }),
  awh: aw('awakenHeavy', 'air', {
    name: 'Seven-Hand Barrage', soulAll: true, gh: 'barrage', anim: 'flurry', dur: 40, startup: 6,
    desc: 'All seven SOUL hands strike in turn, one colour after another, and the last one sends them flying.',
    hits: MULTI(6, 26, 50, -40, 96, 80, 1.9, 8, 44, 6.6, 7.6, 3, 'purple'), vel: [[0, 0, -2], [6, 3, 1]], grav: 0.3,
  }),

  // ---- L: the answers ----
  nfu: aw('awakened', 'neutral', {
    name: 'Spectrum Blaster Array', gh: 'cast', anim: 'castUp', dur: 64, startup: 12, cin: 34, invuln: [0, 16],
    desc: 'Seven Gaster Blasters, one per SOUL, open around the nearest foe in a crown and fire into the centre one after another.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 12) return;
      const t = g.nearestEnemy(f, 800);
      const cx = t ? t.x : f.x + f.facing * 260, cy = t ? t.y - t.h / 2 : f.y - 60;
      for (let i = 0; i < 7; i++) {
        const an = Math.PI + 0.2 + (i / 6) * (Math.PI - 0.4);
        const bx = cx + Math.cos(an) * 250, by = cy + Math.sin(an) * 210;
        blaster(g, f, { x: bx, y: by, ang: Math.atan2(cy - by, cx - bx), size: 26, charge: 18 + i * 5, fire: 12, len: 520, width: 36, col: SOUL(i),
          tick: { dmg: 1.9, ang: 60, kb: 1, sc: 0, stun: 10 }, fin: i === 6 ? { dmg: 12, ang: 80, kb: 9.4, sc: 9.4 } : undefined, rehit: 6 });
      }
      g.fx.text(f.x, f.y - 170, 'SPECTRUM ARRAY', '#ffffff', 26, 48);
    },
  }),
  sfu: aw('awakened', 'side', {
    name: 'Prismatic Blaster', gh: 'cast', anim: 'cast', dur: 60, startup: 10, invuln: [0, 12],
    desc: 'One enormous blaster, lined with every SOUL colour at once, fires a rainbow beam the width of a building straight ahead.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 10) return;
      const bx = f.x - f.facing * 40, by = f.y - 70;
      blaster(g, f, { x: bx, y: by, ang: f.facing > 0 ? 0 : Math.PI, size: 58, charge: 22, fire: 24, len: 1150, width: 96, rainbow: true, big: true,
        tick: { dmg: 2.4, ang: 40, kb: 1.8, sc: 0, stun: 9 }, fin: { dmg: 13, ang: 34, kb: 9.6, sc: 9.6 } });
      g.fx.text(f.x, f.y - 170, 'PRISMATIC BLASTER', '#ffffff', 26, 48);
    },
  }),
  dfu: aw('awakened', 'down', {
    name: 'Void Collapse', gh: 'cast', anim: 'castUp', dur: 58, startup: 12, invuln: [0, 14],
    desc: 'Opens a pinhole in the world beside the nearest foe. It drinks in everything around it, then implodes with all seven SOULs at once.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 12) return;
      const t = g.nearestEnemy(f, 700);
      const x = t ? t.x : f.x + f.facing * 220, y = (t ? t.y : f.y) - 70;
      spawn(g, f, 'voidCollapse', { x, y, life: 70, dmg: 0, data: { pull: 44 } });
    },
  }),
  afu: aw('awakened', 'air', {
    name: 'Determination Descent', soul: 0, gh: 'cast', anim: 'cast', dur: 56, startup: 10, grav: 0.1, invuln: [0, 12],
    desc: 'A giant red blaster forms above him and fires down at an angle through the nearest foe - the one beam that refuses to miss.',
    onFrame: (f: any, fr: number, g: any) => {
      if (fr !== 10) return;
      const bx = f.x - f.facing * 30, by = f.y - 140;
      const t = g.nearestEnemy(f, 800);
      const down = t ? Math.atan2(t.y - t.h / 2 - by, t.x - bx) : (f.facing > 0 ? 0.7 : Math.PI - 0.7);
      blaster(g, f, { x: bx, y: by, ang: down, size: 46, charge: 20, fire: 20, len: 1000, width: 70, col: SOUL(0), big: true,
        tick: { dmg: 2.3, ang: -30, kb: 1.6, sc: 0, stun: 9 }, fin: { dmg: 12, ang: -40, kb: 9, sc: 9 } });
    },
  }),
};

// ---------------------------------------------------------------------------
// DEFINITION
// ---------------------------------------------------------------------------

const look: Look = {
  skin: BONE, hair: '#e9e8f0', hairStyle: 'bald',
  top: '#383844', top2: '#121219', sleeve: '#121219', fore: '#121219', pants: '#24242d', boots: '#0d0d12',
  eye: '#ffffff', weapon: 'fists', mark: 'none',
  energy: VOID_VIOLET, energy2: '#ffffff',
  pose: 'mage', idle: 'breathe', run: 'float', eyeStyle: 'glowing', accent: VOID_VIOLET,
  build: { shoulder: 1.0, chest: 0.92, limb: 1.12, head: 1.06, torso: 1.12, hip: 1 },
};

const generated = installTechniques('gaster', look, core) as Record<MoveKey, MoveDef>;
const moves = { ...generated, ...awakened } as Record<MoveKey, MoveDef>;

export const GASTER: CharDef = {
  id: 'gaster', styleId: 'gaster', name: 'W. D. Gaster', short: 'Gaster', anime: 'Glitchtale', title: 'The Royal Scientist', tier: 'S', color: VOID_VIOLET,
  desc: 'The Royal Scientist, back from the void. His floating, hole-palmed hands do the fighting, his Gaster Blasters do the killing, and the void is a door he steps through at will. Awakened, he wields all seven human SOULs.',
  portrait: makePortrait('gaster', look, VOID_VIOLET),
  stats: { speed: 6.6, air: 6.9, jump: 13.6, weight: 0.98, scale: 1.08, gravity: 0.56 },
  statBars: { power: 4, speed: 3, range: 5, defense: 3 },
  look, moves,
  moveBranches: [
    { input: 'J → J → J', name: 'Phantom Palm Chain', desc: 'Phantom Palm → Backhand Rebuke → Clap of the Void, all thrown by the floating hands.' },
    { input: 'J → L', name: moves.nlight_spec.name!, desc: 'Cancels the string into a void round from the palm hole.' },
    { input: '→ J → L', name: moves.slight_spec.name!, desc: 'Steps through the void behind the target mid-string.' },
    { input: 'L', name: 'Gaster Blaster', desc: 'A blaster locks on over his shoulder and fires across the stage.' },
    { input: 'R @ full gauge', name: 'Seven Souls', desc: 'Every awakened move is one SOUL: Justice, Bravery, Kindness, Integrity, Patience, Perseverance, Determination.' },
    { input: 'AWAKENED · K → L', name: 'SOUL launcher → Blaster finisher', desc: 'Each awakened heavy chains into its stance\'s awakened special.' },
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
    { name: 'Hands of the Void', desc: 'His floating hands strike from well outside his body, so his normals out-range most of the roster.' },
    { name: 'Step Through', desc: 'Void Step and Void Rift make him untouchable while he is between places.' },
    { name: 'Seven Souls', desc: 'Awakened, each move channels one human SOUL: its colour, its hand, and its power.' },
  ],
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', vertSpec: 'dspec', ultRange: 560 },
};
void SOULS; void heartPath;
