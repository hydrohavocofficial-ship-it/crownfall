import { MatchResult } from '../game/types';
import { charById } from '../game/characters';
import { Btn, ScreenBG } from './ui';
import { TEAM_NAMES } from '../game/matchConfig';

interface Props { result: MatchResult; onRematch: () => void; onChars: () => void; onMenu: () => void; }

export default function Results({ result, onRematch, onChars, onMenu }: Props) {
  const win = result.fighters[0];
  const wc = charById(win.char);
  const playerWon = result.playerWon ?? !win.isCPU;
  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.7} img={wc.portrait} />
      <div className="relative z-10 h-full flex flex-col md:flex-row overflow-y-auto">
        <div className="flex-1 relative flex items-end justify-center overflow-hidden">
          <div className="absolute left-[8%] top-[8%] anim-slide-l skew-panel px-8 py-2" style={{ background: win.color }}>
            <div className="unskew font-display text-5xl lg:text-7xl text-shadow-hard leading-none">{result.draw ? 'DRAW' : playerWon ? 'VICTORY!' : 'DEFEAT'}</div>
          </div>
          <div className="relative w-[70%] h-[78%] skew-panel overflow-hidden border-4 border-black anim-pop" style={{ boxShadow: `12px 12px 0 #000, 0 0 60px ${wc.color}88` }}>
            <img src={wc.portrait} alt="" className="unskew absolute inset-0 w-full h-full object-cover scale-[1.3]" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 50%, ${wc.color}dd 100%)` }} />
            <div className="unskew absolute left-6 bottom-6">
              <div className="text-sm font-bold tracking-[0.35em]">{result.draw ? 'TIED MATCH' : win.team !== undefined ? `WINNING TEAM · ${TEAM_NAMES[win.team]}` : `WINNER · ${win.label}`}</div>
              <div className="font-display text-6xl text-shadow-hard leading-none">{wc.name.toUpperCase()}</div>
              <div className="font-display text-2xl text-white/80">{wc.title}</div>
            </div>
          </div>
        </div>
        <div className="w-full md:w-[50%] flex flex-col justify-center p-4 md:pr-6 gap-3">
          <div className="text-sm font-bold tracking-[0.35em] text-white/60">MATCH RESULTS · {result.rule.toUpperCase()} · {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, '0')}</div>
          {result.teamResults && <div className="flex flex-wrap gap-2">{result.teamResults.map(team => <span key={team.team} className="rounded border border-white/20 bg-black/60 px-3 py-2 text-xs">{TEAM_NAMES[team.team]} · #{team.place} · {team.score} score · {team.stocks} lives</span>)}</div>}
          {result.fighters.map((f, i) => {
            const c = charById(f.char);
            return (
              <div key={i} className="anim-fade-up flex items-center gap-4 bg-black/70 border-l-8 p-3" style={{ borderColor: f.color, animationDelay: `${0.2 + i * 0.1}s` }}>
                <div className="font-display text-5xl w-12 text-center" style={{ color: i === 0 ? '#ffd24a' : '#fff' }}>{f.place}</div>
                <img src={c.portrait} alt="" className="w-16 h-16 object-cover border-2 border-black" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold tracking-[0.15em]" style={{ color: f.color }}>{f.label}{f.team !== undefined ? ` · ${TEAM_NAMES[f.team]}` : ''}</div>
                  <div className="font-display text-2xl leading-none truncate">{c.name.toUpperCase()}</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['KOs', f.kos], ['FALLS', f.falls], ['DMG DEALT', f.dmgDealt], ['SCORE', f.score]].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="font-display text-2xl leading-none">{v}</div>
                      <div className="text-[9px] font-bold tracking-widest text-white/50">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-3 mt-6">
            <Btn big onClick={onRematch} color="#ff4757">↺ REMATCH</Btn>
            <Btn onClick={onChars} color="#3fa9ff">CHARACTERS</Btn>
            <Btn onClick={onMenu} color="#555">MAIN MENU</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
