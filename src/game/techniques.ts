import { sfx } from './audio';
import type { AnimName, HitDef, MoveDef, TechniqueVisualStyle } from './types';

export type TechniqueMoveKey =
  | 'nex' | 'sex' | 'dex' | 'aex'
  | 'naw' | 'saw' | 'daw' | 'aaw'
  | 'nfu' | 'sfu' | 'dfu' | 'afu';

export type Stance = 'neutral' | 'side' | 'down' | 'air';
type Tier = 'limit' | 'awaken' | 'awakened';

export interface TechniqueProfile {
  limit: string;
  awaken: string;
  awakened: string;
  style: TechniqueVisualStyle;
  color: string;
  color2: string;
  limitDesc: string;
  awakenDesc: string;
  awakenedDesc: string;
}

export const TECHNIQUE_PROFILES: Record<string, TechniqueProfile> = {
  levi: {
    limit: 'Blade Sever: Zero Distance', awaken: 'Awaken: Titan Precision', awakened: 'Phantom Annihilation',
    style: 'blade', color: '#d8f6ff', color2: '#7de8c3',
    limitDesc: 'Crosses any distance with a surgical wire constellation and a lethal dual-blade follow-through.',
    awakenDesc: 'Refines the body to absolute minimum movement while every blade cut becomes an ODM execution.',
    awakenedDesc: 'U → K performs a phantom cross-slash that catches the target from two angles at once.',
  },
  killua: {
    limit: 'Godspeed: Thunder Step', awaken: 'Nen: Godspeed', awakened: 'Instant Kill Circuit',
    style: 'storm', color: '#8fe6ff', color2: '#ffffff',
    limitDesc: 'Turns the body into a bolt and detonates a paralyzing lightning field at the point of contact.',
    awakenDesc: 'Awaken the aura and accelerate every strike into a near-instant lightning circuit.',
    awakenedDesc: 'U → K teleports through the target and returns with a delayed Thunder Palm finisher.',
  },
  rengoku: {
    limit: 'Flame God: Solar Sever', awaken: 'Sun Breathing', awakened: 'Sun Breathing: Complete',
    style: 'flame', color: '#ff7a1a', color2: '#ffe08a',
    limitDesc: 'Draws a roaring solar tiger across the stage, leaving a burning path of flame.',
    awakenDesc: 'Ignites the Flame God aura; every stance becomes a distinct Sun Breathing form.',
    awakenedDesc: 'U → K completes the form with a screen-crossing flame tiger that detonates on impact.',
  },
  madara: {
    limit: 'Tengai Shinsei: Cataclysm', awaken: 'Susanoo Avatar', awakened: 'Perfect Susanoo: Avatar',
    style: 'meteor', color: '#b067ff', color2: '#ff8a3a',
    limitDesc: 'Calls a colossal flaming meteor onto the locked target while spectral armor seals the area.',
    awakenDesc: 'Projects a battle-tested Susanoo silhouette around Madara and empowers all techniques.',
    awakenedDesc: 'U → K manifests a full armored Susanoo for a devastating spectral crush.',
  },
  asta: {
    limit: 'Demon-Slayer: World End', awaken: 'Devil Union', awakened: 'Demon Nullification',
    style: 'void', color: '#e0203a', color2: '#ffffff',
    limitDesc: 'Erases projectiles in the path, then crosses the erased space with one anti-magic greatsword cleave.',
    awakenDesc: 'Bonds with the devil and turns every directional stance into black anti-magic pressure.',
    awakenedDesc: 'U → K creates a null field that reflects attacks and returns a widened divider slash.',
  },
  goku: {
    limit: 'Dragon Break', awaken: 'Ultra Instinct', awakened: 'Silver Counter',
    style: 'ki', color: '#7fdcff', color2: '#ffffff',
    limitDesc: 'A perfectly aimed Kamehameha and Dragon Fist combination that bends the attack line around the target.',
    awakenDesc: 'Ultra Instinct automatically shifts the body between neutral, side, down, and aerial technique stances.',
    awakenedDesc: 'U → K produces a silver counter-flash that redirects the incoming hit into a concentrated ki blast.',
  },
  gokublack: {
    limit: 'Divine Lasso: Judgement', awaken: 'Super Saiyan Rosé', awakened: 'Scythe of Sorrow: Divine Sever',
    style: 'ki', color: '#ec4899', color2: '#8b5cf6',
    limitDesc: 'Drives a radiant Ki blade through the foe and detonates a constellation of divine energy needles.',
    awakenDesc: 'Ascends into Super Saiyan Rosé, enveloping Goku Black in a divine magenta and violet aura.',
    awakenedDesc: 'U → K manifests the giant Rosé Scythe, carving a dimensional rift that detonates across the arena.',
  },
  ichigo: {
    limit: 'Mugetsu Manifest', awaken: 'Bankai Manifestation', awakened: 'Final Getsuga: Eternal',
    style: 'spirit', color: '#7a68ff', color2: '#ff315a',
    limitDesc: 'Crescents of spirit energy cross repeatedly before a screen-filling black release.',
    awakenDesc: 'Bankai energy wraps the blade and turns every directional variant into a Getsuga form.',
    awakenedDesc: 'U → K carves a delayed Eternal Getsuga through the target and detonates its black edge.',
  },
  naruto: {
    limit: 'Giant Rasengan: Overdrive', awaken: 'Kurama Avatar', awakened: 'Kurama: Convergence Barrage',
    style: 'fox', color: '#ff9c2e', color2: '#8fd8ff',
    limitDesc: 'Forms a giant Rasengan and drives it through the stage with a rotating chakra wake.',
    awakenDesc: 'Projects Kurama chakra wings and tail silhouettes while empowering all four technique stances.',
    awakenedDesc: 'U → K surrounds the target with converging clone-Rasengan impacts from both sides.',
  },
  tanjiro: {
    limit: 'Sun Breathing: Seventh Form', awaken: 'Hinokami Kagura', awakened: 'Sun Breathing: Thirteenth Form',
    style: 'water', color: '#ffad35', color2: '#8fe8ff',
    limitDesc: 'A solar water dragon coils through the target while a circular sun path seals the stance.',
    awakenDesc: 'Ignites Hinokami Kagura and turns the calm water stance into a burning, flowing sun form.',
    awakenedDesc: 'U → K completes a circular dragon cut that returns through the target from the opposite side.',
  },
  sasuke: {
    limit: 'Amaterasu: Inferno Prison', awaken: 'Susanoo Armor', awakened: "Indra's Arrow: Heaven Piercer",
    style: 'shadow', color: '#8d55ff', color2: '#7fd8ff',
    limitDesc: 'Seals the area with black flames and answers with a lightning armored thrust.',
    awakenDesc: 'Wraps Sasuke in a spectral Susanoo and empowers every directional technique.',
    awakenedDesc: 'U → K draws a giant lightning bow and fires an arrow that pierces through the target.',
  },
  luffy: {
    limit: 'Gear Fourth: Red Roc', awaken: 'Gear Fifth', awakened: 'Gear Fifth: Dragon',
    style: 'rubber', color: '#ff6a4a', color2: '#ffd0a8',
    limitDesc: 'Stretts a giant elastic punch across the arena while the body rockets through the target.',
    awakenDesc: 'Ignites Gear Fifth and gives each stance a distinct elastic silhouette and impact style.',
    awakenedDesc: 'U → K inflates a dragon-sized fist and fires it through the target with a Gear Fifth shockwave.',
  },
  zoro: {
    limit: 'Tatsumaki: Guillotine', awaken: 'Asura Awakening', awakened: 'Nine Swords: Conclusion',
    style: 'trio', color: '#8dffbe', color2: '#effff4',
    limitDesc: 'A three-sword tornado lifts and carves the target before pulling them into the central blade path.',
    awakenDesc: 'Surrounds Zoro with the Asura aura and empowers all sword techniques with green cutting wind.',
    awakenedDesc: 'U → K converges nine spectral swords on the target for a single crossing execution.',
  },
  saitama: {
    limit: 'Normal Punch: Infinite', awaken: 'Serious Awakening', awakened: 'Serious Series: Final',
    style: 'pressure', color: '#ffe58a', color2: '#ffffff',
    limitDesc: 'A rapid chain of normal punches collapses into one perfectly restrained pressure impact.',
    awakenDesc: 'Releases the serious aura while preserving the deliberately simple, brutal one-punch silhouette.',
    awakenedDesc: 'U → K delivers the final Serious Punch and sends a clean pressure plane across the entire stage.',
  },
  gojo: {
    limit: 'Cursed Technique: Maximum', awaken: 'Infinity Unleashed', awakened: 'Hollow Purple: Erasure',
    style: 'singularity', color: '#5fd2ff', color2: '#ff5577',
    limitDesc: 'Blue attraction and Red repulsion fold together before firing an unstable maximum projectile.',
    awakenDesc: 'Removes the blindfold and lets Infinity automatically bend each directional stance around incoming force.',
    awakenedDesc: 'U → K collides Blue and Red into Hollow Purple, erasing the target and the space around it.',
  },
  yuji: {
    limit: 'Black Flash: Refined', awaken: 'Manji Reversal', awakened: 'Malevolent Shrine: Refined',
    style: 'curse', color: '#ff315a', color2: '#ffe1e8',
    limitDesc: 'Collapses space around a delayed Black Flash, distorting the screen before the second impact lands.',
    awakenDesc: 'Reverses cursed energy around the body and turns each stance into a Manji response.',
    awakenedDesc: 'U → K opens a refined Shrine domain and performs two perfectly delayed Black Flash impacts.',
  },
  deku: {
    limit: 'One For All: Full Cowl', awaken: 'Detroit Smash: 100%', awakened: 'One For All: United',
    style: 'hero', color: '#8dffb0', color2: '#ffffff',
    limitDesc: 'Channels every One For All power through a green-lightning smash that carries the target with it.',
    awakenDesc: 'Connects Full Cowl and accelerates the whole One For All system through every technique stance.',
    awakenedDesc: 'U → K unites the inherited powers in a screen-crossing Delaware Smash finale.',
  },
  todoroki: {
    limit: 'Ice Wall: Absolute Zero', awaken: 'Half-Cold Half-Hot', awakened: 'Heaven-Piercing Ice: Final',
    style: 'twin', color: '#9fd8ff', color2: '#ff6a3a',
    limitDesc: 'Grows a horizontal glacier ridge while flame erupts through its core from the opposite side.',
    awakenDesc: 'Balances ice and fire across the body and powers each directional variant with both elements.',
    awakenedDesc: 'U → K raises a mountain-sized ice wall, then burns a blazing hole straight through it.',
  },
  eren: {
    limit: 'Hardening: Titan Assault', awaken: 'Titan Transformation', awakened: 'The Rumbling: First Step',
    style: 'titan', color: '#c69a62', color2: '#e8d7b8',
    limitDesc: 'Hardens the attacking limb and crosses the stage with a steam-driving Titan shoulder blow.',
    awakenDesc: 'Erupts into Titan steam and reinforces every stance with hardened strikes.',
    awakenedDesc: 'U → K raises a colossal Titan foot above the target and begins the first step of the Rumbling.',
  },
  denji: {
    limit: 'Chainsaw: Maximum Throttle', awaken: 'Devil Contract', awakened: 'Chainsaw Devil: Full Pull',
    style: 'saw', color: '#ff3a3a', color2: '#ffb52e',
    limitDesc: 'Runs both chainsaws at maximum speed, dragging the target through a long grinding rehit lane.',
    awakenDesc: 'Invokes the Devil Contract and surrounds the body with rotating chainsaw energy.',
    awakenedDesc: 'U → K pulls both chainsaws into a giant spinning grinder that drags and finishes the target.',
  },
  sukuna: {
    limit: 'Malevolent Cleave: Open', awaken: 'King of Curses Awakening', awakened: 'Shrine Cleave: Eclipse',
    style: 'curse', color: '#ff2347', color2: '#ffd4cb',
    limitDesc: 'Every limb becomes a blade and the air fills with autonomous red cuts that erase the space in front of Sukuna.',
    awakenDesc: 'The King of Curses fully manifests, multiplying Sukuna’s cleaves into a relentless surgical storm.',
    awakenedDesc: 'U → K opens a second Shrine layer for a screen-wide execution of delayed, space-splitting cuts.',
  },
  shadowdio: {
    limit: 'The World: Pressure', awaken: 'Za Warudo: Stand Duplication', awakened: 'The World: Overlap Finale',
    style: 'singularity', color: '#8affd0', color2: '#ffe45c',
    limitDesc: 'The World presses a hand into the air itself, folding the distance between Shadow DIO and his target.',
    awakenDesc: 'A second, phantasm of The World rises behind him; every stance gains an extra, simultaneous blow.',
    awakenedDesc: 'U → K collapses both Stands onto one point for a single unavoidable, space-warping execution.',
  },
};

