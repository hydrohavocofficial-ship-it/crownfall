import type { Rect } from './types';
import shrineArt from '../assets/images/sukuna/shrine.png';

/** Draw-only API: bounds are the actual world-space collision rectangle. */
export type BossVfxKind = 'shrine' | 'fuga' | 'blue' | 'red' | 'purple' | 'void';
export interface BossVfxOptions {
  alpha?: number; progress?: number; facing?: number; angle?: number; seed?: number; active?: boolean;
}
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const easeOutBack = (n: number) => { const c = 1.9; const k = clamp(n) - 1; return 1 + (c + 1) * k * k * k + c * k * k; };

/** Lazily created image cache; transparent PNG support is preserved verbatim. */
const imageCache: Record<string, HTMLImageElement> = {};
function art(src: string) {
  if (typeof Image === 'undefined') return null;
  let i = imageCache[src];
  if (!i) { i = new Image(); i.src = src; imageCache[src] = i; }
  return i.complete && i.naturalWidth > 0 ? i : null;
}
export function preloadShrine() { art(shrineArt); }

export function drawBossVfx(c: CanvasRenderingContext2D, kind: BossVfxKind, b: Rect, time: number, o: BossVfxOptions = {}) {
  if (![b.x, b.y, b.w, b.h, time].every(Number.isFinite) || b.w <= 0 || b.h <= 0) return;
  const w = b.w, h = b.h, r = Math.min(w, h) * .5, k = clamp(o.progress ?? 1), seed = o.seed ?? 0;
  c.save(); c.globalAlpha *= clamp(o.alpha ?? 1); c.globalCompositeOperation = 'source-over';
  c.translate(b.x + w * .5, b.y + h * .5);
  // Clip damage silhouettes to collision extents; no invented off-hitbox reach.
  c.beginPath(); c.rect(-w * .5, -h * .5, w, h); c.clip();
  if (kind === 'shrine') {
    // The Malevolent Shrine is the supplied artwork — the architecture is never
    // re-generated. Only the domain boundary (the honest hit extent) and the
    // autonomous Dismantle cuts are drawn on top of the transparent PNG.
    const img = art(shrineArt);
    const base = h * .5;                       // shrine stands on the domain floor
    const pool = w * .5;
    c.save();
    c.globalCompositeOperation = 'source-over';
    // Domain floor: a dark, wet-looking pool the shrine appears to rise from.
    c.globalAlpha *= .55;
    const pg = c.createRadialGradient(0, base, 2, 0, base, pool);
    pg.addColorStop(0, 'rgba(60,4,18,.72)'); pg.addColorStop(.7, 'rgba(38,2,12,.32)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = pg;
    c.beginPath(); c.ellipse(0, base, pool, h * .17, 0, 0, TAU); c.fill();
    // Entrance: a fast overshoot so the shrine lands with weight. It is sized to
    // stand inside the domain's own footprint — imposing, never a full-screen wall.
    const enter = easeOutBack(clamp(k * 1.35));
    const size = Math.min(w * .40, h * 1.02) * (.42 + .58 * enter);
    c.globalAlpha = clamp(o.alpha ?? 1) * (img ? clamp(k * 2.4) * .98 : .6);
    if (img) {
      // Backlight bloom keeps the silhouette readable against a bright arena.
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .3;
      const bg = c.createRadialGradient(0, base - size * .42, size * .1, 0, base - size * .42, size * .62);
      bg.addColorStop(0, 'rgba(255,70,110,.85)'); bg.addColorStop(1, 'rgba(255,0,60,0)');
      c.fillStyle = bg; c.beginPath(); c.arc(0, base - size * .42, size * .62, 0, TAU); c.fill();
      c.restore();
      c.drawImage(img, -size * .5, base - size * .95, size, size);
    } else {
      // Only used if the PNG cannot be decoded; never the primary look.
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,60,100,.5)';
      c.fillRect(-size * .3, base - size * .8, size * .6, size * .8);
    }
    c.restore();
    // The frame is the domain's rectangular hit extent, not a misleading circle.
    c.save();
    c.globalAlpha *= .5;
    c.strokeStyle = '#e34359'; c.lineWidth = 1.6; c.setLineDash([16, 12]);
    c.lineDashOffset = -(time * 1.4) % 28;
    c.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
    c.setLineDash([]);
    c.restore();
    // The autonomous Dismantle cuts are animated: the signature's update pass
    // spawns them through the shared cut effect, so nothing static is drawn here.
  } else if (kind === 'fuga') {
    c.rotate(o.angle ?? ((o.facing ?? 1) < 0 ? Math.PI : 0));
    const len = Math.min(w, h) * .48;
    c.lineJoin = 'miter';
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = ['#6d0715', '#ff6425', '#fff1b4'][layer];
      const breadth = r * (.37 - layer * .11);
      c.beginPath(); c.moveTo(len, 0); c.lineTo(-len * .05, -breadth); c.lineTo(len * .16, -breadth * .22);
      c.lineTo(-len, -breadth * .22); c.lineTo(-len * .7, 0); c.lineTo(-len, breadth * .22);
      c.lineTo(len * .16, breadth * .22); c.lineTo(-len * .05, breadth); c.closePath(); c.fill();
    }
    c.strokeStyle = '#ffb753'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const y = (i - 1) * r * .36; c.beginPath(); c.moveTo(-len * .1, y); c.quadraticCurveTo(-len * .65, y + Math.sin(time * .2 + i) * 8, -len, y * .3); c.stroke(); }
  } else if (kind === 'void') {
    c.fillStyle = 'rgba(5,8,24,.26)'; c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = '#8791d8'; c.lineWidth = .75;
    for (let i = 0; i < 32; i++) {
      const x = Math.sin(i * 127.1 + seed) * w * .47, y = Math.cos(i * 311.7 + seed) * h * .47;
      const sz = 1 + (1 + Math.sin(time * .05 + i)) * 1.7;
      c.strokeStyle = i % 3 ? '#bfe9ff' : '#c6a2ff';
      c.beginPath(); c.moveTo(x - sz, y); c.lineTo(x + sz, y); c.moveTo(x, y - sz); c.lineTo(x, y + sz); c.stroke();
    }
    c.strokeStyle = '#d5eaff'; c.lineWidth = 1;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, w * (.25 + i * .11), h * (.25 + i * .11), 0, 0, TAU); c.stroke(); }
  } else {
    const blue = kind === 'blue', red = kind === 'red';
    const col = blue ? '#3eacff' : red ? '#ff3154' : '#b575ff';
    // Rect-normalized field: an ellipse honours narrow and tall hitboxes too.
    c.scale(w / Math.max(w, h), h / Math.max(w, h));
    const rr = Math.max(w, h) * .48;
    c.fillStyle = blue ? '#06152a' : red ? '#42081b' : '#0c031c';
    c.beginPath(); c.arc(0, 0, rr * .61, 0, TAU); c.fill();
    c.strokeStyle = col; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, rr * .68, 0, TAU); c.stroke();
    for (let i = 0; i < 6; i++) {
      const phase = (time * .035 + i / 6) % 1, radius = rr * (.22 + (blue ? 1 - phase : phase) * .76);
      c.globalAlpha *= .82; c.strokeStyle = i % 2 ? col : '#eef8ff'; c.lineWidth = i % 2 ? 1.8 : .8;
      c.beginPath(); c.ellipse(0, 0, radius, radius * (blue ? .4 : .82), time * .012 + i * .56, .3, 5.5); c.stroke();
    }
    // Spiral trajectories point inward for Blue, radial wedges outward for Red.
    c.globalAlpha = clamp(o.alpha ?? 1) * .85;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + time * (blue ? -.035 : .012);
      c.strokeStyle = i % 2 ? col : '#f8eeff'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(Math.cos(a) * rr * .96, Math.sin(a) * rr * .96);
      c.quadraticCurveTo(Math.cos(a + (blue ? .9 : 0)) * rr * .8, Math.sin(a + (blue ? .9 : 0)) * rr * .8, Math.cos(a + (blue ? 1.6 : 0)) * rr * .63, Math.sin(a + (blue ? 1.6 : 0)) * rr * .63); c.stroke();
    }
    if (!blue && !red) {
      for (const side of [-1, 1]) { c.strokeStyle = side < 0 ? '#56caff' : '#ff486d'; c.lineWidth = 2; c.beginPath(); c.arc(side * rr * (1 - k) * .44, 0, rr * .54, time * .06 + side, time * .06 + side + Math.PI); c.stroke(); }
      c.strokeStyle = '#fff2ff'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 0, rr * .72, 0, TAU); c.stroke();
    }
  }
  c.restore();
}

