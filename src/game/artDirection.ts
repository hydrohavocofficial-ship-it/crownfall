/**
 * ART DIRECTION
 *
 * One place that decides how every fighter *looks* and *moves*, kept out of the
 * move tables so balance and art can evolve independently.
 *
 * Two levers per character:
 *  - `ART`  — body archetype, proportions, idle rhythm, run cadence, eye shape
 *             and trim colour. This is what stops the roster reading as one
 *             generic model in twenty palettes.
 *  - `ANIMS` — remaps a move's existing animation to a different silhouette.
 *             Because animation is purely cosmetic (hit registration is driven by
 *             `startup` and `hits`), a boxer can reuse a shared move and still
 *             punch instead of swing a sword, with no gameplay change at all.
 *
 * Sukuna is deliberately absent: he keeps his own art exactly as authored.
 */
import type { CharDef } from './characters';
import type { AnimName } from './types';
import type { Look } from './render';

type Art = Partial<Omit<Look, 'skin' | 'hair' | 'hairStyle' | 'top' | 'top2' | 'sleeve' | 'fore' | 'pants' | 'boots' | 'eye' | 'weapon' | 'energy' | 'energy2'>>;

const B = (shoulder: number, chest: number, limb: number, head: number, torso: number) =>
  ({ shoulder, chest, limb, head, torso, hip: 1 });

export const ART: Record<string, Art> = {
  // --- Attack on Titan -----------------------------------------------------
  levi: {
    pose: 'speedster', build: B(0.9, 0.88, 1.0, 1.0, 0.95), idle: 'bounce', run: 'ninja', eyeStyle: 'narrow',
    accent: '#c8d4dc',
  },
  eren: {
    pose: 'bruiser', build: B(1.28, 1.22, 1.06, 1.0, 1.06), idle: 'coiled', run: 'dash', eyeStyle: 'sharp',
    accent: '#d5b46f',
  },

  // --- Hunter x Hunter -----------------------------------------------------
  killua: {
    pose: 'acrobat', build: B(0.9, 0.88, 1.08, 1.02, 0.98), idle: 'bounce', run: 'dash', eyeStyle: 'round',
    accent: '#a08fe0',
  },

  // --- Demon Slayer -------------------------------------------------------
  rengoku: {
    pose: 'swordsman', build: B(1.2, 1.14, 1.05, 1.0, 1.05), idle: 'lean', run: 'pumped', eyeStyle: 'sharp',
    accent: '#ffb347',
  },
  tanjiro: {
    pose: 'swordsman', build: B(0.98, 0.95, 1.04, 1.03, 1.0), idle: 'breathe', run: 'pumped', eyeStyle: 'round',
    accent: '#4d9d72',
  },

  // --- Naruto / Shippuden --------------------------------------------------
  naruto: {
    pose: 'ninja', build: B(0.94, 0.92, 1.0, 1.0, 0.98), idle: 'bounce', run: 'ninja', eyeStyle: 'round',
    accent: '#ff9c2e',
  },
  sasuke: {
    pose: 'ninja', build: B(0.96, 0.94, 1.06, 1.0, 1.0), idle: 'still', run: 'ninja', eyeStyle: 'narrow',
    accent: '#8d55ff',
  },
  madara: {
    pose: 'heavyweight', build: B(1.3, 1.2, 1.04, 1.0, 1.08), idle: 'lean', run: 'waddle', eyeStyle: 'glowing',
    accent: '#b067ff',
  },

  // --- Dragon Ball ---------------------------------------------------------
  goku: {
    pose: 'brawler', build: B(1.14, 1.12, 1.05, 1.0, 1.04), idle: 'breathe', run: 'pumped', eyeStyle: 'round',
    accent: '#ffd24a',
  },

  // --- Bleach --------------------------------------------------------------
  ichigo: {
    pose: 'acrobat', build: B(1.04, 1.0, 1.08, 1.0, 1.04), idle: 'lean', run: 'dash', eyeStyle: 'sharp',
    accent: '#7a68ff',
  },

  // --- Black Clover --------------------------------------------------------
  asta: {
    pose: 'bruiser', build: B(1.22, 1.26, 1.1, 0.98, 1.06), idle: 'coiled', run: 'pumped', eyeStyle: 'sharp',
    accent: '#e0203a',
  },
  deku: {
    pose: 'brawler', build: B(1.08, 1.04, 1.06, 1.02, 1.08), idle: 'bounce', run: 'pumped', eyeStyle: 'round',
    accent: '#8dffb0',
  },

  // --- My Hero Academia ----------------------------------------------------
  todoroki: {
    pose: 'brawler', build: B(1.16, 1.12, 1.08, 1.0, 1.08), idle: 'lean', run: 'dash', eyeStyle: 'narrow',
    accent: '#9fd8ff',
  },

  // --- One Piece -----------------------------------------------------------
  luffy: {
    pose: 'brawler', build: B(1.0, 0.98, 1.16, 1.02, 1.02), idle: 'bounce', run: 'dash', eyeStyle: 'round',
    accent: '#ff6a4a',
  },
  zoro: {
    pose: 'swordsman', build: B(1.18, 1.14, 1.04, 1.0, 1.04), idle: 'coiled', run: 'pumped', eyeStyle: 'narrow',
    accent: '#8dffbe',
  },

  // --- One Punch Man -------------------------------------------------------
  saitama: {
    pose: 'heavyweight', build: B(1.34, 1.28, 1.1, 1.02, 1.08), idle: 'still', run: 'waddle', eyeStyle: 'closed',
    accent: '#ffe58a',
  },

  // --- Jujutsu Kaisen ------------------------------------------------------
  gojo: {
    pose: 'acrobat', build: B(1.06, 1.0, 1.12, 1.0, 1.1), idle: 'float', run: 'float', eyeStyle: 'glowing',
    accent: '#5fd2ff',
  },
  yuji: {
    pose: 'brawler', build: B(1.08, 1.04, 1.04, 1.0, 1.02), idle: 'breathe', run: 'pumped', eyeStyle: 'round',
    accent: '#ff315a',
  },

  // --- Chainsaw Man --------------------------------------------------------
  denji: {
    pose: 'wrestler', build: B(1.12, 1.08, 1.04, 1.0, 1.0), idle: 'bounce', run: 'pumped', eyeStyle: 'round',
    accent: '#ffb52e',
  },

  // --- JoJo ----------------------------------------------------------------
  shadowdio: {
    pose: 'acrobat', build: B(1.02, 1.0, 1.06, 1.0, 1.04), idle: 'float', run: 'dash', eyeStyle: 'narrow',
    accent: '#ffe45c',
  },
};

