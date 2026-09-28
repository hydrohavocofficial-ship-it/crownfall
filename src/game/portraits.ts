import { Look, POSES, drawFighter } from './render';

const cache: Record<string, string> = {};

function mockFighter(look: Look, scale: number) {
  return {
    x: 0, y: 0, vx: 0, vy: 0, facing: 1, scale, look, def: { styleId: '' },
    grounded: true, state: 'idle', stateT: 0, animT: 40, runPhase: 0,
    devilT: 0, godT: 0, auraT: 999, djumpT: 99, landT: 0, tumble: 0,
    hw: 15, h: 78, move: null, moveFrame: 0, moveActiveEnd: 0,
    tipX: 0, tipY: 0, footX: 0, footY: 0, handX: 0, handY: 0,
  };
}

/** Generates a dramatic anime "key visual" portrait for a fighter, drawn from their in-game art. */
export function makePortrait(id: string, look: Look, color: string): string {
  if (cache[id]) return cache[id];
  const S = 560;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = Math.round(S * 1.24);
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  const H = cv.height;

  // ---- backdrop ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mix(color, '#0b0a14', 0.62));
  bg.addColorStop(0.45, mix(color, '#07070d', 0.82));
  bg.addColorStop(1, '#05050a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, H);

  const cx = S * 0.5, cy = H * 0.46;

  // radial burst rays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.2;
    const w = 0.035 + (i % 3) * 0.02;
    ctx.fillStyle = `rgba(255,255,255,${i % 2 ? 0.035 : 0.02})`;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, S * 1.1, a - w, a + w); ctx.closePath(); ctx.fill();
  }
  // halo
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, S * 0.62);
  halo.addColorStop(0, hexA(color, 0.55));
  halo.addColorStop(0.42, hexA(color, 0.16));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, S * 0.62, 0, 7); ctx.fill();
  ctx.restore();

  // emblem ring
  ctx.save();
  ctx.translate(cx, cy - H * 0.04);
  ctx.strokeStyle = hexA('#ffffff', 0.1); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, S * 0.34, 0, 7); ctx.stroke();
  ctx.setLineDash([10, 16]); ctx.lineWidth = 2; ctx.strokeStyle = hexA(color, 0.5);
  ctx.beginPath(); ctx.arc(0, 0, S * 0.39, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // diagonal speed streaks
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const y = (i / 16) * H + ((i * 37) % 23);
    ctx.fillStyle = `rgba(255,255,255,${0.012 + (i % 4) * 0.008})`;
    ctx.save(); ctx.translate(0, y); ctx.rotate(-0.28);
    ctx.fillRect(-60, 0, S + 160, 2 + (i % 3) * 3);
    ctx.restore();
  }
  ctx.restore();

  // ---- ground glow ----
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(cx, H * 0.86, 4, cx, H * 0.86, S * 0.46);
  gl.addColorStop(0, hexA(color, 0.5)); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(cx, H * 0.86, S * 0.46, S * 0.1, 0, 0, 7); ctx.fill();
  ctx.restore();

  // ---- the fighter ----
  const f = mockFighter(look, 1);
  f.def.styleId = id.split(':')[0];
  const scale = H / 121;
  ctx.save();
  ctx.translate(cx - 4, H * 0.965);
  ctx.scale(scale, scale);
  // soft shadow
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 2, 26, 6, 0, 0, 7); ctx.fill(); ctx.restore();
  drawFighter(ctx, f, POSES.hero, 40);
  ctx.restore();

  // ---- Ultra Instinct key-visual pass ----
  // The in-game renderer already draws the silver crown and concentric eyes, but
  // a portrait is a hero shot: the platinum hair needs its own backlit halo or
  // pale-on-pale armour disappears into the backdrop, and the shadow under the
  // feet has to be flared out into a full cosmic ring. Both are additive passes
  // that a non-UI fighter never pays for.
  if (look.hairStyle === 'ui') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Backlit corona behind the head: a tight white core inside a wide cyan shell.
    const hx = cx - 4, hy = H * 0.965 - 96 * scale;
    const halo = ctx.createRadialGradient(hx, hy, 2, hx, hy, 96);
    halo.addColorStop(0, hexA('#ffffff', 0.4));
    halo.addColorStop(0.22, hexA('#f8fafc', 0.3));
    halo.addColorStop(0.55, hexA('#93c5fd', 0.17));
    halo.addColorStop(1, hexA('#8b5cf6', 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.ellipse(hx, hy, 96, 108, 0, 0, 7); ctx.fill();
    // Drifting silver motes lifting off the silhouette.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 40 + (i % 5) * 22;
      const r2 = 2 + (i % 4) * 2.4;
      ctx.fillStyle = hexA(i % 3 ? '#ffffff' : '#93c5fd', 0.5);
      ctx.beginPath();
      ctx.ellipse(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 1.15, r2, r2 * 1.7, 0, 0, 7);
      ctx.fill();
    }
    // Ground distortion ring, matching the in-game aura's foot flare.
    const gy = H * 0.962;
    const ring = ctx.createRadialGradient(cx - 4, gy, 2, cx - 4, gy, S * 0.3);
    ring.addColorStop(0, hexA('#ffffff', 0.36));
    ring.addColorStop(0.4, hexA('#e0f2fe', 0.2));
    ring.addColorStop(0.75, hexA('#8b5cf6', 0.09));
    ring.addColorStop(1, hexA('#8b5cf6', 0));
    ctx.fillStyle = ring;
    ctx.beginPath(); ctx.ellipse(cx - 4, gy, S * 0.3, S * 0.062, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---- foreground particles ----
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const px = Math.random() * S, py = Math.random() * H;
    const r = 1 + Math.random() * 3.4;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
    g.addColorStop(0, hexA('#ffffff', 0.7)); g.addColorStop(0.35, hexA(color, 0.45)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 3, 0, 7); ctx.fill();
  }
  ctx.restore();

  // ---- vignette + bottom band ----
  const vg = ctx.createRadialGradient(cx, cy, S * 0.28, cx, cy, S * 0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, S, H);

  const bb = ctx.createLinearGradient(0, H * 0.72, 0, H);
  bb.addColorStop(0, 'rgba(0,0,0,0)'); bb.addColorStop(0.65, hexA(color, 0.28)); bb.addColorStop(1, 'rgba(4,4,9,0.95)');
  ctx.fillStyle = bb; ctx.fillRect(0, H * 0.72, S, H * 0.28);

  ctx.fillStyle = color; ctx.fillRect(0, H - 9, S, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, H - 9, S, 2);

  const url = cv.toDataURL('image/png');
  cache[id] = url;
  return url;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function mix(a: string, b: string, t: number) {
  const na = parseInt(a.replace('#', ''), 16), nb = parseInt(b.replace('#', ''), 16);
  const r = Math.round((((na >> 16) & 255) * (1 - t) + ((nb >> 16) & 255) * t));
  const g = Math.round((((na >> 8) & 255) * (1 - t) + ((nb >> 8) & 255) * t));
  const bl = Math.round(((na & 255) * (1 - t) + (nb & 255) * t));
  return `rgb(${r},${g},${bl})`;
}