const PROFILE_STANCE: Record<Stance, string> = {
  neutral: 'Origin', side: 'Surge', down: 'Cataclysm', air: 'Ascension',
};
const FOLLOWUP_STANCE: Record<Stance, string> = {
  neutral: 'Requiem', side: 'Execution', down: 'Cataclysm', air: 'Verdict',
};
const FX_BY_STYLE: Record<TechniqueVisualStyle, HitDef['fx']> = {
  blade: 'slash', storm: 'elec', flame: 'fire', meteor: 'fire', void: 'dark', ki: 'blunt', spirit: 'purple', fox: 'blunt',
  water: 'slash', shadow: 'dark', rubber: 'blunt', trio: 'slash', pressure: 'blunt', singularity: 'purple', curse: 'dark',
  hero: 'elec', twin: 'elec', titan: 'blunt', saw: 'dark',
};
const ANIM_BY_STANCE: Record<Stance, AnimName> = {
  neutral: 'cast', side: 'thrust', down: 'slam', air: 'dive',
};

const hit = (f0: number, f1: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb: number, sc: number, fx: HitDef['fx'], rehit?: number): HitDef => ({
  f: [f0, f1], x, y, w, h, dmg, ang, kb, sc, fx, ...(rehit ? { rehit } : {}),
});

