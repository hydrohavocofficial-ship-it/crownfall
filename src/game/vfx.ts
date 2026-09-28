/**
 * Signature VFX library. Every entry is a visually distinct effect so that
 * no two characters' moves look alike. Referenced by name from move definitions.
 */
import { AWAKENINGS } from './awakenings';
import { ARC_STYLES, SWING_PROFILES, swingArc } from './animeFx';
import type { MoveDef, TechniqueVisualStyle } from './types';
import type { BossVfxKind } from './bossVfx';

export type VfxFn = (f: any, g: any, fr: number, m: any) => void;

const R = Math.random;
const front = (f: any, d = 46, y = -44) => [f.x + f.facing * d, f.y + y] as [number, number];
/** Ultra Instinct platinum. Kept in one place so the silver reads as one material. */
const PLAT = '#93c5fd';

type TechniqueTier = 'awaken' | 'awakenLight' | 'awakenHeavy' | 'awakened';
type TechniqueStance = 'neutral' | 'side' | 'down' | 'air';

function techniqueVfx(profileId: string, tier: TechniqueTier, stance: TechniqueStance, f: any, g: any, fr: number, m: any) {
  const profile = AWAKENINGS[profileId];
  if (!profile) return;
  const style: TechniqueVisualStyle = m.techniqueStyle || profile.style;
  const c1 = profile.color, c2 = profile.color2;
  const [x, y] = stance === 'down' ? [f.x, f.y - 8] as [number, number] : stance === 'air' ? [f.x + f.facing * 24, f.y - 44] as [number, number] : front(f, tier === 'awakened' ? 62 : 48, -46);
  // Only the special tier is allowed to be the biggest thing on the screen; the
  // awakened light is the smallest of the three, so it never out-shouts the move
  // it is cancelling into.
  const power = tier === 'awakened' ? 1.35 : tier === 'awakenHeavy' ? 1.2 : tier === 'awakenLight' ? 0.78 : 0.9;

  if (fr < m.startup) {
    // Anticipation: motes spiral inward, a ground ring tightens, then a hard flash
    // on the frame the technique actually releases.
    const k = fr / Math.max(1, m.startup);
    if (fr % 2 === 0) {
      const a = R() * Math.PI * 2, radius = (86 - k * 54) * power;
      g.fx.add({ x: f.x + Math.cos(a) * radius, y: f.y - 44 + Math.sin(a) * radius * .8, vx: -Math.cos(a) * 3.8 * (0.4 + k), vy: -Math.sin(a) * 3.8 * (0.4 + k), color: k > .55 ? c2 : c1, kind: 'glow', life: 14, size: 4 + k * 8 });
    }
    if (fr % 3 === 0) g.fx.ring(f.x, stance === 'down' ? f.y - 6 : f.y - 42, 10, 30 + (1 - k) * 58, c1, 14, 3);
    if (fr % 4 === 0) g.fx.add({ x: f.x + f.facing * (10 + R() * 24), y: f.y - 20 - R() * 60, vx: -f.facing * 3, vy: -1, color: c2, kind: 'glow', life: 12, size: 3 + R() * 3 });
    return;
  }

  if (fr === m.startup) {
    switch (style) {
      case 'blade':
        g.fx.slash(x, y, 62 * power, -1.8, 1.2, f.facing, c1, 18 * power, 13);
        g.fx.slash(x, y - 4, 48 * power, 1.4, -1.5, f.facing, '#ffffff', 8, 11);
        break;
      case 'storm':
        for (let i = 0; i < 7; i++) { const a = R() * 6.28, d = 45 + R() * 65; g.fx.bolt(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, c1, 7, 2.4); }
        g.fx.impact(x, y, 62 * power, c2);
        break;
      case 'flame':
        for (let i = 0; i < 20; i++) { const a = R() * 6.28; g.fx.add({ x, y, vx: Math.cos(a) * (4 + R() * 7) + f.facing * 3, vy: Math.sin(a) * (3 + R() * 5) - 2, color: i % 3 ? c1 : c2, kind: 'ember', life: 30, size: 7 + R() * 7 }); }
        g.fx.ring(x, y, 12, 118 * power, c1, 20, 10);
        break;
      case 'meteor':
        g.fx.impact(x, y, 82 * power, c1); g.fx.ring(f.x, f.y, 18, stance === 'down' ? 280 : 150, c2, 24, 14);
        for (let i = 0; i < 10; i++) g.fx.add({ x: x + (R() - .5) * 100, y: y + (R() - .5) * 80, vx: (R() - .5) * 8, vy: -R() * 7, color: i % 2 ? c1 : '#3a241c', kind: i % 2 ? 'ember' : 'shard', life: 34, size: 9, grav: .2 });
        break;
      case 'void':
        g.fx.slash(x, y, 78 * power, -2, 1.4, f.facing, c1, 28, 16); g.fx.ring(x, y, 12, 104, c2, 18, 6);
        for (let i = 0; i < 12; i++) g.fx.add({ x: x + (R() - .5) * 80, y: y + (R() - .5) * 70, vx: (R() - .5) * 5, vy: -R() * 4, color: i % 3 ? '#09020b' : c1, kind: i % 3 ? 'smoke' : 'glow', life: 27, size: 9 });
        break;
      case 'ki':
        g.fx.ring(x, y, 8, 116 * power, c1, 20, 10); g.fx.directional(x, y, 14, f.facing > 0 ? 0 : Math.PI, .16, c2, 15, 'streak', 20, 4);
        g.fx.impact(x, y, 70 * power, c1);
        break;
      case 'spirit':
        for (let i = 0; i < 3; i++) g.fx.slash(x - i * f.facing * 22, y, (62 - i * 7) * power, -1.9 + i * .1, 1.2, f.facing, i ? c2 : c1, 20 - i * 4, 14);
        break;
      case 'fox':
        for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; g.fx.add({ x, y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8 - 2, color: i % 2 ? c1 : c2, kind: 'streak', life: 22, size: 5 }); }
        g.fx.ring(x, y, 8, 100, c1, 18, 7); g.fx.impact(x, y, 58, '#ffffff');
        break;
      case 'water':
        for (let i = 0; i < 16; i++) { const a = -1.7 + i / 15 * 3.4; g.fx.add({ x, y, vx: Math.cos(a) * 9 * f.facing, vy: Math.sin(a) * 7 - 1, color: i % 3 ? c1 : c2, kind: 'glow', life: 24, size: 6 }); }
        g.fx.slash(x, y, 72 * power, -1.6, 1.5, f.facing, c2, 17, 13);
        break;
      case 'shadow':
        g.fx.slash(x, y, 66 * power, -1.8, 1.2, f.facing, c1, 24, 15); g.fx.ring(x, y, 8, 96, c2, 18, 7);
        for (let i = 0; i < 14; i++) g.fx.add({ x: x + (R() - .5) * 90, y: y + (R() - .5) * 65, vy: -1 - R() * 3, color: i % 4 ? '#08010b' : c2, kind: i % 4 ? 'smoke' : 'glow', life: 30, size: 10 });
        break;
      case 'rubber':
        g.fx.bolt(f.x + f.facing * 12, f.y - 48, x + f.facing * 80, y, c2, 15, 5); g.fx.impact(x, y, 78 * power, c1); g.fx.directional(x, y, 12, f.facing > 0 ? 0 : Math.PI, .12, '#ffffff', 13, 'streak', 18, 4);
        break;
      case 'trio':
        for (let i = 0; i < 3; i++) g.fx.slash(x + (i - 1) * 18, y + (i - 1) * 12, (72 - i * 8) * power, -2 + i * .15, 1.25, f.facing, i === 1 ? '#ffffff' : c1, 15, 13);
        break;
      case 'pressure':
        for (let i = 0; i < 5; i++) g.fx.ring(x + f.facing * i * 38, y, 5, 96 - i * 14, i % 2 ? c1 : '#ffffff', 15, 5);
        g.fx.directional(x, y, 18, f.facing > 0 ? 0 : Math.PI, .08, c2, 18, 'streak', 20, 3); g.shake(9);
        break;
      case 'singularity':
        for (let i = 0; i < 3; i++) g.fx.ring(x + (i - 1) * 24, y, 12 + i * 14, 96 - i * 18, i === 1 ? '#ff5577' : c1, 19, 5);
        for (let i = 0; i < 12; i++) { const a = R() * 6.28, d = 90; g.fx.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * 8, vy: -Math.sin(a) * 8, color: i % 2 ? c1 : '#ff5577', kind: 'streak', life: 16, size: 3 }); }
        break;
      case 'curse':
        g.fx.impact(x, y, 92 * power, c1); for (let i = 0; i < 14; i++) { const a = R() * 6.28; g.fx.add({ x, y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, color: i % 2 ? '#10010b' : c1, kind: 'shard', life: 22, size: 7 }); }
        g.flashScreen(c1, .2); break;
      case 'hero':
        for (let i = 0; i < 8; i++) { const a = R() * 6.28; g.fx.bolt(x, y, x + Math.cos(a) * 85, y + Math.sin(a) * 85, c1, 8, 2.2); }
        g.fx.impact(x, y, 88 * power, c2); break;
      case 'twin':
        g.fx.slash(x - 18, y, 66 * power, -1.9, 1.1, f.facing, c1, 18, 14); g.fx.slash(x + 18, y, 66 * power, 1.7, -1.3, f.facing, c2, 18, 14);
        g.fx.ring(f.x, f.y, 12, 180, c1, 20, 8); break;
      case 'titan':
        g.fx.impact(x, y, 105 * power, c1); for (let i = 0; i < 18; i++) g.fx.add({ x: f.x + (R() - .5) * 190, y: f.y - R() * 35, vx: (R() - .5) * 7, vy: -2 - R() * 6, color: i % 2 ? c2 : '#6b4c34', kind: i % 2 ? 'smoke' : 'shard', life: 34, size: 10, grav: .24 });
        g.shake(12); break;
      case 'saw':
        for (let i = 0; i < 22; i++) g.fx.add({ x: x + (R() - .5) * 100, y: y + (R() - .5) * 90, vx: -f.facing * (3 + R() * 8), vy: -R() * 7, color: i % 3 ? c1 : c2, kind: i % 2 ? 'spark' : 'shard', life: 20, size: 4 + R() * 4 });
        for (let i = 0; i < 3; i++) g.fx.ring(x, y, 10 + i * 18, 100 - i * 18, i % 2 ? c1 : c2, 15, 5);
        break;
    }
    if (tier === 'awakened') { g.flashScreen(c2, .28); g.shake(12); }
    // A release flash that scales with the tier, then a lingering core. The
    // awakened light gets the smallest one: a fast strike must not announce
    // itself like the finisher it is usually cancelling into.
    g.fx.add({ x, y, color: '#ffffff', kind: 'glow', life: 8, size: (16 + 14 * power) });
    g.fx.ring(x, y, 6, 44 * power, '#ffffff', 10, 3);
  }

  if (fr > m.startup && fr % (stance === 'down' ? 3 : 4) === 0) {
    if (style === 'flame' || style === 'meteor') g.fx.add({ x: f.x + f.facing * (20 + R() * 70), y: f.y - R() * 75, vx: -f.facing * 2, vy: -1 - R() * 3, color: R() < .5 ? c1 : c2, kind: 'ember', life: 24, size: 7 + R() * 5 });
    else if (style === 'water' || style === 'twin') g.fx.add({ x: f.x + f.facing * (20 + R() * 65), y: f.y - R() * 78, vx: -f.facing * 2, vy: R() * 2, color: R() < .5 ? c1 : c2, kind: 'glow', life: 19, size: 5 });
    else if (style === 'storm' || style === 'spirit' || style === 'singularity' || style === 'hero') g.fx.bolt(f.x, f.y - 42, f.x + f.facing * (50 + R() * 80), f.y - 100 + R() * 90, c1, 4, 1.5);
    else g.fx.add({ x: f.x - f.facing * R() * 30, y: f.y - 18 - R() * 68, vx: -f.facing * (1 + R() * 3), vy: -R() * 2, color: R() < .5 ? c1 : c2, kind: 'glow', life: 18, size: 4 + R() * 4 });
  }
}

