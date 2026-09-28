/**
 * W. D. GASTER — ART
 *
 * The Glitchtale Gaster, drawn from scratch on the shared skeleton:
 *
 *  - a tall, smooth skull, lit hard from the front so one crescent of it reads
 *    near-white and the rest a cool grey, with the two signature cracks (one
 *    climbing out of the rear socket, one running down from the front socket)
 *  - hollow black sockets with small ringed pupils, and the tired lines under them
 *  - a long black coat worn open over a ribbed turtleneck, whose tails trail the
 *    body's motion
 *  - disembodied hands with a hole through each palm, floating at his sides and
 *    doing most of the actual hitting
 *
 * Awakened ("Seven Souls") he takes on the colour art: a cream sweater, pale
 * trousers, a coat lined with a spectrum gradient, seven soul-coloured hands
 * fanned behind him each with its SOUL above it, and white glitch bars tearing
 * off his silhouette.
 *
 * Everything here is pure drawing. The kit lives in `gaster.ts`.
 */
import { OL, hexA, shade, tint, registerBody, type Skeleton } from './render';

export const SOULS = [
  { key: 'determination', name: 'DETERMINATION', c: '#ff2436' },
  { key: 'bravery', name: 'BRAVERY', c: '#ff9420' },
  { key: 'justice', name: 'JUSTICE', c: '#ffe63a' },
  { key: 'kindness', name: 'KINDNESS', c: '#2ee85a' },
  { key: 'patience', name: 'PATIENCE', c: '#46e6ff' },
  { key: 'integrity', name: 'INTEGRITY', c: '#2e5cff' },
  { key: 'perseverance', name: 'PERSEVERANCE', c: '#c24dff' },
] as const;
export type SoulIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const SOUL = (i: number) => SOULS[((i % 7) + 7) % 7].c;

export const VOID_BLACK = '#07060c';
export const VOID_VIOLET = '#7a68ff';
export const BONE = '#f4f3ef';
const COAT = '#17171f';
const COAT_HI = '#343444';
const TURTLE = '#383844';
const TURTLE_AW = '#e8e0cc';
const PANTS = '#24242d';
const PANTS_AW = '#c8c5bf';
const SHOE = '#0d0d12';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Deterministic hash noise, so glitch bars flicker without per-frame garbage. */
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------------------
// SHARED SHAPES
// ---------------------------------------------------------------------------