function projectile(f: any, g: any, profile: TechniqueProfile, profileId: string, tier: Tier, stance: Stance) {
  const followup = tier === 'awakened';
  const air = stance === 'air';
  const ground = stance === 'down';
  const size = followup ? 108 : tier === 'limit' ? 82 : 68;
  g.spawnProj({
    owner: f, type: 'sig', sig: 'technique', reflectable: false,
    x: f.x + f.facing * (air ? 34 : 56), y: ground ? f.y - 6 : f.y - 54,
    vx: f.facing * (followup ? 15 : tier === 'limit' ? 12 : 9), vy: air ? 2.5 : 0,
    w: size, h: size, life: followup ? 54 : 42, dmg: followup ? 4.2 : 2.4, ang: followup ? 42 : 34,
    kb: followup ? 4.8 : 2.4, sc: followup ? 3.6 : 1, rehit: followup ? 4 : 0, pull: followup,
    fx: FX_BY_STYLE[profile.style], ground, dir: f.facing,
    col: profile.color, col2: profile.color2,
    data: { profileId, style: profile.style, tier, stance, followup },
    fin: followup ? { dmg: 16, ang: 44, kb: 9.2, sc: 9.4 } : tier === 'limit' ? { dmg: 12, ang: 40, kb: 7.4, sc: 7.8 } : undefined,
  });
}

