import type { Fighter } from './fighter';
import { sfx } from './audio';
import { SIGS } from './signatures';

let signatureDrawWarned = false;

function hexA(hex: string, a: number) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export interface ProjSpec {
  owner: Fighter; type: 'fireball' | 'bolt' | 'dragon' | 'wave' | 'spike' | 'arm' | 'susanoo' | 'sig';
  sig?: string; data?: any;
  x: number; y: number; vx: number; vy: number; w: number; h: number; life: number;
  dmg: number; ang: number; kb: number; sc: number; dir: number;
  delay?: number; activeFor?: number; rehit?: number; pull?: boolean; fx?: any; stun?: number;
  fin?: { dmg: number; ang: number; kb: number; sc: number }; grow?: number;
  follow?: boolean; ox?: number; oy?: number; ground?: boolean; reflectable?: boolean;
  /** Inherited from the spawn frame: damage from this entity cannot feed its owner's ultimate meter. */
  ultLocked?: boolean;
  /** Drawn behind the fighters (stages, domains) instead of over them. */
  behind?: boolean;
  style?: 'fire' | 'ki' | 'water' | 'ice' | 'wind' | 'cursed' | 'blood' | 'shuriken' | 'void' | 'spirit';
  col?: string; col2?: string;
}

export class Projectile {
  owner: Fighter; type: ProjSpec['type']; x: number; y: number; vx: number; vy: number; w: number; h: number;
  life: number; max: number; dmg: number; ang: number; kb: number; sc: number; dir: number;
  delay: number; activeFor: number; rehit: number; pull: boolean; fx: any; stun: number;
  fin?: ProjSpec['fin']; grow: number; follow: boolean; ox: number; oy: number; ground: boolean; reflectable: boolean;
  style: NonNullable<ProjSpec['style']>; col: string; col2: string;
  ultLocked = false;
  behind = false;
  sig = ''; data: any = {};
  t = 0; dead = false; hitMap = new Map<Fighter, number>();

