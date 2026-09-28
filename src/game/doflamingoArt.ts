/**
 * DONQUIXOTE DOFLAMINGO — ART
 *
 * Drawn from scratch on the shared skeleton so the silhouette is unmistakable
 * at a glance, at any zoom:
 *
 *  - the enormous pink feather coat worn over the shoulders like a mantle, with a
 *    fluffed collar that swallows the neck and tails that reach the knees
 *  - white-framed shades with warm red lenses, and the permanent wide grin
 *  - short cropped blond hair
 *  - an open, pin-striped shirt over a bare chest, and orange-striped three-
 *    quarter trousers over long bare shins and pointed shoes
 *  - thin threads trailing from his fingertips; while he attacks they run from
 *    every finger to whatever he is cutting
 *
 * Awakened, the feathers flare, the threads light up, and the floor under him
 * becomes a churn of white string.
 *
 * `f.stringClone` draws the Black Knight: the same figure woven out of string.
 */
import { OL, hexA, shade, tint, registerBody, type Skeleton } from './render';

export const PINK = '#ff4fa3';
export const PINK_HI = '#ffb3d6';
export const PINK_LO = '#b8286a';
export const THREAD = '#f7f3ff';
export const HEAT = '#ff5a1f';
const SKIN = '#e7b286';
const HAIR = '#f4d046';
const SHIRT = '#f6f2e6';
const STRIPE = '#6f9fd8';
const PANTS = '#f2a53a';
const PANTS_STRIPE = '#c8621c';
const SHOE = '#efe6d2';
const LENS = '#ff4a3a';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A white string with a faint glow. */
export function thread(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col = THREAD, w = 1.2, sag = 0, glow = 0.35) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
  if (glow > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(col[0] === '#' ? col : '#ffffff', glow); ctx.lineWidth = w * 3.4;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
}

/** A run of feather puffs along a path: the fluffed edge of the coat. */
function featherEdge(ctx: CanvasRenderingContext2D, pts: [number, number][], r: number, c: string, time: number, jitter = 1, rim = PINK) {
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(len / (r * 0.9)));
    for (let k = 0; k < n; k++) {
      const u = k / n, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u;
      puffs.push([x, y, r * (0.85 + 0.3 * Math.sin(i * 3.1 + k * 1.7)) + Math.sin(time * 0.2 + i + k) * 0.4 * jitter]);
    }
  }
  // Outline, body, then a soft highlight: one continuous fluffy trim.
  ctx.fillStyle = OL;
  for (const [x, y, rr] of puffs) { ctx.beginPath(); ctx.arc(x, y, rr + 1.3, 0, TAU); ctx.fill(); }
  ctx.fillStyle = rim;
  for (const [x, y, rr] of puffs) { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
  ctx.fillStyle = c;
  for (const [x, y, rr] of puffs) { ctx.beginPath(); ctx.arc(x - rr * 0.2, y - rr * 0.25, rr * 0.55, 0, TAU); ctx.fill(); }
}

function coatPath(ctx: CanvasRenderingContext2D, sh: [number, number], hemY: number, flow: number, wave: number, flare: number) {
  ctx.beginPath();
  ctx.moveTo(sh[0] + 13 + flare * 0.3, sh[1] - 2);
  ctx.quadraticCurveTo(sh[0] + 24 + flare, (sh[1] + hemY) * 0.5, sh[0] + 19 - flow * 0.2 + flare, hemY);
  ctx.quadraticCurveTo(sh[0] - 4 - flow * 0.6, hemY + 7 + wave, sh[0] - 30 - flow * 1.3 - flare, hemY + 1 + wave);
  ctx.quadraticCurveTo(sh[0] - 30 - flow * 0.7 - flare, (sh[1] + hemY) * 0.5, sh[0] - 15, sh[1] - 3);
  ctx.quadraticCurveTo(sh[0], sh[1] - 8, sh[0] + 13 + flare * 0.3, sh[1] - 2);
  ctx.closePath();
}

