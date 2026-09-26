import { useEffect, useRef, useState } from 'react';
import { Btn, Header, ScreenBG } from './ui';
import { BASE_CHARACTERS } from '../game/characters';
import { ANIMS, POSES, drawFighter, lerpPose, runPose, HairStyle, Weapon, Mark, Look, Pose } from '../game/render';
import { CustomCfg, STAT_POINTS, deleteCustom, loadCustomCfgs, newCustomCfg, saveCustom } from '../game/custom';
import { sfx } from '../game/audio';

interface Props { onBack: () => void; onPlay: (id: string) => void }

const HAIRS: [HairStyle, string][] = [['spikeLong', 'Wild Spikes'], ['spikeShort', 'Short Spikes'], ['messy', 'Messy'], ['flame', 'Flame'], ['swept', 'Swept'], ['bowl', 'Undercut'], ['mane', 'Long Mane'], ['ponytail', 'Ponytail'], ['twin', 'Twin Tails'], ['bald', 'Bald']];
const WEAPONS: [Weapon, string][] = [['katana', 'Katana'], ['dual', 'Dual Blades'], ['triple', 'Three Swords'], ['greatsword', 'Greatsword'], ['chainsaw', 'Chainsaw'], ['claws', 'Bare Fists'], ['staff', 'Staff'], ['gunbai', 'War Fan']];
const MARKS: [Mark, string][] = [['none', 'None'], ['headband', 'Headband'], ['bandana', 'Bandana'], ['blindfold', 'Blindfold'], ['visor', 'Visor'], ['mask', 'Mask'], ['hat', 'Straw Hat'], ['scar', 'Scar']];
const COLORS: [keyof Look, string][] = [['skin', 'Skin'], ['hair', 'Hair'], ['eye', 'Eyes'], ['top', 'Outfit'], ['top2', 'Accent'], ['sleeve', 'Sleeves'], ['fore', 'Forearms'], ['pants', 'Pants'], ['boots', 'Boots'], ['energy', 'Energy'], ['energy2', 'Energy Glow']];
const SKINS = ['#f8e6d6', '#f3d6bd', '#eccdae', '#d9a47e', '#b07a52', '#7a4a30'];
const SIG_COLORS = ['#ff4757', '#ff8a1a', '#ffd24a', '#44e07a', '#2fd8c8', '#3fa9ff', '#6a5cff', '#b067ff', '#ff4fa3', '#e8e8f0'];
const TABS = ['IDENTITY', 'APPEARANCE', 'STATS', 'MOVESET'] as const;

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rndHex = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

