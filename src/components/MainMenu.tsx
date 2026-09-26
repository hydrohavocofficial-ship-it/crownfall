import { useEffect, useState } from 'react';
import { ScreenBG } from './ui';
import { CHARACTERS } from '../game/characters';
import { sfx, unlockAudio } from '../game/audio';

interface Props { onPlay: () => void; onTraining: () => void; onControls: () => void; onHowTo: () => void; onBuilder: () => void; }

export default function MainMenu({ onPlay, onTraining, onControls, onHowTo, onBuilder }: Props) {
  const [hover, setHover] = useState(0);
  const [started, setStarted] = useState(false);
  const items = [
    { label: 'BATTLE', sub: '1v1 · Teams · Custom Rules · Free-for-All', act: onPlay, color: '#ff4757' },
    { label: 'TRAINING', sub: 'Practice combos against a dummy', act: onTraining, color: '#3fa9ff' },
    { label: 'CHARACTER CREATOR', sub: 'Design and battle your own fighter', act: onBuilder, color: '#ff4fa3' },
    { label: 'CONTROLS & SETTINGS', sub: 'Key bindings, gamepad, audio', act: onControls, color: '#ffb52e' },
    { label: 'HOW TO PLAY', sub: 'Mechanics & move list', act: onHowTo, color: '#44e07a' },
  ];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!started) { unlockAudio(); setStarted(true); sfx('confirm'); return; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { setHover((v) => (v + 1) % items.length); sfx('select'); }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { setHover((v) => (v + items.length - 1) % items.length); sfx('select'); }
      if (e.code === 'Enter' || e.code === 'Space') { sfx('confirm'); items[hover].act(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="absolute inset-0" onClick={() => { if (!started) { unlockAudio(); setStarted(true); sfx('confirm'); } }}>
      <ScreenBG dim={0.45} />
      {/* character strip */}
      <div className="absolute right-0 top-0 bottom-0 w-[52%] flex items-end justify-end pointer-events-none overflow-hidden">
        {CHARACTERS.slice(0, 5).map((c, i) => (
          <div key={c.id} className="absolute bottom-0 h-full w-[34%] anim-fade-up" style={{ right: `${i * 16 - 4}%`, animationDelay: `${0.1 + i * 0.08}s`, zIndex: 5 - Math.abs(i - 2) }}>
            <div className="absolute inset-0 skew-panel overflow-hidden border-l-4" style={{ borderColor: c.color }}>
              <img src={c.portrait} alt="" className="absolute inset-0 w-full h-full object-cover unskew scale-125 opacity-80" style={{ filter: 'saturate(1.15)' }} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 40%, ${c.color}55 80%, #000 100%)` }} />
            </div>
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-[#07070d] via-[#07070d]/40 to-transparent" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center pl-[7vw]">
        <div className="anim-pop mb-2">
          <div className="font-display text-[1.6vw] text-[#ffb52e] tracking-[0.4em] text-shadow-hard">ANIME PLATFORM FIGHTER</div>
          <h1 className="font-display leading-[0.85] text-[9vw] text-shadow-hard" style={{ background: 'linear-gradient(180deg,#fff 30%,#ffb52e 60%,#ff4757 100%)', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextStroke: '3px #000', filter: 'drop-shadow(6px 6px 0 #000)' }}>
            SHŌNEN<br />BRAWL
          </h1>
        </div>
        {!started ? (
          <div className="mt-10 font-display text-3xl tracking-widest animate-pulse text-shadow-hard">PRESS ANY KEY TO START</div>
        ) : (
          <div className="mt-8 flex flex-col gap-3 w-[min(520px,40vw)]">
            {items.map((it, i) => (
              <button key={it.label}
                onMouseEnter={() => { setHover(i); sfx('select'); }}
                onClick={() => { sfx('confirm'); it.act(); }}
                className="anim-slide-l relative skew-panel text-left overflow-hidden cursor-pointer transition-all duration-150 border-2 border-black"
                style={{ animationDelay: `${i * 0.07}s`, background: hover === i ? `linear-gradient(90deg, ${it.color}, ${it.color}66)` : 'rgba(10,10,20,0.75)', transform: `skewX(-12deg) translateX(${hover === i ? 24 : 0}px)`, boxShadow: hover === i ? `6px 6px 0 #000, 0 0 30px ${it.color}88` : '4px 4px 0 #000' }}>
                <div className="unskew px-6 py-2.5">
                  <div className="font-display text-3xl tracking-wider text-shadow-hard">{it.label}</div>
                  <div className="text-sm font-semibold text-white/70 -mt-1">{it.sub}</div>
                </div>
                {hover === i && <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-3xl unskew">▶</span>}
              </button>
            ))}
          </div>
        )}
        <div className="absolute bottom-5 left-[7vw] text-white/40 text-sm font-semibold">
          Fan-made tribute · {CHARACTERS.length} fighters · 4 arenas · Keyboard & Gamepad supported
        </div>
      </div>
    </div>
  );
}
