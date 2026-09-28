/**
 * GOKU — MASTERED ULTRA INSTINCT (Dragon Ball Super).
 *
 * Design notes
 *  - The whole character is built around one idea: he is not reacting to you, he
 *    is *already* reacting. The autonomous evasion passive (see `Game.tryInstantSlip`)
 *    means his defence is a read, not a resource, and every other system is tuned
 *    around that: fast, floaty, low-commitment normals and extremely long special
 *    startup, so his kit is built to punish a whiff rather than to brawl.
 *  - `hairStyle: 'ui'` is a dedicated renderer: a Saiyan crown that erupts
 *    upward in shimmering platinum locks with a glowing corona, paired with
 *    `eyeStyle: 'glowing'` concentric silver eyes.
 *  - `sleeve: 'none'` gives him bare arms and triggers the defined chest/ab cut,
 *    so the shirtless gi silhouette reads at 60 px tall.
 *  - The Kamehameha is a *sliding* wave that detonates at point-blank range
 *    rather than a far beam: everything about this character is close.
 */
import { sfx } from './audio';
import { makePortrait } from './portraits';
import { installTechniques } from './techniques';
import { mergeSignatures } from './abilities';
import type { CharDef, CoreKit, MoveKey } from './characters';
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

// ---- Ultra Instinct palette -------------------------------------------------
const SILVER = '#f8fafc';       // platinum white - hair core
const PLATINUM = '#93c5fd';     // glowing edge
const ICE = '#e0f2fe';          // beam white
const DEEP = '#60a5fa';         // cold corona
const NEBULA = '#8b5cf6';       // violet outer shell
const KAME = '#e0f2fe';

// The costume is deliberately *identical* to base Goku's. In the anime the
// Mastered form is not a new outfit: it is the same orange gi, the same blue
// belt and boots, the same wristbands - with silver hair and silver eyes. Only
// the hair, the eyes and the aura change. That is the whole read the character
// has to land: a body you have already fought a thousand times, moving like
// something else entirely. Dressing him in a torn navy gi hid the silhouette
// that makes the comparison possible in the first place.
const look: Look = {
  skin: '#f6cfa8', hair: SILVER, hair2: PLATINUM, hairStyle: 'ui',
  top: '#ff7a14', top2: '#1a5ed8', sleeve: '#ff7a14', fore: '#f6cfa8',
  pants: '#ff7a14', boots: '#1a5ed8', eye: '#e2e8f0', weapon: 'fists', mark: 'none',
  energy: SILVER, energy2: DEEP, ninjaRun: false,
  pose: 'brawler', idle: 'float', run: 'dash', eyeStyle: 'glowing', accent: '#a5f3fc',
  build: { shoulder: 1.2, chest: 1.15, limb: 1.05, head: 1.0, torso: 1.1, hip: 1.0 },
};

/** The six star angles of the Supreme Godly Display rush. */
const STAR_ANGLES = [0, 1.047, 2.094, 3.142, 4.189, 5.236];

