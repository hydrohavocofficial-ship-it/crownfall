/**
 * THE COMBAT MODEL
 *
 * Every number that decides what a hit *is* lives here, in one table, with the
 * reasoning attached. Before this file the rules were spread across `applyHit`
 * and the move tables, which is how a fighting game ends up with a light attack
 * that hits harder than a heavy one and nobody noticing for a season.
 *
 * Four ideas hold the whole thing together:
 *
 *  1. **TIER.** A move's damage is not its identity. Its tier is. Light is fast
 *     and safe, heavy is slow and committed, special costs meter or cooldown,
 *     and the awakened kit is the most of everything. Hitstun, hitstop and
 *     launch behaviour are read off the tier, so a move can be rebalanced by
 *     changing one number rather than re-authoring a hitbox.
 *
 *  2. **SCALING.** A combo is not a sum. Every hit after the first in a
 *     sequence is worth less, in damage and in knockback, so the tail of a long
 *     chain is a confirmation rather than a kill. The floor is high enough that
 *     a real combo still pays, and low enough that it cannot be a solo win.
 *
 *  3. **JUGGLE BUDGET.** Knockback that scales with damage is not the only thing
 *     keeping a target in the air; an air target's ability to *stay* in the air
 *     is budgeted, and every re-launch spends from it. Without this, any move
 *     with a long active window is an infinite.
 *
 *  4. **Juggle DECAY.** Even with a budget, the launcher that is spammed should
 *     stop working. The n-th launch of a sequence launches less far.
 */

import type { HitDef } from './types';

export type MoveTier = 'light' | 'heavy' | 'special' | 'awakenLight' | 'awakenHeavy' | 'awakened';

export interface TierProfile {
  /** Frames of freeze on both bodies at a baseline damage value. */
  hitstop: number;
  /** Extra hitstun frames granted, on top of what the knockback works out to. */
  stun: number;
  /** Multiplier on the knockback this tier is allowed to generate. */
  knockback: number;
  /** Multiplier on the damage this tier deals. */
  damage: number;
  /** True when the tier is allowed to lift a grounded target off the floor. */
  launcher: boolean;
  /** The label the HUD and the combo readout use. */
  label: string;
}

/**
 * Baselines are relative, not absolute: a given move's own numbers are multiplied
 * by its tier's profile. `light` is the unit everything else is measured against.
 */
export const TIERS: Record<MoveTier, TierProfile> = {
  light: { hitstop: 3, stun: 0, knockback: 0.9, damage: 1, launcher: false, label: 'LIGHT' },
  heavy: { hitstop: 6, stun: 2, knockback: 1.15, damage: 1.06, launcher: true, label: 'HEAVY' },
  special: { hitstop: 8, stun: 4, knockback: 1.2, damage: 1.1, launcher: true, label: 'SPECIAL' },
  awakenLight: { hitstop: 4, stun: 0, knockback: 0.95, damage: 1.04, launcher: false, label: 'AWAKENED LIGHT' },
  awakenHeavy: { hitstop: 8, stun: 5, knockback: 1.3, damage: 1.12, launcher: true, label: 'AWAKENED HEAVY' },
  awakened: { hitstop: 11, stun: 7, knockback: 1.45, damage: 1.18, launcher: true, label: 'AWAKENED' },
};

/** Which tier a move belongs to. Anything unlabelled is treated as a light. */
export function tierOf(ability: string | undefined, moveKey: string | null | undefined): MoveTier {
  switch (ability) {
    case 'special': return 'special';
    case 'awakenLight': return 'awakenLight';
    case 'awakenHeavy': return 'awakenHeavy';
    case 'awakened': return 'awakened';
    case 'awaken': return 'awakened';
    default: break;
  }
  if (moveKey === 'nsig' || moveKey === 'ssig' || moveKey === 'dsig' || moveKey === 'gp' || moveKey === 'rec') return 'heavy';
  if (moveKey && /^(n|s|d)?spec$/.test(moveKey)) return 'special';
  if (moveKey && /(_spec)$/.test(moveKey)) return 'special';
  if (moveKey && /(_heavy)$/.test(moveKey)) return 'heavy';
  return 'light';
}

// ---------------------------------------------------------------------------
// COMBO SCALING
// ---------------------------------------------------------------------------

/**
 * Damage retained by the n-th hit of a combo, n counting from 1.
 *
 * Falls to 0.62 by the fifth hit and 0.34 by the tenth. Chosen so that a
 * well-built four-hit string lands for roughly what its raw sum says, while a
 * ten-hit mash has given up two thirds of its face value and has to actually
 * finish someone off. Never reaches zero: chip damage is the point of keeping
 * pressure on, and a hard cutoff turns long strings into whiffs.
 */
