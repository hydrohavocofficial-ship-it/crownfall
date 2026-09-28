import { HitDef, MoveDef, AnimName } from './types';
import { Look } from './render';
import { sfx } from './audio';
import { makePortrait } from './portraits';
import { applySignatures, mergeSignatures } from './abilities';
import { installTechniques, type TechniqueMoveKey } from './techniques';
import leviPortrait from '../assets/portraits/levi.jpg';
import killuaPortrait from '../assets/portraits/killua.jpg';
import rengokuPortrait from '../assets/portraits/rengoku.jpg';
import madaraPortrait from '../assets/portraits/madara.jpg';
import astaPortrait from '../assets/portraits/asta.jpg';
import { SUKUNA } from './sukuna';
import { SHADOW_DIO } from './shadowdio';
import { GOKU_BLACK } from './gokublack';
import { GOKU_UI } from './goku_ui';
import { GASTER } from './gaster';
import { DOFLAMINGO } from './doflamingo';
import './doflamingoArt';
import './gasterArt';
import { applyArtDirection } from './artDirection';
import { installBossKit } from './bossKits';
import { installAwakenedKits } from './awakenKits';

export type CoreMoveKey =
  | 'nlight' | 'nlight2' | 'nlight3' | 'nlight_spec' | 'nlight_heavy'
  | 'slight' | 'slight2' | 'slight_spec' | 'slight_heavy'
  | 'dlight' | 'dlight2' | 'dlight_spec'
  | 'nair' | 'nair2' | 'nair_spec'
  | 'sair' | 'sair2' | 'sair_spec'
  | 'dair' | 'nsig' | 'ssig' | 'dsig' | 'rec' | 'gp'
  | 'nspec' | 'sspec' | 'dspec';
export type ExtraMoveKey = 'aspec' | 'aig' | 'boss_heavy2' | 'boss_finisher';
export type MoveKey = CoreMoveKey | TechniqueMoveKey | ExtraMoveKey;

/**
 * A fighter's authored base kit.
 *
 * `ult` is not a move and never reaches `moves`: it is a retained set-piece the
 * technique builder re-homes as the neutral awakened special. See `CharDef.domain`.
 */
export type CoreKit = Record<CoreMoveKey, MoveDef> & { ult?: MoveDef };

export interface MoveVariantBranch { input: string; name: string; desc: string }
export interface CharDef {
  id: string; styleId?: string; name: string; anime: string; title: string; desc: string;
  /** The one word the HUD and the select grid print, when it is not the first word of `name`. */
  short?: string;
  color: string; portrait: string; tier?: string;
  stats: { speed: number; air: number; jump: number; weight: number; scale: number; gravity: number };
  statBars: { power: number; speed: number; range: number; defense: number };
  look: Look;
  moves: Record<CoreMoveKey | TechniqueMoveKey, MoveDef> & Partial<Record<ExtraMoveKey, MoveDef>>;
  /**
   * A retained set-piece, and the only place a move that is not bound to a
   * button can live.
   *
   * The ultimate is gone as a button, but a Malevolent Shrine, a Hollow Purple
   * and a Rumbling are why those characters are on the roster at all. Whatever
   * used to sit on `ult` is kept here and handed to the technique builder, which
   * re-homes it as the neutral awakened special at reduced power. It is not in
   * `moves`, so it is not on the move list and not reachable on its own.
   */
  domain?: MoveDef;
  moveBranches: MoveVariantBranch[];
  abilities: { key: string; name: string; desc: string }[];
  passives?: { name: string; desc: string }[];
  /**
   * Ultra Instinct form. When set, the fighter's transformation state repaints
   * him in the silver crown, the concentric eyes and the cosmic aura — so an
   * existing roster member can tap into the God-Tier look and numbers on his
   * Awakening without needing a second character definition.
   */
  uiForm?: boolean;
  ai: { vertSpec?: MoveKey; horizSpec?: MoveKey; zoneSpec?: MoveKey; counterSpec?: MoveKey; ultRange: number };
}

type FXK = HitDef['fx'];
const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, o: Partial<HitDef> = {}): HitDef =>
  ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, ...o });
const MULTI = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, fin: number, ang: number, kb: number, sc: number, fx: FXK, rehit = 4): HitDef[] => [
  H(f0, f1, x, y, w, h, dmg, 80, 1.6, 0, { rehit, pull: true, fx, g: 0 }),
  H(f1 + 1, f1 + 4, x, y, w * 1.08, h * 1.08, fin, ang, kb, sc, { fx, g: 1 }),
];
/** move builder */
const mv = (name: string, anim: AnimName, dur: number, su: number, hits: HitDef[], o: Partial<MoveDef> = {}): MoveDef =>
  ({ name, anim, dur, startup: su, hits, ...o });

