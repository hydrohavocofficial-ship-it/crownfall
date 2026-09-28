/**
 * Per-character signature ability overrides. Each neutral special and most of the
 * old ultimates spawn a bespoke entity from signatures.ts, so every fighter's kit
 * looks and plays differently.
 *
 * The old ultimates live in `domain`, not `moves`. They are no longer buttons;
 * they are handed to the technique builder, which re-homes them as the neutral
 * awakened special at `DOMAIN_POWER` with a shorter cast. See `techniques.ts`.
 */
import type { MoveDef } from './types';
import { sfx } from './audio';
import { DOMAIN_POWER } from './awakenings';

type SpawnFn = (f: any, g: any) => void;
const sp = (g: any, f: any, sig: string, o: any) => g.spawnProj({
  owner: f, type: 'sig', sig, x: f.x, y: f.y, vx: 0, vy: 0, w: 80, h: 80, life: 40,
  dmg: 8, ang: 40, kb: 6, sc: 6, dir: f.facing, fx: 'blunt', ...o,
});
const target = (g: any, f: any, range = 620) => g.nearestEnemy(f, range);
const groundAt = (g: any, x: number, y: number, fallback: number) => g.groundBelow(x, y - 10) ?? fallback;

/**
 * A signature special.
 *
 * Stamped with `ability: 'special'` like every other special in the game, so the
 * tier table, the HUD readout and the move list all read these the same way they
 * read a hand-authored `nspec`.
 */
function S(name: string, desc: string, anim: any, dur: number, su: number, cd: number, spawn: SpawnFn, extra: Partial<MoveDef> = {}): MoveDef {
  const { onFrame, ...rest } = extra;
  return {
    name, desc, anim, dur, startup: su, cd, hits: [], grav: 0.35, ability: 'special', ...rest,
    onFrame: (f: any, fr: number, g: any) => { if (fr === su) spawn(f, g); onFrame?.(f, fr, g); },
  };
}

/**
 * A retained set-piece.
 *
 * Stamped with `domainPower` so everything it throws - the melee hits and any
 * projectile its choreography spawns - comes out at the same reduced strength.
 * A domain that hit for 17 and launched a 34-damage blast would otherwise be
 * "weakened" only in the part a player can see.
 */
function D(name: string, label: string, desc: string, anim: any, dur: number, su: number, at: number, spawn: SpawnFn, extra: Partial<MoveDef> = {}): MoveDef {
  const { onFrame, ...rest } = extra;
  return {
    name, desc, anim, dur, startup: su, invuln: [0, dur], grav: 0.2, hits: [], domainPower: DOMAIN_POWER,
    label, ...rest,
    onFrame: (f: any, fr: number, g: any) => {
      if (fr === at) { spawn(f, g); g.fx.text(f.x, f.y - 158, label, '#ffffff', 28, 62); }
      onFrame?.(f, fr, g);
    },
  };
}
const charge = (col: string) => (f: any, fr: number, g: any) => {
  if (fr % 3 === 0) { const a = Math.random() * 6.28; g.fx.add({ x: f.x + Math.cos(a) * 50, y: f.y - 44 + Math.sin(a) * 50, vx: -Math.cos(a) * 3.4, vy: -Math.sin(a) * 3.4, color: col, kind: 'glow', life: 14, size: 7 }); }
};

interface Override { moves: Partial<Record<string, MoveDef>>; domain?: MoveDef; zone?: boolean; attach?: Record<string, { at: number; fn: SpawnFn }> }
/** visual-only attachment (never active, just rendered on top of an existing move) */
const visual = (g: any, f: any, sig: string, o: any) => sp(g, f, sig, { delay: 9999, dmg: 0, ...o });

