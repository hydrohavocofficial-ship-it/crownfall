/**
 * GOKU BLACK (Super Saiyan Rosé) — Dragon Ball Super.
 *
 * Design notes
 *  - Ethereal magenta Ki blade (God Split Cut) that gives sword-like disjoint to bare-handed attacks.
 *  - Super Saiyan Rosé aura with dark violet divine lightning accents.
 *  - Signature moves: Black Kamehameha, Divine Lasso, Holy Light Grenade, and Scythe of Sorrow.
 */
import { sfx } from './audio';
import { makePortrait } from './portraits';
import { installTechniques } from './techniques';
import type { CharDef, CoreMoveKey, MoveKey } from './characters';
import type { AnimName, HitDef, MoveDef } from './types';
import type { Look } from './render';

const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, extra: Partial<HitDef> = {}): HitDef => ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, ...extra });
const MULTI = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, fin: number, ang: number, kb: number, sc: number, fx: HitDef['fx'], rehit = 4): HitDef[] => [
  H(f0, f1, x, y, w, h, dmg, 80, 1.6, 0, { rehit, pull: true, fx, g: 0 }),
  H(f1 + 1, f1 + 4, x, y, w * 1.08, h * 1.08, fin, ang, kb, sc, { fx, g: 1 }),
];
const mv = (name: string, anim: AnimName, dur: number, startup: number, hits: HitDef[], options: Partial<MoveDef> = {}): MoveDef => ({ name, anim, dur, startup, hits, ...options });

