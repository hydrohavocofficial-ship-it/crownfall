import { ARENAS, ArenaDef, PREVIEW_ARENA, arenaById } from './arenas';
import { CHARACTERS, charById, MoveKey } from './characters';
import { Fighter } from './fighter';
import { AI } from './ai';
import { Effects } from './effects';
import { ReplayBuffer } from './replay';
import { ScreenDistortion } from './effects/screenDistortion';
import { Projectile, ProjSpec } from './projectiles';
import { Bindings, keyboard, keyLabel, readPlayerInput } from './input';
import { drawContactShadow } from './render';
import { SIGS } from './signatures';
import { DummyMode, InputState, MatchConfig, MatchResult, Rect, emptyInput } from './types';
import { sfx, fadeClip, unlockAudio, preloadClips } from './audio';
import { preloadShrine } from './bossVfx';
import { customMatchError, normalizeMatchConfig, TEAM_COLORS, TEAM_NAMES } from './matchConfig';
import { JUGGLE_BUDGET, JUGGLE_POP, TIERS, tierOf, hitstopFrames, comboScale, comboKnockbackScale, launchDecay, MIN_DAMAGE_FRACTION, GAIN_ON_DEAL, GAIN_ON_TAKE, GAUGE_DRAIN } from './combat';
import { AWAKEN_MOVES } from './fighter';

export const FIGHTER_COLORS = ['#ff4757', '#3fa9ff', '#44e07a', '#ffb52e'];
const STEP = 1000 / 60;
/** Frames of no input handed back after a KO replay, so the blow can breathe. */
const REPLAY_AFTERMATH = 54;
/** Camera zoom, as a multiple of the base. See `settleCamera`. */
const MIN_ZOOM_K = 0.5;
const MAX_ZOOM_K = 1.34;
/**
 * The Ultra Instinct instant slip's internal gauge, in frames.
 *
 * Swept against a live fifteen-second exchange rather than picked: 120 let it
 * fire four times and cut incoming damage by 62%; 200, 240 and 300 all landed on
 * three fires and a 45% cut, because past that the cooldown is no longer what
 * limits it. See `tryInstantSlip`.
 */
const SLIP_COOLDOWN = 200;

const imgCache: Record<string, HTMLImageElement> = {};
export function loadImage(src: string): HTMLImageElement {
  if (!imgCache[src]) { const i = new Image(); i.src = src; imgCache[src] = i; }
  return imgCache[src];
}
export function preloadAll(): Promise<void> {
  preloadShrine();
  preloadClips();
  const srcs = [...CHARACTERS.map((c) => c.portrait), ...ARENAS.map((a) => a.bg)];
  return Promise.all(srcs.map((s) => new Promise<void>((res) => {
    const i = loadImage(s); if (i.complete) res(); else { i.onload = () => res(); i.onerror = () => res(); }
  }))).then(() => undefined);
}

