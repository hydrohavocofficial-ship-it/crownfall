/**
 * SHADOW DIO — JoJo's Bizarre Adventure: Heritage for the Future.
 *
 * Design notes
 *  - He is drawn to the Heritage artwork: the blond mane swept hard back off the
 *    brow, the gold coat cut open down the chest over black, green leather
 *    straps buckled across it, the heart clasp at the throat and the heart pad
 *    on the knee. The gold carries the whole read; green is only ever trim.
 *  - Light attacks are his own hands: fast, confident, weightless jabs and his
 *    MUDA flurry — never an ORA, which belongs to Jotaro.
 *  - Heavy attacks summon "The World" in its Heritage form: bone-white plate,
 *    oxidation-purple shoulders, stacked block gauntlets, collapsing cube floor.
 *  - His thrown weapon is a real knife — blade, guard and wrapped grip spinning
 *    end over end — not a four-blade fan projectile.
 *  - The ultimate is a real time stop handled by the combat engine
 *    (see Game.timeStop), not a screen tint.
 */
import { sfx } from './audio';
import { makePortrait } from './portraits';
import { installTechniques } from './techniques';
import type { CharDef, CoreMoveKey, MoveKey } from './characters';
import type { AnimName, HitDef, MoveDef } from './types';

const H = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, extra: Partial<HitDef> = {}): HitDef => ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, ...extra });
const mv = (name: string, anim: AnimName, dur: number, startup: number, hits: HitDef[], options: Partial<MoveDef> = {}): MoveDef => ({ name, anim, dur, startup, hits, ...options });
const cN = (w: [number, number]) => ({ light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cN2 = (w: [number, number]) => ({ light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy', window: w });
const cS = (w: [number, number]) => ({ light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cS2 = (w: [number, number]) => ({ special: 'slight_spec', heavy: 'slight_heavy', window: w });
const cD = (w: [number, number]) => ({ light: 'dlight2', special: 'dlight_spec', window: w });
const cA = (w: [number, number]) => ({ light: 'nair2', special: 'nair_spec', window: w });
const cSA = (w: [number, number]) => ({ light: 'sair2', special: 'sair_spec', window: w });

const GOLD = '#ffe45c';
const GREEN = '#7de0b0';
/** DIO's coat yellow, straight off the reference art. */
const COAT = '#e8c33a';

/**
 * Shadow DIO reads as the Heritage DIO: blond mane swept back off the brow, the
 * gold coat cut open over a black underlayer, green leather straps and the
 * purple wristband. The body is gold, never a dark recolour — the only black on
 * him is the underlayer, the boots and the shadow that gathers around the Stand.
 */
const look = {
  skin: '#eccfb8', hair: '#f2d552', hair2: '#c99a1e', hairStyle: 'dio' as const,
  top: COAT, top2: '#14100a', sleeve: COAT, fore: '#e5c9b0', pants: COAT, boots: '#171310',
  cape: COAT, cape2: '#2f8f4e', capeLen: 46, eye: GOLD, weapon: 'knife' as const, mark: 'heartCap' as const,
  energy: GREEN, energy2: GOLD, ninjaRun: false,
  pose: 'acrobat' as const, idle: 'float' as const, run: 'dash' as const, eyeStyle: 'narrow' as const, accent: GOLD,
  build: { shoulder: 1.16, chest: 1.1, limb: 1.12, head: 1.0, torso: 1.12, hip: 1.0 },
};

/** Stand strike helper: the hit volume is offset so the Stand, not Dio, lands it. */
const STAND_X = 18;

/**
 * Blood Drain — DIO's signature bloodsuck. He seizes the throat, drinks, and
 * hurls the drained body away. Only a physically grabbed opponent is drained,
 * so dodges, allies and distant targets are never pulled in.
 */
function bloodDrain(f: any, fr: number, g: any) {
  if (fr === 7) {
    const t: any = g.nearestEnemy(f, 118);
    f.dioDrainTarget = t ?? null;
    if (t?.alive) {
      t.state = 'hitstun'; t.hitstun = 66; t.vx = 0; t.vy = 0;
      g.fx.ring(t.x, t.y - 46, 10, 74, '#ff2b4d', 16, 6);
      g.fx.text(f.x, f.y - 124, 'BLOOD!', '#ff2b4d', 26, 34);
      g.shake(9);
    }
  }
  const t: any = f.dioDrainTarget;
  const holding = !!t && t.alive && t.state === 'hitstun';
  if (holding && fr > 7 && fr < 38) {
    // Kill the victim's momentum and pin them to DIO's hand for the whole drain.
    t.x = f.x + f.facing * 33; t.y = f.y; t.vx = 0; t.vy = 0;
    t.state = 'hitstun'; t.hitstun = 66;
    if (fr % 5 === 0) {
      const landed = g.applyHit(f, t, { dmg: 2.6, ang: 24, kb: 0, sc: 0, fx: 'dark', pull: true, stun: 24 }, f.facing, t.x, t.y - 42);
      if (landed) {
        // Every successful gulp feeds DIO, but never above 62% of his bars.
        const gained = g.heal(f, 4.2, .62);
        g.fx.text(f.x + f.facing * 12, f.y - 130, gained > 0 ? 'DRAIN' : 'BLOOD', '#ff4a6a', 18, 22);
        g.fx.ring(f.x, f.y - 44, 6, 46, '#ff2b4d', 12, 3);
      }
    }
    // Blood streams from the throat into DIO's mouth.
    for (let i = 0; i < 2; i++) {
      g.fx.add({
        x: t.x + f.facing * 8 + (Math.random() - .5) * 8, y: t.y - 52 + (Math.random() - .5) * 14,
        vx: -f.facing * (2.6 + Math.random() * 2), vy: (Math.random() - .5) * 1.6,
        color: Math.random() < .5 ? '#c8102e' : '#ff5a70', kind: 'glow', life: 14, size: 3 + Math.random() * 2,
      });
    }
  }
  if (fr === 38 && holding) {
    g.applyHit(f, t, { dmg: 15, ang: 34, kb: 9.4, sc: 9.6, fx: 'dark', stun: 18 }, f.facing, t.x, t.y - 42);
    g.fx.text(t.x, t.y - 104, 'THROWN', '#ff2b4d', 24, 28);
    g.fx.burst(t.x, t.y - 44, 14, '#c8102e', 8, 'spark', 22, 4);
    g.shake(12); sfx('heavyhit', 2);
  }
  if (fr >= 40) f.dioDrainTarget = null;
}

// ---------------------------------------------------------------------------
// Light attacks — Shadow DIO's own fists. Fast, no Stand.
// ---------------------------------------------------------------------------
const lights: Record<CoreMoveKey, MoveDef> = {
  nlight: mv('Shadow Jab', 'jab', 14, 3, [H(3, 6, 40, -46, 52, 40, 5, 40, 3.2, 1.7, { fx: 'blunt' })], { vfx: 'dioFist', chains: cN([3, 12]) }),
  nlight2: mv('Cross Fang', 'hook', 15, 3, [H(3, 6, 44, -48, 58, 44, 5.6, 44, 3.5, 2, { fx: 'blunt' })], { vfx: 'dioFist', chains: cN2([3, 13]) }),
  nlight3: mv('Muda Barrage', 'flurry', 22, 3, [
    H(3, 8, 42, -46, 66, 48, 1.9, 42, 2.2, 1.1, { fx: 'blunt', rehit: 3, g: 0 }),
    H(9, 13, 46, -48, 78, 56, 2.2, 44, 2.4, 1.3, { fx: 'blunt', rehit: 3, g: 0 }),
    H(14, 19, 48, -50, 88, 62, 8.4, 46, 6.4, 7.2, { fx: 'blunt', g: 1 })], { vfx: 'dioMuda' }),
  nlight_spec: mv('Elbow Cross', 'elbow', 22, 4, [H(4, 11, 46, -46, 74, 48, 9, 32, 6, 6.6, { fx: 'blunt' })], { vel: [[4, 16, 0]], vfx: 'dioFist' }),
  nlight_heavy: mv('Rising Knee', 'knee', 26, 4, [H(4, 12, 22, -64, 58, 90, 10.5, 86, 6.8, 7.8, { fx: 'blunt' })], { vel: [[4, 2, -13]], vfx: 'dioFist' }),
  slight: mv('Lunging Straight', 'thrust', 18, 4, [H(4, 8, 50, -45, 70, 42, 6.2, 30, 3.9, 2.2, { fx: 'blunt' })], { vel: [[3, 14, null], [10, 2, null]], vfx: 'dioFist', chains: cS([4, 16]) }),
  slight2: mv('Snap Backhook', 'backfist', 19, 3, [H(3, 9, 54, -46, 80, 50, 8, 40, 5.2, 4.2, { fx: 'blunt' })], { vel: [[3, 19, null]], vfx: 'dioFist', chains: cS2([3, 17]) }),
  slight_spec: mv('Palm Drive', 'palm', 24, 5, [H(5, 12, 56, -46, 88, 52, 11, 30, 6.8, 7.6, { fx: 'blunt' })], { vel: [[5, 24, 0]], vfx: 'dioFist' }),
  slight_heavy: mv('Spin Elbow', 'spinKick', 30, 5, [H(5, 16, 40, -46, 96, 68, 3.2, 48, 3.4, 2.4, { fx: 'blunt', rehit: 4 }), H(17, 21, 56, -48, 110, 74, 10, 44, 7.2, 8.2, { fx: 'blunt', g: 1 })], { turns: 1, vfx: 'dioFlurry' }),
  dlight: mv('Ankle Cut Kick', 'lowslash', 20, 4, [H(4, 10, 38, -12, 72, 28, 6, 74, 4.1, 1.8, { fx: 'blunt' })], { vel: [[3, 12, null], [11, 2, null]], vfx: 'dioFist', chains: cD([4, 17]) }),
  dlight2: mv('Crescent Heel', 'axeKick', 22, 3, [H(3, 10, 40, -16, 92, 40, 8.2, 72, 5.4, 4.6, { fx: 'blunt' })], { vfx: 'dioFist' }),
  dlight_spec: mv('Shadow Crouch Kick', 'sweep', 25, 5, [H(5, 14, 44, -16, 104, 38, 10, 76, 6.4, 7, { fx: 'blunt' })], { vfx: 'dioFist' }),
  nair: mv('Air Toe Kick', 'kick', 20, 3, [H(3, 10, 26, -40, 74, 66, 6.2, 44, 3.8, 2.4, { fx: 'blunt' })], { land: true, vfx: 'dioFist', chains: cA([3, 16]) }),
  nair2: mv('Diving Fist', 'dive', 22, 4, [H(4, 12, 26, -22, 68, 62, 8.4, -50, 4.6, 4, { fx: 'blunt' })], { land: true, vel: [[4, 3, 10]], vfx: 'dioFist' }),
  nair_spec: mv('Air Knee Drive', 'knee', 24, 4, [H(4, 13, 30, -46, 78, 66, 9.4, 60, 6.1, 6.7, { fx: 'blunt' })], { land: true, vfx: 'dioFist' }),
  sair: mv('Air Jab', 'jab', 18, 3, [H(3, 9, 48, -45, 76, 44, 6.6, 28, 3.9, 2.5, { fx: 'blunt' })], { land: true, vel: [[3, 15, null]], vfx: 'dioFist', chains: cSA([3, 16]) }),
  sair2: mv('Air Roundhouse', 'roundhouse', 22, 4, [H(4, 12, 52, -44, 94, 62, 8.8, 30, 5.2, 4.2, { fx: 'blunt' })], { land: true, vfx: 'dioFist' }),
  sair_spec: mv('Air Knife Volley', 'cast', 30, 6, [], {
    ability: 'special', stance: 'air', land: true, vfx: 'dioKnife',
    desc: 'Hurls three throwing knives downward-forward out of the air. Each one is a real blade spinning end over end down its own lane.',
    onFrame: (f, fr, g) => {
      // Three knives, thrown one after another rather than as a single fan.
      if (fr !== 6 && fr !== 11 && fr !== 16) return;
      const i = (fr - 6) / 5;
      g.spawnProj({
        owner: f, type: 'sig', sig: 'dioKnife', x: f.x + f.facing * 40, y: f.y - 54 + i * 12,
        vx: f.facing * (14 - i * 1.4), vy: 3.6 + i * .5, w: 62, h: 10, life: 30, dmg: 3.6, ang: 52, kb: 3, sc: 2.2,
        fx: 'blunt', dir: f.facing, col: '#dfe8f2', col2: GOLD, data: { i, spin: Math.random() * 6 },
      });
    },
  }),
  dair: mv('Shadow Stomp', 'stomp', 24, 5, [H(5, 15, 30, -14, 66, 56, 8.4, -54, 4.6, 3.6, { fx: 'blunt' })], { land: true, vel: [[5, 4, 12]], vfx: 'dioFist' }),

  // -------------------------------------------------------------------------
  // Heavy attacks — "The World" manifests and strikes with him.
  // -------------------------------------------------------------------------
  nsig: mv('The World: Muda Flurry', 'flurry', 44, 7, [
    H(7, 16, 40 + STAND_X, -46, 78, 56, 1.8, 42, 2, 1, { fx: 'blunt', rehit: 3, g: 0 }),
    H(17, 26, 44 + STAND_X, -48, 88, 64, 2, 44, 2.2, 1.2, { fx: 'blunt', rehit: 3, g: 0 }),
    H(27, 35, 50 + STAND_X, -50, 100, 70, 9.5, 46, 7, 8, { fx: 'blunt', g: 1 })],
    { stand: true, vfx: 'standFlurry', desc: 'The World materialises beside him and unloads a four-beat Muda barrage.' }),
  ssig: mv('The World: Point-Zero Palm', 'palm', 44, 6, [H(6, 18, 56 + STAND_X, -46, 96, 62, 3.4, 34, 2.8, 1.8, { fx: 'blunt', rehit: 3 }), H(19, 24, 62 + STAND_X, -48, 110, 70, 12, 36, 7.6, 8.6, { fx: 'blunt', g: 1 })],
    { stand: true, vfx: 'standFlurry', vel: [[6, 16, null], [16, 2, null]] }),
  dsig: mv('The World: Overlap Kick', 'roundhouse', 46, 8, [H(8, 22, 44 + STAND_X, -20, 150, 46, 3.2, 74, 3, 1.4, { fx: 'blunt', rehit: 4 }), H(23, 27, 52 + STAND_X, -18, 168, 54, 11, 70, 7.2, 8.2, { fx: 'blunt', g: 1 })],
    { stand: true, vfx: 'standFlurry', vel: [[8, 8, null], [20, 2, null]] }),
  rec: mv('The World: Shadow Rise', 'rise', 34, 5, [H(5, 16, 16, -60, 74, 96, 3, 84, 3, 1.4, { fx: 'blunt', rehit: 4 }), H(17, 21, 24, -84, 84, 96, 7.4, 82, 5.8, 6.8, { fx: 'blunt', g: 1 })],
    { stand: true, turns: 2, grav: .42, vel: [[5, 2, -15]], vfx: 'standFlurry' }),
  gp: mv('The World: Falling Press', 'stomp', 38, 7, [H(7, 26, 30, -20, 92, 68, 11, -60, 6.2, 7.4, { fx: 'blunt' })],
    { stand: true, land: true, vel: [[7, 4, 18]], vfx: 'standFlurry' }),

  // -------------------------------------------------------------------------
  // Specials (K) — still his own body, still no Stand.
  // -------------------------------------------------------------------------
  nspec: mv('Muda Rush', 'flurry', 36, 8, [], {
    cd: 165, ability: 'special', stance: 'neutral', vfx: 'dioMuda',
    desc: 'A four-step shadow teleport that closes the gap and ends in a full MUDA rush, with the final blow launched through The World.',
    onFrame: (f, fr, g) => {
      if (fr >= 6 && fr < 14 && fr % 2 === 0) { f.x += f.facing * 16; g.fx.add({ x: f.x - f.facing * 20, y: f.y - 30 - Math.random() * 30, vx: -f.facing * 3, vy: -1, color: '#7de0b0', kind: 'glow', life: 16, size: 8 }); }
      if (fr >= 10 && fr < 26 && fr % 2 === 0) {
        // Every beat of the rush is a real contact check, not decoration.
        const t = g.nearestEnemy(f, 96);
        if (t?.alive && t.invuln <= 0) g.applyHit(f, t, { dmg: 1.9, ang: 42, kb: 0.6, sc: 0, fx: 'blunt', pull: true, stun: 4 }, f.facing, t.x, t.y - 44);
        g.fx.ring(f.x + f.facing * 46, f.y - 46, 5, 30, GOLD, 8, 2.4);
      }
      if (fr === 26) g.spawnProj({ owner: f, type: 'sig', sig: 'dioPalm', x: f.x + f.facing * 62, y: f.y - 46, vx: f.facing * 15, vy: 0, w: 70, h: 96, life: 26, dmg: 12, ang: 32, kb: 7, sc: 7.4, fx: 'blunt', dir: f.facing, col: GREEN, col2: GOLD });
    },
  }),
  sspec: mv('Silver Rain: Knife Throw', 'cast', 34, 8, [], {
    cd: 155, ability: 'special', stance: 'side', vfx: 'dioKnife',
    desc: 'DIO’s signature throwing knives: four real blades, released one after another from the fingers, each spinning end over end down its own lane — so dodging one walks straight into the next.',
    onFrame: (f, fr, g) => {
      const lane = { 8: -1, 12: 0, 16: 0, 20: 1 }[fr];
      if (lane === undefined) return;
      const arm = fr === 8 || fr === 16;
      g.spawnProj({
        owner: f, type: 'sig', sig: 'dioKnife', x: f.x + f.facing * (arm ? 38 : 30), y: f.y - 58 + lane * 16,
        vx: f.facing * (16.5 - Math.abs(lane) * 1.6), vy: lane * 1.7,
        w: 62, h: 10, life: 36, dmg: 4.4, ang: 30, kb: 3.4, sc: 2.4, fx: 'blunt', rehit: 0,
        dir: f.facing, col: '#dfe8f2', col2: GOLD, data: { lane, spin: Math.random() * 6 },
      });
      sfx('swing');
    },
  }),
  dspec: mv('Blood Drain', 'punch', 52, 8, [H(8, 12, 50, -48, 62, 46, 4, 40, 1, 0, { fx: 'dark' })], {
    cd: 190, ability: 'special', stance: 'down', vfx: 'dioDrain',
    desc: 'DIO seizes the throat and drinks. Every gulp drains life straight into his own bars, then he hurls the emptied body away.',
    vel: [[8, 10, 0]], grav: .3,
    onFrame: (f, fr, g) => bloodDrain(f, fr, g),
  }),

  // -------------------------------------------------------------------------
  // Ultimate — ZA WARUDO. The engine freezes the world; see Game.timeStop.
  // The move's own animation is the part where DIO cannot move: the five-second
  // clock only starts the moment he is released and free to act.
  // -------------------------------------------------------------------------
  ult: mv('Za Warudo', 'castUp', 40, 12, [], {
    ult: 'ZA WARUDO', ability: 'ultimate', stance: 'neutral', invuln: [0, 40], grav: .2, cin: 40,
    desc: 'Time itself stops. Every other fighter freezes solid, and the five-second clock begins only once Shadow DIO can move. Every blow he lands is held back and released all at once when time resumes.',
    vfx: 'dioTimeCast',
    onFrame: (f, fr, g) => {
      if (fr === 12) g.startTimeStop(f);
      if (fr > 12 && fr % 4 === 0) g.fx.add({ x: f.x + (Math.random() - .5) * 90, y: f.y - 20 - Math.random() * 110, vx: (Math.random() - .5) * 2, vy: -1 - Math.random() * 2, color: Math.random() < .5 ? '#8affd0' : GOLD, kind: 'glow', life: 22, size: 5 + Math.random() * 5 });
    },
  }),
};

/** Air K is declared inline above; this is the readable alias used by the move list. */

const generated = installTechniques('shadowdio', look, lights) as Record<MoveKey, MoveDef> & Record<string, MoveDef>;
generated.aspec = mv('Air Shadow Cutter', 'axeKick', 34, 6, [H(6, 14, 34, -34, 92, 70, 9, 40, 6, 6.8, { fx: 'blunt' })], {
  ability: 'special', stance: 'air', land: true, vfx: 'dioFist',
  desc: 'A spinning double kick performed entirely in the air, still without calling the Stand.',
});
generated.aig = mv('The World: Air Intercept', 'palm', 36, 5, [H(5, 15, 54 + STAND_X, -44, 96, 58, 9.5, 32, 6.6, 7.4, { fx: 'blunt' })],
  { stance: 'air', land: true, stand: true, invuln: [0, 24], vel: [[5, 24, -2]], vfx: 'standFlurry', desc: 'The World phases in mid-air and intercepts with an open-hand stop.' });

const branches = [
  { input: 'H → H → H', name: `${generated.nlight.name} Chain`, desc: `${generated.nlight.name} → ${generated.nlight2.name} → ${generated.nlight3.name}.` },
  { input: 'H → K', name: generated.nlight_spec.name!, desc: 'Cancels the light string into a signature EX burst.' },
  { input: 'H → J', name: generated.nlight_heavy.name!, desc: 'Launcher finisher that pops foes into juggle range.' },
  { input: '→ H → H / K / J', name: generated.slight2.name!, desc: `${generated.slight.name} extends into ${generated.slight2.name}, ${generated.slight_spec.name} or ${generated.slight_heavy.name}.` },
  { input: '↓ H → H / K', name: generated.dlight2.name!, desc: `${generated.dlight.name} extends into ${generated.dlight2.name} or ${generated.dlight_spec.name}.` },
  { input: 'J · Heavy', name: generated.nsig.name!, desc: 'All three Heavy attacks call The World forward. The Stand attacks with Shadow DIO, never instead of him.' },
  { input: 'K · N / → / ↓ / Air', name: generated.nspec.name!, desc: 'Four unique Special stances: Muda Rush, Knife Fan, Blood Drain, and the Air Knife Volley.' },
  { input: 'L · N / → / ↓ / Air', name: generated.nex.name!, desc: `Limit Break stances: ${generated.nex.name}, ${generated.sex.name}, ${generated.dex.name}, ${generated.aex.name}.` },
  { input: 'U · N / → / ↓ / Air', name: generated.naw.name!, desc: `Awaken stances: ${generated.naw.name}, ${generated.saw.name}, ${generated.daw.name}, ${generated.aaw.name}.` },
  { input: 'U → K', name: generated.nfu.name!, desc: `K immediately after U performs the awakened variant. Direction selects ${generated.sfu.name}, ${generated.dfu.name}, or ${generated.afu.name}.` },
];

const abilities = [
  { key: 'K · Neutral Special', name: generated.nspec.name!, desc: generated.nspec.desc! },
  { key: 'K · Forward Special', name: generated.sspec.name!, desc: generated.sspec.desc! },
  { key: 'K · Down Special', name: generated.dspec.name!, desc: generated.dspec.desc! },
  { key: 'K · Aerial Special', name: generated.sair_spec.name!, desc: generated.sair_spec.desc! },
  { key: 'J · Neutral Heavy', name: generated.nsig.name!, desc: generated.nsig.desc! },
  { key: 'L · Limit Break', name: generated.nex.name!, desc: `${generated.nex.desc} Stances: ${generated.sex.name} / ${generated.dex.name} / ${generated.aex.name}.` },
  { key: 'U · Awaken', name: generated.naw.name!, desc: `${generated.naw.desc} Stances: ${generated.saw.name} / ${generated.daw.name} / ${generated.aaw.name}.` },
  { key: 'U → K · Awakened', name: generated.nfu.name!, desc: `${generated.nfu.desc} Follow-up variants: ${generated.sfu.name}, ${generated.dfu.name}, ${generated.afu.name}.` },
  { key: 'R · ULTIMATE', name: generated.ult.name!, desc: generated.ult.desc! },
];

export const SHADOW_DIO: CharDef = {
  id: 'shadowdio', styleId: 'shadowdio', name: 'Shadow Dio', anime: 'JoJo: Heritage for the Future', title: 'Za Warudo', tier: 'S', color: '#4ad6a0',
  desc: 'The sinister DIO. He fights with a light, effortless jab, lets The World take the heavy blows, and ends every exchange by stopping time itself — then cashing in every hit he landed inside it.',
  portrait: makePortrait('shadowdio', look, '#4ad6a0'),
  stats: { speed: 7.2, air: 7.4, jump: 13.8, weight: .9, scale: 1.0, gravity: .6 },
  statBars: { power: 4, speed: 5, range: 3, defense: 3 }, look, moves: generated,
  moveBranches: branches, abilities,
  passives: [
    { name: 'The World', desc: 'Every Heavy attack manifests the Stand beside him, adding reach, a second silhouette and much higher impact than his bare hands.' },
    { name: 'Za Warudo', desc: 'Time Stop lasts five real seconds, and the clock only begins once Shadow DIO is free to move again. Hits landed during it deal no damage until time resumes, when they all land together.' },
    { name: 'Suspended Steel', desc: 'Knives and projectiles created while time is stopped hang motionless in the air and resume from exactly where they were released.' },
    { name: 'Silver Rain', desc: 'Every knife he throws is a real blade: it spins end over end, covers its own lane, and keeps travelling through the frozen world during Za Warudo.' },
    { name: 'Blood Drain', desc: 'Down Special drinks life out of a grabbed opponent and pours it straight back into Shadow DIO’s own bars.' },
  ],
  ai: { vertSpec: 'dspec', horizSpec: 'sspec', zoneSpec: 'nspec', ultRange: 470 },
};

// Keep the sound module referenced so the Stand cue and death cue have a home.
export const SHADOW_DIO_CUES = { appear: 'clip/appear', death: 'clip/death', timeStop: 'clip/timestop', resume: 'clip/time-resume' } as const;
export function playShadowDioDeath() { sfx(SHADOW_DIO_CUES.death); }