function Preview({ cfg }: { cfg: CustomCfg }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0, t = 0;
    const SEQ: { kind: string; anim?: keyof typeof ANIMS }[] = [
      { kind: 'idle' }, { kind: 'run' }, { kind: 'atk', anim: 'slash' }, { kind: 'atk', anim: 'spin' },
      { kind: 'idle' }, { kind: 'atk', anim: 'uppercut' }, { kind: 'atk', anim: 'castUp' }, { kind: 'hero' },
    ];
    const loop = () => {
      t++;
      const c = cfgRef.current;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.floor(W * dpr)) { cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.8);
      bg.addColorStop(0, c.color + '55'); bg.addColorStop(0.5, '#120f1e'); bg.addColorStop(1, '#06050c');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // rotating emblem
      ctx.save(); ctx.translate(W / 2, H * 0.5); ctx.rotate(t * 0.004);
      ctx.strokeStyle = c.color + '44'; ctx.lineWidth = 2; ctx.setLineDash([12, 14]);
      ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.36, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      const gy = H * 0.84;
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, gy, W, 2);
      const sh = ctx.createRadialGradient(W / 2, gy, 1, W / 2, gy, 60);
      sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(W / 2, gy, 60, 14, 0, 0, Math.PI * 2); ctx.fill();

      const seg = Math.floor(t / 70) % SEQ.length, ph = (t % 70) / 70, s = SEQ[seg];
      let pose: Pose = POSES.idle, rot = 0;
      if (s.kind === 'run') pose = runPose(t * 0.3, !!c.look.ninjaRun);
      else if (s.kind === 'hero') pose = POSES.hero;
      else if (s.kind === 'atk' && s.anim) {
        const a = ANIMS[s.anim];
        pose = ph < 0.3 ? lerpPose(POSES.idle, a.w, ph / 0.3) : ph < 0.4 ? lerpPose(a.w, a.s, (ph - 0.3) / 0.1) : ph < 0.8 ? a.s : lerpPose(a.s, POSES.idle, (ph - 0.8) / 0.2);
        if (a.spin && ph > 0.3 && ph < 0.6) rot = a.spin * Math.PI * 2 * ((ph - 0.3) / 0.3);
      } else {
        const b = Math.sin(t * 0.07) * 0.06; pose = { ...POSES.idle, lean: POSES.idle.lean + b * 0.5 };
      }
      if (rot) pose = { ...pose, rot };
      const scale = Math.min(W, H) / 150 * c.size;
      ctx.save(); ctx.translate(W / 2, gy); ctx.scale(scale, scale);
      const mock: any = { x: 0, y: 0, vx: s.kind === 'run' ? 6 : 0, vy: 0, facing: 1, scale: 1, look: c.look, def: { styleId: c.style }, grounded: true, state: s.kind === 'atk' ? 'attack' : 'idle', animT: t, devilT: 0, godT: 0, auraT: s.anim === 'castUp' ? 5 : 0, hw: 15, h: 78 };
      drawFighter(ctx, mock, pose, t);
      ctx.restore();
      // energy particles
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const p = ((t * 0.006 + i * 0.071) % 1);
        const x = W / 2 + Math.sin(i * 2.3 + t * 0.01) * W * 0.3, y = gy - p * H * 0.8;
        ctx.globalAlpha = (1 - p) * 0.8; ctx.fillStyle = i % 2 ? c.look.energy : c.look.energy2;
        ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="w-full h-full block" />;
}

function Chip({ on, onClick, children, color = '#ff4fa3' }: { on: boolean; onClick: () => void; children: any; color?: string }) {
  return (
    <button onClick={() => { onClick(); sfx('select'); }}
      className={`px-2.5 py-1.5 text-[13px] font-bold tracking-wide border-2 transition cursor-pointer ${on ? 'text-black' : 'bg-black/50 border-white/15 hover:border-white/50 text-white/85'}`}
      style={on ? { background: color, borderColor: color, boxShadow: `0 0 12px ${color}88` } : undefined}>{children}</button>
  );
}
function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-black/55 border-l-4 border-white/10 p-3">
      <div className="text-[11px] font-bold tracking-[0.3em] text-white/50 mb-2">{title}</div>
      {children}
    </div>
  );
}

