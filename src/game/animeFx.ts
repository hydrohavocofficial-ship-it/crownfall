// Anime-accurate melee hit effects. Each fighter's attacks read like their show:
// Levi's twin steel crescents, Zoro's three green cuts, Tanjiro's ukiyo-e water,
// Rengoku's roaring flame arcs, Ichigo's black-and-red Getsuga edge, Killua's
// crackling blue Nen, Goku's golden ki flashes, Saitama's plain devastating punch.

export type SwingStyle = 'blade' | 'blade3' | 'water' | 'flame' | 'dark' | 'lightning' | 'impact' | 'ki' | 'saw' | 'ice' | 'rubber' | 'cursed' | 'steam' | 'susanoo' | 'infinity';
export interface SwingProfile { style: SwingStyle; col: string; col2: string; }

export const SWING_PROFILES: Record<string, SwingProfile> = {
  levi: { style: 'blade', col: '#dfe8f0', col2: '#8fb6d6' },
  zoro: { style: 'blade3', col: '#eafff0', col2: '#2fbf5a' },
  tanjiro: { style: 'water', col: '#2f8fff', col2: '#d8f2ff' },
  rengoku: { style: 'flame', col: '#ff6a12', col2: '#ffd84a' },
  ichigo: { style: 'dark', col: '#0a0810', col2: '#ff2a44' },
  asta: { style: 'dark', col: '#0c0c0c', col2: '#6b6b6b' },
  madara: { style: 'susanoo', col: '#3d6bff', col2: '#bcd0ff' },
  denji: { style: 'saw', col: '#ff8a2a', col2: '#c0102a' },
  killua: { style: 'lightning', col: '#8fd8ff', col2: '#ffffff' },
  sasuke: { style: 'lightning', col: '#6fa8ff', col2: '#d6c2ff' },
  goku: { style: 'ki', col: '#ffd24a', col2: '#fff6c8' },
  naruto: { style: 'ki', col: '#ff9a2a', col2: '#8fd8ff' },
  saitama: { style: 'impact', col: '#ffffff', col2: '#ffd84a' },
  deku: { style: 'lightning', col: '#3aff8a', col2: '#e4fff0' },
  luffy: { style: 'rubber', col: '#ff3a3a', col2: '#ffe0b0' },
  yuji: { style: 'cursed', col: '#3a8bff', col2: '#ff2a4a' },
  eren: { style: 'steam', col: '#ffe6c8', col2: '#9fd8ff' },
  todoroki: { style: 'ice', col: '#9ee8ff', col2: '#ff7a3a' },
  gojo: { style: 'infinity', col: '#5fd2ff', col2: '#c688ee' },
  shadowdio: { style: 'impact', col: '#8affd0', col2: '#ffe45c' },
};

/** Styles that draw a weapon crescent rather than a fist impact. */
export const ARC_STYLES: SwingStyle[] = ['blade', 'blade3', 'water', 'flame', 'dark', 'susanoo', 'saw', 'ice'];

export interface Swing { x: number; y: number; r: number; a0: number; a1: number; life: number; max: number; p: SwingProfile; seed: number; thick: number; }

const TAU = Math.PI * 2;
const R = Math.random;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const easeOut = (n: number) => 1 - Math.pow(1 - clamp(n), 3);

/** Sweep angles by animation, in local (facing-right) space. */
export function swingArc(anim: string | undefined): [number, number] {
  const a = anim || '';
  if (/upslash|uppercut|rise|castUp/.test(a)) return [1.2, -1.7];
  if (/dive|slam|dkick|backslash/.test(a)) return [-1.6, 1.1];
  if (/sweep|lowslash/.test(a)) return [-.3, .55];
  if (/spin|flip/.test(a)) return [-2.6, 2.6];
  if (/thrust|punch|kick|cast|counter/.test(a)) return [-.35, .35];
  return [-1.5, .9];
}

function crescent(c: CanvasRenderingContext2D, r: number, a0: number, a1: number, w: number) {
  // Filled smear from tail (a0) to leading edge (a1), thickest at the head.
  const n = 22, outer: [number, number][] = [], inner: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + (a1 - a0) * u, t = Math.pow(u, .8) * w;
    outer.push([Math.cos(a) * r, Math.sin(a) * r]); inner.push([Math.cos(a) * (r - t), Math.sin(a) * (r - t)]);
  }
  c.beginPath(); c.moveTo(outer[0][0], outer[0][1]);
  for (const p of outer) c.lineTo(p[0], p[1]);
  for (let i = inner.length - 1; i >= 0; i--) c.lineTo(inner[i][0], inner[i][1]);
  c.closePath();
}

function jag(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, amp: number, segs = 6) {
  c.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) { const u = i / segs; c.lineTo(x1 + (x2 - x1) * u + (R() - .5) * amp, y1 + (y2 - y1) * u + (R() - .5) * amp); }
  c.lineTo(x2, y2);
}

function speedLines(c: CanvasRenderingContext2D, r: number, k: number, col: string, n = 14) {
  c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + (i % 3) * .13, r0 = r * (.35 + k * .6), r1 = r * (.75 + k * 1.1) + (i % 4) * 8;
    c.lineWidth = (i % 2 ? 1.5 : 3) * (1 - k); c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
  }
}

