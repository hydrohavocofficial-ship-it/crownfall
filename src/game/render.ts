import { AnimName } from './types';
import { drawCostume, drawPresence } from './costumes';
import { FORMS, formCtx } from './awakenForms';

export type HairStyle = 'bowl' | 'spikeShort' | 'spikeLong' | 'flame' | 'mane' | 'messy' | 'bald' | 'ponytail' | 'swept' | 'twin'
  | 'undercut' | 'wolf' | 'bob' | 'crest' | 'heart' | 'dio' | 'rose' | 'ui';
export type Weapon = 'dual' | 'katana' | 'gunbai' | 'greatsword' | 'claws' | 'triple' | 'chainsaw' | 'staff' | 'fists' | 'knife';
export type Mark = 'none' | 'headband' | 'blindfold' | 'hat' | 'bandana' | 'scar' | 'mask' | 'visor' | 'heartCap';

/**
 * Body archetype. Every profile changes proportions, idle rhythm, run cadence
 * and how the shared attack poses are held, so two fighters sharing an `AnimName`
 * still read as different martial artists instead of recolours.
 */
export type BodyPose = 'brawler' | 'speedster' | 'acrobat' | 'bruiser' | 'monster' | 'mage'
  | 'ninja' | 'swordsman' | 'gunman' | 'heavyweight' | 'wrestler' | 'dancer';
export type IdleStyle = 'bounce' | 'still' | 'breathe' | 'float' | 'sway' | 'coiled' | 'lean';
export type RunStyle = 'pumped' | 'ninja' | 'float' | 'skater' | 'dash' | 'waddle';
export type EyeStyle = 'sharp' | 'round' | 'narrow' | 'glowing' | 'closed';

/** Multipliers applied on top of the base skeleton so no two fighters share a body. */
export interface Build {
  shoulder: number; chest: number; limb: number; head: number; torso: number; hip: number;
}

export interface Look {
  skin: string; hair: string; hair2?: string; hairStyle: HairStyle;
  top: string; top2: string; sleeve: string; fore: string; pants: string; boots: string;
  cape?: string; cape2?: string; capeLen?: number; eye: string;
  weapon: Weapon; mark?: Mark;
  energy: string; energy2: string; ninjaRun?: boolean;
  pose?: BodyPose; build?: Build; idle?: IdleStyle; run?: RunStyle; eyeStyle?: EyeStyle;
  /** Secondary trim colour used for accents, rim light and dust. */
  accent?: string;
  /** Glove colour. Unset means bare hands in the skin colour. */
  glove?: string;
  /** What is on the feet. Defaults to `boots`. */
  footwear?: 'boots' | 'shoes' | 'sandals' | 'bare' | 'tabi';
  /** Trousers end at the knee (shorts, capris); the shin below is skin. */
  shorts?: boolean;
}

export interface Pose {
  lean: number; head: number;
  aF: [number, number]; aB: [number, number];
  lF: [number, number]; lB: [number, number];
  wep: number; rot: number;
}

const P = (lean: number, aF: [number, number], aB: [number, number], lF: [number, number], lB: [number, number], wep: number, rot = 0): Pose =>
  ({ lean, head: 0, aF, aB, lF, lB, wep, rot });

export const POSES = {
  idle: P(0.08, [0.45, 1.35], [-0.25, 0.35], [0.3, 0.02], [-0.25, -0.08], 2.1),
  jump: P(0.0, [1.3, 2.2], [-0.9, -0.3], [1.1, -0.1], [-0.2, -0.6], 2.6),
  fall: P(0.06, [0.9, 1.6], [-0.7, -0.2], [0.45, 0.1], [-0.35, -0.2], 2.0),
  hurt: P(-0.45, [-1.0, -0.4], [-1.3, -1.8], [0.6, 0.3], [0.2, 0.7], -1.0),
  crouch: P(0.25, [0.9, 1.6], [-0.5, 0.1], [1.3, -0.3], [0.2, -1.4], 1.9),
  dodgeG: P(-0.25, [1.5, 2.6], [-0.4, 0.4], [0.9, -0.2], [-0.6, -1.0], 2.8),
  tuck: P(0.35, [1.2, 2.4], [0.6, 1.8], [1.6, -0.4], [1.2, -0.7], 2.4),
  wall: P(-0.1, [2.6, 2.9], [-1.8, -1.4], [0.8, -0.4], [-0.5, -0.6], -2.2),
  hero: P(-0.06, [1.05, 2.05], [-0.55, 0.15], [0.32, 0.02], [-0.42, -0.12], 3.0),
};

export const ANIMS: Record<AnimName, { w: Pose; s: Pose; spin?: number }> = {
  slash: { w: P(-0.1, [2.8, 3.3], [-0.8, -0.3], [0.4, 0], [-0.4, -0.1], 3.9), s: P(0.4, [1.2, 1.0], [-1.0, -0.6], [0.8, 0.2], [-0.6, -0.3], 0.8) },
  backslash: { w: P(0.3, [1.6, 1.4], [-0.8, -0.3], [0.5, 0], [-0.4, -0.1], 1.2), s: P(-0.2, [-1.8, -2.2], [0.5, 0.9], [0.3, 0], [-0.6, -0.3], -2.4) },
  upslash: { w: P(0.35, [0.3, 0.6], [-0.6, -0.1], [0.9, -0.2], [-0.2, -1.0], 0.5), s: P(-0.3, [2.9, 3.1], [-1.2, -0.8], [0.35, 0.0], [-0.3, 0.2], 3.25) },
  lowslash: { w: P(0.2, [-1.0, -1.4], [-0.3, 0.5], [1.3, -0.3], [0.2, -1.4], -1.9), s: P(0.55, [1.5, 1.6], [-1.2, -0.8], [1.2, 0.3], [-1.0, -1.5], 1.62) },
  thrust: { w: P(-0.05, [-0.7, 1.3], [-0.2, 0.6], [0.4, 0], [-0.4, -0.1], 1.57), s: P(0.45, [1.5, 1.57], [-1.1, -0.7], [0.9, 0.3], [-0.8, -0.5], 1.57) },
  punch: { w: P(0.0, [-0.3, 1.9], [0.4, 1.8], [0.4, 0], [-0.3, -0.1], 2.4), s: P(0.35, [1.55, 1.6], [-0.9, -0.2], [0.7, 0.2], [-0.6, -0.3], 1.6) },
  uppercut: { w: P(0.3, [0.2, 1.4], [-0.5, 0.2], [1.2, -0.3], [0.2, -1.3], 1.6), s: P(-0.25, [2.9, 3.05], [-1.0, -0.5], [0.5, 0.3], [-0.3, 0], 3.1) },
  kick: { w: P(-0.15, [0.8, 1.9], [-0.6, 0], [1.5, 0.3], [-0.2, -0.1], 2.4), s: P(-0.4, [-0.5, 0.3], [-1.0, -0.5], [1.65, 1.65], [-0.15, -0.1], 2.2) },
  dkick: { w: P(0.1, [1.6, 2.4], [-1.0, -0.4], [1.3, 0.2], [0.6, -0.4], 2.5), s: P(0.0, [2.5, 2.9], [-2.4, -2.8], [0.08, 0.0], [-0.12, -0.05], 2.8) },
  spin: { w: P(0.1, [1.0, 1.4], [-1.0, -0.6], [0.8, 0.1], [-0.5, -0.4], 1.4), s: P(0.2, [1.6, 1.6], [-1.6, -1.6], [0.9, 0.4], [-0.6, -0.5], 1.6), spin: 1 },
  flip: { w: P(0.3, [0.8, 1.6], [-0.8, -0.2], [1.2, -0.2], [0.2, -1.0], 1.5), s: P(-0.2, [2.6, 2.9], [-2.2, -2.6], [1.0, 0.8], [-0.5, -0.3], 2.8), spin: -1 },
  cast: { w: P(-0.1, [-0.9, -0.3], [-0.7, -0.1], [0.4, 0], [-0.4, -0.1], -0.6), s: P(0.25, [1.55, 1.55], [1.4, 1.5], [0.8, 0.2], [-0.6, -0.3], 1.55) },
  castUp: { w: P(0.3, [0.2, 0.7], [0.1, 0.5], [1.2, -0.3], [0.2, -1.3], 0.7), s: P(-0.15, [3.0, 3.1], [2.8, 2.95], [0.3, 0], [-0.3, -0.1], 3.1) },
  slam: { w: P(-0.25, [3.0, 3.5], [2.9, 3.4], [1.0, 0.3], [-0.3, -0.4], 3.6), s: P(0.5, [0.8, 0.4], [0.6, 0.3], [0.5, 0.1], [-0.4, -0.3], 0.25) },
  dive: { w: P(0.0, [2.6, 3.2], [-0.6, -0.2], [0.8, -0.1], [-0.3, -0.5], 3.6), s: P(0.9, [1.4, 1.3], [-1.4, -1.2], [-0.2, -0.4], [-0.5, -0.7], 1.1, 0.5) },
  counter: { w: P(-0.1, [1.9, 2.9], [-0.4, 0.5], [0.9, -0.2], [-0.4, -0.9], 2.95), s: P(-0.1, [1.9, 2.9], [-0.4, 0.5], [0.9, -0.2], [-0.4, -0.9], 2.95) },
  sweep: { w: P(0.2, [1.0, 1.6], [-0.4, 0.2], [1.3, -0.3], [0.2, -1.4], 1.8), s: P(-0.35, [0.4, 1.0], [-1.6, -1.6], [1.62, 1.62], [0.6, -1.2], 1.4) },
  rise: { w: P(0.35, [0.3, 0.6], [-0.6, -0.1], [1.2, -0.3], [0.2, -1.3], 0.5), s: P(-0.1, [2.9, 3.1], [-2.6, -2.8], [0.6, 0.3], [-0.3, -0.2], 3.2), spin: 2 },

  // ---- unarmed silhouettes -------------------------------------------------
  // A boxer snaps from the hip, so `w` is a deep chamber and `s` a short,
  // fully-extended follow-through. Angles are in facing-right space.
  jab: { w: P(-0.12, [-0.55, 1.05], [0.5, 1.5], [0.45, 0.02], [-0.3, -0.1], 2.75), s: P(0.28, [1.62, 1.6], [-0.75, -0.35], [0.55, 0.05], [-0.5, -0.2], 1.57) },
  hook: { w: P(-0.16, [-1.5, 0.35], [0.3, 1.3], [0.5, 0.02], [-0.3, -0.1], 3.4), s: P(0.34, [1.35, 1.9], [-1.1, -0.2], [0.7, 0.1], [-0.55, -0.25], 1.15) },
  elbow: { w: P(-0.05, [-0.9, 0.55], [0.6, 1.6], [0.4, 0.02], [-0.25, -0.1], 2.9), s: P(0.22, [0.55, 2.05], [-0.6, -0.15], [0.6, 0.05], [-0.5, -0.2], 1.2) },
  backfist: { w: P(-0.18, [0.9, 0.1], [-0.7, -0.5], [0.45, 0.02], [-0.3, -0.1], 3.7), s: P(0.4, [1.0, -0.5], [0.85, 1.15], [0.5, 0.05], [-0.45, -0.2], 2.6) },
  palm: { w: P(-0.14, [-0.4, 0.9], [0.2, 1.2], [0.4, 0.02], [-0.3, -0.1], 2.6), s: P(0.3, [1.55, 1.55], [-0.6, -0.5], [0.6, 0.05], [-0.5, -0.2], 1.57) },
  knee: { w: P(0.22, [-0.5, 0.2], [0.9, 0.5], [1.35, 0.3], [0.15, -1.5], 1.2), s: P(-0.2, [0.4, 0.9], [1.3, 1.1], [1.2, 1.55], [0.1, -1.6], 0.75) },
  axeKick: { w: P(-0.2, [-1.3, -0.6], [-0.6, -0.4], [0.5, 0.02], [-0.3, -0.1], 3.5), s: P(0.5, [0.9, 0.1], [0.6, 0.4], [1.85, 1.15], [-0.6, -0.2], 3.05) },
  roundhouse: { w: P(0.1, [-1.1, 0.2], [-1.3, -0.7], [0.5, 0.02], [-0.3, -0.1], 2.6), s: P(-0.34, [-0.7, 0.5], [-1.7, -0.9], [1.75, 1.6], [-0.2, -0.15], 1.62) },
  stomp: { w: P(0.3, [-0.7, -0.2], [-0.4, 0.4], [1.25, 0.45], [0.2, -1.4], 1.1), s: P(0.06, [0.7, 0.5], [0.4, 0.3], [0.28, 0.02], [0.22, -0.05], 0.15) },
  headbutt: { w: P(-0.2, [0.2, 0.6], [0.3, 1.1], [0.5, 0.02], [-0.3, -0.1], 2.2), s: P(0.62, [0.5, 1.5], [-0.4, -0.2], [0.9, 0.1], [-0.6, -0.2], 0.5) },
  flurry: { w: P(0.05, [0.9, 0.3], [1.1, 0.5], [0.5, 0.02], [-0.4, -0.15], 3.2), s: P(0.12, [1.5, 1.2], [0.6, 1.0], [0.5, 0.05], [-0.5, -0.2], 2.1) },
  spinKick: { w: P(0.15, [-1.0, 0.3], [-1.1, -0.6], [0.5, 0.02], [-0.3, -0.1], 2.5), s: P(0.1, [0.4, 0.6], [-0.9, -0.5], [1.9, 1.9], [-0.4, -0.4], 1.6), spin: 1 },
};

/**
 * Per-archetype body adjustments. Values are additive deltas in pose space, not
 * new animations, so every move a fighter owns automatically gains a silhouette
 * that belongs to that fighter.
 */
const POSE_TRAITS: Record<BodyPose, {
  lean: number; wep: number; arm: [number, number]; guard: [number, number];
  reach: number; crouch: number; headLean: number; stepLift: number;
}> = {
  brawler:     { lean: .05, wep: .10, arm: [.10, .18], guard: [-.20, -.18], reach: 1.0,  crouch: .1,  headLean: .04, stepLift: 0 },
  speedster:   { lean: -.04, wep: -.06, arm: [.16, .26], guard: [-.30, -.26], reach: .92, crouch: -.2, headLean: -.02, stepLift: 1 },
  acrobat:     { lean: -.02, wep: -.14, arm: [.12, .30], guard: [-.24, -.34], reach: .96, crouch: -.1, headLean: -.04, stepLift: 2 },
  bruiser:     { lean: .12, wep: .04, arm: [.02, .06], guard: [-.10, -.10], reach: 1.08, crouch: .22, headLean: .10, stepLift: 0 },
  monster:     { lean: .16, wep: .16, arm: [-.04, -.04], guard: [-.06, -.06], reach: 1.12, crouch: .3,  headLean: .14, stepLift: 0 },
  mage:        { lean: -.08, wep: -.10, arm: [.22, .34], guard: [-.16, -.14], reach: .88, crouch: -.14, headLean: -.06, stepLift: 0 },
  ninja:       { lean: .06, wep: -.02, arm: [.08, .20], guard: [-.26, -.22], reach: .94, crouch: 0,   headLean: .02, stepLift: 1 },
  swordsman:   { lean: .04, wep: .02, arm: [.04, .08], guard: [-.18, -.16], reach: 1.14, crouch: .04, headLean: .04, stepLift: 0 },
  gunman:      { lean: -.02, wep: -.16, arm: [.20, .40], guard: [-.22, -.16], reach: 1.0,  crouch: -.06, headLean: -.02, stepLift: 0 },
  heavyweight: { lean: .18, wep: .08, arm: [-.02, -.02], guard: [-.08, -.08], reach: 1.16, crouch: .34, headLean: .16, stepLift: 0 },
  wrestler:    { lean: .14, wep: .02, arm: [.04, .10], guard: [-.14, -.12], reach: 1.06, crouch: .26, headLean: .12, stepLift: 0 },
  dancer:      { lean: -.06, wep: -.10, arm: [.18, .32], guard: [-.22, -.24], reach: .98, crouch: -.08, headLean: -.04, stepLift: 1 },
};

/**
 * The identity profile. Characters that have not been art-directed (Sukuna, and
 * any custom fighter that never picked an archetype) resolve to this, so their
 * skeleton and animation play exactly as originally authored.
 */
const NEUTRAL_TRAIT = { lean: 0, wep: 0, arm: [0, 0] as [number, number], guard: [0, 0] as [number, number], reach: 1, crouch: 0, headLean: 0, stepLift: 0 };

const BUILD_DEFAULT: Build = { shoulder: 1, chest: 1, limb: 1, head: 1, torso: 1, hip: 1 };
const buildOf = (L: Look | undefined): Build => (L?.build ? { ...BUILD_DEFAULT, ...L.build } : BUILD_DEFAULT);
/** True when a fighter is covered by the art direction pass. */
const artDirected = (L: Look | undefined) => !!L?.pose;
const traitOf = (L: Look | undefined) => (L?.pose ? POSE_TRAITS[L.pose] : NEUTRAL_TRAIT);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    lean: lerp(a.lean, b.lean, t), head: lerp(a.head, b.head, t),
    aF: [lerp(a.aF[0], b.aF[0], t), lerp(a.aF[1], b.aF[1], t)],
    aB: [lerp(a.aB[0], b.aB[0], t), lerp(a.aB[1], b.aB[1], t)],
    lF: [lerp(a.lF[0], b.lF[0], t), lerp(a.lF[1], b.lF[1], t)],
    lB: [lerp(a.lB[0], b.lB[0], t), lerp(a.lB[1], b.lB[1], t)],
    wep: lerp(a.wep, b.wep, t), rot: lerp(a.rot, b.rot, t),
  };
}
/** Original startup/recovery ramp, kept for characters outside the art pass. */
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 2);
/** Anticipation: a slight overshoot that loads the strike before it fires. */
const easeLoad = (t: number) => { const k = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - k, 3); };
/** Follow-through: the release overshoots, then settles back on its own. */
const easeSnap = (t: number) => {
  const k = Math.min(1.35, Math.max(0, t));
  if (k < 1) return 1.24 * (1 - Math.pow(1 - k, 3)) - .24 * (1 - k);
  return 1 + .24 * (1 - k) * Math.cos((k - 1) * 9);
};
/** Recovery: heavier attacks coast back slowly instead of snapping instantly. */
const easeSettle = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 1.7);
/**
 * Applies the archetype deltas to a finished pose.
 * Always returns a fresh pose: the shared POSES/ANIMS tables are module-level
 * constants and must never be mutated in place, or a value would compound every
 * frame until the limb angles overflowed to Infinity and produced NaN drawing
 * coordinates.
 */