/** A SOUL: the Undertale heart, point down. `flip` turns it over (Justice/monster). */
export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, flip = false) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(1, -1);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.25, r * 0.05, -r * 1.05, -r * 1.05, -r * 0.5, -r * 0.95);
  ctx.bezierCurveTo(-r * 0.18, -r * 0.9, 0, -r * 0.6, 0, -r * 0.42);
  ctx.bezierCurveTo(0, -r * 0.6, r * 0.18, -r * 0.9, r * 0.5, -r * 0.95);
  ctx.bezierCurveTo(r * 1.05, -r * 1.05, r * 1.25, r * 0.05, 0, r * 0.95);
  ctx.closePath();
  ctx.restore();
}
export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 1, flip = false) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  g.addColorStop(0, hexA(col, 0.55)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  heartPath(ctx, x, y, r, flip);
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = Math.max(0.8, r * 0.16); ctx.strokeStyle = shade(col, 0.45); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.42, r * 0.2, r * 0.13, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * Gaster's hand. Palm toward the viewer, fingers along local -y, with the hole
 * punched clean through the palm. `grip` 0 is an open spread hand, 1 a closed
 * claw. `col` tints the hand for the soul hands; the base hand is bone white.
 */
export function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ang: number,
  opts: { grip?: number; col?: string; glow?: string; alpha?: number; mirror?: boolean } = {}) {
  const s = size, grip = clamp(opts.grip ?? 0, 0, 1), col = opts.col || BONE;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang); if (opts.mirror) ctx.scale(-1, 1);
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(0, -s * 0.3, 0, 0, -s * 0.3, s * 2.3);
    gg.addColorStop(0, hexA(opts.glow, 0.6)); gg.addColorStop(1, hexA(opts.glow, 0));
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 2.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const fill = ctx.createLinearGradient(-s, -s, s, s);
  fill.addColorStop(0, tint(col, 1.08)); fill.addColorStop(0.6, col); fill.addColorStop(1, shade(col, 0.72));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Fingers first so the palm's outline sits over their roots.
  const fingers: [number, number, number][] = [[-0.5, -0.2, 0.92], [-0.17, -0.06, 1.06], [0.17, 0.06, 1.0], [0.48, 0.2, 0.84]];
  for (const [fx, spread, len] of fingers) {
    const L = s * len * (1 - grip * 0.35);
    const bx = fx * s, by = -s * 0.45;
    const a1 = spread * (1 - grip) - Math.PI / 2;
    const mx = bx + Math.cos(a1) * L * 0.55, my = by + Math.sin(a1) * L * 0.55;
    const a2 = a1 + grip * 1.9;
    const tx = mx + Math.cos(a2) * L * 0.5, ty = my + Math.sin(a2) * L * 0.5;
    ctx.strokeStyle = OL; ctx.lineWidth = s * 0.34 + 2.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.34;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
  }
  // Thumb, set low on the side.
  {
    const a1 = -2.5 + grip * 0.9, L = s * 0.8;
    const bx = -s * 0.62, by = -s * 0.05;
    const mx = bx + Math.cos(a1) * L * 0.55, my = by + Math.sin(a1) * L * 0.55;
    const tx = mx + Math.cos(a1 + 0.5 + grip) * L * 0.45, ty = my + Math.sin(a1 + 0.5 + grip) * L * 0.45;
    ctx.strokeStyle = OL; ctx.lineWidth = s * 0.36 + 2.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.36;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
  }
  // Palm.
  ctx.beginPath();
  ctx.moveTo(-s * 0.66, -s * 0.5);
  ctx.quadraticCurveTo(0, -s * 0.66, s * 0.66, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.78, s * 0.2, s * 0.38, s * 0.62);
  ctx.lineTo(-s * 0.38, s * 0.62);
  ctx.quadraticCurveTo(-s * 0.8, s * 0.2, -s * 0.66, -s * 0.5);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.stroke();
  // Knuckle crease.
  ctx.strokeStyle = hexA('#000000', 0.18); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-s * 0.46, -s * 0.34); ctx.quadraticCurveTo(0, -s * 0.44, s * 0.46, -s * 0.34); ctx.stroke();
  // The hole. A soul hand's hole glows its own colour from inside.
  const hr = s * 0.21;
  ctx.fillStyle = VOID_BLACK;
  ctx.beginPath(); ctx.ellipse(0, s * 0.06, hr, hr * 1.1, 0, 0, TAU); ctx.fill();
  if (opts.col && opts.col !== BONE) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(0, s * 0.06, 0, 0, s * 0.06, hr);
    hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.5, hexA(opts.col, 0.8)); hg.addColorStop(1, hexA(opts.col, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, s * 0.06, hr, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = hexA('#000000', 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, s * 0.06, hr + 1.1, hr * 1.1 + 1.1, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

/**
 * A Gaster Blaster: the long horned skull. Snout along local +x, hinge behind
 * the cheek, `jaw` 0..1 opens the lower jaw, `charge` 0..1 lights the socket and
 * the throat.
 */
export function drawBlaster(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ang: number,
  jaw: number, charge: number, col: string, alpha = 1) {
  const s = size;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  // A blaster aimed left would be drawn upside down; flip it the right way up.
  if (Math.cos(ang) < 0) ctx.scale(1, -1);
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Back glow.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.8);
  bg.addColorStop(0, hexA(col, 0.28 + charge * 0.3)); bg.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, s * 1.8, 0, TAU); ctx.fill();
  ctx.restore();
  const boneG = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.4);
  boneG.addColorStop(0, '#ffffff'); boneG.addColorStop(0.55, '#e9e8f0'); boneG.addColorStop(1, '#a9a8b8');
  // Horns: two long spikes sweeping back off the crown.
  for (const [ox, len, lift] of [[-0.55, 1.15, 0.95], [-0.2, 0.9, 0.7]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(s * ox, -s * 0.36);
    ctx.quadraticCurveTo(s * (ox - len * 0.55), -s * (0.42 + lift * 0.4), s * (ox - len), -s * (0.2 + lift * 0.55));
    ctx.quadraticCurveTo(s * (ox - len * 0.5), -s * 0.26, s * (ox + 0.22), -s * 0.2);
    ctx.closePath();
    ctx.fillStyle = boneG; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.2; ctx.stroke();
  }
  // Lower jaw, rotated open about the hinge.
  ctx.save();
  ctx.translate(-s * 0.42, s * 0.12); ctx.rotate(jaw * 0.62);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.02);
  ctx.lineTo(s * 1.24, s * 0.02);
  ctx.quadraticCurveTo(s * 1.3, s * 0.14, s * 1.16, s * 0.2);
  ctx.quadraticCurveTo(s * 0.5, s * 0.34, s * 0.04, s * 0.3);
  ctx.closePath();
  ctx.fillStyle = boneG; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OL; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const tx = s * (0.38 + i * 0.17);
    ctx.beginPath(); ctx.moveTo(tx, s * 0.02); ctx.lineTo(tx + s * 0.06, -s * 0.09); ctx.lineTo(tx + s * 0.12, s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // Throat light between the jaws.
  if (jaw > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const tg = ctx.createRadialGradient(s * 0.5, s * 0.16, 0, s * 0.5, s * 0.16, s * 0.7);
    tg.addColorStop(0, `rgba(255,255,255,${0.5 + charge * 0.5})`); tg.addColorStop(0.4, hexA(col, 0.7 * charge + 0.2)); tg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(s * 0.5, s * 0.16, s * 0.7, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Cranium + snout.
  ctx.beginPath();
  ctx.moveTo(-s * 0.95, s * 0.02);
  ctx.quadraticCurveTo(-s * 1.0, -s * 0.46, -s * 0.5, -s * 0.52);
  ctx.quadraticCurveTo(s * 0.05, -s * 0.6, s * 0.4, -s * 0.34);
  ctx.quadraticCurveTo(s * 0.8, -s * 0.24, s * 1.05, -s * 0.12);
  ctx.quadraticCurveTo(s * 1.12, -s * 0.02, s * 1.02, s * 0.06);
  ctx.lineTo(s * 0.1, s * 0.1);
  ctx.quadraticCurveTo(-s * 0.4, s * 0.3, -s * 0.95, s * 0.02);
  ctx.closePath();
  ctx.fillStyle = boneG; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.6; ctx.stroke();
  // Upper teeth.
  ctx.fillStyle = '#ffffff'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const tx = s * (0.22 + i * 0.16);
    ctx.beginPath(); ctx.moveTo(tx, s * 0.08); ctx.lineTo(tx + s * 0.06, s * 0.2); ctx.lineTo(tx + s * 0.12, s * 0.07); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Nostril slits and brow ridge.
  ctx.fillStyle = VOID_BLACK;
  ctx.beginPath(); ctx.ellipse(s * 0.86, -s * 0.12, s * 0.05, s * 0.025, -0.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = hexA('#000000', 0.35); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.36); ctx.quadraticCurveTo(-s * 0.1, -s * 0.46, s * 0.3, -s * 0.28); ctx.stroke();
  // Eye socket - black, with a burning pupil once it has started to charge.
  ctx.fillStyle = VOID_BLACK;
  ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.2, s * 0.2, s * 0.13, -0.25, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-s * 0.62, -s * 0.18, s * 0.12, s * 0.1, 0.2, 0, TAU); ctx.fill();
  if (charge > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(-s * 0.16, -s * 0.2, 0, -s * 0.16, -s * 0.2, s * 0.34);
    eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.3, hexA(col, 0.95)); eg.addColorStop(1, hexA(col, 0));
    ctx.globalAlpha *= charge;
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.2, s * 0.34, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** The beam a blaster throws: layered, slightly wavering, white-hot at the core. */
export function drawBeam(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, col: string, t: number, alpha = 1) {
  if (len <= 0 || w <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= alpha;
  const layers: [number, string][] = [[1.9, hexA(col, 0.22)], [1.3, hexA(col, 0.5)], [0.85, hexA(tint(col, 1.3), 0.85)], [0.42, 'rgba(255,255,255,0.98)']];
  for (const [k, c] of layers) {
    const hh = w * k * 0.5;
    ctx.fillStyle = c; ctx.beginPath();
    const steps = 22;
    for (let i = 0; i <= steps; i++) { const xx = len * i / steps; ctx.lineTo(xx, -hh - Math.sin(t * 0.7 + i * 1.3) * hh * 0.1); }
    for (let i = steps; i >= 0; i--) { const xx = len * i / steps; ctx.lineTo(xx, hh + Math.sin(t * 0.6 + i * 1.1) * hh * 0.1); }
    ctx.closePath(); ctx.fill();
  }
  // Muzzle flare.
  const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.3);
  mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.35, hexA(col, 0.7)); mg.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, w * 1.3, 0, TAU); ctx.fill();
  ctx.restore();
}

/** White glitch bars - the Glitchtale tear. Drawn in whatever space the caller is in. */
export function drawGlitch(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, t: number, n: number, cols: string[], alpha = 1, seed = 0) {
  const tick = Math.floor(t / 3);
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const r1 = hash(tick * 7.3 + i * 13.1 + seed), r2 = hash(tick * 3.1 + i * 5.7 + seed * 2), r3 = hash(i * 9.9 + tick + seed * 3);
    if (r3 < 0.3) continue;
    const bw = 5 + r1 * 22, bh = 2 + r2 * 3.5;
    const x = cx + (r1 - 0.5) * w, y = cy + (r2 - 0.5) * h;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(x, y, bw, bh);
    if (r3 > 0.8) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + bw + 2, y, bw * 0.3, bh); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// THE BODY
// ---------------------------------------------------------------------------

interface HandState { fx: number; fy: number; fa: number; fg: number; bx: number; by: number; ba: number; bg: number; sx: number; sy: number; t: number }

/**
 * Where the two base hands (and the active soul hand) want to be this frame.
 * The move names its hands (`gh`): the front hand, the back hand, both (a clap),
 * or a raised casting spread. The target is the live hitbox, so the hand is
 * always physically on the thing that is dealing the damage.
 */
function handTargets(k: Skeleton) {
  const { f, sh, time } = k;
  const s = f.scale || 1;
  const bob = Math.sin(time * 0.07) * 3, bob2 = Math.sin(time * 0.07 + 2.1) * 3;
  const out = {
    fx: sh[0] + 30, fy: sh[1] + 12 + bob, fa: 0.25, fg: 0.1,
    bx: sh[0] - 30, by: sh[1] + 4 + bob2, ba: -0.3, bg: 0.1,
    sx: NaN, sy: NaN, rate: 0.16,
  };
  const m = f.state === 'attack' ? f.move : null;
  if (!m) return out;
  const fr = f.moveFrame || 0;
  const mode: string = m.gh || (m.hits?.length ? 'front' : 'cast');
  // Pick the live hit, or the next one if we are still in startup.
  let h: any = null;
  for (const hh of m.hits || []) { if (fr >= hh.f[0] - 6 && fr <= hh.f[1] + 3) { h = hh; break; } }
  let tx: number, ty: number;
  if (h) { tx = h.x / s; ty = h.y / s; }
  else if (m.ghAt) { tx = m.ghAt[0]; ty = m.ghAt[1]; }
  else { tx = 46; ty = -58; }
  const windup = h ? fr < h.f[0] : fr < (m.startup || 0);
  // Anticipation: the hand draws back before it strikes.
  const pull = windup ? 0.55 : 1;
  const ax = sh[0] + (tx - sh[0]) * pull, ay = sh[1] + (ty - sh[1]) * pull;
  out.rate = windup ? 0.3 : 0.55;
  const aimAng = Math.atan2(ty - sh[1], tx - sh[0]) + Math.PI / 2;
  const grip = m.ghGrip ?? (windup ? 0.2 : 0.55);
  if (mode === 'front') { out.fx = ax; out.fy = ay; out.fa = aimAng; out.fg = grip; }
  else if (mode === 'back') { out.bx = ax; out.by = ay; out.ba = aimAng; out.bg = grip; }
  else if (mode === 'both') {
    // A clap: the two hands close on the hitbox from above and below.
    const gap = windup ? 22 : 7;
    out.fx = ax + 4; out.fy = ay - gap; out.fa = Math.PI * 0.95; out.fg = grip;
    out.bx = ax - 2; out.by = ay + gap; out.ba = 0.05; out.bg = grip;
  } else if (mode === 'cast') {
    out.fx = sh[0] + 26; out.fy = sh[1] - 22 + bob; out.fa = 0.35; out.fg = 0;
    out.bx = sh[0] - 24; out.by = sh[1] - 18 + bob2; out.ba = -0.35; out.bg = 0;
  } else if (mode === 'barrage') {
    // Alternating jabs: one hand lands while the other chambers.
    const lead = Math.floor(fr / 3) % 2 === 0;
    const jx = sh[0] + (tx - sh[0]) * (windup ? 0.5 : 1), jy = ty + Math.sin(fr * 1.7) * 8;
    if (lead) { out.fx = jx; out.fy = jy; out.fa = aimAng; out.fg = 0.9; out.bx = sh[0] + 6; out.by = sh[1] + 10; out.bg = 0.9; }
    else { out.bx = jx; out.by = jy + 6; out.ba = aimAng; out.bg = 0.9; out.fx = sh[0] + 10; out.fy = sh[1] + 6; out.fg = 0.9; }
    out.rate = 0.75;
  } else if (mode === 'spin') {
    const a = fr * 0.45;
    out.fx = Math.cos(a) * 38; out.fy = sh[1] + 8 + Math.sin(a) * 30; out.fa = a + Math.PI / 2; out.fg = 0.3;
    out.bx = Math.cos(a + Math.PI) * 38; out.by = sh[1] + 8 + Math.sin(a + Math.PI) * 30; out.ba = a - Math.PI / 2; out.bg = 0.3;
    out.rate = 0.7;
  }
  if (m.soul !== undefined || m.soulAll) { out.sx = ax; out.sy = ay + (m.soulAll ? Math.sin(fr * 1.3) * 10 : 0); }
  return out;
}

function updateHands(k: Skeleton): HandState {
  const f = k.f;
  const tg = handTargets(k);
  let st: HandState = f._gasterHands;
  if (!st) {
    st = { fx: tg.fx, fy: tg.fy, fa: tg.fa, fg: tg.fg, bx: tg.bx, by: tg.by, ba: tg.ba, bg: tg.bg, sx: 0, sy: -80, t: -1 };
    f._gasterHands = st;
  }
  const now = f.animT ?? 0;
  if (st.t !== now) {
    // Advance once per simulated frame, however many times the body is drawn.
    const r = tg.rate;
    st.fx += (tg.fx - st.fx) * r; st.fy += (tg.fy - st.fy) * r; st.fa += (tg.fa - st.fa) * r; st.fg += (tg.fg - st.fg) * r;
    st.bx += (tg.bx - st.bx) * r; st.by += (tg.by - st.by) * r; st.ba += (tg.ba - st.ba) * r; st.bg += (tg.bg - st.bg) * r;
    if (Number.isFinite(tg.sx)) { st.sx += (tg.sx - st.sx) * 0.55; st.sy += (tg.sy - st.sy) * 0.55; }
    st.t = now;
  }
  return st;
}

/** The soul colour the awakened form is currently cycling through. */
export function cycleSoul(time: number) { return SOUL(Math.floor(time / 18)); }

function drawSoulFan(ctx: CanvasRenderingContext2D, k: Skeleton, active: number | undefined, hs: HandState, power: number) {
  const { hy, time } = k;
  const cx = 0, cy = hy - 34;
  for (let i = 0; i < 7; i++) {
    // Fan across the upper half-circle, determination at the crown.
    const order = [3, 4, 5, 0, 1, 6, 2][i];
    const a = Math.PI + (i / 6) * Math.PI;
    const R = 66 + Math.sin(time * 0.05 + i) * 4;
    let x = cx + Math.cos(a) * R * 1.1, y = cy + Math.sin(a) * R * 0.95 + Math.sin(time * 0.08 + i * 0.9) * 3;
    const col = SOUL(order);
    let ang = a + Math.PI / 2, grip = 0.05;
    if (active === order) { x = hs.sx; y = hs.sy; ang = Math.atan2(hs.sy - cy, hs.sx - cx) + Math.PI / 2; grip = 0.5; }
    drawHand(ctx, x, y, 10.5, ang, { col, glow: col, alpha: 0.95 * power, grip });
    if (active !== order) drawHeart(ctx, x + Math.cos(a) * 17, y + Math.sin(a) * 17 - 3, 4.2, col, power);
  }
}

function drawCoatBack(ctx: CanvasRenderingContext2D, k: Skeleton, hemY: number, flow: number, aw: boolean) {
  const { sh, time } = k;
  const wave = Math.sin(time * 0.16) * 2.5;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sh[0] + 11, sh[1] - 1);
  ctx.quadraticCurveTo(sh[0] + 19, (sh[1] + hemY) * 0.5, sh[0] + 17 - flow * 0.2, hemY - 1);
  // The hem: two long tails split up the back.
  ctx.lineTo(sh[0] + 4 - flow * 0.5, hemY + 2 + wave * 0.4);
  ctx.lineTo(sh[0] - 4 - flow * 0.7, hemY - 8);
  ctx.lineTo(sh[0] - 14 - flow, hemY + 4 + wave);
  ctx.lineTo(sh[0] - 25 - flow * 1.3, hemY - 1 + wave);
  ctx.quadraticCurveTo(sh[0] - 22 - flow * 0.6, (sh[1] + hemY) * 0.5, sh[0] - 12, sh[1] - 1);
  ctx.quadraticCurveTo(sh[0], sh[1] - 5, sh[0] + 11, sh[1] - 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(sh[0] - 20, sh[1], sh[0] + 14, hemY);
  if (aw) {
    // Colour art: the lining is a spectrum, deep violet at the collar running to
    // green and ember at the tails.
    g.addColorStop(0, '#2a1d6e'); g.addColorStop(0.35, '#3a3fd8'); g.addColorStop(0.62, '#1f8f58'); g.addColorStop(0.85, '#e0621a'); g.addColorStop(1, '#ffb42a');
  } else {
    g.addColorStop(0, COAT_HI); g.addColorStop(0.5, COAT); g.addColorStop(1, '#060609');
  }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = OL; ctx.stroke();
  // Cool rim light down the trailing edge, so the black coat separates from a
  // dark stage.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = aw ? 'rgba(255,255,255,.22)' : 'rgba(150,150,230,.28)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(sh[0] - 13, sh[1] + 2); ctx.quadraticCurveTo(sh[0] - 22 - flow * 0.6, (sh[1] + hemY) * 0.5, sh[0] - 24 - flow * 1.3, hemY - 3); ctx.stroke();
  ctx.restore();
  // Fold lines.
  ctx.strokeStyle = aw ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.07)'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sh[0] - 6, sh[1] + 8); ctx.quadraticCurveTo(sh[0] - 10 - flow * 0.4, (sh[1] + hemY) * 0.55, sh[0] - 12 - flow * 0.8, hemY - 3);
  ctx.moveTo(sh[0] + 6, sh[1] + 10); ctx.quadraticCurveTo(sh[0] + 4, (sh[1] + hemY) * 0.6, sh[0] + 2 - flow * 0.4, hemY - 2);
  ctx.stroke();
  ctx.restore();
}

