/**
 * AWAKENINGS — the per-character content behind the awakened state.
 *
 * Every fighter in the roster reaches their Awakening by spending a full gauge
 * with a single button, and for the duration of the drain attacks a kit that
 * exists nowhere else: a light, a heavy and a special, each of them stance-aware
 * the same way the base kit is. This file is where that kit is *named*.
 *
 * Why a separate table. `techniques.ts` builds four stances x N tiers per
 * fighter, and doing the naming inline turned it into four hundred near-identical
 * string literals nobody could review. Naming lives here, one entry per fighter,
 * so a character's whole awakened identity can be read at a glance and balanced
 * against its neighbours. The builder fills in frames, hitboxes and effects; this
 * table supplies the identity, and it is the half of the kit a player actually
 * remembers.
 *
 * Three rules the builder enforces on everything below:
 *  1. The awakened light is *fast*. It has to be, because it is the button you
 *     press in the middle of a combo the moment the gauge tops out.
 *  2. The awakened heavy is the launcher. It is the one that ends a juggle.
 *  3. The awakened special is the answer. Longest startup, widest reach, and for
 *     a handful of fighters it is a *domain*: the old ultimate, re-homed here at
 *     reduced power rather than deleted, because those set-pieces are the reason
 *     those characters are on the roster.
 */

import type { TechniqueVisualStyle } from './types';

export interface AwakenedMove {
  name: string;
  desc: string;
}

export interface AwakeningProfile {
  /** The transformation's own name, stamped over the character on entry. */
  name: string;
  /** One line shown the instant the gauge fills, before anything is chosen. */
  charge: string;
  /** Awakened J. Quick, chains, never the thing that ends the exchange. */
  light: AwakenedMove;
  /** Awakened K. The launcher. */
  heavy: AwakenedMove;
  /**
   * Awakened L. The finisher, and for `domain` fighters the set-piece itself.
   * See `domain` below.
   */
  special: AwakenedMove;
  /**
   * Set when the fighter's old ultimate was a set-piece worth keeping - a
   * domain, a transformation, a screen-wide statement. The builder re-homes it
   * as the awakened special at `DOMAIN_POWER` and shortens its cast, so it still
   * happens, still looks like itself, and is no longer a one-button match-ender
   * that never had to be earned.
   */
  domain?: string;
  /** How the transformation reads visually. Drives the aura palette. */
  style: TechniqueVisualStyle;
  color: string;
  color2: string;
}

/**
 * Power multiplier applied to a re-homed domain.
 *
 * A domain used to be the whole ultimate: a two-second root followed by five
 * seconds of unavoidable damage. Inside a fifteen-second awakened state that is
 * simply too much — the gauge is meant to be a decision, not a formality. Half
 * power, and the cast is shortened, keeps the beat recognisable and the answer
 * available without letting one button decide a stock.
 */
export const DOMAIN_POWER = 0.5;