export default function CharacterBuilder({ onBack, onPlay }: Props) {
  const [cfg, setCfg] = useState<CustomCfg>(() => loadCustomCfgs()[0] || newCustomCfg());
  const [tab, setTab] = useState<(typeof TABS)[number]>('IDENTITY');
  const [saved, setSaved] = useState<CustomCfg[]>(() => loadCustomCfgs());
  const [toast, setToast] = useState('');

  const L = cfg.look;
  const setLook = (patch: Partial<Look>) => setCfg({ ...cfg, look: { ...cfg.look, ...patch } });
  const total = cfg.bars.power + cfg.bars.speed + cfg.bars.range + cfg.bars.defense;
  const setBar = (k: keyof CustomCfg['bars'], d: number) => {
    const v = cfg.bars[k] + d;
    if (v < 1 || v > 5 || (d > 0 && total >= STAT_POINTS)) return;
    setCfg({ ...cfg, bars: { ...cfg.bars, [k]: v } }); sfx('select');
  };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const doSave = (fight = false) => {
    if (!cfg.name.trim()) { flash('Give your fighter a name first!'); sfx('back'); return; }
    saveCustom(cfg); setSaved(loadCustomCfgs()); sfx('confirm');
    flash(`${cfg.name} saved to the roster!`);
    if (fight) onPlay(cfg.id);
  };
  const randomize = () => {
    const col = rnd(SIG_COLORS);
    setCfg({
      ...cfg, color: col,
      look: {
        ...L, skin: rnd(SKINS), hair: rndHex(), hair2: Math.random() < 0.3 ? rndHex() : undefined, hairStyle: rnd(HAIRS)[0],
        top: rndHex(), top2: col, sleeve: rndHex(), fore: rnd(SKINS), pants: rndHex(), boots: rndHex(),
        cape: Math.random() < 0.55 ? rndHex() : undefined, capeLen: 28 + Math.floor(Math.random() * 22), eye: col,
        weapon: rnd(WEAPONS)[0], mark: rnd(MARKS)[0], energy: col, energy2: '#ffffff', ninjaRun: Math.random() < 0.5,
      },
      style: rnd(BASE_CHARACTERS).id, nspec: rnd(BASE_CHARACTERS).id, sspec: rnd(BASE_CHARACTERS).id, dspec: rnd(BASE_CHARACTERS).id, ult: rnd(BASE_CHARACTERS).id,
    });
    sfx('confirm');
  };
  const copyLook = (id: string) => {
    const c = BASE_CHARACTERS.find((x) => x.id === id); if (!c) return;
    setCfg({ ...cfg, look: { ...c.look }, color: c.color }); sfx('confirm');
  };

  const src = (id: string) => BASE_CHARACTERS.find((c) => c.id === id) || BASE_CHARACTERS[0];
  const specialPick = (slot: 'nspec' | 'sspec' | 'dspec' | 'ult', label: string) => {
    const cur = src(cfg[slot]).moves[slot];
    return (
      <Section title={label}>
        <select value={cfg[slot]} onChange={(e) => { setCfg({ ...cfg, [slot]: e.target.value }); sfx('select'); }}
          className="w-full bg-black/70 border-2 border-white/20 px-2 py-1.5 font-semibold text-sm cursor-pointer focus:outline-none focus:border-white/60">
          {BASE_CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.moves[slot].name} — {c.name}</option>)}
        </select>
        <div className="text-[12px] text-white/65 font-semibold mt-1.5 leading-snug">{cur.desc}</div>
      </Section>
    );
  };

  return (
    <div className="absolute inset-0">
      <ScreenBG dim={0.85} />
      <Header title="CHARACTER CREATOR" subtitle="Design, build and battle your own fighter" onBack={onBack} />
      <div className="relative z-10 flex gap-6 px-8 pt-4 h-[calc(100%-96px)] pb-5">
        {/* LEFT: preview */}
        <div className="w-[36%] flex flex-col gap-3 min-w-[320px]">
          <div className="relative flex-1 border-2 overflow-hidden" style={{ borderColor: cfg.color, boxShadow: `0 0 40px ${cfg.color}44, 8px 8px 0 #000` }}>
            <Preview cfg={cfg} />
            <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/70 to-transparent">
              <div className="text-[11px] font-bold tracking-[0.35em]" style={{ color: cfg.color }}>{(cfg.origin || 'ORIGINAL').toUpperCase()}</div>
              <div className="font-display text-4xl leading-none text-shadow-hard">{(cfg.name || 'UNNAMED').toUpperCase()}</div>
              <div className="font-display text-lg text-white/75">{cfg.title}</div>
            </div>
            <div className="absolute top-3 left-3 bg-black/70 px-2 py-0.5 font-display text-sm text-[#ffd24a]">OC</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Btn color="#555" onClick={randomize}>🎲 RANDOMIZE</Btn>
            <Btn color="#3fa9ff" onClick={() => doSave(false)}>💾 SAVE</Btn>
            <Btn color="#ff4757" onClick={() => doSave(true)}>⚔ SAVE & FIGHT</Btn>
          </div>
          {toast && <div className="anim-pop bg-black/80 border-l-4 px-3 py-2 font-bold" style={{ borderColor: cfg.color }}>{toast}</div>}
        </div>

        {/* RIGHT: editor */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* saved fighters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold tracking-[0.3em] text-white/50 shrink-0">MY FIGHTERS</span>
            <button onClick={() => { setCfg(newCustomCfg()); sfx('confirm'); }} className="shrink-0 px-3 py-1 border-2 border-dashed border-white/30 hover:border-white font-bold text-sm cursor-pointer">+ NEW</button>
            {saved.map((s) => (
              <div key={s.id} className={`shrink-0 flex items-center gap-1 border-2 px-2 py-0.5 ${s.id === cfg.id ? 'bg-white/10' : 'bg-black/50'}`} style={{ borderColor: s.color }}>
                <button onClick={() => { setCfg(s); sfx('select'); }} className="font-display text-base cursor-pointer">{s.name}</button>
                <button onClick={() => { deleteCustom(s.id); setSaved(loadCustomCfgs()); if (s.id === cfg.id) setCfg(newCustomCfg()); sfx('back'); }} className="text-white/40 hover:text-[#ff4757] font-bold text-sm px-1 cursor-pointer" title="Delete">✕</button>
              </div>
            ))}
          </div>

          {/* tabs */}
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => { setTab(t); sfx('select'); }}
                className={`flex-1 skew-panel py-2 border-2 border-black cursor-pointer transition ${tab === t ? '' : 'bg-black/60 hover:bg-white/10'}`}
                style={tab === t ? { background: cfg.color } : undefined}>
                <span className="unskew block font-display text-xl tracking-wider text-shadow-hard">{t}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
            {tab === 'IDENTITY' && (<>
              <Section title="NAME">
                <input value={cfg.name} maxLength={22} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} className="w-full bg-black/70 border-2 border-white/20 px-3 py-2 font-display text-2xl tracking-wide focus:outline-none focus:border-white/60" />
              </Section>
              <div className="grid grid-cols-2 gap-3">
                <Section title="TITLE / EPITHET">
                  <input value={cfg.title} maxLength={32} onChange={(e) => setCfg({ ...cfg, title: e.target.value })} className="w-full bg-black/70 border-2 border-white/20 px-3 py-1.5 font-semibold focus:outline-none focus:border-white/60" />
                </Section>
                <Section title="ORIGIN / SERIES">
                  <input value={cfg.origin} maxLength={28} onChange={(e) => setCfg({ ...cfg, origin: e.target.value })} className="w-full bg-black/70 border-2 border-white/20 px-3 py-1.5 font-semibold focus:outline-none focus:border-white/60" />
                </Section>
              </div>
              <Section title="BIOGRAPHY">
                <textarea value={cfg.bio} maxLength={180} rows={3} onChange={(e) => setCfg({ ...cfg, bio: e.target.value })} className="w-full bg-black/70 border-2 border-white/20 px-3 py-2 font-semibold resize-none focus:outline-none focus:border-white/60" />
              </Section>
              <Section title="SIGNATURE COLOR">
                <div className="flex gap-2 flex-wrap items-center">
                  {SIG_COLORS.map((c) => (
                    <button key={c} onClick={() => { setCfg({ ...cfg, color: c, look: { ...L, energy: c, top2: c, eye: c } }); sfx('select'); }}
                      className={`w-9 h-9 border-2 cursor-pointer transition ${cfg.color === c ? 'scale-110 border-white' : 'border-black'}`} style={{ background: c, boxShadow: cfg.color === c ? `0 0 14px ${c}` : undefined }} />
                  ))}
                  <input type="color" value={cfg.color} onChange={(e) => setCfg({ ...cfg, color: e.target.value })} className="w-11 h-9 bg-transparent cursor-pointer" />
                  <span className="text-xs text-white/50 font-semibold">Also sets energy, accent & eye colors</span>
                </div>
              </Section>
            </>)}

            {tab === 'APPEARANCE' && (<>
              <Section title="START FROM A PRESET LOOK">
                <div className="flex gap-1.5 flex-wrap">
                  {BASE_CHARACTERS.map((c) => (
                    <button key={c.id} onClick={() => copyLook(c.id)} className="w-10 h-10 border-2 border-black hover:border-white overflow-hidden cursor-pointer transition hover:scale-110" title={c.name}>
                      <img src={c.portrait} alt={c.name} className="w-full h-full object-cover object-top" />
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="HAIRSTYLE">
                <div className="flex gap-1.5 flex-wrap">{HAIRS.map(([h, n]) => <Chip key={h} on={L.hairStyle === h} color={cfg.color} onClick={() => setLook({ hairStyle: h })}>{n}</Chip>)}</div>
              </Section>
              <Section title="WEAPON">
                <div className="flex gap-1.5 flex-wrap">{WEAPONS.map(([w, n]) => <Chip key={w} on={L.weapon === w} color={cfg.color} onClick={() => setLook({ weapon: w })}>{n}</Chip>)}</div>
              </Section>
              <Section title="ACCESSORY">
                <div className="flex gap-1.5 flex-wrap">{MARKS.map(([m, n]) => <Chip key={m} on={(L.mark || 'none') === m} color={cfg.color} onClick={() => setLook({ mark: m })}>{n}</Chip>)}</div>
              </Section>
              <Section title="SKIN TONE">
                <div className="flex gap-2">{SKINS.map((s) => <button key={s} onClick={() => { setLook({ skin: s, fore: L.fore === L.skin ? s : L.fore }); sfx('select'); }} className={`w-9 h-9 rounded-full border-2 cursor-pointer ${L.skin === s ? 'border-white scale-110' : 'border-black'}`} style={{ background: s }} />)}</div>
              </Section>
              <Section title="COLORS">
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map(([k, n]) => (
                    <label key={k} className="flex items-center gap-2 bg-black/40 px-2 py-1 cursor-pointer hover:bg-white/5">
                      <input type="color" value={(L[k] as string) || '#000000'} onChange={(e) => setLook({ [k]: e.target.value } as any)} className="w-8 h-7 bg-transparent cursor-pointer" />
                      <span className="text-xs font-bold text-white/75">{n}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 bg-black/40 px-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={!!L.hair2} onChange={(e) => setLook({ hair2: e.target.checked ? '#e0302a' : undefined })} />
                    {L.hair2 && <input type="color" value={L.hair2} onChange={(e) => setLook({ hair2: e.target.value })} className="w-8 h-7 bg-transparent cursor-pointer" />}
                    <span className="text-xs font-bold text-white/75">Hair Tips</span>
                  </label>
                </div>
              </Section>
              <div className="grid grid-cols-2 gap-3">
                <Section title="CAPE / COAT">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer"><input type="checkbox" checked={!!L.cape} onChange={(e) => setLook({ cape: e.target.checked ? '#3a1f48' : undefined })} /> Enabled</label>
                    {L.cape && <input type="color" value={L.cape} onChange={(e) => setLook({ cape: e.target.value })} className="w-9 h-8 bg-transparent cursor-pointer" />}
                    {L.cape && <input type="range" min={22} max={52} value={L.capeLen || 34} onChange={(e) => setLook({ capeLen: +e.target.value })} className="flex-1" />}
                  </div>
                </Section>
                <Section title="BODY">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white/60">SIZE</span>
                    <input type="range" min={0.84} max={1.1} step={0.01} value={cfg.size} onChange={(e) => setCfg({ ...cfg, size: +e.target.value })} className="flex-1" />
                    <label className="flex items-center gap-1.5 text-xs font-bold text-white/70 cursor-pointer"><input type="checkbox" checked={!!L.ninjaRun} onChange={(e) => setLook({ ninjaRun: e.target.checked })} /> Ninja Run</label>
                  </div>
                </Section>
              </div>
            </>)}

            {tab === 'STATS' && (<>
              <Section title={`DISTRIBUTE POINTS · ${total}/${STAT_POINTS} USED`}>
                <div className="flex flex-col gap-3">
                  {([['power', 'POWER', 'Damage dealt by normal attacks'], ['speed', 'SPEED', 'Run speed, air control & jump height'], ['range', 'RANGE', 'Reach of normal attack hitboxes'], ['defense', 'DEFENSE', 'Weight — resist knockback']] as const).map(([k, n, d]) => (
                    <div key={k} className="flex items-center gap-4">
                      <div className="w-28"><div className="font-display text-2xl leading-none">{n}</div><div className="text-[11px] text-white/50 font-semibold">{d}</div></div>
                      <button onClick={() => setBar(k, -1)} className="w-9 h-9 bg-black/70 border-2 border-white/20 font-bold text-xl hover:border-white cursor-pointer">−</button>
                      <div className="flex gap-1.5 flex-1">
                        {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex-1 h-5 skew-panel transition" style={{ background: i < cfg.bars[k] ? cfg.color : 'rgba(255,255,255,0.1)', boxShadow: i < cfg.bars[k] ? `0 0 10px ${cfg.color}` : undefined }} />)}
                      </div>
                      <button onClick={() => setBar(k, 1)} className="w-9 h-9 bg-black/70 border-2 border-white/20 font-bold text-xl hover:border-white cursor-pointer">+</button>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="RESULTING ATTRIBUTES">
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[['DAMAGE', `×${(0.84 + cfg.bars.power * 0.06).toFixed(2)}`], ['RUN SPEED', (5.8 + cfg.bars.speed * 0.36).toFixed(1)], ['REACH', `×${(0.88 + cfg.bars.range * 0.05).toFixed(2)}`], ['WEIGHT', (0.82 + cfg.bars.defense * 0.08).toFixed(2)]].map(([a, b]) => (
                    <div key={a} className="bg-black/50 py-2"><div className="font-display text-3xl" style={{ color: cfg.color }}>{b}</div><div className="text-[10px] font-bold tracking-widest text-white/50">{a}</div></div>
                  ))}
                </div>
              </Section>
            </>)}

            {tab === 'MOVESET' && (<>
              <Section title="FIGHTING STYLE — LIGHT, HEAVY & AIR ATTACKS (24 MOVES)">
                <div className="grid grid-cols-5 gap-1.5">
                  {BASE_CHARACTERS.map((c) => (
                    <button key={c.id} onClick={() => { setCfg({ ...cfg, style: c.id }); sfx('select'); }}
                      className={`relative border-2 overflow-hidden cursor-pointer transition text-left ${cfg.style === c.id ? 'scale-[1.04]' : 'border-black opacity-75 hover:opacity-100'}`}
                      style={{ borderColor: cfg.style === c.id ? cfg.color : undefined }}>
                      <img src={c.portrait} alt="" className="w-full aspect-square object-cover object-top" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent px-1 pt-3 font-display text-[11px] leading-tight">{c.name.split(' ')[0].toUpperCase()}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[12px] text-white/65 font-semibold mt-2">
                  <b className="text-white">{src(cfg.style).moves.nlight.name}</b> → {src(cfg.style).moves.nlight2.name} → {src(cfg.style).moves.nlight3.name} · Heavy: {src(cfg.style).moves.ssig.name}
                </div>
              </Section>
              <div className="grid grid-cols-2 gap-3">
                {specialPick('nspec', 'NEUTRAL SPECIAL')}
                {specialPick('sspec', 'SIDE SPECIAL')}
                {specialPick('dspec', 'DOWN SPECIAL')}
                {specialPick('ult', 'ULTIMATE')}
              </div>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