const lights: CoreKit = {
  // ==========================================================================
  // NEUTRAL — the ghost string. Four frames of startup, invisible fist
  // shockwaves, and a vacuum trail left in the air where each punch used to be.
  // ==========================================================================
  nlight: mv('Ghost Jab', 'jab', 14, 3, [H(3, 6, 40, -46, 60, 44, 4.2, 40, 3.0, 1.6, { fx: 'blunt'})], { vfx: 'uiGhost', chains: cN([3, 12])}),
  nlight2: mv('Silver Phantom Link', 'flurry', 16, 3, [H(3, 7, 44, -46, 66, 48, 4.6, 42, 3.4, 1.9, { fx: 'blunt'})], { vfx: 'uiGhost', chains: cN2([3, 13])}),
  nlight3: mv('Vacuum Fist Barrage', 'flurry', 26, 4, MULTI(4, 20, 46, -48, 78, 70, 1.8, 8.5, 40, 6.4, 7.0, 'blunt', 3), { turns: 3, vfx: 'uiBurst'}),
  nlight_spec: mv('Vacuum Shockwave', 'palm', 24, 4, [
    H(4, 12, 48, -44, 86, 54, 3.2, 34, 2.2, 1.2, { fx: 'blunt', rehit: 3}),
    H(13, 16, 50, -44, 94, 60, 8, 36, 6.2, 7.0, { fx: 'blunt', g: 1}),
  ], { vel: [[4, 12, 0]], vfx: 'uiBurst'}),
  nlight_heavy: mv('Divine Rising Fist', 'uppercut', 32, 5, [H(5, 15, 30, -70, 84, 96, 12, 86, 7.0, 8.2, { fx: 'blunt'})], { vel: [[5, 2, -11]], vfx: 'uiBurst'}),

  // ==========================================================================
  // SIDE — a low slip slide into a point-blank gut strike. The slide is what
  // makes it safe: he is never where the punch started.
  // ==========================================================================
  slight: mv('Slip Slide', 'thrust', 22, 4, [H(4, 9, 48, -14, 76, 32, 4.4, 30, 3.6, 2.0, { fx: 'blunt'})], { vel: [[3, 9, 0]], vfx: 'uiGhost', chains: cS([4, 18])}),
  slight2: mv('Godly Gut Blow', 'palm', 24, 4, [H(4, 12, 54, -40, 90, 54, 4.8, 38, 4.6, 4.0, { fx: 'blunt'})], { vfx: 'uiGhost', chains: cS2([4, 19])}),
  slight_spec: mv('Kinetic Phantom Rush', 'flurry', 30, 5, MULTI(5, 22, 52, -42, 100, 66, 2.2, 9, 36, 6.6, 7.4, 'blunt', 3), { vel: [[5, 14, 0]], vfx: 'uiBurst'}),
  slight_heavy: mv('Point-Blank Detonation', 'slam', 34, 6, [H(6, 16, 60, -40, 116, 80, 13.5, 42, 7.4, 8.8, { fx: 'blunt'})], { vfx: 'uiBurst'}),

  // ==========================================================================
  // DOWN — fluid 360 sweeps that carry silver ki ripples out across the floor.
  // ==========================================================================
  dlight: mv('Low Silver Sweep', 'sweep', 22, 4, [H(4, 12, 46, -14, 86, 32, 4.2, 66, 3.0, 1.8, { fx: 'blunt'})], { vfx: 'uiGhost', chains: cD([4, 18])}),
  dlight2: mv('Rising Silver Tide', 'upslash', 24, 4, [H(4, 12, 30, -60, 76, 86, 8.6, 86, 5.6, 4.8, { fx: 'blunt'})], { vel: [[4, 2, -9]], vfx: 'uiBurst'}),
  dlight_spec: mv('Godly Ripple Cascade', 'slam', 30, 5, [
    H(5, 20, 50, -18, 124, 58, 2.6, 64, 2.0, 1.2, { fx: 'blunt', rehit: 3}),
    H(21, 24, 52, -18, 130, 64, 9, 62, 6.4, 7.0, { fx: 'blunt', g: 1}),
  ], { vfx: 'uiBurst'}),

  // ==========================================================================
  // AERIALS — a spinning energy ring, a sonic-boom cone and a meteor axe kick.
  // ==========================================================================
  nair: mv('Silver Spirit Ring', 'spin', 24, 4, [H(4, 16, 0, -44, 116, 94, 2.6, 62, 2.0, 1.1, { fx: 'blunt', rehit: 3})], { land: true, turns: 2, vfx: 'uiRing', chains: cA([4, 20])}),
  nair2: mv('Falling Spirit Fang', 'dive', 24, 4, [H(4, 13, 26, -18, 76, 64, 8.6, -50, 4.6, 3.6, { fx: 'blunt'})], { land: true, vel: [[4, 2, 8]], vfx: 'uiBurst'}),
  nair_spec: mv('Aerial Phantom Lunge', 'thrust', 26, 4, [
    H(4, 14, 48, -42, 86, 56, 2.8, 34, 2.0, 1.2, { fx: 'blunt', rehit: 3}),
    H(15, 18, 50, -42, 90, 60, 7.2, 36, 6.0, 6.4, { fx: 'blunt', g: 1}),
  ], { vfx: 'uiGhost'}),

  sair: mv('Sonic Boom Fist', 'punch', 22, 4, [H(4, 11, 50, -44, 90, 60, 4.2, 32, 2.8, 1.6, { fx: 'blunt', rehit: 3})], { land: true, vfx: 'uiCone', chains: cSA([4, 18])}),
  sair2: mv('Divine Cross Fist', 'backfist', 23, 4, [H(4, 12, 54, -42, 94, 60, 5.0, 34, 4.0, 3.2, { fx: 'blunt', rehit: 3})], { land: true, vfx: 'uiGhost'}),
  sair_spec: mv('Aerial Phantom Flurry', 'flurry', 26, 5, MULTI(5, 18, 50, -38, 92, 68, 2.2, 8.2, 36, 6.4, 7.0, 'blunt', 3), { turns: 2, vel: [[5, 13, 0]], vfx: 'uiBurst'}),
  dair: mv('Meteor Vacuum Axe Kick', 'axeKick', 28, 5, [H(5, 18, 30, -10, 70, 54, 2.6, -54, 2.0, 1.2, { fx: 'blunt', rehit: 3})], { land: true, vel: [[5, 3, 10]], vfx: 'uiRing'}),

  // ==========================================================================
  // SIGNATURES — the committed heavies.
  // ==========================================================================
  nsig: mv('Divine Spirit Fang', 'upslash', 44, 12, MULTI(12, 24, 28, -70, 90, 120, 2.8, 11, 86, 7.0, 9.0, 'blunt', 3), { vfx: 'uiBurst'}),
  ssig: mv('Godly Piercing Rush', 'thrust', 46, 12, MULTI(12, 26, 58, -42, 114, 62, 2.6, 11.5, 36, 7.0, 9.2, 'blunt', 3), { vel: [[10, 6, null], [27, 1, null]], vfx: 'uiGhost'}),
  dsig: mv('Heavenly Silver Quake', 'slam', 48, 14, MULTI(14, 26, 48, -20, 170, 68, 2.6, 11, 60, 7.0, 8.8, 'blunt', 3), { vfx: 'uiBurst'}),
  rec: mv('Instant Transmission Rise', 'rise', 36, 5, MULTI(5, 20, 12, -50, 84, 92, 2.4, 7.2, 82, 5.6, 7.4, 'blunt', 4), { turns: 2, grav: 0.42, vel: [[5, 2, -13]], vfx: 'uiGhost'}),
  gp: mv('Falling Silver Fang', 'dive', 40, 7, [H(7, 32, 24, -18, 86, 60, 2.8, -56, 2.2, 1.2, { fx: 'blunt', rehit: 3})], { land: true, vel: [[7, 2, 18]], vfx: 'uiBurst'}),

  // ==========================================================================
  // SPECIALS
  // ==========================================================================
  nspec: mv('Divine Sliding Kamehameha', 'cast', 52, 12, MULTI(12, 40, 56, -44, 164, 82, 2.4, 10, 42, 6.8, 8.4, 'blunt', 3), {
    cd: 180, grav: 0.25, sfx: 'ui_beam', vfx: 'uiBeam', quietHits: true,
    desc: 'Lays a silver ki wave along the floor and surfs it forward, detonating at point-blank range.',
    onFrame: (f: any, fr: number, g: any) => {
      // The wave skims the floor. Emitted as `streak`, never `glow`: glow
      // particles are drawn as hard flat discs, and a cluster of them reads as
      // bubbles rather than as light.
      if (fr >= 8 && fr <= 44 && fr % 2 === 0) {
        g.fx.add({
          x: f.x + f.facing * (20 + Math.random() * 90), y: f.y - 6 - Math.random() * 30,
          vx: f.facing * (14 + Math.random() * 10), vy: -1 - Math.random() * 3,
          color: fr % 4 ? KAME : PLATINUM, kind: 'streak', life: 14, size: 5 + Math.random() * 5, drag: 0.97,
        });
      }
      if (fr === 12) { sfx('ui_beam'); g.shake(8); g.fx.bloom(f.x + f.facing * 60, f.y - 44, 70, KAME, 20, 4); }
      // Point-blank detonation on the final active frame.
      if (fr === 40) {
        g.fx.ring(f.x + f.facing * 70, f.y - 44, 14, 260, KAME, 24, 14);
        g.fx.impact(f.x + f.facing * 70, f.y - 44, 130, KAME);
        g.fx.bloom(f.x + f.facing * 70, f.y - 44, 110, ICE, 22, 5);
        g.fx.shock(f.x + f.facing * 70, f.y - 44, 90, PLATINUM, 22);
        g.fx.word(f.x + f.facing * 80, f.y - 118, 'DOGOOON!', KAME, 54, 36);
        g.fx.word(f.x + f.facing * 30, f.y - 158, 'ZASH!', PLATINUM, 42, 30);
        g.distortAt(f.x + f.facing * 70, f.y - 44, 24, 24);
        g.negativeFrames(2);
        g.speedBurst(f.facing > 0 ? 0 : Math.PI, 1.3);
        g.punchIn(f.x + f.facing * 70, f.y - 44, 0.14);
        g.flashScreen(KAME, 0.5); g.shake(22); sfx('ui_ult');
      }
    },
  }),

  sspec: mv('Soaring Fist — Godly Strike', 'thrust', 34, 5, [
    H(5, 24, 50, -42, 96, 64, 2.8, 28, 2.2, 1.2, { fx: 'blunt', rehit: 3}),
    H(25, 28, 52, -42, 102, 70, 10.5, 32, 6.6, 7.6, { fx: 'blunt', g: 1}),
  ], {
    cd: 140, grav: 0, vfx: 'uiRush', sfx: 'ui_punch',
    desc: 'Vanishes forward through three spatial vectors, cleaving the air with high-pressure silver strikes.',
    onFrame: (f: any, fr: number, g: any) => {
      // Three transmission beats: dissolve, reappear ahead, strike.
      for (const beat of [4, 13, 22]) {
        if (fr === beat) {
          g.fx.ring(f.x, f.y - 42, 6, 84, PLATINUM, 16, 5);
          g.fx.bloom(f.x, f.y - 42, 46, SILVER, 14, 3);
          g.fx.directional(f.x, f.y - 42, 10, f.facing > 0 ? Math.PI : 0, .5, '#ffffff', 16, 'streak', 12, 3);
          sfx('ui_slip');
        }
      }
      if (fr === 5 || fr === 14 || fr === 23) f.evadeT = Math.max(f.evadeT, 8);
      if (fr === 28) { g.fx.impact(f.x + f.facing * 50, f.y - 44, 90, KAME); g.shake(10); }
    },
  }),

  dspec: mv('Autonomous Counter — Unbridled Instinct', 'counter', 40, 8, [], {
    cd: 230, vfx: 'uiCounter', sfx: 'ui_chime',
    desc: 'Enters serene stillness. If attacked, he phases behind the foe for an earth-shattering palm thrust.',
    counter: [6, 34],
    onStart: (f: any, g: any) => {
      // The stance is perfect stillness, so any after-image is wiped the moment
      // it opens — the silver shell is what should be moving, not the body.
      f.evadeT = 0;
      f.auraT = Math.max(f.auraT, 40);
      sfx('ui_chime');
      g.fx.ring(f.x, f.y - 42, 10, 90, PLATINUM, 18, 5);
    },
    onFrame: (f: any, fr: number, g: any) => {
      // Serene stillness: a tightening ring of motes and a soft descending chime.
      if (fr < 8) {
        if (fr % 2 === 0) {
          const a = Math.random() * 6.28, r = 74 - fr * 7;
          g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 42 + Math.sin(a) * r * .7, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, color: PLATINUM, kind: 'glow', life: 18, size: 6});
        }
        if (fr === 7) { g.fx.ring(f.x, f.y - 42, 8, 76, SILVER, 16, 4); sfx('ui_chime'); }
      }
      // The window closing is a readable tell.
      if (fr === 34) { g.fx.ring(f.x, f.y - 42, 70, 12, '#a5f3fc', 14, 3); f.auraT = 0; }
    },
    onCounter: (f: any, attacker: any, g: any) => {
      // Phase behind the attacker, then one palm thrust with cinematic weight.
      if (!attacker?.alive) return;
      // Same idiom as the other counter stance in the roster: step to the far
      // side of the attacker, which is what "behind" means from his own facing.
      f.x = attacker.x - attacker.facing * 54;
      f.y = attacker.y;
      f.facing = attacker.x > f.x ? 1 : -1;
      const dir = f.facing;
      f.evadeT = 16;
      f.invuln = Math.max(f.invuln, 20);
      f.auraT = Math.max(f.auraT, 44);
      const px = attacker.x, py = attacker.y - 44;
      // The space the body occupied collapses into a silver ring.
      g.fx.ring(f.x + dir * 54, f.y - 42, 8, 120, PLATINUM, 20, 6);
      g.fx.bloom(px, py, 60, SILVER, 16, 3.4);
      g.fx.directional((px + f.x) / 2, py, 16, dir > 0 ? Math.PI : 0, .35, '#ffffff', 20, 'streak', 14, 3);
      g.applyHit(f, attacker, { dmg: 11, ang: 42, kb: 7.4, sc: 8.6, fx: 'blunt', stun: 14}, dir, px, py);
      // Cinematic hitstop: the whole world holds for the palm, and the frame
      // itself bends around the point of contact.
      for (const o of g.fighters) if (o.alive) o.hitstop = Math.max(o.hitstop, 20);
      g.distortAt(px, py, 22, 26);
      g.fx.ring(px, py, 14, 190, ICE, 22, 10);
      g.fx.shock(px, py, 90, PLATINUM, 22);
      g.fx.word(px, py - 66, 'COUNTER!', KAME, 56, 38);
      g.fx.word(px + dir * 60, py + 40, 'GODLIKE!', NEBULA, 42, 32);
      g.negativeFrames(2);
      g.flashScreen('#ffffff', 0.4); g.shake(20); sfx('ui_punch');
      g.punchIn(px, py, 0.13);
      g.speedBurst(dir > 0 ? 0 : Math.PI, 0.7);
    },
  }),

  // ==========================================================================
  // ULTIMATE — SUPREME GODLY DISPLAY
  // Four beats: the world holds its breath, he crosses six star angles, a
  // galaxy collapses into a point, and the frame goes negative.
  // ==========================================================================
  ult: {
    name: 'Supreme Godly Display',
    desc: 'Time slows. Goku closes his eyes, crosses six angles of a star in a single heartbeat, and collapses a galaxy into the point of contact.',
    ability: 'awakened', vfx: 'uiUlt', cin: 46, sfx: 'ui_ult', quietHits: true,
    dur: 96, startup: 30, anim: 'castUp', invuln: [0, 34], grav: 0.55,
    hits: [H(30, 34, 0, -42, 150, 190, 4, 80, 1, 0, { fx: 'blunt'})],
    onFrame: (f: any, fr: number, g: any) => {
      // ---- BEAT 1 · stilling -------------------------------------------------
      if (fr < 30) {
        f.invuln = Math.max(f.invuln, 2);
        const k = fr / 30;
        if (fr % 2 === 0) {
          const a = Math.random() * 6.28, r = 100 - k * 76;
          g.fx.add({
            x: f.x + Math.cos(a) * r, y: f.y - 42 + Math.sin(a) * r * .7,
            vx: -Math.cos(a) * (2 + k * 6), vy: -Math.sin(a) * (2 + k * 6) - 1,
            color: fr % 4 ? SILVER : PLATINUM, kind: 'glow', life: 18, size: 4 + k * 9,
           });
        }
        if (fr % 4 === 0) {
          // Drift the charge rings off-axis; a fixed centre turns the whole
          // charge into a bullseye.
          const wob = (fr % 8 ? 1 : -1) * (12 + fr);
          g.fx.ring(f.x + wob, f.y - 42 + (fr % 8 ? -6 : 6), 42 + fr * 2.8, 46 + fr * 3, PLATINUM, 15, 3);
        }
        if (fr % 5 === 0) g.fx.bolt(f.x, f.y - 42, f.x + (Math.random() - .5) * 200, f.y - 42 + (Math.random() - .5) * 220, '#cfe6ff', 5, 1.6);
        if (fr % 3 === 0) g.shake(1.6);
        // `moveFrame` is incremented before `onFrame` runs, so the first frame
        // this sees is 1 — the target has to be acquired there, not at 0.
        if (fr === 1) { f.ultTarget = g.nearestEnemy(f, 1400); sfx('ui_chime'); sfx('ui_aura'); }
        if (fr === 14) g.fx.text(f.x, f.y - 200, 'SILVER', PLATINUM, 22, 30);
        return;
      }
      // ---- BEAT 2 · the six angles ------------------------------------------
      if (fr < 78) {
        const t = f.ultTarget;
        if (fr === 30) {
          f.godT = 900;
          // Two rings, not four, deliberately off-centre and sized to the fighter
          // rather than to the arena: concentric rings on one point read as a
          // bullseye, and rings wider than the fight stop being an impact.
          g.fx.ring(f.x - f.facing * 18, f.y - 42, 12, 170, SILVER, 22, 13);
          g.fx.ring(f.x + f.facing * 26, f.y - 34, 10, 120, PLATINUM, 18, 8);
          g.fx.burst(f.x, f.y - 42, 46, SILVER, 15, 'streak', 38, 9);
          g.fx.bloom(f.x, f.y - 42, 90, SILVER, 22, 6);
          g.fx.shock(f.x, f.y - 42, 78, PLATINUM, 20);
          g.flashScreen('#e8f4ff', 0.55); g.shake(26); sfx('ui_ult');
          g.fx.text(f.x, f.y - 190, 'SUPREME GODLY DISPLAY', '#ffffff', 30, 70);
          return;
        }
        if (!t) { f.ultTarget = g.nearestEnemy(f, 1400); return; }
        if (!t.alive) { f.ultTarget = null; return; }
        // One strike per five frames, cycling the six star angles around the
        // target. The body is teleported, never animated into position.
        if ((fr - 30) % 5 === 0) {
          const step = Math.floor((fr - 30) / 5);
          const a = STAR_ANGLES[step % STAR_ANGLES.length] + step * 0.4;
          const px = f.x;
          f.x = t.x + Math.cos(a) * 76;
          f.y = t.y - 4 - Math.abs(Math.sin(a)) * 84;
          f.facing = t.x > f.x ? 1 : -1;
          f.vx = 0; f.vy = 0;
          t.vx = 0; t.vy = 0; t.hitstun = Math.max(t.hitstun, 12); t.state = 'hitstun';
          // Speed lines bridge the teleport, so the cut reads as distance.
          g.speedBurst(Math.atan2(f.y - t.y, f.x - t.x), 0.85);
          g.fx.directional((px + f.x) / 2, f.y - 42, 9, a, .4, '#ffffff', 15);
          // The cut is a slash of light. A ring here would be spawned nine times
          // on the same point across the sequence, and concentric rings on one
          // centre read as a bullseye rather than as six cuts.
          g.fx.slash(t.x, t.y - 44, 42, a - 1.2, a + 1.2, f.facing, SILVER, 13, 9);
          g.fx.burst(t.x, t.y - 44, 6, '#ffffff', 8, 'streak', 13, 3);
          g.fx.bloom(t.x, t.y - 44, 30, SILVER, 10, 2.4);
          g.applyHit(f, t, { dmg: 2.6, ang: 90, kb: 0.3, sc: 0, fx: 'blunt', stun: 12}, f.facing, t.x, t.y - 44, true);
          t.vx = 0; t.vy = 0;
          g.shake(5);
        }
        return;
      }
      // ---- BEAT 3 · the collapsing galaxy ------------------------------------
      if (fr < 92) {
        const k = (fr - 78) / 14;
        if (fr === 78) {
          // Stand off at a readable distance for the collapse.
          const t = f.ultTarget;
          f.ultTarget = null;
          if (t && t.alive) { f.x = t.x - f.facing * 96; f.y = t.y; }
          sfx('ui_beam');
          g.fx.word(f.x, f.y - 150, 'SUPREME', '#ffffff', 40, 40);
          g.fx.word(f.x, f.y + 40, 'GODLY DISPLAY', PLATINUM, 34, 40);
        }
        if (fr % 2 === 0) {
          const a = Math.random() * 6.28, r = 150 * (1 - k) + 8;
          g.fx.add({
            x: f.x + Math.cos(a) * r, y: f.y - 44 + Math.sin(a) * r,
            vx: -Math.cos(a) * (6 + k * 22), vy: -Math.sin(a) * (6 + k * 22), color: SILVER, kind: 'glow', life: 14, size: 4 + k * 8,
           });
        }
        if (fr % 3 === 0) g.fx.burst(f.x, f.y - 44, 6, k > .6 ? '#ffffff' : PLATINUM, 6 + k * 26, 'glow', 18, 5 + k * 6);
        if (fr === 84) { g.fx.bloom(f.x, f.y - 44, 60 + k * 130, SILVER, 18, 5); g.shake(6 + k * 20); }
        return;
      }
      // ---- BEAT 4 · the release ---------------------------------------------
      if (fr === 92) {
        g.fx.ring(f.x, f.y - 44, 12, 340, SILVER, 30, 20);
        g.fx.ring(f.x, f.y - 44, 12, 220, PLATINUM, 24, 12);
        g.fx.impact(f.x, f.y - 44, 220, '#ffffff');
        g.fx.bloom(f.x, f.y - 44, 300, ICE, 30, 14);
        g.fx.shock(f.x, f.y - 44, 220, PLATINUM, 30);
        g.fx.word(f.x, f.y - 190, 'DOGOOON!', '#ffffff', 76, 46);
        g.fx.word(f.x, f.y + 60, 'GODLIKE!', PLATINUM, 58, 46);
        // The universe-scale release: the lens itself gives way, then the frame
        // inverts for two frames on top of the whiteout.
        g.distortAt(f.x, f.y - 44, 40, 34);
        g.negativeFrames(2);
        g.flashScreen('#ffffff', 0.85);
        g.shake(34); g.punchIn(f.x, f.y - 44, 0.2);
        sfx('ui_ult');
      }
    },
  },
 };

