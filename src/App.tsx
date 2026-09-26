import { useState } from 'react';
import MainMenu from './components/MainMenu';
import ModeSelect from './components/ModeSelect';
import CharacterSelect from './components/CharacterSelect';
import MatchSetup from './components/MatchSetup';
import LoadingScreen from './components/LoadingScreen';
import GameScreen from './components/GameScreen';
import Results from './components/Results';
import ControlsScreen from './components/ControlsScreen';
import HowToPlay from './components/HowToPlay';
import { MatchConfig, MatchResult, ModeId } from './game/types';
import { loadBindings, Bindings } from './game/input';
import { loadSettings, Settings } from './game/settings';
import { CHARACTERS } from './game/characters';
import CharacterBuilder from './components/CharacterBuilder';
import { registerCustoms } from './game/custom';
import { customSettings, customMatchError, normalizeMatchConfig } from './game/matchConfig';

registerCustoms();

type Screen = 'menu' | 'modes' | 'chars' | 'setup' | 'loading' | 'game' | 'results' | 'controls' | 'howto' | 'builder';

function defaultsFor(mode: ModeId, prev: MatchConfig): MatchConfig {
  const pick = (skip: string[]) => CHARACTERS.filter((c) => !skip.includes(c.id))[Math.floor(Math.random() * (CHARACTERS.length - skip.length))]?.id || 'asta';
  prev = { ...prev, stocks: 3, time: mode === 'custom' ? 300 : 180 };
  const diff = prev.cpus[0]?.diff || 'medium';
  const mk = (n: number) => { const used = [prev.player]; return Array.from({ length: n }, () => { const c = pick(used); used.push(c); return { char: c, diff }; }); };
  switch (mode) {
    case 'custom': return { ...prev, mode, rule: 'stock', cpus: mk(3), custom: customSettings(prev) };
    case '1v1': return { ...prev, mode, rule: 'stock', cpus: mk(1) };
    case 'ffa': return { ...prev, mode, rule: 'stock', cpus: mk(3) };
    case 'stock': return { ...prev, mode, rule: 'stock', cpus: mk(1) };
    case 'timed': return { ...prev, mode, rule: 'timed', cpus: mk(2) };
    case 'training': return { ...prev, mode, rule: 'training', cpus: [{ char: prev.player === 'asta' ? 'rengoku' : 'asta', diff: 'medium' }] };
  }
}

export default function App() {
  // The launcher opens on the main menu; training is available from the menu.
  const [screen, setScreen] = useState<Screen>('menu');
  const [cfg, setCfg] = useState<MatchConfig>({ mode: 'training', rule: 'training', stocks: 1, time: 1, arena: 'rooftops', player: 'levi', cpus: [{ char: 'asta', diff: 'medium' }] });
  const [bindings, setBindings] = useState<Bindings>(() => loadBindings());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [result, setResult] = useState<MatchResult | null>(null);
  const [matchId, setMatchId] = useState(0);

  const chooseMode = (m: ModeId) => { setCfg(defaultsFor(m, cfg)); setScreen('chars'); };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none">
      {screen === 'menu' && (
        <MainMenu onPlay={() => setScreen('modes')} onTraining={() => chooseMode('training')} onControls={() => setScreen('controls')} onHowTo={() => setScreen('howto')} onBuilder={() => setScreen('builder')} />
      )}
      {screen === 'builder' && (
        <CharacterBuilder onBack={() => setScreen('menu')} onPlay={(id) => { setCfg((c) => ({ ...c, player: id })); setScreen('modes'); }} />
      )}
      {screen === 'modes' && <ModeSelect onPick={chooseMode} onBack={() => setScreen('menu')} />}
      {screen === 'chars' && (
        <CharacterSelect cfg={cfg} setCfg={setCfg} onNext={() => setScreen('setup')} onBack={() => setScreen(cfg.mode === 'training' ? 'menu' : 'modes')} />
      )}
      {screen === 'setup' && <MatchSetup cfg={cfg} setCfg={setCfg} onStart={() => { if (!customMatchError(cfg)) { setCfg(normalizeMatchConfig(cfg)); setScreen('loading'); } }} onBack={() => setScreen('chars')} />}
      {screen === 'loading' && <LoadingScreen cfg={cfg} onDone={() => { setMatchId((v) => v + 1); setScreen('game'); }} />}
      {screen === 'game' && (
        <GameScreen key={matchId} cfg={cfg} bindings={bindings} tapJump={settings.tapJump}
          onEnd={(r) => { setResult(r); setScreen('results'); }}
          onQuit={() => setScreen(cfg.mode === 'training' ? 'menu' : 'chars')} />
      )}
      {screen === 'results' && result && (
        <Results result={result} onRematch={() => setScreen('loading')} onChars={() => setScreen('chars')} onMenu={() => setScreen('menu')} />
      )}
      {screen === 'controls' && (
        <ControlsScreen bindings={bindings} setBindings={setBindings} settings={settings} setSettings={setSettings} onBack={() => setScreen('menu')} />
      )}
      {screen === 'howto' && <HowToPlay bindings={bindings} onBack={() => setScreen('menu')} />}
    </div>
  );
}