/**
 * Animation remaps. The key is the shared `AnimName` a move already uses; the
 * value is the silhouette that fighter should show for it.
 * Unarmed styles trade every blade swing for a strike; armed styles keep blades
 * but change grip, arc or spin so no two sword users look alike.
 */
export const ANIMS: Record<string, Record<string, AnimName>> = {
  levi:    { spin: 'flurry', flip: 'spinKick', castUp: 'slam', rise: 'sweep', dive: 'dkick', backslash: 'lowslash' },
  killua:  { slash: 'jab', backslash: 'hook', thrust: 'jab', spin: 'flurry', flip: 'spinKick', upslash: 'knee', lowslash: 'axeKick', dive: 'stomp', sweep: 'roundhouse', cast: 'palm', castUp: 'flurry', slam: 'roundhouse', rise: 'knee', counter: 'backfist', dkick: 'roundhouse' },
  rengoku:{ slash: 'upslash', backslash: 'slash', thrust: 'palm', spin: 'spinKick', castUp: 'flurry', rise: 'upslash' },
  tanjiro: { slash: 'lowslash', backslash: 'slash', thrust: 'thrust', spin: 'spinKick', dive: 'slash', rise: 'upslash', cast: 'thrust' },
  madara:  { slash: 'slash', thrust: 'cast', spin: 'spin', flip: 'spin', castUp: 'castUp', rise: 'rise', lowslash: 'sweep', dive: 'slam' },
  asta:    { slash: 'slash', thrust: 'thrust', spin: 'spin', upslash: 'slam', cast: 'cast', castUp: 'castUp', dive: 'slam', rise: 'rise', lowslash: 'slam', sweep: 'sweep', dkick: 'slam' },
  goku:    { slash: 'jab', backslash: 'hook', thrust: 'jab', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'axeKick', lowslash: 'sweep', sweep: 'roundhouse', dive: 'stomp', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  ichigo:  { slash: 'lowslash', backslash: 'slash', spin: 'spinKick', flip: 'spinKick', castUp: 'slash', rise: 'upslash', dive: 'slash' },
  naruto:  { slash: 'jab', backslash: 'hook', thrust: 'palm', spin: 'flurry', flip: 'spinKick', cast: 'cast', castUp: 'flurry', lowslash: 'sweep', dive: 'stomp', rise: 'knee', counter: 'backfist', dkick: 'roundhouse' },
  sasuke:  { slash: 'thrust', backslash: 'slash', thrust: 'thrust', spin: 'spinKick', castUp: 'slam', lowslash: 'sweep', dive: 'dive', rise: 'upslash' },
  luffy:   { slash: 'jab', backslash: 'hook', thrust: 'palm', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'stomp', lowslash: 'sweep', sweep: 'roundhouse', dive: 'axeKick', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  zoro:    { slash: 'slash', backslash: 'slash', spin: 'spinKick', flip: 'spinKick', rise: 'upslash', dive: 'slash' },
  saitama: { slash: 'jab', backslash: 'hook', thrust: 'jab', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'stomp', lowslash: 'sweep', sweep: 'roundhouse', dive: 'stomp', rise: 'knee', counter: 'palm', dkick: 'roundhouse' },
  gojo:    { slash: 'palm', backslash: 'palm', thrust: 'palm', uppercut: 'castUp', spin: 'spin', flip: 'spin', castUp: 'castUp', lowslash: 'sweep', dive: 'dive', rise: 'rise', counter: 'cast', dkick: 'dive' },
  yuji:    { slash: 'jab', backslash: 'hook', thrust: 'jab', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'axeKick', lowslash: 'sweep', sweep: 'roundhouse', dive: 'stomp', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  deku:    { slash: 'jab', backslash: 'hook', thrust: 'palm', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'axeKick', lowslash: 'sweep', sweep: 'roundhouse', dive: 'stomp', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  todoroki:{ slash: 'jab', backslash: 'hook', thrust: 'palm', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'stomp', lowslash: 'sweep', sweep: 'roundhouse', dive: 'axeKick', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  eren:    { slash: 'elbow', backslash: 'backfist', thrust: 'headbutt', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'stomp', lowslash: 'slam', sweep: 'roundhouse', dive: 'stomp', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  denji:   { slash: 'backfist', backslash: 'backfist', thrust: 'jab', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'axeKick', lowslash: 'sweep', sweep: 'roundhouse', dive: 'stomp', rise: 'knee', counter: 'elbow', dkick: 'roundhouse' },
  shadowdio:{ slash: 'jab', backslash: 'hook', thrust: 'palm', uppercut: 'knee', spin: 'flurry', flip: 'spinKick', cast: 'palm', castUp: 'flurry', slam: 'stomp', lowslash: 'sweep', sweep: 'roundhouse', dive: 'axeKick', rise: 'knee', counter: 'backfist', dkick: 'roundhouse' },
};

/** Sukuna keeps his authored animation set untouched. */
const UNTOUCHED = new Set(['sukuna']);

/** Applies art direction to the whole roster. Safe to call once at build time. */
/**
 * Wardrobe below the wrist and the knee: gloves, footwear, and where the
 * trousers stop. Small at sprite scale, but it is most of what makes two
 * fighters with the same body read as different people.
 */
export const WARDROBE: Record<string, Partial<Pick<Look, 'glove' | 'footwear' | 'shorts' | 'boots'>>> = {
  levi: { footwear: 'boots' },
  killua: { footwear: 'shoes', boots: '#3b2f5c' },
  rengoku: { footwear: 'tabi', boots: '#f2efe6' },
  madara: { footwear: 'sandals', boots: '#1f2438' },
  asta: { footwear: 'boots' },
  goku: { footwear: 'boots', boots: '#1f3f9a' },
  ichigo: { footwear: 'tabi', boots: '#f1efe8' },
  naruto: { footwear: 'sandals', boots: '#1b1b24' },
  tanjiro: { footwear: 'tabi', boots: '#e9e4d6' },
  sasuke: { footwear: 'sandals', boots: '#25283a' },
  luffy: { footwear: 'sandals', boots: '#8a5a2b', shorts: true },
  zoro: { footwear: 'boots', boots: '#1d1d24' },
  saitama: { footwear: 'boots', boots: '#d8302c', glove: '#d8302c' },
  gojo: { footwear: 'shoes', boots: '#15161d' },
  yuji: { footwear: 'shoes', boots: '#d9d4cf' },
  deku: { footwear: 'boots', boots: '#e0302c' },
  todoroki: { footwear: 'boots', boots: '#2a2d3a' },
  eren: { footwear: 'boots', boots: '#3a2616' },
  denji: { footwear: 'shoes', boots: '#1b1b20' },
  shadowdio: { footwear: 'boots', boots: '#e8c33a' },
  gokublack: { footwear: 'boots', boots: '#e5e7eb' },
  goku_ui: { footwear: 'boots', boots: '#1f3f9a' },
};

export function applyArtDirection(defs: CharDef[]) {
  for (const def of defs) {
    if (UNTOUCHED.has(def.id)) continue;
    const art = ART[def.id];
    if (art) def.look = { ...def.look, ...art };
    const ward = WARDROBE[def.id];
    if (ward) def.look = { ...def.look, ...ward };
    const swaps = ANIMS[def.id];
    if (swaps) {
      for (const m of Object.values(def.moves)) {
        const next = (m as any).anim && swaps[(m as any).anim];
        if (next) (m as any).anim = next;
      }
    }
  }
}