/**
 * Anime sweep-cut — the heavy crescent a big Dismantle whips out as the arm
 * comes across. Where `drawAnimeCut` is a straight gash that opens and seals,
 * this one travels: the arc grows out of the swing, bends along its own curve,
 * and throws a fan of black bristles off the tail.
 *
 * Strictly black and white, like the rest of Sukuna's blade language: a solid
 * black body, a white-hot leading edge and white spatter. `curve` bends the
 * crescent (negative bends the other way), `k` runs 0 → 1 over the lifetime.
 */
export function drawArcSlash(c: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, curve: number, k: number, thick = 1, seed = 0) {
  if (!Number.isFinite(x + y + len + ang + k) || k <= 0 || k >= 1 || len <= 0) return;
  const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);
  const grow = ease(k / .2);                                   // the blade whips outward
  const open = k < .42 ? ease((k - .06) / .3) : 1 - ease((k - .42) / .52); // opens, then seals
  const alpha = k < .8 ? 1 : 1 - (k - .8) / .2;
  const L = len * (.42 + .58 * grow);
  const band = Math.max(1.1, len * .072 * thick) * Math.max(.12, open);
  const bend = curve * L * .4;
  /** Sampled quadratic: the centre line of the crescent, local space. */
  const P = (u: number): [number, number] => {
    const v = 1 - u;
    return [v * v * (-L * .5) + u * u * (L * .5), 2 * v * u * bend];
  };
  const N = 24;
  const hw = (u: number) => band * Math.pow(Math.sin(Math.PI * u), .62);
  c.save(); c.translate(x, y); c.rotate(ang); c.lineJoin = 'round'; c.lineCap = 'round';
  c.globalAlpha *= alpha;
  // Solid black body: the ink-heavy crescent that reads at any zoom.
  const outline = (scale: number, lead: number) => {
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N, [px, py] = P(u), [qx, qy] = P(Math.min(1, u + .012)), [rx, ry] = P(Math.max(0, u - .012));
      const tx = qx - rx, ty = qy - ry, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l, h = hw(u) * scale;
      const off = h * (1 + lead);
      if (i) c.lineTo(px + nx * off, py + ny * off); else c.moveTo(px + nx * off, py + ny * off);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N, [px, py] = P(u), [qx, qy] = P(Math.min(1, u + .012)), [rx, ry] = P(Math.max(0, u - .012));
      const tx = qx - rx, ty = qy - ry, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
      c.lineTo(px - nx * hw(u) * scale, py - ny * hw(u) * scale);
    }
    c.closePath();
  };
  outline(1.18, 0); c.fillStyle = '#07070a'; c.fill();
  outline(1, 0); c.fillStyle = '#111114'; c.fill();
  // White-hot leading edge riding the outside of the bend.
  const edge = (scale: number, col: string, w: number, a: number) => {
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N, [px, py] = P(u), [qx, qy] = P(Math.min(1, u + .012)), [rx, ry] = P(Math.max(0, u - .012));
      const tx = qx - rx, ty = qy - ry, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
      const off = hw(u) * scale;
      if (i) c.lineTo(px + nx * off, py + ny * off); else c.moveTo(px + nx * off, py + ny * off);
    }
    c.strokeStyle = col; c.lineWidth = w; c.globalAlpha *= a; c.stroke(); c.globalAlpha /= a;
  };
  c.globalCompositeOperation = 'lighter';
  edge(.86, '#ffffff', Math.max(1, band * .55), .95);
  edge(.4, '#ffffff', Math.max(1, band * .22), .7);
  c.globalCompositeOperation = 'source-over';
  // Bristles: black spatter flying off the tail, like ink off a brush.
  const [tx0, ty0] = P(.08), [tx1, ty1] = P(.2);
  const along = Math.atan2(ty1 - ty0, tx1 - tx0) + Math.PI / 2 * Math.sign(bend || 1);
  for (let i = 0; i < 11; i++) {
    const a = along + (i / 10 - .5) * 1.5 + Math.sin(seed * 4.1 + i) * .06;
    const l = L * (.1 + ((i * 37) % 11) / 26);
    c.strokeStyle = i % 4 ? '#0a0a0e' : '#ffffff'; c.lineWidth = Math.max(.9, band * (i % 3 ? .3 : .16));
    c.beginPath(); c.moveTo(tx0, ty0);
    c.quadraticCurveTo(tx0 + Math.cos(a) * l * .6, ty0 + Math.sin(a) * l * .6, tx0 + Math.cos(a + .2) * l, ty0 + Math.sin(a + .2) * l);
    c.stroke();
  }
  c.restore();
}

