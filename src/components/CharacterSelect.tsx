import { useEffect, useState } from 'react';
import { CHARACTERS, charById, shortName } from '../game/characters';
import { Difficulty, MatchConfig } from '../game/types';
import { Btn, Header, ScreenBG, StatBar } from './ui';
import Preview from './Preview';
import { sfx } from '../game/audio';
import { FIGHTER_COLORS } from '../game/game';

interface Props { cfg: MatchConfig; setCfg: (c: MatchConfig) => void; onNext: () => void; onBack: () => void; }
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const DCOL: Record<Difficulty, string> = { easy: '#44e07a', medium: '#ffb52e', hard: '#ff4757' };

export default function CharacterSelect({ cfg, setCfg, onNext, onBack }: Props) {
  const [focus, setFocus] = useState(cfg.player);
  const c = charById(focus);
  const training = cfg.mode === 'training';
  const minC = 1, maxC = cfg.mode === '1v1' || training ? 1 : 3;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, select, textarea, button')) return;
      const i = CHARACTERS.findIndex((x) => x.id === focus);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { const n = CHARACTERS[(i + 1) % CHARACTERS.length].id; setFocus(n); setCfg({ ...cfg, player: n }); sfx('select'); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { const n = CHARACTERS[(i + CHARACTERS.length - 1) % CHARACTERS.length].id; setFocus(n); setCfg({ ...cfg, player: n }); sfx('select'); }
      if (e.code === 'Enter') { sfx('confirm'); onNext(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  const pick = (id: string) => { setFocus(id); setCfg({ ...cfg, player: id }); sfx('confirm'); };
  const setCpu = (i: number, patch: Partial<MatchConfig['cpus'][0]>) => {
    const cpus = cfg.cpus.map((x, j) => (j === i ? { ...x, ...patch } : x)); setCfg({ ...cfg, cpus });
  };
  const cycleCpu = (i: number, d: number) => {
    const idx = CHARACTERS.findIndex((x) => x.id === cfg.cpus[i].char);
    setCpu(i, { char: CHARACTERS[(idx + d + CHARACTERS.length) % CHARACTERS.length].id }); sfx('select');
  };
  const addCpu = () => {
    if (cfg.cpus.length >= maxC) return;
    const used = new Set([cfg.player, ...cfg.cpus.map((x) => x.char)]);
    const ch = CHARACTERS.find((x) => !used.has(x.id)) || CHARACTERS[0];
    setCfg({ ...cfg, cpus: [...cfg.cpus, { char: ch.id, diff: cfg.cpus[0]?.diff || 'medium' }] });
  };
  const removeCpu = () => { if (cfg.cpus.length > minC) setCfg({ ...cfg, cpus: cfg.cpus.slice(0, -1) }); };
  const randomAll = () => {
    const r = () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
    const p = r(); setFocus(p);
    setCfg({ ...cfg, player: p, cpus: cfg.cpus.map((x) => ({ ...x, char: r() })) });
  };

  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.82} img={c.portrait} />
      <Header title="CHOOSE YOUR FIGHTER" subtitle={training ? 'Training Mode' : cfg.mode.toUpperCase()} onBack={onBack} />
      <div className="relative z-10 flex flex-col lg:flex-row gap-6 px-4 lg:px-8 pt-5 h-[calc(100%-100px)] overflow-y-auto">
        {/* left: big info */}
        <div className="flex-[1.35] flex flex-col gap-4 min-w-0 shrink-0 min-h-[600px] lg:min-h-0">
          <div className="flex gap-5 h-[44%] min-h-[255px] shrink-0">
            <div key={c.id} className="anim-pop relative w-[38%] skew-panel overflow-hidden border-4 border-black" style={{ boxShadow: `8px 8px 0 #000, 0 0 40px ${c.color}66` }}>
              <img src={c.portrait} alt={c.name} className="unskew absolute inset-0 w-full h-full object-cover scale-[1.25]" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 55%, ${c.color}cc 100%)` }} />
            </div>
            <div key={c.id + 'i'} className="flex-1 anim-fade-up flex flex-col justify-center min-w-0">
              <div className="text-sm font-bold tracking-[0.35em]" style={{ color: c.color }}>{c.anime.toUpperCase()}</div>
              <h2 className="font-display text-[clamp(24px,3vw,44px)] leading-none text-shadow-hard">{c.name.toUpperCase()}</h2>
              <div className="font-display text-xl text-white/80 tracking-wider mb-2">{c.title}</div>
              <p className="text-white/80 font-semibold leading-snug mb-3 text-[14px]">{c.desc}</p>
              <div className="flex flex-col gap-1.5">
                <StatBar label="POWER" value={c.statBars.power} color={c.color} />
                <StatBar label="SPEED" value={c.statBars.speed} color={c.color} />
                <StatBar label="RANGE" value={c.statBars.range} color={c.color} />
                <StatBar label="DEFENSE" value={c.statBars.defense} color={c.color} />
              </div>
            </div>
          </div>
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
              <div className="text-xs font-bold tracking-[0.25em] text-[#ffb52e] flex items-center gap-2">
                <span>⚡ MOVE VARIANTS & COMMAND CHAINS</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {c.moveBranches.map((b) => (
                  <div key={b.input} className="bg-black/60 border-l-4 px-3 py-1.5" style={{ borderColor: c.color }}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-display text-lg text-white">{b.name}</span>
                      <span className="text-[10px] font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded text-[#ffb52e]">{b.input}</span>
                    </div>
                    <div className="text-[12px] text-white/70 font-semibold leading-tight mt-0.5">{b.desc}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs font-bold tracking-[0.25em] text-white/50 mt-1">SPECIALS &amp; THE AWAKENING</div>
              <div className="grid grid-cols-2 gap-1.5">
                {c.abilities.map((a) => {
                  const awakened = a.key.includes('AWAKENED');
                  const awaken = a.key.startsWith('R');
                  const special = a.key.startsWith('L');
                  const accent = awakened ? '#ffd24a' : awaken ? '#b067ff' : special ? '#ffd778' : c.color;
                  return (
                    <div key={a.key} className="bg-black/55 border-l-4 px-2.5 py-1" style={{ borderColor: accent, boxShadow: awakened || awaken ? `inset 0 0 18px ${awakened ? '#ffd24a18' : '#b067ff18'}` : undefined }}>
                      <div className="text-[9px] font-bold tracking-widest text-white/50">{a.key}</div>
                      <div className="font-display text-base leading-tight" style={{ color: awakened ? '#ffd24a' : awaken ? '#d7b8ff' : special ? '#ffd778' : '#fff' }}>{a.name}</div>
                      <div className="text-[11px] text-white/70 font-semibold leading-tight">{a.desc}</div>
                    </div>
                  );
                })}
              </div>
              {!!c.passives?.length && (
                <>
                  <div className="text-xs font-bold tracking-[0.25em] text-[#ff5a70] mt-1">PASSIVES</div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {c.passives.map((passive) => (
                      <div key={passive.name} className="bg-black/55 border-l-4 border-[#ff315d] px-3 py-1.5">
                        <div className="font-display text-lg text-[#ff6b7e]">{passive.name}</div>
                        <div className="text-[12px] text-white/70 font-semibold leading-tight">{passive.desc}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="w-[52%] bg-black/60 border-2 border-white/10 overflow-hidden">
              <Preview charId={c.id} color={c.color} />
            </div>
          </div>
        </div>

        {/* right: roster + opponents */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 lg:min-w-[340px] lg:max-w-[560px] shrink-0">
          <div className="text-sm font-bold tracking-[0.3em] text-white/60">ROSTER ({CHARACTERS.length} FIGHTERS) · <span style={{ color: FIGHTER_COLORS[0] }}>P1</span></div>
          <div className="grid grid-cols-5 gap-1.5 overflow-y-auto pr-1 max-h-[38vh] shrink-0">
            {CHARACTERS.map((ch) => (
              <button key={ch.id} onClick={() => pick(ch.id)} onMouseEnter={() => { setFocus(ch.id); sfx('select'); }}
                className={`group relative aspect-[3/4] overflow-hidden border-[3px] cursor-pointer transition-all duration-150 ${cfg.player === ch.id ? 'scale-[1.06] z-10 anim-glow' : 'border-black opacity-85 hover:opacity-100 hover:scale-105'}`}
                style={{ borderColor: cfg.player === ch.id ? FIGHTER_COLORS[0] : focus === ch.id ? '#fff' : '#000', ['--glow' as any]: FIGHTER_COLORS[0] }}>
                <img src={ch.portrait} alt={ch.name} className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg,transparent 45%, ${ch.color}55 78%, #000 100%)` }} />
                <div className="absolute inset-x-0 bottom-0 pb-0.5 text-center font-display text-[11px] leading-tight tracking-wide">{shortName(ch)}</div>
                {ch.tier && <div className="absolute top-0.5 right-0.5 font-display text-[10px] px-1 bg-black/70 text-[#ffd24a] leading-tight">{ch.tier}</div>}
                {cfg.player === ch.id && <div className="absolute top-0.5 left-0.5 font-display text-[10px] px-1 leading-tight" style={{ background: FIGHTER_COLORS[0] }}>P1</div>}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm font-bold tracking-[0.3em] text-white/60">{training ? 'TRAINING DUMMY' : cfg.mode === 'custom' ? 'CPU FIGHTERS · TEAMS ON NEXT SCREEN' : 'OPPONENTS'}</div>
            {!training && maxC > 1 && (
              <div className="flex gap-2">
                <button onClick={removeCpu} disabled={cfg.cpus.length <= minC} className="w-8 h-8 bg-black/70 border border-white/30 font-bold disabled:opacity-30 hover:bg-white/10 cursor-pointer">−</button>
                <span className="font-display text-xl w-16 text-center">{cfg.cpus.length} CPU</span>
                <button onClick={addCpu} disabled={cfg.cpus.length >= maxC} className="w-8 h-8 bg-black/70 border border-white/30 font-bold disabled:opacity-30 hover:bg-white/10 cursor-pointer">+</button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {cfg.cpus.map((cp, i) => {
              const ch = charById(cp.char);
              return (
                <div key={i} className="anim-fade-up flex items-center gap-3 bg-black/65 border-l-4 p-2" style={{ borderColor: FIGHTER_COLORS[i + 1] }}>
                  <button onClick={() => cycleCpu(i, -1)} className="font-display text-2xl px-1 hover:text-[#ffb52e] cursor-pointer">◀</button>
                  <img src={ch.portrait} alt="" className="w-14 h-14 object-cover border-2 border-black" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold tracking-[0.25em]" style={{ color: FIGHTER_COLORS[i + 1] }}>{training ? 'DUMMY' : `CPU ${i + 1}`}</div>
                    <select aria-label={`CPU ${i + 1} character`} value={cp.char} onChange={e => setCpu(i, { char: e.target.value })} className="w-full bg-[#141420] text-white font-display text-xl py-1 border border-white/20 rounded">
                      {CHARACTERS.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
                    </select>
                    {!training && (
                      <div className="flex gap-1 mt-1">
                        {DIFFS.map((d) => (
                          <button key={d} onClick={() => { setCpu(i, { diff: d }); sfx('select'); }}
                            className="text-[11px] font-bold tracking-widest px-2 py-0.5 border cursor-pointer transition"
                            style={{ background: cp.diff === d ? DCOL[d] : 'transparent', borderColor: DCOL[d], color: cp.diff === d ? '#000' : DCOL[d] }}>
                            {d.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => cycleCpu(i, 1)} className="font-display text-2xl px-1 hover:text-[#ffb52e] cursor-pointer">▶</button>
                </div>
              );
            })}
          </div>
          <div className="mt-auto mb-6 flex gap-3 justify-end items-center">
            <Btn color="#555" onClick={randomAll}>🎲 RANDOM</Btn>
            <Btn big onClick={onNext}>NEXT ▶</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