// chain link helpers
const cN = (w: [number, number]) => ({ light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cN2 = (w: [number, number]) => ({ light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cS = (w: [number, number]) => ({ light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cS2 = (w: [number, number]) => ({ special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cD = (w: [number, number]) => ({ light: 'dlight2', special: 'dlight_spec', window: w });
const cA = (w: [number, number]) => ({ light: 'nair2', special: 'nair_spec', window: w });
const cSA = (w: [number, number]) => ({ light: 'sair2', special: 'sair_spec', window: w });

const ROSE_PINK = '#f472b6';
const ROSE_AURA = '#ec4899';
const DIVINE_PURPLE = '#8b5cf6';
const GI_GRAY = '#374151';

const look: Look = {
  skin: '#f3d1b0', hair: ROSE_PINK, hair2: '#db2777', hairStyle: 'spikeLong',
  top: GI_GRAY, top2: '#1f2937', sleeve: '#111827', fore: '#f3d1b0', pants: GI_GRAY, boots: '#f3f4f6',
  eye: '#f472b6', weapon: 'katana', mark: 'none',
  energy: ROSE_AURA, energy2: DIVINE_PURPLE, ninjaRun: false,
  pose: 'swordsman', idle: 'float', run: 'dash', eyeStyle: 'sharp', accent: ROSE_PINK,
  build: { shoulder: 1.15, chest: 1.08, limb: 1.1, head: 1.0, torso: 1.1, hip: 1.0 },
};

const lights: Record<CoreMoveKey, MoveDef> = {
  nlight: mv('Ki Blade Thrust', 'thrust', 20, 4, [H(4, 11, 48, -44, 82, 48, 4, 38, 2.4, 1.2, { fx: 'purple' })], { vfx: 'kiCut', chains: cN([4, 18]) }),
  nlight2: mv('God Split Slicer', 'slash', 22, 4, [H(4, 13, 52, -46, 88, 56, 3.8, 44, 2.2, 1.2, { fx: 'purple' })], { vfx: 'kiCut', chains: cN2([4, 19]) }),
  nlight3: mv('Divine Piercing Strike', 'spin', 30, 5, MULTI(5, 22, 54, -46, 96, 72, 2.2, 10, 44, 6.4, 7.4, 'purple', 3), { turns: 2, vfx: 'kiExplode' }),
  nlight_spec: mv('Instant Slicer', 'thrust', 28, 4, [H(4, 16, 56, -44, 92, 56, 3.2, 34, 2.2, 1.2, { fx: 'purple', rehit: 3 }), H(17, 20, 58, -44, 98, 62, 8.5, 36, 6.4, 7.2, { fx: 'purple', g: 1 })], { vel: [[4, 14, 0]], vfx: 'kiCut' }),
  nlight_heavy: mv('Violent God Launcher', 'upslash', 32, 5, [H(5, 15, 32, -68, 84, 96, 12.5, 86, 7.2, 8.4, { fx: 'purple' })], { vel: [[5, 2, -11]], vfx: 'kiExplode' }),

  slight: mv('Rosé Slicer Rush', 'thrust', 24, 5, [H(5, 14, 54, -43, 88, 44, 3.4, 30, 2.2, 1.2, { fx: 'purple', rehit: 3 })], { vel: [[4, 8, null], [15, 2, null]], vfx: 'kiCut', chains: cS([5, 19]) }),
  slight2: mv('Divine Cross Cleave', 'backslash', 24, 4, [H(4, 13, 58, -44, 92, 58, 3.6, 36, 2.4, 1.4, { fx: 'purple', rehit: 3 })], { vfx: 'kiCut', chains: cS2([4, 19]) }),
  slight_spec: mv('Fierce Blade Flurry', 'spin', 32, 5, MULTI(5, 24, 52, -44, 102, 68, 2.2, 9.5, 36, 6.8, 7.6, 'purple', 3), { turns: 2, vel: [[5, 13, 0]], vfx: 'kiExplode' }),
  slight_heavy: mv('Heavenly Divine Cleave', 'slam', 34, 6, [H(6, 16, 62, -40, 114, 80, 14, 42, 7.4, 8.8, { fx: 'purple' })], { vfx: 'kiExplode' }),

  dlight: mv('Low Ki Slicer', 'lowslash', 22, 4, [H(4, 13, 44, -12, 84, 28, 3.2, 70, 2.2, 1.2, { fx: 'purple', rehit: 3 })], { vfx: 'kiCut', chains: cD([4, 18]) }),
  dlight2: mv('Rising God Edge', 'upslash', 24, 4, [H(4, 12, 30, -58, 74, 84, 9, 86, 5.6, 4.8, { fx: 'purple' })], { vel: [[4, 2, -9]], vfx: 'kiExplode' }),
  dlight_spec: mv('Earth Piercing Needles', 'slam', 30, 5, [H(5, 20, 48, -18, 120, 56, 2.6, 64, 2.0, 1.2, { fx: 'purple', rehit: 3 }), H(21, 24, 50, -18, 124, 60, 9.5, 62, 6.4, 7.0, { fx: 'purple', g: 1 })], { vfx: 'kiCut' }),

  nair: mv('Spinning Rosé Cleave', 'spin', 24, 4, [H(4, 16, 0, -42, 114, 92, 2.5, 62, 2.0, 1.1, { fx: 'purple', rehit: 3 })], { land: true, turns: 2, vfx: 'kiCut', chains: cA([4, 20]) }),
  nair2: mv('Falling God Slicer', 'dive', 24, 4, [H(4, 13, 26, -18, 76, 64, 9, -50, 4.6, 3.6, { fx: 'purple' })], { land: true, vel: [[4, 2, 8]], vfx: 'kiExplode' }),
  nair_spec: mv('Aerial Instant Thrust', 'thrust', 26, 4, [H(4, 14, 48, -42, 86, 56, 2.8, 34, 2.0, 1.2, { fx: 'purple', rehit: 3 }), H(15, 18, 50, -42, 90, 60, 7.5, 36, 6.0, 6.4, { fx: 'purple', g: 1 })], { vfx: 'kiCut' }),

  sair: mv('Aerial Ki Blade Slash', 'slash', 22, 4, [H(4, 11, 48, -42, 84, 56, 3.8, 32, 2.8, 1.6, { fx: 'purple', rehit: 3 })], { land: true, vfx: 'kiCut', chains: cSA([4, 18]) }),
  sair2: mv('Aerial Divine Cross', 'backslash', 23, 4, [H(4, 12, 52, -40, 88, 56, 4.6, 34, 4.0, 3.2, { fx: 'purple', rehit: 3 })], { land: true, vfx: 'kiCut' }),
  sair_spec: mv('Aerial God Flurry', 'spin', 26, 5, MULTI(5, 18, 50, -38, 92, 68, 2.2, 8.5, 36, 6.4, 7.0, 'purple', 3), { turns: 2, vel: [[5, 13, 0]], vfx: 'kiCut' }),

  dair: mv('Divine Punishment', 'dive', 28, 5, [H(5, 18, 30, -10, 70, 54, 2.6, -54, 2.0, 1.2, { fx: 'purple', rehit: 3 })], { land: true, vel: [[5, 3, 10]], vfx: 'kiExplode' }),

  nsig: mv('Fierce God Slicer Burst', 'upslash', 44, 12, MULTI(12, 24, 28, -70, 90, 120, 2.8, 11.5, 86, 7.0, 9.0, 'purple', 3), { vfx: 'kiExplode' }),
  ssig: mv('Divine God Thrust', 'thrust', 46, 12, MULTI(12, 26, 58, -42, 114, 62, 2.6, 12, 36, 7.0, 9.2, 'purple', 3), { vel: [[10, 6, null], [27, 1, null]], vfx: 'kiCut' }),
  dsig: mv('Divine Rupture', 'slam', 48, 14, MULTI(14, 26, 48, -20, 170, 68, 2.6, 11.5, 60, 7.0, 8.8, 'purple', 3), { vfx: 'kiExplode' }),
  rec: mv('Instant Transmission Ascent', 'rise', 36, 5, MULTI(5, 20, 12, -50, 84, 92, 2.4, 7.5, 82, 5.6, 7.4, 'purple', 4), { turns: 2, grav: 0.42, vel: [[5, 2, -13]], vfx: 'kiCut' }),
  gp: mv('Falling God Edge', 'dive', 40, 7, [H(7, 32, 24, -18, 86, 60, 2.8, -56, 2.2, 1.2, { fx: 'purple', rehit: 3 })], { land: true, vel: [[7, 2, 18]], vfx: 'kiExplode' }),

  nspec: mv('Black Kamehameha', 'thrust', 50, 12, MULTI(12, 38, 56, -44, 160, 80, 2.4, 10.5, 42, 6.8, 8.4, 'purple', 3),
    { cd: 180, grav: 0.25, vfx: 'kiExplode', desc: 'Channels divine ki and fires a concentrated Black Kamehameha wave.' }),
  sspec: mv('Divine Lasso', 'thrust', 32, 5, [H(5, 22, 50, -42, 94, 62, 2.8, 28, 2.2, 1.2, { fx: 'purple', rehit: 3 }), H(23, 26, 52, -42, 98, 66, 11, 32, 6.6, 7.6, { fx: 'purple', g: 1 })],
    { cd: 140, grav: 0, vel: [[0, 0, 0], [5, 20, 0], [23, 2, null]], vfx: 'kiCut', desc: 'Rushes forward impaling the target with a radiant blade, detonating energy needles.' }),
  dspec: mv('Holy Light Grenade', 'slam', 44, 12, MULTI(12, 28, 44, -20, 180, 72, 2.5, 11.5, 60, 7.0, 8.8, 'purple', 3),
    { cd: 190, vfx: 'kiExplode', desc: 'Calls down divine orbs of light that rupture the earth around him.' }),
  ult: {
    name: 'Scythe of Sorrow', ult: 'SCYTHE OF SORROW',
    desc: 'Tears open the rift of sorrow with the giant Rosé Scythe, cleaving space and reality.',
    dur: 54, startup: 22, anim: 'castUp', invuln: [0, 42], grav: 0.2, vfx: 'kiExplode', cin: 46,
    hits: [H(22, 32, 0, -42, 340, 250, 12, 60, 7.4, 6.4, { fx: 'purple' })],
    onFrame: (f: any, fr: number, g: any) => {
      if (fr < 22) {
        if (fr % 2 === 0) {
          const a = Math.random() * 6.28, k = fr / 22, r = 90 - k * 68;
          g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 42 + Math.sin(a) * r * .7, vx: -Math.cos(a) * (2 + k * 5), vy: -Math.sin(a) * (2 + k * 5) - 1, color: fr % 4 ? ROSE_AURA : '#ffffff', kind: 'glow', life: 16, size: 4 + k * 8 });
        }
        if (fr % 4 === 0) g.fx.ring(f.x, f.y - 42, 40 + fr * 2.6, 44 + fr * 2.8, ROSE_AURA, 14, 3);
        if (fr % 3 === 0) g.shake(1.5);
        return;
      }
      if (fr === 22) {
        f.godT = 600;
        g.fx.ring(f.x, f.y - 42, 16, 320, ROSE_AURA, 30, 20);
        g.fx.ring(f.x, f.y - 42, 16, 220, '#ffffff', 22, 10);
        g.fx.burst(f.x, f.y - 42, 54, ROSE_AURA, 15, 'glow', 38, 9);
        g.shake(24); g.flashScreen(ROSE_AURA, 0.5); sfx('ult');
        g.fx.text(f.x, f.y - 168, 'SCYTHE OF SORROW', '#ffffff', 30, 66);
      }
    }
  },
};

const generated = installTechniques('gokublack', look, lights) as Record<MoveKey, MoveDef>;

const branches = [
  { input: 'H → H → H', name: `${generated.nlight.name} Chain`, desc: `${generated.nlight.name} → ${generated.nlight2.name} → ${generated.nlight3.name}.` },
  { input: 'H → K', name: generated.nlight_spec.name!, desc: 'Cancels the light string into an Instant Slicer burst.' },
  { input: 'H → J', name: generated.nlight_heavy.name!, desc: 'Launcher finisher that pops foes into juggle range.' },
  { input: '→ H → H / K / J', name: generated.slight2.name!, desc: `${generated.slight.name} extends into ${generated.slight2.name}, ${generated.slight_spec.name} or ${generated.slight_heavy.name}.` },
  { input: '↓ H → H / K', name: generated.dlight2.name!, desc: `${generated.dlight.name} extends into ${generated.dlight2.name} or ${generated.dlight_spec.name}.` },
  { input: 'Air H → H / K', name: generated.nair2.name!, desc: `${generated.nair.name} chains into ${generated.nair2.name} or ${generated.nair_spec.name}.` },
  { input: 'L · N / → / ↓ / Air', name: generated.nex.name!, desc: `Limit Break stances: ${generated.nex.name}, ${generated.sex.name}, ${generated.dex.name}, ${generated.aex.name}.` },
  { input: 'U · N / → / ↓ / Air', name: generated.naw.name!, desc: `Awaken stances: ${generated.naw.name}, ${generated.saw.name}, ${generated.daw.name}, ${generated.aaw.name}.` },
  { input: 'U → K', name: generated.nfu.name!, desc: `K immediately after U performs the awakened variant: ${generated.sfu.name}, ${generated.dfu.name}, ${generated.afu.name}.` },
];

const abilities = [
  { key: 'K · Neutral Special', name: generated.nspec.name!, desc: generated.nspec.desc! },
  { key: 'K · Side Special', name: generated.sspec.name!, desc: generated.sspec.desc! },
  { key: 'K · Down Special', name: generated.dspec.name!, desc: generated.dspec.desc! },
  { key: 'L · Limit Break', name: generated.nex.name!, desc: `${generated.nex.desc} Stances: ${generated.sex.name} / ${generated.dex.name} / ${generated.aex.name}.` },
  { key: 'U · Awaken', name: generated.naw.name!, desc: `${generated.naw.desc} Stances: ${generated.saw.name} / ${generated.daw.name} / ${generated.aaw.name}.` },
  { key: 'U → K · Awakened', name: generated.nfu.name!, desc: `${generated.nfu.desc} Follow-up variants: ${generated.sfu.name}, ${generated.dfu.name}, ${generated.afu.name}.` },
  { key: 'R · ULTIMATE', name: generated.ult.name!, desc: generated.ult.desc! },
];

export const GOKU_BLACK: CharDef = {
  id: 'gokublack', styleId: 'gokublack', name: 'Goku Black', anime: 'Dragon Ball Super', title: 'The God of Despair', tier: 'S', color: ROSE_AURA,
  desc: 'The divine usurper wielding Super Saiyan Rosé. He carves through foes with an ethereal Ki blade, fires piercing Black Kamehameha beams, and tears reality open with the Scythe of Sorrow.',
  portrait: makePortrait('gokublack', look, ROSE_AURA),
  stats: { speed: 7.4, air: 7.6, jump: 14.0, weight: 1.0, scale: 1.02, gravity: 0.6 },
  statBars: { power: 5, speed: 5, range: 4, defense: 4 }, look, moves: generated,
  moveBranches: branches, abilities,
  passives: [
    { name: 'Super Saiyan Rosé', desc: 'Godly ki enhances all blade and ki attacks with vibrant magenta cuts and accelerated frame recovery.' },
    { name: 'God Split Cut', desc: 'Ki manifests as a razor-sharp blade around the hand, granting superior horizontal disjoint and armor pierce.' },
    { name: 'Scythe of Sorrow', desc: 'Ultimate rips open a dimensional tear, dealing devastating multi-hit spatial damage.' },
  ],
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 420 },
};