interface BuildOptions {
  key: TechniqueMoveKey;
  name: string;
  desc: string;
  profile: TechniqueProfile;
  profileId: string;
  tier: Tier;
  stance: Stance;
  startup: number;
  dur: number;
  hits: HitDef[];
  spawn?: boolean;
  awakenText?: boolean;
  followupKey?: TechniqueMoveKey;
}

function buildMove(o: BuildOptions): MoveDef {
  const air = o.stance === 'air';
  const down = o.stance === 'down';
  const side = o.stance === 'side';
  const tierPower = o.tier === 'awakened' ? 1.42 : o.tier === 'limit' ? 1.16 : 1;
  const move: MoveDef = {
    name: o.name,
    desc: o.desc,
    anim: ANIM_BY_STANCE[o.stance],
    dur: o.dur,
    startup: o.startup,
    hits: o.hits,
    ability: o.tier === 'limit' ? 'limit' : o.tier === 'awaken' ? 'awaken' : 'awakened',
    stance: o.stance,
    techniqueProfile: o.profileId,
    techniqueStyle: o.profile.style,
    vfx: `tech:${o.profileId}:${o.tier}:${o.stance}`,
    variantOf: o.tier === 'awakened' ? o.profile.awakened : o.tier === 'limit' ? o.profile.limit : o.profile.awaken,
    chainLabel: o.followupKey ? 'AWAKENED VARIANT · U → K' : undefined,
    chains: o.followupKey ? { special: o.followupKey, window: [Math.max(4, o.startup - 1), Math.min(o.dur - 2, 29)] } : undefined,
    cd: o.tier === 'limit' ? 270 : o.tier === 'awaken' ? 330 : 0,
    grav: air ? 0.48 : down ? 0.8 : o.tier === 'awakened' ? 0.28 : 0.55,
    land: air,
    turns: o.stance === 'neutral' && o.tier === 'awakened' ? 2 : undefined,
    vel: side
      ? [[o.startup, (o.tier === 'awakened' ? 25 : 18) * tierPower, air ? -1 : null], [Math.max(o.startup + 12, o.dur - 9), 2, null]]
      : air
        ? [[o.startup, 3, o.tier === 'awakened' ? 15 : 11]]
        : down
          ? [[o.startup, 0, 2], [o.startup + 8, 0, 0]]
          : o.tier === 'awakened'
            ? [[0, 0, 0], [o.startup, 5, -2]]
            : undefined,
    trail: down ? 'foot' : o.profile.style === 'blade' || o.profile.style === 'trio' || o.profile.style === 'spirit' ? 'hand' : undefined,
    onFrame: (f, fr, g) => {
      if (o.awakenText && fr === 1) {
        f.auraT = Math.max(f.auraT, 42);
        g.fx.text(f.x, f.y - 150, o.profile.awaken.toUpperCase(), o.profile.color, 24, 34);
        sfx('confirm');
      }
      if (o.spawn && fr === o.startup) projectile(f, g, o.profile, o.profileId, o.tier, o.stance);
      if (fr === o.startup) {
        g.shake(o.tier === 'awakened' ? 12 : o.tier === 'limit' ? 7 : 4);
        if (o.tier !== 'awaken') g.flashScreen(o.profile.color, o.tier === 'awakened' ? 0.24 : 0.1);
        sfx(o.profile.style === 'storm' || o.profile.style === 'spirit' || o.profile.style === 'singularity' ? 'elec' : o.profile.style === 'flame' || o.profile.style === 'meteor' ? 'fire' : 'swingH');
      }
      if (fr > o.startup && fr % 5 === 0) {
        g.fx.add({
          x: f.x - f.facing * (8 + Math.random() * 20), y: f.y - 18 - Math.random() * 64,
          vx: -f.facing * (1 + Math.random() * 3), vy: -0.8 - Math.random() * 2,
          color: Math.random() < 0.5 ? o.profile.color : o.profile.color2,
          kind: o.profile.style === 'flame' || o.profile.style === 'meteor' ? 'ember' : 'glow', life: 20, size: 5 + Math.random() * 5,
        });
      }
    },
  };
  return move;
}