export const OVERRIDES: Record<string, Override> = {
  levi: { zone: true, moves: {
    nspec: S('Thunder Spear', 'Hurls an explosive anti-titan spear in an arc. Detonates on contact or on landing.', 'thrust', 32, 9, 170,
      (f, g) => { sp(g, f, 'thunderSpear', { x: f.x + f.facing * 30, y: f.y - 60, vx: f.facing * 15, vy: -4.5, w: 44, h: 30, life: 70, dmg: 3, kb: 2, sc: 1, fx: 'fire', fin: { dmg: 14, ang: 45, kb: 8.2, sc: 8.6 } }); sfx('whoosh'); }),
  } },
  killua: { zone: true, moves: {
    nspec: S('Thunderbolt (Narukami)', 'As in the anime: Killua leaps above his foe and drives a single bolt of lightning down from his fingertips, paralysing them.', 'castUp', 38, 12, 190,
      (f, g) => {
        const t = target(g, f, 560); const bx = t ? t.x : f.x + f.facing * 200; const by = t ? t.y : f.y;
        sp(g, f, 'narukami', { x: bx, y: groundAt(g, bx, by, by), w: 84, h: 520, ground: true, delay: 4, activeFor: 8, life: 30, dmg: 12, stun: 26, kb: 3.6, ang: 80, sc: 3.4, fx: 'elec' });
        g.flashScreen('#bfefff', .3); g.shake(10);
      }, { vel: [[0, 2, -9]], grav: .35, onFrame: charge('#8fe6ff') }),
  }, domain: D('Godspeed', 'GODSPEED', 'A pillar of lightning erupts around him, then he becomes living electricity.', 'castUp', 44, 20, 20,
      (f, g) => {
        sp(g, f, 'narukami', { x: f.x, y: f.y, w: 200, h: 600, ground: true, delay: 1, activeFor: 10, life: 30, dmg: 13, kb: 7, ang: 80, sc: 6, fx: 'elec', data: { big: true } });
        f.godT = 620; g.fx.ring(f.x, f.y - 42, 16, 230, '#8fe6ff', 28, 16); g.flashScreen('#8fe6ff', 0.4); sfx('ult'); g.shake(16);
      }, { onFrame: charge('#8fe6ff') }),
  },
  rengoku: { zone: true, moves: {
    nspec: S('Fifth Form: Flame Tiger', 'Unleashes a roaring tiger of fire that charges along the ground.', 'slam', 40, 13, 190,
      (f, g) => { sp(g, f, 'flameTiger', { x: f.x + f.facing * 60, y: f.y, vx: f.facing * 11, w: 150, h: 120, ground: true, life: 50, rehit: 7, dmg: 3.2, kb: 3.6, ang: 38, sc: 2, fx: 'fire', fin: { dmg: 14, ang: 44, kb: 8.4, sc: 8.6 } }); sfx('fire'); g.shake(8); }),
  } },
  madara: { zone: true, moves: {
    nspec: S('Tengai Shinsei', 'Drags a colossal flaming meteor down from the sky onto the nearest enemy.', 'castUp', 46, 18, 270,
      (f, g) => {
        const t = target(g, f, 900); const tx = t ? t.x : f.x + f.facing * 320; const gy = groundAt(g, tx, t ? t.y : f.y, f.y);
        sp(g, f, 'meteor', { x: tx - f.facing * 330, y: gy - 760, vx: f.facing * 6, vy: 13.8, w: 170, h: 170, life: 100, dmg: 8, kb: 5, sc: 4, fx: 'fire', data: { gy }, fin: { dmg: 18, ang: 52, kb: 9, sc: 9.4 } });
        sfx('purple'); g.shake(6);
      }, { onFrame: charge('#b067ff') }),
  } },
  asta: { zone: true, moves: {
    nspec: S('Black Divider Slash', 'A jagged anti-magic crescent that NULLIFIES every enemy projectile it touches.', 'slash', 36, 10, 160,
      (f, g) => { sp(g, f, 'antiSlash', { x: f.x + f.facing * 50, y: f.y - 46, vx: f.facing * 16, w: 56, h: 124, life: 40, dmg: 11, ang: 35, kb: 6, sc: 6.6, fx: 'dark' }); sfx('dark'); }),
  } },
  goku: { zone: true, moves: {
    nspec: S('Kamehameha', 'Channels ki and fires a sustained beam that sweeps the whole stage.', 'cast', 58, 18, 210,
      (f, g) => { sp(g, f, 'kameBeam', { life: 34, w: 10, h: 60, rehit: 6, dmg: 3.4, ang: 28, kb: 5.4, sc: 3.2, fx: 'fire' }); sfx('fire'); sfx('ult'); g.flashScreen('#8fe3ff', 0.25); },
      { grav: 0, vel: [[0, 0, 0]], onFrame: charge('#8fe3ff') }),
  }, domain: D('Spirit Bomb', 'SPIRIT BOMB', 'Gathers energy from all living things into a titanic sphere, then hurls it down.', 'castUp', 60, 46, 2,
      (f, g) => { sp(g, f, 'spiritBomb', { follow: true, ox: 0, oy: -210, delay: 44, life: 140, w: 40, h: 40, rehit: 5, pull: true, dmg: 3.6, kb: 2, sc: 0, ang: 60, fx: 'fire', fin: { dmg: 24, ang: 50, kb: 10.4, sc: 10 } }); }),
  },
  ichigo: { zone: true, moves: {
    nspec: S('Getsuga Tenshou', 'A towering black crescent of Bankai spirit energy, trailing afterimages.', 'slash', 40, 11, 160,
      (f, g) => { sp(g, f, 'getsugaBig', { x: f.x + f.facing * 56, y: f.y - 60, vx: f.facing * 15, w: 70, h: 190, life: 44, dmg: 13, ang: 42, kb: 7.2, sc: 7.8, fx: 'dark' }); sfx('dark'); g.shake(8); }),
  }, domain: D('Final Getsuga: Mugetsu', 'MUGETSU', 'Becomes Getsuga itself — a wall of absolute darkness engulfs the stage.', 'slash', 60, 24, 24,
      (f, g) => { sp(g, f, 'mugetsu', { x: f.x + f.facing * 40, y: f.y - 220, vx: f.facing * 15, w: 150, h: 780, life: 62, rehit: 5, pull: true, dmg: 3, kb: 2, sc: 0, fx: 'dark', fin: { dmg: 22, ang: 42, kb: 10, sc: 9.8 } }); g.flashScreen('#000000', 0.75); sfx('ult'); sfx('dark'); g.shake(20); }),
  },
  naruto: { zone: true, attach: { sspec: { at: 1, fn: (f, g) => visual(g, f, 'rasenganOrb', { follow: true, ox: 36, oy: -44, life: 32 }) } }, moves: {
    nspec: S('Shadow Clone Jutsu', 'Two shadow clones burst out and rush the opponent, poofing on impact.', 'cast', 36, 8, 175,
      (f, g) => { [0, 1].forEach((i) => sp(g, f, 'clone', { x: f.x + f.facing * (20 + i * 10), y: f.y, vx: f.facing * (10 + i), delay: i * 7, w: 46, h: 78, ground: true, life: 38 + i * 7, dmg: 7, ang: 40, kb: 5.4, sc: 4.6, fx: 'blunt', data: { i } })); sfx('dodge'); }),
  }, domain: D('Kurama Avatar', 'NINE-TAILS CHAKRA MODE', 'Kurama materialises around him as a colossal fox and lunges across the stage.', 'castUp', 64, 26, 2,
      (f, g) => { sp(g, f, 'foxAvatar', { follow: true, ox: -30, oy: -100, delay: 26, life: 100, w: 280, h: 230, rehit: 5, pull: true, dmg: 3.4, kb: 2, sc: 0, ang: 40, fx: 'fire', fin: { dmg: 22, ang: 44, kb: 10, sc: 9.8 } }); f.godT = 360; }),
  },
  tanjiro: { zone: true, moves: {
    nspec: S('Tenth Form: Constant Flux', 'A coiling water dragon that ripples along the stage and grows as it travels.', 'slash', 42, 12, 170,
      (f, g) => { sp(g, f, 'serpent', { x: f.x + f.facing * 50, y: f.y - 50, vx: f.facing * 12, w: 110, h: 100, life: 58, rehit: 6, dmg: 3.4, ang: 40, kb: 4.2, sc: 2.6, fx: 'slash', data: { pal: 'water', y0: f.y - 50 }, fin: { dmg: 12, ang: 42, kb: 8, sc: 8.2 } }); sfx('whoosh'); }),
  }, domain: D('Sun Halo Dragon', 'HINOKAMI KAGURA', 'Sun Breathing: a blazing solar dragon crowned with a halo of light.', 'thrust', 62, 24, 24,
      (f, g) => { sp(g, f, 'serpent', { x: f.x + f.facing * 60, y: f.y - 70, vx: f.facing * 14, w: 200, h: 170, life: 80, rehit: 5, pull: true, dmg: 3.4, ang: 40, kb: 2, sc: 0, fx: 'fire', data: { pal: 'sun', y0: f.y - 70 }, fin: { dmg: 20, ang: 45, kb: 9.6, sc: 9.8 } }); sfx('ult'); sfx('fire'); g.flashScreen('#ff9a3a', 0.4); g.shake(14); }),
  },
  sasuke: { zone: true, moves: {
    dspec: S('Kirin', 'Shapes the storm into a dragon of pure lightning that tears across the stage.', 'castUp', 42, 14, 200,
      (f, g) => { sp(g, f, 'serpent', { x: f.x + f.facing * 50, y: f.y - 70, vx: f.facing * 15, w: 120, h: 110, life: 50, dmg: 15, stun: 10, ang: 60, kb: 7, sc: 8, fx: 'elec', data: { pal: 'kirin', y0: f.y - 70 } }); sfx('elec'); g.flashScreen('#c9b0ff', 0.25); g.shake(10); }),
    nspec: S('Amaterasu', 'Ignites inextinguishable black flames directly beneath the nearest foe.', 'cast', 40, 12, 230,
      (f, g) => { const t = target(g, f, 720); const tx = t ? t.x : f.x + f.facing * 220; sp(g, f, 'amaterasu', { x: tx, y: groundAt(g, tx, t ? t.y : f.y, f.y), ground: true, delay: 12, activeFor: 80, life: 94, w: 120, h: 84, rehit: 10, dmg: 2.4, stun: 4, kb: 1.4, ang: 70, sc: 0.8, fx: 'dark' }); g.flashScreen('#200030', 0.2); }),
  }, domain: D("Indra's Arrow", "INDRA'S ARROW", 'Draws a Susanoo bow of lightning and looses an arrow that tears the stage apart.', 'cast', 72, 30, 2,
      (f, g) => { sp(g, f, 'indraArrow', { follow: true, ox: 70, oy: -60, delay: 28, life: 96, w: 260, h: 120, rehit: 5, pull: true, dmg: 3.6, kb: 2, sc: 0, ang: 30, fx: 'elec', fin: { dmg: 22, ang: 40, kb: 10, sc: 9.8 } }); }),
  },
  luffy: { zone: true, attach: { sspec: { at: 8, fn: (f, g) => visual(g, f, 'fistFlurryFx', { life: 40, data: {} }) } }, moves: {
    nspec: S('Gum-Gum Pistol', 'His arm stretches across a huge distance and snaps back.', 'punch', 32, 6, 120,
      (f, g) => { sp(g, f, 'rubberArm', { activeFor: 12, life: 22, w: 64, h: 56, dmg: 13, ang: 36, kb: 6.8, sc: 7.8, fx: 'blunt', data: { max: 320 } }); sfx('whoosh'); }),
  }, domain: D('Gear Fourth: King Kong Gun', 'KING KONG GUN', 'Inflates his fist to titanic size and fires it across the arena.', 'thrust', 64, 26, 26,
      (f, g) => { sp(g, f, 'giantFist', { x: f.x + f.facing * 90, y: f.y - 70, vx: f.facing * 13, w: 200, h: 180, life: 64, rehit: 5, pull: true, dmg: 3.4, kb: 2, sc: 0, ang: 38, fx: 'blunt', fin: { dmg: 24, ang: 40, kb: 10.4, sc: 10 } }); sfx('ult'); g.shake(18); }, { onFrame: charge('#ff6a4a') }),
  },
  zoro: { zone: true, moves: {
    nspec: S('Tatsumaki', 'Three-sword spin whips up a cutting tornado that drags foes along.', 'spin', 42, 14, 180,
      (f, g) => { sp(g, f, 'tornado', { x: f.x + f.facing * 70, y: f.y, vx: f.facing * 5.5, ground: true, w: 130, h: 220, life: 64, rehit: 6, pull: true, dmg: 2.8, kb: 1.6, ang: 80, sc: 0, fx: 'slash', fin: { dmg: 13, ang: 80, kb: 8.4, sc: 8.8 } }); sfx('whoosh'); }, { turns: 2 }),
  }, domain: D('Asura: Nine Swords', 'ASURA — NINE SWORDS', 'Nine blades converge on the target and carve it apart in sequence.', 'slash', 66, 22, 4,
      (f, g) => { const t = target(g, f, 640); const tx = t ? t.x : f.x + f.facing * 220, ty = t ? t.y - 50 : f.y - 50; sp(g, f, 'nineSword', { x: tx, y: ty, delay: 18, activeFor: 38, life: 68, w: 340, h: 260, rehit: 4, dmg: 2.6, stun: 6, kb: 0.6, ang: 80, sc: 0, fx: 'slash', fin: { dmg: 24, ang: 45, kb: 10, sc: 10 } }); sfx('ult'); }),
  },
  saitama: { moves: {
    nspec: S('Consecutive Normal Punches', 'A blur of red-gloved fists hammers everything in front of him.', 'punch', 52, 10, 190,
      (f, g) => { sp(g, f, 'fistBarrage', { life: 40, w: 190, h: 130, rehit: 3, pull: true, dmg: 2.4, kb: 1.4, ang: 60, sc: 0, fx: 'blunt', fin: { dmg: 15, ang: 40, kb: 9, sc: 9.4 } }); }, { grav: 0.2 }),
  }, domain: D('Serious Punch', 'SERIOUS SERIES: SERIOUS PUNCH', 'One serious punch. The pressure wave splits the clouds across the whole screen.', 'thrust', 70, 32, 32,
      (f, g) => { sp(g, f, 'windCone', { life: 36, w: 10, h: 10, dmg: 34, ang: 30, kb: 11, sc: 10.4, fx: 'blunt', data: { big: true, max: 1300 } }); sfx('ult'); sfx('heavyhit', 2); g.flashScreen('#ffffff', 0.6); g.shake(28); }, { onFrame: charge('#ffe58a') }),
  },
  gojo: { zone: true, moves: {
    sspec: S('Reversal: Red', 'Condenses inverted cursed energy into a point, then detonates it — blasting everyone away.', 'cast', 36, 8, 150,
      (f, g) => { sp(g, f, 'redBlast', { x: f.x + f.facing * 72, y: f.y - 48, delay: 8, activeFor: 4, life: 28, w: 160, h: 140, dmg: 13, ang: 36, kb: 8.4, sc: 8.4, fx: 'purple' }); }),
    nspec: S('Cursed Technique: Blue', 'Warps space into a sphere of attraction that drags enemies into it.', 'cast', 44, 13, 180,
      (f, g) => { sp(g, f, 'blueOrb', { x: f.x + f.facing * 60, y: f.y - 50, vx: f.facing * 6.5, w: 110, h: 110, life: 72, rehit: 6, pull: true, dmg: 2.8, kb: 2.2, ang: 60, sc: 1, fx: 'purple', fin: { dmg: 13, ang: 55, kb: 8.2, sc: 8.4 } }); sfx('purple'); }),
  }, domain: D('Hollow Purple', 'HOLLOW TECHNIQUE: PURPLE', 'Collides Blue and Red into imaginary mass that erases everything in its path.', 'cast', 76, 30, 2,
      (f, g) => { sp(g, f, 'hollowPurple', { follow: true, ox: 90, oy: -52, delay: 30, life: 124, w: 210, h: 210, rehit: 5, pull: true, dmg: 4, kb: 2, sc: 0, ang: 40, fx: 'purple', fin: { dmg: 24, ang: 42, kb: 10.4, sc: 10 } }); }),
  },
  yuji: { moves: {
    nspec: S('Black Flash', 'Hits within 0.000001s of cursed energy — space cracks black and red.', 'punch', 34, 8, 150,
      (f, g) => { sp(g, f, 'blackFlashCrack', { follow: true, ox: 54, oy: -46, life: 18, w: 110, h: 100, dmg: 17, ang: 34, kb: 7.4, sc: 8.6, stun: 6, fx: 'dark' }); },
      { grav: 0.2, vel: [[0, 0, 0], [6, 16, 0], [14, 2, null]], trail: 'hand' }),
  }, domain: D('Malevolent Shrine', 'DOMAIN EXPANSION: MALEVOLENT SHRINE', 'Sukuna seizes control and opens his domain — unending slashes rend everything inside.', 'castUp', 84, 26, 2,
      (f, g) => { sp(g, f, 'shrine', { follow: true, ox: 0, oy: -60, delay: 26, activeFor: 50, life: 86, w: 720, h: 400, rehit: 4, dmg: 2.4, stun: 6, kb: 0.8, ang: 70, sc: 0, fx: 'dark', behind: true, fin: { dmg: 22, ang: 50, kb: 10, sc: 9.8 } }); f.devilT = 320; }),
  },
  deku: { zone: true, moves: {
    nspec: S('Detroit Smash: Air Pressure', 'A punch so strong it launches a cone of wind laced with green lightning.', 'punch', 38, 10, 160,
      (f, g) => { sp(g, f, 'windCone', { life: 22, w: 10, h: 10, dmg: 12, ang: 36, kb: 7, sc: 7.4, fx: 'elec', data: { max: 340 } }); sfx('heavyhit'); g.shake(8); }, { trail: 'hand' }),
  } },
  todoroki: { zone: true, moves: {
    dspec: S('Frost Cage', 'Twin glacier ridges burst out on both sides of him at once.', 'slam', 44, 12, 190,
      (f, g) => { for (const d of [-1, 1]) sp(g, f, 'iceRidge', { dir: d, x: f.x + d * 30, y: f.y, vx: d * 13, ground: true, w: 70, h: 120, life: 34, dmg: 12, ang: 76, kb: 6.4, sc: 7, fx: 'elec', data: { x0: f.x + d * 20 } }); sfx('land'); g.shake(8); }),
    nspec: S('Ice Glacier Wave', 'A ridge of jagged ice crystals races across the ground and stays behind.', 'slam', 44, 12, 175,
      (f, g) => { sp(g, f, 'iceRidge', { x: f.x + f.facing * 40, y: f.y, vx: f.facing * 12, ground: true, w: 70, h: 110, life: 46, dmg: 11, ang: 70, kb: 6, sc: 6.6, fx: 'elec', data: { x0: f.x + f.facing * 30 } }); sfx('land'); }),
  }, domain: D('Heaven-Piercing Ice Wall', 'HALF-COLD HALF-HOT', 'A mountainous glacier erupts across the stage, wreathed in searing flame.', 'slam', 62, 24, 24,
      (f, g) => { sp(g, f, 'iceRidge', { x: f.x + f.facing * 50, y: f.y, vx: f.facing * 17, ground: true, w: 130, h: 300, life: 62, dmg: 24, ang: 62, kb: 10, sc: 9.8, fx: 'elec', data: { x0: f.x + f.facing * 40, big: true } }); sfx('ult'); g.flashScreen('#cfeeff', 0.45); g.shake(20); }, { onFrame: charge('#9fd8ff') }),
  },
  eren: { zone: true, moves: {
    nspec: S('Titan Arm', 'A partially-shifted titan arm erupts from behind him and punches forward.', 'punch', 40, 10, 170,
      (f, g) => { sp(g, f, 'titanArm', { life: 26, activeFor: 14, w: 120, h: 110, dmg: 17, ang: 40, kb: 7.8, sc: 8.8, fx: 'blunt' }); sfx('heavyhit'); }),
  }, domain: D('The Rumbling', 'THE RUMBLING', 'A colossal titan foot descends from the sky and crushes the target.', 'castUp', 72, 20, 20,
      (f, g) => { const t = target(g, f, 900); const tx = t ? t.x : f.x + f.facing * 260; const gy = groundAt(g, tx, t ? t.y : f.y, f.y); sp(g, f, 'titanFoot', { x: tx, y: gy, ground: true, delay: 40, activeFor: 10, life: 76, w: 300, h: 280, dmg: 30, ang: 60, kb: 10.6, sc: 10, fx: 'blunt' }); sfx('ult'); }),
  },
  denji: { zone: true, moves: {
    nspec: S('Chainsaw Boomerang', 'Hurls a whirling saw disc that tears forward, then grinds its way back.', 'slash', 36, 10, 170,
      (f, g) => { sp(g, f, 'sawDisc', { x: f.x + f.facing * 40, y: f.y - 44, vx: f.facing * 17, w: 76, h: 76, life: 66, rehit: 5, dmg: 3.2, kb: 2.4, ang: 40, sc: 1.2, fx: 'dark' }); sfx('swingH'); }),
  } },
  gokublack: { zone: true, moves: {
    nspec: S('Black Kamehameha', 'Fires a concentrated beam of divine Super Saiyan Rosé ki across the entire stage.', 'thrust', 48, 12, 180,
      (f, g) => {
        sp(g, f, 'blackKameBeam', { x: f.x + f.facing * 40, y: f.y - 46, life: 34, w: 900, h: 76, rehit: 4, dmg: 3.2, kb: 2.2, ang: 35, sc: 1.2, fx: 'purple', fin: { dmg: 14, ang: 42, kb: 8.6, sc: 8.8 } });
        sfx('heavyhit'); g.shake(8); g.flashScreen('#ec4899', 0.3);
      }, { onFrame: charge('#ec4899') }),
    sspec: S('Divine Lasso', 'Dashes forward with the God Split Cut blade, impaling the target and planting 6 exploding ki needles.', 'thrust', 38, 8, 160,
      (f, g) => {
        const t = target(g, f, 580); const tx = t ? t.x : f.x + f.facing * 180, ty = t ? t.y - 40 : f.y - 40;
        sp(g, f, 'divineLasso', { x: tx, y: ty, life: 32, delay: 0, activeFor: 28, w: 120, h: 100, dmg: 4, kb: 2, sc: 0.5, fx: 'purple', fin: { dmg: 16, ang: 50, kb: 9.0, sc: 9.2 } });
        sfx('swingH'); g.shake(6);
      }, { vel: [[0, 0, 0], [4, 22, 0], [18, 2, null]] }),
    dspec: S('Holy Light Grenade', 'Condenses divine godly ki into an orb that detonates the arena around him.', 'slam', 44, 12, 190,
      (f, g) => {
        sp(g, f, 'holyLightGrenade', { x: f.x + f.facing * 50, y: f.y - 40, life: 36, w: 140, h: 140, rehit: 6, dmg: 3, kb: 3, ang: 65, sc: 1.5, fx: 'purple', fin: { dmg: 15, ang: 60, kb: 8.4, sc: 8.8 } });
        sfx('land'); g.shake(10); g.flashScreen('#8b5cf6', 0.25);
      }),
  }, domain: D('Scythe of Sorrow', 'SCYTHE OF SORROW: WORK OF THE GODS', 'Unsheathes the colossal Rosé Scythe, tearing open a dimensional rift across reality.', 'castUp', 78, 22, 22,
      (f, g) => {
        sp(g, f, 'scytheRift', { x: f.x + f.facing * 120, y: f.y - 40, delay: 2, activeFor: 50, life: 64, w: 280, h: 360, rehit: 4, pull: true, dmg: 4.5, stun: 8, kb: 1.5, ang: 50, sc: 0, fx: 'purple', fin: { dmg: 28, ang: 45, kb: 11, sc: 10.5 } });
        f.godT = 600; g.flashScreen('#ec4899', 0.6); g.shake(30); sfx('ult');
      }, { onFrame: charge('#ec4899') }),
  },
};

