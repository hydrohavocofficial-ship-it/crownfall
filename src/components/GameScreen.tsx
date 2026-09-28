import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/game';
import { Bindings, keyLabel } from '../game/input';
import { DummyMode, MatchConfig, MatchResult } from '../game/types';
import { Btn } from './ui';
import { sfx } from '../game/audio';
import ComboCoach from './ComboCoach';
import { customSettings, TEAM_NAMES } from '../game/matchConfig';

interface Props { cfg: MatchConfig; bindings: Bindings; tapJump: boolean; onEnd: (r: MatchResult) => void; onQuit: () => void; }

const DUMMY_MODES: { id: DummyMode; label: string }[] = [
  { id: 'stand', label: 'STAND' }, { id: 'move', label: 'WALK' }, { id: 'jump', label: 'JUMP' }, { id: 'dodge', label: 'DODGE' }, { id: 'cpu', label: 'FIGHT BACK' },
];

export default function GameScreen({ cfg, bindings, tapJump, onEnd, onQuit }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [paused, setPaused] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [tr, setTr] = useState({ mode: 'stand' as DummyMode, lock: null as number | null, hit: false, meter: true, panel: true });
  const training = cfg.rule === 'training';

  useEffect(() => {
    if (!ref.current) return;
    const g = new Game(ref.current, cfg, {
      bindings, tapJump,
      onEnd: (r) => onEnd(r),
      onPauseKey: () => setPaused((p) => !p),
    });
    gameRef.current = g;
    if (training) { g.dummyMode = tr.mode; g.lockDamage = tr.lock; g.showHitboxes = tr.hit; g.infiniteMeter = tr.meter; }
    g.start();
    const onR = () => g.resize();
    window.addEventListener('resize', onR);
    setPaused(false);
    return () => { g.stop(); window.removeEventListener('resize', onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => { gameRef.current?.setPaused(paused); if (paused) sfx('back'); }, [paused]);
  useEffect(() => {
    const g = gameRef.current; if (!g || !training) return;
    g.dummyMode = tr.mode; g.lockDamage = tr.lock; g.showHitboxes = tr.hit; g.infiniteMeter = tr.meter;
  }, [tr, training]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'KeyT' && training) setTr((t) => ({ ...t, panel: !t.panel })); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [training]);

  const k = (a: keyof Bindings) => keyLabel(bindings[a][0]);
  const g0 = gameRef.current;

  return (
    <div className="absolute inset-0 bg-black">
      <canvas ref={ref} className="w-full h-full block" />
      <ComboCoach gameRef={gameRef} bindings={bindings} />
      {!paused && <button aria-label="Pause match" onClick={() => setPaused(true)} className="absolute right-3 top-3 z-10 bg-black/70 border border-white/30 px-4 py-2 text-sm font-bold rounded">Ⅱ PAUSE</button>}
      {cfg.mode === 'custom' && !paused && <div className="absolute left-3 top-3 pointer-events-none max-w-[32%] bg-black/70 rounded px-3 py-2 text-xs text-white/80">
        <b className="text-[#2dd4bf]">{customSettings(cfg).teams ? 'TEAM BATTLE' : 'FREE-FOR-ALL'}</b><br />
        {customSettings(cfg).teams && <>P1 · {TEAM_NAMES[customSettings(cfg).fighters[0].team]} · FF {customSettings(cfg).friendlyFire ? 'ON' : 'OFF'}<br /></>}
        {customSettings(cfg).damageMode === 'stamina' ? 'STAMINA / HP' : 'DAMAGE %'}
      </div>}

      {training && tr.panel && !paused && (
        <div className="absolute left-4 top-4 w-72 bg-black/75 border-l-4 border-[#b067ff] p-3 backdrop-blur-sm anim-fade-up">
          <div className="flex justify-between items-center mb-2">
            <div className="font-display text-2xl text-[#b067ff]">TRAINING</div>
            <span className="text-[10px] text-white/50 font-bold">[T] HIDE</span>
          </div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-white/50 mb-1">DUMMY BEHAVIOUR</div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {DUMMY_MODES.map((m) => (
              <button key={m.id} onClick={() => setTr({ ...tr, mode: m.id })} className={`text-[11px] font-bold py-1 border cursor-pointer ${tr.mode === m.id ? 'bg-[#b067ff] border-[#b067ff] text-black' : 'border-white/20 hover:bg-white/10'}`}>{m.label}</button>
            ))}
          </div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-white/50 mb-1">LOCK DUMMY DAMAGE</div>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {[null, 0, 50, 100, 150].map((v) => (
              <button key={String(v)} onClick={() => setTr({ ...tr, lock: v })} className={`text-[11px] font-bold py-1 border cursor-pointer ${tr.lock === v ? 'bg-[#ffb52e] border-[#ffb52e] text-black' : 'border-white/20 hover:bg-white/10'}`}>{v === null ? 'OFF' : v}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={tr.hit} onChange={(e) => setTr({ ...tr, hit: e.target.checked })} /> Show hitboxes</label>
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={tr.meter} onChange={(e) => setTr({ ...tr, meter: e.target.checked })} /> Infinite Awakening gauge</label>
          <button onClick={() => { gameRef.current?.resetPositions(); sfx('confirm'); }} className="mt-2 w-full bg-white/10 hover:bg-white/20 py-1 font-bold text-sm cursor-pointer border border-white/20">↺ RESET POSITIONS</button>
          <div className="mt-2 text-[11px] text-white/60 leading-tight font-semibold">
            Move {k('left')}/{k('right')} · Jump {k('jump')} · Light {k('light')} · Heavy {k('heavy')} · Dodge {k('dodge')} · Special {k('special')} · Awaken {k('awaken')} (then {k('light')}/{k('heavy')}/{k('special')} are a new moveset) · Aim {k('up')}/{k('down')}
          </div>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="absolute inset-0 speedlines opacity-40" />
          <div className="relative anim-pop flex flex-col items-center gap-4">
            <h2 className="font-display text-8xl text-shadow-hard mb-4">PAUSED</h2>
            <Btn big onClick={() => setPaused(false)} color="#44e07a">▶ RESUME</Btn>
            <Btn big onClick={() => setRunKey((v) => v + 1)} color="#ffb52e">↺ RESTART</Btn>
            <Btn big onClick={onQuit} color="#ff4757">✕ QUIT MATCH</Btn>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-1 text-sm font-semibold text-white/70 bg-black/60 p-4 border border-white/10">
              <span>Move: <b className="text-white">{k('left')} {k('right')}</b></span>
              <span>Jump: <b className="text-white">{k('jump')}</b></span>
              <span>Light: <b className="text-white">{k('light')}</b></span>
              <span>Heavy: <b className="text-white">{k('heavy')}</b></span>
              <span>Dodge/Dash: <b className="text-white">{k('dodge')}</b></span>
              <span>Special: <b className="text-white">{k('special')}</b></span>
              <span>Awaken: <b className="text-white">{k('awaken')}</b></span>
              <span>Awakened: <b className="text-white">{k('light')} / {k('heavy')} / {k('special')}</b></span>
              <span>Pause: <b className="text-white">{k('pause')}</b></span>
            </div>
            {g0?.faults ? <div className="mt-2 text-xs text-amber-300/80">The match hit {g0.faults} frame fault{g0.faults === 1 ? '' : 's'} and kept running — see the console for detail.</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
