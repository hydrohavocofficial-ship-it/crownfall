/**
 * The technique builder.
 *
 * Four stances x four tiers, sixteen moves per fighter, all generated from one
 * profile so a new fighter on the roster is a data entry rather than a hundred
 * and twenty hand-authored records. The naming and the descriptions come from
 * `awakenings.ts`; everything below is frame data, hitboxes and effects.
 *
 *   R  AWAKEN     naw / saw / daw / aaw    the transformation, chosen by stance
 *   J  AWAKENED   nwl / swl / dwl / awl    fast, chains, safe
 *   K  AWAKENED   nwh / swh / dwh / awh    the launcher
 *   L  AWAKENED   nfu / sfu / dfu / afu    the answer
 *
 * The three awakened attack tiers are only reachable while the gauge is
 * draining; `Fighter.tryActions` owns that rule. `awaken` is the only one of the
 * four that transforms rather than attacks, and the only one the engine gates on
 * a full gauge.
 */

import { sfx } from './audio';
import { awakeningFor, DOMAIN_POWER, type AwakenedMove, type AwakeningProfile } from './awakenings';
import { TIERS, type MoveTier } from './combat';
import type { AnimName, HitDef, MoveDef, TechniqueVisualStyle } from './types';

export type TechniqueMoveKey =
  | 'naw' | 'saw' | 'daw' | 'aaw'
  | 'nwl' | 'swl' | 'dwl' | 'awl'
  | 'nwh' | 'swh' | 'dwh' | 'awh'
  | 'nfu' | 'sfu' | 'dfu' | 'afu';

export type Stance = 'neutral' | 'side' | 'down' | 'air';

/** The four generated tiers, and the key prefix each one owns. */
type GeneratedTier = 'awaken' | 'awakenLight' | 'awakenHeavy' | 'awakened';

const STANCES: Stance[] = ['neutral', 'side', 'down', 'air'];

/** Reads the per-stance key of a tier: `naw` -> prefix `n`, suffix `aw`. */
const keyFor = (prefix: string, tier: GeneratedTier) => `${prefix}${
  tier === 'awaken' ? 'aw' : tier === 'awakenLight' ? 'wl' : tier === 'awakenHeavy' ? 'wh' : 'fu'
}` as TechniqueMoveKey;

/** Neutral / Forward / Down / Aerial. Shown on the move list so a variant is findable. */
const STANCE_SUFFIX: Record<Stance, string> = {
  neutral: 'Origin', side: 'Surge', down: 'Cataclysm', air: 'Ascension',
};
const STANCE_HINT: Record<Stance, string> = {
  neutral: 'From a standing neutral stance.',
  side: 'While holding toward the opponent.',
  down: 'While holding down.',
  air: 'In the air.',
};

const FX_BY_STYLE: Record<TechniqueVisualStyle, HitDef['fx']> = {
  blade: 'slash', storm: 'elec', flame: 'fire', meteor: 'fire', void: 'dark', ki: 'blunt', spirit: 'purple', fox: 'blunt',
  water: 'slash', shadow: 'dark', rubber: 'blunt', trio: 'slash', pressure: 'blunt', singularity: 'purple', curse: 'dark',
  hero: 'elec', twin: 'elec', titan: 'blunt', saw: 'dark',
};
const ANIM_BY_STANCE: Record<Stance, AnimName> = {
  neutral: 'cast', side: 'thrust', down: 'slam', air: 'dive',
};
/** Tiers whose silhouette should be drawn with the weapon rather than the fist. */
const HAND_TRAIL: TechniqueVisualStyle[] = ['blade', 'trio', 'spirit', 'rubber', 'saw', 'shadow'];

const hit = (f0: number, f1: number, x: number, y: number, w: number, h: number,
  dmg: number, ang: number, kb: number, sc: number, fx: HitDef['fx'], rehit?: number): HitDef =>
  ({ f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, fx, ...(rehit ? { rehit } : {}) });

/**
 * The awakened shot.
 *
 * Only the special tier fires one. The light and heavy tiers stay on the body -
 * a transformation whose whole pitch is that you hit harder should not also take
 * the one thing that made its attacks readable, which is being in front of you.
 */