function fallbackVfx(f: any, g: any, fr: number, m: any) {
  const profile = AWAKENINGS[f.def?.id];
  const c1 = profile?.color || f.look?.energy || '#ffffff';
  const c2 = profile?.color2 || f.look?.energy2 || '#ffffff';
  if (fr === m.startup) {
    const [x, y] = front(f, 42, -44);
    g.fx.ring(x, y, 6, 58, c1, 15, 4);
    g.fx.slash(x, y, 48, -1.5, 1.2, f.facing, c2, 10, 10);
    for (let i = 0; i < 7; i++) g.fx.add({ x: f.x + (R() - .5) * 44, y: f.y - 15 - R() * 70, vx: -f.facing * R() * 2, vy: -R() * 2, color: i % 2 ? c1 : c2, kind: 'glow', life: 18, size: 4 + R() * 3 });
  }
}

// ---------- BLADE / STEEL ----------
export const VFX: Record<string, VfxFn> = {
  // Levi — thin, cold, surgical twin cuts
  odmCut: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 34);
    g.fx.slash(x, y, 46, -1.5, 1.3, f.facing, '#d8f6ff', 9, 9);
    g.fx.slash(x, y - 6, 40, 1.1, -1.6, f.facing, '#ffffff', 5, 7);
    g.fx.directional(x, y, 5, f.facing > 0 ? -0.5 : Math.PI + 0.5, 0.5, '#eaffff', 9, 'streak', 11, 2);
  },
  odmWire: (f, g, fr, m) => {
    if (fr === 1) g.fx.bolt(f.x, f.y - 52, f.x + f.facing * 420, f.y - 150, '#94a4b4', 14, 1.1);
    if (fr > m.startup && fr % 2 === 0) g.fx.add({ x: f.x - f.facing * 8, y: f.y - 40, color: '#dff6ff', kind: 'streak', vx: -f.facing * 7, life: 9, size: 2 });
  },
  odmStorm: (f, g, fr, m) => {
    if (fr < m.startup || fr > m.startup + 14 || fr % 2) return;
    const a = fr * 0.9;
    g.fx.slash(f.x + Math.cos(a) * 16, f.y - 46 + Math.sin(a) * 14, 40, a, a + 2.1, f.facing, '#d8f6ff', 8, 7);
  },

  // Zoro — heavy triple steel, green wind
  triCut: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 44);
    for (let i = 0; i < 3; i++) g.fx.slash(x, y + (i - 1) * 16, 62 - i * 6, -1.7 + i * 0.16, 1.4 + i * 0.16, f.facing, '#8dffbe', 13, 12);
    g.fx.burst(x, y, 8, '#d6ffe8', 6, 'shard', 18, 4);
  },
  windCross: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 52);
    g.fx.slash(x, y, 72, -2.1, 1.0, f.facing, '#8dffbe', 18, 14);
    g.fx.slash(x, y, 72, 1.6, -1.5, f.facing, '#e8fff2', 12, 14);
    g.shake(6);
  },

  // Tanjiro — flowing water ribbons
  waterArc: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 42);
    g.fx.slash(x, y, 58, -1.6, 1.5, f.facing, '#67c8f0', 16, 13);
    for (let i = 0; i < 12; i++) {
      const a = -1.5 + (i / 12) * 3;
      g.fx.add({ x: x + Math.cos(a) * 52 * f.facing, y: y + Math.sin(a) * 52, vx: f.facing * (1 + R() * 2), vy: (R() - 0.5) * 3, color: i % 3 ? '#8fdcff' : '#e6f9ff', kind: 'glow', life: 22, size: 5 });
    }
  },
  waterRipple: (f, g, fr) => {
    if (fr % 3) return;
    g.fx.ring(f.x + f.facing * 26, f.y - 40, 6, 44, 'rgba(120,210,255,0.85)', 15, 3);
  },
  sunDance: (f, g, fr, m) => {
    if (fr < m.startup) return;
    if (fr % 2) return;
    const a = fr * 0.55;
    g.fx.slash(f.x, f.y - 46, 54, a, a + 2.3, f.facing, '#ffb038', 14, 9);
    g.fx.add({ x: f.x + (R() - 0.5) * 60, y: f.y - 20 - R() * 60, vy: -2.4, color: R() < 0.5 ? '#ff7a1a' : '#ffd66a', kind: 'ember', life: 26, size: 7 });
  },

  // Rengoku — dense fire plumes
  flameArc: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 46);
    g.fx.slash(x, y, 64, -1.7, 1.4, f.facing, '#ff7a1a', 22, 14);
    for (let i = 0; i < 16; i++) g.fx.add({ x: x + (R() - 0.5) * 70, y: y + (R() - 0.5) * 60, vx: f.facing * R() * 4, vy: -1 - R() * 4, color: R() < 0.5 ? '#ff5a1a' : '#ffd24a', kind: 'ember', life: 30, size: 9 });
  },
  flameTrail: (f, g, fr) => {
    if (fr % 2) return;
    for (let i = 0; i < 3; i++) g.fx.add({ x: f.x + (R() - 0.5) * 40, y: f.y - 16 - R() * 58, vx: -f.facing * R() * 2, vy: -R() * 2.4, color: R() < 0.5 ? '#ff7a1a' : '#ffd24a', kind: 'ember', life: 26, size: 8 });
  },
  flameTiger: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 60);
    g.fx.ring(x, y, 12, 120, '#ff7a1a', 20, 10);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      g.fx.add({ x, y, vx: Math.cos(a) * (3 + R() * 6) + f.facing * 3, vy: Math.sin(a) * (2 + R() * 4) - 2, color: i % 3 ? '#ff5a1a' : '#ffe08a', kind: 'ember', life: 32, size: 10 });
    }
    g.shake(9);
  },

  // Todoroki — crystalline ice shards / flashfire
  iceShards: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 44);
    for (let i = 0; i < 9; i++) {
      const a = -0.9 + (i / 9) * 1.8;
      g.fx.add({ x, y, vx: Math.cos(a) * 9 * f.facing, vy: Math.sin(a) * 7 - 2, color: i % 2 ? '#b8ecff' : '#ffffff', kind: 'shard', life: 24, size: 7, grav: 0.22 });
    }
    g.fx.ring(x, y, 8, 54, '#cdeeff', 16, 5);
  },
  iceSpires: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    for (let i = 0; i < 5; i++) {
      const px = f.x + f.facing * (34 + i * 42);
      g.fx.add({ x: px, y: f.y - 8, vy: -1, color: '#cdeeff', kind: 'shard', life: 26, size: 16 - i * 1.6 });
      g.fx.ring(px, f.y - 6, 4, 34, '#eafaff', 14, 3);
    }
    g.shake(6);
  },
  flashfire: (f, g, fr, m) => {
    if (fr < m.startup) return;
    for (let i = 0; i < 3; i++) g.fx.add({ x: f.x + (R() - 0.5) * 44, y: f.y - 20 - R() * 56, vx: -f.facing * 2, vy: -R() * 3, color: R() < 0.5 ? '#ff7a3a' : '#ffd07a', kind: 'ember', life: 22, size: 8 });
  },

  // Killua — jagged electric arcs
  zap: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 36);
    for (let i = 0; i < 5; i++) {
      const a = R() * 6.28, d = 30 + R() * 40;
      g.fx.bolt(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, '#8fe6ff', 7, 2.2);
    }
    g.fx.add({ x, y, color: '#ffffff', kind: 'glow', life: 10, size: 20 });
  },
  zapAura: (f, g, fr) => {
    if (fr % 3) return;
    const a = R() * 6.28, d = 24 + R() * 30;
    g.fx.bolt(f.x, f.y - 42, f.x + Math.cos(a) * d, f.y - 42 + Math.sin(a) * d, '#8fe6ff', 5, 1.6);
  },
  godspeedBlur: (f, g, fr) => {
    if (fr % 2) return;
    g.fx.add({ x: f.x - f.facing * 10, y: f.y - 40, color: 'rgba(143,230,255,0.55)', kind: 'glow', life: 8, size: 15 });
  },

  // Sasuke — violet lightning spear
  chidori: (f, g, fr, m) => {
    if (fr < m.startup - 4) return;
    const [x, y] = front(f, 30);
    for (let i = 0; i < 3; i++) {
      const a = R() * 6.28, d = 20 + R() * 34;
      g.fx.bolt(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, '#b89dff', 6, 2);
    }
    if (fr === m.startup) { g.fx.ring(x, y, 8, 60, '#c9b0ff', 14, 6); g.fx.add({ x, y, color: '#fff', kind: 'glow', life: 12, size: 22 }); }
  },
  amaterasu: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 50, -26);
    for (let i = 0; i < 20; i++) g.fx.add({ x: x + (R() - 0.5) * 120, y: y + (R() - 0.5) * 40, vy: -1 - R() * 2, color: i % 3 ? '#140018' : '#1a0020', kind: 'smoke', life: 34, size: 13 });
    g.fx.ring(x, y, 10, 90, '#6a1a8a', 20, 9);
  },

  // Madara — spectral purple
  susanooFlare: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 52, -50);
    g.fx.ring(x, y, 14, 110, '#b067ff', 22, 12);
    for (let i = 0; i < 14; i++) g.fx.add({ x, y, vx: (R() - 0.5) * 8, vy: (R() - 0.5) * 8, color: '#d5b0ff', kind: 'glow', life: 24, size: 8 });
  },
  gunbaiGust: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 56);
    for (let i = 0; i < 4; i++) g.fx.ring(x + f.facing * i * 26, y, 6, 52 - i * 8, 'rgba(230,220,200,0.7)', 14, 4);
    g.fx.directional(x, y, 10, f.facing > 0 ? 0 : Math.PI, 0.6, '#efe6d0', 11, 'streak', 14, 3);
  },

  // Naruto — spiral chakra
  rasengan: (f, g, fr, m) => {
    const [x, y] = front(f, 34);
    if (fr < m.startup) {
      const k = fr / m.startup;
      g.fx.add({ x: x + Math.cos(fr * 0.9) * 12 * k, y: y + Math.sin(fr * 0.9) * 12 * k, color: '#8fd8ff', kind: 'glow', life: 8, size: 6 + k * 10 });
    } else if (fr === m.startup) {
      g.fx.ring(x, y, 10, 70, '#8fd8ff', 18, 8);
      for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.28; g.fx.add({ x, y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, color: '#c8ecff', kind: 'streak', life: 18, size: 3 }); }
    }
  },
  cloneEcho: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    for (const s of [-1, 1]) g.fx.add({ x: f.x + s * 34, y: f.y - 40, color: 'rgba(255,181,46,0.4)', kind: 'glow', life: 14, size: 20 });
    g.fx.burst(f.x, f.y - 20, 10, '#e8e8f0', 5, 'smoke', 20, 8);
  },
  shuriken: (f, g, fr, m) => {
    if (fr < m.startup) return;
    if (fr % 2) return;
    const [x, y] = front(f, 40);
    g.fx.ring(x, y, 14, 40, '#8fd8ff', 10, 3);
  },

  // Goku — blazing ki
  kiFlare: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 40);
    g.fx.add({ x, y, color: '#ffffff', kind: 'glow', life: 12, size: 24 });
    g.fx.ring(x, y, 8, 66, '#ffd24a', 16, 7);
    g.fx.directional(x, y, 10, f.facing > 0 ? 0 : Math.PI, 0.8, '#ffe9a8', 10, 'streak', 14, 3);
  },
  kiCharge: (f, g, fr) => {
    if (fr % 3) return;
    const a = R() * 6.28;
    g.fx.add({ x: f.x + Math.cos(a) * 46, y: f.y - 40 + Math.sin(a) * 46, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, color: '#ffe9a8', kind: 'glow', life: 14, size: 6 });
  },
  dragonFist: (f, g, fr, m) => {
    if (fr < m.startup) return;
    for (let i = 0; i < 3; i++) g.fx.add({ x: f.x - f.facing * (i * 18), y: f.y - 44 + (R() - 0.5) * 22, vx: -f.facing * 3, color: i % 2 ? '#ff8a1a' : '#ffd24a', kind: 'ember', life: 20, size: 10 });
  },

  // Deku — green lightning cowl
  cowlSpark: (f, g, fr) => {
    if (fr % 2) return;
    const a = R() * 6.28, d = 20 + R() * 28;
    g.fx.bolt(f.x, f.y - 40, f.x + Math.cos(a) * d, f.y - 40 + Math.sin(a) * d, '#8dffb0', 5, 1.5);
  },
  airForce: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 30);
    for (let i = 0; i < 5; i++) g.fx.ring(x + f.facing * i * 30, y, 4, 40 - i * 4, 'rgba(180,255,210,0.75)', 13, 3);
    g.fx.directional(x, y, 12, f.facing > 0 ? 0 : Math.PI, 0.25, '#d8ffe6', 16, 'streak', 14, 2);
  },
  smashShock: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 44);
    g.fx.ring(x, y, 10, 86, '#8dffb0', 18, 8);
    for (let i = 0; i < 6; i++) { const a = R() * 6.28; g.fx.bolt(x, y, x + Math.cos(a) * 60, y + Math.sin(a) * 60, '#c8ffd8', 8, 2.4); }
    g.shake(7);
  },

  // Asta — anti-magic void
  antiMagic: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 48);
    g.fx.slash(x, y, 66, -1.8, 1.3, f.facing, '#e0203a', 24, 15);
    for (let i = 0; i < 14; i++) g.fx.add({ x: x + (R() - 0.5) * 70, y: y + (R() - 0.5) * 60, vx: (R() - 0.5) * 4, vy: (R() - 0.5) * 4, color: i % 3 ? '#12020a' : '#e0203a', kind: i % 3 ? 'smoke' : 'glow', life: 26, size: 9 });
  },
  voidAura: (f, g, fr) => {
    if (fr % 2) return;
    g.fx.add({ x: f.x + (R() - 0.5) * 38, y: f.y - R() * 78, vx: (R() - 0.5), vy: -1 - R() * 2, color: R() < 0.6 ? '#12020a' : '#d0102a', kind: R() < 0.6 ? 'smoke' : 'glow', life: 28, size: 8 });
  },

  // Gojo — space distortion
  limitless: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 44);
    for (let i = 0; i < 3; i++) g.fx.ring(x, y, 10 + i * 12, 72 - i * 14, i % 2 ? '#5fd2ff' : '#c9a8ff', 18, 4);
    g.fx.add({ x, y, color: '#ffffff', kind: 'glow', life: 12, size: 22 });
  },
  gravityPull: (f, g, fr, m) => {
    if (fr < m.startup || fr % 2) return;
    const [x, y] = front(f, 50);
    const a = R() * 6.28, d = 70;
    g.fx.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * 6, vy: -Math.sin(a) * 6, color: '#5fd2ff', kind: 'streak', life: 14, size: 3 });
  },
  hollowPurple: (f, g, fr, m) => {
    if (fr > m.startup) return;
    const [x, y] = front(f, 40);
    const k = fr / m.startup;
    g.fx.add({ x: x - 16, y, color: '#5fd2ff', kind: 'glow', life: 8, size: 6 + k * 14 });
    g.fx.add({ x: x + 16, y, color: '#ff5f7a', kind: 'glow', life: 8, size: 6 + k * 14 });
    if (fr === m.startup) { g.fx.ring(x, y, 10, 120, '#b067ff', 22, 12); g.flashScreen('#b067ff', 0.4); }
  },

  // Yuji — cursed impact / black flash
  blackFlash: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 40);
    g.fx.impact(x, y, 74, '#ff5f8a');
    for (let i = 0; i < 10; i++) { const a = R() * 6.28; g.fx.add({ x, y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, color: i % 2 ? '#1a0010' : '#ff5f8a', kind: 'shard', life: 22, size: 6 }); }
    g.shake(10); g.flashScreen('#ff5f8a', 0.22);
  },
  cursedFist: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 36);
    g.fx.ring(x, y, 6, 52, '#ff5f8a', 14, 6);
    g.fx.burst(x, y, 7, '#ffd0dd', 6, 'spark', 18, 4);
  },

  // Luffy — rubber stretch
  rubberStretch: (f, g, fr, m) => {
    if (fr < m.startup || fr > m.startup + 8) return;
    const reach = (fr - m.startup) / 8;
    const x0 = f.x + f.facing * 14, y0 = f.y - 44;
    const x1 = f.x + f.facing * (20 + reach * 80);
    g.fx.bolt(x0, y0, x1, y0 + (R() - 0.5) * 5, '#f2c79f', 4, 5);
  },
  gatling: (f, g, fr, m) => {
    if (fr < m.startup || fr % 2) return;
    const [x, y] = front(f, 40 + R() * 40);
    g.fx.impact(x, y + (R() - 0.5) * 40, 26, '#ffd2a8');
  },
  redHawk: (f, g, fr, m) => {
    if (fr < m.startup) return;
    const [x, y] = front(f, 34);
    for (let i = 0; i < 3; i++) g.fx.add({ x: x + (R() - 0.5) * 24, y: y + (R() - 0.5) * 24, vx: -f.facing * 2, vy: -R() * 2, color: R() < 0.5 ? '#ff5a1a' : '#ffb07a', kind: 'ember', life: 22, size: 9 });
  },

  // Saitama — pure pressure, minimal flash
  airPressure: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 46);
    for (let i = 0; i < 4; i++) g.fx.ring(x + f.facing * i * 40, y, 6, 78 - i * 12, 'rgba(255,255,255,0.8)', 15, 5);
    g.fx.directional(x, y, 16, f.facing > 0 ? 0 : Math.PI, 0.2, '#ffffff', 20, 'streak', 16, 3);
    g.shake(9);
  },
  seriousWind: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    g.fx.ring(f.x, f.y - 44, 20, 320, '#ffffff', 26, 16);
    g.fx.impact(f.x + f.facing * 60, f.y - 44, 130, '#ffe58a');
    g.shake(24); g.flashScreen('#ffffff', 0.5);
  },

  // Eren — steam & hardening
  steamBurst: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 44);
    for (let i = 0; i < 16; i++) g.fx.add({ x: x + (R() - 0.5) * 60, y: y + (R() - 0.5) * 50, vx: (R() - 0.5) * 4, vy: -1 - R() * 3, color: '#e8e2d4', kind: 'smoke', life: 34, size: 13 });
    g.fx.impact(x, y, 58, '#ffd9a0');
  },
  hardenCrack: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    g.fx.ring(f.x + f.facing * 40, f.y, 10, 140, '#c39a5a', 22, 11);
    for (let i = 0; i < 16; i++) g.fx.add({ x: f.x + (R() - 0.5) * 160, y: f.y - 4, vx: (R() - 0.5) * 6, vy: -3 - R() * 5, color: '#8a6a44', kind: 'shard', life: 30, size: 8, grav: 0.35 });
    g.shake(12);
  },

  // Denji — chainsaw grind & blood
  sawGrind: (f, g, fr, m) => {
    if (fr < m.startup || fr % 2) return;
    const [x, y] = front(f, 44 + R() * 16);
    g.fx.add({ x, y: y + (R() - 0.5) * 40, vx: -f.facing * (2 + R() * 5), vy: -R() * 4, color: R() < 0.6 ? '#c01020' : '#ff9d1f', kind: 'spark', life: 16, size: 3.5 });
    if (fr % 6 === 0) g.fx.impact(x, y, 24, '#ff3a3a');
  },
  bloodSpray: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 46);
    for (let i = 0; i < 18; i++) { const a = -1 + R() * 2; g.fx.add({ x, y, vx: Math.cos(a) * 8 * f.facing, vy: Math.sin(a) * 7, color: '#c01020', kind: 'glow', life: 26, size: 7, grav: 0.3 }); }
    g.fx.slash(x, y, 60, -1.6, 1.4, f.facing, '#ff3a3a', 20, 13);
  },

  // Ichigo — spirit crescent
  getsuga: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 48);
    g.fx.slash(x, y, 70, -1.9, 1.3, f.facing, '#6a5cff', 24, 16);
    g.fx.slash(x, y, 58, -1.5, 1.1, f.facing, '#c0b4ff', 11, 13);
    for (let i = 0; i < 10; i++) g.fx.add({ x, y, vx: f.facing * (2 + R() * 6), vy: (R() - 0.5) * 6, color: '#8a7cff', kind: 'streak', life: 18, size: 4 });
  },
  reiatsu: (f, g, fr) => {
    if (fr % 3) return;
    g.fx.add({ x: f.x + (R() - 0.5) * 42, y: f.y - R() * 80, vy: -2.6, color: R() < 0.5 ? '#6a5cff' : '#c0b4ff', kind: 'glow', life: 24, size: 7 });
  },

  // Sukuna — surgical curse cuts, Black Flash, Fuga, and Shrine.
  // Every blade beat below uses the animated black cut only.
  sukunaCleave: (f, g, fr, m) => {
    const [x, y] = front(f, m.stance === 'air' ? 36 : 48, m.stance === 'down' ? -18 : -44);
    if (fr === m.startup) {
      const power = m.ability === 'ultimate' || m.ability === 'limit' || m.ability === 'awakened' ? 1.9
        : m.ability === 'special' || m.ability === 'awaken' ? 1.35 : 1;
      cleave(g, x, y, m.stance === 'air' ? 58 : 68, -1.85 + (R() - .5) * .12, power, 0, m.stance === 'air');
      cleave(g, x - f.facing * 12, y + 7, 48, 1.55 - (R() - .5) * .1, power * .72, 3, m.stance === 'air');
      g.fx.ring(x, y, 7, 70, '#ff315d', 14, 5);
      g.fx.burst(x, y, 8, '#ff6b7e', 6, 'spark', 18, 4);
    }
    if (fr >= m.startup && fr % 3 === 0) {
      g.fx.add({ x: x + (R() - .5) * 48, y: y + (R() - .5) * 38, vx: -f.facing * (2 + R() * 3), vy: (R() - .5) * 3, color: R() < .5 ? '#ff2347' : '#ffd4cb', kind: 'streak', life: 14, size: 2 + R() * 3 });
    }
  },
  sukunaBlackFlash: (f, g, fr, m) => {
    const [x, y] = front(f, 48, -44);
    if (fr < m.startup) {
      if (fr % 2 === 0) g.fx.add({ x: x + (R() - .5) * 28, y: y + (R() - .5) * 28, vx: -f.facing * 2, vy: -R() * 2, color: '#ff2347', kind: 'glow', life: 12, size: 5 });
      return;
    }
    if (fr === m.startup) {
      g.fx.impact(x, y, f.sukunaBlackFlash ? 120 : 58, f.sukunaBlackFlash ? '#ff174d' : '#ff8b98');
      if (f.sukunaBlackFlash) {
        cleave(g, x, y, 92, -2 + (R() - .5) * .1, 2.3);
        cleave(g, x, y - 4, 70, 1.6, 1.6, 2);
        g.fx.ring(x, y, 10, 150, '#ff315d', 22, 10); g.flashScreen('#ff174d', .7); g.shake(15);
      }
    }
  },
  sukunaFuga: (f, g, fr, m) => {
    const [x, y] = front(f, 36, -28);
    if (fr < m.startup) { if (fr % 2 === 0) g.fx.add({ x: x + (R() - .5) * 20, y: y + (R() - .5) * 20, color: '#ff8a3a', kind: 'ember', life: 10, size: 4 }); return; }
    if (fr >= m.startup && fr < m.startup + 14) { g.fx.ring(x, y, 8, 54 + fr * 2, '#ff5a24', 12, 4); for (let i = 0; i < 3; i++) g.fx.add({ x, y, vx: f.facing * (2 + R() * 4), vy: -R() * 3, color: R() < .5 ? '#ff5a24' : '#ffe09a', kind: 'ember', life: 18, size: 7 }); }
  },
  sukunaPhantom: (f, g, fr, m) => {
    if (fr >= m.startup && fr < m.startup + 22) {
      const [x, y] = [f.x - f.facing * fr * 2.2, f.y - 42];
      cleave(g, x, y, 54, -1.7 + (R() - .5) * .16, 1.1);
      g.fx.add({ x, y, color: '#ff315d', kind: 'smoke', life: 16, size: 15 });
    }
  },
  sukunaShrine: (f, g, fr, m) => {
    if (fr < m.startup) { if (fr % 3 === 0) { g.fx.ring(f.x, f.y - 45, 12, 60 + fr * 4, '#ff2347', 16, 5); g.fx.add({ x: f.x + (R() - .5) * 90, y: f.y - R() * 100, vy: -1, color: '#ff315d', kind: 'glow', life: 20, size: 6 }); } return; }
    if (fr === m.startup) { g.fx.ring(f.x, f.y - 150, 20, 420, '#ff2347', 30, 18); g.fx.impact(f.x, f.y - 120, 180, '#ff315d'); g.shake(20); }
    if (fr > m.startup && fr % 4 === 0) { const x = f.x + (R() - .5) * 360; cleave(g, x, f.y - 40 - R() * 160, 44, -1.8 + (R() - .5) * .5, .8); }
  },

  // generic fallbacks
  none: () => { },

  // ---- Shadow DIO ---------------------------------------------------------
  // Unarmed hits: a tight gold shock ring plus a short green motion smear, so a
  // light punch reads far lighter than a Stand strike.
  dioFist: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 46);
    g.fx.ring(x, y, 4, 34, '#ffe45c', 9, 3);
    g.fx.directional(x - f.facing * 12, y, 3, f.facing > 0 ? -.3 : Math.PI + .3, .4, '#8affd0', 7, 'streak', 9, 2);
    for (let i = 0; i < 3; i++) g.fx.add({ x: x - f.facing * R() * 16, y: y + (R() - .5) * 20, vx: -f.facing * (2 + R() * 3), vy: (R() - .5) * 2, color: i % 2 ? '#8affd0' : '#ffe45c', kind: 'glow', life: 12, size: 3.5 });
  },
  // Rapid alternating fists: an expanding chain of small shock rings.
  dioFlurry: (f, g, fr, m) => {
    if (fr < m.startup) { if (fr % 2 === 0) g.fx.add({ x: f.x + f.facing * (20 + R() * 26), y: f.y - 46 + (R() - .5) * 30, vx: -f.facing * 4, color: '#8affd0', kind: 'glow', life: 10, size: 4 + R() * 3 }); return; }
    if (fr > m.startup && fr % 3 === 0) {
      const k = 1 + (fr - m.startup) * .07;
      g.fx.ring(f.x + f.facing * 44, f.y - 46, 6, 34 * k, '#ffe45c', 8, 2.5);
      g.fx.directional(f.x + f.facing * 48, f.y - 46, 2, f.facing > 0 ? -.2 : Math.PI + .2, .5, '#8affd0', 9, 'streak', 8, 2);
    }
  },
  // Thrown blades: a spinning silver disc with a gold trail.
  dioKnife: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 42);
    g.fx.ring(x, y, 6, 40, '#dfe8f2', 10, 3);
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + R(); g.fx.add({ x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, color: i % 2 ? '#dfe8f2' : '#ffe45c', kind: 'spark', life: 14, size: 3 }); }
  },
  // The two-finger point: a narrow converging lens of light.
  dioPoint: (f, g, fr, m) => {
    if (fr === m.startup) {
      const [x, y] = front(f, 50);
      for (let i = 0; i < 3; i++) g.fx.ring(x, y, 8 + i * 10, 46 - i * 8, i ? '#8affd0' : '#ffe45c', 11, 2.5);
      g.fx.impact(x, y, 46, '#ffe45c');
    }
  },
  // The World striking: a heavy violet-and-green shock, clearly above a fist hit.
  standFlurry: (f, g, fr, m) => {
    if (fr === m.startup) {
      const [x, y] = front(f, 58, -46);
      g.fx.ring(x, y, 10, 96, '#8affd0', 15, 6);
      g.fx.ring(x, y, 16, 58, '#ffe45c', 12, 4);
      g.fx.impact(x, y, 54, '#c9b6ff');
      for (let i = 0; i < 8; i++) { const a = R() * 6.28; g.fx.add({ x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, color: i % 2 ? '#8affd0' : '#c9b6ff', kind: 'streak', life: 14, size: 3 }); }
    }
    if (fr > m.startup && fr % 4 === 0) {
      const [x, y] = front(f, 52, -46);
      g.fx.directional(x, y, 2, f.facing > 0 ? -.2 : Math.PI + .2, .6, '#8affd0', 11, 'streak', 10, 2.5);
    }
  },
  // Time Stop charge: a collapsing clock-hand cross that winds backwards.
  dioTimeCast: (f, g, fr, m) => {
    if (fr < m.startup) {
      const k = 1 - fr / Math.max(1, m.startup);
      if (fr % 2 === 0) {
        const a = R() * 6.28, r = 24 + k * 52;
        g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 42 + Math.sin(a) * r, vx: -Math.cos(a) * 2.6 * k, vy: -Math.sin(a) * 2.6 * k, color: R() < .5 ? '#8affd0' : '#ffe45c', kind: 'glow', life: 16, size: 4 + k * 6 });
      }
      if (fr % 6 === 0) g.fx.ring(f.x, f.y - 42, 26 * k, 30 * k + 8, '#ffe45c', 14, 2);
      return;
    }
    if (fr === m.startup) { g.fx.ring(f.x, f.y - 42, 8, 120, '#8affd0', 18, 7); g.fx.impact(f.x, f.y - 42, 90, '#ffffff'); g.shake(10); }
  },

  // ==========================================================================
  // GOKU · ULTRA INSTINCT
  // Every one of these is built from the same additive vocabulary: a white-hot
  // dual-pass bloom, a hard ring, and a burst of silver sparks. Nothing here
  // uses a warm hue — the character is literally colourless energy.
  // ==========================================================================
  /** Ghost jab: a vacuum cone that collapses inward as the fist passes through. */
  uiGhost: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 40, -44);
    const a = f.facing > 0 ? -0.12 : Math.PI + 0.12;
    g.fx.slash(x, y, 30, a - 0.7, a + 0.7, f.facing, '#e2e8f0', 10, 8);
    g.fx.ring(x, y, 26, 4, '#f8fafc', 9, 3);
    g.fx.bloom(x, y, 30, '#e2e8f0', 12, 2.4);
    for (let i = 0; i < 7; i++) g.fx.add({ x: x + f.facing * R() * 30, y: y - 16 + R() * 32, vx: -f.facing * (2 + R() * 4), vy: (R() - .5) * 3, color: i % 2 ? '#ffffff' : '#93c5fd', kind: 'spark', life: 12, size: 3 });
  },
  /** Impact beat: a double bloom plus the manga word. */
  uiBurst: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 48, -44);
    // Silver, not white. A near-white decal at this size stops reading as light
    // and starts reading as a sticker; the platinum body and the white core
    // inside it do the work instead.
    g.fx.bloom(x, y, 44, PLAT, 15, 3.4);
    g.fx.impact(x, y, 38, '#cfe4fb');
    g.fx.ring(x, y, 8, 84, PLAT, 13, 3.5);
    g.fx.word(x, y - 62, 'ZASH!', '#dbeafe', 40, 26);
    g.shake(6);
  },
  /** Aerial ring: a spinning silver torus seen edge-on. */
  uiRing: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const y = f.y - 44;
    for (let i = 0; i < 3; i++) {
      const rx = 40 + i * 18, ry = 34 - i * 9;
      g.fx.ring(f.x, y, rx, rx * 0.6, i === 1 ? '#ffffff' : '#93c5fd', 13 - i * 2, 4);
      void ry;
    }
    g.fx.bloom(f.x, y, 46, '#e2e8f0', 15, 3);
    for (let i = 0; i < 9; i++) { const a = R() * 6.28; g.fx.add({ x: f.x + Math.cos(a) * 44, y: y + Math.sin(a) * 40, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, color: '#f8fafc', kind: 'streak', life: 14, size: 3 }); }
  },
  /** Sonic boom cone: a stretched, forward-thrust lens. */
  uiCone: (f, g, fr, m) => {
    if (fr !== m.startup) return;
    const [x, y] = front(f, 52, -44);
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.3;
      g.fx.ring(x + f.facing * i * 12, y, 30 * k, 8 * k, i ? '#93c5fd' : '#ffffff', 10 - i, 3);
    }
    g.fx.bloom(x, y, 44, '#e0f2fe', 13, 3);
    g.fx.directional(x, y, 6, f.facing > 0 ? 0 : Math.PI, 0.3, '#ffffff', 18, 'streak', 10, 2.5);
  },
  /** The sliding Kamehameha wave itself: a long, low, additive lens. */
  uiBeam: (f, g, fr, m) => {
    if (fr < m.startup) {
      // Telegraph: the palms draw in and the light converges on the hands.
      const k = fr / Math.max(1, m.startup);
      if (fr % 2 === 0) {
        const a = R() * 6.28, r = 96 * (1 - k) + 20;
        g.fx.add({ x: f.x + f.facing * 54 + Math.cos(a) * r, y: f.y - 44 + Math.sin(a) * r, vx: -Math.cos(a) * 5, vy: -Math.sin(a) * 5, color: R() < .5 ? '#e0f2fe' : '#93c5fd', kind: 'glow', life: 14, size: 4 + k * 6 });
      }
      if (fr === m.startup - 1) { g.fx.bloom(f.x + f.facing * 56, f.y - 44, 40, '#e0f2fe', 12, 3); g.shake(6); }
      return;
    }
    if (fr > m.dur - 4) return;
    // The wave is a dense stream of additive streaks leaving the hands. Built
    // from particles rather than one long polygon so it lands in the top
    // additive pass and is never buried under the swing arc drawn after it.
    if (fr % 2 === 0) {
      for (let i = 0; i < 5; i++) {
        const d = 18 + i * 30;
        g.fx.add({
          x: f.x + f.facing * d, y: f.y - 40 + (R() - .5) * 30,
          vx: f.facing * (18 + R() * 12), vy: (R() - .5) * 3,
          color: i % 2 ? '#e0f2fe' : '#93c5fd', kind: 'streak',
          life: 11, size: 9 - i * 1.1, drag: 0.97,
        });
      }
      g.fx.bloom(f.x + f.facing * 46, f.y - 40, 48, '#e0f2fe', 9, 3);
      g.fx.bloom(f.x + f.facing * 120, f.y - 40, 36, '#93c5fd', 8, 5);
      // The wave is surfacing, so a skirt of light skims the floor with it.
      g.fx.bloom(f.x + f.facing * 80, f.y - 6, 28, '#93c5fd', 8, 8);
    }
  },
  /** The Soaring Fist: three dissolving after-images down the rush line. */
  uiRush: (f, g, fr, m) => {
    if (fr < 3 || fr > m.dur) return;
    if (fr % 3 === 0) {
      g.fx.bloom(f.x + f.facing * 40, f.y - 44, 30, '#e2e8f0', 10, 2.6);
      g.fx.directional(f.x, f.y - 44, 2, f.facing > 0 ? Math.PI : 0, 0.4, '#ffffff', 14, 'streak', 9, 2.4);
    }
  },
  /** Autonomous Counter: a perfectly still, slowly closing shell. */
  uiCounter: (f, g, fr, m) => {
    if (fr > (m.counter?.[1] ?? m.dur)) return;
    if (fr % 4 === 0) {
      const k = 1 - fr / Math.max(1, m.counter?.[1] ?? m.dur);
      g.fx.ring(f.x, f.y - 42, 70 * k + 10, 74 * k + 12, '#93c5fd', 14, 2.5);
    }
    if (fr % 2 === 0) {
      const a = R() * 6.28, r = 70;
      g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 42 + Math.sin(a) * r, vx: -Math.cos(a) * 4, vy: -Math.sin(a) * 4, color: R() < .5 ? '#ffffff' : '#a5f3fc', kind: 'glow', life: 16, size: 5 });
    }
  },
  /** The Supreme Godly Display: a collapsing corona behind the whole animation. */
  uiUlt: (f, g, fr, m) => {
    if (fr > m.dur) return;
    const k = Math.min(1, fr / m.dur);
    // Matter drawn inward along its own tangent. Concentric rings are avoided
    // deliberately: stacking them on one centre produces a bullseye, which is
    // the one shape a collapsing galaxy must never look like.
    if (fr % 2 === 0) {
      const a = R() * 6.28, r = 40 + k * 150;
      g.fx.add({
        x: f.x + Math.cos(a) * r, y: f.y - 44 + Math.sin(a) * r * .8,
        vx: -Math.cos(a) * (4 + k * 20), vy: -Math.sin(a) * (4 + k * 20),
        color: fr % 2 ? '#f8fafc' : '#93c5fd', kind: 'streak', life: 18, size: 3 + k * 5,
      });
    }
    // Beat 3 only: the sphere itself collapsing, one bloom rather than a stack.
    if (fr >= 78 && fr % 2 === 0) g.fx.bloom(f.x, f.y - 44, 22 + (fr - 78) * 7, '#e0f2fe', 10, 6);
  },
};

