/**
 * AUTHORED AWAKENED KITS
 *
 * One entry per fighter. Every awakened move is named after (or built to feel
 * like) a real technique of that character, and is built from a *different*
 * mechanic in `awakenLib.ts` from the rest of that fighter's kit - so no two of
 * a fighter's awakened moves play alike, and each fighter's motif makes their
 * version of a shared mechanic look like their own power.
 *
 * The neutral awakened special (`nfu`) is each fighter's retained set-piece
 * (Spirit Bomb, Kurama Avatar, Mugetsu, the Rumbling...) and is left as the
 * technique builder installed it. Boss kits (Sukuna, Gojo) keep every key their
 * boss route defines; only the stances they leave generated are authored here.
 */
import type { MoveDef } from './types';
import type { MoveKey } from './characters';
import {
  beam, crescent, eruption, orb, vortex, groundWave, giant, volley, field, shock, blink, grab, barrage, dive, rush, counter, buff, clones, melee,
  registerKitVfx, spawn, motifBurst, type Theme, type Blow, type KitCtx, type Tier, type Stance,
} from './awakenLib';
import { sfx } from './audio';

const B = (dmg: number, ang: number, kb: number, sc: number, stun?: number): Blow => ({ dmg, ang, kb, sc, stun });
const T = (c1: string, c2: string, motif: Theme['motif'], c3?: string): Theme => ({ c1, c2, c3, motif });

type Key = 'nwl' | 'swl' | 'dwl' | 'awl' | 'nwh' | 'swh' | 'dwh' | 'awh' | 'nfu' | 'sfu' | 'dfu' | 'afu';
type Entry = [name: string, desc: string, part: Partial<MoveDef> & Record<string, any>];
interface Kit {
  th: Theme;
  /** The transformation, stamped over the fighter the frame it opens. */
  form: string;
  charge: string;
  moves: Partial<Record<Key, Entry>>;
}

// Shared alternates for fighters who wield more than one element.
const FIRE = T('#ff6a2a', '#ffd08a', 'flame');
const ICE = T('#9fd8ff', '#ffffff', 'ice');
const WOOD = T('#8a6a3a', '#c8a870', 'titan');
const CRYSTAL = T('#9fdcff', '#ffffff', 'ice');
const ROCK = T('#a39277', '#e0d4bf', 'titan');
const STEAM = T('#f0e8e0', '#ffffff', 'wind');
const BLOOD = T('#c0102a', '#ff6a7a', 'blood');
const RASEN = T('#8fd8ff', '#ffffff', 'chakra');
const SHURIKEN = T('#c9f4ff', '#ffffff', 'wind');
const BIJUU = T('#7a5bff', '#1a0f3a', 'void');
const KAIOKEN = T('#ff3030', '#ffd0d0', 'ki');
const HELL = T('#b86bff', '#2a0a3a', 'dark');
const RED = T('#ff3a5a', '#ffd0d8', 'infinity', '#ff3a5a');
const FUGA = T('#ff5a1f', '#ffd24a', 'flame');
const CERO = T('#ff2d4a', '#1a0a14', 'dark');
const AMATERASU = T('#7a2cff', '#0d0418', 'dark');
const GOLD = T('#ffe45c', '#fff6c0', 'stand');

/** Each fighter's own element: colours and motif. */
const TH: Record<string, Theme> = {
  levi: T('#d8f6ff', '#7de8c3', 'blade'),
  eren: T('#c69a62', '#e8d7b8', 'titan'),
  killua: T('#8fe6ff', '#ffffff', 'lightning'),
  rengoku: T('#ff7a1a', '#ffe08a', 'flame'),
  tanjiro: T('#ffad35', '#ffe08a', 'sun'),
  madara: T('#5b8cff', '#b9d0ff', 'chakra'),
  naruto: T('#ff9c2e', '#fff0a0', 'chakra'),
  sasuke: T('#b89dff', '#e6dcff', 'lightning'),
  luffy: T('#ffffff', '#ffe36a', 'rubber'),
  zoro: T('#8dffbe', '#effff4', 'blade'),
  saitama: T('#fff3c0', '#ffe58a', 'wind'),
  yuji: T('#ff315a', '#ffe1e8', 'curse'),
  sukuna: T('#ff2347', '#ffd4cb', 'curse'),
  gojo: T('#5fd2ff', '#ff5577', 'infinity', '#b067ff'),
  deku: T('#8dffb0', '#ffffff', 'hero'),
  todoroki: T('#9fd8ff', '#ffffff', 'ice'),
  denji: T('#ff3a3a', '#ffb52e', 'saw'),
  goku: T('#3ec8ff', '#ffffff', 'ki'),
  goku_ui: T('#e2e8f0', '#93c5fd', 'silver'),
  gokublack: T('#ec4899', '#8b5cf6', 'rose'),
  shadowdio: T('#8affd0', '#ffe45c', 'stand'),
  asta: T('#e0203a', '#ffffff', 'anti'),
  ichigo: T('#ff2d4a', '#241028', 'dark'),
};