export const AWAKENINGS: Record<string, AwakeningProfile> = {
  levi: {
    name: 'Titan Precision',
    charge: 'Every unnecessary motion is gone. What is left is the wire.',
    light: {
      name: 'Zero-Gap Cut',
      desc: 'Two wire draws so short the blade barely travels. Six frames of startup, and the follow-up is already moving before the first one stops.',
    },
    heavy: {
      name: 'Anchor Point',
      desc: 'He plants a blade through the target and rides it, dragging them out of the air and putting them where the next cut lands.',
    },
    special: {
      name: 'Phantom Annihilation',
      desc: 'The wires cross from two angles at once. The second line is invisible until it is already through them.',
    },
    style: 'blade', color: '#d8f6ff', color2: '#7de8c3',
  },
  killua: {
    name: 'Godspeed',
    charge: 'The body stops being a thing that travels and becomes the distance itself.',
    light: {
      name: 'Thunder Thread',
      desc: 'A strike that arrives before the swing. Four frames, and the electricity is still standing where he was.',
    },
    heavy: {
      name: 'Circuit Breaker',
      desc: 'He goes through them rather than into them, and the discharge on the way out leaves them hanging in the air.',
    },
    special: {
      name: 'Instant Kill Circuit',
      desc: 'A closed loop of lightning that finds the target from any angle and closes on its own.',
    },
    style: 'storm', color: '#8fe6ff', color2: '#ffffff',
  },
  rengoku: {
    name: 'Sun Breathing',
    charge: 'The flame stops being a weapon and becomes the weather.',
    light: {
      name: 'Sun-Scored Furlash',
      desc: 'A rising cut that leaves a burning edge in the air. He is already through it by the time the trail appears.',
    },
    heavy: {
      name: 'Tiger Hunt, Second Form',
      desc: 'A full-body shoulder-first charge behind a roaring flame, and the impact carries him past them.',
    },
    special: {
      name: 'Thirteenth Form: Tiger Devourer',
      desc: 'The complete form. A flame tiger larger than the arena crosses it, and everything in the path is inside the fire, not merely struck by it.',
    },
    style: 'flame', color: '#ff7a1a', color2: '#ffe08a',
  },
  madara: {
    name: 'Perfect Susanoo',
    charge: 'The armour closes. Nothing gets through it, including him.',
    light: {
      name: 'Armor Reversal',
      desc: 'A short, heavy-armed backhand out of the Susanoo fist. It does not travel far; it does not need to.',
    },
    heavy: {
      name: 'Skeletal Crush',
      desc: 'The spectral arm closes on the target and squeezes, then throws it back out along the same line.',
    },
    special: {
      name: 'Tengai Shinsei: Cataclysm',
      desc: 'The meteor comes down inside the Susanoo, and the shock ring it leaves behind is the armour falling outward.',
    },
    style: 'meteor', color: '#b067ff', color2: '#ff8a3a',
  },
  asta: {
    name: 'Demon Union',
    charge: 'The devil lends him everything it has, and he spends it on the space between them.',
    light: {
      name: 'Null Thread',
      desc: 'A cut that deletes whatever it crosses on the way. Projectiles simply stop existing mid-air.',
    },
    heavy: {
      name: 'Anti-Magic Rend',
      desc: 'The greatsword comes down through the target and keeps going. The knockback is downward: it puts them in the ground.',
    },
    special: {
      name: 'World-End Divider',
      desc: 'A single erased line drawn across the whole arena, and everything it touched is not there any more.',
    },
    style: 'void', color: '#e0203a', color2: '#ffffff',
  },
  goku: {
    name: 'Ultra Instinct',
    charge: 'The silver answers first and the body follows it.',
    light: {
      name: 'Silver Thread',
      desc: 'He is already striking before he decides to. Five frames, and the read is a foregone conclusion.',
    },
    heavy: {
      name: 'Perfect Autonomy',
      desc: 'The counter arrives in the same frame the attack does, and the launcher is an afterthought of it.',
    },
    special: {
      name: 'Divine Retaliation',
      desc: 'The blocked blow is taken, held, and answered with all of it at once.',
    },
    style: 'ki', color: '#7fdcff', color2: '#ffffff',
  },
  goku_ui: {
    name: 'Silver Autonomy',
    charge: 'Nothing is decided any more. Only executed.',
    light: {
      name: 'Pre-emptive Draw',
      desc: 'A blade that is already moving before the target has finished its own. Four frames, and he does not appear to have moved at all.',
    },
    heavy: {
      name: 'Untrained Counter',
      desc: 'He is somewhere else when the hit connects, and the displacement is what does the damage.',
    },
    special: {
      name: 'Absolute Autonomy',
      desc: 'The distance closes without a step being taken, and the point-blank release lands in the frame it starts.',
    },
    style: 'ki', color: '#e2e8f0', color2: '#93c5fd',
  },
  gokublack: {
    name: 'Super Saiyan Rosé',
    charge: 'The divinity answers on its own terms, and it is not on yours.',
    light: {
      name: 'Rosé Slicer',
      desc: 'A short divine cut, thrown without wind-up, in the colour of something that does not belong to this universe.',
    },
    heavy: {
      name: 'God Split Cleave',
      desc: 'The God Split blade crosses the target and continues past it, the second half of the cut landing after the first has already finished.',
    },
    special: {
      name: 'Scythe of Sorrow',
      desc: 'The Rosé Scythe manifests in full and opens a rift. Shorter than the old ritual, and it still tears the frame open.',
    },
    domain: 'The Rosé Scythe opens a dimensional rift across the arena, but the cut only runs one line deep.',
    style: 'ki', color: '#ec4899', color2: '#8b5cf6',
  },
  ichigo: {
    name: 'Bankai Manifestation',
    charge: 'The blade grows past the length of a weapon and into a reason.',
    light: {
      name: 'Bankai Furlash',
      desc: 'A short black-and-red cut drawn with the oversized blade, and it keeps travelling after the swing stops.',
    },
    heavy: {
      name: 'Getsuga: Rising Bankai',
      desc: 'An upward crescent that puts the target into the air and keeps the arc hanging there with them.',
    },
    special: {
      name: 'Final Getsuga: Eternal',
      desc: 'A wall of absolute black that crosses the arena and then crosses it again, from the far side, on its way out.',
    },
    domain: 'Eternal Getsuga floods the arena in darkness, but the second wave is thin enough to jump.',
    style: 'spirit', color: '#7a68ff', color2: '#ff315a',
  },
  naruto: {
    name: 'Kurama Avatar',
    charge: 'The fox does not share the body. It lends it.',
    light: {
      name: 'Chakra-Thread Claw',
      desc: 'A rake of four chakra claws in a single motion, each one landing a beat after the last.',
    },
    heavy: {
      name: 'Kurama Grab',
      desc: 'The tail closes around the target, holds for a moment, and slams it into the ground.',
    },
    special: {
      name: 'Convergence Barrage',
      desc: 'Clone-Rasengans arrive from both sides at once, and every one of them is a real impact.',
    },
    domain: 'Kurama lunges across the arena as a chakra avatar, one pass instead of a sustained mauling.',
    style: 'fox', color: '#ff9c2e', color2: '#8fd8ff',
  },
  tanjiro: {
    name: 'Hinokami Kagura',
    charge: 'The breathing form changes, and the water starts carrying fire.',
    light: {
      name: 'Sun-Drawn Furlash',
      desc: 'A quick rising cut drawn with a burning edge, and the arc it leaves is genuinely hot.',
    },
    heavy: {
      name: 'Sun Breathing: Seventh Form',
      desc: 'A full sprint behind a solar dragon, both of them arriving before the sound of the swing does.',
    },
    special: {
      name: 'Sun Breathing: Thirteenth Form',
      desc: 'A circular dragon cut that leaves the target, completes the circle behind them, and catches them again on the way back.',
    },
    domain: 'A blazing solar dragon crosses the stage crowned with light, but it only makes one pass.',
    style: 'water', color: '#ffad35', color2: '#8fe8ff',
  },
  sasuke: {
    name: 'Susanoo Armor',
    charge: 'The armour is up. The arrows are already nocked.',
    light: {
      name: 'Chidori Thread',
      desc: 'A single-line lightning draw, short enough to fit between two hits of a combo.',
    },
    heavy: {
      name: 'Susanoo Lunge',
      desc: 'The spectral armour drives forward and through, and the target leaves with it.',
    },
    special: {
      name: "Indra's Arrow",
      desc: 'A bow of lightning, drawn and loosed in one motion, and the shaft goes through the stage rather than around it.',
    },
    domain: 'A lightning arrow tears through the arena, but it is one arrow instead of a falling line.',
    style: 'shadow', color: '#8d55ff', color2: '#7fd8ff',
  },
  luffy: {
    name: 'Gear Fifth',
    charge: 'Everything is rubber, including the parts of him that were not.',
    light: {
      name: 'Drum Rush',
      desc: 'The arm stretches out and snaps back, twice, before the target has finished reacting to the first.',
    },
    heavy: {
      name: 'Jet Pistol',
      desc: 'He rockets forward as a stretched fist and the two of them pass through each other on the way.',
    },
    special: {
      name: 'Gear Fifth: Dragon',
      desc: 'A dragon-sized fist inflates and fires through the target and keeps inflating, and the shockwave is the hit.',
    },
    domain: 'A giant inflated fist crosses the arena, but it is thrown rather than sent all the way down the stage.',
    style: 'rubber', color: '#ff6a4a', color2: '#ffd0a8',
  },
  zoro: {
    name: 'Asura Awakening',
    charge: 'Three swords. Six hands. One cut.',
    light: {
      name: 'Asura Furlash',
      desc: 'A short triple cut, the third one drawn with a hand that is not in the same place as the other two.',
    },
    heavy: {
      name: 'One Hundred Eight Pound Asura',
      desc: 'A single overhand cut that lifts the target and holds it there, still deciding which way to fall.',
    },
    special: {
      name: 'Nine Swords: Conclusion',
      desc: 'Nine spectral blades converge on a single point and finish the sentence together.',
    },
    domain: 'Nine blades converge and carve, but the crossing is a single pass instead of a sustained sequence.',
    style: 'trio', color: '#8dffbe', color2: '#effff4',
  },
  saitama: {
    name: 'Serious Series',
    charge: 'He stops holding back. The air notices first.',
    light: {
      name: 'Normal Punch',
      desc: 'An ordinary punch thrown at serious speed. It is genuinely just a punch, and that is the entire joke.',
    },
    heavy: {
      name: 'Serious Side Blow',
      desc: 'An open-handed shove that carries the target the length of the stage, because he did not want to hit them properly yet.',
    },
    special: {
      name: 'Serious Series: Final',
      desc: 'One serious punch, and a clean pressure plane leaves with it across the whole arena.',
    },
    domain: 'The pressure plane still splits the clouds, but it is a plane and not a wall.',
    style: 'pressure', color: '#ffe58a', color2: '#ffffff',
  },
  gojo: {
    name: 'Infinity Unleashed',
    charge: 'The blindfold is off. Nothing is arriving without permission.',
    light: {
      name: 'Infinity Tap',
      desc: 'A flick of two fingers that stops being a flick somewhere near the target. It is not a hold; it is a redirect.',
    },
    heavy: {
      name: 'Cursed Reversal: Repel',
      desc: 'A point of inverted force that throws the target back along the exact line they arrived on.',
    },
    special: {
      name: 'Hollow Purple: Erasure',
      desc: 'Blue and Red collide in front of him and the collision is fired outward. Whatever is in the lane is not.',
    },
    domain: 'Hollow Purple fires and erases a lane through the arena, but for one sweep instead of a sustained beam.',
    style: 'singularity', color: '#5fd2ff', color2: '#ff5577',
  },
  yuji: {
    name: 'Manji Reversal',
    charge: 'He turns the curse around and hands it back with interest.',
    light: {
      name: 'Reversal Flick',
      desc: 'A short counter-flurry that returns part of what it absorbed. Three hits, all of them real.',
    },
    heavy: {
      name: 'Manji Reversal: Bash',
      desc: 'The absorbed energy is put back all at once, and it goes the opposite way.',
    },
    special: {
      name: 'Malevolent Shrine: Reversed',
      desc: 'Sukuna takes the body for a moment and opens a slimmer domain. It cuts for two seconds, not five, and it can be walked out of.',
    },
    domain: 'A Malevolent Shrine opens at reduced height, and the Dismantle storm it sheds is a third as long as it used to be.',
    style: 'curse', color: '#ff315a', color2: '#ffe1e8',
  },
  deku: {
    name: 'One For All: United',
    charge: 'Every power he was lent, answering at once, and for once agreeing on a direction.',
    light: {
      name: 'United Flick',
      desc: 'A green-lightning snap that arrives wrapped in a second and third impact. Fast, and it keeps going.',
    },
    heavy: {
      name: 'Delaware Smash: Mid-Air',
      desc: 'He redirects mid-flight and puts all of it into a single downward blow.',
    },
    special: {
      name: 'One For All: United Strike',
      desc: 'The inherited powers are fired as one screen-crossing shock instead of a series of them.',
    },
    domain: 'A screen-crossing green shock carries the target with it, but it lands once rather than rolling through.',
    style: 'hero', color: '#8dffb0', color2: '#ffffff',
  },
  todoroki: {
    name: 'Half-Cold Half-Hot',
    charge: 'He stops choosing a side. The ice and the fire stop arguing.',
    light: {
      name: 'Twin-Element Rake',
      desc: 'One half of the arm freezes and the other half ignites, and the swing is half of each.',
    },
    heavy: {
      name: 'Flashfreeze Fang',
      desc: 'Ice and flame are released in the same instant, and the target does not get to fall slowly.',
    },
    special: {
      name: 'Heaven-Piercing Ice: Final',
      desc: 'A glacier erupts across the stage with a hole burned clean through its core, and the hole is the safe part.',
    },
    domain: 'A mountain of ice erupts with flame burning through it, one ridge rather than a moving front.',
    style: 'twin', color: '#9fd8ff', color2: '#ff6a3a',
  },
  eren: {
    name: 'Titan Transformation',
    charge: 'The steam comes off his skin, and the hardening arrives before the steam does.',
    light: {
      name: 'Hardened Backhand',
      desc: 'A crystallised swing that shatters into shards on contact and keeps its knockback.',
    },
    heavy: {
      name: 'Titan Shoulder',
      desc: 'A hardened shoulder-first charge across the whole stage. Nothing about it is subtle.',
    },
    special: {
      name: 'The Rumbling: First Step',
      desc: 'A single colossal foot comes down on the target and holds. The Rumbling has begun, and the ground is the weapon.',
    },
    domain: 'A Titan foot descends onto the target once, and the ground it makes is what hurts.',
    style: 'titan', color: '#c69a62', color2: '#e8d7b8',
  },
  denji: {
    name: 'Devil Contract',
    charge: 'He borrows more than he should. The chainsaws are already running before the contract is finished.',
    light: {
      name: 'Contracted Rake',
      desc: 'A fast four-stroke grind with a blade on each arm, and it does not stop at the end of the first pass.',
    },
    heavy: {
      name: 'Devil-Lunge',
      desc: 'He closes the distance in a single bound and puts both blades through the target on the way past.',
    },
    special: {
      name: 'Chainsaw Devil: Full Pull',
      desc: 'Both chainsaws spool up into one spinning grinder that catches and holds before it finishes.',
    },
    domain: 'Both chainsaws grind through on a single pass, dragging the target a short way instead of the length of the stage.',
    style: 'saw', color: '#ff3a3a', color2: '#ffb52e',
  },
  sukuna: {
    name: 'King of Curses',
    charge: 'Everything he has been holding back is now simply out.',
    light: {
      name: 'Cleave Thread',
      desc: 'A cut so fine it looks like nothing until the target is already in two pieces. He re-cuts before they notice.',
    },
    heavy: {
      name: 'Open-Hand Dismantle',
      desc: 'A palm-forward cut that keeps cutting past the impact, and the target is still being cut when it stops.',
    },
    special: {
      name: 'Malevolent Shrine: Opened',
      desc: 'A second, slimmer Shrine layer opens behind him and the Dismantle storm is real, but it is two seconds of it and the edges are walkable.',
    },
    domain: 'A Malevolent Shrine opens at reduced scale, and the Dismantle storm lasts a fraction of the old five seconds.',
    style: 'curse', color: '#ff2347', color2: '#ffd4cb',
  },
  shadowdio: {
    name: 'The World Duplicated',
    charge: 'He has stopped needing to be in one place.',
    light: {
      name: 'Phantasm Tap',
      desc: 'A flick thrown by the phantasm while his body is somewhere else entirely. Two hits where there should be one.',
    },
    heavy: {
      name: 'Overlap Press',
      desc: 'Both Stands press into the same point at once, and the doubled impact is the hit.',
    },
    special: {
      name: 'The World: Overlap',
      desc: 'Both Stands collapse onto one point and the space around it folds. The release lands wherever the target is standing, which is no longer where it was.',
    },
    style: 'singularity', color: '#8affd0', color2: '#ffe45c',
  },
};

/** Fallback so an un-authored fighter still has a coherent awakening. */
export function awakeningFor(id: string, fallbackName: string, color: string, color2: string): AwakeningProfile {
  return AWAKENINGS[id] || {
    name: fallbackName,
    charge: 'Everything he had left, spent at once.',
    light: { name: `${fallbackName}: Flow`, desc: 'A fast, clean strike drawn with the transformation fully open.' },
    heavy: { name: `${fallbackName}: Impact`, desc: 'A committed launcher that puts the target where the next strike lands.' },
    special: { name: `${fallbackName}: Release`, desc: 'The widest and slowest option in the awakened kit, and the one that ends the exchange.' },
    style: 'ki', color, color2,
  };
}
