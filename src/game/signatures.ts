/**
 * SIGNATURE ENTITIES
 * Every entry here is a bespoke, hand-drawn ability object with its own silhouette,
 * motion and behaviour. No two share a renderer.
 */
import { drawFighter, runPose, ANIMS } from './render';
import { sfx } from './audio';
import { drawBossVfx } from './bossVfx';
import type { BossVfxKind } from './bossVfx';

export interface SigDef {
  init?: (p: any) => void;
  update?: (p: any, g: any) => void;
  onHit?: (p: any, target: any, g: any) => void;
  draw: (p: any, ctx: CanvasRenderingContext2D, t: number) => void;
}

const R = Math.random;
const TAU = Math.PI * 2;
const OL = '#0b0b10';
function hexA(c: string, a: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 1) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.28, hexA(col, a * 0.85)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function jag(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seg: number, amp: number) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  ctx.moveTo(x1, y1);
  for (let i = 1; i < seg; i++) { const o = Math.sin(i * 19.7 + x1 * .13 + y2 * .07) * amp * .5; ctx.lineTo(x1 + dx * i / seg + nx * o, y1 + dy * i / seg + ny * o); }
  ctx.lineTo(x2, y2);
}
function bolt(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, w: number, amp = 26) {
  const seg = Math.min(24, Math.max(4, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 22)));
  const pts: [number, number][] = [];
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  pts.push([x1, y1]);
  for (let i = 1; i < seg; i++) { const o = Math.sin(i * 19.7 + x1 * .13 + y2 * .07) * amp * .5; pts.push([x1 + dx * i / seg + nx * o, y1 + dy * i / seg + ny * o]); }
  pts.push([x2, y2]);
  for (const [lw, c] of [[w * 3.2, hexA(col, 0.55)], [w * 1.4, col], [w * 0.55, '#ffffff']] as [number, string][]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  return pts;
}
const fade = (p: any, n = 10) => Math.max(0, Math.min(1, p.life / n, (p.t + 1) / 4));
function landed(p: any, g: any, pad = 0) {
  const gy = g.groundBelow(p.x, p.y - 80);
  return gy !== null && p.y + pad >= gy;
}
function fist(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: number, col: string, cuff?: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  if (cuff) { ctx.fillStyle = cuff; ctx.strokeStyle = OL; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.rect(-r * 1.25, -r * 0.62, r * 0.6, r * 1.24); ctx.fill(); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, shade(col, 1.25)); g.addColorStop(1, shade(col, 0.72));
  ctx.fillStyle = g; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.86, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(r * 0.45, i * r * 0.3 - r * 0.12); ctx.lineTo(r * 0.92, i * r * 0.3 - r * 0.08); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.3); ctx.quadraticCurveTo(r * 0.3, r * 0.62, r * 0.6, r * 0.34); ctx.stroke();
  ctx.restore();
}
function shade(c: string, k: number) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1, 7), 16);
  const m = (v: number) => Math.max(0, Math.min(255, Math.floor(v * k)));
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
function mockOf(o: any) {
  return { x: 0, y: 0, vx: 0, vy: 0, facing: 1, scale: o.scale, look: o.look, def: o.def, grounded: true, state: 'run', stateT: 0, animT: 0, runPhase: 0, devilT: 0, godT: 0, auraT: 0, djumpT: 99, landT: 0, tumble: 0, hw: 15, h: 78, move: null, moveFrame: 0, moveActiveEnd: 0, tipX: 0, tipY: 0, footX: 0, footY: 0, handX: 0, handY: 0 };
}

function drawTechniqueEntity(p: any, ctx: CanvasRenderingContext2D, t: number) {
  const style = p.data.style || 'ki', followup = !!p.data.followup;
  const c1 = p.col || '#ffffff', c2 = p.col2 || '#ffffff', a = fade(p, 12), r = Math.max(p.w, p.h) * .5;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1); ctx.globalAlpha = a;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (followup) { ctx.shadowColor = c1; ctx.shadowBlur = 24; }

  if (style === 'blade') {
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 3; k >= 0; k--) {
      ctx.globalAlpha = a * (k ? .16 : 1); ctx.translate(-k * 24, 0);
      ctx.strokeStyle = k ? c2 : OL; ctx.lineWidth = k ? 5 : 10;
      ctx.beginPath(); ctx.arc(-r * .2, 0, r, -1.35, 1.2); ctx.stroke();
      ctx.strokeStyle = k ? c2 : '#ffffff'; ctx.lineWidth = k ? 1.5 : 3; ctx.stroke();
    }
  } else if (style === 'storm') {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r * 1.2, c1, .9);
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU + t * .03; bolt(ctx, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a0 + 2.2) * r * 1.8, Math.sin(a0 + 2.2) * r * 1.8, i % 2 ? c1 : c2, 2.2, 16); }
  } else if (style === 'flame') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const ang = Math.PI * .5 + (i / 17 - .5) * 2.5, len = r * (1.25 + Math.sin(t * .6 + i) * .18);
      ctx.fillStyle = i % 3 ? c1 : c2; ctx.beginPath(); ctx.moveTo(Math.cos(ang - .13) * r * .45, Math.sin(ang - .13) * r * .45); ctx.quadraticCurveTo(Math.cos(ang) * len, Math.sin(ang) * len - 14, Math.cos(ang + .13) * r * .45, Math.sin(ang + .13) * r * .45); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#7a1a05'; ctx.strokeStyle = c1; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(r * .25, -r * .55); ctx.quadraticCurveTo(r * 1.15, -r * .5, r * 1.5, 0); ctx.lineTo(r * .95, r * .45); ctx.quadraticCurveTo(r * .35, r * .65, -r * .1, r * .35); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (style === 'meteor') {
    ctx.rotate(t * .025); const rg = ctx.createRadialGradient(-r * .3, -r * .3, 3, 0, 0, r);
    rg.addColorStop(0, c2); rg.addColorStop(.5, c1); rg.addColorStop(1, '#2c1812'); ctx.fillStyle = rg; ctx.strokeStyle = OL; ctx.lineWidth = 5;
    ctx.beginPath(); for (let i = 0; i < 15; i++) { const an = i / 15 * TAU, rr = r * (.78 + ((i * 37) % 10) / 28); i ? ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = c2; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; ctx.beginPath(); jag(ctx, 0, 0, Math.cos(an) * r * .7, Math.sin(an) * r * .7, 4, 13); ctx.stroke(); }
  } else if (style === 'void') {
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 2; k >= 0; k--) { ctx.globalAlpha = a * (k ? .2 : 1); ctx.fillStyle = k ? c1 : '#050208'; ctx.strokeStyle = c1; ctx.lineWidth = 5 - k; ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * .16), -1.35, 1.3); ctx.arc(r * .5, 0, r * .78, 1.2, -1.3, true); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else if (style === 'ki') {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r * 1.1, c1, 1);
    for (let k = 0; k < 5; k++) { ctx.strokeStyle = k % 2 ? c2 : c1; ctx.lineWidth = 12 - k * 2; ctx.beginPath(); ctx.ellipse(0, 0, r * (.25 + k * .16), r * (.8 - k * .08), 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * .24, 0, TAU); ctx.fill();
  } else if (style === 'spirit') {
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = c1; ctx.strokeStyle = c2; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.3, 1.3); ctx.arc(-r * .65, 0, r * .82, 1.2, -1.25, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-r * .15, 0, r * .84, -1.1, 1.1); ctx.stroke();
  } else if (style === 'fox') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { ctx.rotate(TAU / 9); ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 1.1, -r * .5, r * 1.75, 0); ctx.quadraticCurveTo(r * .9, r * .18, 0, 0); ctx.fill(); }
    glow(ctx, 0, 0, r * .8, c1, 1); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * .1, -r * .16, 5, 0, TAU); ctx.fill();
  } else if (style === 'water') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 9; i >= 0; i--) { const bx = -i * r * .12, by = Math.sin(t * .28 - i * .65) * r * .45, rr = r * (.2 + i * .07); glow(ctx, bx, by, rr, i % 2 ? c1 : c2, .48); }
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r, 0); for (let i = 0; i <= 8; i++) ctx.lineTo(-r + i * r * .28, Math.sin(t * .3 - i * .6) * r * .38); ctx.stroke();
  } else if (style === 'shadow') {
    ctx.globalCompositeOperation = 'source-over';
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 9; i++) { const bx = -r + i * r * .25, h = r * (layer ? 1.05 : 1.55) * (.72 + Math.sin(t * .32 + i) * .22); ctx.fillStyle = layer ? c1 : '#040008'; ctx.strokeStyle = layer ? '#fff' : c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - r * .16, r * .35); ctx.quadraticCurveTo(bx - r * .2, -h * .45, bx + Math.sin(i) * r * .12, -h); ctx.quadraticCurveTo(bx + r * .22, -h * .4, bx + r * .16, r * .35); ctx.fill(); ctx.stroke(); }
  } else if (style === 'rubber') {
    ctx.strokeStyle = OL; ctx.lineWidth = r * .72 + 7; ctx.beginPath(); ctx.moveTo(-r * 1.7, 0); ctx.quadraticCurveTo(-r * .4, r * .28, 0, 0); ctx.stroke();
    const fg = ctx.createRadialGradient(-r * .2, -r * .2, 2, 0, 0, r); fg.addColorStop(0, '#fff'); fg.addColorStop(.35, c2); fg.addColorStop(1, c1); ctx.fillStyle = fg; ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, r * .88, r * .72, 0, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (style === 'trio') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = i % 2 ? c1 : c2; ctx.lineWidth = 9 - i; ctx.beginPath(); ctx.ellipse(Math.sin(t * .035 + i) * r * .18, -r * .8 + i * r * .25, r * (.7 - i * .04), r * .16, Math.sin(i + t * .02) * .3, 0, TAU); ctx.stroke(); }
  } else if (style === 'pressure') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = i % 2 ? c1 : '#fff'; ctx.lineWidth = 7 - i * .5; ctx.beginPath(); ctx.ellipse(-i * r * .13, 0, r * (.2 + i * .12), r * (.8 - i * .04), 0, -1.2, 1.2); ctx.stroke(); }
  } else if (style === 'singularity') {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, -r * .32, 0, r * .85, c1, .9); glow(ctx, r * .32, 0, r * .85, '#ff5577', .9);
    ctx.strokeStyle = '#b067ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r * (.5 + Math.sin(t * .08) * .08), 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + t * .06; ctx.strokeStyle = i % 2 ? c1 : '#ff5577'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 1.7, Math.sin(an) * r * 1.7); ctx.lineTo(Math.cos(an) * r * .55, Math.sin(an) * r * .55); ctx.stroke(); }
  } else if (style === 'curse') {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r * 1.2, c1, .7);
    ctx.strokeStyle = '#070108'; ctx.lineWidth = 13; ctx.beginPath(); for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; i ? ctx.lineTo(Math.cos(an) * r * .72, Math.sin(an) * r * .72) : ctx.moveTo(Math.cos(an) * r * .72, Math.sin(an) * r * .72); } ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = c1; ctx.lineWidth = 3; for (let i = 0; i < 7; i++) { const an = i / 7 * TAU; ctx.beginPath(); jag(ctx, 0, 0, Math.cos(an) * r * (.65 + i * .05), Math.sin(an) * r * (.65 + i * .05), 4, 18); ctx.stroke(); }
  } else if (style === 'hero') {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, r * .15, 0, r, c1, .8);
    ctx.strokeStyle = c1; ctx.lineWidth = 5; for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; bolt(ctx, -r, 0, Math.cos(an) * r * 1.5, Math.sin(an) * r * 1.5, i % 2 ? c1 : '#fff', 1.6, 14); }
    fist(ctx, 0, 0, r * .62, 1, c2, c1);
  } else if (style === 'twin') {
    for (let side = -1; side <= 1; side += 2) { ctx.fillStyle = side < 0 ? c1 : c2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r, r * .5); ctx.lineTo(-r * .3, -r * (side < 0 ? 1.1 : .8)); ctx.lineTo(r * .2, -r * .5); ctx.lineTo(r, r * .5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else if (style === 'titan') {
    ctx.translate(r * .25, 0); ctx.fillStyle = c1; ctx.strokeStyle = OL; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-r * .75, -r * .55); ctx.lineTo(r * .2, -r * .7); ctx.lineTo(r * .85, -r * .3); ctx.lineTo(r * .65, r * .6); ctx.lineTo(-r * .55, r * .55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = c2; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-r * .4 + i * r * .2, -r * .35); ctx.lineTo(-r * .25 + i * r * .2, r * .35); ctx.stroke(); }
  } else if (style === 'saw') {
    ctx.rotate(t * .35); ctx.fillStyle = c1; ctx.strokeStyle = '#ece8e2'; ctx.lineWidth = 4;
    for (let i = 0; i < 18; i++) { ctx.rotate(TAU / 18); ctx.beginPath(); ctx.moveTo(r * .48, -r * .16); ctx.lineTo(r, 0); ctx.lineTo(r * .48, r * .16); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    glow(ctx, 0, 0, r * .5, c2, .7);
  }
  ctx.restore();
}