/** Visual identity for the two halves of a fighter's kit. */
const SIGNATURE_VFX: Record<string, { core: string; domain: string }> = {
  levi: { core: 'odmWire', domain: 'odmStorm' }, killua: { core: 'zapAura', domain: 'godspeedBlur' },
  rengoku: { core: 'flameTiger', domain: 'flameTrail' }, madara: { core: 'susanooFlare', domain: 'susanooFlare' },
  asta: { core: 'antiMagic', domain: 'voidAura' }, goku: { core: 'kiCharge', domain: 'dragonFist' },
  ichigo: { core: 'getsuga', domain: 'reiatsu' }, naruto: { core: 'cloneEcho', domain: 'rasengan' },
  tanjiro: { core: 'waterArc', domain: 'sunDance' }, sasuke: { core: 'chidori', domain: 'amaterasu' },
  luffy: { core: 'rubberStretch', domain: 'redHawk' }, zoro: { core: 'windCross', domain: 'windCross' },
  saitama: { core: 'airPressure', domain: 'seriousWind' }, gojo: { core: 'limitless', domain: 'hollowPurple' },
  yuji: { core: 'blackFlash', domain: 'cursedFist' }, deku: { core: 'cowlSpark', domain: 'smashShock' },
  todoroki: { core: 'iceSpires', domain: 'flashfire' }, eren: { core: 'hardenCrack', domain: 'steamBurst' },
  denji: { core: 'sawGrind', domain: 'bloodSpray' },
};