export function dmgColor(d: number) {
  const stops: [number, number[]][] = [[0, [255, 255, 255]], [40, [255, 243, 138]], [80, [255, 177, 59]], [120, [255, 90, 42]], [170, [224, 16, 42]], [230, [120, 0, 16]]];
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (d - a) / (b - a);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * t)).join(',')})`;
    }
  }
  return 'rgb(120,0,16)';
}
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const FX_COLORS: Record<string, string> = { elec: '#7fd8ff', fire: '#ff7a1a', dark: '#ff2040', purple: '#b067ff', blunt: '#ffffff' };
/** A fresh cooldown book. The awakened tiers are per-stance, so all of them are listed. */
const emptyCds = () => ({
  nspec: 0, sspec: 0, dspec: 0, aspec: 0, aig: 0,
  naw: 0, saw: 0, daw: 0, aaw: 0,
  nwl: 0, swl: 0, dwl: 0, awl: 0,
  nwh: 0, swh: 0, dwh: 0, awh: 0,
  nfu: 0, sfu: 0, dfu: 0, afu: 0,
  boss_heavy2: 0,
});

/** Physics source for knockback, plus the ultimate-meter policy for delayed events. */
export interface HitSource { x: number; y: number; vx: number; vy: number; noMeter?: boolean; }

export interface GameOpts {
  bindings: Bindings; tapJump: boolean;
  onEnd?: (r: MatchResult) => void;
  onPauseKey?: () => void;
  preview?: string;
}

export type PreviewAction = 'light' | 'heavy' | 'special' | 'awaken' | 'awakened';
export type PreviewStance = 'neutral' | 'side' | 'down' | 'air';
export interface PreviewRequest { action: PreviewAction; stance: PreviewStance; followup?: boolean; label?: string; }

export class Game {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  cfg: MatchConfig; opts: GameOpts; arena: ArenaDef;
  fighters: Fighter[] = []; ais = new Map<Fighter, AI>();
  projectiles: Projectile[] = [];
  fx = new Effects();
  frame = 0; running = false; paused = false; raf = 0; last = 0; acc = 0;
  cam = { x: 0, y: -150, z: 0.8 }; shakeAmt = 0; flash = { c: '#fff', a: 0 };
  countdown = 170; timeLeft = 0; ended = false; endT = 0; timeScale = 1;
  cin: { f: Fighter; name: string; t: number } | null = null;
  W = 800; H = 600; dpr = 1;
  bg: HTMLImageElement | null = null;
  ambient: { x: number; y: number; vx: number; vy: number; s: number; r: number }[] = [];
  eliminatedOrder: Fighter[] = [];
  health = new Map<Fighter, { current: number; max: number }>();
  eliminatedAt = new Map<Fighter, number>();
  elapsedFrames = 0;
  finalResult: MatchResult | null = null;
  disposed = false;
  // training
  dummyMode: DummyMode = 'stand'; lockDamage: number | null = null; showHitboxes = false; infiniteMeter = false;
  dummyT = 0;
  prevPause = false;
  /** Per-fighter cleave audio gate, keyed by the frame the last slash played. */
  slashGate = new Map<Fighter, { frame: number; tier: 'light' | 'strong' }>();

  // ===========================================================================
  // SCREEN JUICE
  // Three cheap, self-decaying systems that turn a correct simulation into a
  // fight that *reads* like anime: negative frames, directional speed lines and
  // a camera punch-in. All three are pure presentation — none of them touches
  // the simulation, so they can never change a match result.
  // ===========================================================================
  /** Frames of high-contrast negative still to draw. Two is the classic amount. */
  negFrames = 0;
  /** Full-screen directional speed-line bursts. */
  speedLines: { ang: number; life: number; max: number; seed: number; power: number }[] = [];
  /** Camera punch-in: zoom and centre offset applied on top of the normal follow. */
  punch = { t: 0, x: 0, y: 0, mag: 0 };
  /** Radial lens ripple: the frame itself bends on a cinematic impact. */
  distortion = new ScreenDistortion();
  /**
   * KO REPLAY. A ring buffer of the last few seconds, so every knockout can be
   * played back: five seconds of lead-in, the blow, then the live aftermath.
   * Purely presentational - the simulation is simply not stepped while it runs.
   */
  replay = new ReplayBuffer();
  /** Frames of "no input" left after a replay, so the KO can breathe. */
  private postReplayLock = 0;
  /** Frames of replay shown. The world clock is frozen, so it needs its own. */
  private replayTick = 0;
  /**
   * NEGATIVE FRAME — the two-frame photographic inversion that shonen films cut
   * to on a fatal blow. Only two frames: any longer and the audience stops
   * reading the fight behind it.
   */
  negativeFrames(frames = 2) { this.negFrames = Math.max(this.negFrames, Math.max(1, Math.round(frames))); }

  /**
   * DIRECTIONAL SPEED LINES — a full-screen radial burst. `ang` is the
   * direction the lines streak *toward* the viewer, so it is passed the travel
   * direction of whatever triggered it.
   */
  speedBurst(ang: number, power = 1) {
    if (this.speedLines.length >= 6) this.speedLines.shift();
    this.speedLines.push({
      ang, power: Math.max(0.2, Math.min(2.2, power)),
      life: 14, max: 14, seed: Math.random() * 10,
    });
  }

  /** CAMERA PUNCH-IN — a hard zoom onto the impact, springing back out. */
  punchIn(x: number, y: number, mag = 0.15) {
    this.punch.x = x; this.punch.y = y; this.punch.mag = Math.max(this.punch.mag, Math.max(0, Math.min(0.35, mag)));
    this.punch.t = Math.max(this.punch.t, 10);
  }

  /**
   * RADIAL LENS DISTORTION — bends the whole frame around a world point. Used
   * for the handful of beats that have to feel cinematic (a counter that phases
   * behind you, a galaxy collapsing) rather than merely heavy.
   */
  distortAt(x: number, y: number, strength = 14, frames = 18) {
    const [, sy] = this.worldToScreen(x, y);
    this.distortion.pulse(sy * this.dpr, strength, frames, 1);
  }

  // ---------- time stop (Shadow DIO · Za Warudo) ----------
  /**
   * A real time stop, not a screen tint.
   *
   * While active, every fighter except the owner is skipped entirely, every
   * projectile in the world is suspended (including ones the owner just
   * created), and effects freeze mid-air. Damage the owner deals is recorded in
   * a pending queue instead of being applied, then released in one hit when
   * time resumes.
   */
  timeStop = {
    active: false, owner: null as Fighter | null,
    /** Real milliseconds remaining, measured independently of the sim clock. */
    realLeft: 0,
    /** Simulation-step backstop, so the stop always ends even without a clock. */
    stepsLeft: 0,
    radius: 0, age: 0, resumeFx: 0, endsAt: 0,
    /**
     * False while the caster is still locked in his own activation animation.
     * The world is already frozen, but the five-second budget does not begin to
     * drain until he is free to act — so "time stopped" always means five full
     * seconds of Shadow DIO actually moving through frozen time.
     */
    armed: false,
    /** Wall-clock guard so a stuck activation can never suspend the match forever. */
    holdMs: 0,
  };
  /** Combat events held back by time stop, released together on resume. */
  private pendingDamage: { owner: Fighter; target: Fighter; h: any; dir: number; ix: number; iy: number }[] = [];
  private timeStopCanvas: HTMLCanvasElement | null = null;
  private timeStopCtx: CanvasRenderingContext2D | null = null;
  /** Half-res scratch framebuffer used by the negative-frame composite. */
  private juiceCanvas: HTMLCanvasElement | null = null;
  private juiceCtx: CanvasRenderingContext2D | null = null;
  private timeStopRealAccum = 0;
  readonly TIME_STOP_MS = 5000;
  readonly TIME_STOP_STEPS = 300;
  /** Longest the caster may stay locked in the activation before the clock is forced on. */
  readonly TIME_STOP_HOLD_MS = 6000;
  previewRequest: PreviewRequest = { action: 'special', stance: 'neutral' };
  previewFrame = 0;
  previewFollowupFired = false;
  previewCounterPending = false;
  /** The awakened showcase is two presses, not one: the transformation, then the button. */
  previewAwakenSpent = false;

  constructor(canvas: HTMLCanvasElement, cfg: MatchConfig, opts: GameOpts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!; this.cfg = normalizeMatchConfig(cfg); this.opts = opts;
    const error = customMatchError(this.cfg);
    if (error && !opts.preview) throw new Error(error);
    this.arena = opts.preview ? PREVIEW_ARENA : arenaById(cfg.arena);
    if (this.arena.bg) this.bg = loadImage(this.arena.bg);
    keyboard.attach();
    this.setup();
    for (let i = 0; i < 70; i++) this.ambient.push(this.newAmbient(true));
  }

  setup() {
    this.fighters = []; this.ais.clear(); this.projectiles = []; this.fx = new Effects();
    this.frame = 0; this.ended = false; this.endT = 0; this.timeScale = 1; this.cin = null; this.eliminatedOrder = [];
    const cfg = this.cfg;
    this.health.clear(); this.eliminatedAt.clear(); this.elapsedFrames = 0; this.finalResult = null;
    if (this.opts.preview) {
      const f = new Fighter(charById(this.opts.preview), 0, '', FIGHTER_COLORS[0], true);
      f.x = -90; f.y = 0; f.facing = 1; f.meter = 100;
      const d = new Fighter(charById('asta'), 1, '', '#888', true);
      d.look = { ...d.look, skin: '#9aa0aa', hair: '#6b707a', top: '#50555f', top2: '#40444c', sleeve: '#5a5f69', fore: '#5a5f69', pants: '#454951', boots: '#33363c', cape: undefined, weapon: 'claws', eye: '#222' };
      d.x = 110; d.y = 0; d.facing = -1;
      this.fighters = [f, d]; this.countdown = 0; this.infiniteMeter = true;
      this.cam = { x: 20, y: -110, z: 1 };
      return;
    }
    const p = new Fighter(charById(cfg.player), 0, 'P1', FIGHTER_COLORS[0], false);
    this.fighters.push(p);
    cfg.cpus.forEach((c, i) => {
      const f = new Fighter(charById(c.char), i + 1, cfg.rule === 'training' ? 'DUMMY' : `CPU ${i + 1}`, FIGHTER_COLORS[i + 1], true);
      this.fighters.push(f);
      this.ais.set(f, new AI(f, c.diff));
    });
    this.fighters.forEach((f, i) => {
      const sp = this.arena.spawns[i % this.arena.spawns.length];
      f.x = sp[0]; f.y = sp[1]; f.facing = f.x > 0 ? -1 : 1;
      f.stocks = cfg.rule === 'stock' ? cfg.stocks : 99;
      if (cfg.mode === 'custom') {
        const c = cfg.custom!, settings = c.fighters[i];
        if (c.teams) f.color = TEAM_COLORS[settings.team];
        if (c.damageMode === 'stamina') {
          const max = settings.health ?? c.health;
          this.health.set(f, { current: max, max });
        }
      }
    });
    this.timeLeft = cfg.time * 60;
    this.countdown = cfg.rule === 'training' ? 0 : 170;
    this.cam = { x: 0, y: -150, z: this.baseZoom() * 0.7 };
  }

  baseZoom() { return Math.min(this.W / 1500, this.H / 850) * 1.25; }

  /**
   * The stage the camera is allowed to see, in world units.
   *
   * Colliders, not blast zones: the blast box is a kill plane out in empty sky,
   * and framing to it would push the ground off the bottom of the screen.
   */
  private stageBounds() {
    const s = this.arena.solids;
    if (!s || !s.length) return null;
    let l = Infinity, r = -Infinity, bottom = -Infinity;
    for (const q of s) { l = Math.min(l, q.x); r = Math.max(r, q.x + q.w); bottom = Math.max(bottom, q.y + q.h); }
    return { l, r, bottom, top: this.arena.blast.t };
  }

  /**
   * Camera ceiling and stage clamp, applied last so it cannot be fed back into
   * the next frame's framing.
   *
   * Zoom used to be free. The follow solve could ask for base*1.15, a cinematic
   * asked for base*1.7, and a punch then *multiplied* whatever it was handed by
   * up to 1.35 - so an ultimate landing inside a cinematic reached roughly 2.3x
   * base, close enough to the fighters' own height that the fight stopped being
   * readable. One hard ceiling makes every one of those effects safe to stack.
   */
  private settleCamera() {
    const bz = this.baseZoom();
    this.cam.z = Math.max(bz * MIN_ZOOM_K, Math.min(bz * MAX_ZOOM_K, this.cam.z));
    const sb = this.stageBounds();
    if (!sb) return;
    const halfW = this.W / this.cam.z / 2, halfH = this.H / this.cam.z / 2;
    // Horizontal: keep the whole visible width on the stage, or centre it when
    // the stage is narrower than the view.
    //
    // A fighter the blast has thrown past the edge of the stage is pulled into
    // the allowed range. Losing sight of your own character is a far worse
    // failure than briefly seeing the edge of the world, and the stage is only
    // 1040 units wide against a 2800-unit blast zone - so without this, a
    // hard launch sends the loser off camera and you never see the KO land.
    let l = sb.l, r = sb.r;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      l = Math.min(l, f.x - 150);
      r = Math.max(r, f.x + 150);
    }
    this.cam.x = (r - l) <= halfW * 2 ? (l + r) / 2 : Math.max(l + halfW, Math.min(r - halfW, this.cam.x));
    // Vertical: never sink into the ground, never fly out past the kill plane -
    // and never lose a fighter that is above the stage.
    let top = sb.top;
    for (const f of this.fighters) if (f.alive) top = Math.min(top, f.y - halfH * 0.6);
    const lo = top + halfH, hi = sb.bottom - 40 - halfH;
    this.cam.y = lo >= hi ? (top + sb.bottom) / 2 - halfH * 0.35 : Math.max(lo, Math.min(hi, this.cam.y));
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = Math.max(200, r.width); this.H = Math.max(150, r.height);
    this.canvas.width = Math.floor(this.W * this.dpr); this.canvas.height = Math.floor(this.H * this.dpr);
  }

  start() {
    this.resize(); this.disposed = false; this.running = true; this.last = performance.now();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    const tick = (now: number) => {
      if (!this.running) return;
      this.runFrame(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /**
   * One animation frame, behind the loop's fault boundary.
   *
   * The frame callback is the one piece of this game with no caller above it.
   * Anything thrown in there escapes into the browser, the `requestAnimationFrame`
   * re-arm never runs, and the whole match hangs on its last painted frame: no
   * error, no crash, no way out. That is exactly what a KO replay used to do.
   * So the boundary lives here - the fault is absorbed, reported once, and the
   * loop keeps running, because a frozen game cannot be debugged, inspected or
   * quit.
   */
  runFrame(now: number) {
    try { this.frame_(now); }
    catch (error) { this.reportFault(error); }
  }

  /** One animation frame. Split out of the callback so the callback can wrap it. */
  private frame_(now: number) {
    const dt = Math.min(100, now - this.last); this.last = now;
    if (!this.opts.preview) {
      const pin = readPlayerInput(this.opts.bindings);
      if (pin.pause && !this.prevPause && !this.ended) this.opts.onPauseKey?.();
      this.prevPause = pin.pause;
    }
    if (!this.paused) {
      // A replay runs on wall time. The match's own end-of-match slow motion is
      // deliberately ignored while one is on screen: it would otherwise turn a
      // seven-second knockout replay into twenty seconds that look like a hang.
      this.acc += dt * (this.replay.ownsScreen ? 1 : this.timeScale);
      let n = 0;
      while (this.acc >= STEP && n < 4) { this.step(); this.acc -= STEP; n++; }
      if (n === 4) this.acc = 0;
    }
    this.render();
  }

  /**
   * A fault raised by the simulation or the renderer.
   *
   * Reported once per distinct message so a systemic problem is visible in the
   * console instead of drowned by it, and counted so the pause screen can admit
   * the match is degraded instead of pretending nothing happened. The loop keeps
   * running either way.
   */
  private reportedFaults = new Set<string>();
  faults = 0;
  lastFault: string | null = null;
  private reportFault(error: unknown) {
    this.faults++;
    const message = error instanceof Error ? error.message : String(error);
    this.lastFault = message;
    if (this.reportedFaults.has(message)) return;
    this.reportedFaults.add(message);
    if (typeof console !== 'undefined') console.error('[combat] frame fault (match kept running):', error);
  }
  stop() { this.disposed = true; this.running = false; cancelAnimationFrame(this.raf); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); this.timeStop.active = false; this.timeStop.owner = null; for (const f of this.fighters) f.frozen = false; }
  setPaused(p: boolean) {
    // Pausing holds the time stop exactly where it is: neither the real-time
    // budget nor the step backstop advances while the game is not running.
    this.paused = p; this.last = performance.now();
    this.lastReal = performance.now();
  }

  // ---------- world queries ----------
  collide(f: Fighter) {
    const a = this.arena;
    f.x += f.vx;
    for (const s of a.solids) {
      const r = { x: f.x - f.hw, y: f.y - f.h, w: f.hw * 2, h: f.h };
      if (overlap(r, s)) {
        if (f.y - f.h < s.y + 2 && f.y > s.y && f.y - s.y < 14 && f.vy >= 0) continue; // will be resolved vertically
        if (f.vx > 0 || f.x < s.x + s.w / 2) f.x = s.x - f.hw; else f.x = s.x + s.w + f.hw;
        if (f.state === 'hitstun' && Math.abs(f.vx) > 7) { f.vx = -f.vx * 0.5; this.fx.burst(f.x, f.y - 40, 8, '#fff', 4, 'smoke', 20, 6); this.shake(4); } else f.vx = 0;
      }
    }
    const prevY = f.y;
    f.y += f.vy;
    f.grounded = false;
    for (const s of a.solids) {
      const r = { x: f.x - f.hw, y: f.y - f.h, w: f.hw * 2, h: f.h };
      if (!overlap(r, s)) continue;
      if (f.vy >= 0 && prevY <= s.y + 12) { f.y = s.y; f.vy = 0; f.grounded = true; }
      else if (f.vy < 0) { f.y = s.y + s.h + f.h; f.vy = 0; }
    }
    if (f.dropT <= 0 && !(f.state === 'hitstun' && f.vy > 12)) {
      for (const p of a.platforms) {
        if (f.vy >= 0 && prevY <= p.y + 0.5 && f.y >= p.y && f.x > p.x - 4 && f.x < p.x + p.w + 4) {
          if (f.ctrl.cur.down && f.state !== 'hitstun' && f.state !== 'attack' && !f.isCPU && f.fastFall) continue;
          f.y = p.y; f.vy = 0; f.grounded = true;
        }
      }
    }
    // stay-on-ground check (walking)
    if (!f.grounded && f.vy >= 0) {
      for (const p of a.platforms) if (f.dropT <= 0 && Math.abs(f.y - p.y) < 0.5 && f.x > p.x - 4 && f.x < p.x + p.w + 4) f.grounded = true;
    }
  }
  onOneWay(f: Fighter) { return this.arena.platforms.some((p) => Math.abs(f.y - p.y) < 1 && f.x > p.x - 4 && f.x < p.x + p.w + 4); }
  touchingWall(f: Fighter, side: number) {
    const r = { x: f.x - f.hw + side * 3, y: f.y - f.h, w: f.hw * 2, h: f.h * 0.8 };
    return this.arena.solids.some((s) => s.h > 100 && overlap(r, s) && f.y > s.y + 20);
  }
  groundBelow(x: number, y: number): number | null {
    let best: number | null = null;
    for (const s of this.arena.solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 2) best = best === null ? s.y : Math.min(best, s.y);
    for (const p of this.arena.platforms) if (x >= p.x && x <= p.x + p.w && p.y >= y - 2) best = best === null ? p.y : Math.min(best, p.y);
    return best;
  }
  nearestEdge(f: Fighter, biasX?: number) {
    let best = { x: 0, y: 0 }, bd = 1e9;
    for (const s of this.arena.solids) for (const x of [s.x + 20, s.x + s.w - 20]) {
      const d = Math.abs(x - f.x) + Math.max(0, s.y - f.y) * 0.5 + (biasX !== undefined ? Math.abs(x - biasX) : 0);
      if (d < bd) { bd = d; best = { x, y: s.y }; }
    }
    return best;
  }
  get teamMode() { return this.cfg.mode === 'custom' && !!this.cfg.custom?.teams; }
  teamOf(f: Fighter): number { return this.teamMode ? this.cfg.custom!.fighters[f.idx].team : f.idx; }
  // Relationship queries intentionally do not include liveness: KO credit needs defeated fighters.
  areEnemies(a: Fighter, b: Fighter): boolean { return a !== b && (!this.teamMode || this.teamOf(a) !== this.teamOf(b)); }
  canDamage(a: Fighter, b: Fighter): boolean { return a !== b && (this.areEnemies(a, b) || !!this.cfg.custom?.friendlyFire && this.teamMode); }
  getHealth(f: Fighter): { current: number; max: number } | null { const hp = this.health.get(f); return hp ? { ...hp } : null; }
  /**
   * Restores health, used by draining techniques. `ceilingFrac` is the highest
   * fraction of max health this particular heal may reach, so a drain can never
   * top a fighter back to full. Returns the amount actually restored so a move
   * can scale its own feedback to what really landed.
   */
  heal(f: Fighter, amount: number, ceilingFrac = 1): number {
    const hp = this.health.get(f);
    if (!hp || amount <= 0 || !f.alive) return 0;
    const ceiling = hp.max * Math.max(0, Math.min(1, ceilingFrac));
    const before = hp.current;
    hp.current = Math.min(ceiling, hp.current + amount);
    return hp.current - before;
  }
  damageMultiplier(f: Fighter) { return this.cfg.mode === 'custom' ? this.cfg.custom!.damage * this.cfg.custom!.fighters[f.idx].damage : 1; }
  knockbackMultiplier(f: Fighter) { return this.cfg.mode === 'custom' ? this.cfg.custom!.knockback * this.cfg.custom!.fighters[f.idx].knockback : 1; }
  nearestEnemy(f: Fighter, max = 9999) {
    let best: Fighter | null = null, bd = max;
    for (const e of this.fighters) if (this.areEnemies(f, e) && e.alive) { const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  // ---------- effects hooks ----------
  shake(n: number) { this.shakeAmt = Math.max(this.shakeAmt, n); }
  flashScreen(c: string, a: number) { this.flash = { c, a: Math.max(this.flash.a, a) }; }

  // ---------- awakening gauge policy ----------
  /**
   * The one shared rule that decides whether a hit may feed the attacker's
   * Awakening gauge. It lives in the damage pipeline so it applies to melee,
   * projectiles, explosions, damage-over-time, multi-hit awakened moves and
   * damage that is only registered later (for example Shadow DIO's Time Stop
   * release).
   *
   * A fighter never earns gauge from their own Awakening. `src.noMeter` lets a
   * caller carry that fact across a delay.
   */
  meterLocked(A: Fighter, h?: any, src?: HitSource): boolean {
    if (src && src.noMeter) return true;
    if (h && h.ultLocked) return true;
    // `awakenSealedT` covers the frames just after the state closed, so the blow
    // that emptied the gauge cannot be the blow that refills it.
    if (A.awakened || A.awakenSealedT > 0) return true;
    const ability = A.move?.ability;
    return ability === 'awaken' || ability === 'awakenLight' || ability === 'awakenHeavy' || ability === 'awakened';
  }

  // ---------- character audio ----------
  sukunaSlash(f: Fighter, tier: 'light' | 'strong' = 'light') {
    if (f.def.styleId !== 'sukuna') return;
    const gate = this.slashGate.get(f);
    const minGap = tier === 'strong' ? 7 : 4;
    if (gate && this.frame - gate.frame < minGap) return;
    this.slashGate.set(f, { frame: this.frame, tier });
    sfx(tier === 'strong' ? 'clip/strong-slash' : 'clip/slash', tier === 'strong' ? 1 : .8);
  }
  sukunaFugaSound(f: Fighter) { if (f.def.styleId === 'sukuna') sfx('clip/fuga'); }
  sukunaDomainSound(f: Fighter) { if (f.def.styleId === 'sukuna') sfx('clip/domain'); }
  /**
   * The domain's voice clears the mix on a scripted beat instead of being cut
   * off, so the Shrine roar fades out rather than stopping dead.
   */
  fadeDomainVoice(seconds = 1.6) { return fadeClip('sukuna-domain', seconds); }

  // ---------- time stop ----------
  /**
   * Activates Za Warudo. Refuses to start while another stop is running, while
   * the match is over, or while the caster is unavailable — which also covers an
   * interrupted startup, because an interrupted fighter never reaches the frame
   * that calls this.
   */
  startTimeStop(owner: Fighter) {
    if (this.timeStop.active || this.ended || this.paused || this.countdown > 0 || this.disposed) return false;
    if (!owner.alive || this.cin) return false;
    this.timeStop.active = true;
    this.timeStop.owner = owner;
    this.timeStop.realLeft = this.TIME_STOP_MS;
    this.timeStop.stepsLeft = this.TIME_STOP_STEPS;
    this.timeStopRealAccum = 0;
    this.timeStop.radius = 0;
    this.timeStop.age = 0;
    this.timeStop.resumeFx = 0;
    this.timeStop.endsAt = 0;
    this.timeStop.armed = false;
    this.timeStop.holdMs = 0;
    this.pendingDamage.length = 0;
    this.timeStopRealAccum = 0;
    this.lastReal = typeof performance !== 'undefined' ? performance.now() : 0;
    for (const f of this.fighters) f.frozen = f !== owner;
    sfx('clip/timestop');
    this.flashScreen('#dff5ff', 0.55);
    this.shake(16);
    owner.auraT = Math.max(owner.auraT, 40);
    return true;
  }
  /** True waiting-on-activation guard; see `TIME_STOP_HOLD_MS`. */
  private armTimeStop() {
    if (!this.timeStop.active || this.timeStop.armed) return;
    this.timeStop.armed = true;
    this.timeStop.realLeft = this.TIME_STOP_MS;
    this.timeStop.stepsLeft = this.TIME_STOP_STEPS;
    this.timeStopRealAccum = 0;
    this.lastReal = typeof performance !== 'undefined' ? performance.now() : 0;
    const o = this.timeStop.owner;
    if (o) {
      // A visible cue that the clock has truly started: the world snaps to grey
      // and Shadow DIO is handed his five seconds.
      this.fx.ring(o.x, o.y - 44, 14, 210, '#ffe45c', 24, 9);
      this.fx.ring(o.x, o.y - 44, 6, 120, '#8affd0', 18, 5);
      this.fx.text(o.x, o.y - 130, 'THE WORLD!', '#ffe45c', 24, 44);
    }
  }
  /** The caster is free once his own ultimate animation has released him. */
  private timeStopOwnerFree() {
    const o = this.timeStop.owner;
    if (!o) return true;
    if (!o.alive) return true;
    return !(o.state === 'attack' && o.move?.ability === 'awakened');
  }
  /** True when this fighter is being held in suspended time. */
  timeFrozen(f: Fighter) { return this.timeStop.active && this.timeStop.owner !== f; }
  /** True once the countdown is really draining, i.e. the caster is free to act. */
  timeStopClockRunning() { return this.timeStop.active && this.timeStop.armed; }
  /** Diagnostic/inspection hook: how many blows are waiting on the clock. */
  pendingDamageLength() { return this.pendingDamage.length; }

  /**
   * Records a hit instead of applying it. Invulnerability, team rules and the
   * per-attack dedupe map are still honoured now, so the same blow cannot be
   * queued twice, and the release pass re-validates liveness.
   */
  private queueTimeStopHit(owner: Fighter, target: Fighter, h: any, dir: number, ix: number, iy: number): boolean {
    if (target.invuln > 0) return false;
    if (!this.canDamage(owner, target) || !target.alive) return false;
    if (this.health.get(target)?.current === 0) return false;
    this.pendingDamage.push({ owner, target, h: { ...h, ultLocked: true }, dir, ix, iy });
    // Immediate, harmless feedback: the target is already frozen, so this only
    // paints a mark and a spark at the point of contact.
    target.flashT = 3;
    this.fx.burst(ix, iy, 5, '#8affd0', 3.4, 'spark', 12, 3);
    this.fx.ring(ix, iy, 3, 17, '#8affd0', 9, 2);
    return true;
  }

  /** Releases every queued blow at once, then restores the world. */
  private releaseTimeStop() {
    const queue = this.pendingDamage;
    this.pendingDamage = [];
    let hits = 0, peak = 0, last: { ix: number; iy: number } | null = null;
    for (const e of queue) {
      if (!e.target.alive) continue;
      // `noMeter` carries the ultimate policy across the delay, so the frozen
      // damage can never build Shadow DIO's own meter.
      const ok = this.applyHit(e.owner, e.target, e.h, e.dir, e.ix, e.iy, false, { x: e.ix, y: e.iy, vx: 0, vy: 0, noMeter: true });
      if (ok) { hits++; peak = Math.max(peak, e.h.dmg || 0); last = { ix: e.ix, iy: e.iy }; }
    }
    if (hits) {
      // A single, weighty release rather than a burst of separate impacts.
      const p = last || { ix: 0, iy: 0 };
      this.fx.impact(p.ix, p.iy, 70 + peak * 5, '#ffffff');
      this.fx.ring(p.ix, p.iy, 12, 150, '#8affd0', 22, 9);
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28; this.fx.add({ x: p.ix, y: p.iy, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, color: i % 2 ? '#8affd0' : '#ffe45c', kind: 'spark', life: 26, size: 4 }); }
      this.fx.text(p.ix, p.iy - 46, `TIME STOP × ${hits}`, '#ffe45c', 26, 46);
      this.flashScreen('#ffffff', 0.5);
      this.shake(Math.min(24, 8 + hits * 2));
      sfx('heavyhit', 2);
      for (const f of this.fighters) if (f.alive) f.hitstop = Math.max(f.hitstop, Math.min(20, 8 + hits));
    }
  }

  private endTimeStop() {
    if (!this.timeStop.active) return;
    this.releaseTimeStop();
    this.timeStop.active = false;
    this.timeStop.owner = null;
    for (const f of this.fighters) f.frozen = false;
    this.timeStop.resumeFx = 26;
    sfx('clip/time-resume');
    this.flashScreen('#ffffff', 0.4);
    this.shake(10);
  }

  /** Real elapsed time is only accumulated while the sim is actually running. */
  advanceRealTime(dtMs: number) {
    if (!this.timeStop.active || this.paused || this.ended) return;
    this.timeStopRealAccum += Math.max(0, Math.min(100, dtMs));
    this.timeStop.realLeft = Math.max(0, this.TIME_STOP_MS - this.timeStopRealAccum);
  }
  /** Wall-clock reading used only to pace the time stop; never for the sim. */
  private lastReal = 0;

  /**
   * DIRECTIONAL ANIME SPEED LINES.
   *
   * Drawn in screen space after the world and before the HUD, because the whole
   * point is to read as a *panel* effect rather than as something in the arena:
   * tapered rays converging on a vanishing point, streaking against the
   * direction of travel, with a clear hole in the middle so the fighters are
   * never hidden by their own momentum.
   */
  private drawSpeedLines(ctx: CanvasRenderingContext2D) {
    if (!this.speedLines.length) return;
    const W = this.W, H = this.H;
    const cx = W / 2, cy = H / 2;
    const R = Math.hypot(W, H) * 0.62;
    const RAYS = 30, SPREAD = 1.15;      // fan width in radians
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.speedLines) {
      const k = s.life / s.max;               // 1 → 0
      const punch = Math.pow(k, 0.6) * s.power;
      // The fan points *away* from the travel direction, so the rays streak
      // backwards out of the vanishing point like a real panel effect.
      const back = s.ang + Math.PI;
      // The hole in the middle opens up as the burst dies, so the fighters are
      // never buried under their own momentum.
      const inner = R * (0.36 - 0.12 * (1 - k));
      for (let i = 0; i < RAYS; i++) {
        // Seeded per-ray jitter: stable for the life of the burst, so the fan
        // does not strobe on the frames it is visible.
        const j = (Math.sin(i * 12.9898 + s.seed * 78.233) * 43758.5453) % 1;
        const jr = Math.abs(j);
        const a = back + (i / (RAYS - 1) - 0.5) * SPREAD * (0.7 + jr * 0.6);
        const rx = Math.cos(a), ry = Math.sin(a);
        const nx = -ry, ny = rx;               // unit normal to the ray
        const outer = R * (0.72 + jr * 0.42);
        // Tapered quad: hairline at the vanishing point, blade at the rim. This
        // is the shape that reads as a drawn speed line rather than a streak.
        // Kept thin on purpose - this is punctuation. Anything heavier stops
        // being a speed line and becomes a screen wipe.
        const wIn = 0.5 + jr * 0.9;
        const wOut = wIn + 1.6 + jr * 3.4;
        ctx.globalAlpha = punch * (0.05 + jr * 0.17);
        ctx.fillStyle = i % 5 === 0 ? '#ffffff' : i % 3 === 0 ? '#dbe9ff' : '#8fc7ff';
        ctx.beginPath();
        ctx.moveTo(cx + rx * inner + nx * wIn, cy + ry * inner + ny * wIn);
        ctx.lineTo(cx + rx * outer + nx * wOut, cy + ry * outer + ny * wOut);
        ctx.lineTo(cx + rx * outer - nx * wOut, cy + ry * outer - ny * wOut);
        ctx.lineTo(cx + rx * inner - nx * wIn, cy + ry * inner - ny * wIn);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Radial bloom over the centre keeps the fan from looking like loose sticks.
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(190,220,255,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /**
   * NEGATIVE FRAME INVERSION.
   *
   * The two-frame high-contrast photographic negative that shonen films cut to
   * on a fatal blow. The primary path re-composites the finished frame through
   * `filter: invert(100%) contrast(150%)`. A `difference` wash against white is
   * layered underneath unconditionally, so the effect still lands on a browser
   * that does not implement `ctx.filter` — the same graceful degradation the
   * time-stop desaturation uses.
   */
  private compositeNegative(ctx: CanvasRenderingContext2D) {
    if (this.negFrames <= 0) return;
    const W = this.W, H = this.H;
    const k = this.negFrames >= 2 ? 1 : this.negFrames;
    ctx.save();
    // Guaranteed path: `difference` against white is a true photographic inverse.
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = 0.92 * k;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    // Preferred path: the real filter, which also lifts contrast so the negative
    // snaps rather than merely turning pale. Its own half-res buffer: the time
    // stop already owns the shared one, and two effects must never alias.
    const off = this.ensureJuiceBuffer();
    if (off) {
      const buf = this.juiceCanvas!;
      off.setTransform(1, 0, 0, 1, 0, 0);
      off.clearRect(0, 0, buf.width, buf.height);
      off.drawImage(this.canvas, 0, 0, buf.width, buf.height);
      const filter = (ctx as any).filter;
      if (typeof filter === 'string' || filter === undefined) {
        try { ctx.filter = 'invert(100%) contrast(150%)'; } catch { ctx.filter = 'none'; }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.95 * k;
      ctx.drawImage(buf, 0, 0, W, H);
      ctx.filter = 'none';
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Half-resolution scratch framebuffer for the negative-frame composite. */
  private ensureJuiceBuffer(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const w = Math.max(2, Math.ceil(this.W * this.dpr * 0.5));
    const h = Math.max(2, Math.ceil(this.H * this.dpr * 0.5));
    if (!this.juiceCanvas) {
      this.juiceCanvas = document.createElement('canvas');
      this.juiceCtx = this.juiceCanvas.getContext('2d');
    }
    if (this.juiceCanvas.width !== w || this.juiceCanvas.height !== h) {
      this.juiceCanvas.width = w; this.juiceCanvas.height = h;
    }
    return this.juiceCtx;
  }

  cinematic(f: Fighter, name?: string, frames = 70) {
    sfx('ult');
    if (this.opts.preview) return;
    this.cin = { f, name: name || 'ULTIMATE', t: frames };
    this.flashScreen('#ffffff', 0.4);
  }
  spawnProj(s: ProjSpec) {
    // default every projectile to its owner's signature energy colours
    if (!s.col) s.col = s.owner?.look?.energy || '#ff7a1a';
    if (!s.col2) s.col2 = s.owner?.look?.energy2 || '#ffd24a';
    // Snapshot the gauge policy at spawn: a lingering shot must stay barred from
    // generating gauge even after its caster's animation ends.
    if (s.ultLocked === undefined) s.ultLocked = this.meterLocked(s.owner);
    /**
     * A retained set-piece scales everything it throws.
     *
     * Its melee hits are scaled when the move is built, but a domain's real
     * damage usually arrives on a projectile its choreography spawns, and a
     * "weakened" ultimate whose blast still hits for 34 is not weakened. Read
     * off the *owner's current move*, so it applies to exactly the frames the
     * set-piece is casting and nothing after.
     */
    const power = s.owner?.move?.domainPower;
    if (power !== undefined && power !== 1) {
      s.dmg = (s.dmg ?? 0) * power;
      if (s.fin) s.fin = { ...s.fin, dmg: s.fin.dmg * power, kb: s.fin.kb * power, sc: s.fin.sc * power };
    }
    this.projectiles.push(new Projectile(s));
  }

  /**
   * ULTRA INSTINCT — MIGATTE NO GOKUI (movement without thought).
   *
   * When a silver-haired fighter is in a neutral, walking or dodge-frame state
   * and a *non-ultimate* hitbox is about to connect, the body simply is not
   * there any more: a 30 px instant slip, a silver after-image, and the incoming
   * hitstun is cancelled outright.
   *
   * Fairness is deliberate and enforced here, not hoped for:
   *  - ultimates and anything the meter has locked out are exempt, so a
   *    committed super can always punish a whiffed read;
   *  - a 3.3-second internal gauge (`evadeCD`). This was measured, not guessed:
   *    over a fifteen-second exchange against a hard CPU, a 2s gauge let the slip
   *    fire four times and cut incoming damage from 53 to 20, while 3.3s and
   *    anything longer all landed on three fires and 29. Past that point the
   *    cooldown stops being the limit - what limits it is how often he is even
   *    standing still when a hitbox arrives - so a longer gauge would only be a
   *    number on paper.
   *  - a fighter already in hitstun, in hitstop, or already invulnerable is
   *    never eligible, so the passive cannot rescue a bad position. This is what
   *    keeps it from extending combos: the first hit of an exchange can be
   *    slipped, but the follow-ups land on a body that is already in hitstun.
   *
   * A meter cost was tried here and removed. Meter accrues at 0.4 per damage
   * *taken*, so a player who relies on this passive never accumulates enough to
   * pay for it, and the ability the whole character is named after silently
   * switched itself off. The gauge is the honest lever.
   *
   * Returns true when the slip consumed the hit.
   */
  private tryInstantSlip(T: Fighter, A: Fighter, h: { dmg?: number }): boolean {
    if (T.def.id !== 'goku_ui') return false;
    if (T.evadeCD > 0 || T.invuln > 0 || T.hitstop > 0) return false;
    if (T.state === 'hitstun' || T.state === 'ko' || T.state === 'wall') return false;
    // Mid-attack is a commitment. The one exception is the Autonomous Counter,
    // whose entire design is to be standing still when the blow arrives.
    const reading = T.state === 'attack' && T.moveKey === 'dspec' && !!T.move?.counter;
    if (T.state === 'attack' && !reading) return false;
    // A transformation's blow always lands: a slip would make the Awakening
    // unreactable. `meterLocked` is the engine's own definition of "this blow
    // belongs to a transformation", so the rule cannot drift from the rest.
    if (this.meterLocked(A, h as any)) return false;

    const away = T.x >= A.x ? 1 : -1;
    T.evadeCD = SLIP_COOLDOWN;                           // the internal gauge
    T.evadeT = 16;                                       // silver after-image window
    T.invuln = Math.max(T.invuln, 10);                   // the slip itself is intangible
    T.x += away * 30 * T.scale;
    T.vx = away * 11;
    if (!T.grounded) T.vy = Math.min(T.vy, -1.5);
    T.hitstun = 0; T.move = null; T.moveKey = null; T.ultTarget = null;
    T.state = T.grounded ? 'idle' : 'air'; T.stateT = 0;
    sfx('ui_slip'); sfx('ui_chime');
    // A supersonic whoosh line through the vacated space.
    this.fx.ring(T.x - away * 18 * T.scale, T.y - 40, 6, 74, '#e2e8f0', 16, 5);
    this.fx.bloom(T.x - away * 16 * T.scale, T.y - 40, 34, '#93c5fd', 14, 2.2);
    this.fx.impact(T.x - away * 20 * T.scale, T.y - 40, 46, '#e2e8f0');
    this.fx.directional(T.x - away * 22 * T.scale, T.y - 40, 12, away > 0 ? Math.PI : 0, 0.5, '#ffffff', 15, 'streak', 14, 3);
    this.fx.text(T.x + away * 44 * T.scale, T.y - 96, 'SLIP', '#e2e8f0', 22, 26);
    this.shake(4);
    return true;
  }

  applyHit(A: Fighter, T: Fighter, h: { dmg: number; ang: number; kb: number; sc: number; fx?: any; stun?: number; pull?: boolean; ultLocked?: boolean }, dir: number, ix: number, iy: number, force = false, src?: HitSource): boolean {
    if (this.disposed || this.ended || this.paused || this.countdown > 0 || !A.alive || !T.alive || !this.canDamage(A, T) || this.health.get(T)?.current === 0) return false;
    if (T.invuln > 0 && !force) return false;
    if (T.state === 'attack' && T.move?.counter && T.moveFrame >= T.move.counter[0] && T.moveFrame <= T.move.counter[1] && T.move.onCounter) {
      T.move.onCounter(T, A, this); return false;
    }
    if (this.tryInstantSlip(T, A, h)) return false;
    // Captured before the hit resolves, because "was he already swinging?" is the
    // whole definition of a counter hit and T.state is about to become hitstun.
    const counterHit = T.state === 'attack' && !!T.move;
    const tier = TIERS[tierOf(A.move?.ability, A.moveKey)];
    const setPieceHit = A.move?.ability === 'awakened' || A.move?.ability === 'awaken';
    const cursedExecution = A.def.id === 'sukuna' && (h.fx === 'slash' || h.fx === 'dark') && T.damage >= 100 ? 1.18 : 1;
    const blackFlashBonus = A.def.id === 'sukuna' && A.sukunaBlackFlash ? 1.75 : 1;
    // Stale-move decay: repeating the same move in a short window weakens it.
    const recent = A.recentMoves.filter((r) => r.frame > this.frame - 300 && r.key === A.moveKey).length;
    const stale = A.moveKey ? Math.max(.6, 1 - Math.max(0, recent - 1) * .13) : 1;
    /**
     * COMBO SCALING.
     *
     * `comboHits` is read *before* it is incremented below, so the first hit of a
     * sequence is unscaled and the tenth has given up most of its face value.
     * Damage falls slower than knockback on purpose: a long string should still
     * pay, but a long string should stop being able to launch - otherwise the tail
     * of a combo is both free and infinite.
     */
    const seq = T.comboTimer > 0 ? T.comboHits : 0;
    const dScale = comboScale(seq + 1);
    const kScale = comboKnockbackScale(seq + 1);
    const raw = h.dmg * stale * A.dmgMul() * cursedExecution * blackFlashBonus + (A.godT > 0 && h.fx === 'elec' ? 2 : 0);
    // A combo is never allowed to fully zero out: chip pressure is the point of
    // keeping a string going, and a hard cutoff turns long strings into whiffs.
    const scaled = Math.max(raw * dScale, raw * MIN_DAMAGE_FRACTION);
    const dmg = (tier.damage === 1 ? scaled : scaled * tier.damage) * this.damageMultiplier(A);
    const hp = this.health.get(T);
    if (hp) hp.current = Math.max(0, hp.current - dmg);
    T.damage += dmg; A.dmgDealt += dmg; T.dmgTaken += dmg; A.hitsLanded++;
    if (this.lockDamage !== null && this.cfg.rule === 'training' && T.isCPU) T.damage = this.lockDamage;
    // Universal rule: an Awakening never feeds its own gauge.
    if (!this.meterLocked(A, h, src)) A.meter = Math.min(100, A.meter + dmg * GAIN_ON_DEAL);
    T.meter = Math.min(100, T.meter + dmg * GAIN_ON_TAKE);
    /**
     * JUGGLE BUDGET AND LAUNCH DECAY.
     *
     * A hit that would put an airborne body back up spends one of its re-launch
     * chances; past the budget it is converted into a shove instead. Separately,
     * the n-th launch of a sequence launches less far, so the move a player
     * spams at the edge of the stage stops working before it stops being fun.
     */
    const lifts = h.ang > 30 && h.ang < 150;
    let launching = lifts && !h.pull && T.damage > 0;
    // Touching the floor is where a juggle is paid back. Read before the launch
    // decision, so a grounded body always starts the next string with a full
    // budget - a target that lands and is immediately lifted again is a new
    // juggle, not the tail of the old one.
    if (T.grounded) { T.juggleCount = 0; T.juggleLeft = JUGGLE_BUDGET; }
    if (launching && !T.grounded) {
      if (T.juggleLeft <= 0) launching = false;
      else T.juggleLeft--;
    }
    // A lift aimed at a body that is already up and out of chances. Read after the
    // budget, so "refused" means refused rather than "not considered".
    const budgetSpent = lifts && !h.pull && !T.grounded && T.damage > 0 && !launching;
    const decay = launchDecay(T.juggleCount + 1);
    const kb = (h.kb * (launching ? decay : 1) + h.sc * (hp ? 0 : T.damage / 100) * 1.25)
      / T.def.stats.weight
      * tier.knockback * kScale
      * (A.devilT > 0 ? 1.1 : 1)
      * this.knockbackMultiplier(A);
    const rad = (h.ang * Math.PI) / 180;
    let vx = Math.cos(rad) * kb * dir, vy = -Math.sin(rad) * kb;
    // Spending the last of the budget leaves the body falling rather than
    // floating: the juggle ends, visibly. Without this the refusal would only
    // have skipped the decay, and a spammed launcher would keep launching at
    // full strength - which is the exact infinite the budget exists to stop.
    if (budgetSpent) vy = Math.max(vy, -JUGGLE_POP);
    if (h.pull) {
      const S = src || { x: A.x + dir * 30 * A.scale, y: A.y - 10, vx: A.vx, vy: A.vy };
      T.vx = (S.vx * 0.85 + (S.x - T.x) * 0.12) * this.knockbackMultiplier(A);
      T.vy = (S.vy * 0.85 + (S.y - T.y) * 0.1 - 0.5) * this.knockbackMultiplier(A);
      T.hitstun = 16 + (h.stun || 0) + tier.stun;
    } else {
      T.vx = vx; T.vy = vy;
      T.hitstun = Math.floor(8 + kb * 2.3) + (h.stun || 0) + tier.stun;
    }
    if (launching) T.juggleCount++;
    T.state = 'hitstun'; T.move = null; T.moveKey = null; T.ultTarget = null; T.stateT = 0;
    if (T.vy < 0) T.grounded = false;
    T.fastFall = false; T.airDodgeUsed = false; T.recoveryUsed = false; T.jumps = Math.max(T.jumps, 1);
    T.lastHitBy = A; T.lastHitTime = this.frame; T.lastHitDmg = dmg;
    T.comboHits++; T.comboDmg += dmg; T.comboTimer = 45;
    // Impact weight scales with the blow, so a jab and a launcher never read alike.
    const weight = Math.min(1, dmg / 24);
    const hs = h.pull ? 2 : hitstopFrames(tier, dmg, kb);
    /**
     * A field its own caster is standing inside does not freeze that caster.
     *
     * A Domain re-cuts on a timer for five seconds. If every one of those cuts
     * spent hitstop on the attacker, the caster would spend the whole set-piece
     * frozen and its choreography would run at a fifth of its authored speed -
     * the freeze would be fighting the animation frame for frame. The victim
     * still takes the full stop; only the man holding the field is exempt.
     */
    const ownField = !!(h as any).data?.domain;
    A.hitstop = Math.max(A.hitstop, ownField ? 0 : hs);
    T.hitstop = Math.max(T.hitstop, hs);
    T.flashT = 6;
    // FX
    // hit sparks always use the attacker's signature colour so no two fighters read alike
    const base = FX_COLORS[h.fx as string];
    const col = !h.fx || h.fx === 'slash' || h.fx === 'blunt' ? A.look.energy : base || A.look.energy;
    // A sustained beam re-hits on a short cadence, so the full per-contact
    // punctuation stacks dozens of rings and glow discs on one point and buries
    // the shot. Those moves opt out and rely on their own visuals.
    const quiet = A.move?.quietHits === true;
    this.fx.burst(ix, iy, quiet ? 3 : 5 + Math.floor(dmg * 0.9), col, 4.5 + kb * 0.4, 'spark', 20, 4);
    if (!quiet) {
      this.fx.add({ x: ix, y: iy, color: col, kind: 'glow', life: 10, size: 12 + dmg * 1.2 });
      this.fx.ring(ix, iy, 5, 20 + dmg * 3, col, 12, 4 + weight * 4);
    }
    if (!h.pull && kb > 9) this.fx.directional(ix, iy, 8 + Math.floor(weight * 8), Math.atan2(vy, vx), 0.6, '#ffffff', 14, 'streak', 16, 3);
    if (h.fx === 'elec') { for (let i = 0; i < 3; i++) this.fx.bolt(ix, iy, ix + (Math.random() - .5) * 90, iy + (Math.random() - .5) * 90, '#7fd8ff', 7, 2); }
    if (h.fx === 'fire') for (let i = 0; i < 6; i++) this.fx.add({ x: ix, y: iy, vx: (Math.random() - .5) * 6, vy: -Math.random() * 5, color: '#ff7a1a', kind: 'ember', life: 26, size: 9 });
    if (h.fx === 'dark') for (let i = 0; i < 6; i++) this.fx.add({ x: ix, y: iy, vx: (Math.random() - .5) * 5, vy: (Math.random() - .5) * 5, color: '#14020a', kind: 'smoke', life: 26, size: 10 });
    if (A.def.id === 'sukuna' && A.sukunaBlackFlash) {
      this.fx.impact(ix, iy, 118, '#ff174d');
      this.fx.cut(ix, iy, 190, A.facing > 0 ? -.4 : Math.PI + .4, 22, 1.4);
      this.fx.ring(ix, iy, 8, 150, '#ff315d', 22, 10);
      this.flashScreen('#ff174d', .7); this.shake(18); this.fx.text(ix, iy - 42, 'BLACK FLASH', '#ff315d', 32, 42); sfx('purple');
    }
    if (h.fx === 'purple') this.fx.ring(ix, iy, 10, 80, '#b067ff', 16, 8);
    if (!h.pull) {
      this.shake(Math.min(26, 2 + kb * 0.6 + weight * 6));
      // Decal scale is bounded. A fighter is about 78 world units tall, and these
      // radii used to run past 70 on a heavy blow - a sticker wider than the man
      // it is attached to, which buries the pose the hit was supposed to sell.
      // Capped, and the manga star shrinks as the blow gets heavier so the read
      // stays "one big hit" rather than "a bigger sticker".
      if (!quiet && (dmg >= 6 || kb > 9)) this.fx.impact(ix, iy, Math.min(44, 18 + dmg * 2 + kb * 1.2), col);
      // Debris shards scatter along the knockback line for heavier contacts.
      if (weight > 0.35) {
        const a = Math.atan2(vy, vx);
        for (let i = 0; i < 3 + Math.floor(weight * 7); i++) {
          const sp = a + (Math.random() - .5) * 1.5;
          this.fx.add({ x: ix, y: iy, vx: Math.cos(sp) * (3 + Math.random() * 9), vy: Math.sin(sp) * (3 + Math.random() * 8) - 1, color: i % 2 ? col : '#ffffff', kind: 'shard', life: 16 + Math.random() * 10, size: 3 + Math.random() * 3, grav: .34 });
        }
      }
      // ---- HEAVY-HIT SCREEN JUICE ------------------------------------------
      // A double-pass bloom on the contact point, a chromatic shockwave on the
      // really big blows, manga calligraphy, a speed-line burst along the
      // knockback axis and a camera punch-in. None of this touches the sim.
      this.fx.bloom(ix, iy, 16 + dmg * 1.6, col, 14, 2.4 + weight * 3);
      if (!quiet && (dmg >= 11 || weight > 0.5)) {
        this.fx.shock(ix, iy, Math.min(58, 28 + dmg * 2), col, 18);
        this.speedBurst(Math.atan2(vy, vx), 0.6 + weight * 0.8);
        this.punchIn(ix, iy, 0.08 + weight * 0.09);
      }
      if (kb > 17) {
        this.flashScreen('#ffffff', 0.16 + weight * .18);
        this.fx.word(ix, iy - 34, T.damage > 150 ? 'SMASH!' : 'CRASH!', col, 46, 30);
      }
      // The single biggest contacts get their own word, so the biggest hit in
      // the exchange is always the loudest thing on the panel.
      if (weight >= 1 && dmg >= 18) this.fx.word(ix, iy - 112, 'BOOM!', col, 58, 38);
      // A readable number for anything that really hurt.
      if (dmg >= 9) this.fx.text(ix, iy - 14 - Math.random() * 8, `${Math.round(dmg)}`, col, 20 + Math.min(18, dmg), 34);

      // ---- NEGATIVE FRAME -------------------------------------------------
      // Two frames of high-contrast inversion on the three beats a shonen film
      // reserves it for: a counter, a fatal blow, and anything the awakened kit
      // landed. Followed by the chromatic shockwave already queued above.
      const fatal = T.damage >= 140 && dmg >= 9;
      if (setPieceHit || (counterHit && dmg >= 7) || fatal) {
        this.negativeFrames(2);
        this.fx.word(ix, iy - 60, setPieceHit ? 'GODLIKE!' : fatal ? 'ZASH!' : 'COUNTER!',
          setPieceHit ? '#e2e8f0' : col, 52, 36);
      }
    }
    sfx(dmg >= 11 ? 'heavyhit' : 'hit', kb / 12);
    if (h.fx === 'elec' && dmg > 5) sfx('elec');
    if (h.fx === 'fire' && dmg > 8) sfx('fire');
    return true;
  }

  projectileFinish(p: Projectile) {
    if (!p.owner.alive) return;
    const r = { x: p.x - p.w * 0.6, y: p.y - p.h * 0.6, w: p.w * 1.2, h: p.h * 1.2 };
    const col = FX_COLORS[p.fx] || '#fff';
    this.fx.ring(p.x, p.y, 20, Math.max(p.w, p.h) * 0.8, col, 22, 12);
    this.fx.burst(p.x, p.y, 30, col, 10, 'ember', 30, 10);
    // A finisher detonating is the loudest event a projectile can make: dual-pass
    // bloom, a chromatic shockwave, the manga word and a camera punch.
    this.fx.bloom(p.x, p.y, Math.max(p.w, p.h) * 0.7, col, 18, 5);
    this.fx.shock(p.x, p.y, Math.max(p.w, p.h) * 0.5, col, 22);
    this.fx.word(p.x, p.y - Math.max(p.w, p.h) * 0.4 - 30, 'BOOM!', col, 52, 34);
    this.punchIn(p.x, p.y, 0.11);
    this.speedBurst(p.dir > 0 ? 0 : Math.PI, 0.9);
    this.shake(12); sfx('heavyhit');
    for (const T of this.fighters) {
      if (!this.canDamage(p.owner, T) || !T.alive || T.invuln > 0) continue;
      if (overlap(r, { x: T.x - T.hw, y: T.y - T.h, w: T.hw * 2, h: T.h })) this.applyHit(p.owner, T, { ...p.fin!, fx: p.fx, ultLocked: p.ultLocked }, p.dir, T.x, T.y - T.h / 2);
    }
  }

  respawn(f: Fighter) {
    const hp = this.health.get(f); if (hp) hp.current = hp.max;
    const [rx, ry] = this.arena.respawn;
    f.x = rx + (f.idx - 1.5) * 60; f.y = ry; f.vx = 0; f.vy = 0; f.state = 'air'; f.damage = 0; f.invuln = 150;
    f.jumps = f.maxJumps; f.recoveryUsed = false; f.airDodgeUsed = false; f.comboHits = 0; f.comboDmg = 0;
    f.move = null; f.moveKey = null; f.moveConnected = false; f.hitMap.clear(); f.ctrl.clear(); f.recentMoves = []; f.hitstop = 0; f.hitstun = 0; f.tumble = 0; f.lastHitBy = null;
    f.sukunaFlash = 0; f.sukunaBlackFlash = false; f.sukunaLaunchTarget = null; f.sukunaGrabTarget = null; f.koCueFired = false; f.laughCueFired = false;
    f.standT = 0; f.standDur = 0; f.standAttackT = 0; f.standActive = false; f.frozen = false;
    // Respawning is not a fresh awakening: a fighter who fell mid-state comes back
    // sealed, with an empty bar and a clean set of cooldowns.
    f.awakened = false; f.meter = 0; f.awakenLock = 0; f.juggleLeft = JUGGLE_BUDGET;
    for (const key of Object.keys(f.cds)) f.cds[key] = 0;
    this.fx.ring(f.x, f.y - 40, 10, 70, f.color, 24, 6);
    this.fx.burst(f.x, f.y - 40, 20, f.color, 6, 'glow', 26, 5);
  }

  ko(f: Fighter) {
    if (!f.alive || this.ended) return;
    // A stopped world cannot outlive the fighter holding it: release the queued
    // damage and let normal time resume.
    if (this.timeStop.active && this.timeStop.owner === f) this.endTimeStop();
    // Falling in an Awakening costs the whole thing. The gauge was spent, the
    // state is gone, and the bar goes to zero rather than keeping whatever was
    // left of the drain - otherwise a knockout with nine points showing would
    // hand the Awakening straight back on respawn and make dying in it free.
    f.endAwaken();
    f.awakenLock = 0;
    f.juggleLeft = JUGGLE_BUDGET;
    for (const key of AWAKEN_MOVES) f.cds[key] = 0;
    const hp = this.health.get(f); if (hp) hp.current = 0;
    const b = this.arena.blast;
    const px = Math.max(b.l + 40, Math.min(b.r - 40, f.x)), py = Math.max(b.t + 40, Math.min(b.b - 40, f.y));
    const ang = Math.atan2(this.cam.y - py, this.cam.x - px);
    this.fx.beam(px, py, ang, f.color);
    this.fx.burst(px, py, 50, f.color, 16, 'glow', 40, 8);
    this.fx.ring(px, py, 20, 260, '#ffffff', 30, 16);
    this.shake(24); this.flashScreen(f.color, 0.35); sfx('ko');
    // Shadow DIO's defeat cue, once per fall, whenever he is the one who falls.
    if (f.def.styleId === 'shadowdio' && !f.koCueFired) { f.koCueFired = true; sfx('clip/death'); }
    f.state = 'ko'; f.koT = this.cfg.rule === 'training' ? 50 : 110; f.vx = 0; f.vy = 0; f.move = null; f.godT = 0; f.devilT = 0; f.trail = [];
    const killer = f.lastHitBy && this.frame - f.lastHitTime < 420 ? f.lastHitBy : null;
    f.falls++;
    if (killer && this.areEnemies(killer, f)) {
      killer.kos++; killer.score++;
      // Sukuna laughs at every knockout he is credited with. The guard lives on
      // the victim, so it fires once per fall and again on the next one.
      if (killer.def.styleId === 'sukuna' && !f.laughCueFired) { f.laughCueFired = true; sfx('clip/laugh'); }
    } else if (killer && killer !== f) killer.score--; // team KO: penalty, never a reward
    f.score--; // fall penalty (+1 per KO, -1 per fall)
    if (this.cfg.rule === 'stock') {
      f.stocks--;
      if (f.stocks <= 0) {
        f.eliminated = true;
        f.placement = this.fighters.filter((x) => !x.eliminated).length + 1;
        this.eliminatedOrder.push(f); this.eliminatedAt.set(f, this.frame);
      }
    }
    const tx = Math.max(this.cam.x - 300, Math.min(this.cam.x + 300, px));
    const ty = Math.max(this.cam.y - 200, Math.min(this.cam.y + 150, py));
    this.fx.text(tx, ty, f.eliminated ? 'ELIMINATED!' : 'K.O.!', f.color, 54, 70);
    // Raise the replay last, once the knockout is fully applied.
    //
    // Order matters: `arm` stashes the live world so it can be handed back
    // exactly as the replay found it. Armed any earlier, it would capture the
    // frame *before* the knockdown and restoring it would quietly stand the
    // loser back up the instant the replay ended.
    //
    // It is deliberately left armed for a short beat, so the KO impact itself
    // plays out at full speed before anything rewinds.
    this.replay.arm(this, 26);
    this.postReplayLock = 0;
  }

  // ---------- main step ----------
  step() {
    // A KO replay owns the screen: the simulation is not stepped at all, and
    // the renderer draws from the recorded ring buffer instead. Nothing here can
    // touch damage, meter or the match clock, because nothing here runs the sim.
    if (this.replay.active) {
      this.replay.advance(this.frame);
      if (this.replay.active) { this.replayTick++; this.replay.apply(this); }
      else {
        // The blow is on screen again, live and uninterrupted. Everything the
        // replay swapped in is dropped so the resumed frame starts clean.
        this.replay.release(this);
        this.postReplayLock = REPLAY_AFTERMATH;
        this.fx.clear();
      }
      return;
    }
    // The replay is over, but the knockdown still has to play out. Without this
    // countdown the no-input window never closes, and because `ownsScreen`
    // trusts it the match's own time scale is never restored either - a quiet,
    // permanent slowdown that reads exactly like a freeze.
    this.replay.tickAftermath(this.frame);
    if (this.replay.armed && !this.opts.preview) {
      if (this.replay.tickArm()) {
        this.postReplayLock = 0; this.replayTick = 0;
        // Paint the first recorded frame on the very frame the replay starts.
        // Without this the opening frame is still the live knockout - so the
        // "ELIMINATED!" banner flashes over the top of the rewind for one frame.
        this.replay.apply(this);
        return;
      }
      if (this.replay.active) return;
    }
    // The time-stop budget is measured against the wall clock here rather than
    // against the simulation clock, so it lasts exactly five real seconds no
    // matter how the step loop is paced. The budget only drains once the caster
    // is free to act (see `armed`); pausing holds the countdown.
    if (this.timeStop.active) {
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const dt = this.lastReal ? Math.max(0, Math.min(100, now - this.lastReal)) : STEP;
      this.lastReal = now;
      if (this.timeStop.armed) this.advanceRealTime(dt);
      else {
        // Still inside the activation: burn the wall-clock hold allowance only.
        this.timeStop.holdMs += dt;
        if (this.timeStop.holdMs >= this.TIME_STOP_HOLD_MS) this.armTimeStop();
      }
    }
    this.frame++;
    const ts = this.timeStop;
    // Time Stop freezes the presentation layer too: sparks, rings and text hang
    // in the air exactly where they were, which sells the suspension.
    if (!ts.active) this.fx.update();
    else ts.age++;
    if (ts.resumeFx > 0) ts.resumeFx--;
    if (this.shakeAmt > 0) this.shakeAmt *= 0.86;
    if (this.flash.a > 0) this.flash.a = Math.max(0, this.flash.a - 0.03);
    // Screen juice decays on its own clock so it can never leak into a later
    // exchange: negative frames, speed lines and the camera punch-in.
    if (this.negFrames > 0) this.negFrames--;
    if (this.punch.t > 0) { this.punch.t--; if (this.punch.t === 0) this.punch.mag = 0; }
    this.distortion.update();
    for (const s of this.speedLines) s.life--;
    if (this.speedLines.length && this.speedLines[0].life <= 0) this.speedLines.shift();
    if (!ts.active) this.updateAmbient();
    if (this.cin) {
      this.cin.t--;
      // A cinematic stops the world; it does not stop the Awakening. The gauge is
      // the clock the player is reading off the HUD, so it keeps falling while
      // the camera is busy - otherwise a set-piece would silently hand back time.
      for (const f of this.fighters) f.drainAwaken();
      this.updateCamera();
      if (this.cin.t <= 0) this.cin = null;
      return;
    }
    if (ts.active) {
      // The wave crosses the entire map in about half a second, then holds.
      const spread = 1 - Math.pow(1 - Math.min(1, ts.age / 34), 3);
      ts.radius = spread * 5200;
      // Five real seconds of moving time, with a simulation backstop for a
      // frozen clock. The budget stays untouched until the caster can act.
      if (ts.armed) {
        ts.stepsLeft--;
        if (ts.stepsLeft <= 0 || ts.realLeft <= 0) { this.endTimeStop(); }
      } else if (this.timeStopOwnerFree()) this.armTimeStop();
    }
    if (this.countdown > 0) {
      this.countdown--;
      if (this.countdown === 150 || this.countdown === 100 || this.countdown === 50) sfx('count');
      if (this.countdown === 0) sfx('go');
    }

    if (!this.opts.preview && !this.ended && this.countdown === 0 && !ts.active) this.elapsedFrames++;

    // inputs
    // A knockout hands control back with a beat of silence: without it the
    // player can eat a combo on the very frame the replay ends.
    const locked = this.postReplayLock > 0;
    if (locked) this.postReplayLock--;
    for (const f of this.fighters) {
      let inp: InputState = emptyInput();
      if (this.opts.preview) inp = this.previewInput(f);
      else if (this.countdown > 0 || this.ended || locked) inp = emptyInput();
      else if (this.timeFrozen(f)) inp = emptyInput();
      else if (!f.isCPU) {
        const r = readPlayerInput(this.opts.bindings);
        inp = { left: r.left, right: r.right, up: r.up, down: r.down, jump: r.jump || (this.opts.tapJump && r.up), light: r.light, heavy: r.heavy, dodge: r.dodge, special: r.special, awaken: r.awaken };
      } else if (this.cfg.rule === 'training') inp = this.dummyInput(f);
      else inp = this.ais.get(f)!.think(this);
      f.ctrl.feed(inp);
    }
    if (this.infiniteMeter) for (const f of this.fighters) if (!f.isCPU || this.opts.preview) f.meter = 100;
    if (this.lockDamage !== null && this.cfg.rule === 'training') for (const f of this.fighters) if (f.isCPU) f.damage = this.lockDamage;

    // Frozen fighters are not simulated at all: no motion, no attack frames,
    // no hitstun decay, no projectiles, no AI.
    for (const f of this.fighters) { if (!this.timeFrozen(f)) f.update(this); }

    // melee hits
    for (const A of this.fighters) {
      // A suspended fighter cannot swing: its attack frames are frozen, so they
      // must not be tested for contact.
      if (this.timeFrozen(A)) continue;
      if (!A.alive || A.state !== 'attack' || !A.move || A.hitstop > 0) continue;
      const m = A.move, fr = A.moveFrame, s = A.scale;
      m.hits.forEach((h, hi) => {
        if (fr < h.f[0] || fr > h.f[1]) return;
        const w = h.w * s, hh = h.h * s;
        const r = { x: A.x + h.x * s * A.facing - w / 2, y: A.y + h.y * s - hh / 2, w, h: hh };
        for (const T of this.fighters) {
          if (!this.canDamage(A, T) || !T.alive || A.state !== 'attack' || A.move !== m) continue;
          if (!overlap(r, { x: T.x - T.hw, y: T.y - T.h, w: T.hw * 2, h: T.h })) continue;
          const grp = h.g ?? hi;
          let map = A.hitMap.get(T); if (!map) { map = new Map(); A.hitMap.set(T, map); }
          const lastF = map.get(grp);
          if (lastF !== undefined && (!h.rehit || fr - lastF < h.rehit)) continue;
          if (T.invuln > 0 && !(T.move?.counter)) continue;
          map.set(grp, fr);
          const ix = (Math.max(r.x, T.x - T.hw) + Math.min(r.x + r.w, T.x + T.hw)) / 2;
          const iy = (Math.max(r.y, T.y - T.h) + Math.min(r.y + r.h, T.y)) / 2;
          if (ts.active
            ? this.queueTimeStopHit(A, T, h, A.facing, ix, iy)
            : this.applyHit(A, T, h, A.facing, ix, iy)) { A.moveConnected = true; m.onHit?.(A, T, this, h); }
        }
      });
    }
    // projectiles
    if (ts.active) {
      // Everything in the world hangs: existing shots and anything the owner just
      // created stay exactly where they are and do not age. They resume from
      // these positions, never teleporting forward.
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    } else {
      for (const p of this.projectiles) {
        if (!p.owner.alive) { p.dead = true; continue; }
        p.update(this);
        if (!p.active || p.dead) continue;
        const r = p.rect();
        for (const T of this.fighters) {
          if (!this.canDamage(p.owner, T) || !T.alive) continue;
          if (T.invuln > 0 && !(T.move?.counter)) continue;
          if (!overlap(r, { x: T.x - T.hw, y: T.y - T.h, w: T.hw * 2, h: T.h })) continue;
          const last = p.hitMap.get(T);
          if (last !== undefined && (!p.rehit || p.t - last < p.rehit)) continue;
          p.hitMap.set(T, p.t);
          const hit = this.applyHit(p.owner, T, p, p.dir, T.x, T.y - T.h / 2, false, { x: p.x, y: p.y + T.h / 2, vx: p.vx, vy: p.vy, noMeter: p.ultLocked });
          if (hit && p.type === 'wave') { p.life = 0; p.dead = true; }
          if (hit && p.type === 'sig') SIGS[p.sig]?.onHit?.(p, T, this);
        }
      }
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    }

    // KOs
    const b = this.arena.blast;
    for (const f of this.fighters) {
      if (!f.alive || this.timeFrozen(f)) continue;
      if (f.x < b.l || f.x > b.r || f.y > b.b || f.y < b.t || this.health.get(f)?.current === 0) this.ko(f);
    }

    // rules — the match clock is part of the frozen gameplay clock, so it halts too.
    if (!ts.active && !this.ended && this.countdown === 0 && !this.opts.preview) {
      if (this.cfg.rule === 'timed') {
        this.timeLeft--;
        if (this.timeLeft <= 0) this.endMatch();
      } else if (this.cfg.rule === 'stock') {
        const remaining = new Set(this.fighters.filter(f => !f.eliminated).map(f => this.teamOf(f)));
        if (remaining.size <= 1) this.endMatch();
        else if (this.cfg.mode === 'custom' && this.cfg.time > 0 && --this.timeLeft <= 0) this.endMatch();
      }
    }
    if (this.ended) {
      this.endT++;
      if (this.endT === 90) this.timeScale = 1;
      if (this.endT === 170) {
        this.opts.onEnd?.(this.results());
        this.running = false;
      }
    }
    this.updateCamera();
    // Record AFTER the step, so the slot holds the state the frame actually
    // showed. A KO raised during the step is therefore in the final slot.
    if (!this.opts.preview && !this.paused) this.replay.record(this);
  }

  endMatch() {
    if (this.ended) return;
    // A finished match must never leave the world suspended.
    if (this.timeStop.active) this.endTimeStop();
    this.finalResult = this.results();
    this.ended = true; this.endT = 0; this.timeScale = 0.35;
    sfx('game'); this.flashScreen('#ffffff', 0.5); this.shake(10);
  }

  results(): MatchResult {
    if (this.finalResult) return this.finalResult;
    if (this.cfg.mode === 'custom') return this.customResults();
    let order: Fighter[];
    if (this.cfg.rule === 'stock') order = [...this.fighters].sort((a, b) => (a.eliminated ? a.placement : 1) - (b.eliminated ? b.placement : 1) || b.stocks - a.stocks || a.damage - b.damage);
    else order = [...this.fighters].sort((a, b) => b.score - a.score || a.dmgTaken - b.dmgTaken);
    return {
      rule: this.cfg.rule, duration: Math.floor(this.elapsedFrames / 60),
      fighters: order.map((f, i) => ({ char: f.def.id, name: f.def.name, isCPU: f.isCPU, kos: f.kos, falls: f.falls, dmgDealt: Math.round(f.dmgDealt), dmgTaken: Math.round(f.dmgTaken), place: i + 1, score: f.score, color: f.color, label: f.label })),
    };
  }

  private customResults(): MatchResult {
    const groups = [...new Set(this.fighters.map(f => this.teamOf(f)))].map(team => {
      const members = this.fighters.filter(f => this.teamOf(f) === team);
      return { team, members, score: members.reduce((n, f) => n + f.score, 0),
        stocks: members.reduce((n, f) => n + Math.max(0, f.stocks), 0),
        eliminated: members.every(f => f.eliminated),
        lastFall: Math.max(0, ...members.map(f => this.eliminatedAt.get(f) ?? 0)),
        condition: members.reduce((n, f) => n + (f.eliminated ? 0 : this.health.has(f) ? this.health.get(f)!.current / this.health.get(f)!.max : -f.damage), 0), place: 0 };
    });
    const compare = (a: typeof groups[number], b: typeof groups[number]) => {
      if (this.cfg.rule === 'timed') return b.score - a.score;
      if (a.eliminated !== b.eliminated) return Number(a.eliminated) - Number(b.eliminated);
      if (a.eliminated) return b.lastFall - a.lastFall;
      return b.stocks - a.stocks || b.condition - a.condition;
    };
    groups.sort(compare);
    groups.forEach((g, i) => { g.place = i > 0 && compare(groups[i - 1], g) === 0 ? groups[i - 1].place : i + 1; });
    const draw = groups.filter(g => g.place === 1).length > 1;
    return { rule: 'custom · ' + this.cfg.rule + (this.health.size ? ' · stamina' : ' · percent'), duration: Math.floor(this.elapsedFrames / 60),
      teams: this.teamMode, draw, playerWon: !draw && groups.some(g => g.place === 1 && g.members.some(f => !f.isCPU)),
      teamResults: this.teamMode ? groups.map(g => ({ team: g.team, place: g.place, score: g.score, stocks: g.stocks })) : undefined,
      fighters: groups.flatMap(g => g.members.map(f => ({ char: f.def.id, name: f.def.name, isCPU: f.isCPU, kos: f.kos, falls: f.falls,
        dmgDealt: Math.round(f.dmgDealt), dmgTaken: Math.round(f.dmgTaken), place: g.place, score: f.score, color: f.color, label: f.label,
        team: this.teamMode ? g.team : undefined, stocks: this.cfg.rule === 'stock' ? f.stocks : undefined, health: this.health.get(f)?.current }))) };
  }

  resetPositions() {
    this.projectiles = [];
    this.fighters.forEach((f, i) => {
      const hp = this.health.get(f); if (hp) hp.current = hp.max;
      const sp = this.arena.spawns[i % this.arena.spawns.length]; f.x = sp[0]; f.y = sp[1]; f.vx = f.vy = 0; f.damage = 0; f.state = 'air'; f.move = null; f.hitstun = 0;
      f.comboHits = 0; f.comboDmg = 0; f.godT = 0; f.devilT = 0; f.invuln = 0;
      f.sukunaFlash = 0; f.sukunaBlackFlash = false; f.sukunaLaunchTarget = null; f.sukunaGrabTarget = null; f.koCueFired = false; f.laughCueFired = false;
      f.cds = emptyCds();
      if (f.koT > 0 || !f.alive) { f.state = 'air'; f.koT = 0; }
    });
  }

  dummyInput(f: Fighter): InputState {
    const i = emptyInput(); this.dummyT++;
    switch (this.dummyMode) {
      case 'stand': break;
      case 'jump': if (this.dummyT % 70 === 0) i.jump = true; break;
      case 'move': { const ph = Math.floor(this.dummyT / 90) % 2; if (ph) i.left = true; else i.right = true; if (this.groundBelow(f.x + (ph ? -60 : 60), f.y - 2) === null) { i.left = i.right = false; } break; }
      case 'dodge': {
        const p = this.fighters[0];
        if (p.state === 'attack' && p.move && p.moveFrame === Math.max(1, p.move.startup - 3) && Math.abs(p.x - f.x) < 160) i.dodge = true;
        break;
      }
      case 'cpu': {
        let ai = this.ais.get(f); if (!ai) { ai = new AI(f, 'medium'); this.ais.set(f, ai); }
        return ai.think(this);
      }
    }
    // dummy recovery (non-cpu): simple
    if (this.groundBelow(f.x, f.y - 2) === null && f.state !== 'hitstun') {
      const ai = this.ais.get(f) || new AI(f, 'hard'); this.ais.set(f, ai);
      return ai.think(this);
    }
    return i;
  }

  queuePreview(request: PreviewRequest) {
    this.previewRequest = { ...request };
    this.previewFrame = 0;
    this.previewFollowupFired = false;
    this.previewCounterPending = false;
    this.previewAwakenSpent = false;
  }

  private previewMoveKey(action: PreviewAction, stance: PreviewStance): MoveKey {
    const bossAir = !!this.fighters[0]?.def.moves.aig;
    if (action === 'awaken') return stance === 'air' ? 'aaw' : stance === 'down' ? 'daw' : stance === 'side' ? 'saw' : 'naw';
    if (action === 'awakened') return stance === 'air' ? 'afu' : stance === 'down' ? 'dfu' : stance === 'side' ? 'sfu' : 'nfu';
    if (action === 'heavy') return stance === 'air' ? (bossAir ? 'aig' : 'rec') : stance === 'down' ? 'dsig' : stance === 'side' ? 'ssig' : 'nsig';
    if (action === 'special') {
      if (stance === 'air' && !!this.fighters[0]?.def.moves.aspec) return 'aspec' as MoveKey;
      return stance === 'down' ? 'dspec' : stance === 'side' ? 'sspec' : 'nspec';
    }
    if (stance === 'air') return 'nair';
    if (stance === 'down') return 'dlight';
    return stance === 'side' ? 'slight' : 'nlight';
  }

  private setupPreview(request: PreviewRequest) {
    const f = this.fighters[0], d = this.fighters[1];
    if (!f || !d) return;
    const key = this.previewMoveKey(request.action, request.stance);
    const move = f.def.moves[key];
    this.projectiles = [];
    this.fx = new Effects();
    for (const fighter of [f, d]) {
      fighter.vx = fighter.vy = 0; fighter.move = null; fighter.moveKey = null; fighter.state = 'idle'; fighter.grounded = true;
      fighter.hitstun = 0; fighter.hitstop = 0; fighter.invuln = 0; fighter.tumble = 0; fighter.flashT = 0;
      fighter.godT = 0; fighter.devilT = 0; fighter.auraT = 0; fighter.trail = []; fighter.ghosts.length = 0; fighter.evadeT = 0; fighter.evadeCD = 0; fighter.cds = emptyCds();
      fighter.sukunaFlash = 0; fighter.sukunaBlackFlash = false; fighter.sukunaLaunchTarget = null; fighter.sukunaGrabTarget = null;
      fighter.facing = fighter === f ? 1 : -1;
    }
    f.x = -105; f.y = request.stance === 'air' ? -108 : 0;
    d.x = 125; d.y = request.stance === 'air' ? -32 : 0;
    d.damage = 40; d.meter = 100;
    // The two Awakening showcases spend a gauge, so the gauge is full. The
    // preview keeps it there, because a showcase that ends when the meter does
    // is not showing the fifteen seconds it is meant to be showing.
    if (request.action === 'awaken' || request.action === 'awakened') { f.meter = 100; this.infiniteMeter = true; }
    if (request.stance === 'air') { f.grounded = false; f.state = 'air'; f.vy = 0; d.grounded = false; d.state = 'air'; }

    const reach = move.hits.reduce((max: number, h: any) => Math.max(max, Math.abs(h.x) + h.w * 0.5), 0);
    const counter = !!move.counter;
    const projectileMove = move.hits.length === 0;
    const distance = counter ? 65 : projectileMove ? 155 : Math.max(35, Math.min(160, (move.hits[0]?.x ?? reach * .5) * f.scale));
    d.x = f.x + distance;
    if (request.stance === 'air') d.y = f.y + 62;

    // Counters are staged as a real incoming attack. Projectile-nullification moves
    // receive a real projectile, while melee counters receive a real dummy swing.
    if (counter) {
      if ((f.def.id === 'asta' && request.stance === 'down') || (f.def.id === 'gojo' && request.stance === 'side') || (f.def.id === 'goku' && request.stance === 'side')) {
        this.spawnProj({ owner: d, type: 'fireball', style: f.def.id === 'gojo' ? 'cursed' : 'fire', x: d.x - d.facing * 36, y: d.y - 42, vx: d.facing * 8, vy: 0, w: 42, h: 42, life: 55, dmg: 5, ang: 38, kb: 4, sc: 3, dir: -1, reflectable: true });
      } else {
        d.x = f.x + 76; d.facing = -1; this.previewCounterPending = true;
      }
    }
    this.fx.text(0, -125, counter ? 'INCOMING · COUNTER TEST' : request.stance === 'air' ? 'AERIAL TEST' : 'LIVE DAMAGE TEST', f.def.color, 22, 34);
  }

  previewInput(f: Fighter): InputState {
    const i = emptyInput();
    if (f.idx !== 0) return i;
    const t = ++this.previewFrame;
    const request = this.previewRequest;
    if (t === 1) this.setupPreview(request);
    const applyStance = () => {
      if (request.stance === 'side') i.right = true;
      if (request.stance === 'down') i.down = true;
    };
    if (t === 2) {
      // `awakened` is not a button: R opens the state and the real button follows below.
      if (request.action === 'awakened') { i.awaken = true; this.previewAwakenSpent = true; }
      else i[request.action] = true;
      applyStance();
    }
    if (request.action === 'awakened' && t > 2 && this.previewAwakenSpent && f.awakened && f.moveKey === null) {
      this.previewAwakenSpent = false;
      i.special = true;
      applyStance();
    }
    if (t === 4 && this.previewCounterPending && this.fighters[1]?.alive) {
      this.previewCounterPending = false;
      this.fighters[1].startMove('nlight', this);
    }
    const ch = f.move?.chains;
    if (request.followup && ch && f.hitstop === 0) {
      const window = ch.window || [f.move!.startup, f.move!.dur - 1];
      if (f.moveFrame >= window[0] && f.moveFrame < window[1] && (!ch.onHitOnly || f.moveConnected)) {
        if (request.action === 'awaken' && ch.special && !this.previewFollowupFired) {
          this.previewFollowupFired = true; i.special = true;
        } else if (request.action === 'awakened' && ch.special && !this.previewFollowupFired) {
          this.previewFollowupFired = true; i.special = true;
        } else if (request.action === 'heavy' && request.stance === 'neutral') {
          if (f.moveKey === 'nsig' && ch.heavy) i.heavy = true;
        }
      }
    }    return i;
  }

  previewLabel() {
    const f = this.fighters[0];
    const action = this.previewRequest.action.toUpperCase();
    const stance = this.previewRequest.stance.toUpperCase();
    if (f?.move?.name) return `${action} · ${f.move.name} · ${stance}`;
    const key = this.previewMoveKey(this.previewRequest.action, this.previewRequest.stance);
    return `${action} · ${f?.def.moves[key]?.name || key} · ${stance}`;
  }

  // ---------- camera ----------
  updateCamera() {
    const bz = this.baseZoom();
    if (this.opts.preview) { this.cam.x += (20 - this.cam.x) * 0.1; this.cam.z = Math.min(this.W / 430, (this.H - 115) / 235); this.cam.y = -25; this.applyPunch(); return; }
    if (this.cin) {
      const f = this.cin.f;
      this.cam.x += (f.x - this.cam.x) * 0.15; this.cam.y += (f.y - 60 - this.cam.y) * 0.15; this.cam.z += (bz * 1.28 - this.cam.z) * 0.12;
      this.applyPunch();
      this.settleCamera();
      return;
    }
    const b = this.arena.blast;
    const pts = this.fighters.filter((f) => f.alive).map((f) => [Math.max(b.l + 350, Math.min(b.r - 350, f.x)), Math.max(b.t + 350, Math.min(b.b - 200, f.y - 40))]);
    if (!pts.length) pts.push([0, -150]);
    let minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
    let minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
    const w = Math.max(900, maxX - minX + 560), h = Math.max(520, maxY - minY + 420);
    let tz = Math.min(this.W / w, this.H / h);
    tz = Math.max(bz * MIN_ZOOM_K, Math.min(bz * 1.15, tz));
    const tx = (minX + maxX) / 2 * 0.85, ty = ((minY + maxY) / 2 - 40) * 0.85 + -150 * 0.15;
    this.cam.x += (tx - this.cam.x) * 0.08; this.cam.y += (ty - this.cam.y) * 0.08; this.cam.z += (tz - this.cam.z) * 0.05;
    this.applyPunch();
    this.settleCamera();
  }

  /**
   * Camera punch-in. On top of the normal follow, a heavy impact briefly zooms
   * 1.15x toward the point of contact. The offset is scaled by the punch
   * lifetime, so the release is an exponential spring back rather than a cut —
   * and because it is applied *after* the follow has been solved, the punch can
   * never feed back into the framing the next frame computes.
   */
  private applyPunch() {
    const p = this.punch;
    if (p.t <= 0 || p.mag <= 0) return;
    // Sharp attack, slow damped release: k^3 in, linear-out.
    const k = p.t / 10;
    const amt = p.mag * (k > 0.55 ? 1 : k * k * k * 2.4);
    this.cam.z *= 1 + amt;
    this.cam.x += (p.x - this.cam.x) * amt * 0.9;
    this.cam.y += (p.y - 40 - this.cam.y) * amt * 0.9;
  }

  // ---------- ambient ----------
  newAmbient(rand = false) {
    const t = this.arena.theme.particle;
    const a = { x: Math.random(), y: rand ? Math.random() : (t === 'ember' || t === 'sparkle' ? 1.05 : -0.05), vx: 0, vy: 0, s: 1 + Math.random() * 3, r: Math.random() * 6 };
    if (t === 'ember') { a.vx = (Math.random() - 0.5) * 0.0006; a.vy = -0.0012 - Math.random() * 0.0015; }
    else if (t === 'sparkle') { a.vx = (Math.random() - 0.5) * 0.0004; a.vy = -0.0005 - Math.random() * 0.0008; }
    else if (t === 'mist') { a.vx = 0.0004 + Math.random() * 0.0006; a.vy = 0.0003; a.s = 20 + Math.random() * 40; }
    else { a.vx = 0.0008 + Math.random() * 0.001; a.vy = 0.0006 + Math.random() * 0.0008; }
    return a;
  }
  updateAmbient() {
    for (let i = 0; i < this.ambient.length; i++) {
      const a = this.ambient[i]; a.x += a.vx; a.y += a.vy; a.r += 0.05;
      if (a.x < -0.1 || a.x > 1.1 || a.y < -0.1 || a.y > 1.1) this.ambient[i] = this.newAmbient();
    }
  }

  // ---------- render ----------
  worldToScreen(x: number, y: number) { return [(x - this.cam.x) * this.cam.z + this.W / 2, (y - this.cam.y) * this.cam.z + this.H / 2]; }

  render() {
    const ctx = this.ctx; const W = this.W, H = this.H;
    const ts = this.timeStop;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx);
    ctx.save();
    const sx = (Math.random() - 0.5) * this.shakeAmt, sy = (Math.random() - 0.5) * this.shakeAmt;
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(this.cam.z, this.cam.z); ctx.translate(-this.cam.x, -this.cam.y);
    this.drawStage(ctx);
    const t = this.frame;
    // contact shadows — dynamic: they widen, soften and shear with elevation and
    // with the direction of travel, so altitude is legible without a HUD.
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const gy = this.groundBelow(f.x, f.y - 2);
      if (gy === null) continue;
      const drop = Math.max(0, gy - f.y);
      drawContactShadow(ctx, f.x, gy + 1, (26 - Math.min(16, drop * 0.05)) * f.scale,
        Math.max(0.12, 0.75 - drop * 0.0022), f.vx, drop);
    }
    for (const p of this.projectiles) if (p.type === 'susanoo') p.draw(ctx, t);
    // Stage-scale entities (domains, shrines) sit behind the fighters so they
    // frame the action instead of covering it.
    for (const p of this.projectiles) if (p.behind) p.draw(ctx, t);
    for (const f of this.fighters) f.draw(ctx, t, this.showHitboxes);
    for (const p of this.projectiles) if (!p.behind && p.type !== 'susanoo') p.draw(ctx, t);
    this.fx.draw(ctx);
    if (this.showHitboxes) this.drawHitboxes(ctx);
    if (!this.opts.preview) this.drawTags(ctx);
    if (ts.active || ts.resumeFx > 0) this.drawTimeStopWave(ctx);
    ctx.restore();

    // Desaturation happens after the world and before the HUD, so the interface
    // keeps its full colour while the arena itself loses all of it.
    if (ts.active) this.compositeTimeStop(ctx);
    if (ts.resumeFx > 0) this.compositeTimeStopResume(ctx);
    this.drawSpeedLines(ctx);
    this.compositeNegative(ctx);

    if (this.flash.a > 0) { ctx.globalAlpha = this.flash.a; ctx.fillStyle = this.flash.c; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // Radial lens ripple runs last of the world-space passes: it re-samples the
    // finished frame, so anything drawn afterwards would be left unbent.
    this.distortion.draw(ctx, this.canvas, W, H);
    if (this.opts.preview) return;
    // A replay hides the interface: the point is to watch the exchange again,
    // and a live damage readout on a frozen frame is a lie. The end banner goes
    // with it — the match did not end at this point in the footage.
    if (this.replay.active) { this.drawReplayOverlay(ctx); return; }
    this.drawOffscreen(ctx);
    this.drawHUD(ctx);
    if (this.cin) this.drawCinematic(ctx);
    this.drawBanners(ctx);
  }

  /**
   * Replay chrome: letterbox, a REC indicator, the playback scrubber, and a
   * rate readout that makes the slow motion legible as a choice rather than a
   * stutter. Everything is in screen space and independent of the world camera,
   * which is itself one of the recorded channels.
   */
  drawReplayOverlay(ctx: CanvasRenderingContext2D) {
    const W = this.W, H = this.H, st = this.replay.status;
    // Letterbox. Full height bars, eased in over the first 8 frames.
    const bar = H * 0.085;
    ctx.save();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    // 1px warm hairline so the bars read as a deliberate matte, not a crop.
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(0, bar - 1, W, 1); ctx.fillRect(0, H - bar, W, 1);
    // A faint red tally light in the top-left, like a broadcast monitor.
    const pulse = 0.55 + Math.sin(this.replayTick * 0.18) * 0.45;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff2a3c';
    ctx.beginPath(); ctx.arc(28, bar / 2, 5, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = `italic 900 ${Math.round(bar * 0.44)}px Bangers, Impact, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('REPLAY', 42, bar / 2 + 1);
    // Scrubber: the full five-second lead-in, with the knockout marked at the end.
    const sw = Math.min(420, W * 0.42), sx = W - sw - 28, sy = bar / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(sx, sy - 2, sw, 4);
    const prog = Math.max(0, Math.min(1, st.progress));
    ctx.fillStyle = st.onKill ? '#ff2a3c' : '#e2e8f0';
    ctx.fillRect(sx, sy - 2, sw * prog, 4);
    ctx.beginPath(); ctx.arc(sx + sw, sy, 5, 0, 7); ctx.fill();
    // Rate readout: the whole point of the slow ramp has to be visible.
    const rate = st.onKill ? 0.12 : st.slowing ? 0.12 + (st.toKill - 1) / 65 * 0.58 : 1;
    ctx.textAlign = 'right';
    ctx.font = `bold ${Math.round(bar * 0.34)}px Rajdhani, sans-serif`;
    ctx.fillStyle = rate < 0.99 ? '#ffd24a' : 'rgba(255,255,255,0.5)';
    ctx.fillText(`×${rate.toFixed(2)}`, W - 28, bar / 2 + 1);
    ctx.restore();
    // On the knockout frame itself, stamp the result over the letterbox.
    if (st.onKill) {
      const t = Math.min(1, (this.replayTick % 6) / 6);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.06);
      ctx.scale(1 + (1 - t) * 0.5, 1 + (1 - t) * 0.5);
      ctx.globalAlpha = 0.35 + t * 0.5;
      ctx.font = `italic 900 ${Math.round(H * 0.2)}px Bangers, Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 10; ctx.strokeStyle = '#000';
      ctx.strokeText('K.O.', 0, 0);
      const kg = ctx.createLinearGradient(0, -H * 0.1, 0, H * 0.1);
      kg.addColorStop(0, '#fff'); kg.addColorStop(1, '#ff2a3c');
      ctx.fillStyle = kg;
      ctx.fillText('K.O.', 0, 0);
      ctx.restore();
    }
  }

  drawBackground(ctx: CanvasRenderingContext2D) {
    const W = this.W, H = this.H, th = this.arena.theme;
    if (this.opts.preview) {
      const g = ctx.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, W * 0.7);
      g.addColorStop(0, '#2a2140'); g.addColorStop(1, '#0a0812'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const img = this.bg;
    if (img && img.complete && img.naturalWidth) {
      const zoomK = 1 + (this.cam.z / this.baseZoom() - 1) * 0.12;
      const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.18 * zoomK;
      const iw = img.naturalWidth * sc, ih = img.naturalHeight * sc;
      const ox = (W - iw) / 2 - this.cam.x * 0.05 * sc, oy = (H - ih) / 2 - (this.cam.y + 150) * 0.04 * sc;
      ctx.drawImage(img, ox, oy, iw, ih);
    }
    ctx.fillStyle = th.tint; ctx.fillRect(0, 0, W, H);
    // parallax silhouette band (mid-ground depth)
    ctx.save();
    ctx.globalAlpha = 0.32; ctx.fillStyle = 'rgba(5,5,12,0.9)';
    const px = -this.cam.x * 0.1, base = H * 0.86 - this.cam.y * 0.02;
    ctx.beginPath(); ctx.moveTo(-100, H + 10);
    for (let i = -1; i <= 14; i++) {
      const x = px + i * (W / 9) % (W + 400) - 200;
      const hgt = 70 + ((i * 53) % 90);
      ctx.lineTo(x, base + 40 - hgt); ctx.lineTo(x + W / 18, base + 40 - hgt);
    }
    ctx.lineTo(W + 200, H + 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    // god rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const gx = W * (0.18 + i * 0.17) - this.cam.x * 0.03;
      const g = ctx.createLinearGradient(gx, 0, gx + 120, H);
      g.addColorStop(0, `rgba(255,240,200,${0.05 + (i % 2) * 0.03})`); g.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(gx - 60, -20); ctx.lineTo(gx + 60, -20); ctx.lineTo(gx + 220, H + 20); ctx.lineTo(gx + 60, H + 20); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // ambient particles
    ctx.save();
    const tp = th.particle;
    for (const a of this.ambient) {
      const x = a.x * W, y = a.y * H;
      if (tp === 'ember') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${120 + (a.s * 30) | 0},40,${0.5 + Math.sin(a.r) * 0.3})`; ctx.beginPath(); ctx.arc(x, y, a.s, 0, 7); ctx.fill(); }
      else if (tp === 'sparkle') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(200,240,255,${0.4 + Math.sin(a.r * 2) * 0.4})`; ctx.fillRect(x - a.s / 2, y - a.s * 1.5, a.s, a.s * 3); ctx.fillRect(x - a.s * 1.5, y - a.s / 2, a.s * 3, a.s); }
      else if (tp === 'mist') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(230,240,255,0.05)'; ctx.beginPath(); ctx.arc(x, y, a.s, 0, 7); ctx.fill(); }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,230,200,${0.35 + Math.sin(a.r) * 0.2})`; ctx.save(); ctx.translate(x, y); ctx.rotate(a.r); ctx.fillRect(-a.s, -a.s * 0.4, a.s * 2, a.s * 0.8); ctx.restore(); }
    }
    ctx.restore();
  }

  drawStage(ctx: CanvasRenderingContext2D) {
    const a = this.arena, th = a.theme;
    if (this.opts.preview) {
      const floor = ctx.createLinearGradient(0, 0, 0, 360); floor.addColorStop(0, '#242038'); floor.addColorStop(1, '#090811');
      ctx.fillStyle = floor; ctx.fillRect(-2000, 0, 4000, 400);
      ctx.strokeStyle = 'rgba(180,140,255,0.16)'; ctx.lineWidth = 2;
      for (let x = -1200; x <= 1200; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x * 1.8, 400); ctx.stroke(); }
      for (let y = 25; y < 400; y += 35) { ctx.beginPath(); ctx.moveTo(-2000, y); ctx.lineTo(2000, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(210,185,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-2000, 0); ctx.lineTo(2000, 0); ctx.stroke();
      ctx.save(); ctx.translate(20, -2); ctx.scale(1, .28); ctx.strokeStyle = 'rgba(176,103,255,0.22)'; ctx.lineWidth = 8;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 130 + i * 42, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 130, Math.sin(a) * 130); ctx.lineTo(Math.cos(a) * 214, Math.sin(a) * 214); ctx.stroke(); }
      ctx.restore();
      return;
    }
    // water / abyss for valley
    if (a.id === 'valley') {
      const y = 330;
      const g = ctx.createLinearGradient(0, y, 0, y + 500); g.addColorStop(0, 'rgba(90,150,200,0.75)'); g.addColorStop(1, 'rgba(20,40,70,0.95)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-2000, y + 600);
      for (let x = -2000; x <= 2000; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.01 + this.frame * 0.05) * 6);
      ctx.lineTo(2000, y + 600); ctx.fill();
    }
    for (const s of a.solids) {
      const bottom = s.h;
      const g = ctx.createLinearGradient(0, s.y, 0, s.y + bottom);
      g.addColorStop(0, th.body); g.addColorStop(1, th.body2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y); ctx.lineTo(s.x + s.w - (a.id === 'castle' ? 60 : 0), s.y + s.h); ctx.lineTo(s.x + (a.id === 'castle' ? 60 : 0), s.y + s.h); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
      if (a.id === 'rooftops') {
        for (let y = s.y + 22; y < s.y + s.h; y += 22) for (let x = s.x + ((y / 22) % 2) * 16; x < s.x + s.w; x += 32) { ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI); ctx.stroke(); }
      } else if (a.id === 'train') {
        ctx.fillStyle = '#12151f'; ctx.fillRect(s.x, s.y + 18, s.w, 6);
        for (let x = s.x + 30; x < s.x + s.w - 40; x += 70) { ctx.fillStyle = 'rgba(255,210,120,0.85)'; ctx.fillRect(x, s.y + 50, 40, 44); ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 4; ctx.strokeRect(x, s.y + 50, 40, 44); }
        ctx.fillStyle = '#0a0c12'; ctx.fillRect(s.x, s.y + 150, s.w, 70);
        for (let x = s.x + 50; x < s.x + s.w; x += 110) { ctx.fillStyle = '#2a2d38'; ctx.beginPath(); ctx.arc(x, s.y + 190, 24, 0, 7); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.save(); ctx.translate(x, s.y + 190); ctx.rotate(this.frame * 0.3); ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke(); ctx.restore(); }
      } else {
        for (let y = s.y + 30; y < s.y + s.h; y += 30) {
          ctx.beginPath(); ctx.moveTo(s.x, y); ctx.lineTo(s.x + s.w, y); ctx.stroke();
          for (let x = s.x + ((y / 30) % 2) * 30; x < s.x + s.w; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30); ctx.stroke(); }
        }
      }
      // bottom fade
      const fg = ctx.createLinearGradient(0, s.y + s.h * 0.4, 0, s.y + s.h); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = fg; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.restore();
      // top strip
      ctx.fillStyle = th.top; ctx.fillRect(s.x - 6, s.y - 2, s.w + 12, 14);
      ctx.fillStyle = th.edge; ctx.fillRect(s.x - 6, s.y - 2, s.w + 12, 3);
      if (a.id === 'castle') {
        ctx.fillStyle = '#4b9444';
        for (let x = s.x; x < s.x + s.w; x += 18) { ctx.beginPath(); ctx.moveTo(x, s.y + 11); ctx.lineTo(x + 9, s.y + 20 + Math.sin(x) * 5); ctx.lineTo(x + 18, s.y + 11); ctx.fill(); }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(s.x - 6, s.y - 2, s.w + 12, 14);
    }
    for (const p of a.platforms) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x + 6, p.y + 14, p.w - 12, 8);
      ctx.fillStyle = th.plat; ctx.fillRect(p.x, p.y, p.w, 14);
      ctx.fillStyle = th.platTop; ctx.fillRect(p.x, p.y, p.w, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(p.x, p.y, p.w, 1.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5; ctx.strokeRect(p.x, p.y, p.w, 14);
      ctx.fillStyle = th.plat;
      ctx.beginPath(); ctx.moveTo(p.x + 20, p.y + 14); ctx.lineTo(p.x + 34, p.y + 34); ctx.lineTo(p.x + 48, p.y + 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x + p.w - 20, p.y + 14); ctx.lineTo(p.x + p.w - 34, p.y + 34); ctx.lineTo(p.x + p.w - 48, p.y + 14); ctx.fill();
    }
  }

  drawHitboxes(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.lineWidth = 2;
    for (const A of this.fighters) {
      if (A.state !== 'attack' || !A.move) continue;
      for (const h of A.move.hits) {
        if (A.moveFrame < h.f[0] || A.moveFrame > h.f[1]) continue;
        const s = A.scale, w = h.w * s, hh = h.h * s;
        ctx.fillStyle = 'rgba(255,40,40,0.25)'; ctx.strokeStyle = 'rgba(255,60,60,0.9)';
        ctx.fillRect(A.x + h.x * s * A.facing - w / 2, A.y + h.y * s - hh / 2, w, hh); ctx.strokeRect(A.x + h.x * s * A.facing - w / 2, A.y + h.y * s - hh / 2, w, hh);
      }
    }
    for (const p of this.projectiles) if (p.active) { const r = p.rect(); ctx.strokeStyle = 'rgba(255,200,40,0.9)'; ctx.strokeRect(r.x, r.y, r.w, r.h); }
    ctx.restore();
  }

  drawTags(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.textAlign = 'center';
    const z = 1 / this.cam.z;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const y = f.y - f.h - 34 * f.scale;
      ctx.save(); ctx.translate(f.x, y); ctx.scale(z * 0.9, z * 0.9);
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.lineTo(0, 6); ctx.fill();
      ctx.font = 'bold 14px Rajdhani, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#000';
      ctx.strokeText(f.label, 0, -7); ctx.fillStyle = f.color; ctx.fillText(f.label, 0, -7);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- time stop rendering ----------
  /** World-space wave front: the expanding boundary of frozen time. */
  private drawTimeStopWave(ctx: CanvasRenderingContext2D) {
    const ts = this.timeStop, o = ts.owner;
    if (!o) return;
    const R = ts.radius;
    if (R <= 1) return;
    ctx.save();
    // Slight ellipsoid so the wave reads as a dome over the stage, not a decal.
    ctx.translate(o.x, o.y - 44);
    ctx.scale(1, 0.72);
    ctx.globalCompositeOperation = 'lighter';
    // Inner frost: a cold rim of light just inside the boundary.
    const g = ctx.createRadialGradient(0, 0, Math.max(1, R * 0.82), 0, 0, R);
    g.addColorStop(0, 'rgba(190,230,255,0)');
    g.addColorStop(0.72, 'rgba(190,230,255,.10)');
    g.addColorStop(1, 'rgba(225,245,255,.34)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // Leading edge.
    ctx.strokeStyle = `rgba(235,250,255,${0.5 + Math.sin(this.frame * 0.3) * 0.18})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(140,220,255,.5)'; ctx.lineWidth = 14;
    ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // Clock ticks riding the boundary sell "stopped clock".
    const ticks = 24;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2 - this.frame * 0.006;
      const nx = Math.cos(a) * R, ny = Math.sin(a) * R;
      const l = i % 6 === 0 ? 22 : 10;
      ctx.strokeStyle = i % 6 === 0 ? 'rgba(255,228,92,.75)' : 'rgba(255,255,255,.4)';
      ctx.lineWidth = i % 6 === 0 ? 3.5 : 1.6;
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx - Math.cos(a) * l, ny - Math.sin(a) * l); ctx.stroke();
    }
    ctx.restore();
  }

  /** Half-resolution scratch buffer, reused so the effect allocates nothing. */
  private ensureTimeBuffer() {
    const w = Math.max(2, Math.ceil(this.W * this.dpr * 0.5));
    const h = Math.max(2, Math.ceil(this.H * this.dpr * 0.5));
    if (!this.timeStopCanvas) {
      if (typeof document === 'undefined' || !document.createElement) return null;
      this.timeStopCanvas = document.createElement('canvas');
      this.timeStopCtx = this.timeStopCanvas.getContext('2d');
    }
    if (this.timeStopCanvas.width !== w || this.timeStopCanvas.height !== h) {
      this.timeStopCanvas.width = w; this.timeStopCanvas.height = h;
    }
    return this.timeStopCtx;
  }

  /**
   * Applies a grayscale filter to everything inside the frozen circle, in
   * screen space but anchored to a world-space centre so it tracks the camera.
   * Shadow DIO keeps his colour inside a small bubble at the epicentre.
   */
  private compositeTimeStop(ctx: CanvasRenderingContext2D) {
    const ts = this.timeStop, o = ts.owner;
    if (!o || ts.radius <= 1) return;
    const [cx, cy] = this.worldToScreen(o.x, o.y - 44);
    const r = ts.radius * this.cam.z;
    const off = this.ensureTimeBuffer();
    const W = this.W, H = this.H;
    if (off) {
      off.setTransform(1, 0, 0, 1, 0, 0);
      off.clearRect(0, 0, this.timeStopCanvas!.width, this.timeStopCanvas!.height);
      off.drawImage(this.canvas, 0, 0, this.timeStopCanvas!.width, this.timeStopCanvas!.height);
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2); ctx.clip();
    if (off) {
      const filter = (ctx as any).filter;
      if (typeof filter === 'string' || filter === undefined) {
        try { ctx.filter = 'grayscale(1) contrast(1.12) brightness(0.94)'; } catch { ctx.filter = 'none'; }
      }
      ctx.drawImage(this.timeStopCanvas!, 0, 0, W, H);
      ctx.filter = 'none';
    }
    // A cool grey wash guarantees the effect reads even where `filter` is absent.
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = off ? 0.22 : 0.85;
    ctx.fillStyle = '#808080';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();

    // Restore full colour for the caster, clipped to a bubble around him.
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(24, 78 * this.cam.z), 0, Math.PI * 2); ctx.clip();
    ctx.translate(W / 2 + (Math.random() - 0.5) * this.shakeAmt, H / 2 + (Math.random() - 0.5) * this.shakeAmt);
    ctx.scale(this.cam.z, this.cam.z); ctx.translate(-this.cam.x, -this.cam.y);
    o.draw(ctx, this.frame, this.showHitboxes);
    for (const p of this.projectiles) if (p.owner === o) p.draw(ctx, this.frame);
    ctx.restore();

    // Expanding label so the player always knows why the world turned grey.
    const left = Math.max(0, this.timeStop.realLeft / 1000);
    const armed = this.timeStop.armed;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'italic 900 34px Bangers, Impact, sans-serif';
    ctx.lineWidth = 7; ctx.strokeStyle = '#000';
    ctx.strokeText('ZA WARUDO', W / 2, H * 0.16);
    ctx.fillStyle = '#8affd0'; ctx.fillText('ZA WARUDO', W / 2, H * 0.16);
    ctx.font = 'bold 15px Rajdhani, sans-serif';
    const clock = armed ? `TIME STOP · ${left.toFixed(1)}s` : 'TIME STOP · HELD';
    ctx.strokeText(clock, W / 2, H * 0.16 + 22);
    ctx.fillStyle = armed ? '#ffffff' : '#ffe45c'; ctx.fillText(clock, W / 2, H * 0.16 + 22);
    ctx.restore();
  }

  /** Colour floods back in as a single bright wave when time resumes. */
  private compositeTimeStopResume(ctx: CanvasRenderingContext2D) {
    const k = this.timeStop.resumeFx / 26;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * 0.5;
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, 0, this.W / 2, this.H / 2, Math.max(this.W, this.H) * (0.4 + (1 - k) * 0.8));
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  drawOffscreen(ctx: CanvasRenderingContext2D) {
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const [x, y] = this.worldToScreen(f.x, f.y - 40);
      if (x > 0 && x < this.W && y > 0 && y < this.H) continue;
      const cx = Math.max(40, Math.min(this.W - 40, x)), cy = Math.max(40, Math.min(this.H - 150, y));
      const ang = Math.atan2(y - cy, x - cx);
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 38, Math.sin(ang) * 38); ctx.lineTo(Math.cos(ang + 0.5) * 26, Math.sin(ang + 0.5) * 26); ctx.lineTo(Math.cos(ang - 0.5) * 26, Math.sin(ang - 0.5) * 26); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fillStyle = '#111'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = f.color; ctx.stroke();
      const img = loadImage(f.def.portrait);
      if (img.complete && img.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 23, 0, 7); ctx.clip(); ctx.drawImage(img, -23, -23, 46, 46); ctx.restore(); }
      ctx.font = 'bold 13px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = dmgColor(f.damage); ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      ctx.strokeText(`${Math.round(f.damage)}`, 0, 40); ctx.fillText(`${Math.round(f.damage)}`, 0, 40);
      ctx.restore();
    }
  }

  drawHUD(ctx: CanvasRenderingContext2D) {
    const n = this.fighters.length;
    const cw = Math.min(250, (this.W - 40) / n - 12), ch = 92;
    const total = n * cw + (n - 1) * 14;
    let x0 = (this.W - total) / 2;
    const y0 = this.H - ch - 14;
    for (const f of this.fighters) {
      const x = x0; x0 += cw + 14;
      ctx.save();
      ctx.translate(x, y0);
      // panel
      const pg = ctx.createLinearGradient(0, 0, 0, ch);
      pg.addColorStop(0, 'rgba(18,18,32,0.9)'); pg.addColorStop(1, 'rgba(6,6,12,0.88)');
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(cw, 0); ctx.lineTo(cw - 14, ch); ctx.lineTo(0, ch); ctx.closePath();
      ctx.save(); ctx.shadowColor = f.color; ctx.shadowBlur = f.alive ? 16 : 0;
      ctx.fillStyle = pg; ctx.fill(); ctx.restore();
      const tg2 = ctx.createLinearGradient(14, 0, cw, 0);
      tg2.addColorStop(0, f.color); tg2.addColorStop(1, 'rgba(255,255,255,0.65)');
      ctx.fillStyle = tg2; ctx.fillRect(14, 0, cw - 14, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();
      // portrait
      const shakeX = f.state === 'hitstun' && f.hitstop > 0 ? (Math.random() - 0.5) * 6 : 0;
      ctx.save(); ctx.translate(46 + shakeX, 46);
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fillStyle = '#000'; ctx.fill();
      const img = loadImage(f.def.portrait);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.clip();
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -36, -34, 72, 72);
      if (!f.alive) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(-40, -40, 80, 80); }
      ctx.restore();
      ctx.lineWidth = 4; ctx.strokeStyle = dmgColor(f.damage); ctx.beginPath(); ctx.arc(0, 0, 33, 0, 7); ctx.stroke();
      ctx.restore();
      // name
      ctx.font = 'bold 13px Rajdhani, sans-serif'; ctx.fillStyle = f.color; ctx.textAlign = 'left';
      ctx.fillText(f.label, 88, 20);
      if (this.teamMode) { ctx.font = 'bold 10px Rajdhani, sans-serif'; ctx.fillText(TEAM_NAMES[this.teamOf(f)], 14, 90); }
      ctx.fillStyle = '#ddd'; ctx.font = '600 12px Rajdhani, sans-serif';
      ctx.fillText(f.def.name.split(' ')[0].toUpperCase(), 88 + ctx.measureText(f.label + '  ').width + 6, 20);
      // damage
      const hp = this.health.get(f);
      const dmg = hp ? Math.ceil(hp.current) : Math.round(f.damage);
      ctx.font = `italic 900 ${f.state === 'hitstun' && f.hitstop > 0 ? 38 : 34}px Bangers, Impact, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.fillStyle = hp ? '#44e07a' : dmgColor(f.damage);
      const txt = f.eliminated ? 'OUT' : f.state === 'ko' ? '---' : hp ? `${dmg} HP` : `${dmg}`;
      ctx.strokeText(txt, 88, 56); ctx.fillText(txt, 88, 56);
      // stocks
      if (this.cfg.rule === 'stock') {
        for (let i = 0; i < Math.min(f.stocks, 8); i++) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(cw - 30 - i * 13, 20, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); }
      } else if (this.cfg.rule === 'timed') {
        ctx.font = 'bold 16px Rajdhani, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.fillText(`${f.score >= 0 ? '+' : ''}${f.score}`, cw - 24, 26); ctx.textAlign = 'left';
      }
      /**
       * Cooldown pips, one per button the player can press for a technique.
       *
       * The three attack pips swap to the awakened kit while the gauge is
       * draining, so the readout a player glances at always describes the moves
       * their buttons are actually pointing at.
       */
      const awakened = f.awakened;
      const pips = awakened
        ? [
          { label: 'J', keys: ['nwl', 'swl', 'dwl', 'awl'] as MoveKey[], color: '#8dffb0' },
          { label: 'K', keys: ['nwh', 'swh', 'dwh', 'awh'] as MoveKey[], color: '#ffb52e' },
          { label: 'L', keys: ['nfu', 'sfu', 'dfu', 'afu'] as MoveKey[], color: '#b067ff' },
        ]
        : [
          { label: 'L', keys: ['nspec', 'sspec', 'dspec'] as MoveKey[], color: f.def.color },
          { label: 'R', keys: ['naw', 'saw', 'daw', 'aaw'] as MoveKey[], color: '#b067ff' },
        ];
      pips.forEach((group, i) => {
        const cd = Math.min(...group.keys.map((key) => f.cds[key] || 0));
        const max = Math.max(...group.keys.map((key) => f.def.moves[key]?.cd || 1));
        const px = cw - 46 - (pips.length - 1 - i) * 20, py = 37;
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(px, py, 16, 16);
        const ready = awakened || cd <= 0, ratio = ready ? 1 : Math.max(0, 1 - cd / max);
        ctx.fillStyle = ready ? group.color : 'rgba(255,255,255,0.3)'; ctx.fillRect(px + 1, py + 16 * (1 - ratio) + 1, 14, 14 * ratio);
        ctx.font = 'black 9px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = ready ? '#071018' : '#777'; ctx.fillText(group.label, px + 8, py + 11);
        ctx.textAlign = 'left';
      });
      /**
       * AWAKENING GAUGE.
       *
       * One bar, and it means two different things depending on whether the state
       * is open. Filling, it is a countdown to a decision. Draining, it is a
       * countdown to the end of the fight you are currently in. The label says
       * which, and the fill direction does too - a bar that quietly empties while
       * a player is trying to read it is worse than no bar.
       */
      const mw = cw - 106, mx = 88, my = 68;
      const gauge = Math.max(0, Math.min(100, f.meter));
      const full = gauge >= 100;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(mx, my, mw, 8);
      const mg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      if (f.awakened) { mg.addColorStop(0, '#b067ff'); mg.addColorStop(1, '#ffffff'); }
      else { mg.addColorStop(0, f.def.color); mg.addColorStop(1, full ? '#ffffff' : f.def.color); }
      ctx.fillStyle = mg; ctx.fillRect(mx, my, mw * gauge / 100, 8);
      if (f.awakened) {
        // A draining bar: a travelling highlight and a hard edge at the current
        // value, so the eye has something to read against.
        const k = (this.frame % 24) / 24;
        ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw * gauge / 100, 8); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(mx + mw * k - 18, my, 36, 8);
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.fillRect(mx + mw * gauge / 100 - 2, my - 2, 3, 12);
        ctx.font = 'bold 11px Rajdhani, sans-serif'; ctx.fillStyle = '#d7b8ff';
        ctx.fillText(`AWAKENED · ${Math.ceil(gauge / 100 * (100 / GAUGE_DRAIN) / 60)}s`, mx, my + 20);
      } else if (full) {
        ctx.globalAlpha = 0.5 + Math.sin(this.frame * 0.2) * 0.5;
        ctx.font = 'bold 11px Rajdhani, sans-serif'; ctx.fillStyle = '#fff';
        ctx.fillText(f.awakenLock > 0 ? 'AWAKENING' : `AWAKEN READY · ${keyLabel(this.opts.bindings.awaken[0])}`, mx, my + 20);
        ctx.globalAlpha = 1;
      } else {
        // A slow bar has to be readable while it fills, or fifteen seconds of
        // patience looks like nothing is happening.
        ctx.font = '600 10px Rajdhani, sans-serif'; ctx.fillStyle = '#999';
        ctx.fillText(`AWAKEN ${Math.floor(gauge)}%`, mx, my + 19);
      }
      ctx.restore();
    }
    // timer
    ctx.save(); ctx.textAlign = 'center';
    const label = this.cfg.rule === 'timed' || this.cfg.mode === 'custom' && this.cfg.time > 0 ? (() => { const s = Math.max(0, Math.ceil(this.timeLeft / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; })()
      : this.cfg.rule === 'training' ? 'TRAINING' : 'STOCK';
    ctx.fillStyle = 'rgba(10,10,20,0.7)';
    ctx.beginPath(); ctx.moveTo(this.W / 2 - 80, 0); ctx.lineTo(this.W / 2 + 80, 0); ctx.lineTo(this.W / 2 + 64, 44); ctx.lineTo(this.W / 2 - 64, 44); ctx.fill();
    ctx.font = `italic 900 30px Bangers, Impact, sans-serif`; ctx.fillStyle = this.cfg.rule === 'timed' && this.timeLeft < 600 ? '#ff5a5a' : '#fff';
    ctx.fillText(label, this.W / 2, 34);
    ctx.restore();
    // active technique / variant readout
    const active = this.fighters[0];
    if (active?.state === 'attack' && active.move?.name) {
      const move = active.move;
      const ability = move.ability || (active.moveKey && ['nspec', 'sspec', 'dspec', 'aspec'].includes(active.moveKey) ? 'special' : undefined);
      const input = ability === 'awaken' ? 'R AWAKEN'
        : ability === 'awakenLight' ? 'J AWAKENED'
          : ability === 'awakenHeavy' ? 'K AWAKENED'
            : ability === 'awakened' ? 'L AWAKENED'
              : ability === 'special' ? 'L SPECIAL' : 'MOVE';
      const stance = move.stance ? ` · ${move.stance.toUpperCase()}` : '';
      const text = `${input} · ${move.name}${stance}`;
      const accent = ability?.startsWith('awaken') ? '#b067ff' : active.def.color;
      ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 14px Rajdhani, sans-serif';
      const width = Math.min(560, ctx.measureText(text).width + 34);
      ctx.fillStyle = 'rgba(5,5,12,0.82)'; ctx.fillRect(this.W / 2 - width / 2, 48, width, 25);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(this.W / 2 - width / 2, 48, width, 25);
      ctx.fillStyle = '#fff'; ctx.fillText(text, this.W / 2, 65); ctx.restore();
    }
    // training combo counter
    if (this.cfg.rule === 'training') {
      const d = this.fighters.find((f) => f.isCPU);
      if (d && d.comboHits >= 2) {
        ctx.save(); ctx.textAlign = 'right';
        ctx.font = 'italic 900 52px Bangers, Impact, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd24a';
        ctx.strokeText(`${d.comboHits} HITS`, this.W - 30, 140); ctx.fillText(`${d.comboHits} HITS`, this.W - 30, 140);
        ctx.font = 'bold 22px Rajdhani, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeText(`${Math.round(d.comboDmg)} DAMAGE`, this.W - 30, 170); ctx.fillText(`${Math.round(d.comboDmg)} DAMAGE`, this.W - 30, 170);
        ctx.restore();
      }
    }
  }

  drawCinematic(ctx: CanvasRenderingContext2D) {
    const c = this.cin!; const W = this.W, H = this.H;
    const total = 70;                      // matches the default cinematic length
    const t = total - c.t;
    const inK = Math.min(1, t / 10), outK = Math.min(1, c.t / 10), k = inK * outK;
    const col = c.f.def.color;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`; ctx.fillRect(0, 0, W, H);

    // Letterbox: a real cinematic frame, tightened at the midpoint.
    const bar = H * 0.1 * k;
    ctx.fillStyle = `rgba(0,0,0,${0.92 * k})`;
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    ctx.fillStyle = col;
    ctx.globalAlpha = k; ctx.fillRect(0, bar - 2, W, 2); ctx.fillRect(0, H - bar, W, 2);
    ctx.globalAlpha = 1;

    // Radial burst, tinted to the fighter, spinning up during the entrance.
    ctx.save();
    ctx.translate(W / 2, H * 0.46);
    ctx.globalCompositeOperation = 'lighter';
    const rays = 46;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + t * 0.012;
      const r1 = Math.max(W, H) * (0.3 + ((i * 37) % 12) / 30) * (1 + (1 - inK) * 1.6);
      const r2 = Math.max(W, H);
      ctx.strokeStyle = i % 3 ? `rgba(255,255,255,${0.16 * k})` : `rgba(255,255,255,${0.05 * k})`;
      ctx.lineWidth = i % 4 ? 2 : 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
    // Coloured core bloom behind the banner.
    const cg = ctx.createRadialGradient(0, 0, 4, 0, 0, Math.max(W, H) * 0.5);
    cg.addColorStop(0, `${col}44`); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, Math.max(W, H) * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // banner
    const by = H * 0.68, bh = 110;
    const slide = (1 - inK) * W;
    ctx.translate(-slide, 0);
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.globalAlpha = outK;
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by - 40); ctx.lineTo(W, by - 40 + bh); ctx.lineTo(0, by + bh); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = outK * 0.3;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by - 40); ctx.lineTo(W, by - 34); ctx.lineTo(0, by + 6); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const img = loadImage(c.f.def.portrait);
    if (img.complete && img.naturalWidth) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(40, by - 10); ctx.lineTo(300, by - 30); ctx.lineTo(300, by + bh - 20); ctx.lineTo(40, by + bh + 10); ctx.clip();
      ctx.drawImage(img, 40, by - 110, 260, 260); ctx.restore();
    }
    ctx.font = `italic 900 ${Math.min(64, W / 16)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'left';
    ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
    ctx.strokeText(c.name, 330, by + 62); ctx.fillText(c.name, 330, by + 62);
    ctx.font = 'bold 18px Rajdhani, sans-serif'; ctx.fillStyle = col; ctx.strokeText(c.f.def.name.toUpperCase(), 334, by + 90); ctx.fillText(c.f.def.name.toUpperCase(), 334, by + 90);
    // Awakening state chip, so the player knows exactly which of their three
    // buttons is currently pointing somewhere else.
    const ability = c.f.move?.ability;
    if (ability) {
      const label = ability === 'awaken' ? 'AWAKENING'
        : ability === 'awakenLight' ? 'AWAKENED · J'
          : ability === 'awakenHeavy' ? 'AWAKENED · K'
            : ability === 'awakened' ? 'AWAKENED · L' : 'SPECIAL';
      const accent = ability === 'special' ? c.f.def.color : '#b067ff';
      ctx.font = 'black 15px Rajdhani, sans-serif';
      const w = ctx.measureText(label).width + 22;
      ctx.fillStyle = accent; ctx.fillRect(334, by + 100, w, 24);
      ctx.fillStyle = '#0b0b10'; ctx.fillText(label, 345, by + 117);
    }
    ctx.restore();
  }

  drawBanners(ctx: CanvasRenderingContext2D) {
    const W = this.W, H = this.H;
    let text = '', size = 120, col = '#fff';
    if (this.countdown > 0) {
      const c = this.countdown;
      if (c > 150) text = ''; else if (c > 100) text = '3'; else if (c > 50) text = '2'; else text = '1';
      if (c > 150) { text = 'READY?'; size = 80; }
    } else if (this.frame < 200 && this.cfg.rule !== 'training' && !this.ended) {
      const since = this.frame - 170; if (since >= 0 && since < 40) { text = 'FIGHT!'; col = '#ffd24a'; size = 140 - since; }
    }
    if (this.ended) { text = 'GAME!'; col = '#ff4757'; size = 150; }
    if (!text) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pulse = 1 + Math.sin(this.frame * 0.3) * 0.03;
    ctx.translate(W / 2, H * 0.4); ctx.scale(pulse, pulse); ctx.rotate(-0.05);
    ctx.font = `italic 900 ${size}px Bangers, Impact, sans-serif`;
    ctx.lineWidth = 14; ctx.strokeStyle = '#000'; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = col; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}
