import { ModeId } from '../game/types';
import { Header, ScreenBG } from './ui';
import { sfx } from '../game/audio';

export const MODES: { id: ModeId; name: string; desc: string; icon: string; color: string; tag: string }[] = [
  { id: '1v1', name: '1 VS 1', desc: 'A traditional duel against a single CPU. Choose stock or timed rules.', icon: '⚔️', color: '#ff4757', tag: 'DUEL' },
  { id: 'ffa', name: 'FREE-FOR-ALL', desc: 'Chaos! Battle up to three CPU fighters at once. Everyone for themselves.', icon: '💥', color: '#ffb52e', tag: '2-4 FIGHTERS' },
  { id: 'stock', name: 'STOCK BATTLE', desc: 'Limited lives. Knock foes off the stage — last fighter standing wins.', icon: '❤️', color: '#44e07a', tag: 'SURVIVAL' },
  { id: 'timed', name: 'TIMED BATTLE', desc: 'Score the most KOs before time runs out. +1 per KO, −1 per fall.', icon: '⏱️', color: '#3fa9ff', tag: 'SCORE ATTACK' },
  { id: 'custom', name: 'CUSTOM MATCH', desc: 'Build your teams. 1 vs 3, co-op or free-for-all with health, damage and launch tuning.', icon: '🛠️', color: '#2dd4bf', tag: 'YOUR RULES' },
  { id: 'training', name: 'TRAINING', desc: 'Practise movement, combos and specials against a configurable dummy.', icon: '🎯', color: '#b067ff', tag: 'PRACTICE' },
];

export default function ModeSelect({ onPick, onBack }: { onPick: (m: ModeId) => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.7} />
      <Header title="SELECT MODE" subtitle="Choose how you want to brawl" onBack={onBack} />
      <div className="relative z-10 h-[calc(100%-110px)] overflow-y-auto flex items-start justify-center px-5 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-[1400px]">
          {MODES.map((m, i) => (
            <button key={m.id} onMouseEnter={() => sfx('select')} onClick={() => { sfx('confirm'); onPick(m.id); }}
              className="group anim-fade-up relative h-[31vh] min-h-[245px] skew-panel overflow-hidden border-2 border-black cursor-pointer transition-all duration-200 hover:-translate-y-3 hover:scale-[1.03] shine"
              style={{ animationDelay: `${i * 0.08}s`, background: `linear-gradient(170deg, ${m.color}ee, ${m.color}44 55%, #0a0a14 100%)`, boxShadow: `6px 6px 0 #000` }}>
              <div className="unskew absolute inset-0 flex flex-col items-center justify-between py-4 px-5 text-center">
                <span className="font-display text-sm tracking-[0.3em] bg-black/60 px-3 py-1">{m.tag}</span>
                <span className="text-5xl drop-shadow-[4px_4px_0_#000] group-hover:scale-125 transition-transform duration-300">{m.icon}</span>
                <div>
                  <div className="font-display text-4xl leading-none text-shadow-hard mb-3">{m.name}</div>
                  <p className="text-white/80 font-semibold text-sm leading-snug">{m.desc}</p>
                </div>
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition" style={{ boxShadow: `inset 0 0 60px ${m.color}` }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
