import { useEffect, useRef, useState } from 'react';
import { Game, PreviewAction, PreviewRequest, PreviewStance } from '../game/game';
import { charById } from '../game/characters';
import { DEFAULT_BINDINGS } from '../game/input';
import { sfx } from '../game/audio';

const ACTIONS: { id: PreviewAction; key: string; label: string }[] = [
  { id: 'light', key: 'H', label: 'LIGHT' },
  { id: 'heavy', key: 'J', label: 'HEAVY' },
  { id: 'special', key: 'K', label: 'SPECIAL' },
  { id: 'limit', key: 'L', label: 'LIMIT' },
  { id: 'awaken', key: 'U', label: 'AWAKEN' },
  { id: 'ult', key: 'R', label: 'ULT' },
];
const STANCES: { id: PreviewStance; label: string }[] = [
  { id: 'neutral', label: 'STAND' }, { id: 'side', label: 'FORWARD' }, { id: 'down', label: 'DOWN' }, { id: 'air', label: 'AERIAL' },
];

export default function Preview({ charId, color }: { charId: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const autoRef = useRef(true);
  const [label, setLabel] = useState('INITIALISING LIVE SIMULATION');
  const [action, setAction] = useState<PreviewAction>('awaken');
  const [stance, setStance] = useState<PreviewStance>('neutral');
  const [followup, setFollowup] = useState(true);
  const [auto, setAuto] = useState(true);
  const char = charById(charId);

  useEffect(() => {
    if (!ref.current) return;
    const game = new Game(ref.current, { mode: 'training', rule: 'training', stocks: 1, time: 1, arena: 'rooftops', player: charId, cpus: [] }, { bindings: DEFAULT_BINDINGS, tapJump: false, preview: charId });
    gameRef.current = game;
    game.start();
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(ref.current);
    const labelTimer = window.setInterval(() => setLabel(game.previewLabel()), 90);

    const counter = (['sspec', 'dspec', 'nspec'] as const).find((key) => char.moves[key].counter);
    const showcase: PreviewRequest[] = [
      { action: 'awaken', stance: 'neutral', followup: true },
      { action: 'limit', stance: 'side' },
      { action: 'light', stance: 'neutral' },
      ...(counter ? [{ action: 'special' as PreviewAction, stance: (counter === 'dspec' ? 'down' : counter === 'sspec' ? 'side' : 'neutral') as PreviewStance }] : []),
      { action: 'special', stance: 'neutral' },
      { action: 'awaken', stance: 'air', followup: true },
      { action: 'limit', stance: 'down' },
      { action: 'ult', stance: 'neutral' },
    ];
    game.queuePreview(showcase[0]);
    let autoIndex = 1;
    const autoTimer = window.setInterval(() => {
      if (!autoRef.current) return;
      game.queuePreview(showcase[autoIndex % showcase.length]);
      autoIndex++;
    }, 3900);

    return () => {
      window.clearInterval(labelTimer); window.clearInterval(autoTimer); window.removeEventListener('resize', onResize); observer.disconnect(); game.stop();
      gameRef.current = null;
    };
  }, [charId]);

  useEffect(() => {
    gameRef.current?.queuePreview({ action, stance, followup: (action === 'awaken' || action === 'heavy') && followup });
  }, [action, stance, followup, charId]);

  const play = (request: PreviewRequest) => {
    autoRef.current = false; setAuto(false);
    gameRef.current?.queuePreview(request);
    sfx('select');
  };

  return (
    <div className="relative w-full h-full min-h-[280px] overflow-hidden bg-[#090811]">
      <canvas ref={ref} className="w-full h-full block" />
      <div className="absolute left-2 top-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
        <div className="max-w-[78%] skew-panel px-3 py-1 border border-black shadow-[3px_3px_0_#000]" style={{ background: color }}>
          <span className="unskew block font-display text-sm sm:text-lg tracking-wide text-shadow-hard truncate">{label}</span>
        </div>
        <div className="bg-black/75 px-2 py-1 text-[9px] font-black tracking-[.2em] text-[#b9ff9a] border border-white/10">LIVE DAMAGE SIM</div>
      </div>

      <div className="absolute inset-x-2 bottom-2 bg-black/82 border border-white/15 p-2 backdrop-blur-sm">
        <div className="grid grid-cols-6 gap-1 mb-1.5">
          {ACTIONS.map((item) => (
            <button key={item.id} onClick={() => { setAction(item.id); autoRef.current = false; setAuto(false); }}
              className={`cursor-pointer border px-1 py-1 text-[9px] font-black tracking-tight transition ${action === item.id ? 'text-black scale-[1.04]' : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/15'}`}
              style={action === item.id ? { background: item.id === 'limit' ? '#ffb52e' : item.id === 'awaken' ? '#b067ff' : color, borderColor: '#fff' } : undefined}>
              <span className="block text-[11px] leading-none">{item.key}</span>{item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 mb-1.5">
          {STANCES.map((item) => (
            <button key={item.id} onClick={() => { setStance(item.id); autoRef.current = false; setAuto(false); }}
              className={`cursor-pointer border px-1 py-1 text-[9px] font-bold transition ${stance === item.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/15 text-white/65 hover:bg-white/15'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-[9px] font-bold tracking-wider">
          <button onClick={() => play({ action, stance, followup: (action === 'awaken' || action === 'heavy') && followup })} className="px-2 py-1 bg-[#44e07a] text-black cursor-pointer">▶ REPLAY</button>
          {(action === 'awaken' || action === 'heavy' && stance === 'neutral' && char.moves.boss_heavy2) && (
            <button onClick={() => setFollowup((v) => !v)} className={`px-2 py-1 border cursor-pointer ${followup ? 'border-[#b067ff] bg-[#b067ff] text-white' : 'border-white/20 text-white/60'}`}>{action === 'awaken' ? 'U → K' : 'J → J → L'} {followup ? 'ON' : 'OFF'}</button>
          )}
          <button onClick={() => { const next = !auto; autoRef.current = next; setAuto(next); }} className={`px-2 py-1 border cursor-pointer ${auto ? 'border-[#ffb52e] text-[#ffb52e]' : 'border-white/20 text-white/50'}`}>AUTO {auto ? 'ON' : 'OFF'}</button>
        </div>
        <div className="mt-1 text-[8px] leading-tight text-white/45">Close moves auto-place the dummy in hit range. Counters stage a real incoming dummy attack or projectile.</div>
      </div>
    </div>
  );
}
