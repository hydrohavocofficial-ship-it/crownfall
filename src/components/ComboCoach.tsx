import { useEffect, useState, type RefObject } from 'react';
import type { Game } from '../game/game';
import { keyLabel, type Bindings } from '../game/input';
import { CHAIN_ACTIONS, chainWindow } from '../game/moveCatalog';
import type { MoveKey } from '../game/characters';

export default function ComboCoach({ gameRef, bindings }: { gameRef: RefObject<Game | null>; bindings: Bindings }) {
  const [open, setOpen] = useState(true);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => refresh((n) => n + 1), 80);
    return () => window.clearInterval(timer);
  }, [open]);
  const g = gameRef.current, f = g?.fighters[0], move = f?.move;
  const cancelWindow = move ? chainWindow(move) : [0, 1];
  const hitReady = !move?.chains?.onHitOnly || !!f && f.moveConnected;
  const inWindow = !!f && !!move?.chains && f.moveFrame >= cancelWindow[0] && f.moveFrame <= cancelWindow[1];
  const options = move?.chains ? CHAIN_ACTIONS.flatMap((action) => {
    const key = move.chains![action] as MoveKey | undefined;
    const next = key && f?.def.moves[key];
    return next ? [{ key: key!, label: keyLabel(bindings[action][0]), name: next.name, ready: (f?.cds[key!] ?? 0) <= 0 }] : [];
  }) : [];
  return <aside className="absolute top-14 right-3 z-10 w-[min(310px,42vw)] rounded border border-white/15 bg-[#080b14]/90 shadow-xl text-white">
    <button onClick={() => setOpen(!open)} className="w-full flex justify-between px-3 py-2 cursor-pointer text-[11px] font-bold tracking-widest text-cyan-200" aria-expanded={open}>COMBO COACH <span>{open ? '−' : '+'}</span></button>
    {open && <div className="px-3 pb-3 text-xs">
      <div className="font-display text-lg truncate">{move?.name || (f?.awakened ? 'Awakened' : 'Start a string')}</div>
      {move ? <>
        <div className="h-1 bg-white/15 my-2"><div className="h-full transition-[width] duration-75" style={{ width: `${Math.min(100, (f!.moveFrame / move.dur) * 100)}%`, background: inWindow && hitReady ? '#67edbb' : '#d39eff' }} /></div>
        <div className={inWindow && hitReady ? 'text-emerald-300' : 'text-white/55'}>
          {!options.length ? 'Finish this move, then start another.'
              : !hitReady ? 'Connect the hit to unlock the follow-up.'
                : f!.moveFrame < cancelWindow[0] ? 'Wait for the follow-up window…'
                  : inWindow ? 'PRESS NEXT KEY NOW' : 'Window closed — let the move finish.'}
        </div>
        {options.map((option) => <div key={option.key} className="flex gap-2 mt-1 items-baseline"><kbd className="bg-white/10 border border-white/20 min-w-5 text-center rounded">{option.label}</kbd><span className={option.ready ? 'text-white/80' : 'text-white/35'}>{option.name}{option.ready ? '' : ' · cooling down'}</span></div>)}
      </> : <p className="text-white/60">Tap {keyLabel(bindings.light[0])}, release, tap it again during the move. Fill your gauge and press {keyLabel(bindings.awaken[0])} for a whole second moveset.</p>}
      {f?.awakened && <p className="text-violet-300/90 mt-2">Awakened: {keyLabel(bindings.light[0])} {f.def.moves.nwl?.name} · {keyLabel(bindings.heavy[0])} {f.def.moves.nwh?.name} · {keyLabel(bindings.special[0])} {f.def.moves.nfu?.name}</p>}
      {!!f?.def.moves.boss_finisher && <p className="text-amber-200/80 mt-2">Boss finisher: {keyLabel(bindings.heavy[0])} confirms into {f.def.moves.boss_heavy2?.name}, and {keyLabel(bindings.special[0])} <b>while Awakened</b> is {f.def.moves.boss_finisher.name}.</p>}
      <div className="mt-2 border-t border-white/10 pt-2 text-[10px] text-white/40">{f?.recentMoves.filter((entry) => g!.frame - entry.frame < 240).map((entry) => entry.name).join(' → ') || 'Your last four moves appear here.'}</div>
    </div>}
  </aside>;
}