function projectile(f: any, g: any, a: AwakeningProfile, profileId: string, stance: Stance) {
  const air = stance === 'air';
  const ground = stance === 'down';
  const size = 108;
  g.spawnProj({
    owner: f, type: 'sig', sig: 'technique', reflectable: false,
    x: f.x + f.facing * (air ? 34 : 56), y: ground ? f.y - 6 : f.y - 54,
    vx: f.facing * 15, vy: air ? 2.5 : 0,
    w: size, h: size, life: 54, dmg: 4.2, ang: 42,
    kb: 4.8, sc: 3.6, rehit: 4, pull: true,
    fx: FX_BY_STYLE[a.style], ground, dir: f.facing,
    col: a.color, col2: a.color2,
    data: { profileId, style: a.style, tier: 'awakened', stance },
    fin: { dmg: 16, ang: 44, kb: 9.2, sc: 9.4 },
  });
}

interface BuildOptions {
  profileId: string;
  awakening: AwakeningProfile;
  tier: GeneratedTier;
  stance: Stance;
  name: string;
  desc: string;
  hits: HitDef[];
  startup: number;
  dur: number;
  cd: number;
  spawn: boolean;
  /** The transformation itself: stamps the name, plays the cue, spends the gauge. */
  transformation?: boolean;
  /** Chains into the awakened special, for the tier that reads as a set-up. */
  followupKey?: TechniqueMoveKey;
  /** Stamped over the move list so the awakened kit is identifiable in a list. */
  chainLabel?: string;
}

function buildMove(o: BuildOptions): MoveDef {
  const { awakening: a, stance } = o;
  const air = stance === 'air';
  const down = stance === 'down';
  const side = stance === 'side';
  const tier = TIERS[o.tier as MoveTier];
  return {
    name: o.name,
    desc: o.desc,
    anim: ANIM_BY_STANCE[stance],
    dur: o.dur,
    startup: o.startup,
    hits: o.hits,
    ability: o.tier,
    stance,
    techniqueProfile: o.profileId,
    techniqueStyle: a.style,
    vfx: `tech:${o.profileId}:${o.tier}:${stance}`,
    variantOf: a.name,
    chainLabel: o.chainLabel,
    chains: o.followupKey ? { special: o.followupKey, window: [Math.max(4, o.startup - 1), Math.min(o.dur - 2, 29)] } : undefined,
    cd: o.cd,
    grav: air ? 0.48 : down ? 0.8 : o.tier === 'awakened' ? 0.28 : 0.55,
    land: air,
    turns: stance === 'neutral' && o.tier === 'awakened' ? 2 : undefined,
    vel: o.transformation
      ? [[0, 0, 0]]
      : side
        ? [[o.startup, (o.tier === 'awakened' ? 25 : o.tier === 'awakenHeavy' ? 20 : 12), air ? -1 : null], [Math.max(o.startup + 12, o.dur - 9), 2, null]]
        : air
          ? [[o.startup, 3, o.tier === 'awakened' || o.tier === 'awakenHeavy' ? 15 : 11]]
          : down
            ? [[o.startup, 0, 2], [o.startup + 8, 0, 0]]
            : o.tier === 'awakened'
              ? [[0, 0, 0], [o.startup, 5, -2]]
              : undefined,
    trail: down ? 'foot' : HAND_TRAIL.includes(a.style) ? 'hand' : undefined,
    onFrame: (f, fr, g) => {
      if (o.transformation && fr === 1) {
        // The transformation is announced once, on entry, and the announcement
        // is what the player reads to decide whether the spend was worth it.
        f.auraT = Math.max(f.auraT, 54);
        g.fx.text(f.x, f.y - 158, a.name.toUpperCase(), a.color, 26, 44);
        g.fx.ring(f.x, f.y - 42, 14, 200, a.color, 24, 9);
        g.fx.ring(f.x, f.y - 42, 14, 130, '#ffffff', 18, 5);
        g.flashScreen(a.color, 0.3);
        g.shake(9);
        sfx('confirm');
      }
      if (o.spawn && fr === o.startup) projectile(f, g, a, o.profileId, stance);
      if (fr === o.startup && !o.transformation) {
        g.shake(tier.hitstop * 0.8);
        g.flashScreen(a.color, o.tier === 'awakened' ? 0.2 : 0.07);
        sfx(a.style === 'storm' || a.style === 'spirit' || a.style === 'singularity' ? 'elec'
          : a.style === 'flame' || a.style === 'meteor' ? 'fire'
            : a.style === 'pressure' || a.style === 'ki' ? 'heavyhit' : 'swingH');
      }
      if (fr > o.startup && fr % 5 === 0) {
        g.fx.add({
          x: f.x - f.facing * (8 + Math.random() * 20), y: f.y - 18 - Math.random() * 64,
          vx: -f.facing * (1 + Math.random() * 3), vy: -0.8 - Math.random() * 2,
          color: Math.random() < 0.5 ? a.color : a.color2,
          kind: a.style === 'flame' || a.style === 'meteor' ? 'ember' : 'glow', life: 20, size: 5 + Math.random() * 5,
        });
      }
    },
  };
}