/** Adds the complete H/U technique tree to a fighter without duplicating hundreds of hand-authored records. */
export function installTechniques<T extends Record<string, MoveDef>>(id: string, look: { energy: string; energy2?: string }, core: T) {
  const base = TECHNIQUE_PROFILES[id] || {
    limit: 'Limit Break', awaken: 'Awakening', awakened: 'Awakened Finish', style: 'ki' as TechniqueVisualStyle,
    color: look.energy, color2: look.energy2 || '#ffffff', limitDesc: 'A fighter-specific limit-breaking technique.',
    awakenDesc: 'A fighter-specific awakening with four directional stances.', awakenedDesc: 'The awakened follow-up performed with U → K.',
  };
  const profile: TechniqueProfile = { ...base, color: base.color || look.energy, color2: base.color2 || look.energy2 || '#ffffff' };
  const fx = FX_BY_STYLE[profile.style];
  const stanceHit = (stance: Stance, tier: Tier): HitDef[] => {
    const power = tier === 'awakened' ? 1.5 : tier === 'limit' ? 1.2 : 1;
    if (stance === 'air') return [hit(6, 17, 24, -20, 76, 68, 9.5 * power, -54, 6.2 * power, 7 * power, fx, 4)];
    if (stance === 'down') return [hit(9, 25, 38, -18, 132, 52, 2.8 * power, 68, 2.2 * power, 1.2, fx, 4), hit(26, 30, 42, -18, 144, 58, 8.5 * power, 62, 6.2 * power, 7.2, fx)];
    if (stance === 'side') return [hit(6, 18, 58, -44, 108, 58, 3.2 * power, 38, 2.8 * power, 1.8, fx, 3), hit(19, 23, 62, -44, 118, 64, 9 * power, 40, 6.6 * power, 7.4, fx)];
    return [hit(8, 20, 56, -48, 96, 76, 3 * power, 42, 2.4 * power, 1.6, fx, 3), hit(21, 25, 58, -48, 106, 82, 8 * power, 42, 6 * power, 6.8, fx)];
  };

  const moves = { ...core } as T & Record<TechniqueMoveKey, MoveDef>;
  const stanceList: Stance[] = ['neutral', 'side', 'down', 'air'];
  const limitKeys: TechniqueMoveKey[] = ['nex', 'sex', 'dex', 'aex'];
  const awakenKeys: TechniqueMoveKey[] = ['naw', 'saw', 'daw', 'aaw'];
  const followKeys: TechniqueMoveKey[] = ['nfu', 'sfu', 'dfu', 'afu'];

  stanceList.forEach((stance, i) => {
    const suffix = PROFILE_STANCE[stance];
    moves[limitKeys[i]] = buildMove({
      key: limitKeys[i], name: `${profile.limit} · ${suffix}`, desc: `${profile.limitDesc} ${stance === 'air' ? 'Performed in the air.' : stance === 'down' ? 'Performed while holding down.' : stance === 'side' ? 'Performed while moving toward the opponent.' : 'Performed from a standing neutral stance.'}`,
      profile, profileId: id, tier: 'limit', stance, startup: stance === 'air' ? 6 : 9, dur: stance === 'air' ? 42 : 38,
      hits: stanceHit(stance, 'limit'), spawn: stance === 'neutral' || stance === 'air',
    });
    moves[awakenKeys[i]] = buildMove({
      key: awakenKeys[i], name: `${profile.awaken} · ${suffix}`, desc: `${profile.awakenDesc} ${stance === 'air' ? 'Use this aerial awakening in the air.' : stance === 'down' ? 'Hold down to use the grounded awakening.' : stance === 'side' ? 'Hold left or right to use the dashing awakening.' : 'Use from a standing neutral stance.'}`,
      profile, profileId: id, tier: 'awaken', stance, startup: stance === 'air' ? 5 : 8, dur: 34,
      hits: stanceHit(stance, 'awaken'), spawn: false, awakenText: true, followupKey: followKeys[i],
    });
    moves[followKeys[i]] = buildMove({
      key: followKeys[i], name: `${profile.awakened} · ${FOLLOWUP_STANCE[stance]}`, desc: `${profile.awakenedDesc} This is the ${stance} variant reached by pressing K immediately after U.`,
      profile, profileId: id, tier: 'awakened', stance, startup: stance === 'air' ? 7 : 11, dur: stance === 'air' ? 48 : 50,
      hits: stanceHit(stance, 'awakened'), spawn: true,
    });
  });

  return moves;
}