function shapePose(src: Pose, L: Look | undefined, speed = 0): Pose {
  const t = traitOf(L);
  const s: Pose = {
    lean: src.lean, head: src.head, rot: src.rot,
    aF: [src.aF[0], src.aF[1]], aB: [src.aB[0], src.aB[1]],
    lF: [src.lF[0], src.lF[1]], lB: [src.lB[0], src.lB[1]],
    wep: src.wep,
  };
  s.lean += t.lean;
  s.head += t.headLean;
  s.wep += t.wep;
  s.aF = [s.aF[0] + t.arm[0], s.aF[1] + t.arm[1]];
  s.aB = [s.aB[0] + t.guard[0], s.aB[1] + t.guard[1]];
  // Long-limbed archetypes carry their limbs further; compact ones tuck in.
  const r = t.reach;
  s.lF = [s.lF[0] * r, s.lF[1] * r];
  s.lB = [s.lB[0] * r, s.lB[1] * r];
  // Running pulls the body forward and lowers the stance.
  if (speed > 0.5) { s.lean += 0.12 * Math.min(1, speed / 6); s.lF = [s.lF[0] * .82, s.lF[1] - .18]; s.lB = [s.lB[0] * .82, s.lB[1] - .18]; }
  return s;
}

/** Per-archetype idle: breath, bounce, sway or a coiled ready stance. */
function idlePose(t: number, look: Look | undefined): Pose {
  const plain = !artDirected(look);
  const style = look?.idle || (plain ? 'breathe' : 'breathe');
  const breathe = Math.sin(t * (plain ? 0.07 : 0.075)) * (plain ? 0.06 : 0.055);
  const p: Pose = {
    lean: 0.08, head: 0,
    aF: [0.45, 1.35], aB: [-0.25, 0.35], lF: [0.3, 0.02], lB: [-0.25, -0.08], wep: 2.1, rot: 0,
  };
  if (style === 'bounce') {
    const hop = Math.abs(Math.sin(t * 0.085));
    p.lean = 0.1 - hop * 0.06; p.aF = [0.5, 1.1 - hop * 0.35]; p.aB = [-0.4, 0.2 - hop * 0.3];
    p.lF = [0.32, 0.02 - hop * 0.2]; p.lB = [-0.28, -0.08 - hop * 0.2]; p.wep = 2.2 - hop * 0.2;
  } else if (style === 'still') {
    p.lean = 0.04; p.aF = [0.3, 1.5]; p.aB = [-0.3, 0.5]; p.wep = 2.3;
  } else if (style === 'float') {
    const up = Math.sin(t * 0.05) * 0.09;
    p.lean = 0.02 + up * .3; p.aF = [0.35, 1.1]; p.aB = [-0.5, 0.1]; p.lF = [0.2, 0.05]; p.lB = [-0.2, -0.12]; p.wep = 1.9;
  } else if (style === 'sway') {
    const s2 = Math.sin(t * 0.06);
    p.lean = 0.06 + s2 * 0.05; p.aF = [0.4 + s2 * .2, 1.3]; p.aB = [-0.3, 0.3 - s2 * .2]; p.wep = 2.05 + s2 * .2;
  } else if (style === 'coiled') {
    const c = Math.sin(t * 0.06) * 0.5 + 0.5;
    p.lean = 0.16 - c * 0.07; p.aF = [0.1, 0.85 + c * .3]; p.aB = [0.25, 1.1 - c * .25];
    p.lF = [0.45, 0.02]; p.lB = [-0.15, -0.42]; p.wep = 1.35 + c * .2;
  } else if (style === 'lean') {
    p.lean = 0.2 + breathe * .5; p.aF = [0.5, 1.0]; p.aB = [-0.35, 0.4]; p.wep = 2.5;
  } else {
    p.lean = 0.08 + breathe * .5; p.aF = [0.45 + breathe, 1.35 + breathe * 1.5];
    p.aB = [-0.25, 0.35]; p.lF = [0.3, 0.02]; p.lB = [-0.25, -0.08]; p.wep = 2.1;
  }
  return shapePose(p, look);
}
export function runPose(phase: number, ninja: boolean, style?: RunStyle, look?: Look): Pose {
  const s = Math.sin(phase), s2 = Math.sin(phase + Math.PI);
  const leg = (sn: number, ph: number): [number, number] => { const th = 0.85 * sn; return [th, th - (0.25 + 1.0 * (0.5 + 0.5 * Math.sin(ph - 1.3)))]; };
  const p = P(0.3, [0, 0], [0, 0], leg(s, phase), leg(s2, phase + Math.PI), -1.9);
  if (style === 'ninja' || ninja) { p.lean = 0.5; p.aF = [-1.25, -1.0]; p.aB = [-1.35, -1.1]; p.wep = -1.7; }
  else if (style === 'pumped') { p.lean = 0.34; p.aF = [0.55 - s * 0.9, 2.0 - s * 0.5]; p.aB = [-0.6 + s * 0.8, 1.9 - s * 0.4]; p.wep = 0.4 - s * 0.5; }
  else if (style === 'float') { p.lean = 0.2; p.aF = [-0.5 - s * 0.5, -0.4 - s * 0.4]; p.aB = [-1.1, -0.9]; p.lF = [s * 0.55, s * 0.7]; p.lB = [s2 * 0.55, s2 * 0.7]; p.wep = -1.2; }
  else if (style === 'skater') { p.lean = 0.46; p.aF = [-0.9 - s * 0.4, -0.8]; p.aB = [0.9 + s * 0.3, 1.4]; p.wep = -1.1; }
  else if (style === 'dash') { p.lean = 0.58; p.aF = [-1.5, -1.2]; p.aB = [0.9, 1.5]; p.wep = -1.5; }
  else if (style === 'waddle') { p.lean = 0.24; p.aF = [0.2 - s * 0.5, 1.6]; p.aB = [-0.2 + s * 0.5, 1.6]; p.wep = 1.6; }
  else { p.aF = [-0.8 * s + 0.2, -0.8 * s + 1.3]; p.aB = [0.8 * s - 0.1, 0.8 * s + 0.9]; p.wep = -0.8 * s - 1.3; }
  return shapePose(p, look);
}

export function computePose(f: any): Pose {
  const t = f.animT as number;
  const look: Look | undefined = f.look;
  const speed = Math.abs(f.vx || 0);
  let base: Pose;
  if (f.grounded) {
    base = idlePose(t, look);
  } else base = shapePose(f.vy < 0 ? lerpPose(POSES.fall, POSES.jump, Math.min(1, -f.vy / 8)) : POSES.fall, look);

  switch (f.state) {
    case 'run': return runPose(f.runPhase, !!look?.ninjaRun, look?.run || (look?.ninjaRun ? 'ninja' : undefined), look);
    case 'dash': return shapePose({ ...runPose(f.runPhase, true, 'dash', look), lean: 0.7 }, look);
    case 'wall': return shapePose(POSES.wall, look);
    case 'hitstun': {
      // A light hit folds the body; a heavy one throws it backwards.
      const power = Math.min(1, (f.lastHitDmg || 0) / 22);
      const p = lerpPose(POSES.hurt, { ...POSES.hurt, lean: -0.95, aF: [-1.8, -1.0], aB: [-2.0, -2.2], rot: 0 }, power);
      p.rot = f.tumble; p.head = -power * 0.3;
      return shapePose(p, look, 0);
    }
    case 'dodge': {
      if (f.grounded) return shapePose(lerpPose(base, POSES.dodgeG, (artDirected(look) ? easeLoad : ease)(Math.min(f.stateT, 20 - f.stateT) / 5)), look, speed);
      return shapePose(lerpPose(base, POSES.tuck, (artDirected(look) ? easeLoad : ease)(Math.min(f.stateT, 20 - f.stateT) / 5)), look, speed);
    }
    case 'attack': {
      const m = f.move; const fr = f.moveFrame;
      const a = ANIMS[m.anim as AnimName] || ANIMS.slash;
      const st = Math.max(1, m.startup);
      const actEnd = f.moveActiveEnd;
      let p: Pose;
      // Art-directed fighters get anticipation, an overshooting strike and a slow
      // recovery. Unstyled ones (Sukuna) keep the original quadratic timing.
      const tuned = artDirected(look);
      if (fr < st) p = lerpPose(base, a.w, tuned ? easeLoad(fr / st) : ease(fr / st));
      else if (fr < st + 3) p = lerpPose(a.w, a.s, tuned ? easeSnap((fr - st) / 3) : (fr - st) / 3);
      else {
        const rem = m.dur - fr, rl = Math.max(6, (m.dur - actEnd) * 0.55);
        p = rem < rl ? lerpPose(base, a.s, tuned ? easeSettle(rem / rl) : rem / rl) : { ...a.s };
        if (tuned && !p.rot) p.head = Math.sin((fr - st) * 0.5) * 0.05 * Math.max(0, 1 - rem / Math.max(6, rl));
      }
      if (a.spin) {
        const turns = (m.turns || 1) * a.spin;
        const k = Math.min(1, Math.max(0, (fr - st) / Math.max(1, actEnd - st)));
        p.rot += turns * Math.PI * 2 * (tuned ? easeLoad(k) : ease(k));
      }
      return shapePose(p, look, 0);
    }
  }
  if (f.landT > 0) return shapePose(lerpPose(base, POSES.crouch, f.landT / 6), look);
  if (!f.grounded && f.djumpT < 20) {
    const p = { ...base };
    p.rot = (f.djumpT / 20) * Math.PI * 2; return shapePose(lerpPose(p, POSES.tuck, Math.sin((f.djumpT / 20) * Math.PI) * 0.8), look);
  }
  return base;
}

// ---------------- drawing ----------------
export const OL = '#0b0b10';

/**
 * The resolved skeleton of one fighter for one frame, in body space (origin at
 * the feet, facing right, already scaled). A bespoke body renderer draws from
 * these joints, so it animates through every shared move exactly like the stock
 * model does - it only replaces what the joints are *dressed* in.
 */
export interface Skeleton {
  f: any; L: Look; pose: Pose; time: number; B: Build;
  hx: number; hy: number; cy: number;
  neck: [number, number]; sh: [number, number]; head: [number, number];
  elF: [number, number]; haF: [number, number]; elB: [number, number]; haB: [number, number];
  kneeF: [number, number]; footF: [number, number]; kneeB: [number, number]; footB: [number, number];
  limbW: number; legW: number;
}
/**
 * Returns the weapon/hand tip the engine should track for trails, or null to
 * use the front hand.
 */
export type BodyRenderer = (ctx: CanvasRenderingContext2D, k: Skeleton) => [number, number] | null;
const CUSTOM_BODIES: Record<string, BodyRenderer> = {};
/** Registers a fully bespoke body for a character id (see `Skeleton`). */
export function registerBody(id: string, fn: BodyRenderer) { CUSTOM_BODIES[id] = fn; }
/** Shadow DIO's signature gold; shared by the coat, clasps and Stand trim. */
const GOLD_TRIM = '#ffe45c';
/** Alpha applied to a `#rrggbb` colour, for translucent glows. */
export function hexA(hex: string, a: number) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const pt = (x: number, y: number, a: number, l: number): [number, number] => [x + Math.sin(a) * l, y + Math.cos(a) * l];