// Cut angle follows the swing of the animation so every slash reads like the anime.
function cutAngle(anim: string | undefined, facing: number) {
  const a = anim || '';
  const base = /upslash|uppercut|rise|castUp/.test(a) ? -1.15 : /dive|slam|dkick/.test(a) ? 1.0 : /sweep|lowslash/.test(a) ? .12 : /thrust|punch/.test(a) ? -.08 : /spin|flip/.test(a) ? -.6 : -.42;
  const jitter = (R() - .5) * .35;
  return facing > 0 ? base + jitter : Math.PI - base - jitter;
}
/**
 * Sukuna's Dismantle/Cleave is the original animated black-and-white gash
 * (`Effects.cut` → `drawAnimeCut`): a razor-thin line that shoots out, splits
 * into a tapered lens and seals shut. Length and thickness scale with how hard
 * the blow is. Grounded blade work never spawns the sweeping crescent.
 *
 * The whipping crescent (`Effects.arcCut` → `drawArcSlash`) is reserved for
 * aerial cuts, so it only appears when `aerial` is set.
 */
export function cleave(g: any, x: number, y: number, len: number, ang: number, power = 1, delay = 0, aerial = false) {
  const p = Math.max(0.35, Math.min(2.4, power));
  const life = Math.round(14 + 10 * p);
  g.fx.cut(x, y, len * (0.72 + 0.42 * p), ang, life, 0.55 + 0.75 * p, delay);
  // Aerial only: the crescent trails the downward air slash.
  if (aerial) g.fx.arcCut(x, y, len * (0.95 + 0.5 * p), ang + (R() - .5) * .3, (R() < .5 ? 1 : -1) * (.5 + .32 * p), life + 4, .45 + .55 * p, delay);
}
export function sukunaCuts(g: any, f: any, m: any, b: { x: number; y: number; w: number; h: number }, n = 1) {
  // Hit geometry that resolves while Sukuna is off the ground is an aerial cut.
  const aerial = !f.grounded;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, len = Math.max(b.w, b.h) * 1.35 + 30;
  for (let i = 0; i < n; i++) {
    const ang = i === 0 ? cutAngle(m?.anim, f.facing) : cutAngle(m?.anim, f.facing) + (i % 2 ? 1.1 : -1.1);
    g.fx.cut(cx + (R() - .5) * b.w * .25, cy + (R() - .5) * b.h * .25, len, ang, 20, 1, i * 3);
    if (i === 0 && aerial) g.fx.arcCut(cx + (R() - .5) * b.w * .25, cy + (R() - .5) * b.h * .25, len * 1.15, ang, (R() < .5 ? 1 : -1) * .85, 24, 1, 3);
  }
}