// The Supreme Godly Display is lifted out of the move table and handed to the
// technique builder as the neutral awakened special's raw material.
const merged = mergeSignatures('goku_ui', lights);
const DISPLAY = merged.domain!;
const generated = installTechniques('goku_ui', look, merged.moves, DISPLAY) as Record<MoveKey, MoveDef>;

const branches = [
  { input: 'J → J → J', name: `${generated.nlight.name} Chain`, desc: `${generated.nlight.name} → ${generated.nlight2.name} → ${generated.nlight3.name}. Three frames of startup each, so the string lands before a read can start.` },
  { input: 'J → L', name: generated.nlight_spec.name!, desc: 'Cancels the ghost string into an expanding vacuum shockwave.' },
  { input: 'J → K', name: generated.nlight_heavy.name!, desc: 'Launcher finisher that pops a foe into juggle range.' },
  { input: '→ J → J / L / K', name: generated.slight2.name!, desc: `${generated.slight.name} slides him in; it extends into ${generated.slight2.name}, ${generated.slight_spec.name} or ${generated.slight_heavy.name}.` },
  { input: '↓ J → J / L', name: generated.dlight2.name!, desc: `${generated.dlight.name} extends into ${generated.dlight2.name} or ${generated.dlight_spec.name}.` },
  { input: 'Air J → J / L', name: generated.nair2.name!, desc: `${generated.nair.name} chains into ${generated.nair2.name} or ${generated.nair_spec.name}.` },
  { input: 'R @ full gauge · N / → / ↓ / Air', name: `${generated.naw.name} Stances`, desc: `Spends the whole gauge to Awaken. Direction picks the transformation stance: ${generated.naw.name}, ${generated.saw.name}, ${generated.daw.name}, ${generated.aaw.name}.` },
  { input: 'AWAKENED · J / K / L', name: `${generated.nwl.name} → ${generated.nwh.name} → ${generated.nfu.name}`, desc: 'A second kit for a second stance. The awakened special is the Supreme Godly Display, shortened and halved so it fits inside a fifteen-second Awakening.' },
];

