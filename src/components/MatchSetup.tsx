import { ARENAS } from '../game/arenas';
import { CustomMatchSettings, Difficulty, FighterSettings, MatchConfig } from '../game/types';
import { CHARACTERS, charById } from '../game/characters';
import { customSettings, customMatchError, TEAM_COLORS, TEAM_NAMES } from '../game/matchConfig';
import { Btn, Header, ScreenBG } from './ui';
import { sfx } from '../game/audio';

interface Props { cfg: MatchConfig; setCfg: (c: MatchConfig) => void; onStart: () => void; onBack: () => void; }

function NumberOption({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return <label className="flex items-center justify-between gap-2 text-xs font-semibold text-white/80">
    {label}<input aria-label={label} type="number" min={min} max={max} step={step} value={value}
      onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) onChange(Math.max(min, Math.min(max, e.target.valueAsNumber))); }}
      className="w-20 rounded border border-white/25 bg-[#161622] px-2 py-2 text-white text-right focus:border-[#2dd4bf]" />
  </label>;
}

function CustomRules({ cfg, setCfg }: Pick<Props, 'cfg' | 'setCfg'>) {
  const c = customSettings(cfg);
  const patch = (value: Partial<CustomMatchSettings>) => setCfg({ ...cfg, custom: { ...c, ...value } });
  const patchFighter = (slot: number, value: Partial<FighterSettings>) => patch({ fighters: c.fighters.map((f, i) => i === slot ? { ...f, ...value } : f) });
  const preset = (kind: 'solo' | 'duo' | 'ffa') => {
    const cpus = Array.from({ length: 3 }, (_, i) => cfg.cpus[i] ?? { char: CHARACTERS[(i + 1) % CHARACTERS.length].id, diff: 'medium' as Difficulty });
    setCfg({ ...cfg, cpus, custom: { ...c, teams: kind !== 'ffa', fighters: c.fighters.map((f, i) => ({ ...f, team: kind === 'duo' ? (i < 2 ? 0 : 1) : i === 0 ? 0 : 1 })) } });
  };
  return <section className="rounded-lg border border-[#2dd4bf]/40 bg-black/70 p-4 space-y-4">
    <div className="font-display text-2xl text-[#2dd4bf]">BUILD YOUR MATCH</div>
    <div className="grid grid-cols-3 gap-2">
      {([['solo', '1 vs 3'], ['duo', 'P1 + CPU vs 2'], ['ffa', 'Free-for-all']] as const).map(([id, name]) =>
        <button key={id} onClick={() => preset(id)} className="rounded bg-white/10 border border-white/20 px-2 py-3 text-xs font-bold hover:bg-[#2dd4bf]/20">{name}</button>)}
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.teams} onChange={e => patch({ teams: e.target.checked })} /> Team battle</label>
    {c.teams && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.friendlyFire} onChange={e => patch({ friendlyFire: e.target.checked })} /> Friendly fire (damage and knockback)</label>}
    <div className="grid grid-cols-2 gap-2">
      {(['percent', 'stamina'] as const).map(mode => <button key={mode} aria-pressed={c.damageMode === mode} onClick={() => patch({ damageMode: mode })}
        className={`rounded border p-2 text-sm font-bold ${c.damageMode === mode ? 'border-[#2dd4bf] bg-[#2dd4bf]/20' : 'border-white/20 bg-white/5'}`}>{mode === 'percent' ? 'Damage %' : 'Stamina / HP'}</button>)}
    </div>
    <p className="text-xs text-white/60">{c.damageMode === 'stamina' ? 'HP resets each life. Zero HP or a ring-out costs a life. Launch strength stays constant.' : 'Damage builds launch strength. Ring-outs cost a life.'} Timed battles score +1 per enemy KO, −1 per fall. Team KOs also penalize the attacker.</p>
    {c.damageMode === 'stamina' && <NumberOption label="Starting health" value={c.health} min={10} max={2000} step={10} onChange={health => patch({ health })} />}
    <NumberOption label="Global damage ×" value={c.damage} min={0.1} max={5} step={0.1} onChange={damage => patch({ damage })} />
    <NumberOption label="Global knockback ×" value={c.knockback} min={0} max={3} step={0.1} onChange={knockback => patch({ knockback })} />
    <p className="text-xs text-white/50">Per-fighter multipliers stack with global values. Customize every slot below; teams may be uneven.</p>
    {[cfg.player, ...cfg.cpus.map(cpu => cpu.char)].map((id, slot) => {
      const f = c.fighters[slot], cpu = cfg.cpus[slot - 1];
      return <div key={slot} className="rounded border-l-4 bg-white/5 p-3 space-y-2" style={{ borderColor: TEAM_COLORS[c.teams ? f.team : slot] }}>
        <div className="text-sm font-bold">{slot === 0 ? 'P1 · YOU' : `CPU ${slot}`} · {charById(id).name}</div>
        <select aria-label={`${slot === 0 ? 'P1' : `CPU ${slot}`} character`} value={id} className="w-full rounded bg-[#161622] border border-white/25 p-2 text-sm"
          onChange={e => setCfg(slot === 0 ? { ...cfg, player: e.target.value } : { ...cfg, cpus: cfg.cpus.map((p, i) => i === slot - 1 ? { ...p, char: e.target.value } : p) })}>
          {CHARACTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
        </select>
        <div className="flex gap-2">
          {c.teams && <label className="flex-1 text-xs">Team<select aria-label={`Slot ${slot + 1} team`} value={f.team} onChange={e => patchFighter(slot, { team: Number(e.target.value) })} className="mt-1 w-full rounded bg-[#161622] border border-white/25 p-2">
            {TEAM_NAMES.map((name, i) => <option key={name} value={i}>{name}</option>)}
          </select></label>}
          {cpu && <label className="flex-1 text-xs">Difficulty<select aria-label={`CPU ${slot} difficulty`} value={cpu.diff} onChange={e => setCfg({ ...cfg, cpus: cfg.cpus.map((p, i) => i === slot - 1 ? { ...p, diff: e.target.value as Difficulty } : p) })} className="mt-1 w-full rounded bg-[#161622] border border-white/25 p-2">
            {(['easy', 'medium', 'hard'] as const).map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
          </select></label>}
        </div>
        <NumberOption label={`${slot === 0 ? 'P1' : `CPU ${slot}`} damage ×`} value={f.damage} min={0.1} max={5} step={0.1} onChange={damage => patchFighter(slot, { damage })} />
        <NumberOption label={`${slot === 0 ? 'P1' : `CPU ${slot}`} knockback ×`} value={f.knockback} min={0} max={3} step={0.1} onChange={knockback => patchFighter(slot, { knockback })} />
        {c.damageMode === 'stamina' && <>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.health !== undefined} onChange={e => patchFighter(slot, { health: e.target.checked ? c.health : undefined })} /> Override health</label>
          {f.health !== undefined && <NumberOption label={`${slot === 0 ? 'P1' : `CPU ${slot}`} health`} value={f.health} min={10} max={2000} step={10} onChange={health => patchFighter(slot, { health })} />}
        </>}
      </div>;
    })}
  </section>;
}