/**
 * Applies a fighter's signature overrides to its authored move table.
 *
 * This runs *before* the technique tree is installed, because one of the things
 * it produces is the retained set-piece, and the builder needs that in hand to
 * re-home it as the neutral awakened special. Anything that has to wait until
 * the full move table exists - the AI's zoning preference, the ability list - is
 * in `applySignatures` instead.
 */
export function mergeSignatures<T extends Record<string, MoveDef>>(id: string, authored: T) {
  const o = OVERRIDES[id];
  const moves = { ...authored } as Record<string, MoveDef> & { ult?: MoveDef };
  const style = SIGNATURE_VFX[id];
  if (o) {
    for (const [key, move] of Object.entries(o.moves)) {
      if (key === 'domain') continue;
      moves[key] = move;
    }
    // Visual-only attachments, layered onto whichever move they belong to.
    for (const [key, a] of Object.entries(o.attach || {})) {
      const m = moves[key]; if (!m) continue;
      const prev = m.onFrame;
      moves[key] = { ...m, onFrame: (f: any, fr: number, g: any) => { if (fr === a.at) a.fn(f, g); prev?.(f, fr, g); } };
    }
  }
  // The set-piece: the authored ultimate, unless an override supplies a better
  // one. Either way it leaves the move table here and never becomes a button.
  const domain: MoveDef | undefined = o?.domain || moves.ult;
  delete moves.ult;
  if (style) {
    for (const key of ['nspec', 'sspec', 'dspec']) if (moves[key] && !moves[key].vfx) moves[key] = { ...moves[key], vfx: style.core };
  }
  // A retained set-piece keeps the visual identity it had as an ultimate.
  if (domain && style && !domain.vfx) domain.vfx = style.domain;
  return { moves: moves as T, domain };
}

/**
 * Finishes a built fighter: the AI's zoning preference and the ability list.
 *
 * Safe to run after the technique tree, because neither touches a move.
 */
export function applySignatures(chars: any[]) {
  for (const c of chars) {
    const o = OVERRIDES[c.id];
    if (o?.zone) c.ai.zoneSpec = 'nspec';
    const m = c.moves;
    c.abilities = [
      { key: 'L · Neutral Special', name: m.nspec.name, desc: m.nspec.desc },
      { key: 'L · Side Special', name: m.sspec.name, desc: m.sspec.desc },
      { key: 'L · Down Special', name: m.dspec.name, desc: m.dspec.desc },
      { key: 'R · Awaken (full gauge)', name: m.naw.name, desc: `${m.naw.desc} The gauge drains from full to empty over about fifteen seconds; at zero the Awakening ends.` },
      { key: 'AWAKENED · J · Light', name: m.nwl.name, desc: m.nwl.desc },
      { key: 'AWAKENED · K · Heavy', name: m.nwh.name, desc: m.nwh.desc },
      { key: 'AWAKENED · L · Special', name: m.nfu.name, desc: m.nfu.desc },
    ];
  }
}