export function drawSwing(c: CanvasRenderingContext2D, s: Swing) {
  const k = 1 - s.life / s.max, { style, col, col2 } = s.p;
  const head = s.a0 + (s.a1 - s.a0) * easeOut(k / .45);
  const tail = s.a0 + (s.a1 - s.a0) * clamp((k - .25) / .75) * .9;
  const alpha = k < .6 ? 1 : 1 - (k - .6) / .4, r = s.r, w = r * .28 * s.thick;
  c.save(); c.translate(s.x, s.y); c.globalAlpha = alpha;
  const arc = (rr: number, ww: number, fill: string, blend: GlobalCompositeOperation = 'source-over') => { c.globalCompositeOperation = blend; c.fillStyle = fill; crescent(c, rr, tail, head, ww); c.fill(); };
  switch (style) {
    case 'blade': case 'blade3': {
      const n = style === 'blade3' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        c.save(); c.rotate(i * .1 * (s.a1 > s.a0 ? -1 : 1));
        const rr = r * (1 - i * .13); arc(rr, w * .55, col2, 'lighter'); arc(rr, w * .22, col); c.restore();
      }
      const gx = Math.cos(head) * r, gy = Math.sin(head) * r, gl = 14 * (1 - k);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(gx - gl, gy); c.lineTo(gx + gl, gy); c.moveTo(gx, gy - gl); c.lineTo(gx, gy + gl); c.stroke();
      break;
    }
    case 'water': {
      // Ukiyo-e water: deep blue body, white foam crest, curling wave tips.
      arc(r, w * 1.25, col); arc(r * .97, w * .5, col2);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 5; i++) {
        const a = tail + (head - tail) * (i + .5) / 5, x = Math.cos(a) * r * 1.02, y = Math.sin(a) * r * 1.02;
        c.beginPath(); c.arc(x, y, 7 + (i % 2) * 4, a - 1.5, a + 1.8); c.stroke();
      }
      break;
    }
    case 'flame': {
      arc(r * 1.06, w * 1.5, '#b3200a'); arc(r, w * 1.1, col, 'lighter'); arc(r * .96, w * .45, col2, 'lighter');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = col;
      for (let i = 0; i < 9; i++) {
        const a = tail + (head - tail) * i / 8, L = (18 + ((i * 37 + s.seed * 13) % 16)) * (1 - k * .6);
        const nx = Math.cos(a), ny = Math.sin(a), x = nx * r * 1.02, y = ny * r * 1.02;
        c.beginPath(); c.moveTo(x - ny * 6, y + nx * 6); c.quadraticCurveTo(x + nx * L * .6 + ny * 6, y + ny * L * .6 - nx * 6, x + nx * L, y + ny * L); c.lineTo(x + ny * 6, y - nx * 6); c.fill();
      }
      break;
    }
    case 'dark': case 'susanoo': {
      arc(r * 1.04, w * 1.35, col2, style === 'susanoo' ? 'lighter' : 'source-over');
      arc(r, w * 1.05, col); if (style === 'susanoo') arc(r * .98, w * .3, '#ffffff', 'lighter');
      break;
    }
    case 'saw': {
      arc(r, w * .7, '#2a2a2a'); c.globalCompositeOperation = 'lighter'; c.strokeStyle = col; c.lineWidth = 2;
      for (let i = 0; i < 12; i++) { const a = tail + (head - tail) * R(), rr = r * (.85 + R() * .3), x = Math.cos(a) * rr, y = Math.sin(a) * rr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - .5) * 26, y + (R() - .5) * 26); c.stroke(); }
      c.globalCompositeOperation = 'source-over'; c.fillStyle = col2;
      for (let i = 0; i < 6; i++) { const a = head - R() * .5; c.beginPath(); c.arc(Math.cos(a) * r * (1 + k * .6), Math.sin(a) * r * (1 + k * .6) + k * 20, 3 + R() * 3, 0, TAU); c.fill(); }
      break;
    }
    case 'ice': {
      arc(r, w * .6, col, 'lighter');
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#e8fbff'; c.strokeStyle = col; c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = tail + (head - tail) * (i + .5) / 6, L = (22 + (i * 11) % 18) * easeOut(k / .3);
        const nx = Math.cos(a), ny = Math.sin(a), x = nx * r, y = ny * r;
        c.beginPath(); c.moveTo(x - ny * 6, y + nx * 6); c.lineTo(x + nx * L, y + ny * L); c.lineTo(x + ny * 6, y - nx * 6); c.closePath(); c.fill(); c.stroke();
      }
      break;
    }
    case 'lightning': {
      if (s.a0 !== s.a1) arc(r, w * .45, col, 'lighter');
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = col2; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = s.a0 === s.a1 ? R() * TAU : tail + (head - tail) * R(), b = a + (R() - .5) * .8, r0 = s.a0 === s.a1 ? r * .15 : r * .8;
        jag(c, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(b) * r * 1.3, Math.sin(b) * r * 1.3, 14, 5);
      }
      c.stroke(); c.strokeStyle = col; c.lineWidth = 5; c.globalAlpha *= .45; c.stroke();
      if (s.a0 === s.a1 && k < .4) { c.globalAlpha = 1 - k / .4; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, r * .3 * (1 - k), 0, TAU); c.fill(); }
      break;
    }
    default: {
      // Fist styles: manga impact — flash star, shock ring, radial speed lines.
      const R0 = r * .55, kk = easeOut(k / .5);
      c.globalCompositeOperation = style === 'cursed' || style === 'impact' || style === 'steam' ? 'source-over' : 'lighter';
      if (style === 'cursed') {
        // Divergent Fist: an immediate blue impact, then a delayed second one.
        c.strokeStyle = col; c.lineWidth = 6 * (1 - k); c.beginPath(); c.arc(0, 0, R0 * (.4 + kk), 0, TAU); c.stroke();
        if (k > .35) { const k2 = (k - .35) / .65; c.strokeStyle = '#0a0612'; c.lineWidth = 8 * (1 - k2); c.beginPath(); c.arc(0, 0, R0 * (.3 + k2 * 1.2), 0, TAU); c.stroke(); c.strokeStyle = col2; c.lineWidth = 2.5 * (1 - k2); c.stroke(); }
      } else {
        c.strokeStyle = col; c.lineWidth = 7 * (1 - k); c.beginPath(); c.arc(0, 0, R0 * (.35 + kk * 1.1), 0, TAU); c.stroke();
        c.strokeStyle = col2; c.lineWidth = 2.5 * (1 - k); c.beginPath(); c.arc(0, 0, R0 * (.2 + kk * .8), 0, TAU); c.stroke();
      }
      speedLines(c, R0, k, style === 'impact' || style === 'steam' ? '#ffffff' : col, 16);
      if (k < .35) {
        const f = 1 - k / .35; c.fillStyle = '#ffffff'; c.beginPath();
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = (i % 2 ? .28 : .7) * R0 * f + 4; if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        c.closePath(); c.fill();
      }
      if (style === 'rubber' && k < .5) { c.strokeStyle = col2; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r * 1.4 * Math.sign(s.thick), i * 7); c.lineTo(-R0 * .3 * Math.sign(s.thick), i * 4); c.stroke(); } }
      if (style === 'infinity') { c.strokeStyle = col2; c.lineWidth = 2 * (1 - k); c.beginPath(); c.arc(0, 0, R0 * (1.2 - kk * .9), 0, TAU); c.stroke(); }
    }
  }
  c.restore();
}