function drawCoatBack(ctx: CanvasRenderingContext2D, k: Skeleton, hemY: number, flow: number, flare: number, pal: Palette) {
  const { sh, time } = k;
  const wave = Math.sin(time * 0.14) * 2.5;
  ctx.save();
  coatPath(ctx, sh, hemY, flow, wave, flare);
  const g = ctx.createLinearGradient(sh[0] - 30, sh[1], sh[0] + 20, hemY);
  g.addColorStop(0, pal.pinkHi); g.addColorStop(0.35, pal.pink); g.addColorStop(1, pal.pinkLo);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = OL; ctx.stroke();
  // Feather striations.
  ctx.clip();
  ctx.strokeStyle = hexA('#ffffff', 0.18); ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const x = sh[0] - 26 + i * 5.5 - flow * 0.5;
    ctx.beginPath(); ctx.moveTo(x + 4, sh[1] + 6); ctx.quadraticCurveTo(x - 2, (sh[1] + hemY) * 0.6, x - 4 - flow * 0.4, hemY + 4); ctx.stroke();
  }
  ctx.restore();
  // Fluffed hem.
  featherEdge(ctx, [[sh[0] + 19 - flow * 0.2 + flare, hemY], [sh[0] - 4 - flow * 0.6, hemY + 6 + wave], [sh[0] - 30 - flow * 1.3 - flare, hemY + 1 + wave]], 4.2, pal.pinkHi, time, 1, pal.pink);
}

function drawCollar(ctx: CanvasRenderingContext2D, k: Skeleton, flare: number, pal: Palette) {
  const { sh, neck, time } = k;
  // The mantle's fluffed collar: a heavy ring of plumes across both shoulders
  // and up behind the jaw. This is the shape people recognise him by.
  const puffs: [number, number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, a = Math.PI * (0.92 + u * 1.2);
    const r = 15 + flare * 0.4 + Math.sin(i * 2.3) * 2;
    puffs.push([neck[0] - 2 + Math.cos(a) * r * 1.2, sh[1] + 5 + Math.sin(a) * r * 0.55, 6 + Math.sin(i * 1.7) * 1.3 + flare * 0.12]);
  }
  ctx.save();
  // Outline pass, then fill, then highlights: reads as one fluffy mass.
  ctx.fillStyle = OL;
  for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, TAU); ctx.fill(); }
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0.5, x, y, r);
    g.addColorStop(0, pal.pinkHi); g.addColorStop(0.6, pal.pink); g.addColorStop(1, pal.pinkLo);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = hexA('#ffffff', 0.35);
  for (let i = 0; i < puffs.length; i += 2) { const [x, y, r] = puffs[i]; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.45 + Math.sin(time * 0.1 + i) * 0.3, r * 0.3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/** The near half of the mantle, hanging open down the front of his body. */
function drawCoatFront(ctx: CanvasRenderingContext2D, k: Skeleton, hemY: number, flow: number, flare: number, pal: Palette) {
  const { sh, hx, time } = k;
  const wave = Math.sin(time * 0.15 + 1) * 1.5;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sh[0] + 6, sh[1] + 2);
  ctx.quadraticCurveTo(sh[0] + 17 + flare * 0.6, sh[1] + 10, hx + 15 + flare * 0.6 - flow * 0.1, hemY - 4 + wave);
  ctx.lineTo(hx + 6 - flow * 0.2, hemY + wave);
  ctx.quadraticCurveTo(hx + 7, (sh[1] + hemY) * 0.5, sh[0] + 3, sh[1] + 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(sh[0], sh[1], hx + 12, hemY);
  g.addColorStop(0, pal.pinkHi); g.addColorStop(0.4, pal.pink); g.addColorStop(1, pal.pinkLo);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = hexA('#ffffff', 0.22); ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sh[0] + 7 + i * 3, sh[1] + 8); ctx.quadraticCurveTo(hx + 9 + i * 2, (sh[1] + hemY) * 0.55, hx + 8 + i * 3 - flow * 0.15, hemY); ctx.stroke(); }
  ctx.restore();
  featherEdge(ctx, [[sh[0] + 14 + flare * 0.5, sh[1] + 12], [hx + 15 + flare * 0.6 - flow * 0.1, hemY - 4 + wave], [hx + 6 - flow * 0.2, hemY + wave]], 4, pal.pinkHi, time, 1, pal.pink);
}