function drawCoatFront(ctx: CanvasRenderingContext2D, k: Skeleton, hemY: number, flow: number, aw: boolean) {
  const { sh, hx, hy } = k;
  ctx.save();
  // The open front panel on the near side, and its lapel.
  ctx.beginPath();
  ctx.moveTo(sh[0] + 3, sh[1] - 3);
  ctx.lineTo(sh[0] + 12, sh[1] + 1);
  ctx.quadraticCurveTo(hx + 17, (sh[1] + hemY) * 0.5, hx + 16 - flow * 0.15, hemY - 2);
  ctx.lineTo(hx + 7 - flow * 0.2, hemY + 1);
  ctx.quadraticCurveTo(hx + 8, hy - 6, sh[0] + 6, sh[1] + 12);
  ctx.closePath();
  const g = ctx.createLinearGradient(sh[0], sh[1], hx + 16, hemY);
  g.addColorStop(0, COAT_HI); g.addColorStop(1, COAT);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = OL; ctx.stroke();
  // Lapel fold.
  ctx.beginPath();
  ctx.moveTo(sh[0] + 3, sh[1] - 3); ctx.lineTo(sh[0] + 10, sh[1] + 3); ctx.lineTo(sh[0] + 6, sh[1] + 12); ctx.closePath();
  ctx.fillStyle = aw ? '#3a3fd8' : '#20202b'; ctx.fill(); ctx.stroke();
  // Rim of the coat edge.
  ctx.strokeStyle = aw ? hexA(cycleSoul(k.time), 0.8) : 'rgba(170,170,210,.18)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(sh[0] + 12, sh[1] + 2); ctx.quadraticCurveTo(hx + 17, (sh[1] + hemY) * 0.5, hx + 16 - flow * 0.15, hemY - 3); ctx.stroke();
  // Popped collar standing up behind the jaw.
  ctx.beginPath();
  ctx.moveTo(sh[0] - 10, sh[1] - 1);
  ctx.quadraticCurveTo(sh[0] - 11, sh[1] - 13, sh[0] - 4, sh[1] - 15);
  ctx.lineTo(sh[0] + 1, sh[1] - 5);
  ctx.closePath();
  ctx.fillStyle = COAT; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function sleeve(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], w: number, col: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = w + 4;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = w * 0.28;
  ctx.beginPath(); ctx.moveTo(a[0], a[1] - w * 0.25); ctx.lineTo(b[0], b[1] - w * 0.25); ctx.lineTo(c[0], c[1] - w * 0.25); ctx.stroke();
  // A flared cuff at the wrist.
  const ang = Math.atan2(c[1] - b[1], c[0] - b[0]);
  ctx.save(); ctx.translate(c[0] - Math.cos(ang) * 3, c[1] - Math.sin(ang) * 3); ctx.rotate(ang);
  ctx.fillStyle = col; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-3, -w * 0.62); ctx.lineTo(3, -w * 0.78); ctx.lineTo(3, w * 0.78); ctx.lineTo(-3, w * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function leg(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], w: number, col: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = w + 3.6;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(b[0] + 1, b[1]); ctx.lineTo(c[0] + 1, c[1] - 3); ctx.stroke();
  // Pointed dress shoe.
  ctx.fillStyle = SHOE; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(c[0] - 4, c[1] - 3);
  ctx.quadraticCurveTo(c[0] + 6, c[1] - 5, c[0] + 10, c[1] + 0.5);
  ctx.lineTo(c[0] - 4, c[1] + 1.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(c[0], c[1] - 3.5, 4, 1);
}

function drawHead(ctx: CanvasRenderingContext2D, k: Skeleton, aw: boolean) {
  const { f, head, time, B } = k;
  const hr = 12.8 * B.head;
  const x = head[0] + 1, y = head[1] - 2;
  const hurt = f.state === 'hitstun';
  const grin = aw || (f.state === 'attack' && f.move?.ability && f.move.ability !== 'special');
  // Skull: taller than wide, the crown swelling back, the jaw tucked in.
  const skull = () => {
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.9, y + hr * 0.1);
    ctx.bezierCurveTo(x - hr * 1.02, y - hr * 1.05, x + hr * 0.2, y - hr * 1.42, x + hr * 0.78, y - hr * 0.72);
    ctx.bezierCurveTo(x + hr * 1.02, y - hr * 0.38, x + hr * 0.98, y + hr * 0.42, x + hr * 0.72, y + hr * 0.82);
    ctx.bezierCurveTo(x + hr * 0.5, y + hr * 1.12, x - hr * 0.08, y + hr * 1.16, x - hr * 0.42, y + hr * 0.92);
    ctx.bezierCurveTo(x - hr * 0.78, y + hr * 0.7, x - hr * 0.86, y + hr * 0.42, x - hr * 0.9, y + hr * 0.1);
    ctx.closePath();
  };
  skull();
  const base = ctx.createLinearGradient(x - hr, y - hr, x + hr, y + hr);
  base.addColorStop(0, '#c9c9d0'); base.addColorStop(1, '#9e9eab');
  ctx.fillStyle = base; ctx.fill();
  ctx.save(); skull(); ctx.clip();
  // Key light: one bright crescent across the brow and the front of the face,
  // exactly the way the scene art lights him.
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath();
  ctx.moveTo(x - hr * 1.2, y - hr * 1.5);
  ctx.bezierCurveTo(x - hr * 0.2, y - hr * 0.9, x + hr * 0.1, y - hr * 0.2, x + hr * 0.1, y + hr * 0.6);
  ctx.bezierCurveTo(x + hr * 0.5, y + hr * 0.3, x + hr * 1.3, y - hr * 0.1, x + hr * 1.3, y - hr * 1.5);
  ctx.closePath(); ctx.fill();
  // Soft bounce under the jaw.
  ctx.fillStyle = 'rgba(40,40,60,.18)';
  ctx.beginPath(); ctx.ellipse(x, y + hr * 1.05, hr * 1.1, hr * 0.35, 0, 0, TAU); ctx.fill();
  if (aw) {
    ctx.globalCompositeOperation = 'lighter';
    const rim = ctx.createLinearGradient(x - hr, y, x - hr * 0.3, y);
    rim.addColorStop(0, hexA(cycleSoul(time), 0.55)); rim.addColorStop(1, hexA(cycleSoul(time), 0));
    ctx.fillStyle = rim; ctx.fillRect(x - hr * 1.2, y - hr * 1.5, hr, hr * 3);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  skull(); ctx.strokeStyle = OL; ctx.lineWidth = 2.4; ctx.stroke();

  // Sockets: two hollow black ovals, the far one foreshortened.
  const eyes: [number, number, number, number][] = [[x - 1.6, y + 1.2, 3.3, 3.9], [x + 6.6, y + 1.3, 2.7, 3.7]];
  for (const [ex, ey, rx, ry] of eyes) {
    ctx.fillStyle = VOID_BLACK;
    ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0.05, 0, TAU); ctx.fill();
    // Tired lines under each socket.
    ctx.strokeStyle = 'rgba(40,40,52,.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(ex - rx * 0.9, ey + ry + 0.8); ctx.quadraticCurveTo(ex, ey + ry + 2.2, ex + rx * 0.9, ey + ry + 0.6); ctx.stroke();
  }
  if (hurt) {
    // Pupils go out when he is struck.
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (const [ex, ey] of eyes) { ctx.beginPath(); ctx.moveTo(ex - 1.4, ey - 1.4); ctx.lineTo(ex + 1.4, ey + 1.4); ctx.moveTo(ex + 1.4, ey - 1.4); ctx.lineTo(ex - 1.4, ey + 1.4); ctx.stroke(); }
  } else {
    // Ringed pupils: a white "0" floating in each socket.
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.95;
    for (const [ex, ey] of eyes) { ctx.beginPath(); ctx.ellipse(ex + 0.4, ey + 0.2, 0.9, 1.6, 0, 0, TAU); ctx.stroke(); }
    if (aw) {
      // The front socket burns with whichever SOUL is surfacing.
      const [ex, ey] = eyes[1], col = cycleSoul(time);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9);
      eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.25, hexA(col, 0.95)); eg.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, TAU); ctx.fill();
      // A trailing wisp of flame off the socket.
      ctx.fillStyle = hexA(col, 0.6);
      ctx.beginPath(); ctx.moveTo(ex + 2, ey - 2); ctx.quadraticCurveTo(ex + 8, ey - 6 - Math.sin(time * 0.3) * 2, ex + 13, ey - 12); ctx.quadraticCurveTo(ex + 6, ey - 3, ex + 2, ey + 1); ctx.fill();
      ctx.restore();
    }
  }
  // The cracks.
  ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 1.8, y - 2.6); ctx.lineTo(x - 1.2, y - 6); ctx.lineTo(x - 2.4, y - 9); ctx.lineTo(x - 1.6, y - hr * 1.08);
  ctx.moveTo(x + 6.8, y + 5.1); ctx.lineTo(x + 7.6, y + 8); ctx.lineTo(x + 6.6, y + 10.5); ctx.lineTo(x + 7.2, y + hr * 0.96);
  ctx.stroke();
  // Mouth: a flat line at rest, a thin knowing grin when he means it.
  ctx.strokeStyle = '#2a2a33'; ctx.lineWidth = 1.1;
  ctx.beginPath();
  if (grin) { ctx.moveTo(x + 0.5, y + 7.4); ctx.quadraticCurveTo(x + 4.5, y + 10.2, x + 9.2, y + 6.6); }
  else if (hurt) { ctx.ellipse(x + 4.5, y + 8.2, 1.8, 1.2, 0, 0, TAU); }
  else { ctx.moveTo(x + 1.8, y + 8); ctx.lineTo(x + 7.6, y + 7.8); }
  ctx.stroke();
}