/**
 * Anime-style Dismantle/Cleave cut (JJK): a razor-thin line that shoots out
 * across the target, then splits open into a tapered lens — white-hot glowing
 * lips around a pitch-black gash — before sealing shut and fading.
 * k runs 0 → 1 over the cut's lifetime.
 */
export function drawAnimeCut(c: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, k: number, thick = 1, seed = 0) {
  if (!Number.isFinite(x + y + len + ang + k) || k <= 0 || k >= 1 || len <= 0) return;
  const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);
  const extend = ease(k / .22);                       // line shoots out
  const open = k < .5 ? ease((k - .1) / .3) : 1 - ease((k - .5) / .42); // gash opens, then seals
  const alpha = k < .8 ? 1 : 1 - (k - .8) / .2;
  const L = len * (.35 + .65 * extend) * (1 + k * .08), half = L / 2;
  const H = Math.max(1.2, len * .045 * thick * open);   // lens half-height
  // subtle asymmetry like a real blade cut: bulge sits off-centre
  const skew = .12 * Math.sin(seed * 7.3);
  const lens = (hl: number, hh: number, bump = 0) => {
    c.beginPath(); c.moveTo(-hl, 0);
    for (let i = 1; i <= 24; i++) { const u = i / 24, px = -hl + u * hl * 2, s = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u + skew * Math.sin(Math.PI * u)))), 1.6); c.lineTo(px, -hh * s * (1 + bump)); }
    for (let i = 23; i >= 0; i--) { const u = i / 24, px = -hl + u * hl * 2, s = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u + skew * Math.sin(Math.PI * u)))), 1.6); c.lineTo(px, hh * s * .82); }
    c.closePath();
  };
  c.save(); c.translate(x, y); c.rotate(ang); c.globalCompositeOperation = 'source-over';
  // soft grey/white bloom
  c.globalAlpha = alpha * .28; c.fillStyle = '#ffffff'; c.shadowColor = '#ffffff'; c.shadowBlur = 18;
  lens(half * 1.04, H * 2.1 + 3); c.fill();
  c.shadowBlur = 0; c.globalAlpha = alpha * .45; lens(half, H * 1.55 + 2); c.fill();
  // hot white lips
  c.globalAlpha = alpha; c.fillStyle = '#ffffff'; c.shadowColor = '#ffe6ea'; c.shadowBlur = 10;
  lens(half * .97, H * 1.15 + 1.2); c.fill(); c.shadowBlur = 0;
  // the black gash
  if (open > .08) { c.fillStyle = '#141014'; lens(half * .66, H * .8, .05); c.fill(); }
  // hairline tails that overshoot past the tips
  c.globalAlpha = alpha * .9; c.strokeStyle = '#ffffff'; c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(-half * 1.12, 0); c.lineTo(half * 1.12, 0); c.stroke();
  c.restore();
}