/** The fighters, by id. `c(id)` is the context a builder needs. */
const KITS: Record<string, Kit> = {
  // ======================================================== ATTACK ON TITAN
  levi: {
    th: TH.levi, form: 'Ackerman Awakening', charge: 'The Ackerman blood wakes up. Every movement is already the cut.',
    moves: {
      nwl: ['Nape Cutter', 'Vanishes and reappears behind the target to take the nape in one draw.', blink(c('levi'), { n: 1, range: 260, fin: B(6, 50, 4.6, 3.4) })],
      swl: ['Wire Reel Cut', 'Reels himself across the gap on the ODM wire, blades first.', rush(c('levi'), { speed: 24, len: 8, blow: B(6.5, 34, 4.8, 4) })],
      dwl: ['Tendon Sweep', 'Two low, flat passes that take the legs out.', melee(c('levi'), { anim: 'lowslash', x: 54, y: -14, w: 124, h: 32, multi: 7, tick: 1.6, blow: B(5, 78, 4.6, 3) })],
      awl: ['Spiral Descent', 'Spins down out of the air like a drill and cuts a ring where he lands.', dive(c('levi'), { anim: 'spin', vx: 5, vy: 15, blow: B(5, -55, 4, 4), land: B(6, 72, 5.4, 5), r: 100 })],
      nwh: ['Anchor Hook', 'Fires an anchor into the nearest foe, reels them in on the wire, and throws them skyward.', grab(c('levi'), { range: 260, tether: true, n: 2, fin: B(10, 84, 8.4, 8.6) })],
      swh: ['Crosswind Rend', 'Two crossed crescents of wind thrown off both blades at once.', crescent(c('levi'), { x: true, size: 112, speed: 15, blow: B(9, 40, 7.6, 7.8) })],
      dwh: ['Blade Tornado', 'Becomes a standing whirlwind of steel that shreds and lifts.', field(c('levi'), { anim: 'spin', r: 84, last: 30, every: 5, tick: B(1.6, 85, 1.2, 0, 10), fin: B(8, 86, 8, 8.2) })],
      awh: ['Aerial Rotation', 'A spinning flurry of blades in midair.', barrage(c('levi'), { anim: 'spin', blades: true, len: 18, fin: B(8, 44, 7.4, 7.6) })],
      sfu: ['Thunder Spear Barrage', 'Four Thunder Spears fired at once, each one detonating where it strikes.', volley(c('levi'), { form: 'spear', n: 4, every: 4, speed: 16, aim: true, size: 30, blow: B(6, 40, 4.6, 4) })],
      dfu: ['Levi Squad Pincer', 'Two afterimages of the squad close from either side while he holds the centre.', clones(c('levi'), { n: 2, alpha: 0.7, seq: [{ at: 0, anim: 'slash', blow: B(4, 40, 1.6, 0.6, 12) }, { at: 10, anim: 'upslash', blow: B(7, 82, 7.4, 7.4) }] })],
      afu: ['Titan-Killer Drill', 'Plummets out of the sky in a spinning drill that craters the floor.', dive(c('levi'), { anim: 'spin', vx: 9, vy: 19, blow: B(7, -50, 5, 5), land: B(12, 74, 8.8, 8.8), r: 180 })],
    },
  },
  eren: {
    th: TH.eren, form: 'Attack Titan Shift', charge: 'Lightning strikes and the steam rolls off fifteen metres of muscle.',
    moves: {
      nwl: ['Hardened Jab', 'A crystal-hardened fist thrown straight.', melee(c('eren'), { anim: 'jab', x: 48, y: -48, w: 70, h: 48, blow: B(6, 36, 4.4, 3.4) })],
      swl: ['Titan Dropkick', 'Throws his whole weight forward feet first.', rush(c('eren'), { anim: 'kick', speed: 20, len: 9, blow: B(7, 34, 5, 4.4) })],
      dwl: ['Hardening Spikes', 'Crystal spikes punch up out of the floor ahead.', eruption(c('eren'), { mode: 'line', n: 2, spacing: 50, w: 40, h: 90, delay: 4, stagger: 3, blow: B(4.4, 80, 4, 3) }, CRYSTAL)],
      awl: ['Titan Stomp Drop', 'Drops out of the air and stamps a shockwave into the ground.', dive(c('eren'), { anim: 'stomp', vx: 3, vy: 17, land: B(7, 72, 6, 5.6) })],
      nwh: ['Titan Fist Eruption', 'A titan fist erupts from the ground beneath the target.', giant(c('eren'), { form: 'fist', path: 'rise', size: 46, travel: 10, fin: B(11, 88, 9, 9) })],
      swh: ['Scalding Steam Cloud', 'Vents a scalding cloud of steam from every pore.', field(c('eren'), { r: 100, last: 30, every: 6, tick: B(1.8, 60, 2, 0, 8), fin: B(8, 50, 7.8, 7.6) }, STEAM)],
      dwh: ['War Hammer Spike', 'The War Hammer\'s power: a colossal crystal spike under the target.', eruption(c('eren'), { mode: 'target', w: 70, h: 230, delay: 12, active: 10, blow: B(12, 86, 9, 9), big: true }, CRYSTAL)],
      awh: ['Titan Hammer Barrage', 'Hammer blows raining down from above.', barrage(c('eren'), { len: 18, fin: B(8, -40, 7, 7) })],
      sfu: ['Wall Breaker', 'The Attack Titan\'s foot, swung through everything ahead.', giant(c('eren'), { form: 'foot', size: 54, reach: 400, travel: 12, fin: B(12, 36, 9.4, 9.4) })],
      dfu: ['Coordinate Scream', 'The Founder\'s scream: a shockwave that flattens everything around him.', shock(c('eren'), { anim: 'castUp', r: 260, grow: 14, big: true, blow: B(11, 70, 8.8, 8.6) })],
      afu: ['Titan Hammer Fist', 'A giant fist driven down out of the sky onto the target.', giant(c('eren'), { form: 'fist', path: 'sky', size: 64, travel: 14, fin: B(13, -60, 9, 9) })],
    },
  },
  // ======================================================== HUNTER x HUNTER
  killua: {
    th: TH.killua, form: 'Godspeed', charge: 'His hair goes white, and his body stops waiting for his brain.',
    moves: {
      nwl: ['Whirlwind', 'Godspeed reflex: he is already beside them.', blink(c('killua'), { n: 1, range: 280, anim: 'punch', slash: false, fin: B(6, 45, 4.6, 3.4) })],
      swl: ['Thunderbolt Palm', 'A lunging palm that discharges on contact.', rush(c('killua'), { anim: 'palm', speed: 24, len: 8, blow: B(6.4, 34, 4.6, 3.6, 8) })],
      dwl: ['Current Sweep', 'A low sweep that leaves the floor crackling.', melee(c('killua'), { anim: 'sweep', x: 44, y: -12, w: 96, h: 30, multi: 6, tick: 1.5, blow: B(5, 78, 4.4, 2.8) })],
      awl: ['Narukami Drop', 'Falls out of the air as a bolt of lightning.', dive(c('killua'), { vx: 3, vy: 18, land: B(6, 72, 5.4, 5) })],
      nwh: ['Yo-Yo Snare', 'Snares the target with his steel yo-yos and yanks them into a charged uppercut.', grab(c('killua'), { range: 250, tether: true, n: 3, every: 5, fin: B(10, 84, 8.4, 8.4) })],
      swh: ['Speed of Lightning', 'Kanmuru: three strikes from three directions in the time it takes to blink.', blink(c('killua'), { n: 3, every: 5, range: 330, anim: 'punch', fin: B(9, 42, 8, 8.2) })],
      dwh: ['Thunder Cage', 'A cage of lightning closes around the target.', field(c('killua'), { at: 'target', r: 80, last: 30, every: 5, tick: B(1.5, 80, 0.8, 0, 12), fin: B(9, 84, 8.2, 8) })],
      awh: ['Assassin\'s Hands', 'Claws out, a blur of electrified rips in midair.', barrage(c('killua'), { blades: true, anim: 'flurry', len: 18, fin: B(8, 40, 7.4, 7.4) })],
      sfu: ['Chain Current', 'Discharges a straight line of lightning through everything ahead.', beam(c('killua'), { aim: 'aim', width: 30, len: 640, charge: 6, fire: 16 })],
      dfu: ['Narukami Storm', 'Calls five bolts down across the target\'s position, one after another.', eruption(c('killua'), { mode: 'rain', n: 5, spacing: 60, stagger: 5, w: 40, h: 300, delay: 8, blow: B(4, 80, 3, 1.6, 12), last: B(10, 84, 8.6, 8.6) })],
      afu: ['Yo-Yo Meteor', 'Hurls a charged steel yo-yo down at the target.', orb(c('killua'), { r: 18, speed: 12, vy: 9, anim: 'thrust', fin: B(10, -40, 8, 8) })],
    },
  },
  // ======================================================== DEMON SLAYER
  rengoku: {
    th: TH.rengoku, form: 'Set Your Heart Ablaze', charge: 'The Flame Hashira burns everything he has left.',
    moves: {
      nwl: ['Kindling Cut', 'A short, blazing draw-cut.', melee(c('rengoku'), { anim: 'slash', x: 56, y: -48, w: 100, h: 60, blow: B(6.5, 40, 4.6, 3.6) })],
      swl: ['Blazing Stride', 'Charges through the target behind a wall of flame.', rush(c('rengoku'), { speed: 22, len: 9, blow: B(7, 36, 5, 4.4) })],
      dwl: ['Ember Sweep', 'A low sweeping arc that leaves embers on the floor.', melee(c('rengoku'), { anim: 'lowslash', x: 58, y: -14, w: 120, h: 34, blow: B(6, 76, 4.6, 3.2) })],
      awl: ['Falling Sun', 'Drops out of the air sword-first and bursts into flame on landing.', dive(c('rengoku'), { anim: 'slam', vx: 4, vy: 16, land: B(7, 72, 6, 5.6) })],
      nwh: ['Rising Flame Pillar', 'A column of fire erupts beneath the target.', eruption(c('rengoku'), { mode: 'target', w: 70, h: 210, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true })],
      swh: ['Flame Tiger Charge', 'A roaring tiger of flame lunges from his blade.', giant(c('rengoku'), { form: 'dragon', size: 50, reach: 380, travel: 12, fin: B(11, 40, 8.8, 9) })],
      dwh: ['Heart Ablaze', 'Steels himself: faster and harder-hitting for a long while, with a burst of flame to start.', buff(c('rengoku'), { label: 'SET YOUR HEART ABLAZE', speed: 1.12, dmg: 1.18, last: 480, blow: B(7, 80, 7.6, 7) })],
      awh: ['Blazing Wheel', 'Spins in midair as a wheel of flame.', barrage(c('rengoku'), { anim: 'spin', blades: true, len: 18, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Blooming Flame Wave', 'A wave of fire rolls along the floor ahead.', groundWave(c('rengoku'), { w: 110, h: 110, speed: 10, fin: B(10, 80, 8.6, 8.6) })],
      dfu: ['Purgatory Circle', 'Stands in a ring of flame that burns everything inside it.', field(c('rengoku'), { r: 110, last: 42, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(9, 76, 8.4, 8.4) })],
      afu: ['Sky-Scorching Crescent', 'Throws a burning crescent down out of the air.', crescent(c('rengoku'), { size: 130, speed: 13, vy: 6, blow: B(11, -40, 8, 8) })],
    },
  },
  tanjiro: {
    th: TH.tanjiro, form: 'Hinokami Kagura', charge: 'The dance of the Fire God. His mark flares on his forehead.',
    moves: {
      nwl: ['Dance', 'The first dance of the Fire God: a single burning downward cut.', melee(c('tanjiro'), { anim: 'slash', x: 56, y: -50, w: 96, h: 66, blow: B(6.5, 40, 4.6, 3.6) })],
      swl: ['Sunflower Thrust', 'A straight, burning thrust that crosses the gap in a blink.', rush(c('tanjiro'), { speed: 26, len: 7, blow: B(6.5, 32, 4.8, 4) })],
      dwl: ['Burning Bones, Summer Sun', 'A huge, low sweeping arc of flame.', melee(c('tanjiro'), { anim: 'lowslash', x: 56, y: -16, w: 130, h: 40, blow: B(6, 76, 4.8, 3.4) })],
      awl: ['Fire Wheel', 'A vertical somersault slash of flame from above.', dive(c('tanjiro'), { anim: 'flip', vx: 5, vy: 14, land: B(6, 72, 5.4, 5) })],
      nwh: ['Raging Sun', 'Two fiery slashes in quick succession that lift the target.', melee(c('tanjiro'), { anim: 'upslash', x: 44, y: -60, w: 96, h: 100, multi: 8, tick: 2.4, blow: B(8, 86, 8.4, 8.4) })],
      swh: ['Clear Blue Sky', 'A spinning slash that hurls a ring of fire.', crescent(c('tanjiro'), { size: 120, speed: 14, blow: B(10, 40, 8, 8) })],
      dwh: ['Setting Sun Transformation', 'A turning slash that sends a sun-coloured wave rolling outwards.', shock(c('tanjiro'), { r: 160, flat: true, blow: B(9, 78, 8, 8) })],
      awh: ['Solar Heat Haze', 'His blade blurs in the heat shimmer: a strike from where he is not.', blink(c('tanjiro'), { n: 2, every: 6, range: 260, fin: B(9, 44, 8, 8) })],
      sfu: ['Fake Rainbow', 'Afterimages of him split off and strike from both sides.', clones(c('tanjiro'), { n: 2, alpha: 0.6, seq: [{ at: 0, anim: 'slash', blow: B(5, 40, 2, 0.6, 12) }, { at: 10, anim: 'upslash', blow: B(8, 84, 8, 8) }] })],
      dfu: ['Beneficent Radiance', 'The sun turns around him in a halo that burns anything close.', field(c('tanjiro'), { r: 104, last: 40, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(9, 80, 8.4, 8.4) })],
      afu: ['Flame Dance', 'Two burning arcs hurled down from above.', crescent(c('tanjiro'), { n: 2, gap: 6, size: 100, speed: 13, vy: 6, blow: B(7, -40, 6, 6) })],
    },
  },
  // ======================================================== NARUTO
  madara: {
    th: TH.madara, form: 'Eternal Mangekyō Sharingan', charge: 'Wake up to reality. The Susanoo rises around him.',
    moves: {
      nwl: ['Gunbai Gale', 'A flat, heavy swing of the war fan that blows a gale.', melee(c('madara'), { anim: 'slash', x: 54, y: -50, w: 92, h: 70, blow: B(6.5, 40, 5, 4) })],
      swl: ['Uchiha Flame Dash', 'Rushes forward wrapped in fire.', rush(c('madara'), { speed: 22, len: 9, blow: B(7, 36, 5, 4.4) }, FIRE)],
      dwl: ['Root Snare', 'Wood Release: roots burst out of the floor ahead.', eruption(c('madara'), { mode: 'line', n: 2, spacing: 50, w: 40, h: 80, delay: 4, stagger: 3, blow: B(4.4, 80, 4, 3) }, WOOD)],
      awl: ['Susanoo Talon', 'Drops with a Susanoo claw that rakes the ground.', dive(c('madara'), { vx: 4, vy: 16, land: B(7, 72, 6, 5.6) })],
      nwh: ['Susanoo Grasp', 'The Susanoo\'s hand closes around the target, lifts it, and crushes.', grab(c('madara'), { range: 160, lift: 70, n: 3, fin: B(11, 70, 8.6, 8.6) })],
      swh: ['Majestic Destroyer Flame', 'Katon: Gōka Mekkyaku - a wall of fire breathed across the whole lane.', beam(c('madara'), { width: 92, len: 560, charge: 10, fire: 20, tick: B(2.2, 45, 1.6, 0, 8), fin: B(10, 44, 8.6, 8.6) }, FIRE)],
      dwh: ['Wood Dragon', 'Mokuryū: a dragon of living wood bursts from the ground.', giant(c('madara'), { form: 'dragon', path: 'rise', size: 52, travel: 12, body: '#8a6a3a', fin: B(11, 86, 9, 9) }, WOOD)],
      awh: ['Limbo: Border Jail', 'Rinbo Hengoku - an invisible shadow strikes three times from nowhere.', blink(c('madara'), { n: 3, every: 5, range: 300, anim: 'palm', slash: false, fin: B(9, 42, 8, 8.2) })],
      sfu: ['Susanoo Sword Slash', 'The Perfect Susanoo draws its blade and cleaves the lane.', giant(c('madara'), { form: 'susanooblade', size: 64, reach: 400, travel: 12, fin: B(12, 40, 9.4, 9.4) })],
      dfu: ['Great Fire Destruction', 'A sea of flame rolls out in both directions.', groundWave(c('madara'), { both: true, w: 140, h: 120, speed: 9, fin: B(10, 80, 8.6, 8.6) }, FIRE)],
      afu: ['Rinnegan: Chibaku Seal', 'A black gravity core opens beside the target and drags everything in.', vortex(c('madara'), { at: 'target', r: 80, last: 40, fin: B(12, 80, 9, 9) }, BIJUU)],
    },
  },
  naruto: {
    th: TH.naruto, form: 'Kurama Link Mode', charge: 'Kurama\'s chakra wraps him in gold. Believe it.',
    moves: {
      nwl: ['Chakra Arm Swipe', 'A long golden chakra arm swipes well past his reach.', melee(c('naruto'), { anim: 'hook', x: 72, y: -48, w: 124, h: 50, blow: B(6, 38, 4.6, 3.4) })],
      swl: ['Uzumaki Dash', 'A shoulder-first dash wrapped in chakra.', rush(c('naruto'), { speed: 22, len: 9, blow: B(6.5, 34, 4.8, 4) })],
      dwl: ['Clone Sweep', 'A shadow clone slides in low and kicks the legs out.', clones(c('naruto'), { n: 1, speed: 14, runFor: 20, poof: 'POOF', seq: [{ at: 0, anim: 'sweep', blow: B(6, 76, 4.6, 3) }] })],
      awl: ['Rasengan Drop', 'Falls with a Rasengan held below him.', dive(c('naruto'), { vx: 3, vy: 16, land: B(7, 72, 6, 5.6) }, RASEN)],
      nwh: ['Chakra Arm Grab', 'A chakra arm reaches out, grabs, and slams.', grab(c('naruto'), { range: 230, tether: true, lift: 60, n: 2, fin: B(11, 84, 8.6, 8.6) })],
      swh: ['Big Ball Rasengan', 'A Rasengan the size of his torso, thrown straight ahead.', orb(c('naruto'), { r: 32, speed: 11, pierce: true, rehit: 6, blow: B(2.4, 60, 1.6, 0, 10), fin: B(11, 44, 8.8, 8.8) }, RASEN)],
      dwh: ['Tail Slam', 'One of Kurama\'s chakra tails crashes down on the target.', giant(c('naruto'), { form: 'tail', path: 'sky', size: 46, travel: 12, fin: B(11, -60, 9, 9) })],
      awh: ['Uzumaki Formation', 'Three shadow clones pile in from the air.', clones(c('naruto'), { n: 3, air: true, poof: 'POOF', seq: [{ at: 0, anim: 'punch', blow: B(3, 50, 1.6, 0.4, 12) }, { at: 8, anim: 'kick', blow: B(6, 70, 6.6, 6.4) }] })],
      sfu: ['Rasenshuriken', 'Wind Release: a spinning shuriken of wind that shreds on contact.', orb(c('naruto'), { r: 34, speed: 9, pierce: true, rehit: 4, life: 60, blow: B(2, 70, 1.2, 0, 10), fin: B(13, 60, 9.4, 9.4) }, SHURIKEN)],
      dfu: ['Tailed Beast Bomb', 'Kurama\'s Bijūdama, fired low across the ground.', orb(c('naruto'), { r: 46, speed: 8, fin: B(14, 50, 9.6, 9.6) }, BIJUU)],
      afu: ['Rasengan Barrage', 'Clones in the air hurl a rain of small Rasengan.', volley(c('naruto'), { form: 'bullet', n: 5, every: 3, speed: 13, down: true, spread: 0.3, blow: B(3.4, -40, 2.4, 1.2, 6) }, RASEN)],
    },
  },
  sasuke: {
    th: TH.sasuke, form: 'Rinnegan Susanoo', charge: 'The Rinnegan opens and purple armour closes over him.',
    moves: {
      nwl: ['Chidori Senbon', 'Three needles of lightning thrown in a fan.', volley(c('sasuke'), { form: 'bolt', n: 3, every: 2, speed: 17, spread: 0.12, blow: B(2.6, 36, 2, 0.6, 6) })],
      swl: ['Amenotejikara', 'Swaps places with the space behind the target and cuts.', blink(c('sasuke'), { n: 1, range: 360, fin: B(6, 44, 4.6, 3.4) })],
      dwl: ['Chidori Current', 'Lightning flows out of his body along the floor.', shock(c('sasuke'), { r: 96, flat: true, anim: 'slam', blow: B(5.6, 70, 4.4, 3) })],
      awl: ['Lightning Blade Drop', 'Falls blade-first wrapped in lightning.', dive(c('sasuke'), { vx: 4, vy: 17, land: B(6, 72, 5.4, 5) })],
      nwh: ['Chidori Eisō: Long Lance', 'The Chidori stretched into a lance that reaches across half the stage.', beam(c('sasuke'), { width: 22, len: 380, charge: 5, fire: 10, anim: 'thrust', tick: B(2.4, 60, 1.2, 0, 10), fin: B(9, 80, 8.2, 8.2) })],
      swh: ['Yasaka Magatama', 'The Susanoo hurls three purple magatama.', volley(c('sasuke'), { form: 'bullet', n: 3, every: 4, speed: 15, aim: true, size: 28, blow: B(4.4, 40, 3.6, 2.4, 8) })],
      dwh: ['Blaze Release: Kagutsuchi', 'Black flames of Amaterasu shaped into a spike under the target.', eruption(c('sasuke'), { mode: 'target', w: 60, h: 200, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true }, AMATERASU)],
      awh: ['Chidori Stream Barrage', 'Sword and lightning, too fast to follow.', barrage(c('sasuke'), { blades: true, len: 18, fin: B(8, 40, 7.4, 7.4) })],
      sfu: ['Susanoo: Flaming Arrow', 'Draws the Susanoo\'s bow and fires an arrow of black flame across the stage.', beam(c('sasuke'), { width: 40, len: 1000, charge: 12, fire: 10, big: true, tick: B(3, 40, 2, 0, 8), fin: B(13, 36, 9.4, 9.4) }, AMATERASU)],
      dfu: ['Chidori: Full Discharge', 'Every drop of chakra released as lightning around him.', field(c('sasuke'), { r: 110, last: 36, every: 5, tick: B(1.6, 70, 1, 0, 10), fin: B(10, 76, 8.6, 8.6) })],
      afu: ['Amaterasu Rain', 'Black flames fall across the ground beneath him.', eruption(c('sasuke'), { mode: 'rain', n: 5, spacing: 56, stagger: 4, w: 44, h: 130, delay: 8, blow: B(4, 80, 3, 1.2, 10), last: B(9, 84, 8.2, 8.2) }, AMATERASU)],
    },
  },
  // ======================================================== ONE PIECE
  luffy: {
    th: TH.luffy, form: 'Gear Fifth', charge: 'The drums of liberation. His hair turns white and the world turns to rubber.',
    moves: {
      nwl: ['Toon Pistol', 'A cartoonishly stretched punch that snaps back like a slingshot.', giant(c('luffy'), { form: 'fist', size: 24, reach: 260, travel: 7, wind: 2, su: 5, body: '#f0c8a0', fin: B(6, 36, 4.8, 4) })],
      swl: ['Dawn Rocket', 'Launches himself forward like a rubber rocket.', rush(c('luffy'), { speed: 26, len: 8, blow: B(7, 34, 5, 4.6) })],
      dwl: ['Mole Pistol', 'A punch sent through the ground that pops up under the target.', giant(c('luffy'), { form: 'fist', path: 'rise', size: 30, travel: 8, su: 6, body: '#f0c8a0', fin: B(6, 84, 5.6, 5) })],
      awl: ['Dawn Stamp', 'A giant, bouncing foot stamps down from above.', giant(c('luffy'), { form: 'foot', path: 'diag', size: 34, travel: 8, su: 5, body: '#f0c8a0', fin: B(7, -60, 6, 6) })],
      nwh: ['Gum-Gum Lightning', 'Grabs the target in his rubber hands and swings them like a toy.', grab(c('luffy'), { range: 200, tether: true, lift: 80, n: 3, fin: B(11, 60, 9, 9) })],
      swh: ['Dawn Whip', 'A leg stretched across half the stage and whipped through.', melee(c('luffy'), { anim: 'roundhouse', x: 120, y: -42, w: 210, h: 40, blow: B(10, 42, 8.4, 8.4) })],
      dwh: ['Gum-Gum Gigant', 'Inflates to giant size for one enormous stomp.', shock(c('luffy'), { r: 200, grow: 12, flat: true, big: true, blow: B(11, 80, 8.8, 8.6) })],
      awh: ['Hawk Gatling', 'A gatling of fists from midair.', barrage(c('luffy'), { len: 20, fin: B(8, 40, 7.4, 7.6) })],
      sfu: ['Bajrang Gun', 'A fist the size of an island, thrown straight through the lane.', giant(c('luffy'), { form: 'fist', size: 92, reach: 520, travel: 16, wind: 8, body: '#f0c8a0', fin: B(14, 36, 9.8, 9.8) })],
      dfu: ['Rubber World', 'Turns the ground around him to rubber and bounces everything on it.', field(c('luffy'), { r: 124, last: 40, every: 8, tick: B(1.6, 88, 3.6, 0, 8), fin: B(9, 86, 8.6, 8.6) })],
      afu: ['Thunder Bagua', 'Drives a giant fist straight down out of the sky.', giant(c('luffy'), { form: 'fist', path: 'sky', size: 60, travel: 12, body: '#f0c8a0', fin: B(13, -60, 9.2, 9.2) })],
    },
  },
  zoro: {
    th: TH.zoro, form: 'King of Hell', charge: 'Enma drinks his Haki. Nine blades where there should be three.',
    moves: {
      nwl: ['Shishi Sonson', 'One-Sword Style: a single iai draw that is through them before the sheath clicks.', blink(c('zoro'), { n: 1, range: 300, fin: B(6.5, 42, 4.8, 3.6) })],
      swl: ['Toro Nagashi', 'Flows past the target\'s guard and cuts on the way through.', rush(c('zoro'), { speed: 22, len: 8, blow: B(6.5, 36, 4.8, 4) })],
      dwl: ['Ushi Bari', 'A low, two-handed piercing thrust.', melee(c('zoro'), { anim: 'thrust', x: 64, y: -20, w: 120, h: 34, blow: B(6, 70, 4.6, 3.2) })],
      awl: ['Falling Asura Cut', 'All three swords brought down from above.', dive(c('zoro'), { anim: 'slam', vx: 4, vy: 16, land: B(7, 72, 6, 5.6) })],
      nwh: ['36 Pound Phoenix', 'A flying slash fired from the sword\'s tip.', crescent(c('zoro'), { size: 96, speed: 18, blow: B(10, 44, 8.4, 8.4) })],
      swh: ['108 Pound Phoenix', 'Three flying slashes, one per blade, in quick succession.', crescent(c('zoro'), { n: 3, gap: 3, size: 104, speed: 17, blow: B(4.4, 40, 4, 3) })],
      dwh: ['Black Rope Dragon Twister', 'A tornado of Haki-blackened slashes around him.', vortex(c('zoro'), { at: 'self', r: 84, last: 30, every: 5, fin: B(10, 84, 8.6, 8.6) }, HELL)],
      awh: ['Kiki Kyutoryu Flurry', 'Nine blades, three bodies, all at once.', barrage(c('zoro'), { blades: true, len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Sanzen Sekai', 'Three Thousand Worlds: a spinning dash-cut that goes clean through.', rush(c('zoro'), { anim: 'spin', speed: 28, len: 10, multi: true, blow: B(12, 38, 9, 9.2) })],
      dfu: ['Enma: Haki Surge', 'Enma pulls Haki out of him in a violet storm around his feet.', field(c('zoro'), { r: 110, last: 40, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(10, 80, 8.6, 8.6) }, HELL)],
      afu: ['Daibutsu Giri', 'Great Buddha Cut: a colossal blade brought down from the sky.', giant(c('zoro'), { form: 'blade', path: 'sky', size: 54, travel: 12, fin: B(13, -70, 9, 9) })],
    },
  },
  // ======================================================== ONE-PUNCH MAN
  saitama: {
    th: TH.saitama, form: 'Serious Mode', charge: 'For once, he is paying attention.',
    moves: {
      nwl: ['Serious Jab', 'A normal punch - seriously.', melee(c('saitama'), { anim: 'jab', x: 48, y: -48, w: 72, h: 46, blow: B(6.5, 36, 5.4, 4.4) })],
      swl: ['Serious Side Hops', 'Hops side to side so fast he leaves copies of himself.', rush(c('saitama'), { anim: 'thrust', speed: 22, len: 10, multi: true, blow: B(6, 36, 5, 4) })],
      dwl: ['Serious Sweep', 'A low kick that picks the legs up off the floor.', melee(c('saitama'), { anim: 'sweep', x: 44, y: -12, w: 96, h: 30, blow: B(6, 80, 5, 3.6) })],
      awl: ['Serious Dropkick', 'Drops like a meteor, feet first.', dive(c('saitama'), { anim: 'dkick', vx: 5, vy: 18, land: B(7, 72, 6, 5.6) })],
      nwh: ['Serious Headbutt', 'A headbutt with the weight of the whole planet behind it.', melee(c('saitama'), { anim: 'headbutt', x: 36, y: -58, w: 70, h: 60, blow: B(12, 84, 9, 9) })],
      swh: ['Air Pressure Punch', 'The wind off a punch, blasting straight down the lane.', beam(c('saitama'), { anim: 'jab', width: 80, len: 620, charge: 4, fire: 12, tick: B(2.4, 36, 3, 0, 6), fin: B(10, 34, 8.6, 8.6) })],
      dwh: ['Serious Table Flip', 'Flips the ground in front of him up like a table.', eruption(c('saitama'), { mode: 'line', n: 1, spacing: 90, w: 170, h: 170, delay: 4, active: 10, anim: 'uppercut', blow: B(11, 84, 9, 9), big: true }, ROCK)],
      awh: ['Serious Air Barrage', 'A wall of fists in midair.', barrage(c('saitama'), { len: 22, fin: B(8, 40, 7.6, 7.6), skin: '#d8302c' })],
      sfu: ['Serious Sneeze', 'A sneeze that blows a gale across the stage.', groundWave(c('saitama'), { anim: 'castUp', w: 180, h: 200, speed: 13, life: 40, rehit: 6, fin: B(11, 40, 9, 9) })],
      dfu: ['Serious Crater', 'Punches the ground. The ground loses.', shock(c('saitama'), { anim: 'slam', r: 260, grow: 12, flat: true, big: true, blow: B(12, 78, 9, 9) })],
      afu: ['Meteor-Breaking Punch', 'The punch that broke a meteor, thrown down at an angle from above.', giant(c('saitama'), { form: 'fist', path: 'diag', size: 80, travel: 12, body: '#d8302c', fin: B(14, -50, 9.6, 9.6) })],
    },
  },
  // ======================================================== JUJUTSU KAISEN
  yuji: {
    th: TH.yuji, form: 'In the Zone', charge: 'After a Black Flash, the cursed energy flows like breathing.',
    moves: {
      nwl: ['Divergent Fist', 'The fist lands, and a beat later the cursed energy lands again.', { ...melee(c('yuji'), { anim: 'jab', x: 48, y: -48, w: 70, h: 46, blow: B(4, 36, 1.2, 0.4, 12) }), hits: [
        { f: [5, 9], x: 48, y: -48, w: 70, h: 46, dmg: 4, ang: 36, kb: 1.2, sc: 0.4, stun: 12, fx: 'dark' },
        { f: [14, 16], x: 48, y: -48, w: 74, h: 50, dmg: 4.4, ang: 38, kb: 5, sc: 4, fx: 'dark', g: 1 },
      ], dur: 28 }],
      swl: ['Cursed Rush Knee', 'Crosses the gap knee-first.', rush(c('yuji'), { anim: 'knee', speed: 22, len: 8, blow: B(6.6, 40, 5, 4.2) })],
      dwl: ['Manji Sweep', 'A low spinning kick.', melee(c('yuji'), { anim: 'sweep', x: 44, y: -12, w: 100, h: 30, blow: B(6, 78, 4.8, 3.2) })],
      awl: ['Meteor Elbow', 'An elbow driven down out of the air.', dive(c('yuji'), { anim: 'elbow', vx: 4, vy: 17, land: B(6, 72, 5.4, 5) })],
      nwh: ['Black Flash Uppercut', 'Cursed energy lands within a millionth of a second of the blow. The space distorts black.', melee(c('yuji'), { anim: 'uppercut', x: 36, y: -64, w: 70, h: 90, blow: B(13, 86, 9.2, 9.2) })],
      swh: ['Slaughter Demon', 'Draws the cursed knife and cuts on the dash.', rush(c('yuji'), { speed: 24, len: 9, multi: true, blow: B(10, 40, 8.4, 8.4) })],
      dwh: ['Cursed Energy Burst', 'Releases everything in a single pulse.', shock(c('yuji'), { r: 140, blow: B(10, 74, 8.4, 8.2) })],
      awh: ['Ox Kick Barrage', 'Kicks from midair, one after another.', barrage(c('yuji'), { anim: 'spinKick', len: 18, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Black Flash Chain', 'Three Black Flashes in a row. The sparks go black each time.', blink(c('yuji'), { n: 3, every: 6, range: 300, anim: 'punch', slash: false, blow: B(4, 70, 1.2, 0, 12), fin: B(11, 44, 8.6, 8.6) })],
      dfu: ['Dismantle (Inherited)', 'The vessel\'s own Dismantle: two crossing invisible slashes.', crescent(c('yuji'), { x: true, size: 124, speed: 16, blow: B(12, 40, 8.8, 8.8) })],
      afu: ['Cursed Meteor Fist', 'A fist of pure cursed energy driven down at an angle.', giant(c('yuji'), { form: 'fist', path: 'diag', size: 56, travel: 12, fin: B(13, -50, 9, 9) })],
    },
  },
  sukuna: {
    th: TH.sukuna, form: 'King of Curses', charge: 'Know your place.',
    moves: {
      swl: ['Close Cleave', 'Steps in and cleaves at arm\'s length.', rush(c('sukuna'), { speed: 22, len: 8, blow: B(6.6, 38, 4.8, 4) })],
      dwl: ['Low Dismantle', 'An invisible cut skimming the floor.', crescent(c('sukuna'), { size: 64, speed: 17, oy: -18, blow: B(6, 76, 4.6, 3) })],
      awl: ['Heavenward Drop', 'Descends from above and cuts a ring into the ground.', dive(c('sukuna'), { vx: 3, vy: 17, land: B(6, 72, 5.4, 5) })],
      swh: ['Dismantle Web', 'Two crossing Dismantles thrown at once.', crescent(c('sukuna'), { x: true, size: 118, speed: 16, blow: B(10, 40, 8.4, 8.4) })],
      dwh: ['Furnace Pillar', 'Fuga\'s fire erupts under the target.', eruption(c('sukuna'), { mode: 'target', w: 66, h: 210, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true }, FUGA)],
      awh: ['Cleave Barrage', 'Cleaves from midair, too many to count.', barrage(c('sukuna'), { blades: true, len: 20, fin: B(8, 42, 7.4, 7.6) })],
    },
  },
  gojo: {
    th: TH.gojo, form: 'Infinity Unleashed', charge: 'Throughout heaven and earth, I alone am the honoured one.',
    moves: {
      swl: ['Infinity Step', 'Moves through the gap as though the distance were never there.', rush(c('gojo'), { anim: 'palm', speed: 24, len: 8, blow: B(6.4, 36, 4.8, 4) })],
      dwl: ['Blue: Ground Pull', 'A small Blue at the feet ahead drags everything in.', vortex(c('gojo'), { at: 'ahead', ahead: 90, oy: -24, r: 50, last: 16, every: 5, su: 5, fin: B(6, 80, 5.6, 5) })],
      awl: ['Red: Downward Burst', 'A burst of Red fired straight down.', shock(c('gojo'), { anim: 'castUp', r: 100, blow: B(6, -60, 5.6, 5) }, RED)],
      swh: ['Blue: Lapse Pull', 'Lapse Blue hooks the target and hauls them into his palm.', grab(c('gojo'), { range: 300, tether: true, n: 2, fin: B(11, 60, 8.8, 8.8) })],
      dwh: ['Reversal Red: Detonation', 'Red detonates beneath the target.', eruption(c('gojo'), { mode: 'target', w: 70, h: 180, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true }, RED)],
      awh: ['Six Eyes Barrage', 'Blows placed with perfect precision, faster than sight.', barrage(c('gojo'), { len: 18, fin: B(8, 42, 7.4, 7.6) })],
      dfu: ['Maximum Output: Blue', 'Blue at full output beside the target: everything nearby is crushed into one point.', vortex(c('gojo'), { at: 'target', r: 92, last: 42, pull: 1.1, fin: B(13, 80, 9.2, 9.2) })],
      afu: ['Red: Rain', 'Six small Reds fired down from above.', volley(c('gojo'), { form: 'bullet', n: 6, every: 3, down: true, spread: 0.35, speed: 14, blow: B(3.4, -50, 2.6, 1.6, 6) }, RED)],
    },
  },
  // ======================================================== MY HERO ACADEMIA
  deku: {
    th: TH.deku, form: 'Full Cowl: 100%', charge: 'Green lightning. Every cell at one hundred percent.',
    moves: {
      nwl: ['One For All Jab', 'A short, crackling jab.', melee(c('deku'), { anim: 'jab', x: 48, y: -48, w: 70, h: 46, blow: B(6, 36, 4.6, 3.6) })],
      swl: ['Flying St. Louis Smash', 'A flying roundhouse that crosses the gap.', rush(c('deku'), { anim: 'roundhouse', speed: 22, len: 9, blow: B(7, 38, 5, 4.4) })],
      dwl: ['Oklahoma Smash', 'Spins and throws a ring of air out around him.', shock(c('deku'), { anim: 'spin', r: 100, flat: true, blow: B(5.6, 70, 4.6, 3.2) })],
      awl: ['Delaware Smash: Air Force', 'A finger flick that fires a bullet of air down at an angle.', volley(c('deku'), { form: 'bullet', n: 1, down: true, speed: 16, size: 30, anim: 'palm', blow: B(7, -40, 5.6, 5) })],
      nwh: ['Blackwhip', 'Black tendrils lash out, snare the target and reel them in.', grab(c('deku'), { range: 300, tether: true, lift: 50, n: 2, fin: B(11, 80, 8.8, 8.8) })],
      swh: ['Delaware Detroit Smash', 'A flick and a punch together: a blast of air down the lane.', beam(c('deku'), { anim: 'jab', width: 64, len: 520, charge: 4, fire: 12, tick: B(2.4, 40, 2.4, 0, 8), fin: B(10, 38, 8.6, 8.6) })],
      dwh: ['Danger Sense', 'Feels the attack coming and answers it before it lands.', counter(c('deku'), { window: [2, 22], blow: B(13, 80, 9, 9) })],
      awh: ['Shoot Style Barrage', 'A blur of kicks from midair.', barrage(c('deku'), { anim: 'spinKick', len: 18, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['United States of Smash', 'All nine quirks behind one fist - the size of a building.', giant(c('deku'), { form: 'arm', size: 76, reach: 460, travel: 14, wind: 6, fin: B(14, 38, 9.8, 9.8) })],
      dfu: ['Fa Jin Pinball', 'Stored kinetic energy released: he ricochets through the target again and again.', blink(c('deku'), { n: 4, every: 5, range: 300, anim: 'kick', slash: false, blow: B(3, 70, 1.2, 0, 12), fin: B(11, 44, 8.6, 8.6) })],
      afu: ['Manchester Meteor', 'An axe kick from the sky that caves the ground in.', dive(c('deku'), { anim: 'axeKick', vx: 6, vy: 19, blow: B(8, -55, 6, 6), land: B(12, 74, 8.8, 8.8), r: 190 })],
    },
  },
  todoroki: {
    th: TH.todoroki, form: 'Half-Cold Half-Hot: Phosphor', charge: 'Both sides at once. The ice and the flame, finally together.',
    moves: {
      nwl: ['Flashfire Jab', 'A jab from the left side, in flames.', melee(c('todoroki'), { anim: 'jab', x: 48, y: -48, w: 70, h: 46, blow: B(6, 36, 4.6, 3.6) }, FIRE)],
      swl: ['Ice Slide', 'Skates forward on a strip of ice he lays as he goes.', rush(c('todoroki'), { speed: 22, len: 10, blow: B(6.4, 34, 4.8, 4) })],
      dwl: ['Frost Creep', 'A short ridge of ice runs along the floor.', groundWave(c('todoroki'), { w: 70, h: 50, speed: 12, life: 18, su: 5, blow: B(5, 78, 4.4, 3), fin: undefined })],
      awl: ['Heatwave Drop', 'Falls wrapped in heat and bursts on landing.', dive(c('todoroki'), { vx: 4, vy: 16, land: B(6, 72, 5.4, 5) }, FIRE)],
      nwh: ['Great Glacier Pillar', 'A pillar of ice spears up under the target.', eruption(c('todoroki'), { mode: 'target', w: 70, h: 220, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true })],
      swh: ['Prominence Burn', 'A torrent of flame poured down the lane.', beam(c('todoroki'), { width: 60, len: 560, charge: 8, fire: 16 }, FIRE)],
      dwh: ['Heatwave', 'Raises the heat around him until the air itself burns.', field(c('todoroki'), { r: 104, last: 34, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(9, 80, 8.4, 8.4) }, FIRE)],
      awh: ['Twin-Element Rake', 'Alternating slashes of ice and fire in midair.', barrage(c('todoroki'), { blades: true, len: 18, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Ice Spear Volley', 'Five spears of ice thrown in a spread.', volley(c('todoroki'), { form: 'ice', n: 5, every: 2, spread: 0.18, speed: 16, blow: B(3.4, 38, 3, 2, 6) })],
      dfu: ['Phosphor: Flame Pillars', 'Blue-white flame pillars march out ahead of him.', eruption(c('todoroki'), { mode: 'line', n: 3, spacing: 70, stagger: 5, w: 56, h: 180, delay: 8, blow: B(5, 82, 4.6, 3, 10), last: B(10, 84, 8.6, 8.6) }, FIRE)],
      afu: ['Frozen Meteor', 'A boulder of ice dropped out of the sky onto the target.', giant(c('todoroki'), { form: 'ball', path: 'sky', size: 50, travel: 14, body: '#dff6ff', fin: B(13, -60, 9, 9) })],
    },
  },
  // ======================================================== CHAINSAW MAN
  denji: {
    th: TH.denji, form: 'Chainsaw Man', charge: 'Pulls the cord. The Chainsaw Devil laughs through his teeth.',
    moves: {
      nwl: ['Rev Slash', 'A short, screaming cut from the arm saw.', melee(c('denji'), { anim: 'slash', x: 56, y: -48, w: 94, h: 56, multi: 4, tick: 1.6, blow: B(4.6, 40, 4.6, 3.4) })],
      swl: ['Chain Lunge', 'Throws himself forward saw-first.', rush(c('denji'), { speed: 22, len: 9, blow: B(6.6, 36, 4.8, 4) })],
      dwl: ['Low Rip', 'Drags the saw along the floor.', melee(c('denji'), { anim: 'lowslash', x: 56, y: -14, w: 116, h: 32, multi: 6, tick: 1.4, blow: B(5, 78, 4.6, 3) })],
      awl: ['Chainsaw Drop', 'Falls saw-first.', dive(c('denji'), { vx: 4, vy: 16, land: B(6, 72, 5.4, 5) })],
      nwh: ['Chain Whip', 'Whips the chain from his wrist around the target and hauls them into the saw.', grab(c('denji'), { range: 260, tether: true, n: 3, every: 5, fin: B(11, 82, 8.8, 8.8) })],
      swh: ['Saw Disc Toss', 'Rips a saw blade loose and throws it spinning down the lane.', giant(c('denji'), { form: 'saw', size: 38, reach: 420, travel: 16, rehit: 4, fin: B(10, 40, 8.4, 8.4) })],
      dwh: ['Blood Geyser', 'Revs until the ground under the target erupts in blood.', eruption(c('denji'), { mode: 'target', w: 62, h: 190, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true }, BLOOD)],
      awh: ['Shredder Spin', 'Spins in midair with every saw running.', barrage(c('denji'), { anim: 'spin', blades: true, len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Rip Through', 'Charges clean through the target, saw grinding the whole way.', rush(c('denji'), { speed: 20, len: 14, multi: true, blow: B(12, 38, 9, 9.2) })],
      dfu: ['Revving Frenzy', 'Every saw revs at once; nothing near him survives it.', field(c('denji'), { r: 100, last: 40, every: 5, tick: B(1.6, 70, 1, 0, 9), fin: B(10, 80, 8.6, 8.6) })],
      afu: ['Saw Meteor', 'A giant saw blade dropped out of the sky.', giant(c('denji'), { form: 'saw', path: 'sky', size: 58, travel: 14, fin: B(13, -60, 9, 9) })],
    },
  },
  // ======================================================== DRAGON BALL
  goku: {
    th: TH.goku, form: 'Super Saiyan Blue Kaioken', charge: 'Blue hair, red aura. His body is screaming, and he is smiling.',
    moves: {
      nwl: ['Kaioken Jab', 'A snapping jab trailing red ki.', melee(c('goku'), { anim: 'jab', x: 48, y: -48, w: 70, h: 46, blow: B(6, 36, 4.6, 3.6) }, KAIOKEN)],
      swl: ['Instant Transmission Strike', 'Two fingers to the forehead, and he is behind them.', blink(c('goku'), { n: 1, range: 380, anim: 'punch', slash: false, fin: B(6.4, 44, 4.8, 3.6) })],
      dwl: ['Blue Sweep', 'A low spinning kick.', melee(c('goku'), { anim: 'sweep', x: 44, y: -12, w: 100, h: 30, blow: B(6, 78, 4.8, 3.2) })],
      awl: ['Sledgehammer Drop', 'A double-axe-handle that drives him into the ground.', dive(c('goku'), { anim: 'slam', vx: 4, vy: 17, land: B(6, 72, 5.4, 5) })],
      nwh: ['Kaioken Times Twenty', 'Multiplies his power: faster and stronger for a long while, with a burst to start.', buff(c('goku'), { label: 'KAIOKEN x20!', speed: 1.18, dmg: 1.15, last: 420 }, KAIOKEN)],
      swh: ['Kaioken Rush', 'A dashing combo in a trail of red ki.', rush(c('goku'), { speed: 22, len: 12, multi: true, blow: B(10, 40, 8.4, 8.4) }, KAIOKEN)],
      dwh: ['Kiai Shockwave', 'A shout that becomes a shockwave.', shock(c('goku'), { anim: 'castUp', r: 150, blow: B(10, 74, 8.4, 8.2) })],
      awh: ['Meteor Combination', 'A flurry of fists and knees in midair.', barrage(c('goku'), { len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Kaioken Kamehameha', 'The Kamehameha, pushed by the Kaioken - blue at the core, red at the edges.', beam(c('goku'), { width: 70, len: 1000, charge: 12, fire: 22, big: true, tick: B(2.4, 40, 1.6, 0, 8), fin: B(12, 40, 9.2, 9.2) })],
      dfu: ['Energy Volley', 'A barrage of ki blasts thrown one after another.', volley(c('goku'), { form: 'bullet', n: 8, every: 2, spread: 0.16, speed: 15, blow: B(2.4, 38, 2, 0.8, 6) })],
      afu: ['Instant Kamehameha: Sky', 'A Kamehameha fired down at an angle from the air.', beam(c('goku'), { aim: 'diag', width: 56, len: 800, charge: 10, fire: 16, fin: B(11, -40, 8.8, 8.8) })],
    },
  },
  goku_ui: {
    th: TH.goku_ui, form: 'Mastered Ultra Instinct', charge: 'The body moves on its own.',
    moves: {
      nwl: ['Silver Slip Jab', 'Slips the guard and taps them at the same time.', melee(c('goku_ui'), { anim: 'jab', x: 48, y: -48, w: 70, h: 46, blow: B(6, 36, 4.6, 3.6) })],
      swl: ['Afterimage Dash', 'Leaves an afterimage in every frame of the dash.', rush(c('goku_ui'), { speed: 24, len: 10, multi: true, blow: B(6, 36, 4.8, 4) })],
      dwl: ['Silver Sweep', 'A sweep so smooth there is no windup.', melee(c('goku_ui'), { anim: 'sweep', x: 44, y: -12, w: 100, h: 30, blow: B(6, 78, 4.8, 3.2) })],
      awl: ['Silver Meteor', 'Drops out of the air, silver-white.', dive(c('goku_ui'), { vx: 4, vy: 17, land: B(6, 72, 5.4, 5) })],
      nwh: ['Silver Dragon Rise', 'A dragon of silver ki bursts up under the target.', giant(c('goku_ui'), { form: 'dragon', path: 'rise', size: 50, travel: 12, fin: B(11, 86, 9, 9) })],
      swh: ['Mastered Afterimage Strike', 'Three strikes from three directions; each one looked like a dodge.', blink(c('goku_ui'), { n: 3, every: 5, range: 330, anim: 'punch', slash: false, fin: B(9, 42, 8, 8.2) })],
      dwh: ['Instinct Counter', 'Lets the blow come, and is not there when it arrives.', counter(c('goku_ui'), { window: [2, 22], teleport: true, blow: B(13, 70, 9, 9) })],
      awh: ['Silver Barrage', 'Fists thrown without a single wasted motion.', barrage(c('goku_ui'), { len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Silver Kamehameha', 'A Kamehameha fired with perfect, effortless form.', beam(c('goku_ui'), { width: 60, len: 1000, charge: 10, fire: 20, big: true, tick: B(2.4, 40, 1.6, 0, 8), fin: B(12, 40, 9.2, 9.2) })],
      dfu: ['Silver Instinct Field', 'A sphere where every blow lands and none are thrown.', field(c('goku_ui'), { r: 110, last: 40, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(10, 80, 8.6, 8.6) })],
      afu: ['Silver Comet', 'Crashes down as a comet of silver ki.', giant(c('goku_ui'), { form: 'fist', path: 'diag', size: 60, travel: 12, body: '#e2e8f0', fin: B(13, -50, 9.2, 9.2) })],
    },
  },
  gokublack: {
    th: TH.gokublack, form: 'Super Saiyan Rosé', charge: 'The beauty of a god, and nothing mortal left in it.',
    moves: {
      nwl: ['Ki Blade Flick', 'A quick flick of the ki blade.', melee(c('gokublack'), { anim: 'thrust', x: 56, y: -48, w: 96, h: 40, blow: B(6, 36, 4.6, 3.6) })],
      swl: ['Instant Transmission Cut', 'Appears at their side mid-cut.', blink(c('gokublack'), { n: 1, range: 360, fin: B(6.4, 44, 4.8, 3.6) })],
      dwl: ['Rosé Sweep', 'A low arc of the ki blade.', melee(c('gokublack'), { anim: 'lowslash', x: 56, y: -14, w: 116, h: 32, blow: B(6, 78, 4.6, 3.2) })],
      awl: ['Divine Descent', 'Descends with the blade pointed down.', dive(c('gokublack'), { vx: 4, vy: 16, land: B(6, 72, 5.4, 5) })],
      nwh: ['Holy Wrath', 'A pillar of divine light erupts beneath the target.', eruption(c('gokublack'), { mode: 'target', w: 64, h: 220, delay: 10, blow: B(11, 86, 8.8, 8.8), big: true })],
      swh: ['God Slicer Crescent', 'A crescent of pink ki thrown off the blade.', crescent(c('gokublack'), { size: 120, speed: 15, blow: B(10, 40, 8.4, 8.4) })],
      dwh: ['Divine Bind', 'Snares the target in pink ki and drags them onto the blade.', grab(c('gokublack'), { range: 260, tether: true, n: 2, fin: B(11, 80, 8.8, 8.8) })],
      awh: ['Rosé Blade Barrage', 'A blur of pink cuts in midair.', barrage(c('gokublack'), { blades: true, len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Holy Light Barrage', 'Eight bolts of divine light fired down the lane.', volley(c('gokublack'), { form: 'bullet', n: 8, every: 2, spread: 0.18, speed: 16, blow: B(2.4, 38, 2, 0.8, 6) })],
      dfu: ['Divine Halo', 'A halo of rosé light that burns anything inside it.', field(c('gokublack'), { r: 110, last: 40, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(10, 80, 8.6, 8.6) })],
      afu: ['Rosé Blade Rain', 'Blades of pink ki rain down from above.', volley(c('gokublack'), { form: 'bolt', n: 7, every: 2, down: true, spread: 0.4, speed: 15, blow: B(2.6, -50, 2, 1, 6) })],
    },
  },
  // ======================================================== JOJO
  shadowdio: {
    th: TH.shadowdio, form: 'The World: Overheaven Stance', charge: 'WRYYYYY. The World stands behind him, and time is his.',
    moves: {
      nwl: ['Vaporizing Freeze', 'A touch that freezes the moisture in the target\'s body.', melee(c('shadowdio'), { anim: 'palm', x: 46, y: -48, w: 70, h: 48, blow: B(6, 36, 4.6, 3.6) }, ICE)],
      swl: ['Za Warudo Step', 'A half-second of stopped time, and he is behind them.', blink(c('shadowdio'), { n: 1, range: 380, anim: 'kick', slash: false, fin: B(6.4, 44, 4.8, 3.6) })],
      dwl: ['Stand Sweep', 'The World sweeps the legs.', melee(c('shadowdio'), { anim: 'sweep', x: 50, y: -12, w: 110, h: 32, blow: B(6, 78, 4.8, 3.2) })],
      awl: ['WRYYY Dive', 'Dives out of the air with a scream.', dive(c('shadowdio'), { vx: 4, vy: 17, land: B(6, 72, 5.4, 5) })],
      nwh: ['Space Ripper Stingy Eyes', 'Pressurised fluid fired from his eyes as twin cutting beams.', beam(c('shadowdio'), { anim: 'cast', width: 16, len: 620, charge: 6, fire: 10, oy: -66, ox: 20, tick: B(2.4, 60, 1, 0, 10), fin: B(9, 80, 8.2, 8.2) }, T('#e8fbff', '#ffffff', 'water'))],
      swh: ['The World: Throat Grab', 'The Stand seizes the target by the throat and throws them.', grab(c('shadowdio'), { range: 150, lift: 60, n: 3, fin: B(11, 44, 8.8, 8.8) }, GOLD)],
      dwh: ['Stand Uppercut', 'The World\'s fist erupts from under the target.', giant(c('shadowdio'), { form: 'fist', path: 'rise', size: 44, travel: 10, body: '#ffe45c', fin: B(11, 88, 9, 9) }, GOLD)],
      awh: ['MUDA MUDA MUDA', 'The World\'s barrage from midair.', barrage(c('shadowdio'), { len: 22, fin: B(8, 42, 7.4, 7.6), skin: '#ffe45c' }, GOLD)],
      sfu: ['Knife Wall', 'Knives thrown in stopped time hang in a wall, then all move at once.', volley(c('shadowdio'), { form: 'knife', n: 9, every: 1, spread: 0.32, speed: 17, blow: B(2, 36, 1.6, 0.6, 6) })],
      dfu: ['ROAD ROLLER DA!', 'A road roller, dropped out of the sky onto the target.', giant(c('shadowdio'), { form: 'roller', path: 'sky', size: 70, travel: 16, fin: B(14, -60, 9.4, 9.4) }, GOLD)],
      afu: ['Space Ripper Rain', 'Eye beams fired down from the air in a sweeping spray.', volley(c('shadowdio'), { form: 'bolt', n: 6, every: 2, down: true, spread: 0.3, speed: 18, blow: B(3, -50, 2.4, 1.2, 6) }, T('#e8fbff', '#ffffff', 'water'))],
    },
  },
  asta: {
    th: TH.asta, form: 'Black Asta: Devil Union', charge: 'Liebe\'s power fills him. One black wing, one horn, zero magic.',
    moves: {
      nwl: ['Anti-Magic Stab', 'A straight thrust of the Demon-Dweller Sword.', melee(c('asta'), { anim: 'thrust', x: 62, y: -48, w: 110, h: 40, blow: B(6.4, 36, 4.8, 3.6) })],
      swl: ['Black Divider Lunge', 'Lunges through the target with the black blade.', rush(c('asta'), { speed: 22, len: 9, blow: B(6.6, 36, 4.8, 4) })],
      dwl: ['Demon-Destroyer Sweep', 'A low cleave of the Demon-Destroyer Sword.', melee(c('asta'), { anim: 'lowslash', x: 58, y: -14, w: 124, h: 34, blow: B(6.4, 78, 4.8, 3.2) })],
      awl: ['Black Meteorite', 'Crashes down out of the air sword-first.', dive(c('asta'), { anim: 'slam', vx: 4, vy: 17, land: B(7, 72, 6, 5.6) })],
      nwh: ['Anti-Magic Uproar', 'Anti-magic bursts out of his body and rips through everything near him.', shock(c('asta'), { r: 130, blow: B(10, 74, 8.4, 8.2) })],
      swh: ['Zetten', 'The Black Asta finishing slash: two cuts from two sides.', blink(c('asta'), { n: 2, every: 6, range: 320, fin: B(10, 42, 8.4, 8.4) })],
      dwh: ['Anti-Magic Spires', 'Black spires of anti-magic tear out of the ground in a line.', eruption(c('asta'), { mode: 'line', n: 3, spacing: 64, stagger: 4, w: 50, h: 160, delay: 6, blow: B(5, 82, 4.6, 3, 10), last: B(10, 84, 8.6, 8.6) })],
      awh: ['Black Asta Flurry', 'A storm of black slashes in midair.', barrage(c('asta'), { blades: true, len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Black Slash Wave', 'Swings with everything and a wall of black anti-magic flies down the lane.', crescent(c('asta'), { size: 150, speed: 16, life: 42, blow: B(12, 40, 9, 9) })],
      dfu: ['Null Field', 'Anti-magic pours off him in a sphere that cancels and cuts.', field(c('asta'), { r: 110, last: 40, every: 6, tick: B(1.8, 70, 1.2, 0, 9), fin: B(10, 80, 8.6, 8.6) })],
      afu: ['Demon-Slayer Descent', 'A giant black blade driven down out of the sky.', giant(c('asta'), { form: 'blade', path: 'sky', size: 60, travel: 12, fin: B(13, -70, 9, 9) })],
    },
  },
  // ======================================================== BLEACH
  ichigo: {
    th: TH.ichigo, form: 'Bankai: Tensa Zangetsu', charge: 'Ban-kai. The Hollow mask forms over his face.',
    moves: {
      nwl: ['Hollow Slash', 'A single savage cut of Tensa Zangetsu.', melee(c('ichigo'), { anim: 'slash', x: 56, y: -48, w: 96, h: 58, blow: B(6.4, 40, 4.6, 3.6) })],
      swl: ['Shunpo', 'Flash Step: a cut from beside them.', blink(c('ichigo'), { n: 1, range: 330, fin: B(6.4, 44, 4.8, 3.6) })],
      dwl: ['Low Getsuga', 'A small black Getsuga skimming the floor.', crescent(c('ichigo'), { size: 62, speed: 17, oy: -18, anim: 'lowslash', blow: B(6, 76, 4.6, 3) })],
      awl: ['Falling Moon', 'Drops sword-first with a black burst.', dive(c('ichigo'), { anim: 'slam', vx: 4, vy: 17, land: B(6, 72, 5.4, 5) })],
      nwh: ['Cero', 'The Hollow opens its mouth: a red-and-black blast down the lane.', beam(c('ichigo'), { width: 50, len: 700, charge: 10, fire: 14 }, CERO)],
      swh: ['Getsuga Jūjishō', 'A cross-shaped Getsuga Tenshō.', crescent(c('ichigo'), { x: true, size: 130, speed: 15, blow: B(10, 40, 8.4, 8.4) })],
      dwh: ['Reiatsu Eruption', 'His spiritual pressure explodes up out of the ground.', eruption(c('ichigo'), { mode: 'self', n: 1, w: 90, h: 210, delay: 6, active: 12, anim: 'castUp', blow: B(11, 86, 9, 9), big: true })],
      awh: ['Hollow Frenzy', 'The Hollow takes over for a moment: slashes from every angle.', barrage(c('ichigo'), { blades: true, len: 20, fin: B(8, 42, 7.4, 7.6) })],
      sfu: ['Getsuga Tenshō: Tensa', 'A black Getsuga the size of a building.', crescent(c('ichigo'), { size: 180, speed: 18, life: 48, blow: B(13, 40, 9.2, 9.2) })],
      dfu: ['Hollow Grip', 'Grabs the target and fires a point-blank Cero into them.', grab(c('ichigo'), { range: 150, n: 3, fin: B(12, 40, 9.2, 9.2) }, CERO)],
      afu: ['Shunpo Onslaught', 'Four Flash Step cuts from four angles.', blink(c('ichigo'), { n: 4, every: 5, range: 320, fin: B(10, 44, 8.6, 8.6) })],
    },
  },
};

/** Context for a fighter's own motif, or an alternate element they also wield. */
function c(id: string, alt?: Theme): KitCtx { return { id, th: alt || TH[id] || T('#ffffff', '#ffffff', 'ki') }; }


// ===========================================================================
// INSTALL
// ===========================================================================

const LABEL: Record<Tier, string> = {
  awaken: 'AWAKEN · R AT FULL GAUGE', awakenLight: 'AWAKENED LIGHT · J', awakenHeavy: 'AWAKENED HEAVY · K', awakened: 'AWAKENED SPECIAL · L',
};
const TIER_OF: Record<string, Tier> = { wl: 'awakenLight', wh: 'awakenHeavy', fu: 'awakened', aw: 'awaken' };
const STANCE_OF: Record<string, Stance> = { n: 'neutral', s: 'side', d: 'down', a: 'air' };

function wrap(id: string, key: string, name: string, desc: string, part: Record<string, any>, kit: Kit): MoveDef {
  const tier = TIER_OF[key.slice(1)], stance = STANCE_OF[key[0]];
  const su = part.startup ?? 8, dur = Math.max(part.dur ?? 40, su + 2);
  return {
    hits: [], vfx: `awk:${id}`, ...part,
    name, desc, startup: su, dur,
    ability: tier, stance, techniqueProfile: id, techniqueStyle: 'ki', variantOf: kit.form, chainLabel: LABEL[tier],
    cd: tier === 'awakened' ? 260 : tier === 'awakenHeavy' ? 90 : part.cd,
    land: stance === 'air' ? true : part.land,
    chains: tier === 'awakenHeavy' ? { special: `${key[0]}fu`, window: [Math.max(4, su - 1), Math.min(dur - 2, 30)] } : part.chains,
  } as MoveDef;
}

function transformation(id: string, stance: Stance, kit: Kit): MoveDef {
  const th = kit.th;
  const suffix = stance === 'neutral' ? '' : stance === 'side' ? ' · Surge' : stance === 'down' ? ' · Ground Zero' : ' · Ascension';
  return {
    name: `${kit.form}${suffix}`, desc: kit.charge,
    anim: 'castUp', dur: 34, startup: 12, invuln: [0, 14], grav: stance === 'air' ? 0.2 : 0.6,
    hits: [{ f: [12, 18], x: 0, y: -44, w: 190, h: 160, dmg: 7, ang: 70, kb: 6.2, sc: 5.4, fx: 'blunt' }],
    vel: stance === 'side' ? [[12, 11, null], [22, 2, null]] : undefined,
    ability: 'awaken', stance, techniqueProfile: id, techniqueStyle: 'ki', variantOf: kit.form, chainLabel: LABEL.awaken, vfx: `awk:${id}`,
    onFrame: (f: any, fr: number, g: any) => {
      if (fr === 1) { f.auraT = Math.max(f.auraT, 60); g.flashScreen('#000000', 0.2); sfx('confirm'); if (f.grounded || stance === 'air') g.cinematic(f, kit.form.toUpperCase(), 52); }
      if (fr < 12 && fr % 2 === 0) { const a = Math.random() * 6.28; g.fx.add({ x: f.x + Math.cos(a) * 80, y: f.y - 44 + Math.sin(a) * 70, vx: -Math.cos(a) * 6, vy: -Math.sin(a) * 5, color: Math.random() < 0.5 ? th.c1 : th.c2, kind: 'glow', life: 14, size: 5 }); }
      if (fr === 12) {
        g.fx.text(f.x, f.y - 170, kit.form.toUpperCase(), '#ffffff', 26, 56);
        spawn(g, f, 'awk_ring', { x: f.x, y: f.y - (stance === 'down' ? 10 : 44), life: 24, data: { th, r: 200, grow: 12, flat: stance === 'down', big: true, blow: { dmg: 0, ang: 0, kb: 0, sc: 0 } } });
        motifBurst(g, f.x, f.y - 44, 80, th);
        g.shake(18); g.flashScreen(th.c1, 0.22); g.punchIn(f.x, f.y - 44, 0.08); sfx('ult');
      }
    },
  } as MoveDef;
}

/**
 * Replaces each listed fighter's generated awakened moves with their authored
 * kit, keeps the retained set-piece on `nfu` under its own name, and rewrites
 * the move-list text that pointed at the old names.
 */
export function installAwakenedKits(chars: { id: string; moves: Record<string, MoveDef>; domain?: MoveDef; abilities: any[]; moveBranches: any[] }[]) {
  for (const ch of chars) {
    const kit = KITS[ch.id]; if (!kit) continue;
    registerKitVfx(ch.id, kit.th);
    const m = ch.moves as Record<string, MoveDef>;
    const aw = { naw: 'neutral', saw: 'side', daw: 'down', aaw: 'air' } as const;
    for (const [k, st] of Object.entries(aw)) m[k] = transformation(ch.id, st, kit);
    for (const [key, entry] of Object.entries(kit.moves) as [Key, Entry][]) {
      const [name, desc, part] = entry;
      m[key] = wrap(ch.id, key, name, desc, part, kit);
    }
    // The retained set-piece keeps its own, famous name.
    if (m.nfu && ch.domain?.name && !kit.moves.nfu) m.nfu = { ...m.nfu, name: ch.domain.name, desc: ch.domain.desc || m.nfu.desc };
    const awk = (k: string) => m[k]?.name || k;
    ch.moveBranches = ch.moveBranches.filter((b: any) => !String(b.input).startsWith('AWAKENED') && !String(b.input).startsWith('R @'));
    ch.moveBranches.push(
      { input: 'R @ full gauge', name: kit.form, desc: `${kit.charge} Direction picks how the transformation opens.` },
      { input: 'AWAKENED · J', name: awk('nwl'), desc: `Neutral ${awk('nwl')} · Side ${awk('swl')} · Down ${awk('dwl')} · Air ${awk('awl')}.` },
      { input: 'AWAKENED · K', name: awk('nwh'), desc: `Neutral ${awk('nwh')} · Side ${awk('swh')} · Down ${awk('dwh')} · Air ${awk('awh')}. Each chains into the matching special.` },
      { input: 'AWAKENED · L', name: awk('nfu'), desc: `Neutral ${awk('nfu')} · Side ${awk('sfu')} · Down ${awk('dfu')} · Air ${awk('afu')}.` },
    );
  }
}

export const KIT_IDS = Object.keys(KITS);
void ({} as MoveKey);