const abilities = [
  { key: 'L · Neutral Special', name: generated.nspec.name!, desc: generated.nspec.desc! },
  { key: 'L · Side Special', name: generated.sspec.name!, desc: generated.sspec.desc! },
  { key: 'L · Down Special', name: generated.dspec.name!, desc: generated.dspec.desc! },
  { key: 'R · Awaken (full gauge)', name: generated.naw.name!, desc: `${generated.naw.desc} The gauge drains from full to empty over about fifteen seconds; at zero the Awakening ends.` },
  { key: 'AWAKENED · J · Light', name: generated.nwl.name!, desc: generated.nwl.desc! },
  { key: 'AWAKENED · K · Heavy', name: generated.nwh.name!, desc: generated.nwh.desc! },
  { key: 'AWAKENED · L · Display', name: generated.nfu.name!, desc: generated.nfu.desc! },
];

export const GOKU_UI: CharDef = {
  id: 'goku_ui', styleId: 'goku_ui', name: 'Goku (Ultra Instinct)', anime: 'Dragon Ball Super',
  title: 'The Autonomous Divine Martialist', tier: 'S+', color: SILVER,
  desc: 'He has stopped thinking in order to fight. Goku moves before the attack is thrown, his body answering on its own, and the silver Kamehameha he carries is a wave he surfs rather than a beam he fires.',
  portrait: makePortrait('goku_ui', look, SILVER),
  // Mobility was the outlier, not damage. Measured across the roster, these
  // numbers used to make him the *sole* character to top speed, air control and
  // jump at once - nobody else was even close to owning all three. He now sits at
  // the top of the band rather than above it: still the fastest thing in the
  // game, but no longer the only one who is fast in three different ways.
  // Gravity is raised (he falls faster) so the air advantage is a ceiling on his
  // offence rather than a place he can simply hover in, and weight is raised so
  // trades resolve against him.
  stats: { speed: 7.35, air: 7.45, jump: 13.85, weight: 1.04, scale: 1.0, gravity: 0.62 },
  // The bars were 5/5/5/5 while he had the *lowest* average damage in the game.
  // They now describe him: not the hardest hitter, the fastest, short-reaching,
  // and by a wide margin the hardest to put on the floor.
  statBars: { power: 4, speed: 5, range: 4, defense: 5 },
  look, moves: generated, domain: DISPLAY,
  moveBranches: branches, abilities,
  passives: [
    { name: 'Migatte no Gokui — Movement Without Thought', desc: 'Idle, walking and dodging frames trigger an Instant Slip: a 30 px micro-vanish that cancels the incoming hitstun entirely. Transformations always land, and a 3.3-second internal gauge keeps it from chaining into an unconditional no — it saves an exchange, not the match.' },
    { name: 'Autonomous Counter', desc: 'Down Special drops him into serene stillness. Anything that touches him is answered from directly behind, with a palm thrust and a full-screen hitstop.' },
    { name: 'Silver Flow', desc: 'Every dash, instant transmission and slip leaves a decaying after-image, and his aura never fully powers down — the ground under him is always distorting.' },
  ],
  ai: { horizSpec: 'sspec', zoneSpec: 'nspec', counterSpec: 'dspec', ultRange: 420 },
};