function Stepper({ label, value, min, max, fmt, onChange }: { label: string; value: number; min: number; max: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between bg-black/60 border-l-4 border-[#ffb52e] px-4 py-2">
      <span className="font-bold tracking-[0.2em] text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => { if (value > min) { onChange(value - 1); sfx('select'); } }} className="font-display text-2xl hover:text-[#ffb52e] cursor-pointer">◀</button>
        <span className="font-display text-2xl w-20 text-center">{fmt ? fmt(value) : value}</span>
        <button onClick={() => { if (value < max) { onChange(value + 1); sfx('select'); } }} className="font-display text-2xl hover:text-[#ffb52e] cursor-pointer">▶</button>
      </div>
    </div>
  );
}

export default function MatchSetup({ cfg, setCfg, onStart, onBack }: Props) {
  const training = cfg.mode === 'training';
  const custom = cfg.mode === 'custom';
  const error = customMatchError(cfg);
  const ruleLocked = cfg.mode === 'stock' || cfg.mode === 'timed' || training;
  const arena = ARENAS.find((a) => a.id === cfg.arena) || ARENAS[0];
  const setAllDiff = (d: Difficulty) => setCfg({ ...cfg, cpus: cfg.cpus.map((c) => ({ ...c, diff: d })) });

  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.75} img={arena.bg} />
      <Header title="MATCH SETUP" subtitle="Arena & rules" onBack={onBack} />
      <div className="relative z-10 flex flex-col lg:flex-row gap-8 px-4 lg:px-8 pt-6 pb-6 h-[calc(100%-100px)] overflow-y-auto">
        <div className="flex-[1.6] flex flex-col gap-3 min-w-0">
          <div className="text-sm font-bold tracking-[0.3em] text-white/60">ARENA</div>
          <div className="grid grid-cols-2 gap-4">
            {ARENAS.map((a, i) => (
              <button key={a.id} onMouseEnter={() => sfx('select')} onClick={() => { setCfg({ ...cfg, arena: a.id }); sfx('confirm'); }}
                className={`anim-fade-up group relative aspect-[16/8] overflow-hidden border-4 cursor-pointer transition-all ${cfg.arena === a.id ? 'border-[#ffb52e] scale-[1.02]' : 'border-black hover:border-white/60'}`}
                style={{ animationDelay: `${i * 0.06}s`, boxShadow: cfg.arena === a.id ? '0 0 30px #ffb52e88, 6px 6px 0 #000' : '6px 6px 0 #000' }}>
                <img src={a.bg} alt={a.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <svg viewBox={`${a.blast.l * 0.62} -600 ${(a.blast.r - a.blast.l) * 0.62} 900`} className="absolute right-2 top-2 w-[34%] opacity-90 bg-black/50 rounded">
                  {a.solids.map((s, j) => <rect key={j} x={s.x} y={s.y} width={s.w} height={Math.min(s.h, 300)} fill="#fff" opacity={0.85} />)}
                  {a.platforms.map((p, j) => <rect key={'p' + j} x={p.x} y={p.y} width={p.w} height={18} fill="#ffb52e" />)}
                </svg>
                <div className="absolute left-3 bottom-2 text-left">
                  <div className="text-[11px] font-bold tracking-[0.3em] text-[#ffb52e]">{a.subtitle.toUpperCase()}</div>
                  <div className="font-display text-3xl leading-none text-shadow-hard">{a.name.toUpperCase()}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { setCfg({ ...cfg, arena: ARENAS[Math.floor(Math.random() * ARENAS.length)].id }); sfx('confirm'); }} className="self-start text-sm font-bold tracking-widest text-white/60 hover:text-white cursor-pointer">🎲 RANDOM ARENA</button>
        </div>

        <div className="flex-1 flex flex-col gap-3 min-w-0 lg:min-w-[360px] lg:max-w-[480px]">
          {!training && (
            <>
              <div className="text-sm font-bold tracking-[0.3em] text-white/60">RULES</div>
              <div className="flex gap-2">
                {(['stock', 'timed'] as const).map((r) => (
                  <button key={r} disabled={ruleLocked && cfg.rule !== r} onClick={() => { setCfg({ ...cfg, rule: r }); sfx('select'); }}
                    className={`flex-1 skew-panel border-2 border-black py-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition ${cfg.rule === r ? 'bg-[#ff4757]' : 'bg-black/60 hover:bg-white/10'}`}>
                    <span className="unskew block font-display text-2xl">{r === 'stock' ? '❤ STOCK' : '⏱ TIMED'}</span>
                  </button>
                ))}
              </div>
              {cfg.rule === 'stock' ? (
                <Stepper label="LIVES" value={cfg.stocks} min={1} max={9} onChange={(v) => setCfg({ ...cfg, stocks: v })} />
              ) : (
                <Stepper label="DURATION" value={cfg.time / 60} min={1} max={9} fmt={(v) => `${v}:00`} onChange={(v) => setCfg({ ...cfg, time: v * 60 })} />
              )}
              {custom && cfg.rule === 'stock' && <Stepper label="TIME LIMIT" value={cfg.time / 60} min={0} max={15} fmt={v => v === 0 ? 'OFF' : `${v}:00`} onChange={v => setCfg({ ...cfg, time: v * 60 })} />}
              <div className="text-sm font-bold tracking-[0.3em] text-white/60 mt-3">CPU DIFFICULTY (ALL)</div>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
                  const col = { easy: '#44e07a', medium: '#ffb52e', hard: '#ff4757' }[d];
                  const on = cfg.cpus.every((c) => c.diff === d);
                  return (
                    <button key={d} onClick={() => { setAllDiff(d); sfx('select'); }} className="flex-1 border-2 py-1.5 font-display text-xl cursor-pointer transition"
                      style={{ borderColor: col, background: on ? col : 'rgba(0,0,0,0.6)', color: on ? '#000' : col }}>{d.toUpperCase()}</button>
                  );
                })}
              </div>
              <p className="text-xs text-white/50 font-semibold">Higher difficulties react faster, space better, combo, dodge, edge-guard and recover more reliably — not just hit harder.</p>
            </>
          )}
          {custom && <CustomRules cfg={cfg} setCfg={setCfg} />}
          {training && (
            <div className="bg-black/60 border-l-4 border-[#b067ff] p-4 text-white/80 font-semibold">
              <div className="font-display text-2xl text-[#b067ff] mb-1">TRAINING ROOM</div>
              Infinite lives, no timer. Configure the dummy behaviour, lock its damage, show hitboxes and enable infinite Awakening gauge from the in-game panel.
            </div>
          )}
          <div className="mt-2 bg-black/60 p-4 border border-white/10">
            <div className="text-[11px] font-bold tracking-[0.3em] text-white/50 mb-1">MATCH SUMMARY</div>
            <div className="font-display text-2xl">{training ? 'TRAINING' : `${cfg.cpus.length + 1} FIGHTERS · ${cfg.rule === 'stock' ? `${cfg.stocks} STOCK${cfg.stocks > 1 ? 'S' : ''}` : `${cfg.time / 60} MIN`}`}</div>
            <div className="text-white/60 font-semibold">{arena.name} — {arena.subtitle}</div>
            {custom && <p className="text-sm mt-2 text-[#2dd4bf]">{customSettings(cfg).teams ? 'Team battle' : 'Free-for-all'} · {customSettings(cfg).damageMode === 'stamina' ? `${customSettings(cfg).health} base HP` : 'Damage %'}{cfg.rule === 'stock' && cfg.time > 0 ? ` · ${cfg.time / 60} min limit` : ''}</p>}
            {error && <p role="alert" className="mt-2 text-sm text-[#ff7e8a]">{error}</p>}
          </div>
          <div className="mt-auto mb-6 flex justify-end">
            <Btn big disabled={!!error} onClick={onStart} color="#ff4757">⚔ FIGHT!</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