/**
 * Hitboxes, per stance and per tier.
 *
 * Read these as three shapes rather than four records: a fast single hit for the
 * awakened light, a long-launching single hit for the awakened heavy, and a
 * two-stage pull-then-release for the special that also fires a projectile. The
 * numbers are tier multipliers on one authored baseline, so a fighter's awakened
 * light can never out-punch its awakened special by accident.
 */
const POWER: Record<GeneratedTier, number> = { awaken: 1, awakenLight: 1.05, awakenHeavy: 1.5, awakened: 1.72 };
const STARTUP: Record<GeneratedTier, Record<Stance, number>> = {
  // The transformation is the one thing worth waiting for.
  awaken: { neutral: 10, side: 8, down: 9, air: 6 },
  // Awakened light has to be faster than a normal light. That is the contract.
  awakenLight: { neutral: 5, side: 5, down: 6, air: 4 },
  // Awakened heavy is slow on purpose: it is the commitment.
  awakenHeavy: { neutral: 12, side: 11, down: 12, air: 8 },
  awakened: { neutral: 13, side: 12, down: 13, air: 9 },
};
const DURATION: Record<GeneratedTier, Record<Stance, number>> = {
  awaken: { neutral: 32, side: 32, down: 32, air: 30 },
  awakenLight: { neutral: 26, side: 26, down: 27, air: 26 },
  awakenHeavy: { neutral: 42, side: 42, down: 44, air: 40 },
  awakened: { neutral: 50, side: 50, down: 52, air: 46 },
};

function stanceHit(stance: Stance, tier: GeneratedTier, fx: HitDef['fx']): HitDef[] {
  const p = POWER[tier];
  if (tier === 'awakenLight') {
    // Fast, wide, single. It is meant to be mashed inside an existing string.
    if (stance === 'air') return [hit(3, 12, 26, -22, 78, 70, 5.6 * p, -50, 3.4 * p, 3.6 * p, fx, 5)];
    if (stance === 'down') return [hit(4, 13, 40, -14, 128, 40, 4.4 * p, 70, 2.6 * p, 1.2, fx, 5)];
    if (stance === 'side') return [hit(4, 13, 56, -44, 104, 60, 5 *p, 34, 3 * p, 1.6, fx, 4)];
    return [hit(5, 14, 54, -48, 92, 78, 5.2 * p, 38, 3 * p, 1.6, fx, 4)];
  }
  if (stance === 'air') return [hit(6, 18, 24, -20, 80, 72, 9.5 * p, -56, 6.4 * p, 7.2 * p, fx, 4)];
  if (stance === 'down') return [hit(9, 25, 38, -18, 136, 52, 2.8 * p, 68, 2.2 * p, 1.2, fx, 4), hit(26, 31, 42, -18, 150, 60, 9 * p, 62, 6.4 * p, 7.4, fx)];
  if (stance === 'side') return [hit(6, 18, 58, -44, 112, 58, 3.2 * p, 36, 2.8 * p, 1.8, fx, 3), hit(19, 24, 62, -44, 124, 66, 9.4 * p, 40, 6.8 * p, 7.6, fx)];
  return [hit(8, 20, 56, -48, 98, 78, 3 * p, 40, 2.4 * p, 1.6, fx, 3), hit(21, 26, 58, -48, 110, 86, 8.6 * p, 42, 6.2 * p, 7, fx)];
}

/** Cooldowns, in frames. The special is the only tier the engine meters. */
const COOLDOWN: Record<GeneratedTier, number> = { awaken: 0, awakenLight: 0, awakenHeavy: 0, awakened: 150 };

/** Label shown on the move list, so a variant is identifiable outside a match. */
const CHAIN_LABEL: Record<GeneratedTier, string> = {
  awaken: 'AWAKEN · R AT FULL GAUGE',
  awakenLight: 'AWAKENED LIGHT · J',
  awakenHeavy: 'AWAKENED HEAVY · K',
  awakened: 'AWAKENED SPECIAL · L',
};

