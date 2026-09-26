import { CHARACTERS, BASE_CHARACTERS, CharDef, CoreMoveKey, MoveKey } from './characters';
import { installTechniques } from './techniques';
import type { Look } from './render';
import type { MoveDef } from './types';
import { makePortrait } from './portraits';

export interface CustomCfg {
  id: string; name: string; title: string; origin: string; bio: string; color: string;
  look: Look; bars: { power: number; speed: number; range: number; defense: number }; size: number;
  style: string; nspec: string; sspec: string; dspec: string; ult: string;
}

const KEY = 'shonen-brawl-customs-v1';
export const STAT_POINTS = 14;

export function loadCustomCfgs(): CustomCfg[] {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* ignore */ }
  return [];
}
function persist(list: CustomCfg[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

const baseById = (id: string) => BASE_CHARACTERS.find((c) => c.id === id) || BASE_CHARACTERS[0];

const NORMALS: CoreMoveKey[] = ['nlight', 'nlight2', 'nlight3', 'nlight_spec', 'nlight_heavy', 'slight', 'slight2', 'slight_spec', 'slight_heavy',
  'dlight', 'dlight2', 'dlight_spec', 'nair', 'nair2', 'nair_spec', 'sair', 'sair2', 'sair_spec', 'dair', 'nsig', 'ssig', 'dsig', 'rec', 'gp'];

function scaleMove(m: MoveDef, dmgMul: number, reachMul: number): MoveDef {
  return { ...m, hits: m.hits.map((h) => ({ ...h, dmg: +(h.dmg * dmgMul).toFixed(1), x: h.x * reachMul, w: h.w * reachMul })) };
}

export function buildCustom(cfg: CustomCfg): CharDef {
  const style = baseById(cfg.style);
  const b = cfg.bars;
  const dmgMul = 0.84 + b.power * 0.06;
  const reachMul = 0.88 + b.range * 0.05;
  const look: Look = { ...cfg.look };
  // Custom fighters are not in the art-direction table, so give them the
  // standard brawler archetype unless the builder already chose one.
  if (!look.pose) look.pose = 'brawler';
  const core = {} as Record<CoreMoveKey, MoveDef>;
  for (const k of NORMALS) core[k] = scaleMove(style.moves[k], dmgMul, reachMul);
  core.nspec = baseById(cfg.nspec).moves.nspec;
  core.sspec = baseById(cfg.sspec).moves.sspec;
  core.dspec = baseById(cfg.dspec).moves.dspec;
  core.ult = baseById(cfg.ult).moves.ult;
  const moves = installTechniques(style.id, look, core) as Record<MoveKey, MoveDef>;
  // Boss-style normals reference optional combo nodes; copy the complete reachable kit.
  for (const key of ['boss_heavy2', 'boss_finisher', 'aspec', 'aig'] as const) {
    if (style.moves[key]) moves[key] = scaleMove(style.moves[key]!, dmgMul, reachMul);
  }

  const nsrc = baseById(cfg.nspec), dsrc = baseById(cfg.dspec), usrc = baseById(cfg.ult);
  return {
    id: cfg.id, styleId: style.id, name: cfg.name || 'Unnamed Fighter', anime: cfg.origin || 'Original Character', title: cfg.title || 'Custom Fighter',
    desc: cfg.bio || `A custom fighter using the ${style.name} fighting style.`,
    color: cfg.color, tier: 'OC',
    portrait: makePortrait(`${style.id}:custom:${cfg.id}:${JSON.stringify(look)}:${cfg.color}`, look, cfg.color),
    stats: {
      speed: 5.8 + b.speed * 0.36, air: 5.6 + b.speed * 0.3, jump: 12.6 + b.speed * 0.34,
      weight: 0.82 + b.defense * 0.08, scale: cfg.size, gravity: 0.61,
    },
    statBars: { ...b }, look, moves,
    moveBranches: style.moveBranches,
    abilities: [
      { key: 'K · Neutral Special', name: moves.nspec.name!, desc: moves.nspec.desc || '' },
      { key: 'K · Side Special', name: moves.sspec.name!, desc: moves.sspec.desc || '' },
      { key: 'K · Down Special', name: moves.dspec.name!, desc: moves.dspec.desc || '' },
      { key: 'L · Limit Break', name: moves.nex.name!, desc: `${moves.nex.desc} Variants: ${moves.sex.name}, ${moves.dex.name}, ${moves.aex.name}.` },
      { key: 'U · Awaken', name: moves.naw.name!, desc: `${moves.naw.desc} Variants: ${moves.saw.name}, ${moves.daw.name}, ${moves.aaw.name}.` },
      { key: 'U → K · Awakened', name: moves.nfu.name!, desc: `${moves.nfu.desc} Follow-ups: ${moves.sfu.name}, ${moves.dfu.name}, ${moves.afu.name}.` },
      { key: 'R · ULTIMATE', name: moves.ult.name!, desc: moves.ult.desc || '' },
    ],
    ai: {
      horizSpec: 'sspec',
      zoneSpec: nsrc.ai.zoneSpec === 'nspec' ? 'nspec' : undefined,
      vertSpec: dsrc.ai.vertSpec === 'dspec' ? 'dspec' : undefined,
      counterSpec: moves.dspec.counter ? 'dspec' : undefined,
      ultRange: usrc.ai.ultRange,
    },
  };
}

/** Rebuilds all custom fighters into the live roster. */
export function registerCustoms() {
  for (let i = CHARACTERS.length - 1; i >= 0; i--) if (CHARACTERS[i].tier === 'OC') CHARACTERS.splice(i, 1);
  for (const cfg of loadCustomCfgs()) {
    try { CHARACTERS.push(buildCustom(cfg)); } catch { /* skip broken config */ }
  }
}

export function saveCustom(cfg: CustomCfg) {
  const list = loadCustomCfgs();
  const i = list.findIndex((c) => c.id === cfg.id);
  if (i >= 0) list[i] = cfg; else list.push(cfg);
  persist(list);
  registerCustoms();
}

export function deleteCustom(id: string) {
  persist(loadCustomCfgs().filter((c) => c.id !== id));
  registerCustoms();
}

export function newCustomCfg(): CustomCfg {
  return {
    id: 'oc_' + Math.random().toString(36).slice(2, 9),
    name: 'Kaito Arashi', title: 'The Wandering Blade', origin: 'Original Character',
    bio: 'A drifter swordsman searching for worthy opponents.', color: '#ff4fa3',
    look: {
      skin: '#f3d6bd', hair: '#2a2a3a', hair2: undefined, hairStyle: 'spikeLong',
      top: '#2a2438', top2: '#ff4fa3', sleeve: '#2a2438', fore: '#f3d6bd', pants: '#1c1c28', boots: '#15151d',
      cape: '#3a1f48', capeLen: 38, eye: '#ff4fa3', weapon: 'katana', mark: 'none',
      energy: '#ff4fa3', energy2: '#ffd0ea', ninjaRun: true,
    },
    bars: { power: 4, speed: 4, range: 3, defense: 3 }, size: 0.95,
    style: 'tanjiro', nspec: 'ichigo', sspec: 'sasuke', dspec: 'killua', ult: 'gojo',
  };
}
