import { Action, InputState, emptyInput, InputKey } from './types';

export type Bindings = Record<Action, string[]>;

export const ACTIONS: { id: Action; label: string }[] = [
  { id: 'left', label: 'Move Left' },
  { id: 'right', label: 'Move Right' },
  { id: 'up', label: 'Aim Up' },
  { id: 'down', label: 'Aim Down / Drop / Fast-fall' },
  { id: 'jump', label: 'Jump' },
  { id: 'light', label: 'Light Attack' },
  { id: 'heavy', label: 'Heavy Attack' },
  { id: 'dodge', label: 'Dodge / Dash' },
  { id: 'special', label: 'Signature Special' },
  { id: 'awaken', label: 'Awaken / U Chain Starter' },
  { id: 'limit', label: 'Limit Break' },
  { id: 'ult', label: 'Ultimate' },
  { id: 'pause', label: 'Pause' },
];

export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  light: ['KeyH', 'KeyZ'],
  heavy: ['KeyJ', 'KeyX'],
  dodge: ['ShiftLeft', 'KeyC', 'KeyO'],
  special: ['KeyK', 'KeyV'],
  awaken: ['KeyU'],
  limit: ['KeyL'],
  ult: ['KeyR', 'KeyB', 'KeyI'],
  pause: ['Escape', 'KeyP'],
};

const LS = 'shonen-brawl-bindings-v5';
export function loadBindings(): Bindings {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_BINDINGS)) as Bindings;
  try {
    const current = localStorage.getItem(LS);
    const raw = current || localStorage.getItem('shonen-brawl-bindings-v4') || localStorage.getItem('shonen-brawl-bindings-v3');
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<Bindings>;
    const out = { ...defaults } as Bindings;
    for (const action of Object.keys(defaults) as Action[]) {
      const values = saved[action];
      if (Array.isArray(values)) out[action] = values.filter((key): key is string => typeof key === 'string' && !!key).slice(0, 3);
      if (!out[action].length && !current) out[action] = [...defaults[action]];
    }
    // A saved v5 layout is already migrated. Preserve the user's remapped keys.
    if (current) return out;
    // Migrate the v4 layout (J/K/L/H) to the new H/J/K/L combat layout.
    // Keep non-reserved custom alternates, but reserve the five technique/attack keys.
    const attackActions: Action[] = ['light', 'heavy', 'special', 'awaken', 'limit'];
    const reserved = new Set(['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyU']);
    for (const action of attackActions) out[action] = out[action].filter((key) => !reserved.has(key));
    out.light = ['KeyH', ...out.light.filter((key) => !reserved.has(key))].slice(0, 3);
    out.heavy = ['KeyJ', ...out.heavy.filter((key) => !reserved.has(key))].slice(0, 3);
    out.special = ['KeyK', ...out.special.filter((key) => !reserved.has(key))].slice(0, 3);
    out.awaken = ['KeyU', ...out.awaken.filter((key) => !reserved.has(key))].slice(0, 3);
    out.limit = ['KeyL', ...out.limit.filter((key) => !reserved.has(key))].slice(0, 3);
    return out;
  } catch { /* corrupted or unavailable storage falls back to defaults */ }
  return defaults;
}
export function saveBindings(b: Bindings) {
  try { localStorage.setItem(LS, JSON.stringify(b)); } catch { /* ignore */ }
}

export function keyLabel(code: string) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Space: 'SPACE', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', Escape: 'ESC', Enter: 'ENTER',
    AltLeft: 'L-ALT', AltRight: 'R-ALT', Tab: 'TAB', Backspace: 'BKSP',
  };
  return map[code] || code;
}

class Keyboard {
  down = new Set<string>();
  attached = false;
  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        const t = e.target as HTMLElement;
        if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'SELECT')) e.preventDefault();
      }
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }
}
export const keyboard = new Keyboard();

export function readGamepad(): (InputState & { pause: boolean }) | null {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const b = (i: number) => !!p.buttons[i] && p.buttons[i].pressed;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    return {
      left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), up: ay < -0.5 || b(12), down: ay > 0.5 || b(13),
      jump: b(0), heavy: b(1), light: b(2), special: b(3), awaken: b(4), dodge: b(5) || b(6), limit: b(7), ult: b(10) || b(11), pause: b(9),
    };
  }
  return null;
}

export function readPlayerInput(bind: Bindings): InputState & { pause: boolean } {
  const out = { ...emptyInput(), pause: false } as InputState & { pause: boolean };
  (Object.keys(bind) as Action[]).forEach((a) => {
    if (bind[a].some((k) => keyboard.down.has(k))) (out as any)[a] = true;
  });
  const gp = readGamepad();
  if (gp) (Object.keys(gp) as (InputKey | 'pause')[]).forEach((k) => { if ((gp as any)[k]) (out as any)[k] = true; });
  return out;
}

/** Tracks edges + input buffering for a fighter */
export class Controller {
  cur: InputState = emptyInput();
  prev: InputState = emptyInput();
  buf: Record<string, number> = {};
  static BUF = 7;
  feed(s: InputState) {
    this.prev = this.cur;
    this.cur = { ...s };
    for (const k of Object.keys(s) as InputKey[]) {
      if (s[k] && !this.prev[k]) this.buf[k] = 0;
      else if (this.buf[k] !== undefined) this.buf[k]++;
    }
  }
  pressed(k: InputKey) { return this.buf[k] !== undefined && this.buf[k] < Controller.BUF; }
  consume(k: InputKey) { this.buf[k] = 99; }
  justPressed(k: InputKey) { return this.cur[k] && !this.prev[k]; }
  dirX() { return (this.cur.right ? 1 : 0) - (this.cur.left ? 1 : 0); }
  dirY() { return (this.cur.down ? 1 : 0) - (this.cur.up ? 1 : 0); }
  clear() { this.buf = {}; }
}