/**
 * Re-homes a fighter's old ultimate into the awakened special.
 *
 * The ultimate is gone as a button, but the set-pieces are the reason several of
 * these characters are on the roster - a Malevolent Shrine, a Hollow Purple, a
 * Rumbling. Deleting them would be vandalism. They are halved in power, their
 * cast is cut, and they are performed from the awakened state on a cooldown, so
 * the moment still happens and still looks like itself while no longer being a
 * one-button answer to everything.
 */
function domainSpecial(base: MoveDef, a: AwakeningProfile, profileId: string, stance: Stance): MoveDef {
  const cast = Math.max(10, Math.round(base.startup * 0.6));
  const hits: HitDef[] = base.hits.map(h => ({
    ...h,
    dmg: +Math.max(1, h.dmg * DOMAIN_POWER).toFixed(1),
    kb: +(h.kb * DOMAIN_POWER).toFixed(2),
    sc: +(h.sc * DOMAIN_POWER).toFixed(2),
  }));
  const move: MoveDef = {
    ...base,
    name: a.special.name,
    desc: a.domain ? `${a.special.desc} ${a.domain}` : a.special.desc,
    startup: cast,
    // Long enough to read as a set-piece, short enough that it is not a tax.
    dur: Math.max(38, Math.round(base.dur * 0.55)),
    hits,
    ability: 'awakened',
    stance,
    techniqueProfile: profileId,
    techniqueStyle: a.style,
    variantOf: a.name,
    chainLabel: CHAIN_LABEL.awakened,
    cd: 300,
    // The old ultimate's armour was balanced around being a one-button, meter-
    // gated super. A fifteen-second awakening is not that, so the immunity is
    // shortened to a startup window and the body is free to be punished after.
    invuln: base.invuln ? [0, Math.min(base.invuln[1], cast + 6)] : undefined,
    onStart: (f, g) => { f.auraT = Math.max(f.auraT, 40); base.onStart?.(f, g); },
    onFrame: (f, fr, g) => {
      // The original's own choreography is what makes it recognisable, so it
      // plays - just sooner, because the cast is shorter.
      base.onFrame?.(f, fr, g);
      if (fr === cast) { g.shake(10); g.flashScreen(a.color, 0.16); }
    },
  };
  delete (move as any).ult;
  return move;
}

/**
 * Installs the whole awakening tree on a fighter.
 *
 * `domain` is the character's retained ultimate, if they had one worth keeping.
 * It replaces the generated neutral awakened special; the other three stances
 * stay generated so the kit is always four options deep.
 */
export function installTechniques<T extends Record<string, MoveDef>>(
  id: string, look: { energy: string; energy2?: string }, core: T, domain?: MoveDef,
) {
  const a = awakeningFor(id, 'Awakening', look.energy, look.energy2 || '#ffffff');
  const fx = FX_BY_STYLE[a.style];
  const moves = { ...core } as T & Record<TechniqueMoveKey, MoveDef>;

  const tiers: GeneratedTier[] = ['awaken', 'awakenLight', 'awakenHeavy', 'awakened'];
  for (const tier of tiers) {
    for (let i = 0; i < STANCES.length; i++) {
      const stance = STANCES[i];
      const key = keyFor(['n', 's', 'd', 'a'][i], tier);

      // A retained domain takes the neutral slot of the awakened special.
      if (tier === 'awakened' && stance === 'neutral' && domain) {
        moves[key] = domainSpecial(domain, a, id, stance);
        continue;
      }

      const labelled: AwakenedMove = tier === 'awaken'
        ? { name: a.name, desc: a.charge }
        : tier === 'awakenLight' ? a.light
          : tier === 'awakenHeavy' ? a.heavy : a.special;
      const move = buildMove({
        profileId: id, awakening: a, tier, stance,
        name: `${labelled.name} · ${STANCE_SUFFIX[stance]}`,
        desc: `${labelled.desc} ${STANCE_HINT[stance]}`,
        hits: stanceHit(stance, tier, fx),
        startup: STARTUP[tier][stance],
        dur: DURATION[tier][stance],
        cd: COOLDOWN[tier],
        spawn: tier === 'awakened' && stance !== 'neutral',
        transformation: tier === 'awaken',
        // The awakened heavy is the set-up: it chains straight into the special.
        followupKey: tier === 'awakenHeavy' ? keyFor(['n', 's', 'd', 'a'][i], 'awakened') : undefined,
        chainLabel: CHAIN_LABEL[tier],
      });
      moves[key] = move;
    }
  }
  return moves;
}

/** The Awakening's public identity, for the move list and the tutorials. */
export { AWAKENINGS, type AwakeningProfile } from './awakenings';