export function comboScale(hitIndex: number): number {
  if (hitIndex <= 1) return 1;
  return Math.max(0.34, 1 - (hitIndex - 1) * 0.085);
}

/**
 * Knockback retained by the n-th hit of a combo.
 *
 * Falls faster than damage does. Damage scaling is what stops combos being
 * free; knockback scaling is what stops them being safe, because a weakened
 * launcher no longer has the reach to start the next one.
 */
export function comboKnockbackScale(hitIndex: number): number {
  if (hitIndex <= 1) return 1;
  return Math.max(0.42, 1 - (hitIndex - 1) * 0.11);
}

/** The launcher rule: how much less the n-th launch of a sequence carries. */
export function launchDecay(launchIndex: number): number {
  if (launchIndex <= 1) return 1;
  return Math.max(0.3, 1 - (launchIndex - 1) * 0.24);
}

// ---------------------------------------------------------------------------
// JUGGLE BUDGET
// ---------------------------------------------------------------------------

/**
 * How many *additional* times an airborne target may be lifted before the
 * engine stops giving it upward knockback. Reset on landing.
 *
 * Two is the number that works. One makes juggling feel like an accident; three
 * or more turns any move with a wide active window into a combo nobody can
 * escape, and the escape - simply walking off the stage with them - is a worse
 * answer than the juggle is a problem.
 */
export const JUGGLE_BUDGET = 2;

/** Frames a juggled target stays unable to act after leaving the juggle budget. */
export const JUGGLE_SPOTLESS = 10;

/**
 * Upward speed, in pixels per frame, of a lift the juggle budget has refused.
 *
 * Gravity is 0.62, so this is not a launch: it is the visible end of a juggle.
 * The body pops once, loses the height immediately, and comes down - which is
 * the difference between a juggle that stops and an infinite that does not.
 */
export const JUGGLE_POP = 1.2;

/** The smallest fraction of a hit's authored damage that is ever applied. */
export const MIN_DAMAGE_FRACTION = 0.22;

// ---------------------------------------------------------------------------
// HITSTOP
// ---------------------------------------------------------------------------

/**
 * Frames of freeze on contact.
 *
 * Driven by the tier, then by how hard the blow actually landed, and hard-capped.
 * The cap is the important part: an awakened special that hits for 30 used to
 * freeze the world for the better part of a second, which is not impact, it is a
 * pause the player has to sit through.
 */
export function hitstopFrames(tier: TierProfile, damage: number, kb: number): number {
  const weight = Math.min(1, damage / 22);
  return Math.round(Math.min(14, tier.hitstop + damage * 0.2 + (kb > 11 ? 2 : 0) + weight * 2));
}

// ---------------------------------------------------------------------------
// THE AWAKENING GAUGE
// ---------------------------------------------------------------------------

/**
 * Gauge gained per point of damage dealt, and per point taken.
 *
 * This is the single most consequential number in the file. At the old rate
 * (0.9 dealt) a full gauge arrived roughly every four exchanges, so the
 * transformation was a formality that happened constantly. At 0.24 it takes
 * roughly four times as long: about a quarter of a stock at full aggression, and
 * not at all in a fight spent blocking. Taking damage builds far more slowly
 * than dealing it, so losing does not hand you the Awakening - it has to be
 * earned in the same direction as everything else.
 */
export const GAIN_ON_DEAL = 0.24;
export const GAIN_ON_TAKE = 0.13;

/**
 * Gauge drained per frame while awakened.
 *
 * 100 / 0.055 = 1818 frames = 30.3 seconds. Long enough that an Awakening
 * is a real phase of the fight you get to play in rather than a burst, short
 * enough that it cannot be hoarded into an unbeatable state, and slow enough
 * on screen to read as a resource being spent rather than a bar being drained.
 */
export const GAUGE_DRAIN = 0.055;

/** Whole seconds one full Awakening lasts, for the HUD and the move list. */
export const AWAKEN_SECONDS = Math.round(100 / GAUGE_DRAIN / 60);

/** Frames the awakening activation itself locks out after the gauge fills. */
export const AWAKEN_LOCKOUT = 420;

/**
 * Frames after the Awakening closes during which the fighter's own damage still
 * cannot rebuild the gauge.
 *
 * The state resolves in the fighter's update and a hit lands after it, so the
 * blow that empties the bar would otherwise be paid for with a sliver of the
 * resource it just spent.
 */
export const AWAKEN_SEAL = 24;

/** Multipliers the awakened state grants on top of the awakened moveset. */
export const AWAKEN_SPEED = 1.2;
export const AWAKEN_DAMAGE = 1.1;

/** Below this the Awakening drops and the fighter is returned to their base kit. */
export const AWAKEN_FLOOR = 0.5;

/** Normalises an authored hit for presentation and scaling purposes. */
export function hitWeight(h: HitDef) {
  return Math.max(h.dmg, 1);
}