export function runVfx(name: string | undefined, f: any, g: any, fr: number, m: any) {
  const id = f.def?.styleId || f.def?.id;
  const boss = id === 'sukuna' || id === 'gojo';
  const profile = AWAKENINGS[id];
  const hits: MoveDef['hits'] = m.hits || [];
  // Use the same transform and active windows as Game's collision loop.
  // Refresh sparse geometry during motion rather than leaving a false hit area behind.
  if (hits.length && name !== 'none') {
    const scale = f.scale || 1;
    for (const h of hits.slice(0, 8)) {
      if (fr < h.f[0] || fr > h.f[1] || (fr - h.f[0]) % 3 !== 0) continue;
      const bounds = { x: f.x + h.x * scale * f.facing - h.w * scale / 2, y: f.y + h.y * scale - h.h * scale / 2, w: h.w * scale, h: h.h * scale };
      const life = Math.min(3, h.f[1] - fr + 1);
      if (boss) {
        const key = `${m.name || name || ''}`.toLowerCase();
        if (id === 'sukuna') {
          // Sukuna's only blade visual is the animated black cut. Fuga is a fire
          // arrow, so it keeps its own silhouette; everything else cuts.
          if (/fuga|flame|arrow/.test(key)) g.fx.shape('fuga', bounds, life, { facing: f.facing, seed: h.f[0], progress: 1 });
          else if ((fr - h.f[0]) % 6 === 0) sukunaCuts(g, f, m, bounds, /cross|lattice|web|execution/.test(key) ? 3 : 1);
        } else {
          const kind: BossVfxKind = /void|domain/.test(key) ? 'void' : /purple|hollow/.test(key) ? 'purple' : /red|reversal|repul/.test(key) ? 'red' : 'blue';
          g.fx.shape(kind, bounds, life, { facing: f.facing, seed: h.f[0], progress: 1 });
        }
      } else {
        const sp = SWING_PROFILES[id];
        // `quietHits` marks an attack that brings its own visual (a beam, a
        // sustained wave). The generic swing would fire one giant arc across it,
        // so those moves opt out entirely.
        if (sp && !m.quietHits && fr === h.f[0]) {
          const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2, r = Math.max(bounds.w, bounds.h) * .62 + 12;
          const arcStyle = ARC_STYLES.includes(sp.style) || (sp.style === 'lightning' && !/punch|kick|dkick|thrust|cast/.test(m.anim || ''));
          if (!arcStyle) g.fx.swing(cx + f.facing * bounds.w * .2, cy, r, 0, 0, sp, f.facing, 16, f.facing);
          else {
            const [l0, l1] = swingArc(m.anim), toWorld = (a: number) => f.facing > 0 ? a : Math.PI - a;
            g.fx.swing(f.x + f.facing * 6, cy, Math.max(r, Math.abs(cx - f.x) + bounds.w * .35), toWorld(l0), toWorld(l1), sp, f.facing, 15, 1 + Math.min(1, h.dmg / 14));
          }
        } else if (!sp) g.fx.strike(m.techniqueStyle || profile?.style || 'pressure', bounds, profile?.color || f.look.energy, profile?.color2 || f.look.energy2, f.facing, life);
      }
    }
    return;
  }
  if (boss) {
    // Projectile renderers own released attacks. Only small hand-attached charge
    // marks appear here, so recovery never spawns a second damaging-looking wave.
    if (fr < m.startup && fr % 3 === 0) {
      const scale = f.scale || 1, size = (12 + 14 * fr / Math.max(1, m.startup)) * scale;
      const key = `${name || ''} ${m.name || ''}`.toLowerCase();
      if (id === 'sukuna') {
        // Sukuna has exactly one blade visual: the animated black cut.
        cleave(g, f.x + f.facing * 28 * scale, f.y - 48 * scale, size * 2.6, -1.7 + (R() - .5) * .3, .5 + fr / Math.max(1, m.startup) * .5, 0, !f.grounded);
      } else {
        const kind: BossVfxKind = /void/.test(key) ? 'void' : /purple/.test(key) ? 'purple' : /red/.test(key) ? 'red' : 'blue';
        g.fx.shape(kind, { x: f.x + f.facing * 28 * scale - size / 2, y: f.y - 48 * scale - size / 2, w: size, h: size }, 3, { facing: f.facing, alpha: .6, progress: fr / Math.max(1, m.startup) });
      }
    }
    return;
  }
  if (name?.startsWith('tech:')) {
    const [, profileId, tier, stance] = name.split(':');
    techniqueVfx(profileId, tier as TechniqueTier, stance as TechniqueStance, f, g, fr, m);
    return;
  }
  const fn = name ? VFX[name] : undefined;
  if (fn) fn(f, g, fr, m);
  else fallbackVfx(f, g, fr, m);
}