  constructor(s: ProjSpec) {
    this.owner = s.owner; this.type = s.type; this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy; this.w = s.w; this.h = s.h;
    this.life = s.life; this.max = s.life; this.dmg = s.dmg; this.ang = s.ang; this.kb = s.kb; this.sc = s.sc; this.dir = s.dir;
    this.delay = s.delay || 0; this.activeFor = s.activeFor || 9999; this.rehit = s.rehit || 0; this.pull = !!s.pull; this.fx = s.fx; this.stun = s.stun || 0;
    this.fin = s.fin; this.grow = s.grow || 0; this.follow = !!s.follow; this.ox = s.ox || 0; this.oy = s.oy || 0; this.ground = !!s.ground;
    this.reflectable = s.reflectable ?? !(s.type === 'susanoo' || s.type === 'arm' || s.type === 'spike' || s.type === 'bolt');
    this.style = s.style || 'fire'; this.col = s.col || '#ff7a1a'; this.col2 = s.col2 || '#ffd24a';
    this.ultLocked = !!s.ultLocked;
    this.behind = !!s.behind;
    if (s.type === 'sig') { this.sig = s.sig || ''; this.data = s.data || {}; this.reflectable = s.reflectable ?? false; }
    if (this.follow) this.snap();
    if (s.type === 'sig') SIGS[this.sig]?.init?.(this);
  }
  snap() { this.x = this.owner.x + this.ox * this.dir; this.y = this.owner.y + this.oy; }
  get active() { return this.t >= this.delay && this.t < this.delay + this.activeFor; }
  rect() {
    if (this.ground) return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update(g: any) {
    this.t++;
    if (this.follow) this.snap(); else { if (this.t >= this.delay) { this.x += this.vx; this.y += this.vy; } }
    if (this.grow && this.w < 260) { this.w += this.grow; this.h += this.grow * 0.7; }
    this.life--;
    const fx = g.fx;
    if (this.type === 'sig') SIGS[this.sig]?.update?.(this, g);
    switch (this.type) {
      case 'fireball':
        for (let i = 0; i < 4; i++) fx.add({ x: this.x + (Math.random() - .5) * this.w, y: this.y + (Math.random() - .5) * this.h, vx: this.vx * 0.3, vy: -1 - Math.random() * 2, color: Math.random() < .5 ? '#ff5a1a' : '#ffcc33', kind: 'ember', life: 24, size: 10 + Math.random() * 8 });
        if (this.t % 3 === 0) fx.add({ x: this.x, y: this.y - this.h * 0.3, vx: this.vx * 0.2, vy: -1.5, color: '#3a2a22', kind: 'smoke', life: 40, size: 20 });
        break;
      case 'dragon':
        for (let i = 0; i < 5; i++) fx.add({ x: this.x - this.dir * Math.random() * 300, y: this.y + (Math.random() - .5) * 120, vx: -this.dir * 2, vy: -Math.random() * 3, color: Math.random() < .5 ? '#ff5a1a' : '#ffd24a', kind: 'ember', life: 30, size: 12 });
        if (this.t % 6 === 0) { g.shake(3); sfx('fire'); }
        break;
      case 'wave':
        if (this.t % 2 === 0) fx.add({ x: this.x, y: this.y + (Math.random() - .5) * this.h, vx: -this.vx * 0.2, color: Math.random() < .5 ? '#1a0508' : '#e0203a', kind: Math.random() < .6 ? 'smoke' : 'glow', life: 18, size: 7 });
        break;
      case 'bolt':
        if (this.t === this.delay) { sfx('elec'); g.shake(8); g.flashScreen('#bfefff', 0.25); fx.burst(this.x, this.y + this.h / 2 - 10, 20, '#7fd8ff', 8, 'spark', 20, 4); }
        if (this.active && this.t % 2 === 0) fx.bolt(this.x + (Math.random() - .5) * 20, this.y - 700, this.x + (Math.random() - .5) * 20, this.y + this.h / 2, '#7fd8ff', 5, 4);
        break;
      case 'spike':
        if (this.t === this.delay) { fx.burst(this.x, this.y, 8, '#6b4a2a', 5, 'shard', 22, 5, 0.3); }
        break;
      case 'arm':
        if (this.t === this.delay) { fx.slash(this.x - this.dir * 60, this.y + 10, 150, -1.9, 1.3, this.dir, '#b067ff', 50, 18); g.shake(9); }
        break;
      case 'susanoo':
        if (this.t === this.delay) { sfx('purple'); sfx('heavyhit', 2); g.shake(26); g.flashScreen('#d0a0ff', 0.45);
          fx.slash(this.owner.x + this.dir * 40, this.owner.y - 200, 330, -2.2, 1.2, this.dir, '#b067ff', 70, 26); }
        if (this.t < this.delay && this.t % 3 === 0) fx.add({ x: this.owner.x + (Math.random() - .5) * 300, y: this.owner.y - Math.random() * 400, vy: -2, color: '#b067ff', kind: 'glow', life: 30, size: 10 });
        break;
    }
    if (this.life <= 0) {
      this.dead = true;
      if (this.fin) g.projectileFinish(this);
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const k = Math.min(1, this.life / 10);
    ctx.save();
    if (this.type === 'sig') {
      try { SIGS[this.sig]?.draw(this, ctx, time); } catch (error) {
        if (!signatureDrawWarned) { console.error(`Signature renderer "${this.sig}" failed`, error); signatureDrawWarned = true; }
      }
      ctx.restore();
      return;
    }
    switch (this.type) {
      case 'fireball': {
        const R = Math.max(this.w, this.h) * 0.5;
        const C = this.col, C2 = this.col2;
        ctx.globalCompositeOperation = 'lighter';
        switch (this.style) {
          case 'ki': { // Goku — tight turquoise beam-orb with trailing corona
            for (let i = 0; i < 4; i++) {
              const bx = this.x - this.dir * i * R * 0.7;
              const gr = ctx.createRadialGradient(bx, this.y, 0, bx, this.y, R * (1 - i * 0.18));
              gr.addColorStop(0, `rgba(255,255,255,${0.85 * k})`); gr.addColorStop(0.35, hexA(C, 0.7 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, this.y, R * (1 - i * 0.18), 0, 7); ctx.fill();
            }
            ctx.strokeStyle = hexA('#ffffff', 0.9 * k); ctx.lineWidth = R * 0.25;
            ctx.beginPath(); ctx.moveTo(this.x - this.dir * R * 2.4, this.y); ctx.lineTo(this.x + this.dir * R * 0.4, this.y); ctx.stroke();
            break;
          }
          case 'water': { // Tanjiro — coiling water dragon body
            for (let i = 10; i >= 0; i--) {
              const bx = this.x - this.dir * i * R * 0.42, by = this.y + Math.sin(time * 0.26 - i * 0.6) * R * 0.5;
              const rr = R * (1 - i / 14);
              const gr = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
              gr.addColorStop(0, hexA('#ffffff', 0.55 * k)); gr.addColorStop(0.4, hexA(C, 0.6 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, rr, 0, 7); ctx.fill();
            }
            break;
          }
          case 'ice': { // Todoroki — angular glacier spikes
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = k;
            for (let i = 0; i < 5; i++) {
              const bx = this.x - this.dir * i * R * 0.5, hgt = R * (1.5 - i * 0.2);
              ctx.fillStyle = i % 2 ? C : C2; ctx.strokeStyle = '#eafaff'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(bx - R * 0.34, this.y + R * 0.5); ctx.lineTo(bx + this.dir * R * 0.16, this.y - hgt); ctx.lineTo(bx + R * 0.34, this.y + R * 0.5);
              ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            break;
          }
          case 'wind': { // Saitama / Deku — pure pressure rings
            ctx.strokeStyle = hexA('#ffffff', 0.85 * k);
            for (let i = 0; i < 5; i++) {
              ctx.lineWidth = 6 - i; const rr = R * (0.4 + i * 0.22);
              ctx.beginPath(); ctx.ellipse(this.x - this.dir * i * R * 0.35, this.y, rr * 0.5, rr, 0, 0, 7); ctx.stroke();
            }
            break;
          }
          case 'cursed': { // Gojo Blue — imploding sphere with inward streaks
            const gr = ctx.createRadialGradient(this.x, this.y, R * 0.1, this.x, this.y, R);
            gr.addColorStop(0, hexA('#ffffff', 0.9 * k)); gr.addColorStop(0.3, hexA(C, 0.8 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, 7); ctx.fill();
            ctx.strokeStyle = hexA(C2, 0.8 * k); ctx.lineWidth = 2;
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * 6.28 + time * 0.08;
              ctx.beginPath(); ctx.moveTo(this.x + Math.cos(a) * R * 1.7, this.y + Math.sin(a) * R * 1.7);
              ctx.lineTo(this.x + Math.cos(a) * R * 0.6, this.y + Math.sin(a) * R * 0.6); ctx.stroke();
            }
            break;
          }
          case 'void': { // Gojo Purple / Asta — black core, bright halo
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = k;
            ctx.fillStyle = '#07030c'; ctx.beginPath(); ctx.arc(this.x, this.y, R * 0.72, 0, 7); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createRadialGradient(this.x, this.y, R * 0.6, this.x, this.y, R * 1.35);
            gr.addColorStop(0, hexA(C, 0.95 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y, R * 1.35, 0, 7); ctx.fill();
            break;
          }
          case 'shuriken': { // Naruto — spinning wind blade
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(time * 0.6 * this.dir);
            ctx.fillStyle = hexA(C, 0.85 * k);
            for (let i = 0; i < 4; i++) {
              ctx.rotate(Math.PI / 2);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 1.5, -R * 0.2); ctx.lineTo(R * 1.35, R * 0.22); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            const gr = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R * 0.8);
            gr.addColorStop(0, hexA('#ffffff', 0.9 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y, R * 0.8, 0, 7); ctx.fill();
            break;
          }
          case 'blood': { // Denji — ragged crimson gout
            for (let i = 0; i < 7; i++) {
              const a = (i / 7) * 6.28 + time * 0.2;
              const bx = this.x + Math.cos(a) * R * 0.45, by = this.y + Math.sin(a) * R * 0.45;
              const gr = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.7);
              gr.addColorStop(0, hexA(C2, 0.7 * k)); gr.addColorStop(0.4, hexA(C, 0.6 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, R * 0.7, 0, 7); ctx.fill();
            }
            break;
          }
          case 'spirit': { // Ichigo — crescent spirit energy
            ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.dir, 1);
            ctx.fillStyle = hexA(C, 0.75 * k);
            ctx.beginPath(); ctx.arc(0, 0, R, -1.15, 1.15); ctx.arc(-R * 0.55, 0, R * 0.85, 1.15, -1.15, true); ctx.closePath(); ctx.fill();
            ctx.fillStyle = hexA('#ffffff', 0.8 * k);
            ctx.beginPath(); ctx.arc(0, 0, R * 0.9, -0.9, 0.9); ctx.arc(-R * 0.4, 0, R * 0.78, 0.9, -0.9, true); ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
          }
          default: { // classic fire
            for (let i = 0; i < 5; i++) {
              const ox = Math.sin(time * 0.3 + i * 1.7) * this.w * 0.2, oy = Math.cos(time * 0.25 + i) * this.h * 0.15;
              const r = R * (0.7 + i * 0.1);
              const gr = ctx.createRadialGradient(this.x + ox, this.y + oy, 0, this.x + ox, this.y + oy, r);
              gr.addColorStop(0, hexA('#fff4c0', 0.5 * k)); gr.addColorStop(0.4, hexA(C, 0.5 * k)); gr.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x + ox, this.y + oy, r, 0, 7); ctx.fill();
            }
          }
        }
        break;
      }
      case 'dragon': {
        ctx.globalCompositeOperation = 'lighter';
        const segs = 16;
        for (let i = segs; i >= 0; i--) {
          const bx = this.x - this.dir * i * 22, by = this.y + Math.sin(time * 0.25 - i * 0.55) * 30 * (i / segs + 0.3);
          const r = 70 * (1 - i / (segs + 4));
          const gr = ctx.createRadialGradient(bx, by, 0, bx, by, r);
          gr.addColorStop(0, `rgba(255,250,200,${0.7 * k})`); gr.addColorStop(0.35, `rgba(255,130,30,${0.6 * k})`); gr.addColorStop(1, 'rgba(160,20,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // head
        ctx.translate(this.x + this.dir * 40, this.y); ctx.scale(this.dir, 1);
        const jaw = Math.sin(time * 0.3) * 8;
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ff6a1a'; ctx.strokeStyle = '#7a1a00'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-50, -40); ctx.lineTo(60, -22 - jaw); ctx.lineTo(90, -8); ctx.lineTo(20, 0); ctx.lineTo(80, 14 + jaw); ctx.lineTo(50, 34 + jaw); ctx.lineTo(-50, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(-90, -80); ctx.lineTo(-20, -34); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-50, -20); ctx.lineTo(-110, -40); ctx.lineTo(-40, -8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(28, -18, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#b00'; ctx.beginPath(); ctx.arc(30, -18, 3.5, 0, 7); ctx.fill();
        break;
      }
      case 'wave': {
        const C = this.col || '#ff2040';
        ctx.translate(this.x, this.y); ctx.scale(this.dir, 1);
        ctx.fillStyle = 'rgba(8,6,14,0.9)'; ctx.strokeStyle = C; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-10, -this.h / 2); ctx.quadraticCurveTo(40, 0, -10, this.h / 2); ctx.quadraticCurveTo(14, 0, -10, -this.h / 2); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 * k; ctx.fillStyle = C;
        ctx.beginPath(); ctx.ellipse(0, 0, 26, this.h / 2, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.85 * k; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(2, 0, 9, this.h / 2.6, 0, 0, 7); ctx.fill();
        break;
      }
      case 'bolt': {
        if (this.t < this.delay) {
          const p = this.t / this.delay;
          ctx.strokeStyle = `rgba(127,216,255,${0.3 + p * 0.5})`; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
          ctx.beginPath(); ctx.moveTo(this.x, this.y - 700); ctx.lineTo(this.x, this.y + this.h / 2); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.ellipse(this.x, this.y + this.h / 2 - 4, 40 * p, 10 * p, 0, 0, 7); ctx.stroke();
        } else if (this.active || this.t < this.delay + 16) {
          ctx.globalCompositeOperation = 'lighter';
          const a = this.active ? 0.6 : 0.3 * (1 - (this.t - this.delay - this.activeFor) / 16);
          const gr = ctx.createLinearGradient(this.x - 50, 0, this.x + 50, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(160,230,255,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.fillRect(this.x - 50, this.y - 800, 100, 800 + this.h / 2);
        }
        break;
      }
      case 'spike': {
        if (this.t < this.delay) break;
        const lt = this.t - this.delay;
        const hgt = this.h * Math.min(1, lt / 4) * Math.min(1, (this.life) / 6);
        ctx.fillStyle = '#7a5230'; ctx.strokeStyle = '#2a170a'; ctx.lineWidth = 3;
        for (const [o, s] of [[-14, 0.7], [0, 1], [14, 0.8]]) {
          ctx.beginPath(); ctx.moveTo(this.x + o - 12, this.y); ctx.lineTo(this.x + o + this.dir * 8, this.y - hgt * s); ctx.lineTo(this.x + o + 12, this.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'arm': {
        const lt = this.t - this.delay;
        if (lt < -6) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, Math.min(1, (lt + 6) / 6) * Math.min(1, this.life / 8)) * 0.8;
        ctx.translate(this.owner.x, this.owner.y - 90); ctx.scale(this.dir, 1);
        const sw = Math.max(-1.6, Math.min(1.1, -1.6 + (lt + 6) * 0.2));
        ctx.rotate(sw);
        const gr = ctx.createLinearGradient(0, 0, 240, 0);
        gr.addColorStop(0, 'rgba(176,103,255,0.2)'); gr.addColorStop(1, 'rgba(210,160,255,0.8)');
        ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(230,200,255,0.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(200, -26); ctx.lineTo(250, -40); ctx.lineTo(280, -10); ctx.lineTo(270, 30); ctx.lineTo(200, 26); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(250, -30 + i * 18); ctx.lineTo(300, -36 + i * 20); ctx.stroke(); }
        break;
      }
      case 'susanoo': {
        const o = this.owner;
        const fade = Math.min(1, this.t / 20) * Math.min(1, this.life / 20);
        ctx.globalAlpha = fade * 0.85;
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(o.x - this.dir * 30, o.y); ctx.scale(this.dir, 1);
        const S = 2.4;
        ctx.scale(S, S);
        const glow = (c: string) => { ctx.fillStyle = c; ctx.strokeStyle = 'rgba(235,210,255,0.9)'; ctx.lineWidth = 2; };
        // body
        glow('rgba(140,70,230,0.35)');
        ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-70, -110); ctx.lineTo(-40, -160); ctx.lineTo(40, -160); ctx.lineTo(70, -110); ctx.lineTo(60, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        // armor ribs
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-50, -40 - i * 25); ctx.quadraticCurveTo(0, -30 - i * 25, 50, -40 - i * 25); ctx.stroke(); }
        // head
        glow('rgba(170,100,255,0.5)');
        ctx.beginPath(); ctx.moveTo(-26, -160); ctx.lineTo(-30, -205); ctx.lineTo(-10, -225); ctx.lineTo(20, -225); ctx.lineTo(40, -200); ctx.lineTo(54, -196); ctx.lineTo(30, -180); ctx.lineTo(26, -160); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -222); ctx.lineTo(-30, -262); ctx.lineTo(0, -226); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(14, -224); ctx.lineTo(34, -262); ctx.lineTo(24, -222); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(10, -204, 16, 5);
        // sword arm
        const lt = this.t - this.delay;
        const swing = lt < 0 ? -2.6 - Math.min(1, this.t / 30) * 0.4 : Math.min(1.2, -3.0 + lt * 0.45);
        ctx.save(); ctx.translate(40, -140); ctx.rotate(swing + Math.PI / 2);
        glow('rgba(160,90,255,0.45)');
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(70, -10); ctx.lineTo(70, 10); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        glow('rgba(220,180,255,0.75)');
        ctx.beginPath(); ctx.moveTo(70, -8); ctx.lineTo(320, -14); ctx.lineTo(345, 0); ctx.lineTo(320, 14); ctx.lineTo(70, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  }
}
