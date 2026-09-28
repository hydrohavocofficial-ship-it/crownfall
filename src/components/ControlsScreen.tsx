import { useEffect, useState } from 'react';
import { ACTIONS, Bindings, DEFAULT_BINDINGS, keyLabel, saveBindings } from '../game/input';
import { Action } from '../game/types';
import { Settings, saveSettings } from '../game/settings';
import { Btn, Header, ScreenBG } from './ui';
import { sfx } from '../game/audio';

interface Props { bindings: Bindings; setBindings: (b: Bindings) => void; settings: Settings; setSettings: (s: Settings) => void; onBack: () => void; }

export default function ControlsScreen({ bindings, setBindings, settings, setSettings, onBack }: Props) {
  const [listening, setListening] = useState<Action | null>(null);
  const [pad, setPad] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape' && listening !== 'pause') { setListening(null); return; }
      const nb: Bindings = { ...bindings };
      // remove from other actions to avoid conflicts
      (Object.keys(nb) as Action[]).forEach((a) => { nb[a] = nb[a].filter((k) => k !== e.code); });
      nb[listening] = [e.code, ...bindings[listening].filter((k) => k !== e.code).slice(0, 1)];
      setBindings(nb); saveBindings(nb); setListening(null); sfx('confirm');
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [listening, bindings, setBindings]);

  useEffect(() => {
    const iv = setInterval(() => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      setPad(pads[0] ? pads[0]!.id : null);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const upd = (s: Settings) => { setSettings(s); saveSettings(s); };

  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.8} />
      <Header title="CONTROLS & SETTINGS" subtitle="Click a binding, then press a key" onBack={onBack} />
      <div className="relative z-10 flex gap-8 px-8 pt-6 h-[calc(100%-100px)]">
        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-6">
          <div className="text-sm font-bold tracking-[0.3em] text-white/60 mb-1">KEYBOARD</div>
          {ACTIONS.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-black/60 border-l-4 border-[#ff4757] px-4 py-1.5">
              <span className="font-semibold text-lg">{a.label}</span>
              <div className="flex gap-2 items-center">
                {bindings[a.id].slice(1).map((k) => <span key={k} className="text-white/40 text-sm font-bold">{keyLabel(k)}</span>)}
                <button onClick={() => { setListening(a.id); sfx('select'); }}
                  className={`min-w-[110px] px-3 py-1 font-display text-xl border-2 cursor-pointer transition ${listening === a.id ? 'border-[#ffb52e] bg-[#ffb52e] text-black animate-pulse' : 'border-white/30 bg-black/50 hover:border-white'}`}>
                  {listening === a.id ? 'PRESS KEY' : keyLabel(bindings[a.id][0])}
                </button>
              </div>
            </div>
          ))}
          <div className="mt-3 flex gap-3">
            <Btn color="#555" onClick={() => { const d = JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); setBindings(d); saveBindings(d); }}>RESET DEFAULTS</Btn>
          </div>
        </div>
        <div className="w-[40%] flex flex-col gap-4">
          <div className="bg-black/60 p-4 border-l-4 border-[#3fa9ff]">
            <div className="font-display text-2xl text-[#3fa9ff]">🎮 GAMEPAD</div>
            <div className={`text-sm font-bold mb-2 ${pad ? 'text-[#44e07a]' : 'text-white/50'}`}>{pad ? `Connected: ${pad.slice(0, 48)}` : 'No controller detected — press any button on your pad'}</div>
            <div className="grid grid-cols-2 gap-x-4 text-sm font-semibold text-white/80">
              <span>Left Stick / D-Pad</span><span>Move &amp; Aim</span>
              <span>A / Cross</span><span>Jump</span>
              <span>X / Square</span><span>Light Attack</span>
              <span>B / Circle</span><span>Heavy Attack</span>
              <span>Y / Triangle</span><span>Signature Special</span>
              <span>LB</span><span>Awaken (needs a full gauge)</span>
              <span>RB / RT / LT</span><span>Dodge / Dash</span>
              <span>Select / R3</span><span>Awakened Light</span>
              <span>Start</span><span>Pause</span>
            </div>
          </div>
          <div className="bg-black/60 p-4 border-l-4 border-[#ffb52e] flex flex-col gap-3">
            <div className="font-display text-2xl text-[#ffb52e]">⚙ SETTINGS</div>
            <label className="flex items-center justify-between font-semibold">
              <span>Tap Up to Jump</span>
              <input type="checkbox" className="w-5 h-5" checked={settings.tapJump} onChange={(e) => upd({ ...settings, tapJump: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 font-semibold">
              <span>Volume</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => upd({ ...settings, volume: parseFloat(e.target.value) })} onMouseUp={() => sfx('hit')} className="flex-1" />
              <span className="w-10 text-right">{Math.round(settings.volume * 100)}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