// chain link helpers
const cN = (w: [number, number]) => ({ light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cN2 = (w: [number, number]) => ({ light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cS = (w: [number, number]) => ({ light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cS2 = (w: [number, number]) => ({ special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cD = (w: [number, number]) => ({ light: 'dlight2', special: 'dlight_spec', window: w });
const cA = (w: [number, number]) => ({ light: 'nair2', special: 'nair_spec', window: w });
const cSA = (w: [number, number]) => ({ light: 'sair2', special: 'sair_spec', window: w });

interface Spec {
  id: string; name: string; anime: string; title: string; desc: string; color: string; img?: string; tier?: string;
  stats: CharDef['stats']; bars: CharDef['statBars']; look: Look;
  moves: CoreKit; ai: CharDef['ai'];
  /** Repaints the fighter in the Ultra Instinct silver form on transformation. */
  uiForm?: boolean;
}
function mk(s: Spec): CharDef {
  // Signature overrides land first, because one of the things they produce is the
  // retained set-piece - and the technique builder needs that in hand to re-home
  // it as the neutral awakened special rather than let it sit unreachable.
  const merged = mergeSignatures(s.id, s.moves as Record<string, MoveDef>);
  const m = installTechniques(s.id, s.look, merged.moves as Record<CoreMoveKey, MoveDef>, merged.domain) as Record<MoveKey, MoveDef>;
  return {
    id: s.id, styleId: s.id, name: s.name, anime: s.anime, title: s.title, desc: s.desc, color: s.color, tier: s.tier,
    portrait: makePortrait(s.id, s.look, s.color),
    stats: s.stats, statBars: s.bars, look: s.look, moves: m, domain: merged.domain,
    // Base Goku's Awakening is already named Ultra Instinct, so his
    // transformation state repaints him in the silver crown and the cosmic
    // shell — the God-Tier look, on the fighter who earned it first.
    uiForm: s.uiForm,
    moveBranches: [
      { input: 'J → J → J', name: `${m.nlight.name} Chain`, desc: `${m.nlight.name} → ${m.nlight2.name} → ${m.nlight3.name}.` },
      { input: 'J → L', name: m.nlight_spec.name!, desc: 'Cancels the light string into a signature EX burst.' },
      { input: 'J → K', name: m.nlight_heavy.name!, desc: 'Launcher finisher that pops foes into juggle range.' },
      { input: '→ J → J / L / K', name: m.slight2.name!, desc: `${m.slight.name} extends into ${m.slight2.name}, ${m.slight_spec.name} or ${m.slight_heavy.name}.` },
      { input: '↓ J → J / L', name: m.dlight2.name!, desc: `${m.dlight.name} extends into ${m.dlight2.name} or ${m.dlight_spec.name}.` },
      { input: 'Air J → J / L', name: m.nair2.name!, desc: `${m.nair.name} chains into ${m.nair2.name} or ${m.nair_spec.name}.` },
      { input: 'L · N / → / ↓ / Air', name: m.nspec.name!, desc: `${m.nspec.desc} Four stances: ${m.nspec.name}, ${m.sspec.name}, ${m.dspec.name}, ${m.aspec?.name ?? m.sspec.name}.` },
      { input: `R @ full gauge · N / → / ↓ / Air`, name: m.naw.name!, desc: `Spends the whole gauge to Awaken. Direction picks the transformation stance: ${m.naw.name}, ${m.saw.name}, ${m.daw.name}, ${m.aaw.name}.` },
      { input: 'AWAKENED · J', name: m.nwl.name!, desc: `${m.nwl.desc} Stances: ${m.swl.name}, ${m.dwl.name}, ${m.awl.name}.` },
      { input: 'AWAKENED · K', name: m.nwh.name!, desc: `${m.nwh.desc} Chains into the matching special. Stances: ${m.swh.name}, ${m.dwh.name}, ${m.awh.name}.` },
      { input: 'AWAKENED · L', name: m.nfu.name!, desc: `${m.nfu.desc} Stances: ${m.nfu.name}, ${m.sfu.name}, ${m.dfu.name}, ${m.afu.name}.` },
    ],
    abilities: [
      { key: 'L · Neutral Special', name: m.nspec.name!, desc: m.nspec.desc! },
      { key: 'L · Side Special', name: m.sspec.name!, desc: m.sspec.desc! },
      { key: 'L · Down Special', name: m.dspec.name!, desc: m.dspec.desc! },
      { key: 'R · Awaken (full gauge)', name: m.naw.name!, desc: `${m.naw.desc} The gauge drains from full to empty over about thirty seconds; at zero the Awakening ends.` },
      { key: 'AWAKENED · J · Light', name: m.nwl.name!, desc: m.nwl.desc! },
      { key: 'AWAKENED · K · Heavy', name: m.nwh.name!, desc: m.nwh.desc! },
      { key: 'AWAKENED · L · Special', name: m.nfu.name!, desc: m.nfu.desc! },
    ],
    ai: s.ai,
  };
}
const ST = (speed: number, air: number, jump: number, weight: number, scale: number, gravity = 0.61) => ({ speed, air, jump, weight, scale, gravity });
const BR = (power: number, speed: number, range: number, defense: number) => ({ power, speed, range, defense });

// ---------------------------------------------------------------------------
// RETAINED SET-PIECES
//
// These are the bodies that used to sit on `ult`. The ultimate is gone as a
// button, but the transformation bursts, the beam columns and the summoned
// avatars are the biggest moments these fighters have, so they are kept as raw
// material: `mk` lifts whatever is on `ult` out of the move table and hands it
// to the technique builder, which re-homes it as the neutral awakened special at
// half power with a shorter cast. They are deliberately not in `moves` - nothing
// here is reachable on its own.
// ---------------------------------------------------------------------------
const dTransform = (name: string, label: string, desc: string, mode: 'god' | 'devil', col: string, vfx: string, dur = 580): MoveDef => ({
  name, desc, dur: 52, startup: 22, anim: 'castUp', invuln: [0, 40], grav: 0.2, vfx, cin: 46,
  hits: [H(22, 30, 0, -42, 320, 240, 11, 60, 7.2, 6.2, { fx: 'blunt' })],
  onFrame: (f: any, fr: number, g: any) => {
    // Charge: a rising column of light and three tightening rings.
    if (fr < 22) {
      if (fr % 2 === 0) {
        const a = Math.random() * 6.28, k = fr / 22, r = 92 - k * 70;
        g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 42 + Math.sin(a) * r * .7, vx: -Math.cos(a) * (2 + k * 5), vy: -Math.sin(a) * (2 + k * 5) - 1, color: fr % 4 ? col : '#ffffff', kind: 'glow', life: 16, size: 4 + k * 8 });
      }
      if (fr % 4 === 0) g.fx.ring(f.x, f.y - 42, 40 + fr * 2.6, 44 + fr * 2.8, col, 14, 3);
      if (fr % 3 === 0) g.shake(1.5);
      g.fx.directional(f.x, f.y - 40, 1, -Math.PI / 2, .12, col, 26, 'streak', 14, 4);
      return;
    }
    if (fr === 22) {
      if (mode === 'devil') f.devilT = dur; else f.godT = dur;
      // Detonation: stacked shock rings, a ground wave and a full-screen flare.
      g.fx.ring(f.x, f.y - 42, 16, 300, col, 30, 20);
      g.fx.ring(f.x, f.y - 42, 16, 210, '#ffffff', 22, 10);
      g.fx.ring(f.x, f.y, 20, 420, col, 28, 16);
      g.fx.burst(f.x, f.y - 42, 54, col, 15, 'glow', 38, 9);
      for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; g.fx.add({ x: f.x, y: f.y - 42, vx: Math.cos(a) * (8 + Math.random() * 12), vy: Math.sin(a) * (6 + Math.random() * 10), color: i % 3 ? col : '#ffffff', kind: 'streak', life: 30, size: 5 }); }
      g.shake(24); g.flashScreen(col, 0.5); sfx('ult');
      g.fx.text(f.x, f.y - 168, label, '#ffffff', 30, 66);
    }
    // Sustain: a slow rotating halo so the awakened state keeps reading.
    if (fr > 22 && fr % 5 === 0) {
      g.fx.ring(f.x, f.y - 42, 60, 78, col, 16, 3);
      for (let i = 0; i < 3; i++) { const a = fr * .2 + i * 2.09; g.fx.add({ x: f.x + Math.cos(a) * 62, y: f.y - 42 + Math.sin(a) * 62, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, color: col, kind: 'glow', life: 20, size: 6 }); }
    }
  },
});
const dRush = (name: string, label: string, desc: string, col: string, fx: FXK, vfx: string): MoveDef => ({
  name, desc, dur: 46, startup: 10, anim: 'thrust', grav: 0, invuln: [0, 999], vfx, cin: 40,
  vel: [[0, 0, 0], [10, 25, 0], [26, 1, 0]],
  hits: [H(10, 26, 34, -44, 96, 96, 4, 80, 1, 0, { fx })],
  onHit: (f: any, t: any) => { if (!f.ultTarget) { f.ultTarget = t; f.ultStart = f.moveFrame; f.moveDur = f.moveFrame + 72; } },
  onFrame: (f: any, fr: number, g: any) => {
    if (fr < 10) {
      // Vanish: the body dissolves into speed lines before the first contact.
      if (fr % 2 === 0) { const a = Math.random() * 6.28; g.fx.add({ x: f.x + Math.cos(a) * 26, y: f.y - 40 + Math.sin(a) * 26, vx: -Math.cos(a) * 4, vy: -Math.sin(a) * 4, color: col, kind: 'glow', life: 14, size: 6 }); }
      if (fr === 9) { g.fx.ring(f.x, f.y - 40, 8, 90, col, 16, 5); g.shake(5); }
      return;
    }
    const t = f.ultTarget; if (!t) return;
    if (!t.alive) { f.ultTarget = null; f.moveDur = fr + 10; return; }
    const c = fr - f.ultStart;
    t.vx = 0; t.vy = 0; t.hitstun = Math.max(t.hitstun, 10); t.state = 'hitstun'; f.vx = 0; f.vy = 0;
    if (c < 52 && c % 5 === 0) {
      const a = Math.random() * 6.28, px = f.x;
      f.x = t.x + Math.cos(a) * 84; f.y = t.y - 6 - Math.abs(Math.sin(a)) * 72;
      f.facing = t.x > f.x ? 1 : -1;
      g.fx.directional((px + f.x) / 2, f.y - 40, 9, a, 0.3, '#ffffff', 13);
      g.fx.slash(t.x, t.y - 42, 48, a, a + 2.4, 1, col, 16, 10);
      g.applyHit(f, t, { dmg: 2.6, ang: 90, kb: 0.3, sc: 0, fx, stun: 12 }, f.facing, t.x, t.y - 42, true);
      t.vx = 0; t.vy = 0;
      g.shake(4);
    }
    if (c === 58) {
      f.x = t.x - f.facing * 62; f.y = t.y;
      g.fx.slash(t.x, t.y - 42, 74, -1.4, 1.6, f.facing, '#ffffff', 28, 20);
      g.fx.impact(t.x, t.y - 42, 120, col);
      g.fx.ring(t.x, t.y - 42, 12, 190, col, 22, 10);
      g.fx.text(f.x, f.y - 150, label, '#ffffff', 28, 60);
      g.applyHit(f, t, { dmg: 16, ang: 42, kb: 10, sc: 9.9, fx }, f.facing, t.x, t.y - 42);
      g.shake(26); g.flashScreen('#ffffff', 0.7);
      f.ultTarget = null; f.moveDur = fr + 14;
    }
  },
});
const dBeam = (name: string, label: string, desc: string, col: string, fx: FXK, style: any, vfx: string): MoveDef => ({
  name, desc, dur: 76, startup: 26, anim: 'cast', invuln: [0, 44], grav: 0.25, hits: [], vfx, cin: 42,
  onFrame: (f: any, fr: number, g: any) => {
    if (fr < 26) {
      // Telegraph: a widening lens and converging motes make the shot readable.
      const k = fr / 26;
      if (fr % 2 === 0) { const a = Math.random() * 6.28, r = 110 * (1 - k) + 22; g.fx.add({ x: f.x + f.facing * 60 + Math.cos(a) * r, y: f.y - 50 + Math.sin(a) * r, vx: -Math.cos(a) * 5, vy: -Math.sin(a) * 5, color: fr % 3 ? col : '#ffffff', kind: 'glow', life: 14, size: 4 + k * 6 }); }
      if (fr % 3 === 0) g.fx.ring(f.x + f.facing * 58, f.y - 50, 18 + k * 26, 20 + k * 28, col, 12, 3);
      if (fr === 25) { g.fx.ring(f.x + f.facing * 58, f.y - 50, 8, 74, '#ffffff', 16, 6); g.shake(6); }
      return;
    }
    if (fr === 26) {
      g.spawnProj({ owner: f, type: 'fireball', style, col, col2: '#ffffff', x: f.x + f.facing * 70, y: f.y - 50, vx: f.facing * 15, vy: 0, w: 170, h: 170, grow: 3.6, life: 70, dmg: 4.2, rehit: 5, pull: true, ang: 38, kb: 3.4, sc: 1.2, fx, dir: f.facing, fin: { dmg: 20, ang: 42, kb: 10, sc: 9.8 } });
      g.fx.ring(f.x + f.facing * 70, f.y - 50, 14, 260, col, 24, 14);
      g.fx.impact(f.x + f.facing * 70, f.y - 50, 120, '#ffffff');
      g.fx.text(f.x, f.y - 160, label, '#ffffff', 28, 62);
      sfx('ult'); g.shake(24); g.flashScreen(col, 0.6);
    }
    if (fr > 26 && fr < 62 && fr % 3 === 0) g.shake(7);
  },
});
const dDragon = (name: string, label: string, desc: string, col: string, fx: FXK, vfx: string): MoveDef => ({
  name, desc, dur: 66, startup: 24, anim: 'thrust', invuln: [0, 46], grav: 0.3, hits: [], vfx, cin: 40,
  onFrame: (f: any, fr: number, g: any) => {
    if (fr < 24) {
      const k = fr / 24;
      if (fr % 2 === 0) { const a = Math.random() * 6.28, r = 84 * (1 - k) + 18; g.fx.add({ x: f.x + f.facing * 40 + Math.cos(a) * r, y: f.y - 60 + Math.sin(a) * r, vx: -Math.cos(a) * 5, vy: -Math.sin(a) * 5, color: fr % 3 ? col : '#ffe08a', kind: 'ember', life: 18, size: 6 + k * 8 }); }
      if (fr % 4 === 0) g.fx.ring(f.x + f.facing * 40, f.y - 60, 22 + k * 30, 26 + k * 32, col, 13, 3);
      return;
    }
    if (fr === 24) {
      g.spawnProj({ owner: f, type: 'dragon', col, col2: '#ffe08a', x: f.x + f.facing * 40, y: f.y - 60, vx: f.facing * 14, vy: 0, w: 260, h: 190, life: 78, dmg: 3.2, rehit: 5, pull: true, ang: 40, kb: 2, sc: 0, fx, dir: f.facing, fin: { dmg: 18, ang: 45, kb: 9.4, sc: 9.8 } });
      sfx('ult'); sfx('fire'); g.shake(18); g.flashScreen(col, 0.45);
      g.fx.text(f.x, f.y - 158, label, '#ffffff', 28, 62);
      g.fx.ring(f.x + f.facing * 40, f.y - 60, 16, 220, col, 22, 12);
    }
  },
});
const dSummon = (name: string, label: string, desc: string): MoveDef => ({
  name, desc, dur: 92, startup: 30, anim: 'castUp', invuln: [0, 92], grav: 0.2, hits: [], cin: 44,
  onFrame: (f: any, fr: number, g: any) => {
    // A summoning circle draws itself on the floor, then the avatar erupts.
    if (fr < 30) {
      const k = fr / 30;
      if (fr % 2 === 0) g.fx.add({ x: f.x + (Math.random() - .5) * 200 * k, y: f.y - 4, vy: -3 - Math.random() * 5, color: '#b067ff', kind: 'glow', life: 20, size: 5 + k * 6 });
      if (fr % 3 === 0) g.fx.ring(f.x, f.y - 6, 130 * (1 - k) + 16, 136 * (1 - k) + 18, '#b067ff', 14, 3);
      if (fr === 29) { g.fx.ring(f.x, f.y - 6, 10, 200, '#e2c6ff', 20, 8); g.shake(8); }
      return;
    }
    if (fr === 30) {
      g.spawnProj({ owner: f, type: 'susanoo', x: f.x, y: f.y, vx: 0, vy: 0, w: 780, h: 480, life: 100, delay: 52, activeFor: 12, dmg: 32, ang: 40, kb: 10, sc: 10, fx: 'purple', dir: f.facing, follow: true, ox: 300, oy: -170 });
      g.fx.ring(f.x, f.y - 4, 18, 320, '#b067ff', 26, 16);
      g.fx.text(f.x, f.y - 172, label, '#ffffff', 30, 76);
      g.flashScreen('#d0a0ff', 0.5); g.shake(20); sfx('ult');
    }
    f.auraT = 4;
  },
});
const dMeteor = (name: string, label: string, desc: string, col: string, fx: FXK, vfx: string): MoveDef => ({
  name, desc, dur: 76, startup: 30, anim: 'slam', invuln: [0, 48], grav: 0.2, vfx, cin: 44,
  vel: [[0, 0, -13], [30, 6, 26]],
  hits: [H(30, 46, 30, -30, 330, 240, 30, 52, 9.5, 9.9, { fx })],
  onFrame: (f: any, fr: number, g: any) => {
    if (fr < 30) {
      // Sky flash and rising debris mark the incoming object.
      const k = fr / 30;
      if (fr % 2 === 0) g.fx.add({ x: f.x + (Math.random() - .5) * 120, y: f.y - 60 - Math.random() * 260 * (1 - k), vx: (Math.random() - .5) * 3, vy: 4, color: col, kind: 'ember', life: 22, size: 6 + k * 8 });
      if (fr % 4 === 0) g.fx.ring(f.x, f.y - 8, 300 * (1 - k) + 20, 310 * (1 - k) + 22, col, 15, 4);
      if (fr === 29) { g.flashScreen(col, 0.4); g.shake(10); sfx('ult'); }
      return;
    }
    if (fr > 30 && fr < 46) {
      g.shake(16);
      if (fr % 2 === 0) g.fx.add({ x: f.x + (Math.random() - .5) * 260, y: f.y - 4, vx: (Math.random() - .5) * 8, vy: -6 - Math.random() * 8, color: col, kind: 'ember', life: 30, size: 8 });
    }
    if (fr === 34) {
      g.fx.ring(f.x, f.y, 20, 420, col, 32, 22);
      g.fx.ring(f.x, f.y, 20, 250, '#ffffff', 22, 10);
      g.fx.impact(f.x, f.y - 30, 200, col);
      g.fx.burst(f.x, f.y - 20, 40, col, 14, 'ember', 40, 10);
      g.fx.text(f.x, f.y - 170, label, '#ffffff', 30, 76);
      g.flashScreen('#ffffff', 0.45);
      sfx('heavyhit', 2);
    }
  },
});

// ============================================================
export const CHARACTERS: CharDef[] = [

// ---------------- LEVI : fastest, tiny surgical hitboxes, lowest damage ----------------
mk({ id: 'levi', name: 'Levi Ackerman', anime: 'Attack on Titan', title: "Humanity's Strongest", tier: 'S', img: leviPortrait, color: '#3fae78',
  desc: 'The fastest fighter alive. Tiny, razor-thin hitboxes and 3-frame startups — wins by out-speeding you, not out-muscling you.',
  stats: ST(7.6, 7.1, 14.0, 0.86, 0.92, 0.6), bars: BR(2, 5, 3, 2),
  look: { skin: '#f3d9c4', hair: '#15161b', hairStyle: 'bowl', top: '#6b4a2f', top2: '#e8e8ee', sleeve: '#6b4a2f', fore: '#e9e9e9', pants: '#e6e2d6', boots: '#3a2616', cape: '#2f6a44', capeLen: 38, eye: '#96a3b4', weapon: 'dual', energy: '#d8f6ff', energy2: '#ffffff', ninjaRun: true },
  moves: {
    nlight: mv('Dual Slash', 'slash', 15, 3, [H(3, 6, 36, -46, 52, 42, 5, 42, 3.0, 1.7, { fx: 'slash' })], { vfx: 'odmCut', chains: cN([3, 13]) }),
    nlight2: mv('Cross Cleave', 'backslash', 15, 2, [H(2, 5, 40, -44, 56, 44, 5.5, 48, 3.4, 2.0, { fx: 'slash' })], { vfx: 'odmCut', chains: cN2([2, 13]) }),
    nlight3: mv('Blade Flurry', 'spin', 26, 3, MULTI(3, 18, 36, -42, 64, 58, 1.8, 6, 48, 5.6, 6.6, 'slash', 3), { turns: 3, vfx: 'odmStorm' }),
    nlight_spec: mv('Anchor Drill', 'thrust', 24, 3, [H(3, 13, 44, -42, 70, 44, 9, 28, 6.2, 7.0, { fx: 'slash' })], { vel: [[3, 19, -1]], vfx: 'odmWire' }),
    nlight_heavy: mv('Rising Blade Storm', 'upslash', 28, 4, [H(4, 12, 22, -68, 62, 92, 10.5, 88, 7.0, 8.0, { fx: 'slash' })], { vel: [[4, 2, -13]], vfx: 'odmStorm' }),
    slight: mv('Blade Rush', 'thrust', 20, 4, [H(4, 8, 46, -43, 62, 34, 6, 26, 3.8, 2.2, { fx: 'slash' })], { vel: [[3, 12, null], [10, 2, null]], vfx: 'odmCut', chains: cS([4, 16]) }),
    slight2: mv('Reverse Spin Cut', 'spin', 20, 3, [H(3, 8, 48, -44, 66, 50, 7, 38, 4.8, 4.0, { fx: 'slash' })], { turns: 1, vel: [[3, 9, null]], vfx: 'odmCut', chains: cS2([3, 16]) }),
    slight_spec: mv('Sonic Zip Strike', 'thrust', 24, 3, [H(3, 13, 50, -42, 74, 48, 10, 34, 6.6, 7.4, { fx: 'slash' })], { vel: [[3, 26, 0]], vfx: 'odmWire' }),
    slight_heavy: mv('Twin Guillotine', 'slash', 30, 5, [H(5, 12, 52, -44, 82, 58, 12.5, 40, 7.4, 8.8, { fx: 'slash' })], { vel: [[5, 12, null]], vfx: 'odmCut' }),
    dlight: mv('Slide Sweep', 'lowslash', 21, 4, [H(4, 9, 34, -12, 62, 26, 6, 74, 4.0, 1.8, { fx: 'slash' })], { vel: [[3, 12, null], [11, 2, null]], vfx: 'odmCut', chains: cD([4, 17]) }),
    dlight2: mv('Rising Cross Kick', 'uppercut', 21, 3, [H(3, 9, 20, -58, 52, 72, 8, 86, 5.6, 4.6, { fx: 'slash' })], { vel: [[3, 1, -11]], vfx: 'odmStorm' }),
    dlight_spec: mv('Wire Vault Hook', 'dive', 27, 4, [H(4, 15, 28, -30, 62, 64, 9.5, -46, 6.0, 6.6, { fx: 'slash' })], { vel: [[4, 9, -15], [14, 5, 11]], vfx: 'odmWire' }),
    nair: mv('Aerial Whirl', 'spin', 21, 3, [H(3, 10, 0, -40, 88, 80, 6, 66, 3.4, 2.1, { fx: 'slash' })], { land: true, turns: 1, vfx: 'odmStorm', chains: cA([3, 16]) }),
    nair2: mv('Helix Drop', 'dive', 23, 3, [H(3, 11, 20, -20, 56, 58, 8, -52, 4.4, 3.6, { fx: 'slash' })], { land: true, vel: [[3, 2, 9]], vfx: 'odmCut' }),
    nair_spec: mv('Air Grapple Sling', 'thrust', 24, 3, [H(3, 13, 40, -42, 66, 48, 9, 34, 6.0, 6.2, { fx: 'slash' })], { vel: [[3, 20, -4]], vfx: 'odmWire' }),
    sair: mv('Aerial Slash', 'slash', 19, 3, [H(3, 8, 42, -44, 62, 44, 6.5, 30, 3.8, 2.5, { fx: 'slash' })], { land: true, vfx: 'odmCut', chains: cSA([3, 16]) }),
    sair2: mv('Aerial Drill', 'thrust', 21, 3, [H(3, 10, 46, -42, 68, 42, 8, 34, 4.8, 4.2, { fx: 'slash' })], { land: true, vfx: 'odmCut' }),
    sair_spec: mv('Wire Slingshot', 'spin', 24, 3, [H(3, 13, 38, -40, 78, 66, 9.5, 38, 6.2, 6.8, { fx: 'slash' })], { turns: 2, vel: [[3, 18, 2]], vfx: 'odmStorm' }),
    dair: mv('Spiral Dive', 'dive', 26, 5, [H(5, 15, 24, -12, 44, 46, 8.5, -56, 4.2, 3.0, { fx: 'slash' })], { land: true, vel: [[5, 6, 12]], vfx: 'odmStorm' }),
    nsig: mv('Blade Cyclone', 'rise', 42, 11, MULTI(11, 19, 8, -62, 76, 100, 2.6, 8, 84, 6.2, 7.8, 'slash'), { turns: 2, vel: [[11, 1, -10]], vfx: 'odmStorm' }),
    ssig: mv('Twin Blade Rush', 'thrust', 44, 11, MULTI(11, 22, 34, -42, 66, 56, 2.6, 8.5, 38, 6.4, 8.2, 'slash', 3), { vel: [[11, 15, null], [23, 2, null]], vfx: 'odmWire' }),
    dsig: mv('Ground Blender', 'spin', 46, 12, MULTI(12, 28, 0, -40, 128, 68, 2.6, 7.5, 56, 6.2, 8.0, 'slash'), { turns: 4, vfx: 'odmStorm' }),
    rec: mv('ODM Ascent Slice', 'rise', 34, 5, MULTI(5, 20, 10, -52, 68, 90, 2.8, 7, 82, 5.4, 7.2, 'slash', 5), { turns: 2, grav: 0.38, vel: [[5, 3, -15.5]], vfx: 'odmWire' }),
    gp: mv('Anchor Slam', 'dive', 38, 7, [H(7, 32, 20, -22, 58, 60, 10, -62, 5.4, 7.2, { fx: 'slash' })], { land: true, vel: [[7, 4, 18]], vfx: 'odmWire' }),
    nspec: mv('Spinning Slash', 'spin', 46, 7, MULTI(7, 34, 20, -40, 108, 88, 2.2, 7.5, 38, 6.8, 8.6, 'slash', 4),
      { turns: 5, cd: 165, grav: 0.15, vel: [[7, 11, -4], [36, 2, null]], vfx: 'odmStorm', desc: 'Becomes a horizontal blade tornado, shredding anyone it passes through.' }),
    sspec: mv('ODM Gear Zip', 'thrust', 30, 6, [H(6, 20, 32, -42, 64, 60, 11, 34, 6.2, 5.8, { fx: 'slash' })],
      { cd: 132, grav: 0, vel: [[0, 0, 0], [6, 26, -1.5], [20, 4, null]], vfx: 'odmWire', desc: 'Fires grapple hooks and rockets across the entire stage instantly.' }),
    dspec: mv('ODM Ascent', 'upslash', 32, 5, [H(5, 14, 16, -74, 62, 88, 10, 88, 6.0, 6.8, { fx: 'slash' })],
      { cd: 172, grav: 0.5, vel: [[5, 0, -19]], vfx: 'odmWire', desc: 'Anchors to the sky and rides the wire up through a rising cross-slash.' }),
    ult: dRush("Humanity's Strongest", "HUMANITY'S STRONGEST", 'Vanishes entirely, then dismantles a single target from every angle at once.', '#d8f6ff', 'slash', 'odmWire'),
  },
  ai: { vertSpec: 'dspec', horizSpec: 'sspec', ultRange: 400 } }),

// ---------------- KILLUA : stun-locking electric assassin ----------------
mk({ id: 'killua', name: 'Killua Zoldyck', anime: 'Hunter x Hunter', title: 'Lightning Assassin', tier: 'S', img: killuaPortrait, color: '#6fc8ff',
  desc: 'Every hit carries paralysing voltage. Chains short stun-locks into teleport counters, then ascends into Godspeed.',
  stats: ST(7.5, 7.0, 14.3, 0.84, 0.86, 0.6), bars: BR(3, 5, 2, 2),
  look: { skin: '#f6e0cf', hair: '#e9ecf5', hairStyle: 'spikeLong', top: '#eef0f7', top2: '#7a5bb8', sleeve: '#6a4c9c', fore: '#6a4c9c', pants: '#34466e', boots: '#5b3f8a', eye: '#5fc8ff', weapon: 'claws', energy: '#8fe6ff', energy2: '#ffffff', ninjaRun: true },
  moves: {
    nlight: mv('Claw Jab', 'punch', 16, 3, [H(3, 6, 28, -48, 42, 28, 5, 36, 3.0, 1.8, { fx: 'elec', stun: 4 })], { trail: 'hand', vfx: 'zap', chains: cN([3, 14]) }),
    nlight2: mv('Thunder Palm', 'punch', 16, 3, [H(3, 6, 32, -46, 48, 32, 6, 40, 3.4, 2.2, { fx: 'elec', stun: 5 })], { trail: 'hand', vfx: 'zap', chains: cN2([3, 14]) }),
    nlight3: mv('Lightning Claws', 'thrust', 22, 4, [H(4, 12, 38, -44, 58, 40, 8, 46, 5.4, 6.2, { fx: 'elec', stun: 6 })], { trail: 'hand', vfx: 'zap' }),
    nlight_spec: mv('Palm Burst', 'cast', 25, 4, [H(4, 12, 36, -44, 62, 50, 9.5, 30, 6.2, 6.8, { fx: 'elec', stun: 13 })], { vel: [[4, 15, 0]], trail: 'hand', vfx: 'zap' }),
    nlight_heavy: mv('Thunderbolt Upper', 'uppercut', 28, 4, [H(4, 12, 18, -64, 52, 80, 11, 90, 6.8, 7.8, { fx: 'elec' })], { vel: [[4, 2, -13]], trail: 'hand', vfx: 'zap' }),
    slight: mv('Rhythm Step', 'punch', 19, 4, [H(4, 8, 32, -46, 50, 34, 6, 28, 3.8, 2.2, { fx: 'elec', stun: 5 })], { vel: [[3, 11, null], [10, 2, null]], trail: 'hand', vfx: 'zapAura', chains: cS([4, 15]) }),
    slight2: mv('Snake Awakens', 'slash', 19, 3, [H(3, 8, 38, -44, 58, 42, 7, 34, 4.6, 3.8, { fx: 'elec' })], { vel: [[3, 9, null]], trail: 'hand', vfx: 'zap', chains: cS2([3, 15]) }),
    slight_spec: mv('Flashstep Behind', 'counter', 23, 3, [H(3, 12, 34, -42, 58, 50, 9, 42, 6.0, 6.4, { fx: 'elec' })], { invuln: [3, 12], vel: [[3, 25, 0]], vfx: 'godspeedBlur' }),
    slight_heavy: mv('Shockwave Cleave', 'thrust', 28, 5, [H(5, 12, 44, -44, 72, 50, 11.5, 38, 7.0, 8.0, { fx: 'elec' })], { trail: 'hand', vfx: 'zap' }),
    dlight: mv('Sweep Kick', 'sweep', 19, 4, [H(4, 8, 34, -10, 54, 24, 6, 76, 4.0, 1.8, { fx: 'blunt' })], { trail: 'foot', vfx: 'zapAura', chains: cD([4, 15]) }),
    dlight2: mv('Shockwave Stomp', 'slam', 21, 3, [H(3, 9, 28, -12, 58, 34, 8, 82, 5.2, 4.4, { fx: 'elec', stun: 8 })], { trail: 'foot', vfx: 'zap' }),
    dlight_spec: mv('Lightning Trap', 'castUp', 25, 4, [H(4, 13, 32, -40, 66, 78, 10, 86, 6.0, 6.6, { fx: 'elec', stun: 10 })], { vfx: 'zap' }),
    nair: mv('Nen Flip', 'flip', 20, 3, [H(3, 9, 8, -50, 76, 80, 5.5, 82, 3.2, 2.0, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'zapAura', chains: cA([3, 15]) }),
    nair2: mv('Shock Dive', 'dkick', 22, 3, [H(3, 11, 10, -10, 52, 48, 7, -52, 4.2, 3.4, { fx: 'elec', stun: 7 })], { land: true, vel: [[3, 1, 10]], trail: 'foot', vfx: 'zap' }),
    nair_spec: mv('Air Thunderbolt', 'cast', 24, 4, [H(4, 12, 30, -40, 60, 52, 9, 46, 5.8, 6.0, { fx: 'elec' })], { trail: 'hand', vfx: 'zap' }),
    sair: mv('Lightning Kick', 'kick', 19, 3, [H(3, 8, 34, -40, 50, 34, 6, 30, 3.8, 2.5, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'zapAura', chains: cSA([3, 15]) }),
    sair2: mv('Claw Shred', 'thrust', 21, 3, [H(3, 10, 38, -42, 58, 40, 7.5, 34, 4.8, 4.0, { fx: 'elec' })], { land: true, trail: 'hand', vfx: 'zap' }),
    sair_spec: mv('Air Lightning Palm', 'cast', 24, 4, [H(4, 12, 40, -40, 64, 48, 9.5, 36, 6.0, 6.6, { fx: 'elec', stun: 10 })], { vel: [[4, 14, 0]], vfx: 'zap' }),
    dair: mv('Drill Dive', 'dkick', 24, 4, [H(4, 14, 6, -4, 40, 40, 7.5, -58, 3.6, 2.0, { fx: 'elec' })], { land: true, vel: [[4, null, 10]], trail: 'foot', vfx: 'zapAura' }),
    nsig: mv('Thunder Surge', 'uppercut', 38, 10, [H(10, 15, 18, -62, 50, 84, 12.5, 86, 6.5, 8.2, { fx: 'elec' })], { trail: 'hand', vfx: 'zap' }),
    ssig: mv('Rhythm Echo', 'punch', 44, 10, MULTI(10, 22, 36, -44, 60, 52, 2.3, 8.5, 38, 6.5, 8.4, 'elec', 3), { vel: [[10, 9, null], [23, 1, null]], trail: 'hand', vfx: 'zapAura' }),
    dsig: mv('Lightning Whirlwind', 'spin', 40, 11, MULTI(11, 24, 0, -30, 108, 60, 2.7, 8.5, 52, 6.2, 8.0, 'blunt', 5), { turns: 3, trail: 'foot', vfx: 'zapAura' }),
    rec: mv('Electric Rising Flip', 'flip', 34, 5, MULTI(5, 20, 8, -50, 60, 80, 2.8, 7, 82, 5.4, 7.0, 'elec', 5), { turns: 3, grav: 0.38, vel: [[5, 2, -15]], vfx: 'zapAura' }),
    gp: mv('Thunder Dropkick', 'dkick', 36, 7, [H(7, 30, 6, -10, 50, 50, 10.5, -56, 4.8, 7.0, { fx: 'elec' })], { land: true, vel: [[7, 2, 19]], trail: 'foot', vfx: 'zap' }),
    nspec: mv('Thunderbolt', 'castUp', 34, 10, [], { cd: 180, vfx: 'zap', desc: 'Calls a pillar of lightning down onto the nearest enemy, paralysing them.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 10) { const t = g.nearestEnemy(f, 560); const tx = t ? t.x + t.vx * 10 : f.x + f.facing * 220; g.spawnProj({ owner: f, type: 'bolt', x: tx, y: (t ? t.y : f.y) - 150, vx: 0, vy: 0, w: 72, h: 360, life: 34, delay: 17, dmg: 13, ang: 80, kb: 6, sc: 7.2, stun: 16, fx: 'elec', dir: f.facing }); } } }),
    sspec: mv('Lightning Palm', 'cast', 32, 6, [H(6, 16, 30, -44, 62, 52, 11, 30, 5.6, 6.6, { fx: 'elec', stun: 15 })],
      { cd: 132, grav: 0, vel: [[0, 0, 0], [6, 21, 0], [16, 2, null]], trail: 'hand', vfx: 'zap', desc: 'Electrified dash-palm that locks foes in place with heavy paralysis.' }),
    dspec: mv('Assassin Counter', 'counter', 38, 2, [], { cd: 162, counter: [2, 24], vfx: 'zapAura', desc: 'Flashes behind any melee attacker and drives a lethal charge through them.',
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); g.flashScreen('#8fe6ff', 0.35); const ox = f.x; f.x = a.x - a.facing * 52; f.y = a.y; f.facing = a.x > f.x ? 1 : -1; g.fx.bolt(ox, f.y - 40, f.x, f.y - 40, '#8fe6ff', 12, 3); f.invuln = 20; g.applyHit(f, a, { dmg: 15, ang: 45, kb: 7.2, sc: 8.4, fx: 'elec', stun: 8 }, f.facing, a.x, a.y - 42); f.moveFrame = 26; } }),
    ult: dTransform('Godspeed', 'GODSPEED', 'Becomes living lightning — reflex-speed movement and electrified everything.', 'god', '#8fe6ff', 'godspeedBlur', 620),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 560 } }),

// ---------------- RENGOKU : wide burning arcs, big damage, slow ----------------
mk({ id: 'rengoku', name: 'Kyojuro Rengoku', anime: 'Demon Slayer', title: 'The Flame Hashira', tier: 'S', img: rengokuPortrait, color: '#ff7a1a',
  desc: 'Enormous sweeping fire arcs. Slow to start but every connected swing carves a burning crescent through the stage.',
  stats: ST(6.2, 5.9, 13.1, 1.08, 1.03, 0.62), bars: BR(5, 3, 5, 4),
  look: { skin: '#f4d6bc', hair: '#ffcf33', hair2: '#e0301e', hairStyle: 'flame', top: '#1c1c26', top2: '#d4a94a', sleeve: '#1c1c26', fore: '#1c1c26', pants: '#1c1c26', boots: '#f0f0f0', cape: '#f5f1e8', cape2: '#ff5a1a', capeLen: 48, eye: '#ffb020', weapon: 'katana', energy: '#ff7a1a', energy2: '#ffd24a' },
  moves: {
    nlight: mv('Flame Slash', 'slash', 24, 6, [H(6, 11, 50, -46, 86, 60, 8.5, 40, 3.8, 2.2, { fx: 'fire' })], { vfx: 'flameArc', chains: cN([6, 20]) }),
    nlight2: mv('Rising Inferno Arc', 'upslash', 24, 5, [H(5, 10, 52, -56, 88, 70, 9.5, 52, 4.4, 2.6, { fx: 'fire' })], { vfx: 'flameArc', chains: cN2([5, 20]) }),
    nlight3: mv('Flame Wheel', 'spin', 30, 6, MULTI(6, 18, 48, -44, 96, 78, 3.0, 9.5, 46, 6.2, 7.4, 'fire'), { turns: 2, vfx: 'flameTrail' }),
    nlight_spec: mv('Flash Fire Stab', 'thrust', 28, 5, [H(5, 15, 56, -44, 96, 62, 11.5, 32, 6.4, 7.4, { fx: 'fire' })], { vel: [[5, 20, 0]], invuln: [5, 12], vfx: 'flameTrail' }),
    nlight_heavy: mv('Blazing Upswing', 'slam', 34, 7, [H(7, 16, 58, -34, 104, 88, 14, 58, 7.4, 8.8, { fx: 'fire' })], { vfx: 'flameTiger' }),
    slight: mv('Blazing Thrust', 'thrust', 26, 6, [H(6, 11, 56, -42, 92, 36, 9, 26, 4.2, 2.5, { fx: 'fire' })], { vel: [[4, 8, null], [12, 2, null]], vfx: 'flameArc', chains: cS([6, 21]) }),
    slight2: mv('Cross Flame Cleave', 'slash', 26, 5, [H(5, 11, 60, -44, 96, 62, 10, 36, 5.2, 4.4, { fx: 'fire' })], { vel: [[4, 6, null]], vfx: 'flameArc', chains: cS2([5, 21]) }),
    slight_spec: mv('Flash Eruption', 'cast', 30, 5, [H(5, 15, 62, -44, 100, 70, 12, 36, 6.8, 7.8, { fx: 'fire' })], { vel: [[5, 21, -1]], vfx: 'flameTiger' }),
    slight_heavy: mv('Heavenly Flame Cleave', 'slam', 36, 7, [H(7, 17, 64, -38, 114, 88, 15, 44, 7.8, 9.2, { fx: 'fire' })], { vfx: 'flameTiger' }),
    dlight: mv('Flame Sweep', 'lowslash', 26, 5, [H(5, 11, 48, -14, 92, 30, 8.5, 70, 4.4, 1.9, { fx: 'fire' })], { vel: [[4, 7, null], [14, 2, null]], vfx: 'flameArc', chains: cD([5, 21]) }),
    dlight2: mv('Rising Crescent', 'upslash', 25, 4, [H(4, 10, 32, -62, 76, 86, 10, 84, 6.0, 5.2, { fx: 'fire' })], { vel: [[4, 2, -11]], vfx: 'flameArc' }),
    dlight_spec: mv('Ground Flame Wave', 'slam', 30, 5, [H(5, 15, 52, -20, 124, 62, 11.5, 64, 6.8, 7.4, { fx: 'fire' })], { vfx: 'flameTiger' }),
    nair: mv('Aerial Flame Spin', 'spin', 25, 5, [H(5, 12, 0, -42, 124, 96, 8, 66, 3.8, 2.2, { fx: 'fire' })], { land: true, turns: 2, vfx: 'flameTrail', chains: cA([5, 20]) }),
    nair2: mv('Aerial Fire Wheel', 'dive', 25, 4, [H(4, 12, 24, -18, 78, 68, 9.5, -50, 4.8, 3.8, { fx: 'fire' })], { land: true, vel: [[4, 2, 8]], vfx: 'flameArc' }),
    nair_spec: mv('Air Blazing Thrust', 'thrust', 27, 5, [H(5, 14, 48, -42, 88, 58, 10.5, 34, 6.2, 6.6, { fx: 'fire' })], { vel: [[5, 15, -2]], vfx: 'flameTrail' }),
    sair: mv('Aerial Flame Cleave', 'slash', 24, 5, [H(5, 10, 52, -44, 90, 62, 8.5, 32, 4.2, 2.6, { fx: 'fire' })], { land: true, vfx: 'flameArc', chains: cSA([5, 20]) }),
    sair2: mv('Cross Inferno', 'backslash', 25, 4, [H(4, 11, 54, -42, 92, 64, 9.5, 36, 5.0, 4.4, { fx: 'fire' })], { land: true, vfx: 'flameArc' }),
    sair_spec: mv('Scorching Burst', 'cast', 27, 5, [H(5, 14, 56, -42, 94, 66, 11, 38, 6.6, 7.0, { fx: 'fire' })], { vel: [[5, 15, 0]], vfx: 'flameTiger' }),
    dair: mv('Flame Meteor', 'slam', 29, 7, [H(7, 15, 28, -8, 80, 48, 9.5, -50, 3.8, 2.3, { fx: 'fire' })], { land: true, vfx: 'flameTrail' }),
    nsig: mv('Rising Scorching Sun', 'upslash', 46, 13, [H(13, 20, 24, -74, 94, 124, 16, 86, 7.2, 9.4, { fx: 'fire' })], { vfx: 'flameArc' }),
    ssig: mv('Blooming Flame', 'slash', 48, 14, [H(14, 21, 58, -44, 124, 92, 17, 38, 7.4, 9.6, { fx: 'fire' })], { vel: [[12, 6, null], [23, 1, null]], vfx: 'flameTiger' }),
    dsig: mv('Flame Tiger Eruption', 'slam', 50, 15, [H(15, 22, 54, -22, 176, 70, 16, 62, 7.2, 9.2, { fx: 'fire' })], { vfx: 'flameTiger' }),
    rec: mv('Rising Sun Ascent', 'rise', 38, 6, MULTI(6, 21, 14, -56, 80, 96, 3.0, 8, 82, 5.8, 7.6, 'fire', 5), { turns: 1, grav: 0.44, vel: [[6, 2, -14]], vfx: 'flameTrail' }),
    gp: mv('Blazing Pound', 'slam', 40, 8, [H(8, 34, 24, -22, 92, 64, 12.5, -60, 5.6, 7.8, { fx: 'fire' })], { land: true, vel: [[8, 0, 18]], vfx: 'flameTrail' }),
    nspec: mv('Rising Scorching Sun', 'upslash', 36, 7, [H(7, 16, 26, -62, 92, 118, 12, 82, 6.0, 7.4, { fx: 'fire' })],
      { cd: 172, grav: 0.5, vel: [[7, 3, -16]], vfx: 'flameArc', desc: 'Second Form: a towering rising flame crescent that launches foes skyward.' }),
    sspec: mv('Unknowing Fire', 'thrust', 30, 8, [H(8, 16, 32, -44, 92, 64, 13, 30, 6.2, 7.6, { fx: 'fire' })],
      { cd: 152, grav: 0, invuln: [8, 15], vel: [[0, 0, 0], [8, 26, 0], [16, 3, null]], vfx: 'flameTrail', desc: 'First Form: an explosive intangible flash-step slash trailing fire.' }),
    dspec: mv('Blazing Universe', 'slam', 46, 14, [H(14, 22, 44, -22, 190, 72, 16, 64, 7.2, 9.0, { fx: 'fire' })],
      { cd: 200, vfx: 'flameTiger', desc: 'Third Form: carves a colossal flaming arc that erupts along the ground.' }),
    ult: dDragon('Ninth Form: Rengoku', 'NINTH FORM: RENGOKU', 'Becomes a blazing dragon of flame that devours everything in its path.', '#ff7a1a', 'fire', 'flameTrail'),
  },
  ai: { vertSpec: 'nspec', horizSpec: 'sspec', ultRange: 680 } }),

// ---------------- MADARA : longest reach zoner ----------------
mk({ id: 'madara', name: 'Madara Uchiha', anime: 'Naruto', title: 'Ghost of the Uchiha', tier: 'S', img: madaraPortrait, color: '#b067ff',
  desc: 'Controls the entire stage. Gunbai gusts, wood spikes and spectral Susanoo limbs give him the longest reach in the game.',
  stats: ST(5.8, 5.7, 12.8, 1.15, 1.07, 0.62), bars: BR(5, 2, 5, 5),
  look: { skin: '#eed3bd', hair: '#121218', hairStyle: 'mane', top: '#9e1b1b', top2: '#5e0d0d', sleeve: '#1f2440', fore: '#1f2440', pants: '#1f2440', boots: '#2b2b33', eye: '#ff2030', weapon: 'gunbai', energy: '#b067ff', energy2: '#ff6a1a' },
  moves: {
    nlight: mv('Gunbai Strike', 'punch', 20, 5, [H(5, 9, 40, -48, 58, 34, 6.5, 38, 3.3, 2.0, { fx: 'blunt' })], { trail: 'hand', vfx: 'gunbaiGust', chains: cN([5, 17]) }),
    nlight2: mv('Fire Palm Burst', 'cast', 21, 4, [H(4, 9, 46, -46, 66, 42, 7.5, 46, 4.0, 2.4, { fx: 'fire' })], { vfx: 'susanooFlare', chains: cN2([4, 17]) }),
    nlight3: mv('Gunbai Wind Blast', 'slash', 26, 5, [H(5, 13, 62, -44, 104, 64, 9.5, 40, 6.0, 6.6, { fx: 'blunt' })], { vfx: 'gunbaiGust' }),
    nlight_spec: mv('Susanoo Crush', 'slam', 28, 4, [H(4, 13, 62, -46, 112, 82, 11.5, 46, 6.6, 7.4, { fx: 'purple' })], { vfx: 'susanooFlare' }),
    nlight_heavy: mv('Uchiha Flame Whirl', 'spin', 34, 6, MULTI(6, 18, 44, -44, 100, 78, 3.0, 9.5, 86, 7.0, 8.4, 'fire'), { turns: 2, vfx: 'susanooFlare' }),
    slight: mv('Gunbai Thrust', 'thrust', 26, 6, [H(6, 10, 58, -44, 92, 54, 7.5, 30, 3.8, 2.5, { fx: 'blunt' })], { vel: [[4, 6, null], [11, 1, null]], vfx: 'gunbaiGust', chains: cS([6, 21]) }),
    slight2: mv('Phantom Cleave', 'slash', 26, 4, [H(4, 10, 64, -44, 100, 62, 8.5, 36, 4.8, 4.0, { fx: 'purple' })], { vel: [[4, 8, null]], vfx: 'susanooFlare', chains: cS2([4, 21]) }),
    slight_spec: mv('Susanoo Sweep', 'cast', 30, 5, [H(5, 15, 74, -46, 126, 76, 12.5, 38, 7.0, 8.0, { fx: 'purple' })], { vfx: 'susanooFlare' }),
    slight_heavy: mv('Dragon Flame Smash', 'slam', 36, 7, [H(7, 17, 68, -38, 130, 84, 14.5, 44, 7.6, 9.2, { fx: 'fire' })], { vfx: 'flameTiger' }),
    dlight: mv('Low Sweep', 'sweep', 24, 5, [H(5, 10, 46, -10, 78, 26, 7.5, 76, 4.2, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'gunbaiGust', chains: cD([5, 20]) }),
    dlight2: mv('Wood Spike Launcher', 'slam', 26, 5, [H(5, 13, 40, -30, 76, 88, 9.5, 86, 6.0, 5.2, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    dlight_spec: mv('Dragon Breath', 'cast', 30, 6, [H(6, 16, 56, -25, 120, 64, 11.5, 60, 6.8, 7.4, { fx: 'fire' })], { vfx: 'flameTiger' }),
    nair: mv('Aerial Gunbai Flip', 'flip', 25, 5, [H(5, 11, 8, -48, 104, 96, 7.5, 80, 3.5, 2.2, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'gunbaiGust', chains: cA([5, 20]) }),
    nair2: mv('Spectral Fist', 'cast', 25, 4, [H(4, 12, 34, -42, 92, 76, 9.5, 46, 5.4, 4.6, { fx: 'purple' })], { land: true, vfx: 'susanooFlare' }),
    nair_spec: mv('Air Fireball', 'cast', 27, 5, [H(5, 13, 52, -42, 88, 60, 10.5, 40, 6.2, 6.8, { fx: 'fire' })], { vel: [[5, 9, 0]], vfx: 'flameTrail' }),
    sair: mv('Shinobi Kick', 'kick', 23, 5, [H(5, 9, 46, -42, 66, 40, 7.5, 30, 3.8, 2.6, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'gunbaiGust', chains: cSA([5, 19]) }),
    sair2: mv('Gunbai Crush', 'slash', 25, 4, [H(4, 11, 54, -44, 92, 60, 9.5, 36, 5.2, 4.4, { fx: 'blunt' })], { land: true, vfx: 'gunbaiGust' }),
    sair_spec: mv('Air Susanoo Cleave', 'slam', 27, 5, [H(5, 14, 60, -42, 104, 72, 11.5, 38, 6.8, 7.4, { fx: 'purple' })], { vel: [[5, 10, 2]], vfx: 'susanooFlare' }),
    dair: mv('Shinobi Dropkick', 'dkick', 27, 6, [H(6, 14, 6, -4, 52, 46, 8.5, -50, 3.5, 2.1, { fx: 'blunt' })], { land: true, trail: 'foot', vel: [[6, null, 9]], vfx: 'gunbaiGust' }),
    nsig: mv('Flame Pillar', 'castUp', 44, 14, [H(14, 22, 36, -84, 80, 162, 15, 88, 7.0, 9.0, { fx: 'fire' })], { vfx: 'flameTiger' }),
    ssig: mv('Uchiha Return', 'slash', 48, 15, [H(15, 20, 62, -46, 122, 100, 17, 34, 7.2, 9.4, { fx: 'blunt' })], { vel: [[12, 5, null], [22, 1, null]], vfx: 'gunbaiGust' }),
    dsig: mv('Susanoo Ribcage', 'counter', 50, 15, [H(15, 26, 0, -50, 210, 130, 14, 60, 7.0, 8.8, { fx: 'purple' })], { invuln: [8, 26], vfx: 'susanooFlare' }),
    rec: mv('Rising Fire Vortex', 'rise', 40, 6, MULTI(6, 21, 10, -50, 88, 96, 3.0, 8, 80, 5.8, 7.6, 'fire', 5), { turns: 1, grav: 0.45, vel: [[6, 1, -13.5]], vfx: 'flameTrail' }),
    gp: mv('Uchiha Stomp', 'dkick', 40, 8, [H(8, 34, 10, -10, 68, 66, 12.5, -60, 5.6, 7.8, { fx: 'blunt' })], { land: true, trail: 'foot', vel: [[8, 0, 18]], vfx: 'gunbaiGust' }),
    nspec: mv('Majestic Destroyer Flame', 'cast', 50, 16, [], { cd: 232, grav: 0.35, vfx: 'flameTrail', desc: 'Exhales a gigantic expanding wall of fire that sweeps the whole stage.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 16) { g.spawnProj({ owner: f, type: 'fireball', style: 'fire', col: '#ff6a1a', col2: '#ffd24a', x: f.x + f.facing * 60, y: f.y - 50, vx: f.facing * 9, vy: 0, w: 92, h: 96, grow: 2.6, life: 62, dmg: 3.2, rehit: 7, ang: 35, kb: 3.8, sc: 1.6, fx: 'fire', dir: f.facing, fin: { dmg: 10, ang: 45, kb: 7.4, sc: 7.6 } }); sfx('fire'); g.shake(7); } } }),
    sspec: mv('Susanoo Arm', 'slash', 44, 12, [], { cd: 165, vfx: 'susanooFlare', desc: 'Manifests a colossal spectral arm that sweeps an enormous area ahead.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 6) { g.spawnProj({ owner: f, type: 'arm', x: f.x, y: f.y, vx: 0, vy: 0, w: 240, h: 155, life: 26, delay: 6, activeFor: 8, dmg: 16, ang: 40, kb: 7, sc: 8.2, fx: 'purple', dir: f.facing, follow: true, ox: 132, oy: -70 }); sfx('purple'); } } }),
    dspec: mv('Wood Release: Spikes', 'slam', 44, 14, [], { cd: 198, vfx: 'hardenCrack', desc: 'Enormous wooden spikes erupt from the ground on both sides of him.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 14) { sfx('heavyhit'); for (let i = 0; i < 3; i++) for (const d of [-1, 1]) g.spawnProj({ owner: f, type: 'spike', x: f.x + d * (80 + i * 84), y: f.y, vx: 0, vy: 0, w: 54, h: 128, life: 22 + i * 6, delay: i * 5, activeFor: 10, dmg: 9.5, ang: 80, kb: 6, sc: 5.4, fx: 'blunt', dir: d, ground: true }); } } }),
    ult: dSummon('Perfect Susanoo', 'PERFECT SUSANOO', 'Summons a mountain-sized avatar that cleaves the entire arena in half.'),
  },
  ai: { zoneSpec: 'nspec', horizSpec: 'sspec', ultRange: 680 } }),

// ---------------- ASTA : anti-magic bruiser ----------------
mk({ id: 'asta', name: 'Asta', anime: 'Black Clover', title: 'Anti-Magic Knight', tier: 'A', img: astaPortrait, color: '#e0203a',
  desc: 'Swings slabs of anti-magic iron. Heavy, committal swings that nullify projectiles outright and hit like a truck.',
  stats: ST(6.5, 6.2, 13.7, 1.04, 0.9, 0.62), bars: BR(5, 3, 4, 4),
  look: { skin: '#f1d2b6', hair: '#c9ccd4', hairStyle: 'messy', top: '#202024', top2: '#d9b64a', sleeve: '#202024', fore: '#f1d2b6', pants: '#2e2e36', boots: '#1a1a1a', cape: '#141416', capeLen: 30, eye: '#3fbf6a', weapon: 'greatsword', energy: '#e0203a', energy2: '#1a0508', mark: 'headband' },
  moves: {
    nlight: mv('Demon-Slayer Slash', 'slash', 24, 6, [H(6, 11, 50, -46, 84, 58, 8.5, 40, 3.8, 2.3, { fx: 'dark' })], { vfx: 'antiMagic', chains: cN([6, 20]) }),
    nlight2: mv('Demon-Dweller Thrust', 'thrust', 24, 5, [H(5, 10, 56, -44, 90, 48, 9.5, 46, 4.4, 2.7, { fx: 'dark' })], { vfx: 'antiMagic', chains: cN2([5, 20]) }),
    nlight3: mv('Black Cleave', 'slam', 30, 6, [H(6, 16, 58, -38, 98, 76, 11.5, 48, 6.4, 7.2, { fx: 'dark' })], { vfx: 'antiMagic' }),
    nlight_spec: mv('Black Divider', 'thrust', 28, 5, [H(5, 14, 56, -42, 94, 58, 11, 30, 6.4, 7.2, { fx: 'dark' })], { vel: [[5, 17, 0]], vfx: 'voidAura' }),
    nlight_heavy: mv('Anti-Magic Launcher', 'upslash', 34, 6, [H(6, 16, 32, -70, 88, 102, 13, 86, 7.4, 8.6, { fx: 'dark' })], { vel: [[6, 2, -12]], vfx: 'antiMagic' }),
    slight: mv('Bull Rush', 'thrust', 26, 6, [H(6, 11, 58, -42, 94, 36, 9, 26, 4.2, 2.6, { fx: 'dark' })], { vel: [[4, 9, null], [12, 2, null]], vfx: 'voidAura', chains: cS([6, 21]) }),
    slight2: mv('Black Cross Cleave', 'slash', 26, 5, [H(5, 11, 62, -44, 98, 60, 10, 36, 5.2, 4.4, { fx: 'dark' })], { vel: [[4, 6, null]], vfx: 'antiMagic', chains: cS2([5, 21]) }),
    slight_spec: mv('Hurricane Burst', 'spin', 30, 5, [H(5, 16, 52, -42, 104, 78, 12, 38, 7.0, 7.8, { fx: 'dark' })], { turns: 2, vel: [[5, 13, 0]], vfx: 'voidAura' }),
    slight_heavy: mv('Demon-Slayer Smash', 'slam', 36, 7, [H(7, 17, 66, -40, 124, 86, 15, 42, 7.8, 9.4, { fx: 'dark' })], { vfx: 'antiMagic' }),
    dlight: mv('Low Blade Sweep', 'lowslash', 26, 6, [H(6, 12, 50, -14, 94, 30, 9, 72, 4.4, 2.0, { fx: 'dark' })], { vfx: 'antiMagic', chains: cD([6, 21]) }),
    dlight2: mv('Anti-Magic Upper', 'upslash', 25, 4, [H(4, 10, 34, -62, 78, 86, 10, 86, 6.0, 5.2, { fx: 'dark' })], { vel: [[4, 2, -10]], vfx: 'antiMagic' }),
    dlight_spec: mv('Ground Quake', 'slam', 30, 5, [H(5, 15, 50, -20, 124, 62, 11.5, 66, 6.8, 7.4, { fx: 'dark' })], { vfx: 'hardenCrack' }),
    nair: mv('Greatsword Spin', 'spin', 26, 5, [H(5, 12, 0, -42, 136, 100, 8, 66, 3.8, 2.3, { fx: 'dark' })], { land: true, turns: 2, vfx: 'voidAura', chains: cA([5, 21]) }),
    nair2: mv('Demon Dive', 'dive', 25, 4, [H(4, 12, 26, -18, 80, 68, 9.5, -50, 4.8, 3.8, { fx: 'dark' })], { land: true, vel: [[4, 2, 9]], vfx: 'antiMagic' }),
    nair_spec: mv('Air Black Divider', 'thrust', 27, 5, [H(5, 14, 50, -42, 88, 60, 10.5, 34, 6.2, 6.8, { fx: 'dark' })], { vel: [[5, 14, -2]], vfx: 'voidAura' }),
    sair: mv('Heavy Chop', 'slash', 25, 6, [H(6, 11, 54, -44, 94, 66, 9, 32, 4.2, 2.7, { fx: 'dark' })], { land: true, vfx: 'antiMagic', chains: cSA([6, 20]) }),
    sair2: mv('Demon Piercer', 'thrust', 25, 4, [H(4, 11, 58, -42, 94, 62, 10, 36, 5.2, 4.4, { fx: 'dark' })], { land: true, vfx: 'antiMagic' }),
    sair_spec: mv('Air Hurricane', 'spin', 27, 5, [H(5, 15, 52, -40, 100, 76, 11.5, 38, 6.8, 7.4, { fx: 'dark' })], { turns: 2, vel: [[5, 14, 0]], vfx: 'voidAura' }),
    dair: mv('Helm Splitter', 'dive', 29, 6, [H(6, 17, 34, -10, 70, 56, 9.5, -46, 4.0, 2.3, { fx: 'dark' })], { land: true, vel: [[6, 4, 11]], vfx: 'antiMagic' }),
    nsig: mv('Skyward Cleave', 'upslash', 46, 14, [H(14, 20, 28, -74, 104, 130, 17, 86, 7.2, 9.4, { fx: 'dark' })], { vfx: 'antiMagic' }),
    ssig: mv('Demon-Slayer Charge', 'slash', 50, 15, [H(15, 21, 64, -44, 134, 100, 18, 38, 7.4, 9.8, { fx: 'dark' })], { vel: [[12, 7, null], [22, 1, null]], vfx: 'antiMagic' }),
    dsig: mv('Anti-Magic Quake', 'slam', 50, 16, [H(16, 22, 48, -20, 186, 68, 17, 64, 7.2, 9.2, { fx: 'dark' })], { vfx: 'hardenCrack' }),
    rec: mv('Black Blade Ascent', 'rise', 38, 6, MULTI(6, 21, 10, -54, 86, 98, 3.0, 8, 82, 5.8, 7.6, 'dark', 5), { turns: 2, grav: 0.45, vel: [[6, 2, -14]], vfx: 'voidAura' }),
    gp: mv('Anvil Drop', 'slam', 42, 8, [H(8, 34, 24, -22, 94, 66, 13.5, -60, 5.8, 8.0, { fx: 'dark' })], { land: true, vel: [[8, 0, 19]], vfx: 'voidAura' }),
    nspec: mv('Black Divider', 'thrust', 38, 10, [H(10, 18, 46, -44, 104, 56, 12.5, 30, 6.2, 7.4, { fx: 'dark' })],
      { cd: 152, grav: 0, vel: [[0, 0, 0], [10, 17, 0], [18, 2, null]], vfx: 'antiMagic', desc: 'A piercing anti-magic thrust that releases a void slash wave.',
        onFrame: (f: any, fr: number, g: any) => { if (fr === 18) { g.spawnProj({ owner: f, type: 'wave', x: f.x + f.facing * 60, y: f.y - 44, vx: f.facing * 14, vy: 0, w: 42, h: 100, life: 40, dmg: 8, ang: 35, kb: 5, sc: 5, fx: 'dark', dir: f.facing }); sfx('dark'); } } }),
    sspec: mv('Black Hurricane', 'spin', 52, 8, MULTI(8, 42, 0, -44, 132, 104, 2.5, 9.5, 50, 7.0, 8.8, 'dark', 5),
      { turns: 5, cd: 192, grav: 0.28, vel: [[8, 7, null], [44, 1, null]], vfx: 'voidAura', desc: 'A roaring black tornado of blades that drags opponents helplessly inward.' }),
    dspec: mv('Anti-Magic Reflect', 'counter', 38, 2, [], { cd: 142, counter: [2, 22], vfx: 'voidAura', desc: 'Nullifies and reflects any projectile, and counters melee with a crushing slash.',
      onFrame: (f: any, fr: number, g: any) => { if (fr < 22) for (const p of g.projectiles) { if (p.owner !== f && p.reflectable !== false && Math.abs(p.x - f.x) < 96 + p.w / 2 && Math.abs(p.y - (f.y - 44)) < 86 + p.h / 2) { p.owner = f; p.vx = -p.vx * 1.35 || f.facing * 11; p.dir = Math.sign(p.vx) || f.facing; p.hitMap = new Map(); p.dmg *= 1.35; g.fx.ring(f.x + f.facing * 30, f.y - 44, 10, 64, '#e0203a', 14, 6); sfx('counter'); } } },
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); g.flashScreen('#e0203a', 0.3); f.facing = a.x > f.x ? 1 : -1; f.invuln = 18; g.fx.slash(f.x, f.y - 44, 72, -1.5, 1.5, f.facing, '#e0203a', 28, 16); g.applyHit(f, a, { dmg: 14, ang: 40, kb: 7.2, sc: 8.2, fx: 'dark' }, f.facing, a.x, a.y - 42); f.moveFrame = 26; } }),
    ult: dTransform('Devil Union', 'DEVIL UNION', 'Fuses with his devil — horn, wing and anti-magic that erases everything.', 'devil', '#e0203a', 'voidAura', 680),
  },
  ai: { horizSpec: 'nspec', counterSpec: 'dspec', ultRange: 340 } }),

// ---------------- GOKU : ki fundamentals, strong aerials ----------------
mk({ id: 'goku', name: 'Son Goku', anime: 'Dragon Ball', title: 'Saiyan Raised on Earth', tier: 'S', color: '#ff8a1a',
  desc: 'Textbook martial artist. Crisp, evenly-spaced strikes that flow into ki bursts, with the best air-to-air game around. His Awakening is Ultra Instinct: the transformation repaints him in silver and turns the whole frame silver with him, and his awakened special is the Spirit Bomb at half its old weight.',
  stats: ST(7.0, 6.9, 13.9, 0.99, 0.98, 0.59), bars: BR(4, 4, 4, 4),
  look: { skin: '#f6cfa8', hair: '#16130f', hairStyle: 'spikeLong', top: '#ff7a14', top2: '#1a5ed8', sleeve: '#ff7a14', fore: '#f6cfa8', pants: '#ff7a14', boots: '#1a5ed8', eye: '#1a90ff', weapon: 'claws', energy: '#ffd24a', energy2: '#8fe3ff' },
  moves: {
    nlight: mv('Martial Jab', 'punch', 17, 3, [H(3, 6, 32, -48, 50, 30, 6, 36, 3.2, 2.0, { fx: 'fire' })], { trail: 'hand', vfx: 'kiFlare', chains: cN([3, 15]) }),
    nlight2: mv('Ki Punch Flurry', 'punch', 17, 3, [H(3, 6, 36, -46, 56, 34, 7, 42, 3.8, 2.4, { fx: 'fire' })], { trail: 'hand', vfx: 'kiFlare', chains: cN2([3, 15]) }),
    nlight3: mv('Ki Burst Finisher', 'cast', 24, 4, [H(4, 12, 44, -44, 72, 50, 9.5, 46, 5.8, 6.6, { fx: 'fire' })], { vfx: 'kiFlare' }),
    nlight_spec: mv('Kamehameha Burst', 'cast', 26, 4, [H(4, 12, 50, -44, 84, 56, 10.5, 32, 6.4, 7.2, { fx: 'fire' })], { vel: [[4, 14, 0]], vfx: 'kiCharge' }),
    nlight_heavy: mv('Dragon Uppercut', 'uppercut', 30, 5, [H(5, 14, 26, -68, 68, 92, 12, 86, 7.0, 8.2, { fx: 'fire' })], { vel: [[5, 2, -13]], vfx: 'dragonFist' }),
    slight: mv('Dragon Step', 'punch', 22, 5, [H(5, 9, 40, -44, 64, 36, 7, 28, 4.0, 2.4, { fx: 'fire' })], { vel: [[4, 10, null], [11, 2, null]], vfx: 'kiFlare', chains: cS([5, 18]) }),
    slight2: mv('Roundhouse Kick', 'kick', 22, 4, [H(4, 9, 48, -42, 72, 46, 8, 34, 5.0, 4.0, { fx: 'blunt' })], { trail: 'foot', vfx: 'kiFlare', chains: cS2([4, 18]) }),
    slight_spec: mv('Instant Transmission', 'punch', 30, 9, [H(9, 14, 40, -44, 72, 56, 11, 34, 6.6, 7.2, { fx: 'fire' })], { invuln: [0, 12], grav: 0, vel: [[0, 0, 0], [12, 0, null]], vfx: 'kiCharge', desc: 'Two fingers to the forehead — vanishes and reappears behind the opponent mid-punch.',
      onFrame: (f: any, fr: number, g: any) => {
        if (fr === 1) { g.fx.ring(f.x, f.y - 46, 4, 46, '#8fe3ff', 10, 4); sfx('whoosh'); }
        if (fr === 6) {
          const t = g.nearestEnemy(f, 520);
          g.fx.burst(f.x, f.y - 46, 14, '#8fe3ff', 7, 'streak', 14, 3); g.fx.ring(f.x, f.y - 46, 40, 6, '#ffffff', 8, 3);
          if (t) { f.x = t.x - t.facing * 58; f.y = t.y; f.facing = t.x > f.x ? 1 : -1; } else f.x += f.facing * 220;
          f.vx = 0; f.vy = 0; f.grounded = false;
          g.fx.ring(f.x, f.y - 46, 6, 70, '#8fe3ff', 12, 5); g.fx.burst(f.x, f.y - 46, 14, '#ffffff', 6, 'spark', 14, 3); g.fx.text(f.x, f.y - 110, 'INSTANT TRANSMISSION', '#8fe3ff', 18, 26);
        }
      } }),
    slight_heavy: mv('Meteor Smash', 'slam', 32, 6, [H(6, 14, 54, -40, 100, 78, 13, 40, 7.4, 8.8, { fx: 'fire' })], { vfx: 'dragonFist' }),
    dlight: mv('Low Kick', 'sweep', 21, 4, [H(4, 9, 38, -10, 62, 28, 7, 70, 4.0, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'kiFlare', chains: cD([4, 17]) }),
    dlight2: mv('Rising Knee', 'uppercut', 22, 4, [H(4, 10, 26, -58, 60, 78, 9, 86, 5.8, 4.8, { fx: 'fire' })], { vel: [[4, 1, -10]], vfx: 'kiFlare' }),
    dlight_spec: mv('Ki Shockwave', 'slam', 27, 5, [H(5, 14, 44, -22, 96, 62, 11, 66, 6.6, 7.2, { fx: 'fire' })], { vfx: 'kiFlare' }),
    nair: mv('Aerial Ki Spin', 'spin', 22, 4, [H(4, 11, 0, -42, 96, 88, 7.5, 64, 3.5, 2.2, { fx: 'fire' })], { land: true, turns: 1, vfx: 'kiCharge', chains: cA([4, 18]) }),
    nair2: mv('Axe Handle Slam', 'slam', 24, 4, [H(4, 12, 24, -18, 68, 62, 9, -50, 4.6, 3.7, { fx: 'blunt' })], { land: true, vel: [[4, 1, 9]], vfx: 'kiFlare' }),
    nair_spec: mv('Air Kamehameha', 'cast', 40, 14, [], { land: true, grav: 0, vel: [[0, 0, 0], [14, -4, -3], [22, 0, null]], vfx: 'kiCharge', desc: 'Hovers mid-air, cups both hands and fires a Kamehameha angled down at the ground.',
      onFrame: (f: any, fr: number, g: any) => {
        if (fr < 14 && fr % 2 === 0) { g.fx.add({ x: f.x - f.facing * 22 + (Math.random() - .5) * 30, y: f.y - 44 + (Math.random() - .5) * 30, vx: 0, vy: 0, color: '#8fe3ff', kind: 'glow', life: 10, size: 6 }); }
        if (fr === 4) g.fx.text(f.x, f.y - 110, 'KA-ME-HA-ME...', '#8fe3ff', 18, 22);
        if (fr === 14) { const t = g.nearestEnemy(f, 700); const dx = t ? t.x - f.x : f.facing * 300, dy = t ? (t.y - 40) - (f.y - 46) : 150; const d = Math.hypot(dx, dy) || 1; const vy = Math.max(0, dy / d) * 14, vx = f.facing * Math.max(8, Math.abs(dx / d) * 14);
          g.spawnProj({ owner: f, type: 'fireball', style: 'ki', col: '#8fe3ff', col2: '#ffffff', x: f.x + f.facing * 50, y: f.y - 44, vx, vy, w: 70, h: 64, grow: 1.4, life: 44, dmg: 3.5, rehit: 5, ang: -30, kb: 4.4, sc: 3, fx: 'fire', dir: f.facing, fin: { dmg: 11, ang: 40, kb: 8, sc: 8 } });
          sfx('fire'); g.shake(8); g.flashScreen('#8fe3ff', .18); g.fx.text(f.x, f.y - 110, 'HAAAA!', '#ffffff', 24, 26); }
      } }),
    sair: mv('Dragon Kick', 'kick', 20, 4, [H(4, 9, 42, -44, 58, 40, 7, 30, 3.8, 2.6, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'kiFlare', chains: cSA([4, 17]) }),
    sair2: mv('Ki Blast Fist', 'punch', 22, 4, [H(4, 11, 48, -42, 68, 48, 8.5, 34, 5.0, 4.2, { fx: 'fire' })], { land: true, trail: 'hand', vfx: 'kiFlare' }),
    sair_spec: mv('Air Dragon Thrust', 'thrust', 26, 5, [H(5, 14, 52, -40, 86, 58, 11, 38, 6.4, 7.0, { fx: 'fire' })], { vel: [[5, 15, -1]], vfx: 'dragonFist' }),
    dair: mv('Meteor Dropkick', 'dkick', 25, 5, [H(5, 14, 8, -6, 46, 44, 9, -56, 3.7, 2.1, { fx: 'fire' })], { land: true, trail: 'foot', vfx: 'kiCharge' }),
    nsig: mv('Rising Dragon Uppercut', 'uppercut', 42, 12, [H(12, 19, 20, -62, 70, 98, 15.5, 86, 6.8, 8.8, { fx: 'fire' })], { vfx: 'dragonFist' }),
    ssig: mv('Dragon Rush', 'thrust', 44, 13, [H(13, 19, 50, -44, 84, 58, 16.5, 38, 7.2, 9.4, { fx: 'fire' })], { vel: [[11, 8, null], [21, 1, null]], vfx: 'dragonFist' }),
    dsig: mv('Power Slam', 'spin', 48, 14, MULTI(14, 26, 44, -30, 150, 78, 3.0, 9.5, 64, 7.2, 9.0, 'fire'), { turns: 3, vfx: 'kiFlare' }),
    rec: mv('Ki Ascent', 'rise', 36, 6, MULTI(6, 21, 10, -50, 80, 94, 3.0, 8, 82, 5.8, 7.6, 'fire', 5), { turns: 2, grav: 0.4, vel: [[6, 2, -14.4]], vfx: 'kiCharge' }),
    gp: mv('Meteor Pound', 'dkick', 40, 7, [H(7, 30, 34, -10, 68, 58, 11.5, -52, 5.6, 7.8, { fx: 'fire' })], { land: true, vel: [[7, 0, 18]], vfx: 'kiCharge' }),
    nspec: mv('Kamehameha', 'cast', 46, 16, [], { cd: 190, grav: 0.3, vfx: 'kiCharge', desc: 'Channels both palms and fires a piercing turquoise beam of ki.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 16) { g.spawnProj({ owner: f, type: 'fireball', style: 'ki', col: '#8fe3ff', col2: '#ffffff', x: f.x + f.facing * 54, y: f.y - 46, vx: f.facing * 16, vy: 0, w: 84, h: 78, grow: 1.5, life: 48, dmg: 4, rehit: 5, ang: 36, kb: 4.6, sc: 3.4, fx: 'fire', dir: f.facing, fin: { dmg: 13, ang: 40, kb: 8.6, sc: 8.6 } }); sfx('fire'); g.shake(10); g.flashScreen('#8fe3ff', 0.2); } } }),
    sspec: mv('Dragon Fist', 'thrust', 32, 7, [H(7, 17, 42, -42, 84, 64, 12.5, 30, 6.2, 7.2, { fx: 'fire' })],
      { cd: 145, grav: 0, vel: [[0, 0, 0], [7, 24, -2], [18, 2, null]], vfx: 'dragonFist', desc: 'Rockets forward with a dragon-wreathed fist that carries foes with him.' }),
    dspec: mv('Instant Shield', 'counter', 38, 2, [], { cd: 155, counter: [2, 22], invuln: [2, 22], vfx: 'kiCharge', desc: 'Ki barrier — teleports behind the attacker and crushes them.',
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); f.x = a.x - a.facing * 52; f.y = a.y; f.facing = a.x > f.x ? 1 : -1; f.invuln = 18; g.flashScreen('#ffd24a', 0.3); g.applyHit(f, a, { dmg: 14.5, ang: 42, kb: 7.4, sc: 8.2, fx: 'fire' }, f.facing, a.x, a.y - 42); f.moveFrame = 26; } }),
    ult: dTransform('Super Saiyan', 'SUPER SAIYAN', 'Golden hair, blazing aura, and power that dwarfs everything before it.', 'god', '#ffd24a', 'kiCharge', 600),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 560 } }),

// ---------------- ICHIGO : spirit crescents ----------------
mk({ id: 'ichigo', name: 'Ichigo Kurosaki', anime: 'Bleach', title: 'Substitute Soul Reaper', tier: 'A', color: '#6a5cff',
  desc: 'Swings a cleaver of pure spirit pressure. Most of his attacks fling detached crescent waves that keep pressuring at range.',
  stats: ST(7.1, 6.7, 14.0, 0.95, 0.93, 0.62), bars: BR(4, 4, 5, 3),
  look: { skin: '#f0d8c8', hair: '#ff8f22', hairStyle: 'spikeShort', top: '#121218', top2: '#e8e8f0', sleeve: '#121218', fore: '#f0d8c8', pants: '#121218', boots: '#121218', cape: '#17171e', capeLen: 34, eye: '#d9a22a', weapon: 'greatsword', energy: '#6a5cff', energy2: '#c0b4ff' },
  moves: {
    nlight: mv('Zangetsu Slash', 'slash', 19, 4, [H(4, 8, 46, -46, 74, 50, 7, 36, 3.8, 2.3, { fx: 'dark' })], { vfx: 'getsuga', chains: cN([4, 16]) }),
    nlight2: mv('Getsuga Cross Slice', 'backslash', 20, 3, [H(3, 8, 50, -44, 78, 54, 8, 42, 4.2, 2.6, { fx: 'dark' })], { vfx: 'getsuga', chains: cN2([3, 17]) }),
    nlight3: mv('Black Crescent', 'spin', 26, 4, MULTI(4, 16, 50, -42, 86, 70, 2.6, 8.5, 46, 6.2, 7.2, 'dark'), { turns: 2, vfx: 'reiatsu' }),
    nlight_spec: mv('Getsuga Wave', 'thrust', 28, 4, [H(4, 12, 52, -42, 88, 56, 10, 32, 6.4, 7.2, { fx: 'dark' })], { vel: [[4, 15, 0]], vfx: 'getsuga',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 12) g.spawnProj({ owner: f, type: 'wave', x: f.x + f.facing * 56, y: f.y - 44, vx: f.facing * 13, vy: 0, w: 38, h: 92, life: 30, dmg: 6.5, ang: 42, kb: 4.4, sc: 4.4, fx: 'dark', dir: f.facing }); } }),
    nlight_heavy: mv('Bankai Cleave', 'upslash', 30, 5, [H(5, 14, 30, -68, 82, 98, 12.5, 86, 7.2, 8.4, { fx: 'dark' })], { vel: [[5, 2, -12]], vfx: 'getsuga' }),
    slight: mv('Flash Step Slash', 'thrust', 22, 4, [H(4, 9, 56, -44, 88, 38, 8, 30, 4.2, 2.7, { fx: 'dark' })], { vel: [[3, 12, null], [11, 2, null]], vfx: 'reiatsu', chains: cS([4, 18]) }),
    slight2: mv('Crescent Pierce', 'slash', 22, 4, [H(4, 9, 60, -44, 94, 58, 9, 36, 5.2, 4.2, { fx: 'dark' })], { vel: [[4, 8, null]], vfx: 'getsuga', chains: cS2([4, 18]) }),
    slight_spec: mv('Black Getsuga Surge', 'cast', 28, 4, [H(4, 14, 62, -44, 100, 66, 11.5, 38, 6.8, 7.6, { fx: 'dark' })], { vel: [[4, 18, 0]], vfx: 'getsuga' }),
    slight_heavy: mv('Black Flash Smash', 'slam', 32, 6, [H(6, 14, 64, -40, 112, 78, 14, 42, 7.6, 9.0, { fx: 'dark' })], { vfx: 'getsuga' }),
    dlight: mv('Slide Slash', 'lowslash', 24, 5, [H(5, 11, 46, -14, 90, 30, 8.5, 72, 4.4, 2.1, { fx: 'dark' })], { vfx: 'reiatsu', chains: cD([5, 20]) }),
    dlight2: mv('Rising Dark Arc', 'upslash', 24, 4, [H(4, 10, 32, -60, 74, 84, 9, 86, 5.8, 5.0, { fx: 'dark' })], { vel: [[4, 2, -10]], vfx: 'getsuga' }),
    dlight_spec: mv('Hollow Mask Blast', 'cast', 28, 5, [H(5, 14, 50, -24, 108, 64, 11.5, 64, 6.6, 7.2, { fx: 'dark' })], { vfx: 'reiatsu' }),
    nair: mv('Zangetsu Spin', 'spin', 23, 4, [H(4, 12, 0, -42, 112, 92, 8, 66, 3.8, 2.3, { fx: 'dark' })], { land: true, turns: 2, vfx: 'reiatsu', chains: cA([4, 19]) }),
    nair2: mv('Dark Helm Breaker', 'dive', 24, 4, [H(4, 12, 24, -18, 76, 64, 9.5, -50, 4.6, 3.8, { fx: 'dark' })], { land: true, vel: [[4, 2, 9]], vfx: 'getsuga' }),
    nair_spec: mv('Air Getsuga', 'cast', 26, 5, [H(5, 13, 48, -42, 86, 58, 10.5, 36, 6.2, 6.6, { fx: 'dark' })], { vel: [[5, 13, -2]], vfx: 'getsuga' }),
    sair: mv('Aerial Slash', 'slash', 21, 4, [H(4, 10, 50, -44, 84, 58, 8, 32, 4.1, 2.7, { fx: 'dark' })], { land: true, vfx: 'getsuga', chains: cSA([4, 18]) }),
    sair2: mv('Crescent Cleave', 'backslash', 22, 4, [H(4, 11, 52, -42, 88, 60, 9.5, 36, 5.0, 4.4, { fx: 'dark' })], { land: true, vfx: 'getsuga' }),
    sair_spec: mv('Air Flashstep', 'thrust', 26, 4, [H(4, 14, 54, -40, 92, 62, 11, 38, 6.6, 7.2, { fx: 'dark' })], { vel: [[4, 16, 0]], vfx: 'reiatsu' }),
    dair: mv('Dark Dive Cleave', 'dive', 28, 6, [H(6, 16, 34, -10, 70, 56, 9.5, -50, 3.8, 2.2, { fx: 'dark' })], { land: true, vel: [[6, 4, 10]], vfx: 'getsuga' }),
    nsig: mv('Getsuga Skyward', 'upslash', 44, 13, [H(13, 21, 28, -72, 100, 126, 16, 86, 7.2, 9.4, { fx: 'dark' })], { vfx: 'getsuga' }),
    ssig: mv('Getsuga Blade Rush', 'thrust', 42, 11, [H(11, 21, 54, -42, 110, 56, 15, 40, 7.4, 9.8, { fx: 'dark' })], { vfx: 'getsuga' }),
    dsig: mv('Tensa Counterblade', 'counter', 46, 14, [H(14, 22, 0, -42, 186, 96, 15, 64, 7.0, 9.0, { fx: 'dark' })], { invuln: [8, 24], vfx: 'reiatsu' }),
    rec: mv('Bankai Rising Leap', 'flip', 36, 6, MULTI(6, 21, 10, -50, 82, 96, 3.0, 8, 82, 5.6, 7.4, 'dark', 4), { turns: 3, grav: 0.4, vel: [[6, 2, -14.4]], vfx: 'reiatsu' }),
    gp: mv('Guillotine Drop', 'dive', 38, 7, [H(7, 30, 24, -16, 72, 58, 11.5, -52, 5.2, 7.4, { fx: 'dark' })], { land: true, vel: [[7, 3, 19]], vfx: 'getsuga' }),
    nspec: mv('Getsuga Tenshou', 'cast', 40, 11, [], { cd: 152, grav: 0.35, vfx: 'getsuga', desc: 'Hurls a huge crescent of condensed spirit energy across the stage.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 11) { g.spawnProj({ owner: f, type: 'fireball', style: 'spirit', col: '#6a5cff', col2: '#c0b4ff', x: f.x + f.facing * 52, y: f.y - 48, vx: f.facing * 14, vy: 0, w: 96, h: 104, grow: 1.5, life: 46, dmg: 3.6, rehit: 6, ang: 44, kb: 4.2, sc: 2.6, fx: 'dark', dir: f.facing, fin: { dmg: 12, ang: 46, kb: 8, sc: 8.2 } }); sfx('dark'); g.shake(8); } } }),
    sspec: mv('Flash Step Blitz', 'thrust', 30, 6, [H(6, 16, 40, -43, 88, 62, 12, 30, 6.2, 7.2, { fx: 'dark' })],
      { cd: 138, grav: 0, invuln: [6, 15], vel: [[0, 0, 0], [6, 25, 0], [17, 2, null]], vfx: 'reiatsu', desc: 'Blinks forward in a violet blur, cleaving anything caught inside.' }),
    dspec: mv('Bankai Counter', 'counter', 40, 2, [], { cd: 174, counter: [2, 26], invuln: [2, 26], vfx: 'reiatsu', desc: 'Counter stance that answers any strike with a skyward spirit slash.',
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); f.facing = a.x > f.x ? 1 : -1; f.invuln = 18; g.flashScreen('#6a5cff', 0.32); g.spawnProj({ owner: f, type: 'wave', x: f.x, y: f.y - 90, vx: 0, vy: -10, w: 150, h: 230, life: 24, dmg: 17, ang: 85, kb: 9, sc: 9.8, fx: 'dark', dir: f.facing, follow: true, ox: 0, oy: -60 }); } }),
    ult: dTransform('Bankai', 'BANKAI', 'Releases Tensa Zangetsu — crushing spirit pressure and blinding speed.', 'god', '#6a5cff', 'reiatsu', 600),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 480 } }),

// ---------------- NARUTO : clone pressure ----------------
mk({ id: 'naruto', name: 'Naruto Uzumaki', anime: 'Naruto', title: 'The Seventh Hokage', tier: 'S', color: '#ffb52e',
  desc: 'Shadow clones add extra hitboxes to his strings, while Rasengan pressure forces openings from any range.',
  stats: ST(7.2, 6.7, 13.9, 0.96, 0.94, 0.6), bars: BR(4, 5, 4, 3),
  look: { skin: '#f6d4b8', hair: '#ffcc11', hairStyle: 'spikeShort', top: '#ff7a14', top2: '#222228', sleeve: '#ff7a14', fore: '#f6d4b8', pants: '#1f2a44', boots: '#1a1a24', eye: '#2fa8ff', weapon: 'claws', energy: '#ffb52e', energy2: '#8fd8ff', ninjaRun: true, mark: 'headband' },
  moves: {
    nlight: mv('Shinobi Punch', 'punch', 18, 4, [H(4, 7, 32, -48, 50, 30, 6, 36, 3.2, 2.0, { fx: 'blunt' })], { trail: 'hand', vfx: 'cloneEcho', chains: cN([4, 16]) }),
    nlight2: mv('Shadow Clone Kick', 'kick', 18, 3, [H(3, 7, 38, -46, 58, 36, 7, 42, 3.8, 2.4, { fx: 'blunt' })], { trail: 'foot', vfx: 'cloneEcho', chains: cN2([3, 16]) }),
    nlight3: mv('Uzumaki Barrage', 'uppercut', 25, 4, [H(4, 13, 38, -60, 66, 76, 9.5, 86, 6.0, 6.8, { fx: 'blunt' })], { vfx: 'cloneEcho' }),
    nlight_spec: mv('Rasengan Burst', 'cast', 26, 5, [H(5, 13, 48, -44, 80, 54, 10.5, 34, 6.4, 7.2, { fx: 'elec', stun: 8 })], { vel: [[5, 15, 0]], vfx: 'rasengan' }),
    nlight_heavy: mv('Giant Rasengan Slam', 'slam', 32, 6, [H(6, 15, 44, -40, 96, 80, 13, 50, 7.4, 8.6, { fx: 'elec' })], { vel: [[6, 2, -10]], vfx: 'rasengan' }),
    slight: mv('Clone Dash Strike', 'thrust', 22, 5, [H(5, 9, 46, -44, 70, 36, 7, 28, 4.0, 2.4, { fx: 'blunt' })], { vel: [[4, 11, null], [11, 2, null]], vfx: 'cloneEcho', chains: cS([5, 18]) }),
    slight2: mv('Multi-Clone Flurry', 'punch', 22, 4, [H(4, 10, 52, -42, 82, 48, 8, 34, 5.0, 4.0, { fx: 'blunt' })], { trail: 'hand', vfx: 'cloneEcho', chains: cS2([4, 18]) }),
    slight_spec: mv('Rasenshuriken Throw', 'cast', 28, 5, [H(5, 14, 56, -44, 94, 62, 11.5, 38, 6.8, 7.6, { fx: 'elec' })], { vfx: 'shuriken' }),
    slight_heavy: mv('Planetary Rasengan', 'slam', 34, 7, [H(7, 16, 62, -38, 112, 80, 14.5, 44, 7.6, 9.0, { fx: 'elec' })], { vfx: 'rasengan' }),
    dlight: mv('Shinobi Sweep', 'sweep', 21, 4, [H(4, 9, 38, -10, 64, 28, 7, 72, 4.0, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'cloneEcho', chains: cD([4, 17]) }),
    dlight2: mv('Clone Launcher', 'uppercut', 22, 4, [H(4, 10, 28, -58, 64, 78, 9, 86, 5.8, 4.8, { fx: 'blunt' })], { vel: [[4, 1, -10]], vfx: 'cloneEcho' }),
    dlight_spec: mv('Ground Rasengan', 'slam', 27, 5, [H(5, 14, 46, -22, 98, 62, 11, 66, 6.6, 7.2, { fx: 'elec', stun: 8 })], { vfx: 'rasengan' }),
    nair: mv('Aerial Shinobi Spin', 'spin', 22, 4, [H(4, 11, 0, -42, 98, 88, 7, 64, 3.5, 2.2, { fx: 'blunt' })], { land: true, turns: 1, vfx: 'cloneEcho', chains: cA([4, 18]) }),
    nair2: mv('Clone Drop Kick', 'dkick', 24, 4, [H(4, 12, 22, -18, 66, 60, 8.5, -50, 4.4, 3.6, { fx: 'blunt' })], { land: true, vel: [[4, 1, 9]], trail: 'foot', vfx: 'cloneEcho' }),
    nair_spec: mv('Air Rasengan Dive', 'cast', 26, 5, [H(5, 13, 46, -36, 82, 62, 10.5, 34, 6.2, 6.6, { fx: 'elec' })], { vel: [[5, 12, 5]], vfx: 'rasengan' }),
    sair: mv('Aerial Side Kick', 'kick', 20, 4, [H(4, 9, 42, -44, 58, 40, 7, 30, 3.8, 2.6, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cloneEcho', chains: cSA([4, 17]) }),
    sair2: mv('Double Clone Punch', 'punch', 22, 4, [H(4, 11, 48, -42, 70, 48, 8.5, 34, 5.0, 4.2, { fx: 'blunt' })], { land: true, trail: 'hand', vfx: 'cloneEcho' }),
    sair_spec: mv('Air Rasenshuriken', 'cast', 26, 5, [H(5, 14, 52, -40, 88, 60, 11, 38, 6.4, 7.0, { fx: 'elec' })], { vel: [[5, 12, 0]], vfx: 'shuriken' }),
    dair: mv('Spiral Clone Stomp', 'dkick', 25, 5, [H(5, 14, 8, -6, 46, 44, 9, -56, 3.6, 2.1, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cloneEcho' }),
    nsig: mv('Giant Rasengan', 'cast', 42, 12, [H(12, 19, 40, -50, 92, 86, 15.5, 60, 6.8, 8.8, { fx: 'elec' })], { vfx: 'rasengan' }),
    ssig: mv('Rasengan Charge', 'thrust', 44, 12, [H(12, 20, 54, -44, 98, 66, 16.5, 38, 7.2, 9.4, { fx: 'elec' })], { vel: [[12, 14, null], [22, 2, null]], vfx: 'rasengan' }),
    dsig: mv('Clone Trampoline', 'counter', 46, 13, [H(13, 22, 0, -42, 172, 84, 14.5, 64, 7.0, 8.8, { fx: 'blunt' })], { invuln: [6, 22], vfx: 'cloneEcho' }),
    rec: mv('Clone Boost Leap', 'rise', 36, 5, MULTI(5, 20, 10, -50, 80, 96, 3.0, 8, 82, 5.8, 7.6, 'elec', 5), { turns: 1, grav: 0.4, vel: [[5, 2, -15]], vfx: 'cloneEcho' }),
    gp: mv('Rasengan Slam', 'slam', 40, 7, [H(7, 30, 34, -10, 70, 60, 11.5, -52, 5.6, 7.8, { fx: 'elec' })], { land: true, vel: [[7, 0, 18]], vfx: 'rasengan' }),
    nspec: mv('Wind Style: Rasenshuriken', 'cast', 44, 14, [], { cd: 192, grav: 0.3, vfx: 'shuriken', desc: 'Hurls a screaming shuriken of wind chakra that shreds on contact.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 14) { g.spawnProj({ owner: f, type: 'fireball', style: 'shuriken', col: '#8fd8ff', col2: '#ffffff', x: f.x + f.facing * 54, y: f.y - 46, vx: f.facing * 13, vy: 0, w: 96, h: 96, grow: 1.7, life: 52, dmg: 3.8, rehit: 6, pull: true, ang: 40, kb: 4.6, sc: 3.4, fx: 'elec', dir: f.facing, fin: { dmg: 13, ang: 45, kb: 8.6, sc: 8.6 } }); sfx('elec'); g.shake(9); } } }),
    sspec: mv('Rasengan Rush', 'thrust', 32, 6, [H(6, 16, 44, -42, 86, 58, 12, 30, 6.0, 7.0, { fx: 'elec', stun: 12 })],
      { cd: 138, grav: 0, vel: [[0, 0, 0], [6, 22, -1], [17, 2, null]], vfx: 'rasengan', desc: 'Charges forward driving a spiralling sphere of raw chakra.' }),
    dspec: mv('Substitution Jutsu', 'counter', 38, 2, [], { cd: 150, counter: [2, 22], invuln: [2, 22], vfx: 'cloneEcho', desc: 'Swaps with a log and retaliates from behind with a clone assist.',
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); g.fx.burst(f.x, f.y - 30, 14, '#c8a064', 6, 'shard', 24, 7); f.x = a.x - a.facing * 54; f.y = a.y; f.facing = a.x > f.x ? 1 : -1; f.invuln = 18; g.flashScreen('#ffb52e', 0.3); g.applyHit(f, a, { dmg: 13.5, ang: 42, kb: 7.2, sc: 8.2, fx: 'blunt' }, f.facing, a.x, a.y - 42); f.moveFrame = 26; } }),
    ult: dTransform('Kurama Link Mode', 'KURAMA LINK MODE', 'Wraps himself in Nine-Tails chakra for overwhelming speed and power.', 'god', '#ffb52e', 'cloneEcho', 620),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 560 } }),

// ---------------- TANJIRO : flowing water ----------------
mk({ id: 'tanjiro', name: 'Tanjiro Kamado', anime: 'Demon Slayer', title: 'Water Breathing Slayer', tier: 'A', color: '#49b6e8',
  desc: 'Water Breathing flows without pause — the smoothest chains in the game, each swing trailing rippling water.',
  stats: ST(6.9, 6.4, 13.6, 0.98, 0.95, 0.61), bars: BR(4, 4, 4, 4),
  look: { skin: '#f3d3b4', hair: '#4a1f18', hair2: '#8a2f1e', hairStyle: 'messy', top: '#1d2228', top2: '#2e6f4f', sleeve: '#1d2228', fore: '#f3d3b4', pants: '#26303a', boots: '#efe6d2', cape: '#2a6f52', cape2: '#49b6e8', capeLen: 36, eye: '#b8434f', weapon: 'katana', energy: '#49b6e8', energy2: '#c9f0ff', mark: 'scar' },
  moves: {
    nlight: mv('First Form: Flowing Cut', 'slash', 20, 4, [H(4, 9, 46, -46, 76, 54, 7, 38, 3.6, 2.1, { fx: 'slash' })], { vfx: 'waterArc', chains: cN([4, 17]) }),
    nlight2: mv('Water Wheel', 'spin', 21, 3, [H(3, 9, 44, -44, 82, 66, 8, 44, 4.2, 2.5, { fx: 'slash' })], { turns: 1, vfx: 'waterRipple', chains: cN2([3, 17]) }),
    nlight3: mv('Whirlpool Finish', 'spin', 28, 4, MULTI(4, 18, 44, -42, 92, 78, 2.6, 9, 48, 6.2, 7.2, 'slash'), { turns: 3, vfx: 'waterRipple' }),
    nlight_spec: mv('Flowing Dance', 'thrust', 26, 4, [H(4, 14, 52, -43, 88, 58, 10, 32, 6.2, 7.0, { fx: 'slash' })], { vel: [[4, 16, 0]], vfx: 'waterArc' }),
    nlight_heavy: mv('Striking Tide', 'upslash', 30, 5, [H(5, 14, 28, -68, 84, 96, 12, 86, 7.0, 8.2, { fx: 'slash' })], { vel: [[5, 2, -12]], vfx: 'waterArc' }),
    slight: mv('Water Current Thrust', 'thrust', 23, 5, [H(5, 9, 52, -43, 82, 40, 7.5, 28, 4.0, 2.4, { fx: 'slash' })], { vel: [[4, 10, null], [11, 2, null]], vfx: 'waterRipple', chains: cS([5, 19]) }),
    slight2: mv('Constant Flux', 'slash', 23, 4, [H(4, 9, 56, -44, 88, 58, 8.5, 36, 5.0, 4.2, { fx: 'slash' })], { vel: [[4, 8, null]], vfx: 'waterArc', chains: cS2([4, 19]) }),
    slight_spec: mv('Waterfall Basin', 'cast', 28, 4, [H(4, 14, 58, -44, 94, 66, 11, 38, 6.8, 7.6, { fx: 'slash' })], { vel: [[4, 17, 0]], vfx: 'waterArc' }),
    slight_heavy: mv('Drop Ripple Thrust', 'slam', 33, 6, [H(6, 14, 60, -40, 106, 78, 14, 42, 7.6, 9.0, { fx: 'slash' })], { vfx: 'waterArc' }),
    dlight: mv('Low Tide Sweep', 'lowslash', 23, 5, [H(5, 10, 44, -12, 80, 28, 7.5, 72, 4.2, 1.9, { fx: 'slash' })], { vfx: 'waterRipple', chains: cD([5, 19]) }),
    dlight2: mv('Rising Splash', 'upslash', 23, 4, [H(4, 10, 32, -60, 72, 82, 9, 86, 5.8, 5.0, { fx: 'slash' })], { vel: [[4, 2, -10]], vfx: 'waterArc' }),
    dlight_spec: mv('Splashing Water Flow', 'slam', 28, 5, [H(5, 14, 48, -22, 110, 62, 11, 66, 6.6, 7.2, { fx: 'slash' })], { vfx: 'waterRipple' }),
    nair: mv('Aerial Water Wheel', 'spin', 23, 4, [H(4, 11, 0, -42, 104, 90, 7.5, 64, 3.6, 2.2, { fx: 'slash' })], { land: true, turns: 2, vfx: 'waterRipple', chains: cA([4, 19]) }),
    nair2: mv('Falling Tide', 'dive', 24, 4, [H(4, 12, 24, -18, 74, 64, 9, -50, 4.6, 3.8, { fx: 'slash' })], { land: true, vel: [[4, 2, 8]], vfx: 'waterArc' }),
    nair_spec: mv('Air Water Dance', 'cast', 26, 5, [H(5, 13, 48, -42, 84, 58, 10, 36, 6.2, 6.6, { fx: 'slash' })], { vel: [[5, 13, -2]], vfx: 'waterArc' }),
    sair: mv('Aerial Current Slash', 'slash', 21, 4, [H(4, 10, 48, -44, 80, 56, 7.5, 32, 4.0, 2.6, { fx: 'slash' })], { land: true, vfx: 'waterArc', chains: cSA([4, 18]) }),
    sair2: mv('Ripple Cleave', 'backslash', 22, 4, [H(4, 11, 52, -42, 86, 58, 9, 36, 5.0, 4.4, { fx: 'slash' })], { land: true, vfx: 'waterArc' }),
    sair_spec: mv('Air Waterfall', 'thrust', 26, 5, [H(5, 14, 54, -40, 88, 62, 11, 38, 6.6, 7.2, { fx: 'slash' })], { vel: [[5, 14, 0]], vfx: 'waterRipple' }),
    dair: mv('Plunging Tide', 'dive', 28, 6, [H(6, 16, 30, -10, 66, 54, 9, -52, 3.8, 2.2, { fx: 'slash' })], { land: true, vel: [[6, 4, 10]], vfx: 'waterRipple' }),
    nsig: mv('Second Form: Water Wheel', 'upslash', 44, 13, [H(13, 20, 26, -72, 94, 122, 15.5, 86, 7.0, 9.2, { fx: 'slash' })], { vfx: 'waterArc' }),
    ssig: mv('Sixth Form: Whirlpool', 'slash', 46, 13, MULTI(13, 26, 56, -44, 110, 84, 2.8, 10, 38, 7.2, 9.2, 'slash', 3), { vel: [[11, 7, null], [27, 1, null]], vfx: 'waterRipple' }),
    dsig: mv('Water Quake', 'slam', 48, 15, [H(15, 22, 48, -20, 168, 66, 15.5, 64, 7.0, 9.0, { fx: 'slash' })], { vfx: 'waterRipple' }),
    rec: mv('Rising Torrent', 'rise', 36, 6, MULTI(6, 21, 10, -52, 80, 94, 3.0, 8, 82, 5.7, 7.5, 'slash', 5), { turns: 2, grav: 0.4, vel: [[6, 2, -14.2]], vfx: 'waterArc' }),
    gp: mv('Crashing Wave', 'slam', 40, 8, [H(8, 34, 24, -22, 88, 64, 12, -60, 5.6, 7.6, { fx: 'slash' })], { land: true, vel: [[8, 0, 18]], vfx: 'waterRipple' }),
    nspec: mv('Tenth Form: Constant Flux', 'cast', 42, 12, [], { cd: 168, grav: 0.35, vfx: 'waterArc', desc: 'Sends a coiling water dragon roaring along the ground, gaining size.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 12) { g.spawnProj({ owner: f, type: 'fireball', style: 'water', col: '#49b6e8', col2: '#e6f9ff', x: f.x + f.facing * 52, y: f.y - 44, vx: f.facing * 13, vy: 0, w: 92, h: 92, grow: 1.9, life: 52, dmg: 3.4, rehit: 6, ang: 40, kb: 4.2, sc: 2.6, fx: 'slash', dir: f.facing, fin: { dmg: 12, ang: 42, kb: 8, sc: 8.2 } }); sfx('whoosh'); g.shake(7); } } }),
    sspec: mv('Water Surface Slash', 'thrust', 30, 6, [H(6, 16, 40, -43, 86, 60, 12, 30, 6.0, 7.2, { fx: 'slash' })],
      { cd: 138, grav: 0, vel: [[0, 0, 0], [6, 24, 0], [17, 2, null]], vfx: 'waterArc', desc: 'Glides forward on a crescent of water, cutting clean through anything.' }),
    dspec: mv('Eleventh Form: Dead Calm', 'counter', 38, 2, [], { cd: 162, counter: [2, 24], invuln: [2, 24], vfx: 'waterRipple', desc: 'Absolute stillness — parries anything, including projectiles, and answers instantly.',
      onFrame: (f: any, fr: number, g: any) => { if (fr < 24) for (const p of g.projectiles) { if (p.owner !== f && p.reflectable !== false && Math.abs(p.x - f.x) < 92 + p.w / 2 && Math.abs(p.y - (f.y - 44)) < 84 + p.h / 2) { p.owner = f; p.vx = -p.vx * 1.3 || f.facing * 11; p.dir = Math.sign(p.vx) || f.facing; p.hitMap = new Map(); g.fx.ring(f.x + f.facing * 28, f.y - 44, 10, 62, '#c9f0ff', 14, 6); sfx('counter'); } } },
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); f.facing = a.x > f.x ? 1 : -1; f.invuln = 18; g.fx.slash(f.x, f.y - 44, 72, -1.6, 1.5, f.facing, '#8fdcff', 26, 16); g.applyHit(f, a, { dmg: 15, ang: 42, kb: 7.4, sc: 8.4, fx: 'slash' }, f.facing, a.x, a.y - 42); f.moveFrame = 26; } }),
    ult: dDragon('Hinokami Kagura', 'HINOKAMI KAGURA', 'Dances the Sun Breathing kagura, releasing a blazing solar dragon.', '#ff7a1a', 'fire', 'sunDance'),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 640 } }),

// ---------------- SASUKE : lightning precision ----------------
mk({ id: 'sasuke', name: 'Sasuke Uchiha', anime: 'Naruto', title: 'The Last Uchiha', tier: 'S', color: '#8a5cff',
  desc: 'Pinpoint lightning blade work. Low commitment pokes that convert into piercing Chidori punishes.',
  stats: ST(7.2, 6.7, 13.9, 0.94, 0.95, 0.61), bars: BR(4, 5, 4, 3),
  look: { skin: '#f2dcc6', hair: '#171a22', hairStyle: 'swept', top: '#20242e', top2: '#7a2030', sleeve: '#20242e', fore: '#f2dcc6', pants: '#2b3040', boots: '#1a1d26', cape: '#2a1d3a', capeLen: 34, eye: '#ff2f3f', weapon: 'katana', energy: '#b89dff', energy2: '#e6dcff' },
  moves: {
    nlight: mv('Chidori Blade', 'slash', 18, 3, [H(3, 7, 44, -46, 70, 48, 6.5, 38, 3.6, 2.1, { fx: 'elec' })], { vfx: 'chidori', chains: cN([3, 16]) }),
    nlight2: mv('Lightning Cut', 'backslash', 19, 3, [H(3, 7, 48, -44, 74, 50, 7.5, 44, 4.0, 2.5, { fx: 'elec' })], { vfx: 'chidori', chains: cN2([3, 16]) }),
    nlight3: mv('Thunder Flurry', 'spin', 25, 4, MULTI(4, 16, 46, -42, 80, 66, 2.4, 8.5, 46, 6.0, 7.0, 'elec'), { turns: 2, vfx: 'chidori' }),
    nlight_spec: mv('Chidori Stream', 'thrust', 26, 3, [H(3, 13, 50, -42, 86, 54, 10, 32, 6.4, 7.2, { fx: 'elec', stun: 10 })], { vel: [[3, 18, 0]], vfx: 'chidori' }),
    nlight_heavy: mv('Lion Combo Upper', 'uppercut', 30, 5, [H(5, 14, 26, -68, 74, 94, 12, 88, 7.0, 8.2, { fx: 'elec' })], { vel: [[5, 2, -12]], vfx: 'chidori' }),
    slight: mv('Sharingan Step', 'thrust', 21, 4, [H(4, 8, 50, -43, 78, 38, 7.5, 28, 4.0, 2.4, { fx: 'elec' })], { vel: [[3, 12, null], [10, 2, null]], vfx: 'chidori', chains: cS([4, 17]) }),
    slight2: mv('Blade Spin', 'spin', 21, 3, [H(3, 9, 54, -44, 84, 56, 8.5, 36, 5.0, 4.2, { fx: 'elec' })], { turns: 1, vel: [[3, 9, null]], vfx: 'chidori', chains: cS2([3, 17]) }),
    slight_spec: mv('Chidori Sharp Spear', 'cast', 28, 4, [H(4, 15, 66, -44, 116, 52, 11.5, 36, 6.8, 7.6, { fx: 'elec' })], { vfx: 'chidori' }),
    slight_heavy: mv('Kirin Smash', 'slam', 32, 6, [H(6, 14, 58, -40, 104, 78, 14, 42, 7.6, 9.0, { fx: 'elec' })], { vfx: 'chidori' }),
    dlight: mv('Low Blade Sweep', 'lowslash', 22, 4, [H(4, 9, 42, -12, 76, 28, 7, 72, 4.0, 1.9, { fx: 'slash' })], { vfx: 'chidori', chains: cD([4, 18]) }),
    dlight2: mv('Rising Lightning', 'upslash', 22, 4, [H(4, 10, 30, -60, 70, 82, 9, 86, 5.8, 5.0, { fx: 'elec' })], { vel: [[4, 2, -10]], vfx: 'chidori' }),
    dlight_spec: mv('Lightning Field', 'castUp', 27, 5, [H(5, 14, 38, -40, 96, 86, 11, 80, 6.6, 7.2, { fx: 'elec', stun: 10 })], { vfx: 'chidori' }),
    nair: mv('Aerial Blade Spin', 'spin', 22, 4, [H(4, 11, 0, -42, 100, 88, 7, 64, 3.5, 2.2, { fx: 'slash' })], { land: true, turns: 2, vfx: 'chidori', chains: cA([4, 18]) }),
    nair2: mv('Falling Thunder', 'dive', 24, 4, [H(4, 12, 22, -18, 70, 62, 9, -50, 4.6, 3.8, { fx: 'elec' })], { land: true, vel: [[4, 2, 9]], vfx: 'chidori' }),
    nair_spec: mv('Air Chidori', 'cast', 26, 4, [H(4, 13, 46, -42, 82, 56, 10.5, 36, 6.2, 6.6, { fx: 'elec' })], { vel: [[4, 14, -2]], vfx: 'chidori' }),
    sair: mv('Aerial Chidori Cut', 'slash', 20, 4, [H(4, 9, 46, -44, 76, 54, 7.5, 32, 4.0, 2.6, { fx: 'elec' })], { land: true, vfx: 'chidori', chains: cSA([4, 17]) }),
    sair2: mv('Storm Cleave', 'backslash', 22, 4, [H(4, 11, 50, -42, 84, 56, 9, 36, 5.0, 4.4, { fx: 'elec' })], { land: true, vfx: 'chidori' }),
    sair_spec: mv('Air Lightning Lunge', 'thrust', 26, 4, [H(4, 14, 54, -40, 88, 60, 11, 38, 6.6, 7.2, { fx: 'elec' })], { vel: [[4, 17, 0]], vfx: 'chidori' }),
    dair: mv('Thunder Dive', 'dive', 27, 5, [H(5, 15, 30, -10, 66, 54, 9, -52, 3.8, 2.2, { fx: 'elec' })], { land: true, vel: [[5, 4, 11]], vfx: 'chidori' }),
    nsig: mv('Kirin Strike', 'castUp', 44, 13, [H(13, 21, 30, -80, 88, 150, 16, 88, 7.0, 9.2, { fx: 'elec' })], { vfx: 'chidori' }),
    ssig: mv('Chidori Rush', 'thrust', 44, 12, [H(12, 20, 56, -44, 106, 56, 16.5, 38, 7.2, 9.4, { fx: 'elec' })], { vel: [[12, 13, null], [22, 2, null]], vfx: 'chidori' }),
    dsig: mv('Amaterasu Quake', 'slam', 50, 15, [H(15, 24, 48, -22, 170, 70, 15.5, 62, 7.0, 9.0, { fx: 'dark' })], { vfx: 'amaterasu' }),
    rec: mv('Lightning Ascent', 'rise', 36, 5, MULTI(5, 20, 10, -52, 78, 92, 2.9, 8, 82, 5.7, 7.4, 'elec', 5), { turns: 2, grav: 0.4, vel: [[5, 2, -14.6]], vfx: 'chidori' }),
    gp: mv('Chidori Drop', 'dive', 38, 7, [H(7, 32, 22, -18, 68, 58, 11.5, -56, 5.4, 7.4, { fx: 'elec' })], { land: true, vel: [[7, 3, 19]], vfx: 'chidori' }),
    nspec: mv('Fire Style: Fireball', 'cast', 44, 14, [], { cd: 182, grav: 0.35, vfx: 'flameTrail', desc: 'Breathes a giant rolling fireball that grows as it crosses the stage.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 14) { g.spawnProj({ owner: f, type: 'fireball', style: 'fire', col: '#ff6a1a', col2: '#ffd24a', x: f.x + f.facing * 54, y: f.y - 46, vx: f.facing * 10, vy: 0, w: 88, h: 88, grow: 2.2, life: 54, dmg: 3.2, rehit: 6, ang: 38, kb: 4.2, sc: 2.4, fx: 'fire', dir: f.facing, fin: { dmg: 11, ang: 44, kb: 7.6, sc: 7.8 } }); sfx('fire'); g.shake(8); } } }),
    sspec: mv('Chidori', 'thrust', 30, 6, [H(6, 16, 44, -43, 88, 58, 13, 30, 6.4, 7.4, { fx: 'elec', stun: 8 })],
      { cd: 138, grav: 0, invuln: [6, 15], vel: [[0, 0, 0], [6, 27, 0], [17, 2, null]], vfx: 'chidori', desc: 'A blinding violet lightning charge that pierces straight through.' }),
    dspec: mv('Kirin', 'castUp', 34, 10, [], { cd: 198, vfx: 'chidori', desc: 'Drags a pillar of heavenly lightning down onto the nearest enemy.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 10) { const t = g.nearestEnemy(f, 600); const tx = t ? t.x + t.vx * 8 : f.x + f.facing * 240; g.spawnProj({ owner: f, type: 'bolt', x: tx, y: (t ? t.y : f.y) - 150, vx: 0, vy: 0, w: 78, h: 360, life: 34, delay: 16, dmg: 15, ang: 80, kb: 6.4, sc: 7.6, stun: 12, fx: 'elec', dir: f.facing }); } } }),
    ult: dSummon('Susanoo: Indra', 'SUSANOO: INDRA', 'Manifests his complete Susanoo and brings its blade down on everything.'),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 660 } }),

// ---------------- LUFFY : absurd reach ----------------
mk({ id: 'luffy', name: 'Monkey D. Luffy', anime: 'One Piece', title: 'Future Pirate King', tier: 'A', color: '#e8452f',
  desc: 'Rubber limbs stretch absurdly far — he can hit you from most of the screen away, but his fists take a moment to arrive.',
  stats: ST(6.8, 6.3, 13.9, 1.02, 0.94, 0.6), bars: BR(5, 3, 5, 3),
  look: { skin: '#f2c79f', hair: '#1a1410', hairStyle: 'messy', top: '#d8423a', top2: '#f2dfa8', sleeve: '#f2c79f', fore: '#f2c79f', pants: '#2e5fa8', boots: '#3a2a1a', eye: '#3a2a20', weapon: 'claws', energy: '#ff6a4a', energy2: '#ffd2a8', mark: 'hat' },
  moves: {
    nlight: mv('Rubber Jab', 'punch', 22, 6, [H(6, 12, 76, -47, 128, 30, 7, 38, 3.4, 2.1, { fx: 'blunt' })], { trail: 'hand', vfx: 'rubberStretch', chains: cN([6, 20]) }),
    nlight2: mv('Gum-Gum Whip', 'kick', 23, 5, [H(5, 12, 84, -44, 140, 34, 8, 44, 4.0, 2.5, { fx: 'blunt' })], { trail: 'foot', vfx: 'rubberStretch', chains: cN2([5, 20]) }),
    nlight3: mv('Gum-Gum Spinning Lash', 'punch', 32, 5, MULTI(5, 24, 74, -44, 124, 54, 2.2, 9, 44, 6.2, 7.2, 'blunt', 3), { trail: 'hand', vfx: 'gatling' }),
    nlight_spec: mv('Gum-Gum Bazooka', 'thrust', 30, 7, [H(7, 16, 88, -44, 140, 62, 11.5, 32, 6.6, 7.4, { fx: 'blunt' })], { trail: 'hand', vfx: 'rubberStretch' }),
    nlight_heavy: mv('Gum-Gum Rocket Upper', 'uppercut', 34, 7, [H(7, 16, 34, -70, 80, 104, 13, 86, 7.4, 8.6, { fx: 'blunt' })], { vel: [[7, 2, -12]], vfx: 'rubberStretch' }),
    slight: mv('Gum-Gum Stretch Jab', 'thrust', 26, 6, [H(6, 13, 92, -43, 150, 34, 8, 26, 4.2, 2.5, { fx: 'blunt' })], { trail: 'hand', vfx: 'rubberStretch', chains: cS([6, 22]) }),
    slight2: mv('Gum-Gum Spear', 'kick', 26, 5, [H(5, 12, 96, -42, 156, 40, 9, 34, 5.0, 4.2, { fx: 'blunt' })], { trail: 'foot', vfx: 'rubberStretch', chains: cS2([5, 22]) }),
    slight_spec: mv('Gum-Gum Rifle', 'thrust', 32, 7, [H(7, 18, 104, -44, 168, 52, 12, 36, 7.0, 7.8, { fx: 'blunt' })], { trail: 'hand', vfx: 'gatling' }),
    slight_heavy: mv('Gum-Gum Bell Smash', 'slam', 36, 8, [H(8, 18, 74, -40, 132, 82, 14.5, 42, 7.6, 9.0, { fx: 'blunt' })], { vfx: 'rubberStretch' }),
    dlight: mv('Gum-Gum Sweep', 'sweep', 25, 6, [H(6, 12, 76, -10, 132, 26, 8, 74, 4.2, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'rubberStretch', chains: cD([6, 21]) }),
    dlight2: mv('Gum-Gum Rising Fist', 'uppercut', 25, 5, [H(5, 12, 32, -58, 74, 80, 9.5, 86, 5.8, 4.8, { fx: 'blunt' })], { vel: [[5, 1, -10]], vfx: 'rubberStretch' }),
    dlight_spec: mv('Gum-Gum Stamp', 'slam', 30, 6, [H(6, 16, 62, -22, 122, 62, 11.5, 66, 6.6, 7.2, { fx: 'blunt' })], { vfx: 'gatling' }),
    nair: mv('Gum-Gum Spin', 'spin', 24, 5, [H(5, 12, 0, -42, 138, 96, 7.5, 64, 3.6, 2.2, { fx: 'blunt' })], { land: true, turns: 2, vfx: 'rubberStretch', chains: cA([5, 20]) }),
    nair2: mv('Gum-Gum Axe', 'slam', 26, 5, [H(5, 14, 28, -18, 84, 68, 9.5, -52, 4.8, 3.8, { fx: 'blunt' })], { land: true, vel: [[5, 1, 9]], vfx: 'rubberStretch' }),
    nair_spec: mv('Air Gum-Gum Bazooka', 'thrust', 28, 6, [H(6, 15, 84, -42, 134, 58, 10.5, 36, 6.2, 6.6, { fx: 'blunt' })], { vfx: 'rubberStretch' }),
    sair: mv('Gum-Gum Air Kick', 'kick', 23, 5, [H(5, 11, 80, -44, 128, 40, 7.5, 30, 3.9, 2.6, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'rubberStretch', chains: cSA([5, 19]) }),
    sair2: mv('Gum-Gum Hammer', 'slam', 25, 5, [H(5, 13, 74, -42, 122, 58, 9.5, 36, 5.0, 4.4, { fx: 'blunt' })], { land: true, vfx: 'rubberStretch' }),
    sair_spec: mv('Air Gum-Gum Rifle', 'thrust', 28, 6, [H(6, 16, 96, -40, 152, 56, 11, 38, 6.6, 7.2, { fx: 'blunt' })], { vfx: 'gatling' }),
    dair: mv('Gum-Gum Stomp', 'dkick', 28, 6, [H(6, 16, 10, -6, 56, 50, 9.5, -56, 3.8, 2.2, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'rubberStretch' }),
    nsig: mv('Gum-Gum Hammer Upper', 'uppercut', 46, 14, [H(14, 22, 34, -66, 116, 116, 17, 84, 7.4, 9.4, { fx: 'blunt' })], { vfx: 'rubberStretch' }),
    ssig: mv('Gum-Gum Red Hawk', 'thrust', 46, 13, [H(13, 22, 96, -44, 164, 62, 17.5, 38, 7.4, 9.6, { fx: 'fire' })], { vfx: 'redHawk' }),
    dsig: mv('Gum-Gum Grizzly Magnum', 'slam', 50, 16, [H(16, 24, 62, -22, 196, 74, 17, 62, 7.2, 9.2, { fx: 'blunt' })], { vfx: 'gatling' }),
    rec: mv('Gum-Gum Rocket', 'rise', 36, 6, MULTI(6, 21, 12, -52, 86, 98, 3.0, 8, 82, 5.8, 7.6, 'blunt', 5), { turns: 1, grav: 0.4, vel: [[6, 3, -15]], vfx: 'rubberStretch' }),
    gp: mv('Gum-Gum Meteor', 'slam', 42, 8, [H(8, 34, 26, -22, 96, 66, 13, -60, 5.8, 7.8, { fx: 'blunt' })], { land: true, vel: [[8, 0, 19]], vfx: 'rubberStretch' }),
    nspec: mv('Gum-Gum Red Hawk', 'thrust', 36, 8, [H(8, 20, 104, -43, 176, 64, 14, 32, 6.6, 7.8, { fx: 'fire' })],
      { cd: 158, grav: 0.2, vfx: 'redHawk', desc: 'A flame-wrapped fist that stretches most of the way across the stage.' }),
    sspec: mv('Gum-Gum Gatling', 'punch', 50, 8, MULTI(8, 40, 86, -44, 148, 74, 2.3, 9.5, 42, 6.8, 8.4, 'blunt', 3),
      { cd: 188, grav: 0.3, trail: 'hand', vfx: 'gatling', desc: 'An endless barrage of rubber fists filling the space in front of him.' }),
    dspec: mv('Gum-Gum Elephant Gun', 'slam', 46, 15, [H(15, 24, 58, -26, 200, 96, 17, 60, 7.4, 9.2, { fx: 'blunt' })],
      { cd: 202, vfx: 'hardenCrack', desc: 'A titanic armament-hardened fist that craters the entire ground.' }),
    ult: dTransform('Gear Fourth', 'GEAR FOURTH', 'Inflates into Boundman — rocket-powered rubber with monstrous reach.', 'god', '#ff6a4a', 'rubberStretch', 600),
  },
  ai: { horizSpec: 'nspec', zoneSpec: 'dspec', ultRange: 460 } }),

// ---------------- ZORO : three-sword power ----------------
mk({ id: 'zoro', name: 'Roronoa Zoro', anime: 'One Piece', title: 'Three-Sword Style', tier: 'A', color: '#2fa36a',
  desc: 'Three blades at once means three overlapping hitboxes per swing — brutal damage, but he commits hard to every cut.',
  stats: ST(6.3, 6.0, 13.2, 1.1, 1.0, 0.62), bars: BR(5, 2, 5, 4),
  look: { skin: '#eccfa8', hair: '#4caf6a', hairStyle: 'spikeShort', top: '#1f2a24', top2: '#2fa36a', sleeve: '#f0f0f0', fore: '#eccfa8', pants: '#1c2320', boots: '#2a2018', cape: '#2b6b4a', capeLen: 32, eye: '#2b2b2b', weapon: 'triple', energy: '#8dffbe', energy2: '#e6fff0', mark: 'bandana' },
  moves: {
    nlight: mv('Santoryu Slash', 'slash', 25, 6, [H(6, 12, 52, -46, 92, 68, 9, 40, 3.9, 2.3, { fx: 'slash' })], { vfx: 'triCut', chains: cN([6, 21]) }),
    nlight2: mv('Tora Gari', 'backslash', 25, 5, [H(5, 11, 56, -44, 96, 70, 10, 46, 4.4, 2.7, { fx: 'slash' })], { vfx: 'triCut', chains: cN2([5, 21]) }),
    nlight3: mv('Three-Sword Flurry', 'spin', 32, 6, MULTI(6, 20, 52, -44, 104, 82, 3.0, 10, 46, 6.4, 7.4, 'slash'), { turns: 3, vfx: 'windCross' }),
    nlight_spec: mv('Flying Slash', 'thrust', 30, 6, [H(6, 16, 60, -44, 104, 62, 12, 32, 6.6, 7.4, { fx: 'slash' })], { vfx: 'windCross',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 12) g.spawnProj({ owner: f, type: 'wave', x: f.x + f.facing * 56, y: f.y - 44, vx: f.facing * 13, vy: 0, w: 40, h: 104, life: 32, dmg: 7, ang: 40, kb: 4.6, sc: 4.6, fx: 'slash', dir: f.facing }); } }),
    nlight_heavy: mv('Rising Tiger Hunt', 'upslash', 36, 7, [H(7, 17, 32, -70, 96, 108, 14, 86, 7.4, 8.8, { fx: 'slash' })], { vel: [[7, 2, -12]], vfx: 'triCut' }),
    slight: mv('Sanbyaku Pound', 'thrust', 27, 6, [H(6, 12, 60, -43, 100, 44, 9.5, 28, 4.2, 2.6, { fx: 'slash' })], { vel: [[4, 8, null], [13, 2, null]], vfx: 'triCut', chains: cS([6, 22]) }),
    slight2: mv('Cross Cutter', 'slash', 27, 5, [H(5, 12, 64, -44, 106, 66, 10.5, 36, 5.2, 4.4, { fx: 'slash' })], { vel: [[5, 7, null]], vfx: 'windCross', chains: cS2([5, 22]) }),
    slight_spec: mv('Streaming Wolf Swords', 'cast', 32, 6, [H(6, 18, 72, -44, 128, 72, 12.5, 38, 7.0, 7.8, { fx: 'slash' })], { vfx: 'windCross' }),
    slight_heavy: mv('Ultra Tiger Hunt', 'slam', 38, 8, [H(8, 18, 70, -40, 124, 88, 15.5, 42, 7.8, 9.2, { fx: 'slash' })], { vfx: 'triCut' }),
    dlight: mv('Low Sword Sweep', 'lowslash', 27, 6, [H(6, 12, 52, -14, 100, 30, 9, 72, 4.4, 2.0, { fx: 'slash' })], { vfx: 'triCut', chains: cD([6, 22]) }),
    dlight2: mv('Rising Crescent Cut', 'upslash', 26, 5, [H(5, 12, 34, -62, 84, 88, 10.5, 86, 6.0, 5.2, { fx: 'slash' })], { vel: [[5, 2, -10]], vfx: 'triCut' }),
    dlight_spec: mv('Ground Cutter', 'slam', 32, 6, [H(6, 16, 56, -20, 134, 64, 12, 66, 6.8, 7.4, { fx: 'slash' })], { vfx: 'windCross' }),
    nair: mv('Aerial Blade Spin', 'spin', 26, 5, [H(5, 13, 0, -42, 132, 100, 8.5, 64, 3.8, 2.3, { fx: 'slash' })], { land: true, turns: 2, vfx: 'triCut', chains: cA([5, 21]) }),
    nair2: mv('Falling Cross Cut', 'dive', 27, 5, [H(5, 14, 28, -18, 86, 70, 10, -50, 4.8, 3.8, { fx: 'slash' })], { land: true, vel: [[5, 2, 9]], vfx: 'windCross' }),
    nair_spec: mv('Air Flying Slash', 'cast', 29, 6, [H(6, 15, 54, -42, 96, 62, 11, 36, 6.2, 6.8, { fx: 'slash' })], { vfx: 'windCross' }),
    sair: mv('Aerial Oni Giri', 'slash', 25, 6, [H(6, 12, 56, -44, 98, 66, 9, 32, 4.2, 2.7, { fx: 'slash' })], { land: true, vfx: 'triCut', chains: cSA([6, 20]) }),
    sair2: mv('Air Tora Gari', 'backslash', 26, 5, [H(5, 12, 60, -42, 102, 66, 10, 36, 5.2, 4.4, { fx: 'slash' })], { land: true, vfx: 'triCut' }),
    sair_spec: mv('Air Wolf Swords', 'thrust', 29, 6, [H(6, 16, 66, -40, 112, 64, 11.5, 38, 6.8, 7.2, { fx: 'slash' })], { vfx: 'windCross' }),
    dair: mv('Plunging Tiger', 'dive', 30, 7, [H(7, 18, 34, -10, 76, 58, 10, -50, 4.0, 2.3, { fx: 'slash' })], { land: true, vel: [[7, 4, 11]], vfx: 'triCut' }),
    nsig: mv('Dragon Twister', 'rise', 48, 15, MULTI(15, 30, 12, -60, 104, 118, 3.2, 10.5, 84, 7.2, 9.2, 'slash'), { turns: 3, vel: [[15, 1, -9]], vfx: 'windCross' }),
    ssig: mv('Rashomon', 'slash', 50, 15, [H(15, 22, 70, -44, 142, 96, 18, 38, 7.4, 9.8, { fx: 'slash' })], { vel: [[13, 6, null], [23, 1, null]], vfx: 'windCross' }),
    dsig: mv('Rengoku Onigiri', 'slam', 52, 16, [H(16, 24, 56, -22, 190, 74, 17.5, 62, 7.2, 9.4, { fx: 'slash' })], { vfx: 'triCut' }),
    rec: mv('Rising Dragon Twister', 'rise', 38, 6, MULTI(6, 21, 12, -52, 88, 98, 3.0, 8, 82, 5.8, 7.6, 'slash', 5), { turns: 2, grav: 0.44, vel: [[6, 2, -14]], vfx: 'windCross' }),
    gp: mv('Great Dragon Shock', 'slam', 42, 8, [H(8, 34, 26, -22, 98, 66, 13.5, -60, 5.8, 8.0, { fx: 'slash' })], { land: true, vel: [[8, 0, 19]], vfx: 'triCut' }),
    nspec: mv('Flying Slash: Cross Cutter', 'cast', 42, 12, [], { cd: 168, grav: 0.35, vfx: 'windCross', desc: 'Launches a huge crossing pair of compressed air blades.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 12) { for (const oy of [-18, 18]) g.spawnProj({ owner: f, type: 'wave', x: f.x + f.facing * 56, y: f.y - 46 + oy, vx: f.facing * 14, vy: oy * 0.06, w: 44, h: 96, life: 44, dmg: 7.5, ang: 42, kb: 5, sc: 5.2, fx: 'slash', dir: f.facing }); sfx('whoosh'); g.shake(7); } } }),
    sspec: mv('Oni Giri', 'thrust', 32, 7, [H(7, 17, 44, -43, 96, 70, 13.5, 30, 6.4, 7.4, { fx: 'slash' })],
      { cd: 145, grav: 0, vel: [[0, 0, 0], [7, 24, 0], [18, 2, null]], vfx: 'triCut', desc: 'A three-sword blitz that carves clean through everything ahead.' }),
    dspec: mv('Purgatory Onigiri', 'slam', 48, 15, [H(15, 24, 48, -22, 200, 74, 16.5, 62, 7.2, 9.0, { fx: 'slash' })],
      { cd: 200, vfx: 'hardenCrack', desc: 'Drives all three blades into the earth, shattering the ground apart.' }),
    ult: dBeam('Asura: Nine Swords', 'ASURA — NINE SWORDS', 'Manifests nine blades and unleashes an unstoppable demonic slash storm.', '#8dffbe', 'slash', 'wind', 'windCross'),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 640 } }),

// ---------------- SAITAMA : slow, absurd damage ----------------
mk({ id: 'saitama', name: 'Saitama', anime: 'One-Punch Man', title: 'The Caped Baldy', tier: 'S', color: '#f2c53d',
  desc: 'Hits harder than anything else in the game and can barely be knocked back — but he is slow, and every swing is a commitment.',
  stats: ST(5.9, 5.7, 12.7, 1.28, 1.0, 0.64), bars: BR(5, 1, 3, 5),
  look: { skin: '#f6d9b4', hair: '#f6d9b4', hairStyle: 'bald', top: '#f2c53d', top2: '#d8322c', sleeve: '#f2c53d', fore: '#f6d9b4', pants: '#f2c53d', boots: '#d8322c', cape: '#f4f4f6', capeLen: 46, eye: '#2a2a2a', weapon: 'claws', energy: '#ffe58a', energy2: '#ffffff' },
  moves: {
    nlight: mv('Normal Punch', 'punch', 24, 7, [H(7, 12, 40, -48, 60, 40, 11, 38, 4.4, 3.2, { fx: 'blunt' })], { trail: 'hand', vfx: 'airPressure', chains: cN([7, 21]) }),
    nlight2: mv('Casual Jab', 'punch', 24, 6, [H(6, 11, 44, -46, 64, 42, 12, 44, 4.8, 3.6, { fx: 'blunt' })], { trail: 'hand', vfx: 'airPressure', chains: cN2([6, 21]) }),
    nlight3: mv('Consecutive Punches', 'punch', 34, 7, MULTI(7, 24, 46, -44, 74, 56, 3.4, 13, 44, 6.8, 7.8, 'blunt', 3), { trail: 'hand', vfx: 'gatling' }),
    nlight_spec: mv('Shockwave Fist', 'cast', 32, 7, [H(7, 17, 64, -44, 128, 66, 14, 32, 6.8, 7.8, { fx: 'blunt' })], { vfx: 'airPressure' }),
    nlight_heavy: mv('Serious Upper', 'uppercut', 38, 9, [H(9, 18, 30, -70, 84, 108, 17, 86, 7.8, 9.0, { fx: 'blunt' })], { vel: [[9, 2, -12]], vfx: 'airPressure' }),
    slight: mv('Step Punch', 'punch', 28, 7, [H(7, 13, 50, -44, 76, 44, 12, 28, 4.6, 3.4, { fx: 'blunt' })], { vel: [[5, 9, null], [14, 2, null]], trail: 'hand', vfx: 'airPressure', chains: cS([7, 23]) }),
    slight2: mv('Heavy Hook', 'punch', 28, 6, [H(6, 13, 54, -42, 82, 54, 13, 34, 5.4, 4.6, { fx: 'blunt' })], { trail: 'hand', vfx: 'airPressure', chains: cS2([6, 23]) }),
    slight_spec: mv('Air-Burst Charge', 'thrust', 34, 6, [H(6, 18, 58, -44, 104, 66, 15, 36, 7.2, 8.2, { fx: 'blunt' })], { vel: [[6, 24, 0]], vfx: 'airPressure' }),
    slight_heavy: mv('Serious Side Punch', 'slam', 42, 9, [H(9, 20, 66, -40, 128, 84, 19, 42, 8.2, 9.6, { fx: 'blunt' })], { vfx: 'seriousWind' }),
    dlight: mv('Low Swipe', 'sweep', 26, 6, [H(6, 12, 44, -10, 72, 28, 11, 72, 4.4, 2.8, { fx: 'blunt' })], { trail: 'foot', vfx: 'airPressure', chains: cD([6, 22]) }),
    dlight2: mv('Rising Fist', 'uppercut', 27, 6, [H(6, 13, 30, -58, 70, 82, 13, 86, 6.2, 5.6, { fx: 'blunt' })], { vel: [[6, 1, -10]], vfx: 'airPressure' }),
    dlight_spec: mv('Ground Crack', 'slam', 34, 7, [H(7, 18, 56, -22, 142, 66, 15, 66, 7.0, 7.8, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    nair: mv('Air Spin Punch', 'spin', 26, 6, [H(6, 13, 0, -42, 104, 92, 11, 64, 4.0, 2.8, { fx: 'blunt' })], { land: true, turns: 1, vfx: 'airPressure', chains: cA([6, 21]) }),
    nair2: mv('Falling Hammer', 'slam', 28, 6, [H(6, 15, 26, -18, 76, 66, 13, -50, 5.2, 4.4, { fx: 'blunt' })], { land: true, vel: [[6, 1, 9]], vfx: 'airPressure' }),
    nair_spec: mv('Air Shockwave', 'cast', 30, 7, [H(7, 16, 56, -42, 112, 62, 13.5, 36, 6.6, 7.2, { fx: 'blunt' })], { vfx: 'airPressure' }),
    sair: mv('Air Kick', 'kick', 25, 6, [H(6, 12, 48, -44, 68, 46, 11, 30, 4.2, 3.0, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'airPressure', chains: cSA([6, 20]) }),
    sair2: mv('Air Hook', 'punch', 27, 6, [H(6, 14, 52, -42, 76, 52, 12.5, 34, 5.2, 4.6, { fx: 'blunt' })], { land: true, trail: 'hand', vfx: 'airPressure' }),
    sair_spec: mv('Air Burst Lunge', 'thrust', 30, 7, [H(7, 17, 58, -40, 104, 62, 14, 38, 7.0, 7.6, { fx: 'blunt' })], { vel: [[7, 16, 0]], vfx: 'airPressure' }),
    dair: mv('Meteor Stomp', 'dkick', 30, 7, [H(7, 18, 10, -6, 54, 50, 13, -56, 4.2, 2.8, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'airPressure' }),
    nsig: mv('Serious Uppercut', 'uppercut', 50, 16, [H(16, 24, 26, -66, 96, 116, 21, 86, 8.0, 9.8, { fx: 'blunt' })], { vfx: 'seriousWind' }),
    ssig: mv('Killer Move: Normal Punch', 'thrust', 52, 17, [H(17, 26, 62, -44, 128, 70, 23, 38, 8.4, 10, { fx: 'blunt' })], { vfx: 'seriousWind' }),
    dsig: mv('Ground Shatter', 'slam', 54, 18, [H(18, 26, 52, -22, 210, 76, 21, 62, 8.0, 9.8, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    rec: mv('Hero Jump', 'rise', 36, 6, MULTI(6, 21, 12, -52, 84, 96, 3.6, 10, 82, 6.0, 7.8, 'blunt', 5), { turns: 1, grav: 0.42, vel: [[6, 2, -15.5]], vfx: 'airPressure' }),
    gp: mv('Crater Drop', 'dkick', 42, 8, [H(8, 34, 26, -14, 92, 64, 15, -60, 6.0, 8.2, { fx: 'blunt' })], { land: true, vel: [[8, 0, 20]], vfx: 'hardenCrack' }),
    nspec: mv('Consecutive Normal Punches', 'cast', 46, 14, [], { cd: 190, grav: 0.3, vfx: 'airPressure', desc: 'Punches so fast the displaced air itself blasts forward as a wall.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 14) { g.spawnProj({ owner: f, type: 'fireball', style: 'wind', col: '#ffffff', col2: '#ffe58a', x: f.x + f.facing * 58, y: f.y - 46, vx: f.facing * 13, vy: 0, w: 96, h: 100, grow: 2.2, life: 48, dmg: 3.8, rehit: 6, ang: 38, kb: 4.6, sc: 3.0, fx: 'blunt', dir: f.facing, fin: { dmg: 14, ang: 42, kb: 9, sc: 9.2 } }); sfx('swingH'); g.shake(10); } } }),
    sspec: mv('Hero Arrival', 'thrust', 34, 8, [H(8, 20, 46, -43, 100, 66, 16, 30, 7.0, 8.2, { fx: 'blunt' })],
      { cd: 158, grav: 0, invuln: [8, 18], vel: [[0, 0, 0], [8, 29, 0], [21, 2, null]], vfx: 'airPressure', desc: 'Crosses the whole arena in one step and arrives fist-first.' }),
    dspec: mv('Serious Stomp', 'slam', 48, 15, [H(15, 24, 46, -22, 214, 76, 19, 62, 7.8, 9.6, { fx: 'blunt' })],
      { cd: 205, vfx: 'hardenCrack', desc: 'A casual stomp that fractures the entire stage in one go.' }),
    ult: dMeteor('Serious Punch', 'SERIOUS SERIES: SERIOUS PUNCH', 'Throws one genuinely serious punch. The shockwave does the rest.', '#ffe58a', 'blunt', 'seriousWind'),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 340 } }),

// ---------------- GOJO : space control ----------------
mk({ id: 'gojo', name: 'Satoru Gojo', anime: 'Jujutsu Kaisen', title: 'The Strongest Sorcerer', tier: 'S', color: '#5fd2ff',
  desc: 'Bends space itself. Blue drags foes in, Red blasts them away, and Infinity means most things simply never reach him.',
  stats: ST(6.8, 6.8, 13.7, 0.96, 1.0, 0.58), bars: BR(5, 4, 5, 5),
  look: { skin: '#f6e2d0', hair: '#f2f5ff', hairStyle: 'spikeLong', top: '#15171f', top2: '#5fd2ff', sleeve: '#15171f', fore: '#15171f', pants: '#1b1e28', boots: '#101218', eye: '#5fd2ff', weapon: 'claws', energy: '#7fd8ff', energy2: '#c9a8ff', mark: 'blindfold' },
  moves: {
    nlight: mv('Cursed Jab', 'punch', 19, 4, [H(4, 8, 40, -48, 62, 38, 6.5, 38, 3.4, 2.1, { fx: 'purple' })], { trail: 'hand', vfx: 'limitless', chains: cN([4, 17]) }),
    nlight2: mv('Limitless Palm', 'cast', 20, 4, [H(4, 9, 46, -46, 70, 44, 7.5, 44, 4.0, 2.5, { fx: 'purple' })], { vfx: 'limitless', chains: cN2([4, 17]) }),
    nlight3: mv('Blue Crush', 'cast', 28, 5, MULTI(5, 20, 50, -44, 88, 76, 2.4, 9, 62, 6.4, 7.2, 'purple', 4), { vfx: 'gravityPull' }),
    nlight_spec: mv('Cursed Technique: Blue', 'cast', 30, 6, [H(6, 20, 56, -44, 96, 84, 10, 62, 5.4, 6.4, { fx: 'purple', pull: true })], { vfx: 'gravityPull' }),
    nlight_heavy: mv('Red Launch', 'cast', 32, 6, [H(6, 16, 34, -66, 88, 104, 13, 84, 7.4, 8.6, { fx: 'purple' })], { vfx: 'limitless' }),
    slight: mv('Warp Step', 'thrust', 22, 4, [H(4, 9, 52, -44, 78, 42, 7.5, 28, 4.0, 2.4, { fx: 'purple' })], { vel: [[3, 13, null], [11, 2, null]], vfx: 'limitless', chains: cS([4, 18]) }),
    slight2: mv('Infinity Slap', 'punch', 22, 4, [H(4, 9, 56, -42, 84, 50, 8.5, 34, 5.0, 4.2, { fx: 'purple' })], { trail: 'hand', vfx: 'limitless', chains: cS2([4, 18]) }),
    slight_spec: mv('Cursed Technique: Red', 'cast', 30, 5, [H(5, 16, 66, -44, 116, 70, 12.5, 34, 7.2, 7.8, { fx: 'purple' })], { vel: [[5, -6, 0]], vfx: 'limitless' }),
    slight_heavy: mv('Lapse Smash', 'slam', 34, 7, [H(7, 16, 62, -40, 112, 80, 14.5, 42, 7.6, 9.0, { fx: 'purple' })], { vfx: 'limitless' }),
    dlight: mv('Low Sweep', 'sweep', 22, 4, [H(4, 9, 44, -10, 72, 28, 7, 72, 4.0, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'gravityPull', chains: cD([4, 18]) }),
    dlight2: mv('Rising Blue', 'castUp', 24, 5, [H(5, 13, 32, -60, 76, 92, 9.5, 84, 5.8, 5.2, { fx: 'purple', pull: true })], { vfx: 'gravityPull' }),
    dlight_spec: mv('Gravity Well', 'slam', 32, 6, [H(6, 22, 48, -24, 132, 76, 10, 66, 4.4, 5.4, { fx: 'purple', pull: true })], { vfx: 'gravityPull' }),
    nair: mv('Air Infinity Spin', 'spin', 23, 4, [H(4, 12, 0, -42, 112, 94, 7.5, 64, 3.6, 2.2, { fx: 'purple' })], { land: true, turns: 2, vfx: 'limitless', chains: cA([4, 19]) }),
    nair2: mv('Falling Blue', 'cast', 25, 4, [H(4, 14, 26, -20, 84, 72, 9.5, -46, 4.8, 3.8, { fx: 'purple' })], { land: true, vel: [[4, 2, 8]], vfx: 'gravityPull' }),
    nair_spec: mv('Air Blue Burst', 'cast', 28, 5, [H(5, 16, 50, -42, 92, 80, 10, 60, 5.2, 6.2, { fx: 'purple', pull: true })], { vfx: 'gravityPull' }),
    sair: mv('Air Warp Kick', 'kick', 21, 4, [H(4, 10, 48, -44, 72, 44, 7.5, 32, 4.0, 2.6, { fx: 'purple' })], { land: true, trail: 'foot', vfx: 'limitless', chains: cSA([4, 18]) }),
    sair2: mv('Air Red Palm', 'cast', 23, 4, [H(4, 11, 54, -42, 84, 54, 9, 36, 5.2, 4.4, { fx: 'purple' })], { land: true, vfx: 'limitless' }),
    sair_spec: mv('Air Reversal Red', 'cast', 28, 5, [H(5, 15, 60, -40, 100, 64, 11.5, 40, 6.8, 7.2, { fx: 'purple' })], { vel: [[5, 13, 0]], vfx: 'limitless' }),
    dair: mv('Collapse Dive', 'dive', 28, 6, [H(6, 16, 30, -10, 72, 56, 9.5, -52, 3.8, 2.2, { fx: 'purple' })], { land: true, vel: [[6, 4, 10]], vfx: 'gravityPull' }),
    nsig: mv('Hollow Rising', 'castUp', 46, 14, [H(14, 22, 30, -78, 96, 146, 16, 86, 7.2, 9.4, { fx: 'purple' })], { vfx: 'hollowPurple' }),
    ssig: mv('Maximum: Red', 'cast', 48, 14, [H(14, 22, 70, -44, 140, 86, 17, 38, 7.4, 9.6, { fx: 'purple' })], { vfx: 'limitless' }),
    dsig: mv('Domain Shockwave', 'slam', 52, 16, [H(16, 26, 0, -46, 240, 140, 16, 62, 7.2, 9.2, { fx: 'purple' })], { invuln: [8, 26], vfx: 'hollowPurple' }),
    rec: mv('Warp Ascent', 'rise', 36, 5, MULTI(5, 20, 10, -52, 84, 96, 3.0, 8, 82, 5.8, 7.6, 'purple', 5), { turns: 2, grav: 0.38, vel: [[5, 2, -15]], vfx: 'limitless' }),
    gp: mv('Gravity Slam', 'slam', 40, 8, [H(8, 34, 24, -22, 92, 64, 12.5, -60, 5.6, 7.8, { fx: 'purple' })], { land: true, vel: [[8, 0, 18]], vfx: 'gravityPull' }),
    nspec: mv('Cursed Technique: Blue', 'cast', 44, 13, [], { cd: 178, grav: 0.35, vfx: 'gravityPull', desc: 'Compresses space into a sphere that drags everything helplessly inward.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 13) { g.spawnProj({ owner: f, type: 'fireball', style: 'cursed', col: '#5fd2ff', col2: '#c9a8ff', x: f.x + f.facing * 56, y: f.y - 48, vx: f.facing * 9, vy: 0, w: 92, h: 92, grow: 1.7, life: 58, dmg: 3, rehit: 6, pull: true, ang: 55, kb: 3.2, sc: 1.6, fx: 'purple', dir: f.facing, fin: { dmg: 12, ang: 55, kb: 8, sc: 8.2 } }); sfx('purple'); g.shake(7); } } }),
    sspec: mv('Reversal: Red', 'cast', 32, 7, [H(7, 18, 62, -44, 124, 74, 13.5, 34, 7.2, 8.0, { fx: 'purple' })],
      { cd: 150, grav: 0.2, vel: [[7, -7, -2]], vfx: 'limitless', desc: 'Inverts cursed energy into a repulsive blast that shoves foes away.' }),
    dspec: mv('Infinity', 'counter', 40, 2, [], { cd: 168, counter: [2, 26], invuln: [2, 26], vfx: 'limitless', desc: 'Nothing can reach him — negates any attack or projectile and answers instantly.',
      onFrame: (f: any, fr: number, g: any) => { if (fr < 26) for (const p of g.projectiles) { if (p.owner !== f && p.reflectable !== false && Math.abs(p.x - f.x) < 100 + p.w / 2 && Math.abs(p.y - (f.y - 44)) < 90 + p.h / 2) { p.owner = f; p.vx = -p.vx * 1.4 || f.facing * 12; p.dir = Math.sign(p.vx) || f.facing; p.hitMap = new Map(); p.dmg *= 1.3; g.fx.ring(f.x + f.facing * 30, f.y - 44, 10, 70, '#5fd2ff', 16, 6); sfx('counter'); } } },
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); g.flashScreen('#5fd2ff', 0.34); f.facing = a.x > f.x ? 1 : -1; f.invuln = 22; g.fx.ring(f.x, f.y - 44, 12, 110, '#c9a8ff', 20, 9); g.applyHit(f, a, { dmg: 15.5, ang: 42, kb: 7.6, sc: 8.6, fx: 'purple' }, f.facing, a.x, a.y - 42); f.moveFrame = 28; } }),
    ult: dBeam('Hollow Purple', 'HOLLOW TECHNIQUE: PURPLE', 'Collides Blue and Red into an imaginary mass that erases all it touches.', '#b067ff', 'purple', 'void', 'hollowPurple'),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 700 } }),

// ---------------- YUJI : black flash brawler ----------------
mk({ id: 'yuji', name: 'Yuji Itadori', anime: 'Jujutsu Kaisen', title: "Sukuna's Vessel", tier: 'A', color: '#ff5f8a',
  desc: 'Pure physical sorcery. His Divergent Fist lands a delayed second impact on almost everything he throws.',
  stats: ST(7.1, 6.6, 13.9, 0.98, 0.94, 0.61), bars: BR(5, 4, 3, 3),
  look: { skin: '#f3d6bd', hair: '#ff8fae', hairStyle: 'spikeShort', top: '#1b1f28', top2: '#ff5f8a', sleeve: '#1b1f28', fore: '#f3d6bd', pants: '#232833', boots: '#15181f', eye: '#c9563f', weapon: 'claws', energy: '#ff5f8a', energy2: '#ffd0dd' },
  moves: {
    nlight: mv('Straight Jab', 'punch', 17, 3, [H(3, 7, 34, -48, 52, 32, 6, 38, 3.2, 2.0, { fx: 'blunt' })], { trail: 'hand', vfx: 'cursedFist', chains: cN([3, 15]) }),
    nlight2: mv('Cursed Straight', 'punch', 20, 3, [H(3, 6, 38, -46, 56, 36, 5, 40, 3.0, 1.8, { fx: 'blunt' }), H(9, 12, 40, -46, 60, 40, 6, 46, 4.2, 3.0, { fx: 'dark', g: 1 })], { trail: 'hand', vfx: 'cursedFist', chains: cN2([3, 18]) }),
    nlight3: mv('Cursed Combo', 'uppercut', 26, 4, [H(4, 9, 36, -58, 62, 76, 8, 80, 5.4, 5.2, { fx: 'blunt' }), H(13, 17, 38, -58, 66, 80, 6, 86, 6.0, 6.6, { fx: 'dark', g: 1 })], { vfx: 'cursedFist' }),
    nlight_spec: mv('Cursed Palm Burst', 'punch', 28, 5, [H(5, 12, 44, -44, 72, 54, 15, 34, 7.0, 8.0, { fx: 'dark' })], { vel: [[5, 14, 0]], trail: 'hand', vfx: 'blackFlash' }),
    nlight_heavy: mv('Rising Divergent', 'uppercut', 30, 5, [H(5, 13, 26, -68, 70, 94, 11, 88, 6.8, 8.0, { fx: 'blunt' }), H(17, 20, 26, -60, 72, 86, 5, 86, 4.0, 4.0, { fx: 'dark', g: 1 })], { vel: [[5, 2, -12]], vfx: 'cursedFist' }),
    slight: mv('Rush Step', 'thrust', 21, 4, [H(4, 8, 44, -44, 66, 38, 7, 28, 4.0, 2.4, { fx: 'blunt' })], { vel: [[3, 12, null], [10, 2, null]], vfx: 'cursedFist', chains: cS([4, 17]) }),
    slight2: mv('Elbow Crush', 'punch', 21, 3, [H(3, 8, 46, -44, 68, 46, 8, 34, 5.0, 4.0, { fx: 'blunt' })], { trail: 'hand', vfx: 'cursedFist', chains: cS2([3, 17]) }),
    slight_spec: mv('Cursed Front Kick', 'kick', 28, 4, [H(4, 14, 48, -50, 78, 82, 11.5, 76, 6.4, 7.0, { fx: 'blunt' })], { vel: [[4, 15, -7]], trail: 'foot', vfx: 'cursedFist' }),
    slight_heavy: mv('Cursed Smash', 'slam', 32, 6, [H(6, 14, 56, -40, 100, 78, 14, 42, 7.6, 9.0, { fx: 'dark' })], { vfx: 'blackFlash' }),
    dlight: mv('Low Sweep', 'sweep', 21, 4, [H(4, 9, 38, -10, 62, 28, 7, 72, 4.0, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'cursedFist', chains: cD([4, 17]) }),
    dlight2: mv('Rising Knee', 'uppercut', 22, 4, [H(4, 10, 26, -58, 60, 78, 9, 86, 5.8, 4.8, { fx: 'blunt' })], { vel: [[4, 1, -10]], vfx: 'cursedFist' }),
    dlight_spec: mv('Ground Crusher', 'slam', 28, 5, [H(5, 14, 46, -22, 98, 62, 11.5, 66, 6.6, 7.2, { fx: 'dark' })], { vfx: 'blackFlash' }),
    nair: mv('Air Spin Kick', 'flip', 22, 4, [H(4, 11, 6, -48, 92, 88, 7, 78, 3.5, 2.2, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cursedFist', chains: cA([4, 18]) }),
    nair2: mv('Falling Fist', 'slam', 24, 4, [H(4, 12, 24, -18, 68, 62, 9, -50, 4.6, 3.7, { fx: 'blunt' })], { land: true, vel: [[4, 1, 9]], vfx: 'cursedFist' }),
    nair_spec: mv('Air Black Flash', 'punch', 28, 5, [H(5, 13, 44, -42, 74, 56, 14, 36, 6.8, 7.6, { fx: 'dark' })], { vfx: 'blackFlash' }),
    sair: mv('Air Straight', 'punch', 20, 4, [H(4, 9, 44, -44, 62, 42, 7, 30, 3.8, 2.6, { fx: 'blunt' })], { land: true, trail: 'hand', vfx: 'cursedFist', chains: cSA([4, 17]) }),
    sair2: mv('Air Hook', 'punch', 22, 4, [H(4, 11, 48, -42, 68, 48, 8.5, 34, 5.0, 4.2, { fx: 'blunt' })], { land: true, trail: 'hand', vfx: 'cursedFist' }),
    sair_spec: mv('Air Manji Kick', 'kick', 26, 5, [H(5, 14, 52, -44, 82, 62, 11, 44, 6.4, 7.0, { fx: 'blunt' })], { vel: [[5, 14, -3]], trail: 'foot', vfx: 'cursedFist' }),
    dair: mv('Diving Stomp', 'dkick', 26, 5, [H(5, 15, 8, -6, 48, 46, 9, -56, 3.7, 2.1, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cursedFist' }),
    nsig: mv('Rising Black Flash', 'uppercut', 44, 13, [H(13, 20, 24, -66, 82, 104, 17, 86, 7.4, 9.4, { fx: 'dark' })], { vfx: 'blackFlash' }),
    ssig: mv('Divergent Charge', 'thrust', 46, 13, [H(13, 20, 54, -44, 100, 60, 14, 38, 6.8, 9.0, { fx: 'blunt' }), H(26, 30, 56, -44, 104, 64, 7, 42, 5.0, 6.0, { fx: 'dark', g: 1 })], { vel: [[11, 9, null], [22, 1, null]], vfx: 'blackFlash' }),
    dsig: mv('Cursed Quake', 'slam', 48, 15, [H(15, 22, 48, -20, 168, 66, 16, 64, 7.2, 9.0, { fx: 'dark' })], { vfx: 'blackFlash' }),
    rec: mv('Cursed Ascent', 'rise', 36, 5, MULTI(5, 20, 10, -52, 80, 94, 3.0, 8, 82, 5.8, 7.6, 'blunt', 5), { turns: 2, grav: 0.4, vel: [[5, 2, -14.6]], vfx: 'cursedFist' }),
    gp: mv('Cursed Drop', 'dkick', 40, 7, [H(7, 32, 30, -12, 70, 58, 12, -54, 5.6, 7.8, { fx: 'dark' })], { land: true, vel: [[7, 0, 19]], vfx: 'blackFlash' }),
    nspec: mv('Black Flash', 'punch', 34, 8, [H(8, 16, 46, -44, 84, 62, 17, 34, 7.2, 8.4, { fx: 'dark' })],
      { cd: 155, grav: 0.2, vel: [[0, 0, 0], [8, 21, 0], [17, 2, null]], trail: 'hand', vfx: 'blackFlash', desc: 'Warps cursed energy at the instant of impact — a distortion-cracking blow.' }),
    sspec: mv('Manji Kick', 'kick', 32, 6, [H(6, 16, 50, -50, 84, 88, 12.5, 76, 6.6, 7.4, { fx: 'blunt' })],
      { cd: 140, grav: 0.3, vel: [[0, 0, 0], [6, 18, -8], [17, 3, null]], trail: 'foot', vfx: 'cursedFist', desc: 'A soaring reverse kick that carries both fighters into the air.' }),
    dspec: mv('Divergent Guard', 'counter', 38, 2, [], { cd: 158, counter: [2, 22], invuln: [2, 22], vfx: 'cursedFist', desc: 'Eats the hit, then returns it twice — an instant blow and a delayed one.',
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); f.facing = a.x > f.x ? 1 : -1; f.invuln = 18; g.flashScreen('#ff5f8a', 0.3); g.applyHit(f, a, { dmg: 10, ang: 42, kb: 5.4, sc: 6.4, fx: 'blunt' }, f.facing, a.x, a.y - 42); const tgt = a; setTimeout(() => { try { if (tgt.alive) g.applyHit(f, tgt, { dmg: 8, ang: 46, kb: 6.6, sc: 7.6, fx: 'dark' }, f.facing, tgt.x, tgt.y - 42); } catch { /* ignore */ } }, 260); f.moveFrame = 26; } }),
    ult: dTransform("Sukuna's Vessel", 'SUKUNA AWAKENS', 'The King of Curses surfaces — markings blaze and every strike turns lethal.', 'devil', '#ff2a4a', 'blackFlash', 620),
  },
  ai: { horizSpec: 'nspec', counterSpec: 'dspec', ultRange: 380 } }),

// ---------------- DEKU : air mobility ----------------
mk({ id: 'deku', name: 'Izuku Midoriya', anime: 'My Hero Academia', title: 'One For All', tier: 'A', color: '#4fd07a',
  desc: 'Green lightning Full Cowl. Unmatched air mobility, quick smash launchers and finger-flick shockwaves at range.',
  stats: ST(7.3, 7.2, 14.3, 0.92, 0.93, 0.58), bars: BR(4, 5, 4, 3),
  look: { skin: '#f3d6bd', hair: '#2f7f4f', hairStyle: 'messy', top: '#1f6f4a', top2: '#f2f2f6', sleeve: '#1f6f4a', fore: '#f3d6bd', pants: '#1a2430', boots: '#e23a3a', cape: '#2a7a54', capeLen: 30, eye: '#3fbf6a', weapon: 'claws', energy: '#8dffb0', energy2: '#d8ffe6', ninjaRun: true, mark: 'mask' },
  moves: {
    nlight: mv('Full Cowl Jab', 'punch', 16, 3, [H(3, 6, 32, -48, 50, 30, 5.5, 38, 3.1, 1.9, { fx: 'elec' })], { trail: 'hand', vfx: 'cowlSpark', chains: cN([3, 14]) }),
    nlight2: mv('Detroit Combo', 'punch', 17, 3, [H(3, 6, 36, -46, 54, 34, 6.5, 44, 3.6, 2.3, { fx: 'elec' })], { trail: 'hand', vfx: 'cowlSpark', chains: cN2([3, 15]) }),
    nlight3: mv('Smash Flurry', 'uppercut', 24, 4, [H(4, 12, 34, -60, 62, 78, 9, 84, 5.8, 6.6, { fx: 'elec' })], { vfx: 'smashShock' }),
    nlight_spec: mv('Delaware Smash', 'cast', 24, 4, [H(4, 12, 62, -44, 116, 48, 9.5, 32, 6.2, 6.8, { fx: 'elec' })], { vfx: 'airForce' }),
    nlight_heavy: mv('Detroit Smash', 'uppercut', 30, 5, [H(5, 13, 26, -68, 74, 94, 12, 88, 7.2, 8.4, { fx: 'elec' })], { vel: [[5, 2, -13]], vfx: 'smashShock' }),
    slight: mv('Shoot Style Step', 'kick', 20, 4, [H(4, 8, 44, -44, 66, 40, 7, 28, 4.0, 2.4, { fx: 'blunt' })], { vel: [[3, 12, null], [10, 2, null]], trail: 'foot', vfx: 'cowlSpark', chains: cS([4, 16]) }),
    slight2: mv('Manchester Kick', 'flip', 22, 3, [H(3, 10, 40, -52, 72, 82, 8.5, 72, 5.2, 4.4, { fx: 'blunt' })], { trail: 'foot', vfx: 'cowlSpark', chains: cS2([3, 17]) }),
    slight_spec: mv('St. Louis Smash', 'kick', 26, 4, [H(4, 14, 52, -48, 88, 78, 11.5, 60, 6.8, 7.4, { fx: 'elec' })], { vel: [[4, 16, -3]], trail: 'foot', vfx: 'smashShock' }),
    slight_heavy: mv('Texas Smash', 'thrust', 32, 6, [H(6, 14, 66, -44, 124, 62, 14, 36, 7.6, 8.8, { fx: 'elec' })], { vfx: 'airForce' }),
    dlight: mv('Low Shoot Sweep', 'sweep', 20, 4, [H(4, 9, 40, -10, 66, 28, 6.5, 72, 4.0, 1.9, { fx: 'blunt' })], { trail: 'foot', vfx: 'cowlSpark', chains: cD([4, 16]) }),
    dlight2: mv('Rising Smash', 'uppercut', 22, 3, [H(3, 10, 26, -58, 62, 80, 9, 86, 5.8, 4.8, { fx: 'elec' })], { vel: [[3, 1, -11]], vfx: 'smashShock' }),
    dlight_spec: mv('Missouri Smash', 'slam', 26, 5, [H(5, 14, 46, -22, 98, 62, 11, 66, 6.6, 7.2, { fx: 'elec' })], { vfx: 'smashShock' }),
    nair: mv('Air Shoot Spin', 'flip', 21, 3, [H(3, 11, 6, -48, 92, 88, 7, 78, 3.5, 2.2, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cowlSpark', chains: cA([3, 17]) }),
    nair2: mv('Falling Smash', 'slam', 23, 4, [H(4, 12, 24, -18, 68, 62, 9, -52, 4.6, 3.7, { fx: 'elec' })], { land: true, vel: [[4, 1, 10]], vfx: 'smashShock' }),
    nair_spec: mv('Air Delaware', 'cast', 25, 4, [H(4, 12, 58, -42, 106, 50, 9.5, 36, 6.0, 6.4, { fx: 'elec' })], { vfx: 'airForce' }),
    sair: mv('Air Shoot Kick', 'kick', 19, 3, [H(3, 9, 44, -44, 62, 42, 7, 30, 3.8, 2.6, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cowlSpark', chains: cSA([3, 16]) }),
    sair2: mv('Aerial Combo Kick', 'kick', 21, 3, [H(3, 11, 48, -42, 68, 48, 8.5, 34, 5.0, 4.2, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'cowlSpark' }),
    sair_spec: mv('Air St. Louis', 'kick', 25, 4, [H(4, 14, 54, -46, 86, 72, 11, 52, 6.4, 7.0, { fx: 'elec' })], { vel: [[4, 15, -2]], trail: 'foot', vfx: 'smashShock' }),
    dair: mv('Oklahoma Stomp', 'dkick', 25, 5, [H(5, 14, 8, -6, 48, 46, 9, -58, 3.7, 2.1, { fx: 'elec' })], { land: true, trail: 'foot', vfx: 'cowlSpark' }),
    nsig: mv('Detroit Rising', 'uppercut', 42, 12, [H(12, 19, 24, -68, 84, 108, 15.5, 88, 7.2, 9.2, { fx: 'elec' })], { vfx: 'smashShock' }),
    ssig: mv('Texas Charge', 'thrust', 44, 12, [H(12, 20, 70, -44, 132, 62, 16.5, 36, 7.2, 9.4, { fx: 'elec' })], { vfx: 'airForce' }),
    dsig: mv('Missouri Quake', 'slam', 48, 15, [H(15, 22, 48, -20, 164, 66, 15.5, 64, 7.0, 9.0, { fx: 'elec' })], { vfx: 'smashShock' }),
    rec: mv('Full Cowl Ascent', 'rise', 34, 5, MULTI(5, 20, 10, -52, 78, 94, 2.9, 8, 82, 5.7, 7.4, 'elec', 5), { turns: 2, grav: 0.38, vel: [[5, 2, -15.4]], vfx: 'cowlSpark' }),
    gp: mv('Falling Axe Kick', 'dkick', 38, 7, [H(7, 30, 28, -12, 68, 58, 11.5, -56, 5.4, 7.6, { fx: 'elec' })], { land: true, vel: [[7, 0, 19]], vfx: 'smashShock' }),
    nspec: mv('Delaware Smash: Air Force', 'cast', 38, 10, [], { cd: 162, grav: 0.35, vfx: 'airForce', desc: 'Flicks a finger and fires a compressed bullet of wind pressure.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 10) { g.spawnProj({ owner: f, type: 'fireball', style: 'wind', col: '#d8ffe6', col2: '#8dffb0', x: f.x + f.facing * 46, y: f.y - 46, vx: f.facing * 17, vy: 0, w: 66, h: 70, grow: 1.4, life: 44, dmg: 3.2, rehit: 6, ang: 38, kb: 4.2, sc: 2.8, fx: 'elec', dir: f.facing, fin: { dmg: 11, ang: 40, kb: 7.6, sc: 7.8 } }); sfx('whoosh'); g.shake(6); } } }),
    sspec: mv('Shoot Style Blitz', 'kick', 30, 5, [H(5, 16, 44, -46, 88, 70, 12, 34, 6.2, 7.2, { fx: 'elec' })],
      { cd: 132, grav: 0, vel: [[0, 0, 0], [5, 26, -1], [17, 2, null]], trail: 'foot', vfx: 'cowlSpark', desc: 'Green lightning propels a blistering running kick barrage.' }),
    dspec: mv('Manchester Smash', 'flip', 36, 6, [H(6, 16, 26, -62, 80, 104, 12, 82, 6.2, 7.4, { fx: 'elec' })],
      { cd: 168, grav: 0.5, vel: [[6, 2, -17]], trail: 'foot', vfx: 'smashShock', desc: 'Flips into a rising axe-kick wreathed in One For All.' }),
    ult: dTransform('One For All: 100%', 'ONE FOR ALL — 100%', 'Pushes the quirk to its absolute limit. His body screams; everything breaks.', 'god', '#8dffb0', 'cowlSpark', 560),
  },
  ai: { vertSpec: 'dspec', horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 520 } }),

// ---------------- TODOROKI : ice zoner ----------------
mk({ id: 'todoroki', name: 'Shoto Todoroki', anime: 'My Hero Academia', title: 'Half-Cold Half-Hot', tier: 'A', color: '#9fd8ff',
  desc: 'Builds walls of ice to control space, then punishes with searing flashfire. The strongest pure zoner on the roster.',
  stats: ST(6.2, 6.0, 13.1, 1.04, 0.98, 0.62), bars: BR(4, 2, 5, 4),
  look: { skin: '#f4dcc6', hair: '#f2f6ff', hair2: '#e0402a', hairStyle: 'swept', top: '#1c2430', top2: '#9fd8ff', sleeve: '#1c2430', fore: '#f4dcc6', pants: '#222b38', boots: '#151a22', eye: '#6fd2ff', weapon: 'claws', energy: '#9fd8ff', energy2: '#ff7a3a' },
  moves: {
    nlight: mv('Frost Jab', 'punch', 21, 5, [H(5, 10, 42, -48, 68, 40, 7, 38, 3.4, 2.1, { fx: 'elec' })], { trail: 'hand', vfx: 'iceShards', chains: cN([5, 18]) }),
    nlight2: mv('Flame Palm', 'cast', 22, 4, [H(4, 10, 48, -46, 74, 46, 8, 44, 4.0, 2.5, { fx: 'fire' })], { vfx: 'flashfire', chains: cN2([4, 19]) }),
    nlight3: mv('Elemental Flurry', 'cast', 30, 5, MULTI(5, 20, 52, -44, 96, 76, 2.6, 9.5, 48, 6.4, 7.4, 'elec', 4), { vfx: 'iceShards' }),
    nlight_spec: mv('Heat Wave', 'cast', 30, 6, [H(6, 16, 62, -44, 124, 64, 11, 32, 6.4, 7.2, { fx: 'fire' })], { vfx: 'flashfire' }),
    nlight_heavy: mv('Ice Pillar Upper', 'castUp', 34, 6, [H(6, 16, 32, -72, 84, 122, 13, 86, 7.4, 8.6, { fx: 'elec' })], { vfx: 'iceSpires' }),
    slight: mv('Glacier Step', 'thrust', 24, 5, [H(5, 10, 54, -44, 86, 42, 8, 28, 4.2, 2.5, { fx: 'elec' })], { vel: [[4, 9, null], [12, 2, null]], vfx: 'iceShards', chains: cS([5, 20]) }),
    slight2: mv('Flashfire Kick', 'kick', 24, 4, [H(4, 10, 58, -42, 90, 52, 9, 34, 5.0, 4.2, { fx: 'fire' })], { trail: 'foot', vfx: 'flashfire', chains: cS2([4, 20]) }),
    slight_spec: mv('Heat Palm', 'thrust', 30, 5, [H(5, 16, 62, -44, 112, 66, 12.5, 36, 7.0, 7.8, { fx: 'fire' })], { vel: [[5, 18, 0]], vfx: 'flashfire' }),
    slight_heavy: mv('Wall of Flames', 'slam', 36, 7, [H(7, 18, 66, -38, 126, 86, 14.5, 44, 7.6, 9.0, { fx: 'fire' })], { vfx: 'flashfire' }),
    dlight: mv('Frost Sweep', 'sweep', 23, 5, [H(5, 10, 44, -10, 74, 28, 7.5, 72, 4.2, 1.9, { fx: 'elec' })], { trail: 'foot', vfx: 'iceShards', chains: cD([5, 19]) }),
    dlight2: mv('Rising Glacier', 'castUp', 25, 5, [H(5, 13, 34, -62, 78, 100, 9.5, 86, 5.8, 5.2, { fx: 'elec' })], { vfx: 'iceSpires' }),
    dlight_spec: mv('Permafrost Burst', 'slam', 30, 6, [H(6, 16, 52, -22, 126, 64, 11.5, 66, 6.6, 7.2, { fx: 'elec' })], { vfx: 'iceSpires' }),
    nair: mv('Air Frost Spin', 'spin', 24, 5, [H(5, 12, 0, -42, 108, 92, 7.5, 64, 3.6, 2.2, { fx: 'elec' })], { land: true, turns: 2, vfx: 'iceShards', chains: cA([5, 20]) }),
    nair2: mv('Falling Ember', 'dive', 25, 4, [H(4, 13, 26, -18, 76, 66, 9.5, -50, 4.6, 3.8, { fx: 'fire' })], { land: true, vel: [[4, 2, 9]], vfx: 'flashfire' }),
    nair_spec: mv('Air Heat Wave', 'cast', 28, 5, [H(5, 14, 56, -42, 104, 58, 10.5, 36, 6.2, 6.6, { fx: 'fire' })], { vfx: 'flashfire' }),
    sair: mv('Air Ice Kick', 'kick', 22, 5, [H(5, 10, 48, -44, 72, 44, 7.5, 32, 4.0, 2.6, { fx: 'elec' })], { land: true, trail: 'foot', vfx: 'iceShards', chains: cSA([5, 19]) }),
    sair2: mv('Air Flame Hook', 'punch', 24, 4, [H(4, 12, 52, -42, 80, 52, 9, 36, 5.0, 4.4, { fx: 'fire' })], { land: true, trail: 'hand', vfx: 'flashfire' }),
    sair_spec: mv('Air Flashfire', 'thrust', 28, 5, [H(5, 15, 58, -40, 100, 62, 11.5, 38, 6.6, 7.2, { fx: 'fire' })], { vel: [[5, 14, 0]], vfx: 'flashfire' }),
    dair: mv('Glacier Stomp', 'dkick', 28, 6, [H(6, 16, 10, -6, 54, 48, 9.5, -56, 3.8, 2.2, { fx: 'elec' })], { land: true, trail: 'foot', vfx: 'iceShards' }),
    nsig: mv('Ice Pillar', 'castUp', 46, 14, [H(14, 22, 34, -84, 88, 164, 16, 86, 7.2, 9.2, { fx: 'elec' })], { vfx: 'iceSpires' }),
    ssig: mv('Flashfire Charge', 'thrust', 46, 14, [H(14, 22, 66, -44, 128, 66, 16.5, 38, 7.2, 9.4, { fx: 'fire' })], { vfx: 'flashfire' }),
    dsig: mv('Permafrost Quake', 'slam', 50, 16, [H(16, 24, 50, -22, 182, 70, 16, 62, 7.2, 9.0, { fx: 'elec' })], { vfx: 'iceSpires' }),
    rec: mv('Ice Ramp Ascent', 'rise', 38, 6, MULTI(6, 21, 12, -52, 84, 98, 3.0, 8, 82, 5.8, 7.6, 'elec', 5), { turns: 1, grav: 0.44, vel: [[6, 2, -14]], vfx: 'iceShards' }),
    gp: mv('Glacier Drop', 'slam', 42, 8, [H(8, 34, 26, -22, 94, 64, 12.5, -60, 5.6, 7.8, { fx: 'elec' })], { land: true, vel: [[8, 0, 19]], vfx: 'iceSpires' }),
    nspec: mv('Ice Wall Barrage', 'cast', 46, 14, [], { cd: 178, grav: 0.35, vfx: 'iceSpires', desc: 'Erupts a racing wall of glacial spikes that grows as it travels.',
      onFrame: (f: any, fr: number, g: any) => { if (fr === 14) { g.spawnProj({ owner: f, type: 'fireball', style: 'ice', col: '#9fd8ff', col2: '#eafaff', x: f.x + f.facing * 56, y: f.y - 40, vx: f.facing * 11, vy: 0, w: 90, h: 96, grow: 2.2, life: 54, dmg: 3.2, rehit: 7, ang: 62, kb: 4.0, sc: 2.4, fx: 'elec', dir: f.facing, fin: { dmg: 11, ang: 60, kb: 7.4, sc: 7.6 } }); sfx('whoosh'); g.shake(7); } } }),
    sspec: mv('Flashfire Fist', 'thrust', 32, 7, [H(7, 17, 44, -43, 94, 66, 13, 30, 6.4, 7.4, { fx: 'fire' })],
      { cd: 148, grav: 0, vel: [[0, 0, 0], [7, 23, 0], [18, 2, null]], vfx: 'flashfire', desc: 'Ignites his left side and charges through with searing heat.' }),
    dspec: mv('Heaven-Piercing Ice', 'slam', 46, 14, [H(14, 24, 40, -40, 190, 130, 15, 72, 7.2, 8.8, { fx: 'elec' })],
      { cd: 196, vfx: 'iceSpires', desc: 'Freezes the ground and detonates an enormous glacier around himself.' }),
    ult: dBeam('Flashfire Inferno', 'FLASHFIRE INFERNO', 'Unleashes both quirks at once in a roaring column of fire and frost.', '#ff9a3a', 'fire', 'fire', 'flashfire'),
  },
  ai: { zoneSpec: 'nspec', horizSpec: 'sspec', ultRange: 700 } }),

// ---------------- EREN : heavy bruiser ----------------
mk({ id: 'eren', name: 'Eren Yeager', anime: 'Attack on Titan', title: 'The Attack Titan', tier: 'A', color: '#c39a5a',
  desc: 'Titan-hardened fists and pure rage. Heavy armour on his swings means he can trade through weaker attacks.',
  stats: ST(6.2, 5.9, 12.9, 1.2, 1.04, 0.63), bars: BR(5, 2, 3, 5),
  look: { skin: '#eccdae', hair: '#3a2a1c', hairStyle: 'ponytail', top: '#5a4632', top2: '#c39a5a', sleeve: '#5a4632', fore: '#e6e2d6', pants: '#e6e2d6', boots: '#3a2616', cape: '#2f6a44', capeLen: 34, eye: '#4f9a86', weapon: 'claws', energy: '#ffd9a0', energy2: '#ffffff' },
  moves: {
    nlight: mv('Titan Jab', 'punch', 22, 5, [H(5, 10, 38, -48, 60, 38, 8.5, 38, 3.6, 2.4, { fx: 'blunt' })], { trail: 'hand', vfx: 'steamBurst', chains: cN([5, 19]) }),
    nlight2: mv('Hardened Hook', 'punch', 23, 5, [H(5, 10, 44, -46, 66, 44, 9.5, 44, 4.2, 2.8, { fx: 'blunt' })], { trail: 'hand', vfx: 'steamBurst', chains: cN2([5, 19]) }),
    nlight3: mv('Rage Flurry', 'uppercut', 30, 5, MULTI(5, 20, 40, -56, 74, 84, 2.8, 11, 82, 6.4, 7.4, 'blunt', 4), { vfx: 'steamBurst' }),
    nlight_spec: mv('Steam Burst', 'cast', 30, 6, [H(6, 16, 50, -44, 104, 88, 11.5, 60, 6.6, 7.4, { fx: 'blunt' })], { vfx: 'steamBurst' }),
    nlight_heavy: mv('Titan Uppercut', 'uppercut', 34, 6, [H(6, 16, 28, -70, 78, 102, 13.5, 86, 7.4, 8.6, { fx: 'blunt' })], { vel: [[6, 2, -12]], vfx: 'hardenCrack' }),
    slight: mv('Charging Shoulder', 'thrust', 26, 6, [H(6, 12, 48, -44, 80, 54, 9.5, 28, 4.4, 2.8, { fx: 'blunt' })], { vel: [[4, 10, null], [13, 2, null]], vfx: 'steamBurst', chains: cS([6, 21]) }),
    slight2: mv('Crushing Hook', 'punch', 26, 5, [H(5, 12, 54, -42, 86, 54, 10.5, 34, 5.4, 4.6, { fx: 'blunt' })], { trail: 'hand', vfx: 'steamBurst', chains: cS2([5, 21]) }),
    slight_spec: mv('Hardening Charge', 'thrust', 32, 6, [H(6, 18, 56, -44, 100, 68, 13, 36, 7.0, 7.8, { fx: 'blunt' })], { vel: [[6, 21, 0]], invuln: [6, 16], vfx: 'hardenCrack' }),
    slight_heavy: mv('Titan Smash', 'slam', 38, 8, [H(8, 18, 62, -40, 118, 84, 15.5, 42, 7.8, 9.2, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    dlight: mv('Low Stomp', 'sweep', 24, 5, [H(5, 11, 42, -10, 70, 28, 8.5, 74, 4.2, 2.1, { fx: 'blunt' })], { trail: 'foot', vfx: 'steamBurst', chains: cD([5, 20]) }),
    dlight2: mv('Rising Titan Fist', 'uppercut', 25, 5, [H(5, 12, 30, -58, 70, 80, 10, 86, 6.0, 5.2, { fx: 'blunt' })], { vel: [[5, 1, -10]], vfx: 'steamBurst' }),
    dlight_spec: mv('Ground Rupture', 'slam', 32, 6, [H(6, 16, 50, -22, 130, 64, 12, 66, 6.8, 7.4, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    nair: mv('Air Titan Spin', 'spin', 25, 5, [H(5, 12, 0, -42, 108, 94, 8.5, 64, 3.8, 2.4, { fx: 'blunt' })], { land: true, turns: 1, vfx: 'steamBurst', chains: cA([5, 20]) }),
    nair2: mv('Falling Hammer Fist', 'slam', 26, 5, [H(5, 14, 26, -18, 78, 66, 10, -50, 4.8, 3.9, { fx: 'blunt' })], { land: true, vel: [[5, 1, 9]], vfx: 'steamBurst' }),
    nair_spec: mv('Air Steam Burst', 'cast', 28, 6, [H(6, 15, 48, -42, 96, 76, 10.5, 50, 6.2, 6.6, { fx: 'blunt' })], { vfx: 'steamBurst' }),
    sair: mv('Air Titan Kick', 'kick', 23, 5, [H(5, 11, 46, -44, 68, 44, 8.5, 30, 4.0, 2.7, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'steamBurst', chains: cSA([5, 19]) }),
    sair2: mv('Air Crushing Hook', 'punch', 25, 5, [H(5, 12, 52, -42, 78, 52, 10, 34, 5.2, 4.5, { fx: 'blunt' })], { land: true, trail: 'hand', vfx: 'steamBurst' }),
    sair_spec: mv('Air Hardening Strike', 'thrust', 28, 6, [H(6, 16, 56, -40, 96, 62, 11.5, 38, 6.6, 7.2, { fx: 'blunt' })], { vel: [[6, 14, 0]], vfx: 'hardenCrack' }),
    dair: mv('Titan Stomp', 'dkick', 28, 6, [H(6, 16, 10, -6, 56, 50, 10, -56, 3.9, 2.4, { fx: 'blunt' })], { land: true, trail: 'foot', vfx: 'steamBurst' }),
    nsig: mv('Rising Fury', 'uppercut', 46, 14, [H(14, 22, 26, -68, 88, 112, 17, 86, 7.4, 9.4, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    ssig: mv('Charging Titan', 'thrust', 48, 14, [H(14, 22, 58, -44, 118, 68, 17.5, 38, 7.4, 9.6, { fx: 'blunt' })], { vel: [[12, 8, null], [24, 1, null]], vfx: 'hardenCrack' }),
    dsig: mv('Earth Shatter', 'slam', 52, 17, [H(17, 25, 50, -22, 186, 72, 17, 62, 7.2, 9.2, { fx: 'blunt' })], { vfx: 'hardenCrack' }),
    rec: mv('Steam Ascent', 'rise', 38, 6, MULTI(6, 21, 12, -52, 86, 98, 3.2, 8.5, 82, 5.9, 7.7, 'blunt', 5), { turns: 1, grav: 0.44, vel: [[6, 2, -14]], vfx: 'steamBurst' }),
    gp: mv('Titan Drop', 'slam', 42, 8, [H(8, 34, 26, -22, 96, 66, 13.5, -60, 5.8, 8.0, { fx: 'blunt' })], { land: true, vel: [[8, 0, 19]], vfx: 'hardenCrack' }),
    nspec: mv('Hardening Slam', 'slam', 46, 14, [H(14, 24, 44, -24, 194, 80, 17, 62, 7.4, 9.2, { fx: 'blunt' })],
      { cd: 190, vfx: 'hardenCrack', desc: 'Crystallises both fists and shatters the ground with a single strike.' }),
    sspec: mv('Titan Charge', 'thrust', 34, 7, [H(7, 19, 48, -44, 96, 70, 14.5, 30, 6.6, 7.8, { fx: 'blunt' })],
      { cd: 152, grav: 0, invuln: [7, 18], vel: [[0, 0, 0], [7, 25, 0], [20, 2, null]], vfx: 'steamBurst', desc: 'Barrels forward shoulder-first with unstoppable momentum.' }),
    dspec: mv('Hardened Guard', 'counter', 38, 2, [], { cd: 162, counter: [2, 24], invuln: [2, 24], vfx: 'steamBurst', desc: 'Crystallised skin eats the blow, then answers with a haymaker.',
      onCounter: (f: any, a: any, g: any) => { sfx('counter'); f.facing = a.x > f.x ? 1 : -1; f.invuln = 20; g.flashScreen('#ffd9a0', 0.3); g.fx.impact(a.x, a.y - 42, 96, '#ffd9a0'); g.applyHit(f, a, { dmg: 15.5, ang: 42, kb: 7.6, sc: 8.6, fx: 'blunt' }, f.facing, a.x, a.y - 42); f.moveFrame = 26; } }),
    ult: dMeteor('Attack Titan Rampage', 'THE ATTACK TITAN', 'Transforms in a pillar of lightning and crashes down with titanic force.', '#ffd9a0', 'blunt', 'steamBurst'),
  },
  ai: { horizSpec: 'sspec', counterSpec: 'dspec', ultRange: 360 } }),

// ---------------- DENJI : grinder ----------------
mk({ id: 'denji', name: 'Denji', anime: 'Chainsaw Man', title: 'The Chainsaw Devil', tier: 'A', color: '#ff9d1f',
  desc: 'Roaring chainsaws that grind rather than strike — his moves tick constant damage and refuse to let go.',
  stats: ST(6.7, 6.2, 13.4, 1.05, 0.96, 0.62), bars: BR(5, 3, 4, 3),
  look: { skin: '#f2d2b0', hair: '#e8c23a', hairStyle: 'messy', top: '#2a2a32', top2: '#ff9d1f', sleeve: '#f2f2f6', fore: '#f2d2b0', pants: '#22252e', boots: '#15171d', eye: '#f2c53d', weapon: 'chainsaw', energy: '#ff9d1f', energy2: '#ff3a3a' },
  moves: {
    nlight: mv('Chainsaw Swipe', 'slash', 22, 5, [H(5, 12, 48, -46, 82, 56, 4, 40, 2.6, 1.4, { fx: 'dark', rehit: 4 })], { vfx: 'sawGrind', chains: cN([5, 19]) }),
    nlight2: mv('Grinding Cut', 'backslash', 24, 4, [H(4, 16, 52, -44, 88, 58, 2.6, 46, 2.0, 1.0, { fx: 'dark', rehit: 3 })], { vfx: 'sawGrind', chains: cN2([4, 21]) }),
    nlight3: mv('Shredder Finish', 'spin', 32, 5, MULTI(5, 24, 50, -44, 96, 78, 2.2, 11, 46, 6.6, 7.6, 'dark', 3), { turns: 3, vfx: 'bloodSpray' }),
    nlight_spec: mv('Rev Burst', 'thrust', 30, 5, [H(5, 20, 54, -44, 96, 60, 3.0, 32, 2.2, 1.2, { fx: 'dark', rehit: 3 }), H(21, 24, 56, -44, 100, 64, 9, 34, 6.6, 7.4, { fx: 'dark', g: 1 })], { vel: [[5, 14, 0]], vfx: 'sawGrind' }),
    nlight_heavy: mv('Rising Saw', 'upslash', 34, 6, [H(6, 16, 30, -70, 86, 100, 13, 86, 7.4, 8.6, { fx: 'dark' })], { vel: [[6, 2, -12]], vfx: 'bloodSpray' }),
    slight: mv('Chainsaw Rush', 'thrust', 26, 5, [H(5, 16, 56, -43, 92, 44, 3.2, 28, 2.4, 1.2, { fx: 'dark', rehit: 3 })], { vel: [[4, 9, null], [17, 2, null]], vfx: 'sawGrind', chains: cS([5, 21]) }),
    slight2: mv('Cross Shred', 'slash', 26, 4, [H(4, 14, 60, -44, 96, 60, 3.4, 36, 2.6, 1.6, { fx: 'dark', rehit: 3 })], { vfx: 'sawGrind', chains: cS2([4, 21]) }),
    slight_spec: mv('Throttle Lunge', 'spin', 34, 5, MULTI(5, 26, 54, -44, 104, 72, 2.4, 10, 38, 7.0, 7.8, 'dark', 3), { turns: 3, vel: [[5, 15, 0]], vfx: 'sawGrind' }),
    slight_heavy: mv('Devil Cleave', 'slam', 36, 7, [H(7, 17, 64, -40, 118, 82, 15, 42, 7.6, 9.0, { fx: 'dark' })], { vfx: 'bloodSpray' }),
    dlight: mv('Low Saw Sweep', 'lowslash', 25, 5, [H(5, 15, 46, -12, 88, 30, 3.2, 72, 2.4, 1.2, { fx: 'dark', rehit: 3 })], { vfx: 'sawGrind', chains: cD([5, 21]) }),
    dlight2: mv('Rising Shred', 'upslash', 25, 4, [H(4, 12, 32, -60, 76, 86, 9.5, 86, 5.8, 5.0, { fx: 'dark' })], { vel: [[4, 2, -10]], vfx: 'bloodSpray' }),
    dlight_spec: mv('Ground Grinder', 'slam', 32, 5, [H(5, 22, 50, -20, 124, 60, 2.8, 66, 2.2, 1.2, { fx: 'dark', rehit: 3 }), H(23, 26, 52, -20, 128, 64, 10, 64, 6.6, 7.2, { fx: 'dark', g: 1 })], { vfx: 'sawGrind' }),
    nair: mv('Air Saw Spin', 'spin', 26, 5, [H(5, 18, 0, -42, 118, 96, 2.6, 64, 2.0, 1.1, { fx: 'dark', rehit: 3 })], { land: true, turns: 3, vfx: 'sawGrind', chains: cA([5, 22]) }),
    nair2: mv('Falling Shred', 'dive', 26, 4, [H(4, 14, 26, -18, 78, 66, 9.5, -50, 4.8, 3.8, { fx: 'dark' })], { land: true, vel: [[4, 2, 9]], vfx: 'bloodSpray' }),
    nair_spec: mv('Air Rev Burst', 'thrust', 28, 5, [H(5, 16, 50, -42, 88, 58, 3.0, 36, 2.2, 1.2, { fx: 'dark', rehit: 3 }), H(17, 20, 52, -42, 92, 62, 8, 38, 6.2, 6.6, { fx: 'dark', g: 1 })], { vfx: 'sawGrind' }),
    sair: mv('Air Saw Slash', 'slash', 24, 5, [H(5, 12, 50, -44, 86, 58, 4.2, 32, 3.0, 1.8, { fx: 'dark', rehit: 4 })], { land: true, vfx: 'sawGrind', chains: cSA([5, 20]) }),
    sair2: mv('Air Cross Shred', 'backslash', 25, 4, [H(4, 13, 54, -42, 90, 58, 5, 36, 4.2, 3.4, { fx: 'dark', rehit: 4 })], { land: true, vfx: 'sawGrind' }),
    sair_spec: mv('Air Full Throttle', 'spin', 28, 5, MULTI(5, 20, 52, -40, 96, 70, 2.4, 9, 38, 6.6, 7.2, 'dark', 3), { turns: 2, vel: [[5, 14, 0]], vfx: 'sawGrind' }),
    dair: mv('Plunging Saw', 'dive', 30, 6, [H(6, 20, 32, -10, 72, 56, 2.8, -52, 2.2, 1.2, { fx: 'dark', rehit: 3 })], { land: true, vel: [[6, 4, 11]], vfx: 'sawGrind' }),
    nsig: mv('Skyward Shred', 'upslash', 46, 14, MULTI(14, 26, 28, -72, 92, 124, 3.0, 12, 86, 7.2, 9.2, 'dark', 3), { vfx: 'bloodSpray' }),
    ssig: mv('Chainsaw Charge', 'thrust', 48, 14, MULTI(14, 28, 60, -44, 118, 64, 2.8, 12.5, 38, 7.2, 9.4, 'dark', 3), { vel: [[12, 7, null], [29, 1, null]], vfx: 'sawGrind' }),
    dsig: mv('Revving Quake', 'slam', 50, 16, MULTI(16, 28, 50, -22, 176, 70, 2.8, 12, 62, 7.2, 9.0, 'dark', 3), { vfx: 'bloodSpray' }),
    rec: mv('Saw Ascent', 'rise', 38, 6, MULTI(6, 22, 12, -52, 86, 96, 2.6, 8, 82, 5.8, 7.6, 'dark', 4), { turns: 2, grav: 0.44, vel: [[6, 2, -14]], vfx: 'sawGrind' }),
    gp: mv('Buzzsaw Drop', 'dive', 42, 8, [H(8, 34, 26, -20, 88, 62, 3.0, -58, 2.4, 1.4, { fx: 'dark', rehit: 3 })], { land: true, vel: [[8, 2, 19]], vfx: 'sawGrind' }),
    nspec: mv('Blood Whirl', 'spin', 54, 8, MULTI(8, 44, 0, -44, 136, 108, 2.2, 10.5, 50, 7.0, 8.8, 'dark', 3),
      { turns: 6, cd: 190, grav: 0.28, vel: [[8, 6, null], [46, 1, null]], vfx: 'bloodSpray', desc: 'Spins with both saws howling, dragging foes into the teeth.' }),
    sspec: mv('Full Throttle', 'thrust', 34, 6, [H(6, 24, 46, -43, 96, 64, 2.8, 30, 2.2, 1.2, { fx: 'dark', rehit: 3 }), H(25, 28, 48, -43, 100, 68, 11, 34, 6.8, 7.8, { fx: 'dark', g: 1 })],
      { cd: 142, grav: 0, vel: [[0, 0, 0], [6, 22, 0], [25, 2, null]], vfx: 'sawGrind', desc: 'Revs to maximum and tears straight through whatever is in the way.' }),
    dspec: mv('Ground Massacre', 'slam', 46, 14, MULTI(14, 30, 46, -22, 190, 74, 2.6, 12, 62, 7.2, 9.0, 'dark', 3),
      { cd: 194, vfx: 'bloodSpray', desc: 'Drives both saws into the earth, spraying debris and blood everywhere.' }),
    ult: dTransform('Chainsaw Devil', 'CHAINSAW DEVIL', 'Pulls the cord — full devil form with monstrous reach and grinding power.', 'devil', '#ff3a3a', 'bloodSpray', 640),
  },
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 380 } }),
];

CHARACTERS.push(SUKUNA, SHADOW_DIO, GOKU_BLACK, GOKU_UI, GASTER, DOFLAMINGO);
// The one word (or two) the HUD plate and the select grid print. First names
// where fans use them, surnames where they do not, and a distinguishing word
// wherever two fighters would otherwise share one.
const SHORT: Record<string, string> = {
  goku: 'Goku', rengoku: 'Rengoku', luffy: 'Luffy', zoro: 'Zoro', gojo: 'Gojo', deku: 'Deku', todoroki: 'Todoroki',
  sukuna: 'Sukuna', shadowdio: 'DIO', gokublack: 'Goku Black', goku_ui: 'Goku UI', yuji: 'Yuji', killua: 'Killua',
};
for (const ch of CHARACTERS) if (SHORT[ch.id]) ch.short = SHORT[ch.id];
// Every fighter's awakened kit is authored (see awakenKits.ts); the generated
// template only survives as the scaffolding it replaces.
installAwakenedKits(CHARACTERS);
applySignatures(CHARACTERS);
for (const c of CHARACTERS) {
  if (c.id !== 'sukuna' && c.id !== 'gojo') continue;
  installBossKit(c.id, c.look, c.moves);
  const m = c.moves;
  c.abilities = [
    { key: 'L · Neutral', name: m.nspec.name!, desc: m.nspec.desc! },
    { key: 'Side + L', name: m.sspec.name!, desc: m.sspec.desc! },
    { key: 'Down + L', name: m.dspec.name!, desc: m.dspec.desc! },
    { key: 'Air + L', name: m.aspec!.name!, desc: m.aspec!.desc! },
    { key: 'R · Awaken (full gauge)', name: m.naw.name!, desc: `${m.naw.desc} The gauge drains from full to empty over about thirty seconds; at zero the Awakening ends.` },
    { key: 'AWAKENED · J · Light', name: m.nwl.name!, desc: m.nwl.desc! },
    { key: 'AWAKENED · K · Heavy', name: m.nwh.name!, desc: m.nwh.desc! },
    { key: 'AWAKENED · L · Finisher', name: m.boss_finisher!.name!, desc: m.boss_finisher!.desc! },
  ];
  c.moveBranches = [
    { input: 'J → J → J', name: m.nlight3.name!, desc: 'Tap and release each key during the follow-up window. Neutral stance.' },
    { input: 'J → L / K', name: 'Technique or launcher', desc: m.nlight_spec.name + ' / ' + m.nlight_heavy.name },
    { input: 'K → K → L', name: m.boss_finisher!.name!, desc: 'Land the first heavy, tap Heavy again, land the second, then tap L while AWAKENED. Watch the Combo Coach.' },
    { input: 'R, then J / K / L', name: 'The awakened kit', desc: 'Spend a full gauge to Awaken. Every attack button becomes a different move until the gauge runs out.' },
  ];
  if (c.id === 'gojo') c.passives = [{ name: 'Six Eyes', desc: 'Neutral Awaken briefly accelerates movement and cooldown recovery. Blue pulls and Red repels; Void controls a bounded area.' }];
}

// Art direction runs last so it also reaches the boss kits. Sukuna is skipped
// inside the module, so his art is exactly as authored.
applyArtDirection(CHARACTERS);


/** Snapshot of the built-in roster (used by the character builder as source kits). */
export const BASE_CHARACTERS: CharDef[] = CHARACTERS.slice();

/** The single word a HUD plate or a select tile prints for a fighter. */
export const shortName = (c: { name: string; short?: string }) => (c.short || c.name.split(' ')[0]).toUpperCase();

export const charById = (id: string) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
