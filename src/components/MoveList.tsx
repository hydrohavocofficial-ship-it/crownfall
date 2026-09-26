import { useState } from 'react';
import type { CharDef } from '../game/characters';
import type { Bindings } from '../game/input';
import { moveCatalog, chainWindow } from '../game/moveCatalog';

export default function MoveList({ character, bindings }: { character: CharDef; bindings: Bindings }) {
  const [query, setQuery] = useState('');
  const [chainsOnly, setChainsOnly] = useState(false);
  const all = moveCatalog(character, bindings);
  const moves = all.filter((entry) => (!chainsOnly || entry.chain) && `${entry.move.name} ${entry.input} ${entry.stance}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="mt-4 border-t border-white/15 pt-4">
    <div className="flex justify-between items-center gap-2"><h3 className="font-display text-2xl">COMPLETE MOVE LIBRARY</h3><span className="text-xs text-cyan-200">{all.length} reachable moves</span></div>
    <p className="text-xs text-white/60 my-2">Arrows between keys mean press, release, then press the next key. Stance is held when starting the sequence. Follow-ups keep the opening stance.</p>
    <input aria-label="Search moves" placeholder="Search a move, key, or stance…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-white/5 border border-white/20 px-3 py-2 text-sm mb-2" />
    <label className="flex gap-2 text-xs text-white/70 mb-3"><input type="checkbox" checked={chainsOnly} onChange={(e) => setChainsOnly(e.target.checked)} /> Combo-only moves</label>
    <div className="space-y-2">
      {moves.map(({ key, move, input, stance, chain }) => <article key={key} className="bg-black/40 p-3 border-l-2" style={{ borderColor: character.color }}>
        <div className="flex flex-wrap items-baseline justify-between gap-1"><b className="text-white">{move.name}</b><code className="text-sm text-amber-200">{input}</code></div>
        <div className="uppercase tracking-wider text-[10px] text-cyan-200">{stance} · {chain ? 'Combo unlock' : key === 'ult' ? '100% meter' : 'Direct input'}</div>
        <p className="text-xs text-white/70 mt-1">{move.desc || `${move.anim} attack${move.hits.some((h) => h.pull) ? ' that draws opponents inward' : ''}. ${move.hits.length > 1 ? 'Multiple strike stages.' : ''}`}</p>
        <div className="text-[10px] text-white/45 mt-1">Startup {move.startup}f · Duration {move.dur}f{move.cd ? ` · Cooldown ${(move.cd / 60).toFixed(1)}s` : ''}{move.chains ? ` · Follow-up ${chainWindow(move).join('–')}f${move.chains.onHitOnly ? ' · Must connect first' : ''}` : ''}</div>
      </article>)}
      {!moves.length && <p className="text-sm text-white/60">No moves match this filter.</p>}
    </div>
  </section>;
}
