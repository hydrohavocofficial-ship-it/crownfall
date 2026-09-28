import { useEffect, useState } from 'react';
import { MatchConfig } from '../game/types';
import { charById } from '../game/characters';
import { arenaById } from '../game/arenas';
import { preloadAll, FIGHTER_COLORS } from '../game/game';

const TIPS = [
  'Dodge toward the stage while recovering — it refreshes when you get hit!',
  'Cling to walls by holding toward them in the air, then jump to climb.',
  'Heavy attacks in the air: Neutral = Recovery, Down = Ground Pound.',
  'Lights are for combos; Heavies are for knockouts. Higher damage = further knockback.',
  'Your Awakening gauge fills by dealing and taking damage — slowly, on purpose.',
  'Press Down on a soft platform to drop through it. Press Down in the air to fast-fall.',
  "Asta's Anti-Magic Reflect sends projectiles back at their owner!",
  "Killua's Counter teleports him behind the attacker — don't swing blindly.",
];

export default function LoadingScreen({ cfg, onDone }: { cfg: MatchConfig; onDone: () => void }) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const arena = arenaById(cfg.arena);
  const fighters = [cfg.player, ...cfg.cpus.map((c) => c.char)].map((id) => charById(id));
  useEffect(() => {
    let done = false;
    const t0 = performance.now();
    preloadAll().then(() => {
      const wait = Math.max(0, 1800 - (performance.now() - t0));
      setTimeout(() => { if (!done) onDone(); }, wait);
    });
    return () => { done = true; };
  }, []);
  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      <img src={arena.bg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 anim-slowzoom" />
      <div className="absolute inset-0 speedlines" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-8">
        <div className="flex items-center gap-4">
          {fighters.map((f, i) => (
            <div key={i} className="flex items-center gap-4">
              {i > 0 && <span className="font-display text-6xl text-[#ffb52e] text-shadow-hard anim-pop" style={{ animationDelay: `${i * 0.15}s` }}>VS</span>}
              <div className="anim-pop relative w-[14vw] max-w-[220px] aspect-[3/4] skew-panel overflow-hidden border-4" style={{ borderColor: FIGHTER_COLORS[i], animationDelay: `${i * 0.15}s`, boxShadow: `8px 8px 0 #000, 0 0 30px ${FIGHTER_COLORS[i]}88` }}>
                <img src={f.portrait} alt="" className="unskew absolute inset-0 w-full h-full object-cover scale-125" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent pt-8 pb-2 text-center unskew">
                  <div className="font-display text-xl leading-none">{f.name.toUpperCase()}</div>
                  <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: FIGHTER_COLORS[i] }}>{i === 0 ? 'PLAYER 1' : cfg.mode === 'training' ? 'DUMMY' : `CPU ${i} · ${cfg.cpus[i - 1].diff.toUpperCase()}`}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <div className="text-[#ffb52e] font-bold tracking-[0.4em] text-sm">{arena.subtitle.toUpperCase()}</div>
          <div className="font-display text-5xl text-shadow-hard">{arena.name.toUpperCase()}</div>
        </div>
        <div className="w-[40vw] h-3 bg-white/10 skew-panel overflow-hidden border border-black">
          <div className="h-full bg-gradient-to-r from-[#ff4757] to-[#ffb52e]" style={{ animation: 'loadbar 1.8s ease-out forwards' }} />
        </div>
        <div className="max-w-xl text-center text-white/70 font-semibold"><span className="text-[#ffb52e] font-bold">TIP: </span>{tip}</div>
      </div>
    </div>
  );
}
