import { setVolume } from './audio';

export interface Settings { tapJump: boolean; volume: number; }
const KEY = 'shonen-brawl-settings-v1';
export function loadSettings(): Settings {
  try { const s = localStorage.getItem(KEY); if (s) { const v = { tapJump: false, volume: 0.55, ...JSON.parse(s) }; setVolume(v.volume); return v; } } catch { /* ignore */ }
  return { tapJump: false, volume: 0.55 };
}
export function saveSettings(s: Settings) {
  setVolume(s.volume);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
