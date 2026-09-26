import { ReactNode, useMemo } from 'react';
import { sfx } from '../game/audio';
import menuImage from '../assets/menu.jpg';

export function ScreenBG({ img = menuImage, dim = 0.6, children }: { img?: string; dim?: number; children?: ReactNode }) {
  const embers = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    left: Math.random() * 100, size: 2 + Math.random() * 5, dur: 6 + Math.random() * 10, delay: -Math.random() * 16,
    color: ['#ff4757', '#ffb52e', '#7fd8ff', '#b067ff'][i % 4],
  })), []);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#07070d]">
      <div className="absolute inset-0 anim-slowzoom bg-cover bg-center" style={{ backgroundImage: `url(${img})` }} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(5,5,12,${dim * 0.7}) 0%, rgba(5,5,12,${dim}) 60%, rgba(5,5,12,${Math.min(1, dim + 0.3)}) 100%)` }} />
      <div className="absolute inset-0 speedlines opacity-60" />
      {embers.map((e, i) => (
        <span key={i} className="ember" style={{ left: `${e.left}%`, width: e.size, height: e.size, background: e.color, boxShadow: `0 0 10px ${e.color}`, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }} />
      ))}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, color = '#ff4757', className = '', big = false, disabled = false }: { children: ReactNode; onClick?: () => void; color?: string; className?: string; big?: boolean; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => !disabled && sfx('select')}
      onClick={() => { if (disabled) return; sfx('confirm'); onClick?.(); }}
      className={`group relative skew-panel overflow-hidden border-2 border-black/60 transition-all duration-150 ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer'} ${big ? 'px-10 py-3' : 'px-6 py-2'} ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `4px 4px 0 #000, 0 0 20px ${color}55` }}
    >
      <span className={`unskew block font-display ${big ? 'text-3xl' : 'text-xl'} tracking-wider text-white text-shadow-hard`}>{children}</span>
      <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition" />
    </button>
  );
}

export function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div className="relative z-10 flex items-center gap-6 px-8 pt-6">
      {onBack && (
        <button onClick={() => { sfx('back'); onBack(); }} onMouseEnter={() => sfx('select')}
          className="skew-panel bg-black/70 border-2 border-white/20 px-5 py-2 hover:bg-white/10 hover:border-white/50 transition cursor-pointer">
          <span className="unskew block font-display text-xl">◀ BACK</span>
        </button>
      )}
      <div className="anim-slide-l skew-panel bg-gradient-to-r from-[#ff4757] to-[#ff475700] pl-6 pr-24 py-1">
        <h1 className="unskew font-display text-5xl text-shadow-hard leading-none">{title}</h1>
      </div>
      {subtitle && <p className="text-white/60 text-lg font-semibold tracking-wide">{subtitle}</p>}
    </div>
  );
}

export function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold tracking-widest">
      <span className="w-16 text-white/60">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-6 h-2.5 skew-panel" style={{ background: i < value ? color : 'rgba(255,255,255,0.12)', boxShadow: i < value ? `0 0 6px ${color}` : 'none' }} />
        ))}
      </div>
    </div>
  );
}