/** Particles that accompany a swing, spawned once when it starts. */
export function swingParticles(fx: any, x: number, y: number, r: number, p: SwingProfile, facing: number) {
  const n = 8;
  switch (p.style) {
    case 'flame': for (let i = 0; i < n; i++) fx.add({ x: x + (R() - .5) * r, y: y + (R() - .5) * r, vx: facing * R() * 3, vy: -1 - R() * 3, color: R() < .5 ? p.col : p.col2, kind: 'ember', life: 26, size: 8 }); break;
    case 'water': for (let i = 0; i < n; i++) fx.add({ x: x + (R() - .5) * r, y: y + (R() - .5) * r * .6, vx: facing * (1 + R() * 4), vy: -R() * 3, color: R() < .5 ? '#ffffff' : p.col, kind: 'glow', life: 18, size: 4, grav: .2 }); break;
    case 'lightning': for (let i = 0; i < 3; i++) fx.bolt(x, y, x + (R() - .5) * r * 1.6, y + (R() - .5) * r * 1.2, p.col, 6, 2); break;
    case 'saw': for (let i = 0; i < n; i++) fx.add({ x, y, vx: (R() - .5) * 9, vy: -R() * 6, color: R() < .6 ? p.col : '#ffe08a', kind: 'spark', life: 16, size: 3, grav: .3 }); break;
    case 'steam': for (let i = 0; i < 6; i++) fx.add({ x: x + (R() - .5) * r, y, vx: (R() - .5) * 2, vy: -1 - R() * 2, color: 'rgba(255,255,255,0.55)', kind: 'smoke', life: 34, size: 12 }); break;
    case 'ice': for (let i = 0; i < n; i++) fx.add({ x, y, vx: (R() - .5) * 7, vy: -R() * 5, color: R() < .7 ? '#e8fbff' : p.col2, kind: 'shard', life: 22, size: 5, grav: .3 }); break;
    case 'ki': for (let i = 0; i < n; i++) fx.add({ x, y, vx: (R() - .5) * 6, vy: (R() - .5) * 6, color: p.col, kind: 'glow', life: 16, size: 5 }); break;
    case 'dark': case 'susanoo': for (let i = 0; i < 5; i++) fx.add({ x: x + (R() - .5) * r, y: y + (R() - .5) * r * .6, vx: facing * R() * 3, vy: -R(), color: p.style === 'susanoo' ? p.col : '#0a0810', kind: 'smoke', life: 22, size: 9 }); break;
    default: break;
  }
}
