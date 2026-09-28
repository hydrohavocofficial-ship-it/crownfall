import { useState } from 'react';
import { CHARACTERS } from '../game/characters';
import { Bindings, keyLabel } from '../game/input';
import { Header, ScreenBG } from './ui';
import MoveList from './MoveList';

export default function HowToPlay({ bindings, onBack }: { bindings: Bindings; onBack: () => void }) {
  const [sel, setSel] = useState(0);
  const c = CHARACTERS[sel];
  const k = (a: keyof Bindings) => keyLabel(bindings[a][0]);
  const sections = [
    { t: 'COMBOS: ONE KEY AT A TIME', c: '#67edbb', b: `A sequence like ${k('light')} → ${k('light')} → ${k('special')} means tap, release, then tap the next key while the previous move is running. Do not hold all three keys together. The Combo Coach shows when a follow-up is available. Inputs buffer for 7 frames (about 0.12 seconds); a very early press expires. Hitstop briefly freezes move timing.` },
    { t: 'BOSS FINISHERS: SPEND THE GAUGE', c: '#ff6280', b: `Sukuna and Gojo each own an exclusive finisher — World-Cutting Sentence and Point-Zero Purple — and neither has a button of its own. Their finisher is their awakened special: fill the gauge, press ${k('awaken')}, and ${k('special')} from neutral becomes the finisher for as long as the Awakening lasts. Their awakened heavy leads into it, so ${k('heavy')} then ${k('special')} inside the state is the whole route. The old ${k('heavy')} → ${k('heavy')} confirm still exists, and it now hands the finisher to whoever is Awakened.` },
    { t: 'STANCE VS SEQUENCE', c: '#cba6ff', b: `Side + ${k('light')} means hold left or right while pressing Light once. ${k('light')} → ${k('special')} means two sequential taps. Neutral means no direction held. Air + up + Heavy is Sukuna/Gojo recovery; air + down + Heavy is a dive, and air Heavy without up/down is their aerial technique. A combo route is not a guaranteed escape-proof hit sequence: spacing, damage and opponent movement matter.` },
    { t: 'THE GOAL', c: '#ff4757', b: 'Hitting opponents raises their damage number. The higher it gets, the further they fly. Knock them past the edges of the arena (blast zones) to score a KO.' },
    { t: 'MOVEMENT', c: '#3fa9ff', b: `Run with ${k('left')}/${k('right')}. Jump with ${k('jump')} — you have a ground jump plus two air jumps. Hold toward a wall in the air to cling, then jump to climb. Press ${k('down')} in the air to fast-fall, or on a soft platform to drop through.` },
    { t: 'DODGE & DASH', c: '#44e07a', b: `${k('dodge')} on the ground: spot-dodge (invulnerable). With a direction: quick dash. In the air: directional dodge, once per airtime — refreshed on landing or when you get hit.` },
    { t: 'ATTACKS & MOVE VARIANTS', c: '#ffb52e', b: `Light (${k('light')}) and Heavy (${k('heavy')}) change with direction (neutral, side, down, air). Some attacks have follow-up branches. Press Light again for multi-hit chains, Special (${k('special')}) for EX cancels, or Heavy (${k('heavy')}) for launchers.` },
    { t: `L · SPECIALS`, c: '#3fa9ff', b: `Each fighter has 3 signature Specials. ${k('special')} from neutral, holding toward the opponent, or holding down each give a different named move with its own hitbox, trajectory and bespoke energy effects; some fighters add a fourth in the air.` },
    { t: `R · THE AWAKENING GAUGE`, c: '#b067ff', b: `Your gauge fills slowly, and only by fighting: dealing damage fills it faster than taking it. It takes a real exchange to fill, and a fight spent blocking will not fill it at all. At 100% it is ready.` },
    { t: `AWAKENING: A WHOLE SECOND MOVESET`, c: '#ffd24a', b: `Press ${k('awaken')} with a full gauge and you Awaken. The gauge starts draining immediately and empties over about fifteen seconds; at zero the Awakening ends on its own. While it is open, all three attack buttons point at a different moveset — ${k('light')} becomes a fast awakened light, ${k('heavy')} a launcher, ${k('special')} the awakened special — each with its own neutral / forward / down / aerial version. For a handful of fighters the awakened special is their old ultimate, at about half strength.` },
    { t: 'DYING AWAKENED', c: '#ff8b98', b: `A knockout while Awakened takes the whole thing: the state is gone and the gauge goes back to zero. You cannot bank a partially-drained Awakening across a stock, and you cannot re-enter on the sliver left by a late hit.` },
  ];
  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.82} />
      <Header title="HOW TO PLAY" subtitle="Mechanics & move lists" onBack={onBack} />
      <div className="relative z-10 flex flex-col md:flex-row gap-4 px-4 md:px-8 pt-4 h-[calc(100%-100px)] pb-6 overflow-y-auto">
        <div className="flex-1 flex flex-col gap-3 md:overflow-y-auto shrink-0">
          {sections.map((s, i) => (
            <div key={s.t} className="anim-fade-up bg-black/60 border-l-4 px-4 py-3" style={{ borderColor: s.c, animationDelay: `${i * 0.06}s` }}>
              <div className="font-display text-2xl" style={{ color: s.c }}>{s.t}</div>
              <p className="text-white/80 font-semibold">{s.b}</p>
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-7 lg:grid-cols-10 gap-1">
            {CHARACTERS.map((ch, i) => (
              <button key={ch.id} title={ch.name} aria-label={ch.name} onClick={() => setSel(i)} className={`border-2 overflow-hidden aspect-square cursor-pointer transition ${sel === i ? 'scale-110 z-10' : 'border-black opacity-60 hover:opacity-100'}`} style={{ borderColor: sel === i ? ch.color : undefined }}>
                <img src={ch.portrait} alt="" className="w-full h-full object-cover object-top" />
              </button>
            ))}
          </div>
          <div className="bg-black/60 p-4 border-l-4 overflow-y-auto" style={{ borderColor: c.color }}>
            <div className="font-display text-4xl" style={{ color: c.color }}>{c.name.toUpperCase()}</div>
            <p className="text-white/70 font-semibold mb-3">{c.desc}</p>
            {c.abilities.map((a) => (
              <div key={a.key} className="mb-2">
                <span className="text-[11px] font-bold tracking-[0.25em] text-white/50">{a.key} · </span>
                <span className="font-display text-xl" style={{ color: a.key.includes('AWAKENED') ? '#ffd24a' : a.key.startsWith('R') ? '#d7b8ff' : a.key.startsWith('L') ? '#ffd778' : '#fff' }}>{a.name}</span>
                <div className="text-sm text-white/70 font-semibold">{a.desc}</div>
              </div>
            ))}
            {!!c.passives?.length && (
              <div className="mt-3 mb-3">
                <div className="text-[11px] font-bold tracking-[0.25em] text-[#ff5a70]">PASSIVES</div>
                {c.passives.map((passive) => <div key={passive.name} className="mt-1"><span className="font-display text-lg text-[#ff6b7e]">{passive.name}: </span><span className="text-sm text-white/70 font-semibold">{passive.desc}</span></div>)}
              </div>
            )}
            <MoveList key={c.id} character={c} bindings={bindings} />
            <div className="text-[11px] font-bold tracking-[0.25em] text-[#ffb52e] mt-3">DEFAULT KEY REFERENCE</div>
            <div className="flex flex-col gap-1.5 mt-1">
              {c.moveBranches.map((b) => (
                <div key={b.input} className="bg-black/50 p-2 border-l-2" style={{ borderColor: c.color }}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-display text-base text-white">{b.name}</span>
                    <span className="text-[9px] font-bold tracking-widest text-[#ffb52e] bg-white/10 px-1.5 py-0.5 rounded">{b.input}</span>
                  </div>
                  <div className="text-xs text-white/70 font-semibold">{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
