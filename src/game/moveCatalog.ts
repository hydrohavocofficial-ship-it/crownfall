import type { CharDef, MoveKey } from './characters';
import type { MoveDef, InputKey } from './types';
import { keyLabel, type Bindings } from './input';

export type ChainAction = 'light' | 'heavy' | 'special' | 'awaken';
export const CHAIN_ACTIONS: ChainAction[] = ['light', 'heavy', 'special', 'awaken'];
export interface MoveCommand { key: MoveKey; move: MoveDef; input: string; stance: string; chain: boolean; }

/** Traverse the same explicit move graph the controller executes. No invented recipes. */
export function moveCatalog(character: CharDef, bindings: Bindings): MoveCommand[] {
  const k = (action: InputKey) => keyLabel(bindings[action][0]);
  const roots: [MoveKey, InputKey, string][] = [
    ['nlight', 'light', 'Neutral'], ['slight', 'light', 'Side'], ['dlight', 'light', 'Down'],
    ['nair', 'light', 'Air'], ['sair', 'light', 'Air + side'], ['dair', 'light', 'Air + down'],
    ['nsig', 'heavy', 'Neutral'], ['ssig', 'heavy', 'Side'], ['dsig', 'heavy', 'Down'],
    ['rec', 'heavy', character.moves.aig ? 'Air + up' : 'Air'], ['gp', 'heavy', 'Air + down'],
    ['aig', 'heavy', 'Air'], ['nspec', 'special', 'Neutral'], ['sspec', 'special', 'Side'],
    ['dspec', 'special', 'Down'], ['aspec', 'special', 'Air'],
    ['naw', 'awaken', 'Neutral'], ['saw', 'awaken', 'Side'], ['daw', 'awaken', 'Down'], ['aaw', 'awaken', 'Air'],
    // The awakened kit. Gated on a full gauge, like the transformation itself.
    ['nwl', 'light', 'AWAKENED · Neutral'], ['swl', 'light', 'AWAKENED · Side'],
    ['dwl', 'light', 'AWAKENED · Down'], ['awl', 'light', 'AWAKENED · Air'],
    ['nwh', 'heavy', 'AWAKENED · Neutral'], ['swh', 'heavy', 'AWAKENED · Side'],
    ['dwh', 'heavy', 'AWAKENED · Down'], ['awh', 'heavy', 'AWAKENED · Air'],
    ['nfu', 'special', 'AWAKENED · Neutral'], ['sfu', 'special', 'AWAKENED · Side'],
    ['dfu', 'special', 'AWAKENED · Down'], ['afu', 'special', 'AWAKENED · Air'],
  ];
  const result: MoveCommand[] = [];
  const seen = new Set<string>();
  for (const [key, action, stance] of roots) {
    const move = character.moves[key];
    if (move) { seen.add(key); result.push({ key, move, input: k(action), stance, chain: false }); }
  }
  for (let i = 0; i < result.length; i++) {
    const entry = result[i];
    for (const action of CHAIN_ACTIONS) {
      const key = entry.move.chains?.[action] as MoveKey | undefined;
      if (!key || seen.has(key) || !character.moves[key]) continue;
      seen.add(key);
      result.push({ key, move: character.moves[key]!, input: `${entry.input} → ${k(action)}`, stance: entry.stance, chain: true });
    }
  }
  return result;
}

export function chainWindow(move: MoveDef): [number, number] {
  return move.chains?.window || [Math.max(1, move.startup - 1), move.dur - 1];
}
