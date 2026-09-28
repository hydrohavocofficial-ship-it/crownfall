import { sfx } from './audio';
import { makePortrait } from './portraits';
import { installTechniques } from './techniques';
import { mergeSignatures } from './abilities';
import { cleave } from './vfx';
import type { CharDef, CoreKit, MoveKey } from './characters';
import type { AnimName, HitDef, MoveDef } from './types';

const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, extra: Partial<HitDef> = {}): HitDef => ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, ...extra });
const mv = (name: string, anim: AnimName, dur: number, startup: number, hits: HitDef[], options: Partial<MoveDef> = {}): MoveDef => ({ name, anim, dur, startup, hits, ...options });
const cN = (window: [number, number]) => ({ light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy', window });
const cN2 = (window: [number, number]) => ({ light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy', window });
const cS = (window: [number, number]) => ({ light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy', window });
const cS2 = (window: [number, number]) => ({ special: 'slight_spec', heavy: 'slight_heavy', window });
const cD = (window: [number, number]) => ({ light: 'dlight2', special: 'dlight_spec', window });
const cA = (window: [number, number]) => ({ light: 'nair2', special: 'nair_spec', window });
const cSA = (window: [number, number]) => ({ light: 'sair2', special: 'sair_spec', window });

const look = {
  skin: '#f3d5c2', hair: '#e34b68', hair2: '#7b102d', hairStyle: 'spikeLong' as const,
  top: '#f1e8dc', top2: '#25253f', sleeve: '#dedbd5', fore: '#e9c9b7', pants: '#d0cfda', boots: '#20202c',
  eye: '#ff3857', weapon: 'claws' as const, mark: 'none' as const,
  energy: '#ff2347', energy2: '#ffd0c8', ninjaRun: true,
};

/**
 * Malevolent Shrine is staged as a five-beat sequence rather than a single
 * burst, so the domain reads exactly like the anime's chant:
 *
 *   0.0s  the domain sample starts and Sukuna is rooted and untouchable
 *   3.0s  the shrine itself rises out of a pool of blood
 *   3.5s  the domain opens and dismantles everything inside it
 *   4.0s  the roar fades out of the mix while the cuts keep coming
 *   8.5s  the slashes stop, and the last half-second is the recovery
 */
export const SHRINE_CAST = 30;        // the sample starts here (move startup)
export const SHRINE_RISE = 30;        // frames the shrine takes to materialise
export const SHRINE_APPEAR = SHRINE_CAST + 180;   // +3.0s
export const SHRINE_ACTIVE = SHRINE_CAST + 210;   // +3.5s
export const SHRINE_FADE = SHRINE_CAST + 240;     // +4.0s
export const SHRINE_SLASHES = 300;                // a full five seconds of Dismantle
export const SHRINE_DUR = SHRINE_ACTIVE + SHRINE_SLASHES + 30;
/** The domain's footprint, half again as wide and tall as it used to be. */
export const DOMAIN_W = 1080;
export const DOMAIN_H = 630;

function cleaveProjectile(f: any, g: any, target: any, mode: 'push' | 'rise' | 'grab' = 'push') {
  if (!target) return;
  const dir = Math.sign(target.x - f.x) || f.facing;
  const airborne = !target.grounded || target.y < f.y - 20;
  const x = target.x;
  const y = airborne ? target.y - 42 : target.y - 30;
  g.spawnProj({
    owner: f, type: 'sig', sig: 'sukunaCleave', x, y, vx: 0, vy: 0, w: 88, h: 108,
    life: 28, dmg: mode === 'grab' ? 4.2 : 11, ang: airborne ? -62 : 36, kb: mode === 'grab' ? 2.8 : 7.2, sc: mode === 'grab' ? 1.4 : 7.4,
    stun: airborne ? 16 : 8, fx: 'slash', dir, col: '#ff2749', col2: '#fff0e9', reflectable: false,
    data: { mode, airborne },
  });
}

function setFlash(f: any, g: any, black: boolean) {
  f.sukunaFlash = 24;
  f.sukunaBlackFlash = black;
  g.flashScreen(black ? '#ff174d' : '#b20d25', black ? 0.82 : 0.4);
  g.fx.text(f.x, f.y - 116, black ? 'BLACK FLASH' : 'BLACK FLASH READY', black ? '#ff315d' : '#ff8b98', black ? 30 : 20, 34);
  g.fx.impact(f.x + f.facing * 42, f.y - 44, black ? 98 : 56, black ? '#ff315d' : '#ff9aa5');
  g.shake(black ? 14 : 5);
  sfx(black ? 'purple' : 'swingH');
}

function launchFollowup(f: any, fr: number, g: any) {
  if (fr === 8) f.sukunaLaunchTarget = g.nearestEnemy(f, 145);
  if (fr === 13 && f.sukunaLaunchTarget?.alive) {
    cleaveProjectile(f, g, f.sukunaLaunchTarget, 'rise');
    g.fx.text(f.sukunaLaunchTarget.x, f.sukunaLaunchTarget.y - 105, 'CLEAVE', '#ff5a70', 22, 26);
  }
  if (fr === 15 && f.sukunaLaunchTarget?.alive) {
    g.applyHit(f, f.sukunaLaunchTarget, { dmg: 5.5, ang: 78, kb: 7.2, sc: 8.2, fx: 'slash', stun: 12 }, f.facing, f.sukunaLaunchTarget.x, f.sukunaLaunchTarget.y - 42);
  }
}

function grabSequence(f: any, fr: number, g: any) {
  const t: any = f.sukunaGrabTarget;
  if (fr === 6) {
    f.sukunaGrabTarget = g.nearestEnemy(f, 230);
    if (f.sukunaGrabTarget?.alive) {
      f.x = f.sukunaGrabTarget.x - f.facing * 46; f.y = f.sukunaGrabTarget.y; f.vx = 0; f.vy = 0;
      f.sukunaGrabTarget.state = 'hitstun'; f.sukunaGrabTarget.hitstun = 42; f.sukunaGrabTarget.vx = 0; f.sukunaGrabTarget.vy = 0;
      g.fx.ring(f.sukunaGrabTarget.x, f.sukunaGrabTarget.y - 40, 10, 90, '#ff315d', 16, 6);
      g.fx.text(f.x, f.y - 120, 'FACE GRAB', '#ff5a70', 25, 30);
    }
  }
  if (t?.alive && fr > 8 && fr < 30) {
    t.x = f.x + f.facing * 44; t.y = f.y; t.vx = 0; t.vy = 0; t.state = 'hitstun'; t.hitstun = 48;
    if (fr === 10 || fr === 15 || fr === 20 || fr === 25) {
      cleaveProjectile(f, g, t, 'grab'); g.fx.cut(t.x, t.y - 42, 130, Math.random() * Math.PI, 16, 1);
    }
  }
  if (fr === 33 && t?.alive) {
    g.applyHit(f, t, { dmg: 16, ang: 36, kb: 9.2, sc: 9.8, fx: 'dark', stun: 18 }, f.facing, t.x, t.y - 42);
    g.fx.text(t.x, t.y - 100, 'THROWN', '#ff5a70', 24, 28); g.shake(11); sfx('heavyhit', 2);
    f.sukunaGrabTarget = null;
  }
}

const core: CoreKit = {
  nlight: mv('Cleave', 'slash', 16, 3, [H(3, 6, 42, -47, 58, 44, 5.2, 38, 3.3, 1.8, { fx: 'slash' })], { vfx: 'sukunaCleave', trail: 'hand', chains: cN([3, 14]) }),
  nlight2: mv('Double Cleave', 'slash', 18, 3, [H(3, 6, 44, -47, 64, 46, 5.8, 40, 3.6, 2.1, { fx: 'slash' }), H(8, 11, 48, -47, 70, 48, 6.2, 42, 3.8, 2.4, { fx: 'slash', g: 1 })], { vfx: 'sukunaCleave', trail: 'hand', chains: cN2([3, 15]) }),
  nlight3: mv('Malevolent Slice', 'spin', 25, 4, [H(4, 11, 38, -45, 76, 58, 3.2, 46, 3.1, 2.3, { fx: 'slash', rehit: 3 }), H(12, 16, 42, -45, 84, 62, 8.5, 48, 6.3, 7.3, { fx: 'slash', g: 1 })], { turns: 2, vfx: 'sukunaCleave', trail: 'hand' }),
  nlight_spec: mv('Wrist Cut', 'thrust', 24, 4, [H(4, 12, 48, -45, 76, 46, 9.5, 28, 6.1, 6.8, { fx: 'slash' })], { vel: [[4, 15, 0]], vfx: 'sukunaCleave', trail: 'hand' }),
  nlight_heavy: mv('Rising Cleave', 'upslash', 28, 4, [H(4, 12, 24, -66, 58, 92, 10.5, 86, 6.8, 7.8, { fx: 'slash' })], { vel: [[4, 2, -12]], vfx: 'sukunaCleave', trail: 'hand' }),
  slight: mv('Sudden Strike', 'thrust', 20, 4, [H(4, 8, 52, -44, 78, 44, 6.4, 30, 4, 2.3, { fx: 'slash' })], { vel: [[3, 13, null], [11, 2, null]], vfx: 'sukunaCleave', trail: 'hand', chains: cS([4, 17]) }),
  slight2: mv('Puncture', 'thrust', 21, 3, [H(3, 9, 58, -44, 90, 48, 8.2, 32, 5, 3.5, { fx: 'slash' })], { vel: [[3, 19, null]], vfx: 'sukunaCleave', trail: 'hand', chains: cS2([3, 17]) }),
  slight_spec: mv('Shoulder Rend', 'slash', 27, 5, [H(5, 14, 60, -45, 102, 58, 11, 38, 6.8, 7.8, { fx: 'slash' })], { vel: [[5, 22, 0]], vfx: 'sukunaCleave', trail: 'hand' }),
  slight_heavy: mv('Gut Cleave', 'slash', 31, 6, [H(6, 14, 64, -45, 110, 62, 13, 40, 7.3, 8.6, { fx: 'slash' })], { vel: [[6, 20, null]], vfx: 'sukunaCleave', trail: 'hand' }),
  dlight: mv('Leg Sweep', 'sweep', 21, 4, [H(4, 10, 40, -12, 76, 28, 6.2, 76, 4.2, 1.9, { fx: 'slash' })], { vel: [[3, 12, null], [11, 2, null]], vfx: 'sukunaCleave', trail: 'foot', chains: cD([4, 17]) }),
  dlight2: mv('Crescent Sweep', 'lowslash', 23, 3, [H(3, 10, 38, -12, 92, 30, 8.4, 78, 5.4, 4.7, { fx: 'slash' })], { vel: [[3, 2, 0]], vfx: 'sukunaCleave', trail: 'foot' }),
  dlight_spec: mv('Underworld Cut', 'slam', 27, 5, [H(5, 14, 44, -18, 104, 42, 10.5, 70, 6.4, 7, { fx: 'slash' })], { vfx: 'sukunaCleave', trail: 'foot' }),
  nair: mv('Heavenward Backflip', 'flip', 28, 4, [
    H(4, 11, 30, -46, 78, 74, 5.6, 64, 3.4, 1.9, { fx: 'slash', g: 0, rehit: 5 }),
    H(12, 19, 42, -24, 96, 104, 8.8, -64, 5.4, 3.6, { fx: 'slash', g: 1 })],
    { land: true, turns: 1, grav: .34, vel: [[4, 3, -7], [15, 1, 5]], vfx: 'sukunaCleave', trail: 'foot', chains: cA([4, 18]),
      desc: 'A genuine backflip: Sukuna kicks off, whips a black crescent straight down through whatever is underneath him, and comes out of the rotation facing the way he started.',
      onFrame: (f: any, fr: number, g: any) => {
        if (fr !== 12) return;
        // The slash that follows the flip: a long vertical aerial Dismantle
        // driven straight down past his own feet — the one place the crescent
        // sweep belongs.
        const x = f.x + f.facing * 26, y = f.y - 10;
        cleave(g, x, y - 34, 132, Math.PI / 2, 1.6, 0, true);
        g.fx.directional(x, y, 6, Math.PI / 2, .5, '#ff2749', 13, 'streak', 14, 3);
        g.fx.ring(x, y, 6, 54, '#ff315d', 14, 4);
        g.shake(4);
      } }),
  nair2: mv('Falling Cut', 'dive', 24, 4, [H(4, 12, 28, -20, 70, 62, 8.6, -50, 4.8, 4, { fx: 'slash' })], { land: true, vel: [[4, 3, 12]], vfx: 'sukunaCleave' }),
  nair_spec: mv('Air Cleave', 'slash', 25, 4, [H(4, 13, 48, -42, 86, 50, 9.4, 34, 6.1, 6.7, { fx: 'slash' })], { land: true, vfx: 'sukunaCleave', trail: 'hand' }),
  sair: mv('Sudden Strike', 'thrust', 20, 3, [H(3, 9, 52, -44, 82, 46, 6.8, 30, 4.1, 2.4, { fx: 'slash' })], { land: true, vel: [[3, 16, null]], vfx: 'sukunaCleave', trail: 'hand', chains: cSA([3, 16]) }),
  sair2: mv('Air Pierce', 'thrust', 22, 4, [H(4, 11, 58, -44, 94, 48, 8.8, 30, 5.2, 4.2, { fx: 'slash' })], { land: true, vfx: 'sukunaCleave', trail: 'hand' }),
  sair_spec: mv('Cursed Cleave', 'spin', 26, 4, [H(4, 14, 50, -42, 100, 64, 10, 38, 6.2, 7, { fx: 'slash', rehit: 3 })], { land: true, turns: 2, vfx: 'sukunaCleave' }),
  dair: mv('Cursed Dive', 'dive', 26, 5, [H(5, 15, 30, -14, 62, 54, 8.4, -54, 4.6, 3.6, { fx: 'slash' })], { land: true, vel: [[5, 4, 12]], vfx: 'sukunaCleave' }),
  nsig: mv('Elbow Launcher', 'uppercut', 48, 7, [H(7, 14, 48, -48, 78, 70, 8.5, 80, 6.5, 7.4, { fx: 'slash' })], { vfx: 'sukunaCleave', onFrame: (f, fr, g) => launchFollowup(f, fr, g) }),
  ssig: mv('Throat Drag', 'thrust', 48, 5, [H(5, 10, 56, -44, 82, 56, 7, 34, 5.2, 5.8, { fx: 'dark' })], { vfx: 'sukunaCleave', onFrame: (f, fr, g) => grabSequence(f, fr, g) }),
  dsig: mv('Upward Cleave', 'upslash', 48, 9, [H(9, 15, 36, -66, 90, 86, 9, 84, 6.8, 7.8, { fx: 'slash' })], { vfx: 'sukunaCleave', onFrame: (f, fr, g) => { const t = g.nearestEnemy(f, 170); if (fr === 16) cleaveProjectile(f, g, t, 'rise'); } }),
  rec: mv('Cursed Recovery', 'rise', 36, 5, [H(5, 18, 18, -56, 76, 96, 7.2, 80, 5.8, 6.8, { fx: 'slash', rehit: 4 })], { turns: 2, grav: .4, vel: [[5, 2, -15]], vfx: 'sukunaCleave' }),
  gp: mv('Malevolent Slam', 'dive', 40, 7, [H(7, 30, 30, -22, 82, 66, 11, -60, 6.2, 7.4, { fx: 'slash' })], { land: true, vel: [[7, 4, 18]], vfx: 'sukunaCleave' }),
  nspec: mv('Cleave Wedge', 'cast', 34, 6, [], { cd: 138, ability: 'special', stance: 'neutral', vfx: 'sukunaCleave', onFrame: (f, fr, g) => { if (fr === 6) cleaveProjectile(f, g, g.nearestEnemy(f, 300) || { x: f.x + f.facing * 150, y: f.y, grounded: true }, 'push'); } }),
  sspec: mv('Face Slam', 'thrust', 48, 5, [H(5, 10, 56, -44, 84, 58, 7, 34, 5.2, 5.8, { fx: 'dark' })], { cd: 168, ability: 'special', stance: 'side', vfx: 'sukunaCleave', onFrame: (f, fr, g) => grabSequence(f, fr, g) }),
  dspec: mv('Black Flash Primer', 'punch', 34, 8, [H(8, 14, 50, -46, 78, 54, 8, 34, 6.2, 7.2, { fx: 'dark' })], { cd: 150, ability: 'special', stance: 'down', vfx: 'sukunaBlackFlash', onFrame: (f, fr, g) => { if (fr === 8 && !f.sukunaBlackFlash) setFlash(f, g, false); if (fr === 8 && f.sukunaBlackFlash) setFlash(f, g, true); } }),
  ult: mv('Malevolent Shrine', 'castUp', SHRINE_DUR, SHRINE_CAST, [], {
    ability: 'awakened', stance: 'neutral',
    invuln: [0, SHRINE_ACTIVE], vfx: 'sukunaShrine', cin: 110,
    desc: 'Domain Expansion. Sukuna chants alone for three seconds — rooted and untouchable — then the Malevolent Shrine rises and Dismantles everything inside a domain half again as wide as it used to be, five seconds of cuts on a roar that fades out one second in.',
    onFrame: (f: any, fr: number, g: any) => {
      // Rooted for the whole cast: the domain is opened standing perfectly still.
      f.vx = 0;
      if (fr === SHRINE_CAST) {
        g.fx.text(f.x, f.y - 182, 'DOMAIN EXPANSION', '#ff4765', 26, 74);
        g.fx.ring(f.x, f.y, 12, 300, '#ff2347', 30, 14);
        g.fx.directional(f.x, f.y - 30, 10, -Math.PI / 2, .9, '#ff2749', 15, 'streak', 22, 3);
        g.flashScreen('#18020a', .34);
      }
      // The chant: cursed energy spirals inward while the sample runs alone.
      if (fr > SHRINE_CAST && fr < SHRINE_ACTIVE && fr % 4 === 0) {
        const a = Math.random() * 6.28, r = 34 + Math.random() * 96;
        g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 46 + Math.sin(a) * r * .8, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3 - 1, color: Math.random() < .55 ? '#ff2347' : '#ffd4cb', kind: 'glow', life: 22, size: 4 + Math.random() * 6 });
      }
      if (fr === SHRINE_APPEAR) {
        // The shrine arrives: a full domain, anchored on the floor beneath him.
        const floor = g.groundBelow(f.x, f.y) ?? f.y;
        g.spawnProj({
          owner: f, type: 'sig', sig: 'sukunaShrine',
          x: f.x, y: floor - DOMAIN_H / 2, vx: 0, vy: 0,
          w: DOMAIN_W, h: DOMAIN_H, life: SHRINE_SLASHES + SHRINE_RISE + 40,
          delay: SHRINE_RISE, activeFor: SHRINE_SLASHES, rehit: 12,
          dmg: 1.6, ang: 70, kb: 1.1, sc: 0, fx: 'dark',
          dir: f.facing, col: '#ff2749', col2: '#fff0e9', behind: true, data: { domain: true },
        });
        g.fx.text(f.x, f.y - 206, 'MALEVOLENT SHRINE', '#ff4765', 32, 90);
      }
      // Four seconds in, the roar clears the mix — the cutting does not stop.
      if (fr === SHRINE_FADE) g.fadeDomainVoice(2.2);
      if (fr > SHRINE_ACTIVE && fr % 30 === 0) g.shake(5);
    },
  }),
};

// The Shrine is lifted out of the move table before the tree is installed: it is
// not a move any more, it is the neutral awakened special's raw material, and
// the technique builder re-homes it at half power with a shorter cast.
const merged = mergeSignatures('sukuna', core);
const SHRINE = merged.domain!;
const generated = installTechniques('sukuna', look, merged.moves, SHRINE) as Record<MoveKey, MoveDef> & Record<string, MoveDef>;
// These are intentionally Sukuna-only aerial extensions. They are kept out of the
// shared MoveKey union so every existing character retains its original move count.
generated.aspec = mv('Fuga', 'flip', 42, 7, [], { ability: 'special', stance: 'air', land: true, turns: 1, cd: 175, vfx: 'sukunaFuga', desc: 'Sukuna flips through the air, charges a fire arrow, and detonates it against the ground.', onFrame: (f, fr, g) => {
  if (fr === 7) g.spawnProj({ owner: f, type: 'sig', sig: 'sukunaFuga', x: f.x + f.facing * 40, y: f.y - 18, vx: f.facing * 8, vy: 8, w: 76, h: 76, ground: true, life: 55, dmg: 14, ang: 72, kb: 7.2, sc: 8.2, fx: 'fire', dir: f.facing, col: '#ff5a24', col2: '#ffe09a' });
} });
generated.aig = mv('Phantom Rush', 'thrust', 38, 5, [H(5, 15, 54, -44, 92, 56, 9.5, 34, 6.6, 7.4, { fx: 'dark' })], { stance: 'air', land: true, invuln: [0, 24], vel: [[5, 24, -2]], vfx: 'sukunaPhantom', desc: 'Sukuna vanishes into a storm of afterimage cleaves and reappears behind the target.' });

const branches = [
  { input: 'J → J → J', name: `${generated.nlight.name} Chain`, desc: `${generated.nlight.name} → ${generated.nlight2.name} → ${generated.nlight3.name}.` },
  { input: 'J → L', name: generated.nlight_spec.name!, desc: 'Cancels the light string into a signature EX burst.' },
  { input: 'J → K', name: generated.nlight_heavy.name!, desc: 'Launcher finisher that pops foes into juggle range.' },
  { input: '→ J → J / L / K', name: generated.slight2.name!, desc: `${generated.slight.name} extends into ${generated.slight2.name}, ${generated.slight_spec.name} or ${generated.slight_heavy.name}.` },
  { input: '↓ J → J / L', name: generated.dlight2.name!, desc: `${generated.dlight.name} extends into ${generated.dlight2.name} or ${generated.dlight_spec.name}.` },
  { input: 'Air J → J / L', name: generated.nair2.name!, desc: `${generated.nair.name} chains into ${generated.nair2.name} or ${generated.nair_spec.name}.` },
  { input: 'L · N / → / ↓ / Air', name: generated.nspec.name!, desc: 'Sukuna has four unique Special stances: Cleave Wedge, Face Slam, Black Flash Primer, and Fuga.' },
  { input: 'R @ full gauge · N / → / ↓ / Air', name: generated.naw.name!, desc: `Spends the whole gauge to Awaken. Direction picks the transformation stance: ${generated.naw.name}, ${generated.saw.name}, ${generated.daw.name}, ${generated.aaw.name}.` },
  { input: 'AWAKENED · J / K / L', name: `${generated.nwl.name} → ${generated.nwh.name} → ${generated.nfu.name}`, desc: 'A whole second kit. The awakened light is faster than anything in his base moveset, the heavy is the launcher, and the special is a Malevolent Shrine at half its old size and strength.' },
];

const abilities = [
  { key: 'L · Neutral Special', name: generated.nspec.name!, desc: generated.nspec.desc! },
  { key: 'L · Forward Special', name: generated.sspec.name!, desc: generated.sspec.desc! },
  { key: 'L · Down Special', name: generated.dspec.name!, desc: generated.dspec.desc! },
  { key: 'L · Aerial Special', name: 'Fuga', desc: generated.aspec.desc! },
  { key: 'R · Awaken (full gauge)', name: generated.naw.name!, desc: `${generated.naw.desc} The gauge drains from full to empty over about fifteen seconds; at zero the Awakening ends.` },
  { key: 'AWAKENED · J · Light', name: generated.nwl.name!, desc: generated.nwl.desc! },
  { key: 'AWAKENED · K · Heavy', name: generated.nwh.name!, desc: generated.nwh.desc! },
  { key: 'AWAKENED · L · Shrine', name: generated.nfu.name!, desc: generated.nfu.desc! },
];

export const SUKUNA: CharDef = {
  id: 'sukuna', styleId: 'sukuna', name: 'Ryomen Sukuna', anime: 'Jujutsu Kaisen', title: 'King of Curses', tier: 'S', color: '#e52345',
  desc: 'The Shibuya-era King of Curses inhabiting Yuji\'s body. Every limb carries a surgical cleave, every impact distorts space, and the Malevolent Shrine turns an entire battlefield into a slaughterhouse.',
  portrait: makePortrait('sukuna', look, '#e52345'),
  stats: { speed: 6.4, air: 6.2, jump: 13.6, weight: .94, scale: 1.02, gravity: .61 },
  statBars: { power: 5, speed: 4, range: 4, defense: 3 }, look, moves: generated, domain: SHRINE,
  moveBranches: branches, abilities,
  passives: [
    { name: 'Cursed Adaptation', desc: 'Sukuna’s cleaves gain extra damage as the target accumulates damage, turning a wounded opponent into a finished execution.' },
    { name: 'Black Flash Reprise', desc: 'During Down Special’s red flash window, pressing Special again upgrades the strike into a devastating Black Flash.' },
    { name: 'Shrine Pressure', desc: 'The Malevolent Shrine still opens slowly and Dismantles a wide domain, but it is now half the size and half the strength, and it is performed from the awakened state on a cooldown rather than bought outright with a full gauge.' },
  ],
  ai: { vertSpec: 'dspec', horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 430 },
};