function limb2(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], w: number, c1: string, c2: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = w + 3.4;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = c1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(1, w * 0.28);
  ctx.beginPath(); ctx.moveTo(a[0], a[1] - w * 0.22); ctx.lineTo(b[0], b[1] - w * 0.22); ctx.lineTo(c[0], c[1] - w * 0.22); ctx.stroke();
}

/** Trousers to mid-shin with vertical stripes, bare shin below, pointed shoe. */
function drawLeg(ctx: CanvasRenderingContext2D, hip: [number, number], knee: [number, number], foot: [number, number], w: number, pal: Palette, back: boolean) {
  const cuff: [number, number] = [knee[0] + (foot[0] - knee[0]) * 0.42, knee[1] + (foot[1] - knee[1]) * 0.42];
  const pc = back ? shade(pal.pants, 0.82) : pal.pants;
  const sc = back ? shade(pal.skin, 0.85) : pal.skin;
  // Shin first (under the trouser cuff).
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = w * 0.72 + 3.2;
  ctx.beginPath(); ctx.moveTo(cuff[0], cuff[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
  ctx.strokeStyle = sc; ctx.lineWidth = w * 0.72;
  ctx.beginPath(); ctx.moveTo(cuff[0], cuff[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
  // Trousers.
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = w + 3.6;
  ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(cuff[0], cuff[1]); ctx.stroke();
  ctx.strokeStyle = pc; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(cuff[0], cuff[1]); ctx.stroke();
  ctx.strokeStyle = back ? shade(PANTS_STRIPE, 0.8) : PANTS_STRIPE; ctx.lineWidth = 1.1;
  for (const off of [-w * 0.24, w * 0.18]) {
    const n1 = norm(hip, knee), n2 = norm(knee, cuff);
    ctx.beginPath();
    ctx.moveTo(hip[0] + n1[0] * off, hip[1] + n1[1] * off);
    ctx.lineTo(knee[0] + (n1[0] + n2[0]) * 0.5 * off, knee[1] + (n1[1] + n2[1]) * 0.5 * off);
    ctx.lineTo(cuff[0] + n2[0] * off, cuff[1] + n2[1] * off);
    ctx.stroke();
  }
  // Rolled cuff.
  const a = Math.atan2(cuff[1] - knee[1], cuff[0] - knee[0]);
  ctx.save(); ctx.translate(cuff[0], cuff[1]); ctx.rotate(a);
  ctx.fillStyle = shade(pc, 0.9); ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(-2, -w * 0.62, 4, w * 1.24); ctx.fill(); ctx.stroke();
  ctx.restore();
  // Pointed shoe.
  ctx.fillStyle = back ? shade(SHOE, 0.85) : SHOE; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(foot[0] - 4, foot[1] - 3.5);
  ctx.quadraticCurveTo(foot[0] + 7, foot[1] - 5, foot[0] + 13, foot[1] + 0.5);
  ctx.lineTo(foot[0] - 4, foot[1] + 1.8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function norm(a: [number, number], b: [number, number]): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [-dy / L, dx / L];
}

/** An open hand with the fingers splayed - the puppeteer's hand. Returns fingertips. */
function drawPuppetHand(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number, skin: string, curl: number): [number, number][] {
  const tips: [number, number][] = [];
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.lineCap = 'round';
  const fingers = [-0.55, -0.2, 0.15, 0.48];
  const loc: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const a = fingers[i] * 0.9, L = s * (1.25 - Math.abs(fingers[i]) * 0.3);
    const mx = Math.sin(a) * L * 0.55, my = -Math.cos(a) * L * 0.55;
    const a2 = a + curl * 1.2;
    const tx = mx + Math.sin(a2) * L * 0.5, ty = my - Math.cos(a2) * L * 0.5;
    ctx.strokeStyle = OL; ctx.lineWidth = s * 0.42 + 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = s * 0.42;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
    loc.push([tx, ty]);
  }
  ctx.fillStyle = skin; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.62, s * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  const c = Math.cos(ang), sn = Math.sin(ang);
  for (const [lx, ly] of loc) tips.push([x + lx * c - ly * sn, y + lx * sn + ly * c]);
  return tips;
}

function drawHead(ctx: CanvasRenderingContext2D, k: Skeleton, pal: Palette, aw: boolean) {
  const { f, head, time, B } = k;
  const hr = 12.4 * B.head;
  const x = head[0], y = head[1] - 1;
  const hurt = f.state === 'hitstun';
  // Long face, strong jaw.
  const face = () => {
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.92, y - hr * 0.2);
    ctx.bezierCurveTo(x - hr * 0.95, y - hr * 1.02, x + hr * 0.7, y - hr * 1.12, x + hr * 0.95, y - hr * 0.3);
    ctx.bezierCurveTo(x + hr * 1.05, y + hr * 0.4, x + hr * 0.95, y + hr * 0.95, x + hr * 0.45, y + hr * 1.12);
    ctx.lineTo(x - hr * 0.2, y + hr * 1.08);
    ctx.bezierCurveTo(x - hr * 0.7, y + hr * 0.85, x - hr * 0.9, y + hr * 0.3, x - hr * 0.92, y - hr * 0.2);
    ctx.closePath();
  };
  face();
  const g = ctx.createRadialGradient(x + 3, y - 4, 1, x, y, hr * 1.3);
  g.addColorStop(0, tint(pal.skin, 1.08)); g.addColorStop(1, shade(pal.skin, 0.84));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.4; ctx.stroke();
  // Ear.
  ctx.fillStyle = shade(pal.skin, 0.92); ctx.beginPath(); ctx.ellipse(x - hr * 0.55, y + 1, 2.4, 3.6, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  // Short cropped blond hair: a flat-topped cap with a clipped fringe.
  ctx.beginPath();
  ctx.moveTo(x - hr * 0.96, y - hr * 0.02);
  ctx.quadraticCurveTo(x - hr * 1.08, y - hr * 0.8, x - hr * 0.8, y - hr * 1.05);
  // Short blond spikes brushed up and back across the crown.
  const spikes = 4;
  for (let i = 0; i <= spikes; i++) {
    const u = i / spikes;
    const bx = x - hr * 0.8 + u * hr * 1.72;
    const by = y - hr * (1.02 + Math.sin(u * Math.PI) * 0.1);
    ctx.lineTo(bx - hr * 0.16, by - hr * (0.2 + (i % 2) * 0.06));
    if (i < spikes) ctx.lineTo(bx + hr * 0.14, by + hr * 0.04);
  }
  ctx.lineTo(x + hr * 0.98, y - hr * 0.62);
  // A clipped fringe at the brow, then back over the temple.
  ctx.lineTo(x + hr * 0.7, y - hr * 0.5);
  ctx.lineTo(x + hr * 0.5, y - hr * 0.62);
  ctx.lineTo(x + hr * 0.25, y - hr * 0.48);
  ctx.lineTo(x, y - hr * 0.6);
  ctx.quadraticCurveTo(x - hr * 0.45, y - hr * 0.45, x - hr * 0.52, y - hr * 0.05);
  ctx.closePath();
  const hg = ctx.createLinearGradient(x, y - hr * 1.4, x, y - hr * 0.3);
  hg.addColorStop(0, tint(pal.hair, 1.12)); hg.addColorStop(1, shade(pal.hair, 0.8));
  ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - hr * 0.6, y - hr * 1.02); ctx.quadraticCurveTo(x, y - hr * 1.14, x + hr * 0.5, y - hr * 1.0); ctx.stroke();

  // Shades: white frame, warm red lens, a hard specular slash.
  const lx = x + hr * 0.18, ly = y - hr * 0.08;
  ctx.fillStyle = pal.frame; ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - hr * 0.62, ly - 1.6); ctx.lineTo(lx - 5, ly - 2.4); ctx.lineTo(lx - 5, ly - 0.6); ctx.lineTo(x - hr * 0.62, ly + 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  const lens = (cx: number, w: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - w, ly - 3.6);
    ctx.lineTo(cx + w, ly - 3.9);
    ctx.quadraticCurveTo(cx + w + 0.6, ly + 2.4, cx + w * 0.2, ly + 3.4);
    ctx.quadraticCurveTo(cx - w, ly + 3.2, cx - w, ly - 3.6);
    ctx.closePath();
  };
  for (const [cx, w] of [[lx, 4.6], [lx + 9.6, 3.6]] as [number, number][]) {
    lens(cx, w);
    ctx.fillStyle = pal.frame; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.save(); lens(cx, w - 1); ctx.clip();
    const lg = ctx.createLinearGradient(cx, ly - 4, cx, ly + 4);
    lg.addColorStop(0, shade(pal.lens, 0.7)); lg.addColorStop(1, tint(pal.lens, 1.2));
    ctx.fillStyle = lg; ctx.fillRect(cx - w - 2, ly - 6, w * 2 + 4, 12);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - w, ly - 3.5, w * 0.6, 7);
    ctx.restore();
  }
  // Bridge.
  ctx.strokeStyle = pal.frame; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(lx + 4.4, ly - 2); ctx.lineTo(lx + 6.2, ly - 2); ctx.stroke();
  if (aw) {
    // A glint travels across the lenses while awakened.
    const gx = lx - 4 + ((time * 0.8) % 30);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(gx, ly - 4); ctx.lineTo(gx + 2, ly - 4); ctx.lineTo(gx - 1, ly + 4); ctx.lineTo(gx - 3, ly + 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // The vein at the temple.
    ctx.strokeStyle = '#b3313a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - hr * 0.2, y - hr * 0.75); ctx.lineTo(x - hr * 0.05, y - hr * 0.6); ctx.lineTo(x - hr * 0.25, y - hr * 0.5); ctx.stroke();
  }
  // Mouth: the grin, nearly always on. It only drops when he is hurt.
  const my = y + hr * 0.5;
  if (hurt) {
    ctx.fillStyle = '#3a1016'; ctx.beginPath(); ctx.ellipse(x + hr * 0.45, my + 1, 3, 2, 0, 0, TAU); ctx.fill();
  } else {
    const wide = f.state === 'attack' || aw ? 1.15 : 1;
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.08, my - 1.4);
    ctx.quadraticCurveTo(x + hr * 0.45, my + 1.2 * wide, x + hr * 0.98, my - 2.6);
    ctx.quadraticCurveTo(x + hr * 0.5, my + 5.4 * wide, x - hr * 0.08, my - 1.4);
    ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();
    // Tooth line: one clean seam between the rows, and two faint gaps.
    ctx.strokeStyle = 'rgba(60,40,40,.45)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x, my - 0.4); ctx.quadraticCurveTo(x + hr * 0.45, my + 1.8 * wide, x + hr * 0.9, my - 1.8); ctx.stroke();
    for (const u of [0.35, 0.62]) { const tx = x + hr * u; ctx.beginPath(); ctx.moveTo(tx, my - 0.6); ctx.lineTo(tx, my + 1.4 * wide); ctx.stroke(); }
    // Smile creases.
    ctx.strokeStyle = 'rgba(80,40,30,.45)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + hr * 1.0, my - 4); ctx.quadraticCurveTo(x + hr * 1.08, my - 1.5, x + hr * 0.96, my + 0.8); ctx.stroke();
  }
}

interface Palette { pink: string; pinkHi: string; pinkLo: string; skin: string; hair: string; shirt: string; stripe: string; pants: string; lens: string; frame: string }
const NORMAL: Palette = { pink: PINK, pinkHi: PINK_HI, pinkLo: PINK_LO, skin: SKIN, hair: HAIR, shirt: SHIRT, stripe: STRIPE, pants: PANTS, lens: LENS, frame: '#ffffff' };
/** The Black Knight: the same man, woven out of white string. */
const CLONE: Palette = { pink: '#e9e4f2', pinkHi: '#ffffff', pinkLo: '#a8a2bb', skin: '#e6e2ef', hair: '#f4f1fb', shirt: '#ffffff', stripe: '#b7b1c8', pants: '#d8d3e3', lens: '#8d86a3', frame: '#ffffff' };

export function drawDoflamingoBody(ctx: CanvasRenderingContext2D, k: Skeleton): [number, number] | null {
  const { f, time, hx, hy, neck, sh, head, elF, haF, elB, haB, kneeF, footF, kneeB, footB, B } = k;
  const clone = !!f.stringClone;
  const pal = clone ? CLONE : NORMAL;
  const aw = !clone && (!!f.awakened || (f.state === 'attack' && f.move?.ability === 'awaken'));
  const attacking = f.state === 'attack';
  const fwd = (f.vx || 0) * (f.facing || 1);
  const flow = clamp(fwd * 1.8 + (f.grounded ? 0 : -(f.vy || 0) * 0.7) + Math.sin(time * 0.08) * 1.4, -8, 24);
  const flare = aw ? 5 + Math.sin(time * 0.2) * 1.5 : attacking ? 2 : 0;
  const hemY = hy + 30 * B.torso;

  ctx.save();
  if (clone) ctx.globalAlpha *= 0.9;

  // ---- awakened: the floor turning to string under him ----
  if (aw) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const x0 = -70 + i * 10 + Math.sin(time * 0.1 + i) * 4;
      const h = 14 + Math.sin(time * 0.18 + i * 1.3) * 8 + (i % 3) * 4;
      ctx.strokeStyle = hexA(THREAD, 0.55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, 2); ctx.quadraticCurveTo(x0 + 6, -h * 0.6, x0 + 3 + Math.sin(time * 0.2 + i) * 5, -h); ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 80);
    g.addColorStop(0, hexA(PINK, 0.28)); g.addColorStop(1, hexA(PINK, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -2, 80, 18, 0, 0, TAU); ctx.fill();
    // Threads rising off his shoulders into the sky.
    for (let i = 0; i < 5; i++) {
      const sx = sh[0] - 10 + i * 5;
      thread(ctx, sx, sh[1] - 4, sx - 20 + i * 12 + Math.sin(time * 0.05 + i) * 6, sh[1] - 180, THREAD, 0.8, 0, 0.25);
    }
    ctx.restore();
  }

  // ---- coat, back arm, back leg ----
  drawCoatBack(ctx, k, hemY, flow, flare, pal);
  limb2(ctx, sh, elB, haB, 6.6 * B.limb, shade(pal.shirt, 0.82), shade(pal.skin, 0.86));
  drawPuppetHand(ctx, haB[0], haB[1], Math.atan2(haB[1] - elB[1], haB[0] - elB[0]) + Math.PI / 2, 3.2, shade(pal.skin, 0.86), attacking ? 0.1 : 0.4);
  drawLeg(ctx, [hx - 2, hy], kneeB, footB, 7.4 * B.limb, pal, true);

  // ---- torso: open striped shirt over a bare chest ----
  const tw = 8 * B.chest;
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(hx - tw, hy + 2);
    ctx.quadraticCurveTo(hx - tw - 1.5, (hy + sh[1]) / 2, sh[0] - 11, sh[1] + 1);
    ctx.quadraticCurveTo(neck[0], neck[1] - 3, sh[0] + 11, sh[1] + 1);
    ctx.quadraticCurveTo(hx + tw + 1.5, (hy + sh[1]) / 2, hx + tw, hy + 2);
    ctx.closePath();
  };
  torso();
  ctx.fillStyle = pal.shirt; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.save(); torso(); ctx.clip();
  ctx.strokeStyle = hexA(pal.stripe, 0.8); ctx.lineWidth = 0.9;
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(hx + i * 2.4, sh[1] - 4); ctx.lineTo(hx + i * 2.4 + 1, hy + 4); ctx.stroke(); }
  // The open V showing chest down to the belt.
  ctx.beginPath();
  ctx.moveTo(sh[0] - 2, sh[1] - 2); ctx.lineTo(sh[0] + 7, sh[1] - 1);
  ctx.lineTo(hx + 4, hy - 2); ctx.lineTo(hx - 1, hy - 1);
  ctx.closePath();
  const cg = ctx.createLinearGradient(hx, sh[1], hx, hy);
  cg.addColorStop(0, tint(pal.skin, 1.05)); cg.addColorStop(1, shade(pal.skin, 0.85));
  ctx.fillStyle = cg; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sh[0] + 2, sh[1] + 5); ctx.quadraticCurveTo(sh[0] + 6, sh[1] + 8, sh[0] + 7, sh[1] + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 1.5, sh[1] + 10); ctx.lineTo(hx + 2, hy - 3); ctx.stroke();
  ctx.restore();
  // Belt.
  ctx.fillStyle = '#3b2a22'; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(hx - tw, hy - 2, tw * 2, 4.5, 1.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8c35a'; ctx.fillRect(hx + 1, hy - 1.5, 3, 3.4);

  // ---- front leg ----
  drawLeg(ctx, [hx, hy], kneeF, footF, 7.8 * B.limb, pal, false);

  // ---- collar plumes, neck, head ----
  ctx.strokeStyle = OL; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(neck[0], neck[1] + 1); ctx.lineTo(head[0], head[1] + 8); ctx.stroke();
  ctx.strokeStyle = shade(pal.skin, 0.9); ctx.lineWidth = 5; ctx.stroke();
  drawCollar(ctx, k, flare, pal);
  drawHead(ctx, k, pal, aw);
  drawCoatFront(ctx, k, hemY, flow, flare, pal);

  // ---- front arm ----
  limb2(ctx, sh, elF, haF, 6.8 * B.limb, pal.shirt, pal.skin);
  // Rolled sleeve band at the elbow.
  ctx.save(); ctx.translate(elF[0], elF[1]); ctx.rotate(Math.atan2(haF[1] - elF[1], haF[0] - elF[0]));
  ctx.fillStyle = pal.shirt; ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.rect(-1.5, -4.6, 3.6, 9.2); ctx.fill(); ctx.stroke();
  ctx.restore();
  const handAng = Math.atan2(haF[1] - elF[1], haF[0] - elF[0]) + Math.PI / 2;
  const tips = drawPuppetHand(ctx, haF[0], haF[1], handAng, 3.6, pal.skin, attacking ? 0 : 0.45);

  // ---- threads from the fingertips ----
  const m = attacking ? f.move : null;
  const fr = f.moveFrame || 0;
  const s = f.scale || 1;
  let live: any = null;
  if (m) for (const h of m.hits || []) if (fr >= h.f[0] - 2 && fr <= h.f[1] + 2) { live = h; break; }
  ctx.save();
  if (live && m.threads !== false) {
    // Every finger runs a line to the thing being cut.
    const tx = live.x / s, ty = live.y / s, sp = Math.max(8, live.h / s * 0.4);
    tips.forEach(([x, y], i) => thread(ctx, x, y, tx + (Math.sin(i * 2.1 + fr) * 6), ty + (i - 1.5) * sp * 0.4, m.heat ? HEAT : THREAD, m.heat ? 1.8 : 1.1, 4, aw ? 0.5 : 0.35));
  } else {
    // At rest a few loose threads drift off his fingers.
    const n = aw ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const [x, y] = tips[i];
      thread(ctx, x, y, x + 10 + i * 5 + Math.sin(time * 0.07 + i) * 5, y + 16 + i * 5, THREAD, 0.7, 3, 0.15 + (aw ? 0.2 : 0));
    }
  }
  ctx.restore();

  if (clone) {
    // String weave over the whole figure.
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.6;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 5, hy + 40); ctx.lineTo(-8 + i * 5, head[1] - 20); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  return [haF[0] + Math.sin(handAng) * 8, haF[1] - Math.cos(handAng) * 8];
}

registerBody('doflamingo', drawDoflamingoBody);