function drawBossSignature(p: any, ctx: CanvasRenderingContext2D, t: number, kind: BossVfxKind) {
  const b = p.rect(), charge = p.t < p.delay, k = charge ? p.t / Math.max(1, p.delay) : 1;
  // During startup keep an open telegraph; solid core appears only on release.
  if (charge) {
    ctx.save(); ctx.globalAlpha *= .28; ctx.strokeStyle = kind === 'blue' ? '#5fd2ff' : kind === 'red' ? '#ff3a5a' : '#c688ee';
    ctx.lineWidth = 1; ctx.setLineDash([5, 7]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore();
  }
  drawBossVfx(ctx, kind, b, t, { alpha: fade(p) * (charge ? .3 + k * .25 : p.active ? 1 : .25), progress: k,
    facing: p.dir, angle: kind === 'fuga' ? Math.atan2(p.vy, p.vx || p.dir * .001) : 0, seed: p.data.seed || 0, active: p.active });
}

export const SIGS: Record<string, SigDef> = {
  technique: {
    init: (p) => { p.data.trail = []; p.data.seed = R() * TAU; },
    update: (p, g) => {
      p.data.trail.unshift([p.x, p.y]); if (p.data.trail.length > 12) p.data.trail.pop();
      for (let i = 0; i < 3; i++) g.fx.add({ x: p.x - p.dir * R() * p.w, y: p.y + (R() - .5) * p.h, vx: -p.dir * R() * 3, vy: (R() - .5) * 2, color: i % 2 ? p.col : p.col2, kind: p.data.style === 'flame' || p.data.style === 'meteor' ? 'ember' : 'glow', life: 18, size: 5 + R() * 4 });
      if (p.data.style === 'storm' || p.data.style === 'spirit') { const a = R() * TAU; g.fx.bolt(p.x, p.y, p.x + Math.cos(a) * p.w, p.y + Math.sin(a) * p.h, p.col, 3, 15); }
      if (p.t % 8 === 0) g.shake(p.data.followup ? 5 : 2);
    },
    draw: drawTechniqueEntity,
  },
  // ====================== LEVI — Thunder Spear ======================
  thunderSpear: {
    update: (p, g) => {
      p.vy += 0.34;
      p.data.ang = Math.atan2(p.vy, p.vx);
      g.fx.add({ x: p.x - Math.cos(p.data.ang) * 26, y: p.y - Math.sin(p.data.ang) * 26, vx: -p.vx * 0.1, vy: -0.6, color: '#8a8a92', kind: 'smoke', life: 26, size: 6 });
      g.fx.add({ x: p.x - Math.cos(p.data.ang) * 24, y: p.y - Math.sin(p.data.ang) * 24, color: '#ffb040', kind: 'glow', life: 6, size: 6 });
      if (landed(p, g)) { p.life = 0; g.shake(12); sfx('heavyhit'); }
    },
    onHit: (p, _t, g) => { p.life = 0; g.shake(14); sfx('heavyhit'); },
    draw: (p, ctx) => {
      ctx.translate(p.x, p.y); ctx.rotate(p.data.ang ?? 0);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, -30, 0, 16, '#ff9a3a', 0.8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = OL; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(22, 0); ctx.stroke();
      ctx.strokeStyle = '#7b8494'; ctx.lineWidth = 3.4; ctx.stroke();
      ctx.fillStyle = '#c8d0dc'; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(22, -5); ctx.lineTo(38, 0); ctx.lineTo(22, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a4250'; ctx.fillRect(-12, -5, 12, 10); ctx.strokeRect(-12, -5, 12, 10);
      ctx.fillStyle = '#d6b24a'; ctx.fillRect(-9, -5, 2, 10);
      ctx.fillStyle = '#56606e';
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-38, -8); ctx.lineTo(-26, -2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-38, 8); ctx.lineTo(-26, 2); ctx.fill();
    },
  },

  // ====================== KILLUA — Narukami bolt ======================
  narukami: {
    update: (p, g) => {
      if (p.t === p.delay) {
        sfx('elec'); g.shake(p.data.big ? 20 : 8); g.flashScreen('#cff4ff', p.data.big ? 0.45 : 0.22);
        g.fx.burst(p.x, p.y - 6, p.data.big ? 40 : 18, '#8fe6ff', 9, 'spark', 22, 4);
        g.fx.ring(p.x, p.y - 4, 8, p.data.big ? 200 : 90, '#8fe6ff', 18, 6);
      }
    },
    draw: (p, ctx) => {
      const big = !!p.data.big, W = p.w;
      if (p.t < p.delay) {
        const k = p.t / p.delay;
        ctx.strokeStyle = hexA('#8fe6ff', 0.3 + k * 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, W * 0.6 * k + 6, 7 * k + 2, 0, 0, TAU); ctx.stroke();
        ctx.setLineDash([6, 10]); ctx.globalAlpha = 0.4 * k;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 900); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
        // crawling charge
        ctx.globalCompositeOperation = 'lighter';
        if (R() < k) bolt(ctx, p.x - W * 0.5, p.y - 3, p.x + W * 0.5, p.y - 3, '#8fe6ff', 1.2, 10);
        return;
      }
      const since = p.t - p.delay, a = Math.max(0, 1 - since / 20);
      ctx.globalCompositeOperation = 'lighter';
      const col = '#8fe6ff';
      const pg = ctx.createLinearGradient(p.x - W, 0, p.x + W, 0);
      pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(0.5, hexA(col, 0.5 * a)); pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg; ctx.fillRect(p.x - W, p.y - 1000, W * 2, 1000);
      if (since < 12) {
        const pts = bolt(ctx, p.x + (R() - 0.5) * 16, p.y - 1000, p.x, p.y, col, big ? 7 : 4, big ? 60 : 34);
        for (let i = 0; i < (big ? 6 : 3); i++) {
          const [bx, by] = pts[2 + Math.floor(R() * (pts.length - 3))];
          bolt(ctx, bx, by, bx + (R() - 0.5) * 140, by + 40 + R() * 90, col, 1.5, 16);
        }
      }
      glow(ctx, p.x, p.y - 4, (big ? 150 : 70) * a + 10, col, a);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(20,30,40,${0.5 * a})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, W * 0.7, 8, 0, 0, TAU); ctx.fill();
    },
  },

  // ====================== RENGOKU — Flame Tiger ======================
  flameTiger: {
    update: (p, g) => {
      for (let i = 0; i < 4; i++) g.fx.add({ x: p.x - p.dir * (30 + R() * 80), y: p.y - 30 - R() * 90, vx: -p.dir * 2, vy: -1 - R() * 3, color: R() < 0.5 ? '#ff5a1a' : '#ffd24a', kind: 'ember', life: 26, size: 11 });
      if (p.t % 7 === 0) { g.shake(3); sfx('fire'); }
    },
    draw: (p, ctx, t) => {
      const a = fade(p);
      ctx.translate(p.x, p.y - 62); ctx.scale(p.dir, 1);
      ctx.globalAlpha = a;
      // flame mane
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const ang = Math.PI * 0.55 + (i / 13) * Math.PI * 0.9;
        const len = 70 + Math.sin(t * 0.5 + i * 1.7) * 16 + (i % 2) * 14;
        ctx.fillStyle = i % 2 ? 'rgba(255,90,26,0.7)' : 'rgba(255,200,70,0.6)';
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang - 0.18) * 30, Math.sin(ang - 0.18) * 30);
        ctx.quadraticCurveTo(Math.cos(ang) * len * 0.7, Math.sin(ang) * len * 0.7 - 8, Math.cos(ang) * len - 20, Math.sin(ang) * len);
        ctx.lineTo(Math.cos(ang + 0.18) * 30, Math.sin(ang + 0.18) * 30);
        ctx.closePath(); ctx.fill();
      }
      glow(ctx, 0, 0, 90, '#ff7a1a', 0.6);
      ctx.globalCompositeOperation = 'source-over';
      // head
      const hg = ctx.createLinearGradient(-40, -40, 50, 40);
      hg.addColorStop(0, '#ffe08a'); hg.addColorStop(0.5, '#ff8a1a'); hg.addColorStop(1, '#c2330c');
      ctx.fillStyle = hg; ctx.strokeStyle = '#5a1402'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-36, -30); ctx.quadraticCurveTo(10, -52, 50, -18); ctx.lineTo(66, -2); ctx.lineTo(48, 8);
      ctx.quadraticCurveTo(20, 40, -30, 34); ctx.quadraticCurveTo(-50, 0, -36, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
      // ears
      for (const ex of [-22, 4]) { ctx.beginPath(); ctx.moveTo(ex - 10, -36); ctx.lineTo(ex, -64); ctx.lineTo(ex + 12, -40); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      // stripes
      ctx.strokeStyle = '#3a0c02'; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 12, -40); ctx.quadraticCurveTo(-4 + i * 12, -26, -14 + i * 12, -16); ctx.stroke(); }
      // jaw & fangs
      const jaw = 10 + Math.sin(t * 0.4) * 6;
      ctx.fillStyle = '#5a0a02'; ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(60, 4 + jaw * 0.3); ctx.lineTo(24, 18 + jaw); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const fx of [36, 50]) { ctx.beginPath(); ctx.moveTo(fx, 4); ctx.lineTo(fx + 4, 14); ctx.lineTo(fx + 7, 4); ctx.fill(); }
      // eye
      ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.ellipse(20, -16, 9, 5, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0500'; ctx.fillRect(19, -21, 2.5, 10);
    },
  },

  // ====================== MADARA — Tengai Shinsei meteor ======================
  meteor: {
    init: (p) => {
      p.data.verts = Array.from({ length: 14 }, (_, i) => [i / 14 * TAU, 0.78 + R() * 0.26]);
      p.data.cracks = Array.from({ length: 5 }, () => [R() * TAU, 0.2 + R() * 0.5]);
    },
    update: (p, g) => {
      const ang = Math.atan2(p.vy, p.vx);
      for (let i = 0; i < 6; i++) g.fx.add({ x: p.x - Math.cos(ang) * (60 + R() * 60) + (R() - 0.5) * 70, y: p.y - Math.sin(ang) * (60 + R() * 60) + (R() - 0.5) * 70, vx: -p.vx * 0.3, vy: -p.vy * 0.3, color: R() < 0.5 ? '#ff5a1a' : '#ffcc33', kind: 'ember', life: 28, size: 14 });
      if (p.t % 2 === 0) g.fx.add({ x: p.x - Math.cos(ang) * 90, y: p.y - Math.sin(ang) * 90, vx: -p.vx * 0.15, vy: -p.vy * 0.15, color: '#2a1e18', kind: 'smoke', life: 50, size: 30 });
      if (p.t % 5 === 0) g.shake(3);
      if (landed(p, g, 40)) { p.life = 0; g.shake(28); g.flashScreen('#ffb070', 0.4); sfx('heavyhit', 2); g.fx.ring(p.x, p.y + 30, 20, 320, '#ff7a1a', 30, 20); }
    },
    draw: (p, ctx, t) => {
      const r = p.w * 0.5;
      // ground warning
      if (p.data.gy !== undefined) {
        const dist = Math.max(0, p.data.gy - p.y), k = Math.max(0, 1 - dist / 800);
        const gx = p.x + p.vx * (dist / Math.max(1, p.vy));
        ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.4})`;
        ctx.beginPath(); ctx.ellipse(gx, p.data.gy, r * (0.4 + k), r * 0.22 * (0.4 + k), 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,90,30,${0.3 + k * 0.6})`; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.translate(p.x, p.y);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) glow(ctx, -Math.cos(ang) * i * 34, -Math.sin(ang) * i * 34, r * (1.35 - i * 0.16), '#ff6a1a', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(t * 0.03);
      const rg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
      rg.addColorStop(0, '#8a6a52'); rg.addColorStop(0.6, '#4a3528'); rg.addColorStop(1, '#231710');
      ctx.fillStyle = rg; ctx.strokeStyle = OL; ctx.lineWidth = 4;
      ctx.beginPath();
      p.data.verts.forEach(([a, k]: number[], i: number) => { const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 3; ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 12;
      for (const [a, k] of p.data.cracks) { ctx.beginPath(); jag(ctx, Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, Math.cos(a) * r * (k + 0.35), Math.sin(a) * r * (k + 0.35), 4, 14); ctx.stroke(); }
      ctx.shadowBlur = 0;
    },
  },

  // ====================== ASTA — Anti-magic slash (eats projectiles) ======================
  antiSlash: {
    init: (p) => { p.data.pts = Array.from({ length: 11 }, (_, i) => [i / 10, (i % 3 === 1 ? 0.72 : 1)]); },
    update: (p, g) => {
      for (const o of g.projectiles) {
        if (o === p || o.dead || o.owner === p.owner || o.follow || o.type === 'susanoo' || o.type === 'arm') continue;
        if (Math.abs(o.x - p.x) < (o.w + p.w) / 2 && Math.abs(o.y - p.y) < (o.h + p.h) / 2) {
          o.dead = true; o.life = 0; o.fin = undefined;
          g.fx.burst(o.x, o.y, 22, '#e0203a', 8, 'shard', 22, 6); g.fx.text(o.x, o.y - 30, 'NULLIFIED', '#ff3a4a', 22, 30); sfx('dark');
        }
      }
      if (p.t % 2 === 0) g.fx.add({ x: p.x, y: p.y + (R() - 0.5) * p.h, vx: -p.vx * 0.2, color: R() < 0.6 ? '#12020a' : '#e0203a', kind: R() < 0.6 ? 'smoke' : 'glow', life: 20, size: 9 });
    },
    draw: (p, ctx) => {
      const a = fade(p), H = p.h * 0.5;
      ctx.translate(p.x, p.y); ctx.scale(p.dir, 1); ctx.globalAlpha = a;
      ctx.beginPath();
      p.data.pts.forEach(([k, n]: number[], i: number) => { const an = -1.25 + k * 2.5; const x = Math.cos(an) * H * 0.55 * n, y = Math.sin(an) * H * n; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      for (let i = p.data.pts.length - 1; i >= 0; i--) { const an = -1.25 + p.data.pts[i][0] * 2.5; ctx.lineTo(Math.cos(an) * H * 0.25 - 10, Math.sin(an) * H * 0.8); }
      ctx.closePath();
      ctx.fillStyle = '#0a0206'; ctx.fill();
      ctx.strokeStyle = '#ff2a3e'; ctx.lineWidth = 3; ctx.shadowColor = '#ff2a3e'; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) bolt(ctx, -4, (R() - 0.5) * H * 1.4, 14, (R() - 0.5) * H * 1.4, '#ff2a3e', 1, 10);
    },
  },

  // ====================== GOKU — Kamehameha beam ======================
  kameBeam: {
    update: (p, g) => {
      const o = p.owner;
      if (o.state !== 'attack' || o.moveKey !== 'nspec') p.life = Math.min(p.life, 5);
      const grow = Math.min(1, p.t / 9), L = 980 * grow;
      p.data.L = L;
      p.x = o.x + p.dir * (34 + L / 2); p.y = o.y - 46; p.w = L; p.h = 66 * Math.min(1, p.life / 8);
      if (p.t % 3 === 0) g.shake(4);
      for (let i = 0; i < 3; i++) g.fx.add({ x: o.x + p.dir * (40 + R() * L), y: p.y + (R() - 0.5) * p.h, vx: p.dir * 6, color: R() < 0.5 ? '#bff4ff' : '#ffffff', kind: 'streak', life: 12, size: 2 });
    },
    draw: (p, ctx, t) => {
      const o = p.owner, L = p.data.L || 0, h = Math.max(2, p.h), x0 = o.x + p.dir * 30, y = p.y;
      ctx.globalCompositeOperation = 'lighter';
      const layers: [number, string][] = [[1.7, 'rgba(60,150,255,0.35)'], [1.15, 'rgba(120,220,255,0.6)'], [0.5, 'rgba(255,255,255,0.95)']];
      for (const [k, c] of layers) {
        ctx.fillStyle = c; ctx.beginPath();
        const hh = h * k * 0.5, steps = 24;
        for (let i = 0; i <= steps; i++) { const xx = x0 + p.dir * L * i / steps; ctx.lineTo(xx, y - hh - Math.sin(t * 0.6 + i) * hh * 0.12); }
        for (let i = steps; i >= 0; i--) { const xx = x0 + p.dir * L * i / steps; ctx.lineTo(xx, y + hh + Math.sin(t * 0.6 + i * 1.3) * hh * 0.12); }
        ctx.closePath(); ctx.fill();
      }
      glow(ctx, x0, y, h * 1.3, '#6fd2ff', 1);
      glow(ctx, x0 + p.dir * L, y, h * 1.1, '#6fd2ff', 0.9);
    },
  },

  // ====================== GOKU BLACK — Super Saiyan Rosé Signatures ======================
  blackKameBeam: {
    update: (p, g) => {
      const o = p.owner;
      if (o.state !== 'attack' || o.moveKey !== 'nspec') p.life = Math.min(p.life, 5);
      const grow = Math.min(1, p.t / 8), L = 1020 * grow;
      p.data.L = L;
      p.x = o.x + p.dir * (36 + L / 2); p.y = o.y - 46; p.w = L; p.h = 76 * Math.min(1, p.life / 8);
      if (p.t % 3 === 0) g.shake(5);
      for (let i = 0; i < 4; i++) {
        g.fx.add({
          x: o.x + p.dir * (40 + R() * L), y: p.y + (R() - 0.5) * p.h,
          vx: p.dir * 8, vy: (R() - 0.5) * 3,
          color: R() < 0.4 ? '#f472b6' : R() < 0.7 ? '#8b5cf6' : '#ffffff',
          kind: 'streak', life: 14, size: 2.5,
        });
      }
    },
    draw: (p, ctx, t) => {
      const o = p.owner, L = p.data.L || 0, h = Math.max(2, p.h), x0 = o.x + p.dir * 32, y = p.y;
      ctx.globalCompositeOperation = 'lighter';
      const layers: [number, string][] = [
        [2.2, 'rgba(126, 34, 206, 0.35)'],
        [1.6, 'rgba(217, 70, 239, 0.55)'],
        [1.0, 'rgba(244, 114, 182, 0.85)'],
        [0.45, 'rgba(255, 255, 255, 0.98)']
      ];
      for (const [k, c] of layers) {
        ctx.fillStyle = c; ctx.beginPath();
        const hh = h * k * 0.5, steps = 28;
        for (let i = 0; i <= steps; i++) {
          const xx = x0 + p.dir * L * i / steps;
          ctx.lineTo(xx, y - hh - Math.sin(t * 0.7 + i * 1.2) * hh * 0.15);
        }
        for (let i = steps; i >= 0; i--) {
          const xx = x0 + p.dir * L * i / steps;
          ctx.lineTo(xx, y + hh + Math.sin(t * 0.7 + i * 1.4) * hh * 0.15);
        }
        ctx.closePath(); ctx.fill();
      }
      glow(ctx, x0, y, h * 1.5, '#ec4899', 1);
      glow(ctx, x0 + p.dir * L, y, h * 1.4, '#8b5cf6', 0.9);
      ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const xx = x0 + p.dir * (L * i / 20);
        const yy = y + Math.sin(t * 0.8 + i * 1.5) * (h * 0.45);
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    },
  },

  divineLasso: {
    init: (p) => {
      p.data.needles = [];
      for (let i = 0; i < 7; i++) {
        p.data.needles.push({
          ox: (R() - 0.5) * 50, oy: -30 + (R() - 0.5) * 50,
          ang: (R() - 0.5) * 0.6 + (p.dir > 0 ? 0.3 : Math.PI - 0.3),
          len: 42 + R() * 20,
        });
      }
    },
    update: (p, g) => {
      if (p.t === 1) { sfx('swingH'); g.shake(4); }
      if (p.t === 22) {
        g.shake(16);
        g.flashScreen('#ec4899', 0.45);
        sfx('heavyhit', 2);
        for (let i = 0; i < 30; i++) {
          const a = R() * TAU;
          g.fx.add({
            x: p.x, y: p.y,
            vx: Math.cos(a) * (5 + R() * 12), vy: Math.sin(a) * (5 + R() * 12),
            color: R() < 0.5 ? '#f472b6' : '#c084fc',
            kind: 'streak', life: 24, size: 4,
          });
        }
      }
    },
    draw: (p, ctx, t) => {
      const a = fade(p, 6);
      ctx.save(); ctx.translate(p.x, p.y);
      const detonated = p.t >= 22;
      if (!detonated) {
        ctx.globalCompositeOperation = 'lighter';
        const vib = Math.sin(p.t * 0.8) * 2;
        for (const n of (p.data.needles || [])) {
          ctx.save(); ctx.translate(n.ox + vib, n.oy); ctx.rotate(n.ang);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(-n.len * 0.5, 0); ctx.lineTo(n.len * 0.5, 0); ctx.stroke();
          ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 5.5; ctx.stroke();
          ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 9; ctx.globalAlpha = 0.5 * a; ctx.stroke();
          ctx.restore();
        }
      } else {
        const progress = Math.min(1, (p.t - 22) / 10);
        const rad = progress * 140;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexA('#ec4899', 1 - progress); ctx.lineWidth = 6 * (1 - progress);
        ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.stroke();
        ctx.strokeStyle = hexA('#ffffff', 1 - progress); ctx.lineWidth = 3 * (1 - progress);
        ctx.beginPath(); ctx.arc(0, 0, rad * 0.8, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    },
  },

  holyLightGrenade: {
    update: (p, g) => {
      if (p.t % 3 === 0) g.shake(2);
      g.fx.add({
        x: p.x + (R() - 0.5) * p.w, y: p.y + (R() - 0.5) * p.h,
        vx: (R() - 0.5) * 4, vy: -1 - R() * 3,
        color: R() < 0.5 ? '#f472b6' : '#a855f7',
        kind: 'glow', life: 16, size: 4,
      });
    },
    draw: (p, ctx, t) => {
      const a = fade(p);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      const pulse = Math.sin(t * 0.2) * 6;
      const r = p.w * 0.45 + pulse;
      glow(ctx, 0, 0, r * 1.8, '#ec4899', 0.9 * a);
      glow(ctx, 0, 0, r * 1.1, '#8b5cf6', 0.8 * a);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? '#f472b6' : '#ffffff'; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.3, r * 0.4, t * 0.15 + i * 1.05, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  scytheRift: {
    init: (p) => {
      p.data.cracks = [];
      for (let i = 0; i < 9; i++) {
        p.data.cracks.push({
          y: -140 + i * 35,
          len: 50 + R() * 70,
          ang: (R() - 0.5) * 0.8,
        });
      }
    },
    update: (p, g) => {
      g.shake(3);
      if (p.t % 3 === 0) {
        g.fx.add({
          x: p.x + (R() - 0.5) * 40, y: p.y - 150 + R() * 300,
          vx: (R() - 0.5) * 8, vy: (R() - 0.5) * 8,
          color: R() < 0.3 ? '#ffffff' : R() < 0.7 ? '#ec4899' : '#581c87',
          kind: 'streak', life: 20, size: 4,
        });
      }
    },
    draw: (p, ctx, t) => {
      const a = fade(p, 12);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05020a';
      ctx.beginPath();
      ctx.moveTo(0, -180);
      ctx.quadraticCurveTo(24 + Math.sin(t * 0.3) * 8, 0, 0, 180);
      ctx.quadraticCurveTo(-24 - Math.sin(t * 0.3) * 8, 0, 0, -180);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 14; ctx.globalAlpha = 0.5 * a; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.globalAlpha = 1; ctx.stroke();

      for (const c of (p.data.cracks || [])) {
        ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, c.y);
        ctx.lineTo(Math.cos(c.ang) * c.len, c.y + Math.sin(c.ang) * c.len);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // ====================== ICHIGO — Getsuga Tenshou (bankai) ======================
  getsugaBig: {
    draw: (p, ctx) => {
      const a = fade(p), H = p.h * 0.5;
      for (let k = 3; k >= 0; k--) {
        ctx.save(); ctx.translate(p.x - p.dir * k * 22, p.y); ctx.scale(p.dir, 1);
        ctx.globalAlpha = a * (k === 0 ? 1 : 0.22);
        ctx.beginPath(); ctx.arc(-H * 0.2, 0, H, -1.2, 1.2); ctx.arc(-H * 0.75, 0, H * 0.92, 1.12, -1.12, true); ctx.closePath();
        ctx.fillStyle = '#07050d'; ctx.fill();
        ctx.strokeStyle = p.col; ctx.lineWidth = 4; ctx.shadowColor = '#ff2040'; ctx.shadowBlur = k === 0 ? 22 : 0; ctx.stroke();
        ctx.shadowBlur = 0;
        if (k === 0) {
          ctx.strokeStyle = '#ff3050'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(-H * 0.24, 0, H * 0.94, -1.05, 1.05); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(-H * 0.2, 0, H * 0.99, -0.9, 0.9); ctx.stroke();
        }
        ctx.restore();
      }
    },
    update: (p, g) => { if (p.t % 2 === 0) g.fx.add({ x: p.x, y: p.y + (R() - 0.5) * p.h, vx: -p.dir * 3, color: R() < 0.5 ? '#ff2040' : '#1a0010', kind: R() < 0.5 ? 'glow' : 'smoke', life: 18, size: 8 }); },
  },

  // ====================== NARUTO — Shadow Clones ======================
  clone: {
    init: (p) => { p.data.m = mockOf(p.owner); },
    update: (p, g) => {
      if (p.t === p.delay) g.fx.burst(p.x, p.y - 40, 14, '#e8e8f0', 5, 'smoke', 22, 10);
      if (p.life <= 1) g.fx.burst(p.x, p.y - 40, 16, '#e8e8f0', 6, 'smoke', 24, 11);
    },
    onHit: (p, _t, g) => { p.life = 0; p.dead = true; g.fx.burst(p.x, p.y - 40, 18, '#e8e8f0', 6, 'smoke', 24, 11); sfx('dodge'); },
    draw: (p, ctx, t) => {
      if (p.t < p.delay) return;
      const m = p.data.m;
      m.x = p.x; m.y = p.y; m.facing = p.dir; m.animT = t; m.vx = p.vx;
      const punching = p.life < 12;
      const pose = punching ? ANIMS.punch.s : runPose(t * 0.45 + p.data.i, true);
      ctx.globalAlpha = 0.9;
      drawFighter(ctx, m, pose, t);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.15;
      drawFighter(ctx, m, pose, t);
    },
  },

  // ====================== TANJIRO — Water / Sun serpent dragon ======================
  serpent: {
    init: (p) => { p.data.trail = []; p.data.y0 = p.data.y0 ?? p.y; },
    update: (p, g) => {
      p.y = p.data.y0 + Math.sin(p.t * 0.22) * (p.data.pal === 'sun' ? 44 : 30);
      p.data.trail.unshift([p.x, p.y]); if (p.data.trail.length > 20) p.data.trail.pop();
      const sun = p.data.pal === 'sun';
      for (let i = 0; i < 3; i++) g.fx.add({ x: p.x - p.dir * R() * 120, y: p.y + (R() - 0.5) * p.h, vx: -p.dir * 2, vy: sun ? -2 : 1 + R() * 2, color: sun ? (R() < 0.5 ? '#ff7a1a' : '#ffd66a') : (R() < 0.5 ? '#8fdcff' : '#ffffff'), kind: sun ? 'ember' : 'glow', life: 22, size: sun ? 9 : 5, grav: sun ? 0 : 0.15 });
    },
    draw: (p, ctx, t) => {
      const sun = p.data.pal === 'sun', tr = p.data.trail, a = fade(p);
      const c1 = sun ? '#ff8a1a' : '#3aa6e8', c2 = sun ? '#ffe08a' : '#e6f9ff', edge = sun ? '#8a2204' : '#0d3a66';
      const R0 = p.h * 0.42;
      ctx.globalAlpha = a;
      for (let i = tr.length - 1; i >= 1; i--) {
        const [x, y] = tr[i], rr = R0 * (1 - i / (tr.length + 4));
        const g = ctx.createRadialGradient(x, y - rr * 0.3, 1, x, y, rr);
        g.addColorStop(0, c2); g.addColorStop(0.6, c1); g.addColorStop(1, edge);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, rr * 0.7, -2.4, -0.8); ctx.stroke();
      }
      // head
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
      if (sun) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,200,80,0.8)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(-10, 0, R0 * 1.7, 0, TAU); ctx.stroke();
        for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + t * 0.05; ctx.beginPath(); ctx.moveTo(-10 + Math.cos(an) * R0 * 1.7, Math.sin(an) * R0 * 1.7); ctx.lineTo(-10 + Math.cos(an) * R0 * 2.2, Math.sin(an) * R0 * 2.2); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
      }
      const hg = ctx.createLinearGradient(0, -R0, 0, R0);
      hg.addColorStop(0, c2); hg.addColorStop(1, c1);
      ctx.fillStyle = hg; ctx.strokeStyle = edge; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-R0, -R0 * 0.8); ctx.quadraticCurveTo(R0 * 0.6, -R0 * 1.1, R0 * 1.8, -R0 * 0.2); ctx.lineTo(R0 * 1.9, R0 * 0.1);
      ctx.lineTo(R0 * 0.8, R0 * 0.3 + Math.sin(t * 0.4) * 5); ctx.lineTo(R0 * 1.6, R0 * 0.7); ctx.quadraticCurveTo(0, R0 * 1.1, -R0, R0 * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-R0 * 0.2, -R0 * 0.9); ctx.quadraticCurveTo(-R0 * 0.9, -R0 * 1.9, -R0 * 1.7, -R0 * 1.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(R0 * 1.6, 0); ctx.quadraticCurveTo(R0 * 2.2, R0 * 0.8, R0 * 2.8, R0 * 0.5 + Math.sin(t * 0.3) * 6); ctx.stroke();
      ctx.fillStyle = sun ? '#fff6a0' : '#ffffff'; ctx.beginPath(); ctx.ellipse(R0 * 0.7, -R0 * 0.38, 7, 4, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = OL; ctx.fillRect(R0 * 0.7 - 1, -R0 * 0.38 - 4, 2.5, 8);
      ctx.restore();
    },
  },

  // ====================== SASUKE — Amaterasu black flames ======================
  amaterasu: {
    update: (p, g) => {
      if (p.t === p.delay) { sfx('dark'); g.fx.ring(p.x, p.y - 20, 10, 90, '#6a1a8a', 18, 8); }
      if (p.active && p.t % 2 === 0) g.fx.add({ x: p.x + (R() - 0.5) * p.w, y: p.y - R() * 30, vy: -1.5 - R() * 2, color: R() < 0.7 ? '#0a000c' : '#8a2ad0', kind: R() < 0.7 ? 'smoke' : 'glow', life: 30, size: 10 });
    },
    draw: (p, ctx, t) => {
      if (p.t < p.delay) {
        const k = p.t / p.delay;
        ctx.fillStyle = `rgba(20,0,30,${0.5 * k})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 0.6 * k, 10, 0, 0, TAU); ctx.fill();
        return;
      }
      const a = Math.min(1, p.life / 14);
      ctx.globalAlpha = a;
      const n = 9;
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < n; i++) {
          const bx = p.x - p.w / 2 + (i + 0.5) * (p.w / n);
          const h = (layer ? 0.6 : 1) * (40 + Math.abs(Math.sin(t * 0.3 + i * 1.9)) * 55);
          const sway = Math.sin(t * 0.25 + i) * 10;
          ctx.beginPath();
          ctx.moveTo(bx - 12, p.y);
          ctx.quadraticCurveTo(bx - 14 + sway, p.y - h * 0.55, bx + sway * 1.6, p.y - h);
          ctx.quadraticCurveTo(bx + 14 + sway, p.y - h * 0.5, bx + 12, p.y);
          ctx.closePath();
          ctx.fillStyle = layer ? '#1c0428' : '#050008'; ctx.fill();
          if (!layer) { ctx.strokeStyle = '#9a3ae0'; ctx.lineWidth = 1.6; ctx.stroke(); }
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y - 20, p.w * 0.7, '#5a1a8a', 0.35);
    },
  },

  // ====================== LUFFY — Gum-Gum Pistol stretch arm ======================
  rubberArm: {
    update: (p) => {
      const o = p.owner, max = p.data.max || 300;
      const L = p.t <= 9 ? max * (p.t / 9) : p.t <= 12 ? max : max * Math.max(0, 1 - (p.t - 12) / 9);
      p.data.L = L; p.x = o.x + p.dir * (26 + L); p.y = o.y - 50;
    },
    draw: (p, ctx, t) => {
      const o = p.owner, L = p.data.L || 0, sx = o.x + p.dir * 12, sy = o.y - 50, ex = o.x + p.dir * (26 + L);
      const skin = o.look.skin, sag = Math.sin(t * 0.8) * 4 + Math.min(12, L * 0.03);
      ctx.lineCap = 'round';
      ctx.strokeStyle = OL; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2, sy + sag, ex, sy); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy - 3); ctx.quadraticCurveTo((sx + ex) / 2, sy + sag - 3, ex, sy - 3); ctx.stroke();
      ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + p.dir * 10, sy); ctx.stroke();
      ctx.strokeStyle = '#d8423a'; ctx.lineWidth = 12; ctx.stroke();
      if (p.t < 10) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const yy = sy - 18 + i * 12; ctx.beginPath(); ctx.moveTo(ex - p.dir * 30, yy); ctx.lineTo(ex - p.dir * 70, yy); ctx.stroke(); } }
      fist(ctx, ex, sy, 16, p.dir, skin);
    },
  },

  // ====================== LUFFY ULT — King Kong Gun ======================
  giantFist: {
    update: (p, g) => { if (p.t % 2 === 0) g.fx.add({ x: p.x - p.dir * 90, y: p.y + (R() - 0.5) * 120, vx: -p.dir * 3, vy: -1, color: '#e8e2d4', kind: 'smoke', life: 30, size: 16 }); if (p.t % 6 === 0) g.shake(6); },
    draw: (p, ctx, t) => {
      const o = p.owner, sx = o.x + p.dir * 12, sy = o.y - 52;
      const r = p.h * 0.48;
      ctx.lineCap = 'round';
      ctx.strokeStyle = OL; ctx.lineWidth = r * 0.72 + 6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + p.x) / 2, (sy + p.y) / 2 + 30, p.x - p.dir * r * 0.8, p.y); ctx.stroke();
      const ag = ctx.createLinearGradient(sx, sy, p.x, p.y);
      ag.addColorStop(0, o.look.skin); ag.addColorStop(0.55, '#2a1a22'); ag.addColorStop(1, '#0d080c');
      ctx.strokeStyle = ag; ctx.lineWidth = r * 0.72; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, r * 1.5, '#ff3a3a', 0.35);
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x + p.dir * 20, p.y, r * (1.1 + ((t * 0.08 + i * 0.25) % 1) * 0.8), -0.8, 0.8); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      fist(ctx, p.x, p.y, r, p.dir, '#1e1418');
      ctx.strokeStyle = 'rgba(255,70,70,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); jag(ctx, p.x - r * 0.4, p.y - r * 0.5 + i * r * 0.4, p.x + p.dir * r * 0.6, p.y - r * 0.3 + i * r * 0.4, 4, 8); ctx.stroke(); }
    },
  },

  // ====================== ZORO — Tatsumaki tornado ======================
  tornado: {
    update: (p, g) => { if (p.t % 2 === 0) g.fx.add({ x: p.x + (R() - 0.5) * p.w, y: p.y - R() * p.h, vx: (R() - 0.5) * 6, vy: -2, color: R() < 0.5 ? '#8dffbe' : '#ffffff', kind: 'streak', life: 14, size: 2.5 }); if (p.t % 10 === 0) sfx('whoosh'); },
    draw: (p, ctx, t) => {
      const a = fade(p), H = p.h, W = p.w;
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y - 10, W * 0.7, '#3ad08a', 0.4);
      for (let i = 0; i < 9; i++) {
        const k = i / 8, yy = p.y - k * H, rw = W * (0.18 + k * 0.45), off = Math.sin(t * 0.35 + i * 0.9) * 14 * k;
        ctx.strokeStyle = i % 2 ? 'rgba(141,255,190,0.75)' : 'rgba(230,255,240,0.6)'; ctx.lineWidth = 3 + k * 2;
        ctx.beginPath(); ctx.ellipse(p.x + off, yy, rw, 8 + k * 10, 0, t * 0.4 + i, t * 0.4 + i + 4.4); ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const yy = p.y - R() * H, an = (R() - 0.5) * 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - Math.cos(an) * 60, yy - Math.sin(an) * 20); ctx.lineTo(p.x + Math.cos(an) * 60, yy + Math.sin(an) * 20); ctx.stroke();
      }
    },
  },

  // ====================== SAITAMA — Consecutive Normal Punches ======================
  fistBarrage: {
    update: (p, g) => {
      const o = p.owner;
      if (o.state !== 'attack') p.life = Math.min(p.life, 3);
      p.x = o.x + p.dir * 118; p.y = o.y - 48;
      if (p.t % 5 === 0) g.fx.impact(p.x + p.dir * (R() * 60 - 10), p.y + (R() - 0.5) * 90, 30, '#ffe58a');
      if (p.t % 3 === 0) sfx('hit');
    },
    draw: (p, ctx) => {
      const o = p.owner;
      for (let i = 0; i < 16; i++) {
        const fx = p.x + p.dir * (R() * 90 - 40), fy = p.y + (R() - 0.5) * 110;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(o.x + p.dir * 30, o.y - 48 + (fy - p.y) * 0.2); ctx.lineTo(fx - p.dir * 16, fy); ctx.stroke();
        fist(ctx, fx, fy, 13 + R() * 4, p.dir, '#d8322c', '#f4f4f6');
      }
    },
  },

  // ====================== GOJO — Cursed Technique: Blue ======================
  blueOrb: {
    update: (p, g) => {
      if (p.t === Math.max(1, p.delay)) sfx('gojo-blue');
      if (!p.active) return;
      for (const f of g.fighters) {
        if (!g.canDamage(p.owner, f) || !f.alive || f.invuln > 0) continue;
        const dx = p.x - f.x, dy = p.y - (f.y - 40), d = Math.hypot(dx, dy);
        if (d < (p.data.pullRadius ?? Math.max(p.w, p.h) * 1.5) && d > 10) { const mul = g.knockbackMultiplier(p.owner); f.vx += dx / d * .9 * mul; f.vy += dy / d * .7 * mul; }
      }
    },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'blue'),
  },

  // ====================== GOJO ULT — Hollow Purple ======================
  hollowPurple: {
    update: (p, g) => {
      if (p.t === Math.max(1, p.delay)) { p.follow = false; p.vx = p.dir * 12; sfx('gojo-purple'); g.flashScreen('#b067ff', 0.22); g.shake(22); }
    },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'purple'),
  },

  // ====================== YUJI — Black Flash cracks ======================
  blackFlashCrack: {
    init: (p) => { p.data.br = Array.from({ length: 9 }, (_, i) => i / 9 * TAU + (R() - 0.5) * 0.4); },
    update: (p, g) => { if (p.t === 1) { g.shake(14); g.flashScreen('#ff2a4a', 0.28); sfx('heavyhit'); } },
    onHit: (_p, t, g) => { g.fx.text(t.x, t.y - 90, 'BLACK FLASH', '#ff2a4a', 30, 44); },
    draw: (p, ctx) => {
      const k = 1 - p.life / p.max, L = 50 + k * 110, a = Math.max(0, 1 - k * 1.1);
      ctx.globalAlpha = a;
      for (const an of p.data.br) {
        const x2 = p.x + Math.cos(an) * L, y2 = p.y + Math.sin(an) * L;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,40,70,0.7)'; ctx.lineWidth = 9;
        ctx.beginPath(); jag(ctx, p.x, p.y, x2, y2, 5, 22); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#050005'; ctx.lineWidth = 4;
        ctx.beginPath(); jag(ctx, p.x, p.y, x2, y2, 5, 22); ctx.stroke();
      }
      ctx.fillStyle = '#050005'; ctx.beginPath(); ctx.arc(p.x, p.y, 26 * a + 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff2a4a'; ctx.lineWidth = 3; ctx.stroke();
    },
  },

  // ====================== YUJI ULT — Malevolent Shrine ======================
  shrine: {
    update: (p, g) => {
      if (p.t === Math.max(1, p.delay)) { sfx('domain'); g.flashScreen('#3a0010', 0.18); g.shake(16); }
      if (p.active && p.t % 3 === 0) sfx('swing');
    },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'shrine'),
  },

  // ====================== SUKUNA — Shibuya Cleave / Fuga / Shrine ======================
  sukunaCleave: {
    init: (p) => { p.data.seed = R() * TAU; p.data.eye = R() < .5 ? -1 : 1; },
    update: (p, g) => {
      const d = Math.max(1, p.delay);
      if (p.t === d) {
        g.sukunaSlash(p.owner, (p.dmg || 0) >= 10 ? 'strong' : 'light');
        // Stretch cuts across the whole hit volume: long thin boxes get one long
        // cut along their axis, squarer boxes get a criss-cross of Dismantles.
        const len = Math.max(p.w, p.h) * 1.3 + 30, ratio = p.w / p.h;
        const axis = ratio > 1.6 ? 0 : ratio < .6 ? Math.PI / 2 : p.dir > 0 ? -.5 : Math.PI + .5;
        const n = ratio > 1.6 || ratio < .6 ? 1 : 3;
        for (let i = 0; i < n; i++) g.fx.cut(p.x + (R() - .5) * p.w * .3, p.y + (R() - .5) * p.h * .3, len, axis + (i ? (i % 2 ? 1.05 : -1.05) : (R() - .5) * .25), 22, 1.1, i * 3);
      }
      if (p.active && p.rehit && (p.t - d) % Math.max(4, p.rehit) === 0 && p.t > d) g.fx.cut(p.x + (R() - .5) * p.w * .5, p.y + (R() - .5) * p.h * .5, Math.max(p.w, p.h) * .9 + 20, R() * Math.PI, 18, .9);
    },
    draw: (p, ctx) => {
      if (p.t >= p.delay) return; // the fx layer owns the animated cut
      const k = p.t / Math.max(1, p.delay);
      ctx.save(); ctx.globalAlpha = .25 + k * .35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x - p.w * .5 * k, p.y); ctx.lineTo(p.x + p.w * .5 * k, p.y); ctx.stroke(); ctx.restore();
    },
  },
  sukunaBlackFlash: {
    init: (p) => { p.data.seed = R() * TAU; },
    update: (p, g) => { if (p.t === 1) { sfx('purple'); g.fx.impact(p.x, p.y, 110, '#ff174d'); g.flashScreen('#ff174d', .65); g.shake(16); } },
    draw: (p, ctx, t) => {
      const a = fade(p, 9), r = p.w * .5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) { const an = p.data.seed + i / 12 * TAU; ctx.strokeStyle = i % 2 ? '#ff174d' : '#fff0e9'; ctx.lineWidth = i % 2 ? 4 : 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * r * (1 + Math.sin(t * .2 + i) * .12), Math.sin(an) * r); ctx.stroke(); }
      ctx.fillStyle = '#080006'; ctx.beginPath(); ctx.arc(0, 0, r * .24, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff315d'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    },
  },
  sukunaFuga: {
    init: (p) => { p.data.seed = R() * TAU; },
    update: (p, g) => {
      if (p.active && !p.data.landed) p.vy += p.data.gravity ?? .38;
      if (p.t % 2 === 0) { g.fx.add({ x: p.x - p.dir * R() * 35, y: p.y + (R() - .5) * 30, vx: -p.dir * 3, vy: -R() * 2, color: R() < .5 ? '#ff5a24' : '#ffe09a', kind: 'ember', life: 20, size: 8 }); }
      const gy = g.groundBelow(p.x, p.y - 10);
      if (!p.data.landed && gy !== null && p.y >= gy - 4) {
        p.data.landed = true; p.life = 8; p.y = gy; p.vy = 0; p.vx *= .2;
        g.fx.ring(p.x, gy, 14, 190, '#ff5a24', 24, 13); g.fx.impact(p.x, gy - 8, 100, '#ff8a3a');
        g.fx.burst(p.x, gy - 6, 24, '#ff5a24', 9, 'ember', 30, 9); g.shake(10);
        // The detonation is a heavy impact, so it earns the powerful cleave.
        g.sukunaSlash(p.owner, 'strong');
      }
    },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'fuga'),
  },
  sukunaFurnace: {
    update: (p, g) => {
      if (p.t === p.delay) { g.sukunaSlash(p.owner, 'strong'); g.shake(15); g.fx.burst(p.x, p.y, 30, '#ffad43', 8, 'ember', 24, 5); }
    },
    draw: (p, ctx, t) => {
      const b = p.rect(); ctx.save();
      ctx.globalAlpha = fade(p) * (p.active ? .9 : .22);
      ctx.strokeStyle = '#ffad43'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, b.y + b.h, b.w * .49, 8, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 11; i++) {
        const x = b.x + (i + .5) / 11 * b.w, height = b.h * (.5 + .45 * Math.abs(Math.sin(t * .12 + i)));
        ctx.fillStyle = i % 2 ? '#ff7826' : '#ffd979'; ctx.beginPath(); ctx.moveTo(x - 11, b.y + b.h);
        ctx.quadraticCurveTo(x + 18, b.y + b.h - height * .4, x + 4, b.y + b.h - height);
        ctx.quadraticCurveTo(x - 9, b.y + b.h - height * .25, x + 11, b.y + b.h); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
  },
  sukunaShrine: {
    init: (p) => { p.data.seed = R() * TAU; },
    update: (p, g) => {
      // The domain is already chanting when this entity is created, so the
      // shrine itself lands with a wet, architectural boom rather than replaying
      // the domain sample on top of itself.
      if (p.t < p.delay) {
        if (p.t % 4 === 0) g.fx.add({ x: p.x + (R() - .5) * p.w * .5, y: p.y + p.h * .5 - R() * 30, vx: (R() - .5) * 4, vy: -3 - R() * 4, color: R() < .5 ? '#ff2347' : '#1c0208', kind: 'glow', life: 26, size: 6 + R() * 8 });
        return;
      }
      if (p.t === p.delay) {
        g.fx.ring(p.x, p.y + p.h * .5, 30, Math.min(p.w * .5, 620), '#ff2347', 34, 22);
        g.fx.impact(p.x, p.y + p.h * .34, Math.min(p.w * .3, 260), '#ff315d');
        g.flashScreen('#20020a', .26); g.shake(20); sfx('heavyhit', 2);
      }
      // Dismantle storm: the entire domain is shredded by the original animated
      // black gashes, end to end.
      if (p.active) {
        if (p.t % 2 === 0) for (let i = 0; i < 2; i++) g.fx.cut(p.x + (R() - .5) * p.w * .95, p.y + (R() - .5) * p.h * .95, 90 + R() * 190, (R() - .5) * 1.6 + (R() < .5 ? 0 : Math.PI / 2), 16 + (R() * 8 | 0), .8 + R() * .5);
        if (p.t % 24 === 0) g.shake(4);
      }
    },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'shrine'),
  },

  // ====================== SHADOW DIO — knives & palm ======================
  /**
   * DIO's throwing knife — an actual knife, not a fan: a single-edged silver
   * blade, a gold guard, a wrapped grip and a pommel ring, spinning end over end
   * down its lane with a gold motion smear trailing off the handle.
   */
  dioKnife: {
    init: (p) => { p.data.seed = R() * TAU; p.data.spin = R() * 4; },
    update: (p, g) => {
      p.data.spin += .44;
      if (p.t % 2 === 0) g.fx.add({ x: p.x - p.dir * (6 + R() * 18), y: p.y + (R() - .5) * 7, color: '#ffffff', kind: 'streak', vx: -p.dir * 2.6, life: 7, size: 1.6 });
      if (p.life <= 5) { g.fx.add({ x: p.x, y: p.y, color: p.col, kind: 'spark', life: 8, size: 2 }); g.fx.ring(p.x, p.y, 2, 13, p.col2, 8, 2); }
    },
    draw: (p, ctx) => {
      const a = fade(p, 8);
      const len = Math.max(p.w, p.h), L = len * .5, bw = Math.max(2.4, len * .105);
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a;
      // Gold smear so a spinning blade still reads as a fast, thrown object.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .55;
      const sm = ctx.createLinearGradient(-L * 1.7, 0, L, 0);
      sm.addColorStop(0, 'rgba(255,228,92,0)'); sm.addColorStop(.62, hexA(p.col2, .42)); sm.addColorStop(1, 'rgba(255,255,255,.4)');
      ctx.fillStyle = sm;
      ctx.beginPath(); ctx.moveTo(-L * 1.7, -1.7); ctx.lineTo(L, -.7); ctx.lineTo(L, .7); ctx.lineTo(-L * 1.7, 1.7); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.rotate(p.data.spin * (p.vx >= 0 ? 1 : -1));
      // Blade: a single-edged tanto profile with a needle point.
      ctx.beginPath();
      ctx.moveTo(-bw * .2, -bw * .35);
      ctx.lineTo(L * .62, -bw * .52);
      ctx.lineTo(L * .95, -bw * .16);
      ctx.lineTo(L, 0);
      ctx.lineTo(L * .58, bw * .78);
      ctx.lineTo(-bw * .2, bw * .6);
      ctx.closePath();
      const bg = ctx.createLinearGradient(0, -bw, 0, bw);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(.45, '#c8d3e2'); bg.addColorStop(.72, '#8d97a8'); bg.addColorStop(1, '#e8eef8');
      ctx.fillStyle = bg; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.1, len * .034); ctx.fill(); ctx.stroke();
      // Polished cutting edge.
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = Math.max(.8, len * .026);
      ctx.beginPath(); ctx.moveTo(L * .56, bw * .52); ctx.lineTo(L * .94, -bw * .1); ctx.stroke();
      // Gold crossguard.
      ctx.fillStyle = p.col2; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(-bw * 1.6, -bw * 1.2, bw * 1.25, bw * 2.4, bw * .4); ctx.fill(); ctx.stroke();
      // Wrapped grip and pommel ring.
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.roundRect(-L * .63, -bw * .8, L * .6, bw * 1.6, bw * .5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#6b5a44'; ctx.lineWidth = Math.max(.7, len * .02);
      for (let i = 0; i < 4; i++) { const gx = -L * .58 + i * L * .14; ctx.beginPath(); ctx.moveTo(gx, -bw * .74); ctx.lineTo(gx + L * .07, bw * .74); ctx.stroke(); }
      ctx.fillStyle = p.col2; ctx.strokeStyle = OL; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(-L * .66, 0, bw * .74, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  },
  dioPalm: {
    init: (p) => { p.data.seed = R() * TAU; },
    update: (p, g) => {
      if (p.t % 2 === 0) for (let i = 0; i < 2; i++) g.fx.add({ x: p.x - p.dir * R() * 26, y: p.y + (R() - .5) * 30, vx: -p.dir * 3, vy: (R() - .5) * 2, color: i ? '#8affd0' : '#ffe45c', kind: 'glow', life: 13, size: 4 });
      if (p.t % 7 === 0) g.fx.ring(p.x, p.y, 12, 34, '#ffe45c', 9, 2);
    },
    draw: (p, ctx) => {
      const a = fade(p, 9), r = Math.max(p.w, p.h) * .5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1); ctx.globalAlpha = a;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g0 = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g0.addColorStop(0, 'rgba(255,255,255,.85)'); g0.addColorStop(.35, hexA('#8affd0', .6 * a)); g0.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
      // Open hand pushing forward.
      ctx.fillStyle = '#e6cbb6'; ctx.strokeStyle = OL; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.roundRect(-r * .2, -r * .5, r * .62, r, r * .3); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#f0d8c4';
        ctx.beginPath(); ctx.roundRect(r * .26, -r * .46 + i * r * .24, r * .34, r * .16, r * .08); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#ffe45c';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .5, r * .62, 0, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },

  // ====================== DEKU / SAITAMA — wind pressure cone ======================
  windCone: {
    update: (p, g) => {
      const o = p.owner, max = p.data.max || 340, big = !!p.data.big;
      const L = max * Math.min(1, p.t / (big ? 10 : 7)), H = (big ? 520 : 150) * Math.min(1, p.t / 8) + 40;
      p.data.L = L; p.w = L; p.h = H;
      p.x = o.x + p.dir * (30 + L / 2); p.y = o.y - 46;
      if (big && p.t % 2 === 0) g.shake(10);
      if (!big && p.t < 8) for (let i = 0; i < 2; i++) g.fx.add({ x: o.x + p.dir * (40 + R() * L), y: p.y + (R() - 0.5) * H, vx: p.dir * 9, color: '#d8ffe6', kind: 'streak', life: 12, size: 2.5 });
    },
    draw: (p, ctx, t) => {
      const o = p.owner, L = p.data.L || 0, H = p.h, big = !!p.data.big, a = Math.min(1, p.life / 10);
      const x0 = o.x + p.dir * 30, y = p.y;
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      const cg = ctx.createLinearGradient(x0, 0, x0 + p.dir * L, 0);
      cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(0.5, big ? 'rgba(255,245,210,0.45)' : 'rgba(200,255,220,0.4)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(x0, y - 16); ctx.lineTo(x0 + p.dir * L, y - H / 2); ctx.lineTo(x0 + p.dir * L, y + H / 2); ctx.lineTo(x0, y + 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = big ? 4 : 2;
      for (let i = 0; i < (big ? 18 : 8); i++) {
        const k = R(), yy = y + (R() - 0.5) * H * k, xs = x0 + p.dir * L * k * 0.5;
        ctx.beginPath(); ctx.moveTo(xs, yy); ctx.lineTo(xs + p.dir * (60 + R() * 140), yy); ctx.stroke();
      }
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x0 + p.dir * L * (0.25 + i * 0.25), y, 10 + i * 6, H * (0.2 + i * 0.12), 0, 0, TAU); ctx.stroke(); }
      if (big) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x0 + p.dir * L * 0.6, y + s * (H * 0.55 + 20), L * 0.45, 40, 0, 0, TAU); ctx.fill(); }
      } else {
        for (let i = 0; i < 3; i++) bolt(ctx, x0 + p.dir * R() * L * 0.6, y + (R() - 0.5) * H * 0.6, x0 + p.dir * R() * L, y + (R() - 0.5) * H, '#8dffb0', 1.1, 16);
      }
      void t;
    },
  },

  // ====================== TODOROKI — Ice ridge / glacier ======================
  iceRidge: {
    init: (p) => { p.data.x0 = p.data.x0 ?? p.x; },
    update: (p, g) => {
      if (p.t % 2 === 0) g.fx.add({ x: p.x, y: p.y - R() * 40, vx: (R() - 0.5) * 4, vy: -2 - R() * 3, color: '#eafaff', kind: 'shard', life: 20, size: 6, grav: 0.3 });
      if (p.data.big && p.t % 2 === 0) g.fx.add({ x: p.data.x0 + (p.x - p.data.x0) * R(), y: p.y - p.h * 0.8 * R(), vy: -3, color: R() < 0.5 ? '#ff7a3a' : '#ffd07a', kind: 'ember', life: 26, size: 10 });
      if (p.t % 4 === 0) sfx('land');
    },
    draw: (p, ctx) => {
      const x0 = p.data.x0, x1 = p.x, big = !!p.data.big, H = p.h;
      const a = Math.min(1, p.life / 14);
      ctx.globalAlpha = a;
      const span = Math.abs(x1 - x0), step = big ? 34 : 24, n = Math.max(1, Math.floor(span / step));
      for (let i = 0; i <= n; i++) {
        const k = i / Math.max(1, n), x = x0 + (x1 - x0) * k;
        const h = H * (0.45 + 0.55 * Math.abs(Math.sin(i * 2.37 + 0.5))) * (0.45 + k * 0.55);
        const w = step * (0.9 + Math.abs(Math.sin(i * 1.7)) * 0.6);
        const g = ctx.createLinearGradient(x, p.y - h, x, p.y);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#bfe9ff'); g.addColorStop(1, '#4a9ad0');
        ctx.fillStyle = g; ctx.strokeStyle = '#1a4a70'; ctx.lineWidth = 2;
        const tilt = p.dir * (4 + (i % 3) * 5);
        ctx.beginPath(); ctx.moveTo(x - w * 0.6, p.y); ctx.lineTo(x + tilt, p.y - h); ctx.lineTo(x + w * 0.6, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + tilt, p.y - h); ctx.lineTo(x - w * 0.15, p.y - h * 0.2); ctx.stroke();
      }
      if (big) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x1, p.y - H * 0.5, H * 0.6, '#ff7a3a', 0.5);
      }
    },
  },

  // ====================== EREN — Titan arm punch ======================
  titanArm: {
    update: (p, g) => {
      const o = p.owner, max = 250;
      const L = p.t <= 10 ? max * (p.t / 10) : p.t <= 16 ? max : max * Math.max(0, 1 - (p.t - 16) / 10);
      p.data.L = L; p.x = o.x + p.dir * (20 + L); p.y = o.y - 70;
      if (p.t % 2 === 0) g.fx.add({ x: o.x - p.dir * 30 + (R() - 0.5) * 40, y: o.y - 110 + (R() - 0.5) * 40, vy: -2, color: '#e8e2d4', kind: 'smoke', life: 34, size: 14 });
      if (p.t === 10) { g.shake(10); sfx('heavyhit'); }
    },
    draw: (p, ctx) => {
      const o = p.owner, sx = o.x - p.dir * 44, sy = o.y - 138, ex = p.x, ey = p.y;
      const r = 40;
      ctx.lineCap = 'round';
      ctx.strokeStyle = OL; ctx.lineWidth = 58; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2, sy - 20, ex - p.dir * r * 0.6, ey); ctx.stroke();
      const mg = ctx.createLinearGradient(sx, sy - 30, sx, sy + 30);
      mg.addColorStop(0, '#e8b098'); mg.addColorStop(0.5, '#b8433a'); mg.addColorStop(1, '#6a1a18');
      ctx.strokeStyle = mg; ctx.lineWidth = 50; ctx.stroke();
      ctx.strokeStyle = 'rgba(80,10,10,0.7)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) { const k = 0.15 + i * 0.13; const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k - 12; ctx.beginPath(); ctx.moveTo(x - 10, y - 16); ctx.quadraticCurveTo(x + 6, y, x - 6, y + 18); ctx.stroke(); }
      fist(ctx, ex, ey, r, p.dir, '#d99a86');
    },
  },

  // ====================== EREN ULT — The Rumbling (titan foot) ======================
  titanFoot: {
    update: (p, g) => {
      if (p.t < p.delay && p.t % 6 === 0) g.shake(2 + p.t / 8);
      if (p.t === p.delay) { g.shake(34); g.flashScreen('#ffd9a0', 0.4); sfx('heavyhit', 2); sfx('ko'); g.fx.ring(p.x, p.y, 20, 360, '#c39a5a', 30, 22); for (let i = 0; i < 40; i++) g.fx.add({ x: p.x + (R() - 0.5) * 300, y: p.y - 4, vx: (R() - 0.5) * 12, vy: -3 - R() * 9, color: R() < 0.5 ? '#8a6a44' : '#e8e2d4', kind: R() < 0.5 ? 'shard' : 'smoke', life: 40, size: 12, grav: 0.3 }); }
    },
    draw: (p, ctx) => {
      const k = Math.min(1, p.t / p.delay), W = p.w;
      ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.5})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, W * (0.35 + k * 0.4), 18 + k * 12, 0, 0, TAU); ctx.fill();
      const drop = Math.max(0, (p.delay - p.t)) * 48;
      const fy = p.y - drop;
      if (fy < p.y - 1200) return;
      const sole = fy, top = fy - 180;
      const lg = ctx.createLinearGradient(p.x - 90, 0, p.x + 90, 0);
      lg.addColorStop(0, '#6a1a18'); lg.addColorStop(0.5, '#c0584a'); lg.addColorStop(1, '#6a1a18');
      ctx.fillStyle = lg; ctx.strokeStyle = OL; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(p.x - 80, top - 2000); ctx.lineTo(p.x + 80, top - 2000); ctx.lineTo(p.x + 90, top); ctx.lineTo(p.x - 90, top); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c47a66';
      ctx.beginPath(); ctx.moveTo(p.x - 110, top); ctx.lineTo(p.x + 150, top + 60); ctx.lineTo(p.x + 150, sole); ctx.lineTo(p.x - 120, sole); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(p.x + 70 + i * 22, sole - 16, 13, 18, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(80,10,10,0.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(p.x - 60 + i * 34, top - 200); ctx.lineTo(p.x - 50 + i * 34, top - 20); ctx.stroke(); }
      if (p.t > p.delay) {
        ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.lineWidth = 3;
        for (let i = 0; i < 7; i++) { const an = Math.PI + i / 6 * Math.PI; ctx.beginPath(); jag(ctx, p.x, p.y, p.x + Math.cos(an) * 190, p.y + 4, 5, 10); ctx.stroke(); }
      }
    },
  },

  // ====================== DENJI — boomerang saw disc ======================
  sawDisc: {
    update: (p, g) => {
      p.vx -= p.dir * 0.72;
      const o = p.owner;
      p.y += ((o.y - 44) - p.y) * 0.05;
      if (p.t > 16 && Math.abs(p.x - o.x) < 30) { p.life = 0; p.fin = undefined; }
      g.fx.add({ x: p.x + (R() - 0.5) * 30, y: p.y + (R() - 0.5) * 30, vx: (R() - 0.5) * 6, vy: -R() * 4, color: R() < 0.5 ? '#ff9d1f' : '#ffe0a0', kind: 'spark', life: 12, size: 3 });
      if (p.t % 4 === 0) sfx('swing');
    },
    draw: (p, ctx, t) => {
      const r = p.w * 0.5;
      ctx.translate(p.x, p.y); ctx.rotate(t * 0.9 * p.dir);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, r * 1.5, '#ff9d1f', 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff9d1f'; ctx.strokeStyle = OL; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) { const a0 = i / 18 * TAU, a1 = (i + 0.5) / 18 * TAU; ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); ctx.lineTo(Math.cos(a1) * r * 1.22, Math.sin(a1) * r * 1.22); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const dg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      dg.addColorStop(0, '#f4f6fa'); dg.addColorStop(1, '#6a707c');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2a32'; ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0.3, 1.6); ctx.stroke();
    },
  },

  // ====================== GOKU ULT — Spirit Bomb ======================
  spiritBomb: {
    update: (p, g) => {
      const charge = Math.min(1, p.t / p.delay), r = 24 + charge * 110;
      p.w = p.h = r * 1.8; p.data.r = r;
      if (p.t < p.delay) for (let i = 0; i < 4; i++) { const an = R() * TAU, d = 300 + R() * 200; g.fx.add({ x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d, vx: -Math.cos(an) * 14, vy: -Math.sin(an) * 14, color: R() < 0.5 ? '#bff4ff' : '#ffffff', kind: 'streak', life: 22, size: 2.5 }); }
      if (p.t === p.delay) { p.follow = false; p.vx = p.dir * 8.5; p.vy = 6.5; sfx('ult'); g.shake(18); g.flashScreen('#bff4ff', 0.35); }
      if (p.t > p.delay && landed(p, g, r * 0.4)) { p.life = 0; g.shake(30); sfx('heavyhit', 2); g.fx.ring(p.x, p.y, 20, 380, '#8fe3ff', 32, 22); }
    },
    draw: (p, ctx, t) => {
      const r = p.data.r || 20;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, r * 1.7, '#4aa8ff', 0.7);
      const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 2, p.x, p.y, r);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(160,230,255,0.9)'); g.addColorStop(1, 'rgba(40,130,255,0.3)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.05, r * (0.3 + i * 0.25), t * 0.03 + i, 0, TAU); ctx.stroke(); }
      if (p.t < p.delay) { const o = p.owner; ctx.strokeStyle = 'rgba(190,240,255,0.5)'; ctx.lineWidth = 2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(o.x + s * 8, o.y - 70); ctx.lineTo(p.x + s * r * 0.4, p.y + r * 0.8); ctx.stroke(); } }
    },
  },

  // ====================== NARUTO ULT — Kurama avatar ======================
  foxAvatar: {
    update: (p, g) => {
      if (p.t === p.delay) { p.follow = false; p.vx = p.dir * 14; sfx('ult'); sfx('fire'); g.shake(20); g.flashScreen('#ffb52e', 0.4); }
      if (p.t % 2 === 0) g.fx.add({ x: p.x + (R() - 0.5) * p.w, y: p.y + (R() - 0.5) * p.h, vy: -3, color: R() < 0.5 ? '#ff8a1a' : '#ffd24a', kind: 'ember', life: 24, size: 12 });
    },
    draw: (p, ctx, t) => {
      const a = Math.min(1, p.t / 14, p.life / 14);
      ctx.globalAlpha = a * 0.92;
      ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
      // nine tails
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const an = Math.PI * 0.62 + (i / 8) * Math.PI * 0.76 + Math.sin(t * 0.1 + i) * 0.08;
        ctx.strokeStyle = 'rgba(255,130,30,0.55)'; ctx.lineWidth = 22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-60, 20); ctx.quadraticCurveTo(-60 + Math.cos(an) * 120, 20 + Math.sin(an) * 60 - 60, -60 + Math.cos(an) * 220, Math.sin(an) * 170 - 20 + Math.sin(t * 0.15 + i) * 16); ctx.stroke();
      }
      glow(ctx, 0, 0, 180, '#ff8a1a', 0.5);
      ctx.globalCompositeOperation = 'source-over';
      const hg = ctx.createLinearGradient(0, -100, 0, 90);
      hg.addColorStop(0, '#ffc24a'); hg.addColorStop(1, '#e05a0a');
      ctx.fillStyle = hg; ctx.strokeStyle = '#6a1a02'; ctx.lineWidth = 4;
      // ears
      for (const ex of [-40, 20]) { ctx.beginPath(); ctx.moveTo(ex - 22, -60); ctx.lineTo(ex + 4, -150); ctx.lineTo(ex + 28, -62); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      // head
      ctx.beginPath(); ctx.moveTo(-80, -50); ctx.quadraticCurveTo(0, -100, 70, -40); ctx.lineTo(150, 0); ctx.lineTo(80, 30); ctx.quadraticCurveTo(10, 90, -80, 60); ctx.quadraticCurveTo(-110, 0, -80, -50); ctx.closePath(); ctx.fill(); ctx.stroke();
      // mouth
      ctx.strokeStyle = '#3a0c02'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(40, 22); ctx.quadraticCurveTo(90, 18, 140, 4); ctx.stroke();
      ctx.fillStyle = '#fff'; for (const fx of [70, 100]) { ctx.beginPath(); ctx.moveTo(fx, 16); ctx.lineTo(fx + 5, 30); ctx.lineTo(fx + 10, 14); ctx.fill(); }
      // eye
      ctx.fillStyle = '#ff2a1a'; ctx.beginPath(); ctx.moveTo(10, -30); ctx.quadraticCurveTo(40, -46, 62, -22); ctx.quadraticCurveTo(36, -18, 10, -30); ctx.fill();
      ctx.fillStyle = '#1a0000'; ctx.fillRect(36, -38, 4, 16);
      // whisker marks
      ctx.strokeStyle = '#3a0c02'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-30, 10 + i * 12); ctx.lineTo(10, 6 + i * 12); ctx.stroke(); }
    },
  },

  // ====================== ICHIGO ULT — Mugetsu ======================
  mugetsu: {
    update: (p, g) => {
      for (let i = 0; i < 5; i++) g.fx.add({ x: p.x + (R() - 0.5) * p.w, y: p.y + (R() - 0.5) * p.h, vx: -p.vx * 0.2, vy: -1, color: R() < 0.7 ? '#050008' : '#c0102a', kind: R() < 0.7 ? 'smoke' : 'glow', life: 30, size: 16 });
      if (p.t % 4 === 0) g.shake(8);
    },
    draw: (p, ctx, t) => {
      const a = Math.min(1, p.t / 6, p.life / 12), W = p.w, H = p.h;
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, W * 1.4, '#c0102a', 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      const steps = 20;
      for (let i = 0; i <= steps; i++) { const y = p.y - H / 2 + H * i / steps; ctx.lineTo(p.x + p.dir * (W / 2 + Math.sin(t * 0.5 + i * 1.3) * 18), y); }
      for (let i = steps; i >= 0; i--) { const y = p.y - H / 2 + H * i / steps; ctx.lineTo(p.x - p.dir * (W / 2 + Math.sin(t * 0.4 + i) * 22), y); }
      ctx.closePath();
      ctx.fillStyle = '#030006'; ctx.fill();
      ctx.strokeStyle = '#c0102a'; ctx.lineWidth = 4; ctx.shadowColor = '#ff1a3a'; ctx.shadowBlur = 24; ctx.stroke(); ctx.shadowBlur = 0;
    },
  },

  // ====================== ZORO ULT — Asura: Nine Swords ======================
  nineSword: {
    init: (p) => { p.data.angs = Array.from({ length: 9 }, (_, i) => -1.4 + i * 0.35 + (R() - 0.5) * 0.2); },
    update: (p, g) => { if (p.t === p.delay) { sfx('ult'); g.flashScreen('#8dffbe', 0.35); g.shake(16); } if (p.active && p.t % 3 === 0) sfx('swingH'); },
    draw: (p, ctx) => {
      const k = Math.min(1, p.t / p.delay), a = Math.min(1, p.life / 12);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, 200 * k, '#2fa36a', 0.5);
      // nine blades converging
      if (p.t < p.delay) {
        for (let i = 0; i < 9; i++) {
          const an = i / 9 * TAU, d = 260 - k * 120;
          const bx = p.x + Math.cos(an) * d, by = p.y + Math.sin(an) * d * 0.7;
          ctx.save(); ctx.translate(bx, by); ctx.rotate(an + Math.PI);
          ctx.fillStyle = 'rgba(230,255,240,0.85)'; ctx.fillRect(0, -2.5, 70, 5);
          ctx.fillStyle = 'rgba(60,40,20,0.9)'; ctx.fillRect(-18, -3, 18, 6);
          ctx.restore();
        }
        return;
      }
      const since = p.t - p.delay;
      p.data.angs.forEach((an: number, i: number) => {
        if (since < i * 3) return;
        const L = 230, fl = Math.max(0.25, 1 - (since - i * 3) / 20);
        ctx.strokeStyle = `rgba(141,255,190,${0.7 * fl})`; ctx.lineWidth = 16 * fl;
        ctx.beginPath(); ctx.moveTo(p.x - Math.cos(an) * L, p.y - Math.sin(an) * L); ctx.lineTo(p.x + Math.cos(an) * L, p.y + Math.sin(an) * L); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${fl})`; ctx.lineWidth = 4 * fl; ctx.stroke();
      });
    },
  },

  // ====================== SASUKE ULT — Indra's Arrow ======================
  indraArrow: {
    update: (p, g) => {
      if (p.t === p.delay) { p.follow = false; p.vx = p.dir * 22; sfx('ult'); sfx('elec'); g.flashScreen('#c9b0ff', 0.45); g.shake(22); }
      if (p.t >= p.delay) for (let i = 0; i < 4; i++) g.fx.add({ x: p.x - p.dir * R() * 300, y: p.y + (R() - 0.5) * 60, vx: -p.dir * 4, color: R() < 0.5 ? '#b89dff' : '#ffffff', kind: 'streak', life: 14, size: 3 });
    },
    draw: (p, ctx, t) => {
      ctx.globalCompositeOperation = 'lighter';
      if (p.t < p.delay) {
        const k = p.t / p.delay;
        ctx.strokeStyle = `rgba(185,157,255,${0.4 + k * 0.5})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x - p.dir * 30, p.y, 80, p.dir > 0 ? -1.2 : Math.PI - 1.2 + 2.4 - 2.4, p.dir > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
        glow(ctx, p.x, p.y, 20 + k * 50, '#8a5cff', 1);
        if (R() < 0.6) bolt(ctx, p.x - p.dir * 60, p.y + (R() - 0.5) * 100, p.x, p.y, '#b89dff', 1.2, 14);
        return;
      }
      const a = Math.min(1, p.life / 12);
      ctx.globalAlpha = a;
      for (let i = 0; i < 3; i++) bolt(ctx, p.x - p.dir * 420, p.y + (R() - 0.5) * 30, p.x - p.dir * 40, p.y, '#b89dff', 2.5, 30);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
      const hg = ctx.createLinearGradient(-60, 0, 110, 0);
      hg.addColorStop(0, 'rgba(120,70,255,0.6)'); hg.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(-40, -60); ctx.lineTo(-10, 0); ctx.lineTo(-40, 60); ctx.closePath(); ctx.fill();
      ctx.restore();
      glow(ctx, p.x, p.y, 120, '#8a5cff', 0.6);
      void t;
    },
  },

  // ====================== GOJO — Reversal: Red (repulsion burst) ======================
  redBlast: {
    update: (p, g) => {
      if (p.t === Math.max(1, p.delay)) {
        sfx('gojo-red'); g.shake(12); g.flashScreen('#ff3a5a', 0.25);
        for (const f of g.fighters) {
          if (!g.canDamage(p.owner, f) || !f.alive || f.invuln > 0) continue;
          const dx = f.x - p.x, dy = (f.y - 40) - p.y, d = Math.hypot(dx, dy);
          if (d < (p.data.pushRadius ?? Math.max(p.w, p.h) * .5) && d > 1) { const mul = g.knockbackMultiplier(p.owner); f.vx += dx / d * 9 * mul; f.vy += (dy / d * 6 - 3) * mul; }
        }
        g.fx.ring(p.x, p.y, 10, 220, '#ff3a5a', 20, 10);
      }
    },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'red'),
  },

  // Reusable stationary/moving domain; collision and lifetime remain kit-owned.
  unlimitedVoid: {
    update: (p) => { if (p.t === Math.max(1, p.delay)) sfx('gojo-void'); },
    draw: (p, ctx, t) => drawBossSignature(p, ctx, t, 'void'),
  },

  // ====================== NARUTO — Rasengan hand orb (visual attachment) ======================
  rasenganOrb: {
    update: (p) => { if (p.owner.state !== 'attack') p.life = Math.min(p.life, 3); },
    draw: (p, ctx, t) => {
      const r = 20 + Math.sin(t * 0.5) * 2;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, r * 2.2, '#4ab8ff', 0.8);
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9fe0ff'); g.addColorStop(1, 'rgba(40,140,255,0.3)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const s = t * 0.6 + i * 1.57; ctx.beginPath(); ctx.arc(p.x, p.y, r * (0.4 + i * 0.16), s, s + 2.2); ctx.stroke(); }
    },
  },

  // ====================== GENERIC — gloved/skin fist flurry (visual attachment) ======================
  fistFlurryFx: {
    update: (p, g) => {
      const o = p.owner;
      if (o.state !== 'attack') p.life = Math.min(p.life, 2);
      p.x = o.x + o.facing * 100; p.y = o.y - 46; p.dir = o.facing;
      if (p.t % 6 === 0) g.fx.impact(p.x + p.dir * R() * 50, p.y + (R() - 0.5) * 80, 24, p.data.glove || '#ffd2a8');
    },
    draw: (p, ctx) => {
      const o = p.owner, col = p.data.glove || o.look.skin;
      for (let i = 0; i < 12; i++) {
        const fx = p.x + p.dir * (R() * 110 - 50), fy = p.y + (R() - 0.5) * 100;
        ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(o.x + p.dir * 14, o.y - 50); ctx.lineTo(fx - p.dir * 12, fy); ctx.stroke();
        fist(ctx, fx, fy, 12, p.dir, col);
      }
    },
  },
};

// palette extension for the serpent (Sasuke's lightning Kirin)
const baseSerpentDraw = SIGS.serpent.draw;
SIGS.serpent.draw = (p, ctx, t) => {
  if (p.data.pal !== 'kirin') return baseSerpentDraw(p, ctx, t);
  const tr = p.data.trail, a = fade(p), R0 = p.h * 0.42;
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = tr.length - 1; i >= 1; i -= 2) {
    const [x, y] = tr[i], [x2, y2] = tr[Math.max(0, i - 2)];
    bolt(ctx, x, y, x2, y2, '#b89dff', Math.max(1, 6 * (1 - i / tr.length)), 22);
    glow(ctx, x, y, R0 * (1 - i / (tr.length + 4)) * 1.4, '#8a5cff', 0.35);
  }
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
  ctx.fillStyle = 'rgba(230,220,255,0.9)';
  ctx.beginPath(); ctx.moveTo(-R0, -R0 * 0.7); ctx.lineTo(R0 * 1.8, -R0 * 0.1); ctx.lineTo(R0 * 0.8, R0 * 0.3); ctx.lineTo(R0 * 1.5, R0 * 0.7); ctx.lineTo(-R0, R0 * 0.7); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 3; i++) bolt(ctx, -R0, (R() - 0.5) * R0, R0 * 1.8, (R() - 0.5) * R0 * 0.6, '#ffffff', 1.2, 10);
  ctx.restore();
};