export function shade(c: string, k = 0.72) {
  if (c[0] !== '#' || c.length < 7) return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgb(${Math.floor(((n >> 16) & 255) * k)},${Math.floor(((n >> 8) & 255) * k)},${Math.floor((n & 255) * k)})`;
}
export function tint(c: string, k = 1.35) {
  if (c[0] !== '#' || c.length < 7) return c;
  const n = parseInt(c.slice(1, 7), 16);
  const m = (v: number) => Math.min(255, Math.floor(v * k));
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

export function limb(ctx: CanvasRenderingContext2D, pts: [number, number][], w: number, c: string, c2?: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = w + 3.6;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.lineWidth = w;
  if (c2 && pts.length === 3) {
    ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
    ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke();
  } else {
    ctx.strokeStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  // top-light highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, w * 0.3);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - w * 0.22) : ctx.moveTo(x, y - w * 0.22))); ctx.stroke();
}

/**
 * A two-segment limb drawn as a tapered, cel-shaded solid rather than a tube:
 * thick at the root, narrowing through the joint to the wrist or ankle. The
 * lower segment is drawn first so the upper one (a sleeve, a trouser leg)
 * overlaps it at the joint the way cloth does.
 */
export function taperLimb(ctx: CanvasRenderingContext2D, pts: [number, number][], widths: [number, number, number], c1: string, c2: string, split = 1) {
  const [a, b, c] = pts;
  const seg = (p: [number, number], q: [number, number], w0: number, w1: number, grow: number) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const r0 = w0 / 2 + grow, r1 = w1 / 2 + grow;
    ctx.beginPath();
    ctx.moveTo(p[0] + nx * r0, p[1] + ny * r0);
    ctx.lineTo(q[0] + nx * r1, q[1] + ny * r1);
    // Caps sweep *outward*: through +u at the far end, through -u at the root.
    ctx.arc(q[0], q[1], r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    ctx.lineTo(p[0] - nx * r0, p[1] - ny * r0);
    ctx.arc(p[0], p[1], r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
    ctx.closePath();
  };
  // A part-way split point lets trousers stop above the ankle (shorts, capris).
  const m: [number, number] = [b[0] + (c[0] - b[0]) * split, b[1] + (c[1] - b[1]) * split];
  const wm = widths[1] + (widths[2] - widths[1]) * split;
  ctx.fillStyle = OL;
  seg(b, c, widths[1], widths[2], 1.8); ctx.fill();
  seg(a, b, widths[0], widths[1], 1.8); ctx.fill();
  // Lower segment.
  const shadeSeg = (p: [number, number], q: [number, number], w0: number, w1: number, col: string) => {
    seg(p, q, w0, w1, 0);
    ctx.fillStyle = col; ctx.fill();
    ctx.save(); seg(p, q, w0, w1, 0); ctx.clip();
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    // Cel shadow on the side away from the key light (up and to the left).
    const sgn = ny < 0 ? -1 : 1;
    // Butt-capped and stopped short of both joints, so two segments' shading
    // never stacks into a dark blob at the elbow or knee.
    const ux = dx / L, uy = dy / L, i0 = Math.min(L * 0.3, w0 * 0.5), i1 = Math.min(L * 0.3, w1 * 0.5);
    const p0x = p[0] + ux * i0, p0y = p[1] + uy * i0, q0x = q[0] - ux * i1, q0y = q[1] - uy * i1;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = Math.max(w0, w1) * 0.42;
    ctx.beginPath(); ctx.moveTo(p0x + nx * sgn * w0 * 0.4, p0y + ny * sgn * w0 * 0.4); ctx.lineTo(q0x + nx * sgn * w1 * 0.4, q0y + ny * sgn * w1 * 0.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = Math.max(1, Math.min(w0, w1) * 0.2);
    ctx.beginPath(); ctx.moveTo(p0x - nx * sgn * w0 * 0.24, p0y - ny * sgn * w0 * 0.24); ctx.lineTo(q0x - nx * sgn * w1 * 0.24, q0y - ny * sgn * w1 * 0.24); ctx.stroke();
    ctx.restore();
  };
  if (split < 1) {
    shadeSeg(m, c, wm, widths[2], c2);
    shadeSeg(b, m, widths[1], wm, c1);
    // Hem line where the fabric ends.
    const dx = c[0] - b[0], dy = c[1] - b[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(m[0] + nx * wm * 0.55, m[1] + ny * wm * 0.55); ctx.lineTo(m[0] - nx * wm * 0.55, m[1] - ny * wm * 0.55); ctx.stroke();
    shadeSeg(a, b, widths[0], widths[1], c1);
  } else {
    shadeSeg(b, c, widths[1], widths[2], c2);
    shadeSeg(a, b, widths[0], widths[1], c1);
  }
}

/**
 * A hand. Fists by default - these are fighters - with the knuckle ridge and
 * a tucked thumb; an open palm for casters and palm strikes. `ang` is the
 * forearm's direction, so the hand always continues the arm.
 */
export function drawStockHand(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, col: string, open: boolean) {
  const s = size;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, tint(col, 1.12)); g.addColorStop(1, shade(col, 0.82));
  if (open) {
    // Palm with four short fingers fanned forward and a thumb out to the side.
    for (let i = 0; i < 4; i++) {
      const fy = (i - 1.5) * s * 0.36;
      ctx.strokeStyle = OL; ctx.lineWidth = s * 0.42 + 2;
      ctx.beginPath(); ctx.moveTo(s * 0.4, fy); ctx.lineTo(s * 1.35 - Math.abs(i - 1.5) * s * 0.18, fy * 1.15); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = s * 0.42;
      ctx.beginPath(); ctx.moveTo(s * 0.4, fy); ctx.lineTo(s * 1.35 - Math.abs(i - 1.5) * s * 0.18, fy * 1.15); ctx.stroke();
    }
    ctx.fillStyle = g; ctx.strokeStyle = OL; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.ellipse(s * 0.2, 0, s * 0.72, s * 0.78, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = s * 0.4 + 2;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.55, -s * 1.1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.4;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.55, -s * 1.1); ctx.stroke();
  } else {
    // Fist: a squared mass, four knuckle bumps on the leading edge, the thumb
    // wrapped across the front.
    ctx.fillStyle = g; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(-s * 0.55, -s * 0.8, s * 1.55, s * 1.6, s * 0.5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.9;
    for (let i = 1; i < 4; i++) { const fy = -s * 0.8 + i * s * 0.4; ctx.beginPath(); ctx.moveTo(s * 0.55, fy); ctx.lineTo(s * 1.0, fy); ctx.stroke(); }
    ctx.fillStyle = shade(col, 0.9); ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.42, s * 0.5, s * 0.26, -0.3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(s * 0.5, -s * 0.5, s * 0.34, s * 0.14, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/**
 * Footwear, planted flat on the floor when standing and pointed with the shin
 * in the air. `boots` rise over the ankle, `shoes` are low and pointed,
 * `sandals` and `bare` show the foot, `tabi` is the split-toe ninja/samurai
 * sock with a strapped sandal.
 */
export function drawFootwear(ctx: CanvasRenderingContext2D, knee: [number, number], foot: [number, number], style: NonNullable<Look['footwear']>, col: string, skin: string, grounded: boolean, w: number) {
  const shin = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
  const ang = grounded ? 0 : Math.max(-0.2, Math.min(0.9, shin - Math.PI / 2));
  ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(ang);
  ctx.lineJoin = 'round';
  const L = w * 1.55, H = w * 0.62;
  const sole = () => {
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -H);
    ctx.quadraticCurveTo(L * 0.5, -H * 1.15, L, -H * 0.2);
    ctx.quadraticCurveTo(L + 1.2, H * 0.3, L - 1, H * 0.45);
    ctx.lineTo(-w * 0.55, H * 0.45);
    ctx.closePath();
  };
  if (style === 'bare' || style === 'sandals') {
    sole();
    ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(L - 1 - i * 1.8, -H * 0.1); ctx.lineTo(L - 1 - i * 1.8, H * 0.35); ctx.stroke(); }
    if (style === 'sandals') {
      ctx.fillStyle = col; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.rect(-w * 0.55, H * 0.35, L + w * 0.5, 2.2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(L * 0.5, -H * 0.9); ctx.lineTo(L * 0.7, H * 0.35); ctx.moveTo(L * 0.5, -H * 0.9); ctx.lineTo(L * 0.2, H * 0.35); ctx.stroke();
    }
  } else if (style === 'tabi') {
    sole();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(L * 0.72, -H * 0.5); ctx.lineTo(L * 0.72, H * 0.4); ctx.stroke();
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-w * 0.55, H * 0.3, L + w * 0.5, 2);
  } else {
    // Boots and shoes: a solid leather upper with a lit toe and a dark sole.
    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0, tint(col, 1.18)); g.addColorStop(1, shade(col, 0.72));
    if (style === 'boots') {
      ctx.fillStyle = g; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(-w * 0.6, -H - w * 0.9, w * 1.15, w * 1.2, 2); ctx.fill(); ctx.stroke();
    }
    sole();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = shade(col, 0.45); ctx.fillRect(-w * 0.55, H * 0.1, L + w * 0.5, H * 0.35);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(L * 0.6, -H * 0.55, L * 0.2, H * 0.18, -0.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

const HAIR: Record<HairStyle, [number, number, number][]> = {
  bowl: [[-160, 3, 24], [-120, 5, 22], [-80, 6, 22], [-40, 7, 22], [0, 7, 22], [40, 7, 20], [80, 8, 14], [108, 6, 10]],
  spikeShort: [[-163, 9, 16], [-130, 13, 15], [-98, 15, 15], [-64, 16, 15], [-30, 16, 14], [4, 15, 14], [40, 13, 14], [76, 10, 13], [104, 7, 11]],
  spikeLong: [[-168, 15, 16], [-138, 21, 16], [-106, 24, 15], [-72, 25, 15], [-38, 24, 14], [-2, 21, 14], [34, 18, 14], [70, 14, 13], [100, 9, 12]],
  flame: [[-172, 17, 14], [-145, 22, 15], [-115, 25, 15], [-82, 25, 14], [-48, 23, 14], [-15, 20, 14], [20, 17, 14], [55, 13, 13], [88, 9, 12]],
  mane: [[-178, 34, 12], [-158, 38, 15], [-135, 32, 16], [-105, 22, 16], [-70, 17, 16], [-35, 15, 15], [0, 14, 15], [35, 12, 14], [70, 10, 13], [100, 13, 9]],
  messy: [[-152, 7, 18], [-114, 12, 16], [-74, 15, 15], [-34, 16, 14], [4, 15, 14], [42, 13, 13], [78, 8, 12]],
  bald: [[-150, 1, 20], [-90, 1, 20], [-30, 1, 20], [30, 1, 20], [90, 1, 16]],
  ponytail: [[-176, 30, 11], [-150, 12, 16], [-112, 11, 16], [-72, 12, 15], [-32, 12, 15], [8, 11, 14], [48, 9, 13], [86, 6, 12]],
  swept: [[-170, 26, 14], [-140, 24, 15], [-108, 19, 15], [-70, 15, 15], [-30, 13, 14], [10, 12, 14], [50, 10, 13], [88, 7, 12]],
  twin: [[-168, 26, 10], [-140, 9, 16], [-100, 11, 16], [-58, 12, 15], [-16, 12, 15], [28, 11, 14], [70, 9, 13], [104, 20, 10]],
  // Side-swept wall with a hard widow's peak: the JoJo "villain" silhouette.
  undercut: [[-166, 30, 18], [-134, 22, 20], [-100, 17, 20], [-62, 14, 19], [-24, 12, 17], [16, 12, 16], [56, 11, 15], [92, 8, 13]],
  wolf: [[-172, 12, 20], [-140, 20, 18], [-104, 24, 16], [-66, 25, 15], [-28, 23, 14], [10, 20, 14], [48, 15, 13], [84, 9, 12]],
  bob: [[-160, 10, 22], [-120, 13, 21], [-78, 15, 20], [-34, 16, 19], [10, 15, 18], [52, 12, 17], [92, 7, 14]],
  crest: [[-160, 6, 20], [-116, 8, 19], [-70, 10, 18], [-24, 11, 17], [22, 10, 16], [66, 8, 15], [104, 5, 12]],
  heart: [[-172, 26, 18], [-138, 28, 19], [-104, 26, 18], [-70, 22, 17], [-36, 19, 16], [-2, 17, 15], [34, 13, 14], [70, 9, 12], [100, 6, 10]],
  // Blond mane swept back off the brow with the long flared tails that make DIO
  // read as DIO at a glance, even at thumbnail size.
  dio: [[-176, 38, 12], [-150, 34, 14], [-122, 29, 15], [-92, 26, 15], [-60, 24, 15], [-26, 22, 14], [10, 19, 14], [46, 16, 13], [80, 12, 12], [110, 9, 10]],
  // Authentic Super Saiyan Rosé: large flared curved horns with dramatic upward silhouette
  rose: [[-178, 52, 18], [-152, 60, 20], [-122, 66, 22], [-88, 62, 20], [-52, 52, 18], [-14, 42, 16], [24, 34, 15], [62, 26, 14], [96, 18, 12]],
  // Mastered Ultra Instinct, read as [angle, tip radius in head radii, lock
  // half-width in degrees]. The anime form is a *dense platinum mass with points
  // cut into its edge*, not a fan of long needles: the valleys all sit at 1.04r,
  // hard against the skull, and the tips only reach 1.3-2.0r. A wider spread of
  // tips reads as a sea urchin with the head in the middle of it; too few locks
  // reads as a handful of slivers. Twelve is the number that closes the mass.
  // The crown is heaviest between 100 and 160 degrees off the brow, so it rises
  // behind the skull the way the form does, and the two rearmost locks are the
  // short nape flicks.
  ui: [[-166, 1.30, 15], [-145, 1.62, 16], [-121, 1.82, 16], [-95, 1.94, 17],
  [-69, 1.90, 16], [-43, 1.74, 15], [-17, 1.56, 15], [9, 1.40, 14],
  [33, 1.24, 13], [55, 1.12, 12], [74, 1.05, 11]],
};
/**
 * Styles whose volume is drawn behind the skull rather than over the face.
 *
 * `ui` is deliberately NOT here. Every other entry is genuinely long - a mane, a
 * ponytail, a bob - so it has to sit behind the head to leave the face clear. The
 * Ultra Instinct crown is short, dense and capped over the skull, so drawing it
 * behind means the head covers the entire mass and only the tips survive: a ring
 * of spikes around a bald dome. It is drawn over instead, like every other short
 * style, and the widow's peak in its own path is what keeps the face clear.
 */
const BACK_HAIR: HairStyle[] = ['mane', 'ponytail', 'twin', 'undercut', 'bob', 'heart', 'dio', 'rose'];

function hair(ctx: CanvasRenderingContext2D, hx: number, hy: number, r: number, style: HairStyle, color: string, t: number, sway: number, scaleLen = 1, detailed = true) {
  if (style === 'bald') return;
  if (style === 'rose') {
    // Dedicated Toriyama Super Saiyan Rosé hair geometry:
    // 5 prominent curved swept horns + 3 sharp brow bangs framing the face
    const horn = (baseX: number, baseY: number, tipX: number, tipY: number, ctrlX: number, ctrlY: number) => {
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.quadraticCurveTo(ctrlX + 6, ctrlY + 8, baseX, baseY);
    };
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.95, hy + r * 0.2);
    // Horn 1: Low left horn
    horn(hx - r * 1.25, hy - r * 0.7, hx - r * 2.3 + sway * 0.1, hy - r * 1.8, hx - r * 2.1, hy - r * 0.6);
    // Horn 2: Swept upper-left horn
    horn(hx - r * 0.85, hy - r * 1.6, hx - r * 1.7 + sway * 0.08, hy - r * 2.9, hx - r * 1.6, hy - r * 1.9);
    // Horn 3: Giant crown lock (tallest spike)
    horn(hx - r * 0.2, hy - r * 1.95, hx - r * 0.65 + sway * 0.05, hy - r * 3.3, hx - r * 0.75, hy - r * 2.4);
    // Horn 4: Upper right lock
    horn(hx + r * 0.6, hy - r * 1.6, hx + r * 0.9, hy - r * 2.7, hx + r * 0.55, hy - r * 2.1);
    // Horn 5: Lateral right lock
    horn(hx + r * 1.15, hy - r * 0.6, hx + r * 1.8, hy - r * 1.5, hx + r * 1.55, hy - r * 0.9);
    // Brow bangs framing the forehead:
    ctx.quadraticCurveTo(hx + r * 0.8, hy - r * 0.35, hx + r * 0.45, hy + r * 0.15);
    ctx.quadraticCurveTo(hx + r * 0.25, hy - r * 0.45, hx + 1, hy - r * 0.25);
    ctx.quadraticCurveTo(hx - r * 0.08, hy + r * 0.25, hx - r * 0.35, hy + r * 0.15);
    ctx.quadraticCurveTo(hx - r * 0.45, hy - r * 0.35, hx - r * 0.65, hy - r * 0.15);
    ctx.quadraticCurveTo(hx - r * 0.75, hy + r * 0.35, hx - r * 0.95, hy + r * 0.2);
    ctx.closePath();

    const g = ctx.createLinearGradient(hx - r * 1.5, hy - r * 3.1, hx + r, hy + r);
    g.addColorStop(0, '#fdf2f8');
    g.addColorStop(0.25, color);
    g.addColorStop(0.7, shade(color, 0.85));
    g.addColorStop(1, shade(color, 0.5));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = OL; ctx.stroke();

    if (detailed) {
      ctx.save(); ctx.clip();
      ctx.strokeStyle = shade(color, 0.45); ctx.lineWidth = 1.8; ctx.beginPath();
      // Inner spike depth grooves
      ctx.moveTo(hx - r * 0.7, hy - r * 1.5); ctx.quadraticCurveTo(hx - r * 1.1, hy - r * 2.0, hx - r * 1.5, hy - r * 2.5);
      ctx.moveTo(hx - r * 0.1, hy - r * 1.7); ctx.quadraticCurveTo(hx - r * 0.4, hy - r * 2.2, hx - r * 0.55, hy - r * 2.8);
      ctx.moveTo(hx + r * 0.5, hy - r * 1.4); ctx.quadraticCurveTo(hx + r * 0.6, hy - r * 2.0, hx + r * 0.75, hy - r * 2.4);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(hx - r * 0.5, hy - r * 2.1); ctx.lineTo(hx - r * 0.4, hy - r * 2.8);
      ctx.moveTo(hx - r * 1.2, hy - r * 1.8); ctx.lineTo(hx - r * 1.35, hy - r * 2.4);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  const sp = HAIR[style];
  if (style === 'ui') {
    // ---- MASTERED ULTRA INSTINCT ---------------------------------------------
    // Same polar construction as every other style: an angle, a lock length and
    // a lock half-width, walked valley -> tip -> valley. A bespoke polygon was
    // tried here first and it read as a flat paper shard, because one closed
    // outline with five notches cut into it is a *shape*, not hair. What makes
    // hair read at this size is repetition: many crisp tips of unequal length,
    // each separated by background, over a solid mass at the skull.
    //
    // What is specific to the form is the proportion - the locks are far longer
    // than any other style and swept up and *back*, heaviest between 100 and 160
    // degrees off the brow, so the crown rises behind the skull instead of
    // sitting on top of it. Nothing hangs; the whole read is a body that has
    // stopped obeying gravity.
    const breathe = Math.sin(t * .05) * 1.1 + sway * .05;
    const locks = HAIR.ui;
    const silhouette = (g = 0) => {
      ctx.beginPath();
      // Start behind the skull, low, so the mass closes over the back of the head.
      ctx.moveTo(hx - r * 1.06 * (1 + g * .1), hy + r * .16 * (1 + g * .16));
      for (let i = 0; i < locks.length; i++) {
        const [deg, tipR, wid] = locks[i];
        const a = deg * Math.PI / 180;
        const w = wid * Math.PI / 180;
        // Each lock breathes on its own phase; one shared phase reads as the
        // whole head bobbing rather than as hair catching the light.
        const ph = Math.sin(t * .07 + i * 1.7);
        const valley = r * 1.04 * (1 + g * .1);
        const reach = r * tipR * (detailed ? 1 : .88) * (1 + g * .12) * (1 + ph * .02);
        const tipA = a + ph * .016;
        ctx.lineTo(hx + Math.sin(a - w) * valley, hy - Math.cos(a - w) * valley);
        ctx.lineTo(hx + Math.sin(tipA) * reach, hy - Math.cos(tipA) * reach + (reach > valley * 1.4 ? breathe * .04 : 0));
        ctx.lineTo(hx + Math.sin(a + w) * valley, hy - Math.cos(a + w) * valley);
      }
      // Three-point widow's peak, at the same heights every other style uses.
      // The hair is drawn *over* the face, so this edge is the only thing keeping
      // the eye alive: the forward side has to stay above the brow, and the
      // shape is allowed to drop only behind the far cheek. The generic spiky
      // path's values are used verbatim because they were tuned against the eye.
      ctx.lineTo(hx + r * .86, hy - r * .34);
      ctx.lineTo(hx + r * .50, hy - r * .66);
      ctx.lineTo(hx + r * .22, hy - r * .24);
      ctx.lineTo(hx - r * .18, hy - r * .58);
      ctx.lineTo(hx - r * .62, hy - r * .08);
      ctx.lineTo(hx - r * .80, hy + r * .34);
      ctx.closePath();
    };

    silhouette(0);
    // Platinum body: white-hot at the crown cooling to blue at the tips. The
    // gradient *is* the shading - a flat silver fill at this size is just grey.
    const g = ctx.createLinearGradient(hx - r * 1.4, hy - r * 3.4, hx + r * 1.2, hy + r * .4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(.22, '#f6faff');
    g.addColorStop(.48, '#dde8f7');
    g.addColorStop(.76, '#aac3e2');
    g.addColorStop(1, '#7199cb');
    ctx.fillStyle = g; ctx.fill();
    // One heavy outline around the whole mass: this single line is what makes the
    // hair read as a solid object rather than a cloud of light. It has to stay
    // thin in absolute terms - a lock here is only ~5px across at the base, so a
    // 3px stroke consumes the whole lock and the crown turns into a dark pinwheel.
    // The generic styles use 1.6px for exactly this reason.
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = OL; ctx.stroke();

    if (detailed) {
      ctx.save(); ctx.clip();
      // Interior seams: one groove per lock, raked along the flow. Kept light -
      // twelve seams at full strength is a second outline on every lock.
      ctx.strokeStyle = 'rgba(56,86,124,.34)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < locks.length; i++) {
        const [deg, tipR] = locks[i];
        const a = (deg - 6) * Math.PI / 180, a2 = (deg + 6) * Math.PI / 180;
        const e = r * tipR * .96, s = r * 1.02;
        ctx.moveTo(hx + Math.sin(a) * s, hy - Math.cos(a) * s);
        ctx.quadraticCurveTo(hx + Math.sin(a) * (s + (e - s) * .6), hy - Math.cos(a) * (s + (e - s) * .6), hx + Math.sin(a2) * e, hy - Math.cos(a2) * e);
      }
      ctx.stroke();
      // Shadow shelf under the crown, so the mass has a top and a bottom.
      ctx.fillStyle = 'rgba(52,82,122,.22)';
      ctx.beginPath(); ctx.ellipse(hx, hy - r * .05, r * 1.5, r * .5, 0, 0, 7); ctx.fill();
      // Specular band along the upper left: the metal read, in one stroke.
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.0, hy - r * 1.2);
      ctx.quadraticCurveTo(hx - r * .55, hy - r * 2.1, hx + r * .25, hy - r * 1.7);
      ctx.stroke();
      ctx.restore();
    }
    // Corona: the same silhouette re-stroked additively, so the hair emits.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .26; ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    silhouette(0); ctx.stroke();
    ctx.globalAlpha = .18; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
    silhouette(0); ctx.stroke();
    // Stardust shedding off the highest locks and drifting out of frame.
    if (detailed) for (let i = 0; i < 6; i++) {
      const lock = locks[1 + (i % 4)];
      const a = lock[0] * Math.PI / 180, e = r * lock[1];
      const ph = (t * .8 + i * 41) % 70 / 70;
      ctx.globalAlpha = .45 * (1 - ph);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#93c5fd';
      ctx.beginPath();
      ctx.arc(hx + Math.sin(a) * e * (1 + ph * .18), hy - Math.cos(a) * e - ph * r * 1.2, 1 + (1 - ph) * 1.6, 0, 7);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.beginPath(); ctx.moveTo(hx - r, hy + 1);
  if (style === 'bowl') {
    ctx.bezierCurveTo(hx - r * 1.4, hy - r * 1.65, hx + r * .65, hy - r * 1.65, hx + r, hy - r * .65);
  } else {
    const n = sp.length;
    sp.forEach(([, len], i) => {
      const u = n > 1 ? i / (n - 1) : 0.5;
      const a = (-100 + u * 166) * Math.PI / 180;
      const w = 7 * Math.PI / 180;
      // A uniform ring of spikes reads as a sea urchin. Tapering the crown into a
      // single mass and letting the front fringe drop forward gives real hair.
      const crown = detailed ? 0.46 + 0.72 * Math.sin(Math.PI * Math.pow(u, 0.85)) : 1;
      const forward = detailed ? Math.pow(u, 2.2) * r * 0.3 : 0;
      const extension = len * scaleLen * (style === 'mane' ? .62 : .43) * crown;
      const drift = Math.sin(t * .09 + i) * .6 + sway * .035 - forward;
      ctx.lineTo(hx + Math.sin(a - w) * r, hy - Math.cos(a - w) * r);
      ctx.lineTo(hx + Math.sin(a) * (r + extension) - drift, hy - Math.cos(a) * (r + extension));
      ctx.lineTo(hx + Math.sin(a + w) * r, hy - Math.cos(a + w) * r);
    });
  }
  // The fringe stays above the eyes; never close the hair polygon across the face.
  ctx.lineTo(hx + r * .8, hy - r * .32); ctx.lineTo(hx + r * .45, hy - r * .62);
  ctx.lineTo(hx + r * .2, hy - r * .23); ctx.lineTo(hx - r * .2, hy - r * .55);
  ctx.lineTo(hx - r * .65, hy - r * .1); ctx.lineTo(hx - r * .7, hy + r * .35);
  ctx.closePath();
  const g = ctx.createLinearGradient(hx, hy - r * 2.4, hx, hy + r);
  g.addColorStop(0, tint(color, 1.45)); g.addColorStop(.5, color); g.addColorStop(1, shade(color, .6));
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = OL; ctx.stroke();
  if (!detailed) return;
  // Two cel-shadow strands so the mass reads as hair rather than a helmet.
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.moveTo(hx - r * .65, hy - r * .6); ctx.quadraticCurveTo(hx - r * .3, hy - r * 1.1, hx + r * .5, hy - r * .82); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(hx + r * .8, hy - r * .3); ctx.quadraticCurveTo(hx + r * .1, hy - r * .95, hx - r * .8, hy - r * .35); ctx.stroke();
  ctx.restore();
}

/** Anime eye. `style` changes the aperture so each fighter reads at a glance. */
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, L: Look, lit = false) {
  const style = L.eyeStyle || 'sharp';
  // Ultra Instinct: a silver iris with concentric dark rings and a blown-out
  // halo. The pupil is a void, so the eye never looks like it is focusing.
  if (L.hairStyle === 'ui') {
    const w = 4.5, h = 3.2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y, .5, x, y, w * 3.4);
    halo.addColorStop(0, 'rgba(255,255,255,.95)');
    halo.addColorStop(.26, 'rgba(226,232,240,.7)');
    halo.addColorStop(.6, 'rgba(147,197,253,.34)');
    halo.addColorStop(1, 'rgba(147,197,253,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.ellipse(x, y, w * 3.4, h * 3.4, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f4f8ff'; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y - .2, w, h, -.08, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.ellipse(x + .6, y, w * .72, h * .92, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.ellipse(x + .6, y, w * .5, h * .72, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.ellipse(x + 1, y + .1, w * .3, h * .62, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.ellipse(x + 1, y + .1, w * .3, h * .62, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + 1.4, y - h * .5, w * .3, 0, 7); ctx.fill();
    if (lit) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x + .6, y, w * .34, h * .5, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    // Low, flat Ultra Instinct brow.
    ctx.strokeStyle = OL; ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(x - 4.2, y - 2.6); ctx.lineTo(x + 4.4, y - 2.1); ctx.stroke();
    return;
  }
  // ---- default anime eye -------------------------------------------------
  // The aperture is ALMOND, not round, and the iris fills most of it. A white
  // disc with a dot in the middle is the single thing that makes a face read as
  // a cartoon rather than as anime, so the lash line is the dominant feature
  // and the sclera is only a sliver above and below the iris.
  const w = style === 'narrow' ? 3.4 : style === 'round' ? 4.0 : style === 'glowing' ? 4.2 : 3.8;
  const h = style === 'narrow' ? 1.5 : style === 'round' ? 2.8 : style === 'glowing' ? 2.5 : 2.2;
  const tilt = style === 'round' ? .18 : .34;          // outer corner rides high
  const inner: [number, number] = [x - w, y + h * .18];
  const peak: [number, number] = [x - w * .16, y - h * 1.02];
  const outer: [number, number] = [x + w, y - h * tilt];
  const lower: [number, number] = [x - w * .34, y + h * .74];
  const aperture = () => {
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1]);
    ctx.quadraticCurveTo(peak[0], peak[1] - h * .18, peak[0] + w * .1, peak[1]);
    ctx.quadraticCurveTo(outer[0] - w * .4, outer[1] - h * .22, outer[0], outer[1]);
    ctx.quadraticCurveTo(lower[0] + w * .3, lower[1] + h * .3, lower[0], lower[1]);
    ctx.quadraticCurveTo(inner[0] + w * .3, inner[1] - h * .16, inner[0], inner[1]);
    ctx.closePath();
  };
  // Powered eyes bleed their colour into the air around them.
  if (lit) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .5; ctx.fillStyle = L.eye;
    ctx.beginPath(); ctx.ellipse(x, y - h * .2, w * 2.1, h * 1.9, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  aperture();
  ctx.fillStyle = '#eef2fb'; ctx.fill();
  ctx.clip();
  // Iris, filling the aperture, with the classic dark band under the upper lid.
  const ig = ctx.createLinearGradient(0, y - h * 1.1, 0, y + h);
  ig.addColorStop(0, shade(L.eye, .52));
  ig.addColorStop(.45, L.eye);
  ig.addColorStop(1, tint(L.eye, 1.25));
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.ellipse(x + w * .06, y - h * .06, w * .74, h * 1.02, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(10,14,24,.34)';
  ctx.beginPath(); ctx.ellipse(x + w * .06, y - h * .92, w * .8, h * .5, 0, 0, 7); ctx.fill();
  // Pupil + the two specular hits that make an eye look wet.
  ctx.fillStyle = '#141a26';
  ctx.beginPath(); ctx.ellipse(x + w * .04, y - h * .04, w * .3, h * .56, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(x + w * .3, y - h * .48, w * .26, h * .3, .3, 0, 7); ctx.fill();
  ctx.globalAlpha = .7;
  ctx.beginPath(); ctx.ellipse(x - w * .26, y + h * .38, w * .15, h * .16, 0, 0, 7); ctx.fill();
  ctx.restore();
  // The lash line: thick at the outer corner, tapering into the inner one.
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(inner[0], inner[1]);
  ctx.quadraticCurveTo(peak[0], peak[1] - h * .2, peak[0] + w * .1, peak[1]);
  ctx.quadraticCurveTo(outer[0] - w * .4, outer[1] - h * .2, outer[0], outer[1]);
  ctx.stroke();
  // A flick off the outer corner — the detail that sells the eye as anime.
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(outer[0] - .3, outer[1] + .1);
  ctx.quadraticCurveTo(outer[0] + w * .3, outer[1] - h * .3, outer[0] + w * .42, outer[1] - h * .58);
  ctx.stroke();
  // Lower lid, light and thin.
  ctx.strokeStyle = 'rgba(60,44,40,.5)'; ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(lower[0], lower[1]);
  ctx.quadraticCurveTo(lower[0] + w * .34, lower[1] + h * .3, x - w * .92, y + h * .1);
  ctx.stroke();
  // Brow: thin and angled, sitting clear of the lid.
  ctx.strokeStyle = shade(L.hair, .72); ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(x - w * 1.02, y - h * 1.9 - tilt * 1.2);
  ctx.quadraticCurveTo(x + w * .1, y - h * 2.5 - tilt * 1.4, x + w * 1.05, y - h * 1.75 - tilt);
  ctx.stroke();
}

function drawBackDetails(ctx: CanvasRenderingContext2D, f: any, sh: [number, number], hipY: number, time: number) {
  const id = f.def?.styleId || f.def?.id || '';
  const flutter = Math.sin(time * .18) * 3;
  if (id === 'rengoku') {
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? '#f3eee4' : '#b51f2a'; ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(sh[0] - 3, sh[1] - 1); ctx.lineTo(sh[0] - 24, hipY + 33); ctx.lineTo(sh[0] - 39 + flutter * side, hipY + 42); ctx.lineTo(sh[0] - 7, hipY + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff6a24'; ctx.beginPath(); ctx.moveTo(sh[0] - 13, sh[1] + 2); ctx.lineTo(sh[0] - 24, hipY + 31); ctx.lineTo(sh[0] - 16, hipY + 27); ctx.closePath(); ctx.fill();
    }
  } else if (id === 'tanjiro') {
    ctx.save(); ctx.fillStyle = '#1f6b52'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sh[0] - 4, sh[1] - 4); ctx.lineTo(sh[0] - 30, hipY + 37); ctx.lineTo(sh[0] + 9, hipY + 30); ctx.lineTo(sh[0] + 25, sh[1] - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.clip();
    for (let y = sh[1] - 4; y < hipY + 42; y += 9) for (let x = sh[0] - 34; x < sh[0] + 30; x += 9) { if ((Math.floor((x + 40) / 9) + Math.floor((y + 40) / 9)) % 2 === 0) { ctx.fillStyle = '#101820'; ctx.fillRect(x, y, 9, 9); } }
    ctx.restore();
  } else if (id === 'saitama') {
    ctx.fillStyle = '#f2f0e8'; ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sh[0] - 4, sh[1] - 3); ctx.quadraticCurveTo(sh[0] - 39, sh[1] + 15, sh[0] - 31 + flutter, hipY + 34); ctx.lineTo(sh[0] - 3, hipY + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (id === 'eren') {
    ctx.fillStyle = '#3f6b4d'; ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sh[0] - 3, sh[1] - 3); ctx.lineTo(sh[0] - 31, hipY + 38); ctx.lineTo(sh[0] + 3, hipY + 24); ctx.lineTo(sh[0] + 18, sh[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d6b46c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh[0] - 12, sh[1] + 4); ctx.lineTo(sh[0] - 22, hipY + 27); ctx.stroke();
  } else if (id === 'sasuke') {
    ctx.save(); ctx.translate(sh[0] - 7, sh[1] + 8); ctx.rotate(-.72); ctx.strokeStyle = OL; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 50); ctx.stroke(); ctx.strokeStyle = '#252a34'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  } else if (id === 'asta' && f.devilT > 0) {
    ctx.fillStyle = '#100207'; ctx.strokeStyle = '#e0203a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh[0] - 2, sh[1] - 2); ctx.lineTo(sh[0] - 26, sh[1] - 31); ctx.lineTo(sh[0] - 12, sh[1] + 12); ctx.lineTo(sh[0] + 11, sh[1] + 9); ctx.lineTo(sh[0] + 25, sh[1] - 29); ctx.lineTo(sh[0] + 4, sh[1] - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (id === 'deku') {
    ctx.strokeStyle = '#8dffb0'; ctx.lineWidth = 2; ctx.globalAlpha = .7; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.quadraticCurveTo(sh[0] + side * 20, sh[1] + 8, sh[0] + side * 13, hipY + 18); ctx.stroke(); } ctx.globalAlpha = 1;
  } else if (id === 'shadowdio') {
    drawDioBack(ctx, sh, hipY, flutter);
  } else if (id === 'gokublack') {
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? '#374151' : '#4b5563'; ctx.strokeStyle = OL; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sh[0] + side * 4, hipY - 2);
      ctx.lineTo(sh[0] + side * 16, hipY + 12);
      ctx.lineTo(sh[0] + side * 22 + flutter * side, hipY + 36);
      ctx.lineTo(sh[0] + side * 8, hipY + 28);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sh[0] + side * 6, hipY + 4);
      ctx.lineTo(sh[0] + side * 18 + flutter * side, hipY + 33);
      ctx.stroke();
    }
  }
}

/** Six-pointed star, the shape DIO's birthmark reads as at sprite scale. */
function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 3);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/**
 * Shadow DIO's back: the long gold coat tails with their green leather straps,
 * and the Joestar birthmark blazing on the shoulder blade. Drawn first so the
 * body silhouette lands on top of it.
 */
function drawDioBack(ctx: CanvasRenderingContext2D, sh: [number, number], hipY: number, flutter: number) {
  ctx.save();
  // Coat tails — two heavy gold panels hanging off the shoulders.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sh[0] + side * 3, sh[1] - 3);
    ctx.quadraticCurveTo(sh[0] + side * 26, sh[1] + 12, sh[0] + side * 22 + flutter * side, hipY + 40);
    ctx.lineTo(sh[0] + side * 8 + flutter * side, hipY + 33);
    ctx.lineTo(sh[0] + side * 2, hipY + 4);
    ctx.closePath();
    ctx.fillStyle = side < 0 ? '#c9a826' : '#e8c33a';
    ctx.strokeStyle = OL; ctx.lineWidth = 2.2; ctx.fill(); ctx.stroke();
    // green leather strap + buckle crossing each tail
    ctx.strokeStyle = '#245c46'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(sh[0] + side * 8, sh[1] + 6); ctx.lineTo(sh[0] + side * 17, hipY + 22); ctx.stroke();
    ctx.strokeStyle = '#7de0b0'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(sh[0] + side * 8, sh[1] + 6); ctx.lineTo(sh[0] + side * 17, hipY + 22); ctx.stroke();
    ctx.fillStyle = GOLD_TRIM; ctx.strokeStyle = OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sh[0] + side * 12 - 3, hipY + 9, 6, 5, 1.4); ctx.fill(); ctx.stroke();
  }
  // Joestar birthmark: a red star high on the shoulder blade.
  ctx.save();
  ctx.translate(sh[0] + 3, sh[1] + 7);
  ctx.rotate(-.28);
  ctx.fillStyle = '#e02545'; ctx.strokeStyle = '#7c0b1d'; ctx.lineWidth = 1;
  starPath(ctx, 0, 0, 6.4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,150,170,.75)';
  starPath(ctx, -.9, -.9, 2.4); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawFighterDetails(ctx: CanvasRenderingContext2D, f: any, L: Look, head: [number, number], neck: [number, number], sh: [number, number], hipY: number) {
  const id = f.def?.styleId || f.def?.id || '';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // universal belt and tunic panel add readable anatomy to every fighter.
  ctx.fillStyle = shade(L.pants, .8); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-9, hipY - 3, 18, 6, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.top2; ctx.fillRect(-2, hipY - 2, 4, 4);

  switch (id) {
    case 'levi': {
      ctx.strokeStyle = '#2d2118'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sh[0] - 8, sh[1] + 3); ctx.lineTo(sh[0] + 6, hipY - 4); ctx.moveTo(sh[0] + 8, sh[1] + 3); ctx.lineTo(sh[0] - 5, hipY - 4); ctx.stroke();
      ctx.fillStyle = '#e8eee9'; ctx.strokeStyle = '#2c6f4d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sh[0], sh[1] + 11, 7, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4b8f6b'; ctx.fillRect(sh[0] - 1, sh[1] + 6, 2, 10); ctx.fillRect(sh[0] - 5, sh[1] + 10, 10, 2); break;
    }
    case 'killua': {
      ctx.fillStyle = '#6a4c9c'; ctx.beginPath(); ctx.moveTo(sh[0] - 9, sh[1] + 1); ctx.lineTo(neck[0], neck[1] - 1); ctx.lineTo(sh[0] + 10, sh[1] + 2); ctx.lineTo(sh[0] + 4, sh[1] - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#d8f6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh[0] + 1, sh[1] + 8); ctx.lineTo(sh[0] - 3, sh[1] + 14); ctx.lineTo(sh[0] + 2, sh[1] + 14); ctx.lineTo(sh[0] - 2, sh[1] + 21); ctx.stroke(); break;
    }
    case 'rengoku': {
      ctx.fillStyle = '#f2eee5'; ctx.strokeStyle = OL; ctx.lineWidth = 2; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sh[0] + side * 2, sh[1] - 3); ctx.lineTo(sh[0] + side * 10, sh[1] + 8); ctx.lineTo(sh[0] + side * 4, hipY - 3); ctx.lineTo(sh[0] - side * 2, sh[1] + 9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = '#ff6a24'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sh[0] - 8, sh[1] + 9); ctx.lineTo(sh[0], sh[1] + 15); ctx.lineTo(sh[0] + 8, sh[1] + 8); ctx.stroke(); break;
    }
    case 'madara': {
      ctx.fillStyle = '#8f1d24'; ctx.strokeStyle = '#2b0b10'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sh[0] - 9 + i * 7, sh[1] + 2); ctx.lineTo(sh[0] - 5 + i * 7, sh[1] + 12); ctx.lineTo(sh[0] + 1 + i * 7, sh[1] + 9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = '#d5b080'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(neck[0] - 2, neck[1] + 11, 9, -.4, 3.7); ctx.stroke(); break;
    }
    case 'asta': {
      ctx.strokeStyle = '#e8e8ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh[0] - 9, sh[1]); ctx.lineTo(sh[0], sh[1] + 10); ctx.lineTo(sh[0] + 10, sh[1]); ctx.moveTo(sh[0], sh[1] + 10); ctx.lineTo(sh[0], hipY - 5); ctx.stroke();
      if (f.devilT > 0) { ctx.fillStyle = '#e8e8ee'; ctx.beginPath(); ctx.moveTo(head[0] - 4, head[1] - 9); ctx.lineTo(head[0] - 10, head[1] - 25); ctx.lineTo(head[0] + 1, head[1] - 11); ctx.fill(); ctx.stroke(); }
      break;
    }
    case 'goku': {
      ctx.fillStyle = '#173a78'; ctx.beginPath(); ctx.moveTo(sh[0] - 8, sh[1] - 2); ctx.lineTo(sh[0], sh[1] + 9); ctx.lineTo(sh[0] + 8, sh[1] - 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sh[0] - 8, sh[1] + 2); ctx.lineTo(sh[0] - 1, hipY - 4); ctx.moveTo(sh[0] + 8, sh[1] + 2); ctx.lineTo(sh[0] + 1, hipY - 4); ctx.stroke(); break;
    }
    case 'ichigo': {
      ctx.fillStyle = '#a51e2b'; ctx.fillRect(-9, hipY - 4, 18, 4); ctx.strokeStyle = '#272733'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh[0] - 9, sh[1] + 1); ctx.lineTo(neck[0], neck[1]); ctx.lineTo(sh[0] + 9, sh[1] + 1); ctx.stroke(); break;
    }
    case 'naruto': {
      ctx.strokeStyle = 'rgba(90,35,25,.75)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(head[0] + 3, head[1] - 1 + i * 2.4); ctx.lineTo(head[0] + 10, head[1] - 1 + i * 2.4); ctx.stroke(); }
      ctx.fillStyle = '#1d5da8'; ctx.strokeStyle = '#f2e9d8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sh[0] - 11, hipY + 11, 6, 9, -.18, 0, 7); ctx.fill(); ctx.stroke(); break;
    }
    case 'tanjiro': {
      ctx.strokeStyle = '#e8d36b'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(head[0] - 11, head[1] + 2); ctx.lineTo(head[0] - 11, head[1] + 11); ctx.stroke(); ctx.fillStyle = '#f4eee1'; ctx.fillRect(head[0] - 15, head[1] + 10, 8, 5); ctx.fillStyle = '#d94b4b'; ctx.fillRect(head[0] - 13, head[1] + 11, 2, 3);
      ctx.strokeStyle = '#f2eee5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sh[0] - 7, sh[1] + 1); ctx.lineTo(sh[0], sh[1] + 11); ctx.lineTo(sh[0] - 2, hipY - 5); ctx.stroke(); break;
    }
    case 'sasuke': {
      ctx.fillStyle = '#202431'; ctx.strokeStyle = '#697184'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sh[0] - 10, sh[1] - 1); ctx.lineTo(neck[0] - 1, neck[1] - 6); ctx.lineTo(sh[0] + 10, sh[1] - 1); ctx.lineTo(sh[0] + 4, sh[1] + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!L.mark) { ctx.fillStyle = '#d43b35'; ctx.beginPath(); ctx.ellipse(head[0] + 6, head[1], 2.2, 2.7, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(head[0] + 6, head[1], .9, 0, 7); ctx.fill(); } break;
    }
    case 'luffy': {
      ctx.fillStyle = '#d9413a'; ctx.strokeStyle = OL; ctx.lineWidth = 1.5; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sh[0] + side * 2, sh[1] - 1); ctx.lineTo(sh[0] + side * 10, sh[1] + 3); ctx.lineTo(sh[0] + side * 7, hipY - 2); ctx.lineTo(sh[0] + side * 2, sh[1] + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = '#8f2f2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(head[0] + 3, head[1] - 4); ctx.lineTo(head[0] + 9, head[1] + 2); ctx.moveTo(head[0] + 9, head[1] - 4); ctx.lineTo(head[0] + 3, head[1] + 2); ctx.stroke(); break;
    }
    case 'zoro': {
      ctx.fillStyle = '#2e9b63'; ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sh[0] - 9, sh[1]); ctx.lineTo(sh[0], sh[1] + 12); ctx.lineTo(sh[0] + 8, sh[1] + 1); ctx.lineTo(sh[0] + 3, hipY - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8c76b'; ctx.beginPath(); ctx.arc(head[0] - 11, head[1] + 4, 2.2, 0, 7); ctx.fill(); ctx.stroke(); break;
    }
    case 'saitama': {
      ctx.fillStyle = '#f0eee8'; ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sh[0], sh[1] + 11, 4.2, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e43c37'; ctx.beginPath(); ctx.arc(sh[0], sh[1] + 11, 1.8, 0, 7); ctx.fill(); break;
    }
    case 'gojo': {
      ctx.fillStyle = '#171923'; ctx.strokeStyle = '#343846'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sh[0] - 10, sh[1] - 2); ctx.lineTo(sh[0], sh[1] + 7); ctx.lineTo(sh[0] + 10, sh[1] - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case 'shadowdio': {
      // Gold coat cut open over a black underlayer, green trim on the collar,
      // the heart clasp at the throat and the purple wristband on the front hand.
      ctx.fillStyle = '#101c17'; ctx.strokeStyle = OL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1] - 2); ctx.lineTo(sh[0] - 9, sh[1] + 6); ctx.lineTo(sh[0] - 6, hipY + 6); ctx.lineTo(sh[0] + 6, hipY + 6); ctx.lineTo(sh[0] + 9, sh[1] + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sh[0] + side * 2, sh[1] - 3);
        ctx.lineTo(sh[0] + side * 12, sh[1] + 1);
        ctx.lineTo(sh[0] + side * 8, hipY + 4);
        ctx.lineTo(sh[0] + side * 1, hipY + 1);
        ctx.closePath();
        ctx.fillStyle = side < 0 ? '#d8b42e' : '#f2cd46'; ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.strokeStyle = '#2c6b52'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sh[0] + side * 6, sh[1] + 6); ctx.lineTo(sh[0] + side * 4, hipY); ctx.stroke();
      }
      // heart clasp under the throat
      ctx.fillStyle = GOLD_TRIM; ctx.strokeStyle = OL; ctx.lineWidth = 1;
      const hx0 = sh[0], hy0 = sh[1] + 2, k = 2.7;
      ctx.beginPath();
      ctx.moveTo(hx0, hy0 + k * 1.2);
      ctx.bezierCurveTo(hx0 - k * 1.5, hy0 + k * .1, hx0 - k * .55, hy0 - k * 1.2, hx0, hy0 - k * .3);
      ctx.bezierCurveTo(hx0 + k * .55, hy0 - k * 1.2, hx0 + k * 1.5, hy0 + k * .1, hx0, hy0 + k * 1.2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'yuji': {
      ctx.strokeStyle = '#d24a68'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh[0] - 7, sh[1] + 3); ctx.lineTo(sh[0], sh[1] + 10); ctx.lineTo(sh[0] + 7, sh[1] + 3); ctx.stroke(); break;
    }
    case 'deku': {
      ctx.strokeStyle = '#f0d34f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sh[0], sh[1] + 11, 5.5, 0, 7); ctx.stroke(); ctx.strokeStyle = '#8dffb0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sh[0] - 5, sh[1] + 6); ctx.lineTo(sh[0] + 5, sh[1] + 16); ctx.moveTo(sh[0] + 5, sh[1] + 6); ctx.lineTo(sh[0] - 5, sh[1] + 16); ctx.stroke(); break;
    }
    case 'todoroki': {
      ctx.fillStyle = 'rgba(210,55,48,.8)'; ctx.beginPath(); ctx.moveTo(head[0] - 10, head[1] - 8); ctx.lineTo(head[0] + 1, head[1] - 14); ctx.lineTo(head[0] - 1, head[1] - 2); ctx.lineTo(head[0] - 11, head[1] - 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8c3f36'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(head[0] + 2, head[1] - 7); ctx.lineTo(head[0] + 9, head[1] - 2); ctx.stroke();
      ctx.fillStyle = '#d8493f'; ctx.fillRect(sh[0] - 8, sh[1] + 2, 5, 15); ctx.fillStyle = '#87d9f2'; ctx.fillRect(sh[0] + 3, sh[1] + 2, 5, 15); break;
    }
    case 'eren': {
      ctx.strokeStyle = '#5a4029'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sh[0] - 8, sh[1] + 3); ctx.lineTo(sh[0] + 5, hipY - 5); ctx.stroke(); ctx.fillStyle = '#d5b46f'; ctx.beginPath(); ctx.arc(sh[0] - 6, sh[1] + 10, 2.3, 0, 7); ctx.fill(); ctx.stroke(); break;
    }
    case 'denji': {
      ctx.fillStyle = '#202027'; ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sh[0] - 8, sh[1]); ctx.lineTo(sh[0], sh[1] + 10); ctx.lineTo(sh[0] + 8, sh[1]); ctx.lineTo(sh[0] + 4, hipY - 3); ctx.lineTo(sh[0] - 4, hipY - 3); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case 'sukuna': {
      // Shibuya Sukuna: black ceremonial robes, red curse markings, and the
      // characteristic second pair of eye marks across the face.
      ctx.fillStyle = '#3a0d1b'; ctx.strokeStyle = '#ff2347'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sh[0] - 10, sh[1] - 1); ctx.lineTo(sh[0] - 2, sh[1] + 12); ctx.lineTo(sh[0] - 5, hipY - 4); ctx.lineTo(sh[0] - 13, hipY - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sh[0] + 10, sh[1] - 1); ctx.lineTo(sh[0] + 2, sh[1] + 12); ctx.lineTo(sh[0] + 5, hipY - 4); ctx.lineTo(sh[0] + 13, hipY - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#b31335'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sh[0] - 7, sh[1] + 5); ctx.lineTo(sh[0] + 6, hipY - 4); ctx.moveTo(sh[0] + 7, sh[1] + 5); ctx.lineTo(sh[0] - 5, hipY - 4); ctx.stroke();
      ctx.fillStyle = '#ff315d'; ctx.beginPath(); ctx.arc(sh[0], sh[1] + 12, 2.1, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8f0c2a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(head[0] - 7, head[1] - 4); ctx.lineTo(head[0] - 1, head[1] - 7); ctx.moveTo(head[0] - 1, head[1] - 4); ctx.lineTo(head[0] - 7, head[1] - 1); ctx.moveTo(head[0] + 1, head[1] - 4); ctx.lineTo(head[0] + 7, head[1] - 7); ctx.moveTo(head[0] + 1, head[1] - 1); ctx.lineTo(head[0] + 7, head[1] - 4); ctx.stroke();
      ctx.fillStyle = '#ff3857'; ctx.beginPath(); ctx.ellipse(head[0] + 6, head[1] - .1, 1.5, 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16050b'; ctx.beginPath(); ctx.ellipse(head[0] + 6, head[1] + 6, 2.5, 1.2, 0, 0, 7); ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = L.top2; ctx.beginPath(); ctx.moveTo(sh[0], sh[1] + 6); ctx.lineTo(sh[0] - 4, sh[1] + 12); ctx.lineTo(sh[0], sh[1] + 18); ctx.lineTo(sh[0] + 4, sh[1] + 12); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawFighter(ctx: CanvasRenderingContext2D, f: any, pose: Pose, time: number, showHit = false) {
  // The awakened form can repaint part of the look (Gear Fifth's white hair,
  // Kurama's gold cloak). Cached per source look so a thirty-second state does
  // not allocate a new object every frame.
  const form = f.awakened ? FORMS[f.def?.styleId || f.def?.id || ''] : undefined;
  let L: Look = f.look;
  if (form?.look) {
    if (!f.formLook || f.formLook.src !== f.look) f.formLook = { src: f.look, look: { ...f.look, ...form.look } };
    L = f.formLook.look;
  }
  const s = f.scale;
  const B = buildOf(L);
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing * s, s);

  // Squash and stretch: launch stretches the body, landing compresses it.
  // Art-directed fighters only, so untouched characters keep their original read.
  let sqx = 1, sqy = 1;
  if (artDirected(L)) {
    if (f.grounded && f.landT > 0) { const k = f.landT / 6; sqx = 1 + .12 * k; sqy = 1 - .12 * k; }
    else if (!f.grounded) { const k = Math.max(-1, Math.min(1, f.vy / 16)); sqx = 1 - .07 * k; sqy = 1 + .09 * k; }
  }
  if (sqx !== 1 || sqy !== 1) { ctx.scale(sqx, sqy); }

  const legLen = 19 * B.limb;
  const hipYFromFeet = (() => {
    const [a1, a2] = pose.lF, [b1, b2] = pose.lB;
    const d1 = Math.cos(a1) * legLen + Math.cos(a2) * legLen, d2 = Math.cos(b1) * legLen + Math.cos(b2) * legLen;
    return -Math.max(d1, d2, 14);
  })();
  const hipY = f.grounded && Math.abs(pose.rot) < 0.01 ? hipYFromFeet : -38;
  const hx = 0, hy = hipY;
  const cy = hy - 12;
  if (pose.rot) { ctx.translate(0, cy); ctx.rotate(pose.rot); ctx.translate(0, -cy); }

  const spine = 28 * B.torso, shoulderAt = 24 * B.torso, headAt = 40 * B.torso;
  const neck: [number, number] = [hx + Math.sin(pose.lean + pose.head) * spine, hy - Math.cos(pose.lean + pose.head) * spine];
  const sh: [number, number] = [hx + Math.sin(pose.lean) * shoulderAt, hy - Math.cos(pose.lean) * shoulderAt];
  const head: [number, number] = [hx + Math.sin(pose.lean + pose.head) * headAt, hy - Math.cos(pose.lean + pose.head) * headAt];

  const armLen = 15 * B.limb, foreLen = 14 * B.limb;
  const kneeF = pt(hx, hy, pose.lF[0], legLen), footF = pt(kneeF[0], kneeF[1], pose.lF[1], legLen);
  const kneeB = pt(hx - 2, hy, pose.lB[0], legLen), footB = pt(kneeB[0], kneeB[1], pose.lB[1], legLen);
  const elF = pt(sh[0], sh[1], pose.aF[0], armLen), haF = pt(elF[0], elF[1], pose.aF[1], foreLen);
  const elB = pt(sh[0] - 2, sh[1], pose.aB[0], armLen), haB = pt(elB[0], elB[1], pose.aB[1], foreLen);
  const limbW = 7.2 * B.limb, legW = 8.5 * B.limb;

  const fwdSpeed = f.vx * f.facing;
  const devil = f.devilT > 0, god = f.godT > 0;
  const techniqueActive = f.state === 'attack' && !!f.move?.ability && f.move.ability !== 'special';
  const identity = f.def?.styleId || f.def?.id || '';

  const unrot = (lx: number, ly: number): [number, number] => {
    if (!pose.rot) return [lx, ly];
    const dy = ly - cy, c = Math.cos(pose.rot), sn = Math.sin(pose.rot);
    return [lx * c - dy * sn, lx * sn + dy * c + cy];
  };
  const publishTips = (tipLocal: [number, number]) => {
    const [tx2, ty2] = unrot(tipLocal[0], tipLocal[1]);
    f.tipX = f.x + tx2 * s * f.facing; f.tipY = f.y + ty2 * s;
    const [fx2, fy2] = unrot(footF[0], footF[1]);
    f.footX = f.x + fx2 * s * f.facing; f.footY = f.y + fy2 * s;
    const [hx3, hy3] = unrot(haF[0], haF[1]);
    f.handX = f.x + hx3 * s * f.facing; f.handY = f.y + hy3 * s;
  };

  // ---- BESPOKE BODIES -------------------------------------------------------
  // A character with a registered renderer is dressed entirely by it; the
  // skeleton, squash and rotation above are shared, so every move still reads.
  const bespoke = CUSTOM_BODIES[identity];
  if (bespoke) {
    const tip = bespoke(ctx, { f, L, pose, time, B, hx, hy, cy, neck, sh, head, elF, haF, elB, haB, kneeF, footF, kneeB, footB, limbW, legW });
    publishTips(tip || haF);
    ctx.restore();
    if (showHit) {
      ctx.save(); ctx.strokeStyle = 'rgba(80,255,120,0.8)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(f.x - f.hw, f.y - f.h, f.hw * 2, f.h); ctx.restore();
    }
    return;
  }
  /**
   * ULTRA INSTINCT FORM.
   * `uiForm` fighters repaint themselves in the silver crown the moment their
   * transformation state opens, so an existing roster member (base Goku) taps
   * into the God-Tier look without a second character definition. Only the
   * rendering changes here; the numbers come from the shared `godT` multipliers.
   */
  const uiForm = god && f.def?.uiForm === true;
  const uiSilver = uiForm || L.hairStyle === 'ui';
  // The derived look is cached on the fighter and keyed by its source: a
  // transformation can run for 600 frames, and rebuilding an identical object
  // 600 times is exactly the steady per-frame garbage this avoids.
  let bodyLook = L;
  if (uiForm) {
    if (!f.uiLook || f.uiLook.src !== L) {
      f.uiLook = {
        src: L,
        look: { ...L, hair: '#f8fafc', hair2: '#93c5fd', hairStyle: 'ui', eye: '#e2e8f0', energy: '#f8fafc', energy2: '#60a5fa' },
      };
    }
    bodyLook = f.uiLook.look;
  }
  drawPresence(ctx, identity, bodyLook, time, devil || god, f.state === 'attack');
  const fk = form ? formCtx({ f, L, pose, time, B, hx, hy, cy, neck, sh, head, elF, haF, elB, haB, kneeF, footF, kneeB, footB, limbW, legW }, 12.2 * B.head) : null;
  if (form?.back && fk) { ctx.save(); form.back(ctx, fk); ctx.restore(); }

  // ---- COSMIC ULTRA INSTINCT AURA -----------------------------------------
  // A silver-haired fighter never fully powers down, and everything that raises
  // his output (transformation, technique, instant slip) flares the shell.
  if (uiSilver) {
    let k = uiForm ? 0.9 : 0.5;
    if (god) k += 0.5;
    if (f.evadeT > 0) k += 0.45;
    if (f.auraT > 0) k += Math.min(0.3, f.auraT / 34);
    if (techniqueActive) k += 0.22;
    if (f.awakened) k += 0.5;
    drawCosmicAura(ctx, f, bodyLook, hy, time, k);
  }

  // ---- contact shadow: tight ellipses under each foot, drawn in body space so
  // it tracks the pose instead of behaving like a decal. This is what pins the
  // fighter to the floor and stops the sprite reading as a floating cut-out.
  if (f.grounded) {
    ctx.save();
    ctx.globalAlpha = .34;
    const shg = ctx.createRadialGradient(0, -1, 1, 0, -1, 26);
    shg.addColorStop(0, 'rgba(0,0,0,.85)'); shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.beginPath(); ctx.ellipse(0, -1.5, 25, 5.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- backlight aura ----
  if (devil || god || f.auraT > 0 || techniqueActive) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const formCol = form ? hexA(form.aura, 1).replace(/,1\)$/, ',') : '';
    const col = devil ? 'rgba(220,20,50,' : god ? 'rgba(120,210,255,' : form ? formCol : techniqueActive ? 'rgba(255,255,255,' : 'rgba(180,110,255,';
    // An awakened form already paints its own aura behind the body, so the
    // generic backlight is kept to a soft tint; stacking three additive discs
    // on a bright stage burns out to a white halo.
    const bl = form ? 0.12 : 0.28;
    for (let i = 0; i < 3; i++) {
      const r = 48 + Math.sin(time * 0.3 + i * 2) * 7 + i * 8;
      const g = ctx.createRadialGradient(0, cy, 4, 0, cy, r);
      g.addColorStop(0, col + bl + ')'); g.addColorStop(1, col + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    // rising energy wisps
    for (let i = 0; i < 4; i++) {
      const p = ((time * 0.04 + i * 0.25) % 1);
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.fillStyle = devil ? '#ff2a4a' : god ? '#9fe6ff' : form ? form.aura : techniqueActive ? L.energy : '#c79dff';
      const wx = Math.sin(i * 2.4 + time * 0.1) * 22;
      ctx.beginPath(); ctx.ellipse(wx, hy - p * 90, 3.5 * (1 - p) + 1, 10 * (1 - p) + 3, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  drawBackDetails(ctx, f, sh, hy, time);

  // ---- rim / back light silhouette ----
  // A back light has to HUG the body. A 10px stroke around the head is not a rim,
  // it is a halo: on a dark background every fighter ends up wearing a flat
  // glowing disc. Thin on the head, thin on the limbs, and only really present
  // when there is an aura to justify it.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rimA = devil || god ? 0.5 : techniqueActive ? 0.4 : f.auraT > 0 ? 0.3 : 0.16;
  ctx.globalAlpha = rimA;
  ctx.strokeStyle = devil ? '#ff2a4a' : god ? '#9fe6ff' : form ? form.aura : L.energy;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(footB[0], footB[1]); ctx.lineTo(kneeB[0], kneeB[1]); ctx.lineTo(hx, hy); ctx.lineTo(neck[0], neck[1]);
  ctx.moveTo(hx, hy); ctx.lineTo(kneeF[0], kneeF[1]); ctx.lineTo(footF[0], footF[1]);
  ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elF[0], elF[1]); ctx.lineTo(haF[0], haF[1]);
  ctx.stroke();
  // No ring around the head: at sprite scale a stroked circle behind the skull
  // reads as a dark halo, not a rim. The head gets its rim from the hair pass.
  ctx.restore();

  // ---- devil wing ----
  if (devil && identity !== 'sukuna') {
    ctx.save();
    const flap = Math.sin(time * 0.2) * 0.22;
    ctx.translate(sh[0] - 4, sh[1] + 4); ctx.rotate(-0.4 + flap);
    const wg = ctx.createLinearGradient(0, 0, -60, -20);
    wg.addColorStop(0, '#1a0207'); wg.addColorStop(1, '#3a0410');
    ctx.fillStyle = wg; ctx.strokeStyle = '#e0203a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -38); ctx.lineTo(-56, -30); ctx.lineTo(-44, -14); ctx.lineTo(-60, -4);
    ctx.lineTo(-40, 6); ctx.lineTo(-50, 20); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---- cape ----
  if (L.cape) {
    const len = L.capeLen || 34;
    const ang = Math.max(-0.2, Math.min(1.3, 0.12 + fwdSpeed * 0.1 - f.vy * 0.04 + (f.grounded ? 0 : 0.2)));
    const wave = Math.sin(time * 0.25) * 3;
    const bx = sh[0] - 5 - Math.sin(ang) * len, by = sh[1] + Math.cos(ang) * len;
    ctx.beginPath();
    ctx.moveTo(sh[0] + 5, sh[1] - 2);
    ctx.lineTo(sh[0] - 8, sh[1] - 1);
    ctx.quadraticCurveTo(bx - 8, (sh[1] + by) / 2 + wave, bx - 6, by + wave);
    ctx.lineTo(bx + 12, by - wave);
    ctx.quadraticCurveTo(sh[0] + 6, (sh[1] + by) / 2, sh[0] + 5, sh[1] - 2);
    ctx.closePath();
    const cg = ctx.createLinearGradient(sh[0], sh[1], bx, by);
    cg.addColorStop(0, tint(L.cape, 1.15)); cg.addColorStop(1, shade(L.cape, 0.75));
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OL; ctx.stroke();
    if (L.cape2) {
      ctx.fillStyle = L.cape2;
      ctx.beginPath();
      const hx1 = bx - 6, hy1 = by + wave, hx2 = bx + 12, hy2 = by - wave;
      ctx.moveTo(hx1, hy1);
      for (let i = 0; i <= 4; i++) {
        const k = i / 4; const x = hx1 + (hx2 - hx1) * k, y = hy1 + (hy2 - hy1) * k;
        ctx.lineTo(x - 2, y - 8 - (i % 2) * 6 - Math.sin(time * 0.3 + i) * 2); ctx.lineTo(x + 2, y);
      }
      ctx.closePath(); ctx.fill();
    }
  }

  // `sleeve: 'none'` is a shirtless fighter: the upper arm is bare skin, not an
  // unpainted fill that would silently inherit the previous stroke colour.
  const sleeveC = L.sleeve === 'none' ? L.skin : L.sleeve;
  const handCol = L.glove || L.skin;
  const castAnim = f.state === 'attack' && /^(palm|cast|castUp|counter)$/.test(f.move?.anim || '');
  const openHands = castAnim || (L.pose === 'mage' && f.state !== 'attack');
  // back arm + back weapon
  const foreB = L.fore === L.sleeve ? sleeveC : L.fore;
  taperLimb(ctx, [sh, elB, haB], [limbW * 1.12, limbW * 0.92, limbW * 0.74], shade(sleeveC), shade(foreB));
  drawStockHand(ctx, haB[0], haB[1], Math.atan2(haB[1] - elB[1], haB[0] - elB[0]), 3.9 * B.limb, shade(handCol), openHands);
  if (L.weapon === 'dual' || L.weapon === 'triple') drawWeapon(ctx, 'dual', haB, pose.aB[1] + 0.35, f, time, true);
  taperLimb(ctx, [[hx - 2, hy], kneeB, footB], [legW * 1.14, legW * 0.9, legW * 0.72], shade(L.pants), shade(L.shorts ? L.skin : L.pants), L.shorts ? 0.12 : 1);
  drawFootwear(ctx, kneeB, footB, L.footwear || 'boots', shade(L.boots), shade(L.skin), f.grounded, legW);

  // ---- tapered anime torso ----
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const torsoAngle = Math.atan2(neck[1] - hy, neck[0] - hx);
  const tnx = Math.cos(torsoAngle), tny = -Math.sin(torsoAngle);
  const girth = 7 * B.chest, deltoid = 10.5 * B.shoulder;
  const torsoPath = () => {
    ctx.beginPath();
    ctx.moveTo(hx + tnx * girth, hy + tny * girth);
    ctx.quadraticCurveTo(hx - 3 * B.chest, (hy + neck[1]) / 2, sh[0] - tnx * deltoid, sh[1] - tny * deltoid);
    ctx.quadraticCurveTo(neck[0], neck[1] - 4, sh[0] + tnx * deltoid, sh[1] + tny * deltoid);
    ctx.quadraticCurveTo(hx + 6 * B.chest, (hy + neck[1]) / 2, hx - tnx * girth, hy - tny * girth);
    ctx.quadraticCurveTo(hx, hy + 2, hx + tnx * girth, hy + tny * girth);
    ctx.closePath();
  };
  torsoPath(); ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.stroke();
  // `top: 'none'` is a bare torso. `sleeve: 'none'` is a *torn* gi: the sleeves
  // are gone but the chest panel survives, so the muscle cut still has to read.
  const shirtless = L.top === 'none';
  const tornGi = shirtless || L.sleeve === 'none';
  const topCol = shirtless ? L.skin : L.top;
  const tg = ctx.createLinearGradient(hx - 9, hy, hx + 10, neck[1]);
  tg.addColorStop(0, shade(topCol, 0.68)); tg.addColorStop(0.48, topCol); tg.addColorStop(1, tint(topCol, 1.22));
  torsoPath(); ctx.fillStyle = tg; ctx.fill();
  ctx.save(); torsoPath(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 2); ctx.quadraticCurveTo(hx - 1, (hy + neck[1]) / 2, sh[0] + 3, neck[1] + 2); ctx.stroke();
  // Pectoral / abdominal cel bands give the chest a readable plane.
  if (artDirected(L)) {
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx - girth, (hy + sh[1]) * .5); ctx.quadraticCurveTo(hx, (hy + sh[1]) * .5 + 3, hx + girth, (hy + sh[1]) * .5);
    ctx.moveTo(hx - girth * .8, sh[1] - 6); ctx.quadraticCurveTo(hx, sh[1] - 3, hx + girth * .8, sh[1] - 6);
    ctx.stroke();
  }
  /**
   * CHEST CUT — the six-pack + sternum definition a bare torso needs so the
   * musculature reads at 60px tall. Drawn in torso-local space so it tracks the
   * lean, and scaled by the chest build so a bruiser and a brawler differ.
   */
  if (tornGi) {
    const cy0 = hy + 3, span = 7.6 * B.chest;
    // Warm bounce under the pectorals, cool rim from the aura on top.
    const bandH = Math.max(2, (cy0 - sh[1]) * .5 + 5);
    const cg2 = ctx.createLinearGradient(hx, sh[1] + 2, hx, hy + 4);
    cg2.addColorStop(0, 'rgba(255,255,255,.14)');
    cg2.addColorStop(.55, 'rgba(255,255,255,0)');
    cg2.addColorStop(1, 'rgba(40,20,10,.26)');
    ctx.fillStyle = cg2;
    ctx.beginPath(); ctx.ellipse(hx, cy0 + 2, span * 1.15, bandH, 0, 0, 7); ctx.fill();
    // Sternum + the collar of the ribcage.
    ctx.strokeStyle = 'rgba(0,0,0,.34)'; ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(hx + .5, sh[1] + 1);
    ctx.quadraticCurveTo(hx, sh[1] + (hy - sh[1]) * .42, hx + .5, cy0 + 2);
    ctx.stroke();
    // Pectoral shelf: one bold curve per side, the anime shorthand for a pec.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + .5, sh[1] + 3);
    ctx.quadraticCurveTo(hx - span * .78, sh[1] + 4.4, hx - span * 1.02, cy0 - 1);
    ctx.moveTo(hx + .5, sh[1] + 3);
    ctx.quadraticCurveTo(hx + span * .78, sh[1] + 4.4, hx + span * 1.02, cy0 - 1);
    ctx.stroke();
    // Abdominal wall: three tapering pairs running down to the belt.
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.5;
    const rows = 3, top = cy0 + 3.5, gap = (hy - top) / (rows + .4);
    for (let i = 0; i < rows; i++) {
      const y = top + gap * (i + .55), k = 1 - i * .16, hw = span * .56 * k;
      ctx.beginPath();
      ctx.moveTo(hx - hw, y - 1.4);
      ctx.quadraticCurveTo(hx - hw * .38, y + 1.6, hx - .6, y);
      ctx.moveTo(hx + hw, y - 1.4);
      ctx.quadraticCurveTo(hx + hw * .38, y + 1.6, hx + .6, y);
      ctx.stroke();
    }
    // Oblique slash on each flank ties the ribs to the hips.
    ctx.strokeStyle = 'rgba(0,0,0,.24)'; ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + side * span * 1.02, cy0 + 1);
      ctx.quadraticCurveTo(hx + side * span * .95, hy - 3, hx + side * span * .5, hy - 1.5);
      ctx.stroke();
    }
    // Specular slash across the collarbones.
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx - span * .95, sh[1] + 4.6); ctx.quadraticCurveTo(hx, sh[1] + 2.4, hx + span * .95, sh[1] + 4.6);
    ctx.stroke();
  }
  if (!shirtless) {
    ctx.fillStyle = shade(L.top, .55); ctx.beginPath(); ctx.moveTo(hx - 8, hy - 3); ctx.lineTo(hx + 7, hy - 3); ctx.lineTo(hx + 5, hy + 10); ctx.lineTo(hx - 6, hy + 9); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // neck and collar
  ctx.strokeStyle = OL; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(neck[0], neck[1] + 1); ctx.lineTo(head[0], head[1] + 8); ctx.stroke();
  ctx.strokeStyle = shade(L.skin, .92); ctx.lineWidth = 5; ctx.stroke();
  if (tornGi) {
    // Ripped hem: a jagged trim where the gi gave way, plus the trap shadow that
    // a sleeveless cut always needs to keep the neck from floating.
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sh[0] - 8, sh[1] + 1.5); ctx.lineTo(sh[0] - 4, sh[1] + 5.5); ctx.lineTo(sh[0] - 1, sh[1] + 1.5);
    ctx.moveTo(sh[0] + 2, sh[1] + 1.5); ctx.lineTo(sh[0] + 5.5, sh[1] + 5.5); ctx.lineTo(sh[0] + 9, sh[1] + 1.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(neck[0] - 6, neck[1] + 5); ctx.quadraticCurveTo(neck[0], neck[1] + 10, neck[0] + 6, neck[1] + 5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = L.top2; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(sh[0] - 7, sh[1] + 1); ctx.quadraticCurveTo(neck[0] - 1, neck[1] + 7, sh[0] + 8, sh[1]); ctx.stroke();
    ctx.fillStyle = L.top2; ctx.beginPath(); ctx.arc(sh[0] + 4, sh[1] + 7, 2.2, 0, 7); ctx.fill();
  }

  // front leg
  taperLimb(ctx, [[hx, hy], kneeF, footF], [legW * 1.16, legW * 0.92, legW * 0.74], L.pants, L.shorts ? L.skin : L.pants, L.shorts ? 0.12 : 1);
  drawFootwear(ctx, kneeF, footF, L.footwear || 'boots', L.boots, L.skin, f.grounded, legW);

  // ---- head ----
  const hr = 12.2 * B.head;
  const sway = Math.max(-25, Math.min(25, -fwdSpeed * 3 + f.vy * 1.5));
  const longHair = BACK_HAIR.includes(bodyLook.hairStyle);
  if (longHair) hair(ctx, head[0], head[1], hr, bodyLook.hairStyle, bodyLook.hair, time, sway, 1, !!bodyLook.eyeStyle);
  const fg = ctx.createRadialGradient(head[0] + 3, head[1] - 4, 1, head[0], head[1], hr + 2);
  fg.addColorStop(0, tint(L.skin, 1.08)); fg.addColorStop(1, shade(L.skin, 0.88));
  ctx.fillStyle = fg; ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(head[0] - hr, head[1] - 1);
  ctx.quadraticCurveTo(head[0] - hr * .92, head[1] - hr * .9, head[0], head[1] - hr);
  ctx.quadraticCurveTo(head[0] + hr, head[1] - hr * .88, head[0] + hr, head[1]);
  ctx.quadraticCurveTo(head[0] + hr * .82, head[1] + hr * .82, head[0] + 3, head[1] + hr * .9);
  ctx.quadraticCurveTo(head[0] - hr * .75, head[1] + hr * .72, head[0] - hr, head[1] - 1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // cheek and jaw anime planes
  ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.moveTo(head[0] + 2, head[1] - 7); ctx.lineTo(head[0] + 9, head[1] - 4); ctx.lineTo(head[0] + 6, head[1] + 6); ctx.closePath(); ctx.fill();

  const hurt = f.state === 'hitstun';
  if (hurt) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(head[0] + 3, head[1] - 2); ctx.lineTo(head[0] + 8, head[1] + 1);
    ctx.moveTo(head[0] + 3, head[1] + 1); ctx.lineTo(head[0] + 8, head[1] - 2); ctx.stroke();
  } else if (L.mark === 'blindfold' || L.mark === 'visor') {
    ctx.fillStyle = L.mark === 'visor' ? '#1b2330' : '#111318';
    ctx.fillRect(head[0] - 9, head[1] - 4.5, 19, 6.5);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.strokeRect(head[0] - 9, head[1] - 4.5, 19, 6.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
    ctx.fillStyle = L.eye; ctx.fillRect(head[0] - 7, head[1] - 3, 15, 2); ctx.restore();
  } else if (L.eyeStyle) {
    eye(ctx, head[0] + 6, head[1], bodyLook, god || devil);
  } else {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = god || devil ? 0.8 : 0.28;
    ctx.fillStyle = devil ? '#ff2040' : L.eye; ctx.beginPath(); ctx.ellipse(head[0] + 6, head[1], 5, 4.5, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#f8f8ff'; ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(head[0] + 6, head[1] - .2, 3.6, 2.4, -.08, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = L.eye; ctx.beginPath(); ctx.ellipse(head[0] + 6.5, head[1], 1.65, 1.9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(head[0] + 7, head[1] + .2, .75, 1.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head[0] + 7.2, head[1] - 1.4, 1.1, 0, 7); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(head[0] + 2.2, head[1] - 5.7); ctx.lineTo(head[0] + 9.6, head[1] - 4.2); ctx.stroke();
  }
  if (!longHair) {
    // The Ultra Instinct crown is a single cap drawn *over* the skull. Drawing it
    // behind - as the genuinely long styles are - leaves the head covering the
    // mass, so all that survives is a ring of tips and he wears a sea urchin.
    const uiCrown = bodyLook.hairStyle === 'ui';
    if (bodyLook.hair2 && !uiCrown) hair(ctx, head[0], head[1], hr, bodyLook.hairStyle, bodyLook.hair2, time, sway, 1, !!bodyLook.eyeStyle);
    hair(ctx, head[0], head[1], hr, bodyLook.hairStyle, bodyLook.hair, time, sway, bodyLook.hair2 && !uiCrown ? 0.6 : 1, !!bodyLook.eyeStyle);
  } else {
    ctx.fillStyle = shade(bodyLook.hair, 0.9);
    ctx.beginPath(); ctx.moveTo(head[0] + 2, head[1] - 11); ctx.lineTo(head[0] + 14, head[1] + 5); ctx.lineTo(head[0] + 6, head[1] - 4); ctx.closePath(); ctx.fill();
  }
  // Mouth: opens on exertion so attacks and pain read without changing the model.
  const gritting = f.state === 'attack' || f.state === 'hitstun' || f.devilT > 0;
  ctx.strokeStyle = 'rgba(75,30,35,.7)'; ctx.lineWidth = 1.1;
  if (artDirected(L) && gritting) {
    ctx.fillStyle = '#3a1b1f'; ctx.beginPath(); ctx.ellipse(head[0] + 7, head[1] + 6.4, 2.4, 1.5, 0, 0, 7); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(head[0] + 5, head[1] + 6); ctx.quadraticCurveTo(head[0] + 7, head[1] + 7, head[0] + 9, head[1] + 5.8);
  }
  ctx.stroke();

  // ---- accessories ----
  switch (L.mark) {
    case 'headband': {
      ctx.fillStyle = '#1b1b24'; ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(head[0], head[1], hr - 0.5, -2.55, -0.45); ctx.lineWidth = 4.5; ctx.strokeStyle = '#1b1b24'; ctx.stroke();
      ctx.fillStyle = '#cfd6e2'; ctx.fillRect(head[0] + 1.5, head[1] - 9.5, 7.5, 4.6);
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.strokeRect(head[0] + 1.5, head[1] - 9.5, 7.5, 4.6);
      break;
    }
    case 'bandana': {
      ctx.strokeStyle = L.top2; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(head[0], head[1], hr - 0.5, -2.6, -0.4); ctx.stroke();
      ctx.strokeStyle = L.top2; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(head[0] - 9, head[1] - 5); ctx.lineTo(head[0] - 20 - Math.sin(time * 0.2) * 3, head[1] + 2); ctx.stroke();
      break;
    }
    case 'hat': {
      ctx.fillStyle = '#f2dfa8'; ctx.strokeStyle = OL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(head[0] - 1, head[1] - 9, 20, 4.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(head[0] - 1, head[1] - 13, 9, 6, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b8342c'; ctx.fillRect(head[0] - 10, head[1] - 11.5, 18, 2.8);
      break;
    }
    case 'scar': {
      ctx.strokeStyle = 'rgba(180,40,30,0.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(head[0] + 2, head[1] - 7); ctx.lineTo(head[0] + 6, head[1] - 3); ctx.stroke();
      break;
    }
    case 'mask': {
      ctx.fillStyle = '#e8e8ee'; ctx.strokeStyle = OL; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(head[0] + 2, head[1] + 1, 8, -1.3, 1.5); ctx.fill(); ctx.stroke();
      break;
    }
    // DIO's heart cap: a dark brimmed cap with a gold heart on the front.
    case 'heartCap': {
      ctx.save();
      const capC = L.accent || '#e8c14a';
      const capBase = L.top2;
      ctx.fillStyle = capBase;
      ctx.beginPath(); ctx.ellipse(head[0] - 1, head[1] - hr * .78, hr * 1.18, hr * .34, -.06, 0, 7); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(head[0] - hr * 1.16, head[1] - hr * .74);
      ctx.quadraticCurveTo(head[0] - 3, head[1] - hr * 1.9, head[0] + hr * .96, head[1] - hr * 1.02);
      ctx.quadraticCurveTo(head[0] + 2, head[1] - hr * 1.28, head[0] - hr * 1.16, head[1] - hr * .74);
      ctx.closePath();
      const cg2 = ctx.createLinearGradient(head[0], head[1] - hr * 1.9, head[0], head[1] - hr * .6);
      cg2.addColorStop(0, tint(capBase, 1.35)); cg2.addColorStop(1, shade(capBase, .7));
      ctx.fillStyle = cg2; ctx.fill(); ctx.stroke();
      // gold heart emblem
      ctx.fillStyle = capC;
      const hx2 = head[0] + hr * .34, hy2 = head[1] - hr * .98, k = hr * .2;
      ctx.beginPath();
      ctx.moveTo(hx2, hy2 + k * 1.15);
      ctx.bezierCurveTo(hx2 - k * 1.5, hy2 + k * .1, hx2 - k * .55, hy2 - k * 1.25, hx2, hy2 - k * .3);
      ctx.bezierCurveTo(hx2 + k * .55, hy2 - k * 1.25, hx2 + k * 1.5, hy2 + k * .1, hx2, hy2 + k * 1.15);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = .9; ctx.stroke();
      ctx.strokeStyle = tint(capC, 1.4); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(head[0] - hr * .9, head[1] - hr * .96); ctx.quadraticCurveTo(head[0], head[1] - hr * 1.02, head[0] + hr * .82, head[1] - hr * .84); ctx.stroke();
      ctx.restore();
      break;
    }
  }
  if (devil && identity !== 'sukuna') {
    ctx.fillStyle = '#121216'; ctx.strokeStyle = '#e0203a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(head[0] - 3, head[1] - 9); ctx.lineTo(head[0] - 9, head[1] - 26); ctx.lineTo(head[0] + 2, head[1] - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  drawFighterDetails(ctx, f, L, head, neck, sh, hy);
  drawCostume(ctx, identity, L, head, sh, hy, time, devil || god);
  if (form?.front && fk) { ctx.save(); form.front(ctx, fk); ctx.restore(); }

  // front arm + weapon
  const foreF = L.fore === L.sleeve ? sleeveC : L.fore;
  taperLimb(ctx, [sh, elF, haF], [7.6 * B.limb, 6.6 * B.limb, 5.4 * B.limb], sleeveC, foreF);
  drawStockHand(ctx, haF[0], haF[1], Math.atan2(haF[1] - elF[1], haF[0] - elF[0]), 4.1 * B.limb, handCol, openHands && L.weapon === 'fists');
  const tip = drawWeapon(ctx, L.weapon, haF, pose.wep, f, time, false);

  publishTips(tip || haF);

  // ---- rim light: a thin bright contour down the leading edge of the body. It
  // is what separates a fighter from a busy arena background at any zoom.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = .3;
  ctx.strokeStyle = devil ? '#ff5a70' : uiForm ? '#ffffff' : god ? '#9fe6ff' : tint(L.energy, 1.15);
  ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  // Down the leading edge of the torso only - never across the face.
  ctx.beginPath();
  ctx.moveTo(sh[0] + 9, sh[1] + 2);
  ctx.quadraticCurveTo(sh[0] + 11, (sh[1] + hy) / 2, hx + 7, hy - 2);
  ctx.stroke();
  ctx.restore();

  if ((L.weapon === 'claws' || L.weapon === 'staff') && (god || devil || (f.state === 'attack'))) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const h of [haF, haB]) {
      const g = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], 13);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, L.energy); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h[0], h[1], 13, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  if (showHit) {
    ctx.save(); ctx.strokeStyle = 'rgba(80,255,120,0.8)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(f.x - f.hw, f.y - f.h, f.hw * 2, f.h); ctx.restore();
  }
}

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, groundY, 1, x, groundY, w);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, groundY, w, w * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * DYNAMIC DIRECTIONAL CONTACT SHADOW
 *
 * A fighter's shadow is the cheapest possible cue for how high off the floor he
 * is. It is drawn as a stack of widening, softening, *skewed* ellipses: the
 * nearer the camera, the wider and the more the ellipse is sheared along the
 * direction of travel, and the further from the floor the softer and fainter it
 * gets. Two bands stand in for a real penumbra, so a fighter at apex reads as
 * genuinely airborne instead of sliding on an invisible plane.
 */
export function drawContactShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, alpha: number, skew = 0, lift = 0) {
  if (alpha <= 0.005 || w <= 0.5) return;
  ctx.save();
  const rx = w;
  const ry = Math.max(0.6, w * (0.3 + Math.min(0.14, lift * 0.0006)));
  // Ambient occlusion core: darkest, tightest, directly under the fighter.
  ctx.globalAlpha = alpha;
  const core = ctx.createRadialGradient(x, groundY, 1, x, groundY, rx);
  core.addColorStop(0, 'rgba(0,0,0,0.62)');
  core.addColorStop(0.45, 'rgba(0,0,0,0.3)');
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.ellipse(x, groundY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  // Penumbra: a wider, much softer band that sells the soft edge.
  const px = rx * (1.55 + Math.min(0.7, lift * 0.0008));
  const shear = Math.max(-0.45, Math.min(0.45, skew * 0.05));
  ctx.globalAlpha = alpha * 0.4;
  const soft = ctx.createRadialGradient(x, groundY, 1, x, groundY, px);
  soft.addColorStop(0, 'rgba(0,0,0,0.34)');
  soft.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  soft.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = soft;
  ctx.beginPath(); ctx.ellipse(x, groundY, px, px * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  if (Math.abs(shear) > 0.02) {
    // A second contact lobe trailing the direction of travel: the shadow
    // stretches away from the light when the fighter is moving hard.
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.ellipse(x - skew * 0.32, groundY - ry * 0.1, rx * 1.18, ry * 0.8, shear, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A single decaying after-image: the fighter's mass, tinted in his energy. */
export interface Ghost { x: number; y: number; facing: number; scale: number; life: number; max: number; color: string; }

/**
 * MOTION AFTER-IMAGES (ghosting)
 *
 * Anime speed is sold by persistence, not realism. Each ghost is a silhouette —
 * a cheap capsule-plus-skull mass, never a second full fighter render — so five
 * of them cost almost nothing and still read as a body tearing through space.
 * Drawn additively so overlapping ghosts bloom into a streak.
 */
export function drawGhosts(ctx: CanvasRenderingContext2D, ghosts: Ghost[]) {
  if (ghosts.length < 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    const t = Math.max(0, Math.min(1, g.life / g.max));
    const k = (i + 1) / ghosts.length;               // older ghosts dim further
    const a = t * t * 0.42 * (0.35 + k * 0.65);
    if (a <= 0.01) continue;
    const s = g.scale;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.facing * s * (0.9 + k * 0.12), s);
    ctx.globalAlpha = a;
    ctx.fillStyle = g.color;
    // Torso: a tapered mass from the hip to the shoulders.
    ctx.beginPath();
    ctx.moveTo(-7, 2);
    ctx.quadraticCurveTo(-11, -26, -6.5, -40);
    ctx.quadraticCurveTo(0, -48, 7.5, -40);
    ctx.quadraticCurveTo(12, -25, 8, 2);
    ctx.closePath();
    ctx.fill();
    // Skull + the spike silhouette, so the ghost is still recognisably *him*.
    ctx.beginPath(); ctx.arc(0.5, -50, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -54); ctx.lineTo(-16, -68); ctx.lineTo(-3, -58);
    ctx.moveTo(-1, -57); ctx.lineTo(2, -75); ctx.lineTo(6, -57);
    ctx.moveTo(6, -56); ctx.lineTo(16, -70); ctx.lineTo(10, -52);
    ctx.closePath();
    ctx.fill();
    // Hot core keeps the brightest ghost from looking like flat paint.
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, -24, 4.2, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * COSMIC ULTRA INSTINCT AURA
 *
 * Two concentric shells plus a ground distortion ring:
 *   1. OUTER CORONA — a violet->cyan nebula with drifting stardust. This is the
 *      part that says "space is bending around him".
 *   2. INNER CORE — silver heat haze built from sine-warped tongues, which is
 *      the part that says "the air itself is boiling".
 *   3. GROUND RING — a flat distortion ellipse at the feet that flares on a dash
 *      or a landing, and widens while an instant transmission resolves.
 *
 * Drawn in the fighter's own local space, so facing, scale and squash all carry
 * through for free. `k` is 0..1 and scales the whole shell.
 */
export function drawCosmicAura(ctx: CanvasRenderingContext2D, f: any, L: Look, hy: number, time: number, k = 1) {
  const power = Math.max(0, Math.min(1.35, k));
  if (power <= 0.02) return;
  const VIOLET = '139,92,246';   // #8b5cf6 — nebula deep
  const CYAN = '56,189,248';     // #38bdf8 — neon rim
  const cy = hy - 24;
  // Dashing, landing and an instant slip all widen the shell for a few frames.
  const speed = Math.abs((f.vx as number) || 0);
  const flare = 1 + Math.min(0.55, speed * 0.035) + (f.landT > 0 ? Math.min(0.5, f.landT * 0.06) : 0) + (f.evadeT > 0 ? 0.7 : 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // ---- 1. OUTER CORONA -----------------------------------------------------
  const R = 54 * power * flare;
  const neb = ctx.createRadialGradient(0, cy, 2, 0, cy, R);
  neb.addColorStop(0, 'rgba(255,255,255,0)');
  neb.addColorStop(0.22, `rgba(${VIOLET},${0.3 * power})`);
  neb.addColorStop(0.55, `rgba(${CYAN},${0.2 * power})`);
  neb.addColorStop(0.82, `rgba(${VIOLET},${0.1 * power})`);
  neb.addColorStop(1, `rgba(${CYAN},0)`);
  ctx.fillStyle = neb;
  ctx.beginPath(); ctx.ellipse(0, cy, R, R * 1.12, 0, 0, Math.PI * 2); ctx.fill();

  // A second, offset shell rotated against the first: two nebulae in parallax
  // read as depth rather than as a single flat disc.
  ctx.save();
  ctx.rotate(time * 0.013);
  const neb2 = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.8);
  neb2.addColorStop(0, 'rgba(255,255,255,0)');
  neb2.addColorStop(0.4, `rgba(${CYAN},${0.22 * power})`);
  neb2.addColorStop(1, `rgba(${VIOLET},0)`);
  ctx.fillStyle = neb2;
  ctx.beginPath(); ctx.ellipse(0, 0, R * 0.8, R * 0.58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ---- 2. INNER CORE — silver heat haze ------------------------------------
  // Tapered tongues rather than a row of parallel bars: each one leans with the
  // flame, narrows toward the tip and is widest where it leaves the body, so the
  // core reads as rising heat instead of a fence behind the fighter.
  const tongues = 5;
  for (let i = 0; i < tongues; i++) {
    const u = (i / (tongues - 1)) * 2 - 1;
    const lean = u * 7 + Math.sin(time * .11 + i * 1.9) * 3.5;
    const baseX = u * 11;
    const baseW = 7.5 - Math.abs(u) * 2.2;
    const h = (40 + Math.sin(time * .17 + i * 1.7) * 8) * power * flare;
    const hot = 0.5 + 0.5 * Math.sin(time * .24 + i * 1.3);
    const segs = 5;
    // Leading edge climbs, trailing edge returns, forming one closed flame.
    const edge = (dir: number) => {
      for (let j = 0; j <= segs; j++) {
        const kk = j / segs;
        const rip = Math.sin(kk * 8.6 + time * .44 + i * 2.3) * 2.6 * kk
          + Math.sin(kk * 16.4 - time * .7 + i) * 1.2 * kk;
        const w = baseW * (1 - kk * .88) * dir;
        const x = baseX + lean * kk * kk + rip;
        const y = hy + 2 - h * kk;
        j ? ctx.lineTo(x + w, y) : ctx.moveTo(x + w, y);
      }
    };
    ctx.beginPath();
    edge(1);
    for (let j = segs; j >= 0; j--) {
      const kk = j / segs;
      const rip = Math.sin(kk * 8.6 + time * .44 + i * 2.3) * 2.6 * kk
        + Math.sin(kk * 16.4 - time * .7 + i) * 1.2 * kk;
      ctx.lineTo(baseX + lean * kk * kk + rip - baseW * (1 - kk * .88), hy + 2 - h * kk);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${hot > .5 ? '255,255,255' : CYAN},${(0.09 + hot * 0.11) * power})`;
    ctx.fill();
  }
  // White-hot heart.
  const heart = ctx.createRadialGradient(0, hy - 14, 1, 0, hy - 14, 28 * power);
  heart.addColorStop(0, `rgba(255,255,255,${0.4 * power})`);
  heart.addColorStop(0.35, `rgba(226,232,240,${0.19 * power})`);
  heart.addColorStop(1, 'rgba(226,232,240,0)');
  ctx.fillStyle = heart;
  ctx.beginPath(); ctx.ellipse(0, hy - 14, 28 * power, 32 * power, 0, 0, Math.PI * 2); ctx.fill();

  // ---- 3. STARDUST ---------------------------------------------------------
  for (let i = 0; i < 9; i++) {
    const ph = (time * 0.6 + i * 41) % 70 / 70;
    const a = i * 1.37 + time * 0.02;
    const rad = (16 + (i % 4) * 11) * power;
    const px = Math.cos(a) * rad * (0.7 + ph * 0.8);
    const py = hy + 4 - ph * (52 + (i % 3) * 16) * power;
    ctx.globalAlpha = (1 - ph) * 0.75 * power;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#93c5fd' : '#a5f3fc';
    ctx.beginPath(); ctx.arc(px, py, 0.9 + (1 - ph) * 1.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- 4. GROUND DISTORTION RING ------------------------------------------
  if (f.grounded !== false) {
    const gr = 30 * power * flare;
    const ring = ctx.createRadialGradient(0, hy + 2, 1, 0, hy + 2, gr);
    ring.addColorStop(0, `rgba(255,255,255,${0.34 * power})`);
    ring.addColorStop(0.35, `rgba(${CYAN},${0.22 * power})`);
    ring.addColorStop(0.72, `rgba(${VIOLET},${0.12 * power})`);
    ring.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = ring;
    ctx.beginPath(); ctx.ellipse(0, hy + 2, gr, gr * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    // Compression wavefront skating outward across the floor.
    const wob = 1 + Math.sin(time * .6) * 0.05;
    ctx.strokeStyle = `rgba(226,232,240,${0.4 * power})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, hy + 2, gr * 0.92 * wob, gr * 0.27 * wob, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // The fighter's own energy colour is folded into the shell so a character who
  // is not silver-haired still gets a corona tuned to their palette.
  if (L.energy2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 * power;
    ctx.strokeStyle = L.energy2; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, hy - 26, 44 * power, 52 * power, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/**
 * Shadow DIO's Stand — "The World".
 *
 * Drawn in the fighter's own local space, behind the body, so it inherits the
 * current pose's facing and scale. `standT` is the frame since the summon, so
 * the materialisation reads as shadow pouring upward into a solid silhouette
 * and the dismissal sinks back into the ground.
 *
 * The silhouette follows the reference art rather than a generic dark
 * humanoid: a bone-white plated body with oxidation-purple shoulder blocks,
 * stacked block gauntlets, a wedge helmet with a glowing visor, the gold heart
 * on the chest, and a collapsing bed of violet cubes under his feet.
 */
export function drawStandDio(ctx: CanvasRenderingContext2D, f: any, pose: Pose, time: number) {
  if (!f.standActive) return;
  const s = f.scale;
  const appear = 11, leave = 16;
  const inK = Math.min(1, f.standT / appear), outK = Math.min(1, f.standDur / leave);
  const solid = Math.max(0, Math.min(1, inK * inK * (3 - 2 * inK))) * outK;
  if (solid <= 0.01) return;

  // Where the Stand stands and when it strikes, mirrored from the body pose.
  const lean = pose.lean;
  const strike = f.standAttackT > 0 ? 1 : 0;
  const reach = strike ? 1 : 0;
  const hipY = f.grounded && Math.abs(pose.rot) < 0.01 ? -34 : -38;
  const bob = Math.sin(time * 0.07) * 1.6 * (1 - solid * .2);
  const off = 16 * s * f.facing;

  ctx.save();
  ctx.translate(f.x + off, f.y);
  ctx.scale(f.facing * s * 1.32, s * 1.32);
  ctx.translate(0, hipY + bob * .4);
  ctx.globalAlpha = solid;

  // ---------------------------------------------------------------- palette
  // The World reads as a bone-white plated humanoid shot through with oxidation
  // purple, standing in a collapsing bed of violet cubes — the supplied reference
  // silhouette, not a generic dark humanoid.
  const PLATE = '#e9defc', PLATE2 = '#f8f4ff';
  const OX = '#a95fc6', OX2 = '#7f45b8', OX3 = '#d489e0';
  const DEEP = '#341b62', DEEP2 = '#1d0d3c';
  const GOLD = GOLD_TRIM, GLOW = '#8affd0', MAGENTA = '#e56bd8';

  // ------------------------------------------------------------- geometry
  const legF = pt(3, 0, pose.lF[0] * .74, 18), footF = pt(legF[0], legF[1], pose.lF[1] * .74, 18);
  const legB = pt(-4, 0, pose.lB[0] * .74, 18), footB = pt(legB[0], legB[1], pose.lB[1] * .74, 18);
  const shY = -27, shX = Math.sin(lean) * 6;
  const hdX = shX + Math.sin(lean) * 13, hdY = shY - 24;
  // The striking arm reaches far further than the resting guard, so the Stand
  // punches on the same beat the body pose is playing.
  const armHit: [number, number] = strike ? [1.72, 1.58] : [0.22, 0.74];
  const elF = pt(shX, shY, armHit[0], 15), haF = pt(elF[0], elF[1], armHit[1], 14);
  const elB = pt(shX - 2, shY, -0.5 - reach * .32, 15), haB = pt(elB[0], elB[1], 0.42 + reach * .95, 14);
  const baseFeet = Math.max(footF[1], footB[1], 26);

  /** Armoured limb: heavy outer keyline, plate fill, then a polished highlight. */
  const bone = (pts: [number, number][], w: number, fill: string) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = w + 3.4;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = fill;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.lineWidth = Math.max(1, w * .3); ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  /** Angular armour slab in the Stand's pale-plate / oxidation-purple language. */
  const slab = (pts: [number, number][], fill: string, top: string, lw = 2.2) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
    g.addColorStop(0, top); g.addColorStop(1, fill);
    ctx.fillStyle = g; ctx.strokeStyle = OL; ctx.lineWidth = lw; ctx.fill(); ctx.stroke();
  };

  /** Stacked blocky gauntlet: three offset plates — the Stand's signature arm. */
  const gauntlet = (to: [number, number], ang: number, w: number, deep: boolean) => {
    ctx.save(); ctx.translate(to[0], to[1]); ctx.rotate(ang);
    for (let i = 0; i < 3; i++) {
      const len = w * (2.5 - i * .22), h = w * (1.32 - i * .2), lift = deep ? i * .8 : -i * .7;
      ctx.beginPath(); ctx.roundRect(-w * 1.05 - i * w * .3, -h * .5 + lift, len, h, 1.6);
      ctx.fillStyle = deep ? (i % 2 ? OX2 : DEEP) : (i % 2 ? PLATE2 : PLATE);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.9; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = deep ? 'rgba(255,160,240,.4)' : 'rgba(255,255,255,.55)'; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(-w * .9 - i * w * .3, -h * .3 + lift); ctx.lineTo(len - w * .35, -h * .3 + lift); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = deep ? OX2 : PLATE;
    ctx.strokeStyle = OL; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(to[0], to[1], w * .94, w * .86, ang, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = deep ? OX3 : 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(to[0] - Math.cos(ang) * w * .2, to[1] - Math.sin(ang) * w * .2, w * .5, w * .44, ang, 0, 7); ctx.stroke();
  };
  /** Isometric cube for the collapsing domain floor at his feet. */
  const cube = (x: number, y: number, r: number, tone: number) => {
    ctx.fillStyle = tone > .6 ? OX2 : DEEP;
    ctx.strokeStyle = OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y - r * .34); ctx.lineTo(x, y + r * .62); ctx.lineTo(x - r, y - r * .34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = tone > .6 ? OX3 : tone > .3 ? OX : OX2;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y - r * .34); ctx.lineTo(x + r * .42, y + r * .06); ctx.lineTo(x - r * .56, y - r * .42); ctx.closePath(); ctx.fill();
  };

  // ---------------------------------------------- collapsing cube floor
  ctx.save();
  ctx.globalAlpha = solid * .95;
  for (let i = 0; i < 13; i++) {
    const u = i / 12, spread = (u - .5) * 78;
    const lift = 4 + Math.abs(u - .5) * 27;
    const r = 5.5 + (1 - Math.abs(u - .5) * 1.5) * 4;
    cube(spread, baseFeet - 3 + lift + Math.sin(time * .05 + i * 1.3) * 1.4, r, .35 + (i % 5) * .14);
  }
  ctx.restore();

  // ---- ground sigil the Stand rises out of ----
  ctx.save();
  ctx.globalAlpha = solid * .85;
  ctx.strokeStyle = GLOW; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, baseFeet + 2, 32, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const a = time * 0.5 + i * (Math.PI / 3);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, baseFeet + Math.sin(a) * 3.6); ctx.lineTo(Math.cos(a) * 30, baseFeet + Math.sin(a) * 7.8); ctx.stroke();
  }
  ctx.restore();

  // ---- shadow smoke column during the summon ----
  if (inK < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = solid * (1 - inK) * .9;
    for (let i = 0; i < 12; i++) {
      const a = i * 1.7 + time * .3, r = 12 + (i % 4) * 8;
      const x = Math.cos(a) * r, y = -Math.abs(Math.sin(a)) * 42 - i * 3;
      ctx.fillStyle = i % 2 ? GLOW : OX3;
      ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3) * 2.4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // ---- legs: plated greaves with knee slabs
  bone([legB, footB], 7.4, DEEP);
  bone([legF, footF], 7.8, PLATE);
  for (const [knee, foot, deep] of [[legB, footB, true], [legF, footF, false]] as [number[], number[], boolean][]) {
    const aang = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
    const mx = (knee[0] + foot[0]) / 2, my = (knee[1] + foot[1]) / 2;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(aang);
    slab([[-4, -6], [7, -5], [7, 5], [-4, 6]], deep ? DEEP2 : PLATE, deep ? OX2 : PLATE2, 1.8);
    ctx.restore();
    // pointed boot toe
    ctx.save(); ctx.translate(foot[0], foot[1]);
    ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(11, -2); ctx.lineTo(14, 1); ctx.lineTo(-4, 4); ctx.closePath();
    ctx.fillStyle = deep ? DEEP2 : PLATE; ctx.strokeStyle = OL; ctx.lineWidth = 1.9; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---- torso: V-shaped plated chest over a narrow waist
  ctx.save();
  slab([[shX - 12, shY + 4], [-9, shY + 19], [-5, 1], [5, 1], [9, shY + 19], [shX + 12, shY + 4], [shX + 5, shY - 4], [shX - 5, shY - 4]],
    PLATE, PLATE2, 2.8);
  // rib plates
  ctx.strokeStyle = 'rgba(120,80,190,.55)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(shX - 10 + i, shY + 7 + i * 5); ctx.lineTo(shX + 10 - i, shY + 7 + i * 5); ctx.stroke();
  }
  // the oxidation-purple side panels that bracket the white chest
  for (const side of [-1, 1]) {
    slab([[shX + side * 12, shY + 3], [shX + side * 16, shY - 5], [shX + side * 13, shY - 12], [shX + side * 8, shY - 6]], side < 0 ? OX2 : OX, side < 0 ? OX : OX3, 2);
  }
  // gold heart sigil, the Stand's link to DIO
  ctx.fillStyle = GOLD; ctx.strokeStyle = OL; ctx.lineWidth = 1;
  const cx0 = shX + 1, cy0 = shY + 10, kk = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx0, cy0 + kk * 1.2);
  ctx.bezierCurveTo(cx0 - kk * 1.5, cy0 + kk * .1, cx0 - kk * .55, cy0 - kk * 1.2, cx0, cy0 - kk * .3);
  ctx.bezierCurveTo(cx0 + kk * .55, cy0 - kk * 1.2, cx0 + kk * 1.5, cy0 + kk * .1, cx0, cy0 + kk * 1.2);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  // ---- glowing waist core: the bright knot above the cube bed
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const wg = ctx.createRadialGradient(0, 1, 1, 0, 1, 16);
  wg.addColorStop(0, strike ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.75)');
  wg.addColorStop(.45, hexA(MAGENTA, .5));
  wg.addColorStop(1, 'rgba(120,60,190,0)');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, 1, 16, 0, 7); ctx.fill();
  ctx.restore();
  ctx.fillStyle = PLATE2; ctx.strokeStyle = OL; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(8, -3); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill(); ctx.stroke();

  // ---- arms: plated upper arm into the stacked block gauntlet
  const armAng = (a: [number, number], b: [number, number]) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  bone([[shX - 2, shY], elB], 6.2, DEEP);
  bone([[shX, shY], elF], 6.6, PLATE);
  gauntlet(elB, armAng(elB, haB), 5.4, true);
  gauntlet(elF, armAng(elF, haF), 5.8, false);

  // ---- shoulder plates: the big angular blocks that define the silhouette
  for (const side of [-1, 1] as const) {
    const px = shX + side * 13, py = shY - 6;
    ctx.save(); ctx.translate(px, py); ctx.rotate(side * -.22);
    slab([[-13, -9], [12, -11], [15, 3], [9, 9], [-12, 7]], side < 0 ? OX2 : PLATE, side < 0 ? OX : PLATE2, 2.4);
    // layered ridges running along the plate
    ctx.strokeStyle = side < 0 ? OX3 : 'rgba(140,95,205,.75)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-11, -5 + i * 4.4); ctx.lineTo(12, -6.4 + i * 4.4); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- head: wedge helmet with a pointed crown and a glowing visor band
  ctx.save();
  const hR = 12;
  ctx.beginPath();
  ctx.moveTo(hdX - hR * .82, hdY + hR * .74);     // jaw point
  ctx.lineTo(hdX - hR * .96, hdY - hR * .22);     // cheek
  ctx.lineTo(hdX - hR * .28, hdY - hR * .92);     // temple
  ctx.lineTo(hdX + hR * .5, hdY - hR * 1.15);     // crown tip
  ctx.lineTo(hdX + hR * 1.02, hdY - hR * .28);    // brow
  ctx.lineTo(hdX + hR * .68, hdY + hR * .72);     // muzzle
  ctx.closePath();
  const hg = ctx.createLinearGradient(hdX - hR, hdY - hR, hdX + hR, hdY + hR);
  hg.addColorStop(0, PLATE2); hg.addColorStop(.6, PLATE); hg.addColorStop(1, OX);
  ctx.fillStyle = hg; ctx.strokeStyle = OL; ctx.lineWidth = 2.6; ctx.fill(); ctx.stroke();
  // vertical centre ridge
  ctx.strokeStyle = 'rgba(120,80,190,.6)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(hdX + hR * .1, hdY - hR * 1.05); ctx.lineTo(hdX - hR * .06, hdY + hR * .7); ctx.stroke();
  // visor
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = GLOW; ctx.globalAlpha = solid * (strike ? 1 : .82);
  ctx.beginPath();
  ctx.moveTo(hdX - hR * .7, hdY - hR * .12);
  ctx.lineTo(hdX + hR * .92, hdY - hR * .34);
  ctx.lineTo(hdX + hR * .86, hdY + hR * .12);
  ctx.lineTo(hdX - hR * .66, hdY + hR * .18);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = solid * .5;
  const vg = ctx.createRadialGradient(hdX, hdY, 1, hdX, hdY, hR * 2.2);
  vg.addColorStop(0, 'rgba(138,255,208,.55)'); vg.addColorStop(1, 'rgba(138,255,208,0)');
  ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(hdX, hdY, hR * 2.2, 0, 7); ctx.fill();
  ctx.restore();
  // gold crest running over the crown
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(hdX - hR * .3, hdY - hR * .88); ctx.quadraticCurveTo(hdX + hR * .4, hdY - hR * 1.4, hdX + hR * 1.02, hdY - hR * .3); ctx.stroke();
  ctx.restore();

  // ---- shadow aura so the Stand never reads as a flat cut-out
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = solid * .32;
  const ag = ctx.createRadialGradient(0, shY + 8, 2, 0, shY + 8, 48);
  ag.addColorStop(0, 'rgba(180,110,235,.85)'); ag.addColorStop(.55, 'rgba(90,50,180,.35)'); ag.addColorStop(1, 'rgba(40,20,90,0)');
  ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, shY + 8, 48, 0, 7); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawWeapon(ctx: CanvasRenderingContext2D, type: Weapon, hand: [number, number], ang: number, f: any, time: number, back: boolean): [number, number] | null {
  const [x, y] = hand;
  const dx = Math.sin(ang), dy = Math.cos(ang);
  const nx = dy, ny = -dx;
  ctx.lineCap = 'round';
  const blade = (len: number, w: number, col: string, edge: string) => {
    const tx = x + dx * len, ty = y + dy * len;
    ctx.strokeStyle = OL; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x - dx * 8, y - dy * 8); ctx.lineTo(tx, ty); ctx.stroke();
    const g = ctx.createLinearGradient(x, y, tx, ty);
    g.addColorStop(0, shade(col, 0.8)); g.addColorStop(0.5, col); g.addColorStop(1, '#ffffff');
    ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x + dx * 4, y + dy * 4); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + dx * 6 + nx * 1.4, y + dy * 6 + ny * 1.4); ctx.lineTo(tx + nx * 1.2, ty + ny * 1.2); ctx.stroke();
    ctx.strokeStyle = '#241811'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x - dx * 8, y - dy * 8); ctx.lineTo(x + dx * 2, y + dy * 2); ctx.stroke();
    return [tx, ty] as [number, number];
  };

  if (type === 'dual') {
    const len = 34, tx = x + dx * len, ty = y + dy * len;
    ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - dx * 4, y - dy * 4); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = back ? '#aab4c0' : '#eef4fb'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x + dx * 3, y + dy * 3); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#2f3340'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - dx * 4, y - dy * 4); ctx.lineTo(x + dx * 3, y + dy * 3); ctx.stroke();
    return [tx, ty];
  }
  if (f?.def?.id === 'gokublack') {
    // God Split Cut (Super Saiyan Rosé Ki Blade)
    const len = 58;
    const tx = x + dx * len, ty = y + dy * len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(x - dx * 4, y - dy * 4); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(x + dx * 2, y + dy * 2); ctx.lineTo(tx, ty); ctx.stroke();
    const flare = ctx.createRadialGradient(tx, ty, 0, tx, ty, 12);
    flare.addColorStop(0, '#ffffff');
    flare.addColorStop(0.4, '#ec4899');
    flare.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flare; ctx.beginPath(); ctx.arc(tx, ty, 12, 0, 7); ctx.fill();
    for (let i = 1; i <= 4; i++) {
      const px = x + dx * (i * 12) + nx * (Math.sin(time * 0.3 + i) * 5);
      const py = y + dy * (i * 12) + ny * (Math.sin(time * 0.3 + i) * 5);
      ctx.fillStyle = i % 2 ? '#f472b6' : '#c084fc';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.fill();
    }
    ctx.restore();
    return [tx, ty];
  }
  if (type === 'katana') {
    const t = blade(48, 3.2, '#f4f6fa', f.look.energy);
    ctx.fillStyle = '#c8442a'; ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + dx * 3, y + dy * 3, 4, 0, 7); ctx.fill(); ctx.stroke();
    return t;
  }
  if (type === 'triple') {
    blade(44, 2.8, '#dfe6ee', f.look.energy);
    ctx.save(); ctx.translate(nx * 5, ny * 5); blade(40, 2.4, '#cdd6e0', f.look.energy); ctx.restore();
    const t = blade(48, 3.2, '#f4f6fa', f.look.energy);
    return t;
  }
  if (type === 'greatsword' || type === 'chainsaw') {
    const len = 58, w = 6;
    const bx = x + dx * 6, by = y + dy * 6;
    const tx = x + dx * len, ty = y + dy * len;
    const dark = f.devilT > 0;
    const g = ctx.createLinearGradient(bx - nx * w, by - ny * w, bx + nx * w, by + ny * w);
    g.addColorStop(0, dark ? '#2a050c' : '#2b2b33'); g.addColorStop(0.5, dark ? '#160308' : '#1a1a20'); g.addColorStop(1, dark ? '#3a0713' : '#3c3c46');
    ctx.fillStyle = g; ctx.strokeStyle = dark ? '#e0203a' : OL; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + nx * w, by + ny * w);
    ctx.lineTo(bx + dx * 20 + nx * (w + 1), by + dy * 20 + ny * (w + 1));
    ctx.lineTo(bx + dx * 24 + nx * (w - 3), by + dy * 24 + ny * (w - 3));
    ctx.lineTo(bx + dx * 30 + nx * (w + 1), by + dy * 30 + ny * (w + 1));
    ctx.lineTo(tx + nx * 2, ty + ny * 2);
    ctx.lineTo(tx - nx * 4 - dx * 6, ty - ny * 4 - dy * 6);
    ctx.lineTo(bx - nx * w, by - ny * w);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (type === 'chainsaw') {
      ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const k = 8 + i * 6;
        ctx.beginPath();
        ctx.moveTo(bx + dx * k + nx * (w + 1), by + dy * k + ny * (w + 1));
        ctx.lineTo(bx + dx * (k + 3) + nx * (w + 5), by + dy * (k + 3) + ny * (w + 5));
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + dx * 4, by + dy * 4); ctx.lineTo(tx - dx * 8, ty - dy * 8); ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - dx * 8, y - dy * 8); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + nx * 9, by + ny * 9); ctx.lineTo(bx - nx * 9, by - ny * 9); ctx.stroke();
    if (f.devilT > 0 || f.state === 'attack') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + Math.sin(time * 0.5) * 0.1;
      ctx.strokeStyle = f.devilT > 0 ? '#ff2040' : f.look.energy; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore();
    }
    return [tx, ty];
  }
  if (type === 'gunbai') {
    const len = 18;
    const ex = x + dx * len, ey = y + dy * len;
    ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - dx * 4, y - dy * 4); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.stroke();
    const cx = x + dx * (len + 13), cyy = y + dy * (len + 13);
    ctx.fillStyle = '#ece0c4'; ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx, cyy, 15, 12, -ang + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b01c1c'; ctx.beginPath(); ctx.arc(cx, cyy, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cyy, 2, 0, 7); ctx.fill();
    return [x + dx * (len + 26), y + dy * (len + 26)];
  }
  if (type === 'staff') {
    const len = 54;
    const tx = x + dx * len, ty = y + dy * len;
    ctx.strokeStyle = OL; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - dx * 22, y - dy * 22); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#b8483a'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(x - dx * 22, y - dy * 22); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#e7c86a'; ctx.beginPath(); ctx.arc(tx, ty, 3.4, 0, 7); ctx.fill();
    return [tx, ty];
  }
  if (type === 'knife') {
    // Held reverse grip: a short throwing blade with a dark grip wrap.
    const len = 19, tx = x + dx * len, ty = y + dy * len;
    ctx.strokeStyle = OL; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(x + dx * 2, y + dy * 2); ctx.lineTo(tx, ty); ctx.stroke();
    const g = ctx.createLinearGradient(x, y, tx, ty);
    g.addColorStop(0, '#8d97a8'); g.addColorStop(.6, '#e8eef8'); g.addColorStop(1, '#ffffff');
    ctx.strokeStyle = g; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x + dx * 5, y + dy * 5); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = f.look.accent || '#e8c14a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + dx * 7 + nx * 1.2, y + dy * 7 + ny * 1.2); ctx.lineTo(tx + nx * .8, ty + ny * .8); ctx.stroke();
    ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x - dx * 3, y - dy * 3); ctx.lineTo(x + dx * 4, y + dy * 4); ctx.stroke();
    return [tx, ty];
  }
  if (type === 'fists') {
    // Bare hands: knuckle wraps and a taped wrist give the strike weight.
    ctx.save(); ctx.translate(x, y); ctx.rotate(-ang);
    ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.fillStyle = f.look.accent || '#e8e8ee';
    ctx.beginPath(); ctx.roundRect(-4.4, -4.2, 3.4, 8.4, 1.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = f.look.top2;
    ctx.beginPath(); ctx.roundRect(-8.6, -3.2, 4.2, 6.4, 1.4); ctx.fill(); ctx.stroke();
    ctx.restore();
    return null;
  }
  return null;
}