/**
 * The whole figure. Returns the tip the engine tracks for trails: the lead
 * floating hand, since that is what is actually doing the hitting.
 */
export function drawGasterBody(ctx: CanvasRenderingContext2D, k: Skeleton): [number, number] | null {
  const { f, pose, time, hx, hy, neck, sh, head, elF, haF, elB, haB, kneeF, footF, kneeB, footB, B } = k;
  const aw = !!f.awakened || f.state === 'attack' && f.move?.ability === 'awaken';
  const power = aw ? 1 : 0;
  const fwd = (f.vx || 0) * (f.facing || 1);
  const flow = clamp(fwd * 1.6 + (f.grounded ? 0 : -(f.vy || 0) * 0.6) + Math.sin(time * 0.09) * 1.5, -8, 22);
  const hemY = hy + 34 * B.torso;
  const hs = updateHands(k);
  const sink = f.state === 'attack' ? clamp(f.gasterSink || 0, 0, 1) : 0;

  ctx.save();
  if (sink > 0) {
    // Sinking into (or rising out of) a void rift: the body slides below the
    // floor line and everything under it is clipped away.
    ctx.beginPath(); ctx.rect(-200, -400, 400, 400); ctx.clip();
    ctx.translate(0, sink * 96);
  }

  // ---- aura / awakening backdrop ----
  if (aw) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = time * 0.02 + i * TAU / 7;
      const g = ctx.createRadialGradient(Math.cos(a) * 16, hy - 30 + Math.sin(a) * 12, 2, Math.cos(a) * 16, hy - 30 + Math.sin(a) * 12, 70);
      g.addColorStop(0, hexA(SOUL(i), 0.16)); g.addColorStop(1, hexA(SOUL(i), 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Math.cos(a) * 16, hy - 30 + Math.sin(a) * 12, 70, 0, TAU); ctx.fill();
    }
    ctx.restore();
    const m = f.state === 'attack' ? f.move : null;
    const active = m?.soulAll ? [3, 4, 5, 0, 1, 6, 2][Math.floor((f.moveFrame || 0) / 3) % 7] : m?.soul;
    drawSoulFan(ctx, k, active, hs, power);
  } else {
    // A faint void haze that thickens while he casts.
    const casting = f.state === 'attack' ? 1 : 0.35;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, hy - 18, 2, 0, hy - 18, 58);
    g.addColorStop(0, hexA(VOID_VIOLET, 0.12 * casting)); g.addColorStop(1, hexA(VOID_VIOLET, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, hy - 18, 58, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---- back floating hand ----
  // Awakened, the seven SOUL hands take over; the bone pair is folded away.
  if (!aw) drawHand(ctx, hs.bx, hs.by, 9.5, hs.ba, { grip: hs.bg, col: BONE, glow: VOID_VIOLET, alpha: 0.96, mirror: true });

  // ---- coat back, back arm, back leg ----
  drawCoatBack(ctx, k, hemY, flow, aw);
  sleeve(ctx, sh, elB, haB, 7.4 * B.limb, shade(COAT, 0.8));
  drawHand(ctx, haB[0], haB[1], 4.2, Math.atan2(haB[1] - elB[1], haB[0] - elB[0]) + Math.PI / 2, { grip: 0.6 });
  leg(ctx, [hx - 2, hy], kneeB, footB, 7.6 * B.limb, shade(aw ? PANTS_AW : PANTS, 0.82));

  // ---- torso: ribbed turtleneck ----
  const tw = 8.2 * B.chest;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hx - tw, hy + 2);
  ctx.quadraticCurveTo(hx - tw - 1, (hy + sh[1]) / 2, sh[0] - 10, sh[1] + 1);
  ctx.quadraticCurveTo(neck[0], neck[1] - 3, sh[0] + 10, sh[1] + 1);
  ctx.quadraticCurveTo(hx + tw + 1, (hy + sh[1]) / 2, hx + tw, hy + 2);
  ctx.closePath();
  const tg = ctx.createLinearGradient(hx - tw, hy, hx + tw, sh[1]);
  const tc = aw ? TURTLE_AW : TURTLE;
  tg.addColorStop(0, shade(tc, 0.7)); tg.addColorStop(0.6, tc); tg.addColorStop(1, tint(tc, 1.12));
  ctx.fillStyle = tg; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = aw ? 'rgba(120,100,70,.35)' : 'rgba(0,0,0,.28)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(hx + i * 2.6, sh[1] - 2); ctx.quadraticCurveTo(hx + i * 2.9, (hy + sh[1]) / 2, hx + i * 2.5, hy + 4); ctx.stroke();
  }
  ctx.restore();

  // ---- front leg ----
  leg(ctx, [hx, hy], kneeF, footF, 7.8 * B.limb, aw ? PANTS_AW : PANTS);

  // ---- coat front panel + collar ----
  drawCoatFront(ctx, k, hemY, flow, aw);

  // ---- neck: the turtleneck's tall rolled collar ----
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(neck[0], neck[1] + 2); ctx.lineTo(head[0] + 0.5, head[1] + 9); ctx.stroke();
  ctx.strokeStyle = aw ? TURTLE_AW : TURTLE; ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(neck[0] - 4, neck[1] - i * 2.4); ctx.lineTo(neck[0] + 4, neck[1] - i * 2.4 - 0.6); ctx.stroke(); }
  ctx.restore();

  // ---- head ----
  drawHead(ctx, k, aw);

  // ---- front arm ----
  sleeve(ctx, sh, elF, haF, 7.8 * B.limb, COAT);
  drawHand(ctx, haF[0], haF[1], 4.6, Math.atan2(haF[1] - elF[1], haF[0] - elF[0]) + Math.PI / 2, { grip: f.state === 'attack' ? 0.2 : 0.55 });

  // ---- front floating hand ----
  if (!aw) drawHand(ctx, hs.fx, hs.fy, 10, hs.fa, { grip: hs.fg, col: BONE, glow: VOID_VIOLET, alpha: 0.98 });

  // ---- glitch tearing ----
  const glitchy = aw ? 1 : (f.state === 'attack' && (f.moveFrame || 0) % 11 < 3 ? 0.55 : hash(Math.floor(time / 4)) > 0.93 ? 0.4 : 0);
  if (glitchy > 0) {
    const cols = aw ? ['#ffffff', '#ffffff', SOUL(Math.floor(time / 7)), '#ffffff', SOUL(Math.floor(time / 11) + 3)] : ['#ffffff', '#e8e8ff', '#b8b0ff'];
    drawGlitch(ctx, 0, hy - 20, aw ? 150 : 90, aw ? 150 : 110, time, aw ? 13 : 8, cols, glitchy * 0.85, f.idx || 0);
  }
  ctx.restore();

  // Void ripple on the floor while sinking.
  if (sink > 0) {
    ctx.save();
    ctx.fillStyle = VOID_BLACK;
    ctx.beginPath(); ctx.ellipse(0, 0, 30 + sink * 12, 5 + sink * 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA(VOID_VIOLET, 0.8); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  void pose;
  return [hs.fx, hs.fy];
}

registerBody('gaster', drawGasterBody);
