/**
 * KO REPLAY
 *
 * A ring buffer of the last few seconds of the fight, so a knockout can be
 * replayed immediately: the five seconds leading into the blow, the blow, and
 * the beat after it.
 *
 * Design notes
 *  - **Pre-allocated.** Every frame slot owns its own typed arrays and is
 *    written in place, so recording allocates nothing after the first pass.
 *    Recording happens on the same frame as a real fight, which is the last
 *    place in the engine that can afford garbage.
 *  - **Effects are stored flat.** Pools are written as packed numbers plus a
 *    parallel string list rather than as cloned objects: a mid-fight frame is a
 *    few hundred numbers, and cloning effect objects every frame would be the
 *    single largest source of garbage in the renderer.
 *  - **The world is frozen, so identity is free.** While a replay plays the
 *    simulation is not stepped, which means the Projectile *objects* recorded
 *    five seconds ago are still exactly the same objects. A frame slot
 *    therefore stores references and only has to write the per-frame numbers
 *    back; `type`, `sig`, `data`, `col` and friends never change underneath it.
 *  - **Presentation only.** Nothing here can touch damage, meter, score or the
 *    match clock, because nothing here runs the simulation.
 */

import type { Projectile } from './projectiles';
import { SWING_STYLE_NAMES, type SwingStyle } from './animeFx';

/** Mirrors `animeFx`'s own fallback so a swing is never left profile-less. */
const FALLBACK = { style: 'blade' as SwingStyle, col: '#ffffff', col2: '#ffffff' };

const FIGHTER_SLOTS = 4;
const PROJ_SLOTS = 6;
/** Game caps speed-line bursts at six. */
const SL_SLOTS = 6;
const FX_CAP = 48;

/** Seconds of lead-in played back before the knockout. */
export const REPLAY_LEAD_IN = 5;
const LEAD_IN_FRAMES = REPLAY_LEAD_IN * 60;
/** Frames the live game keeps control locked so the KO can breathe. */
const AFTERMATH_FRAMES = 60;

/**
 * A recorded pool of same-shaped effect objects, stored packed.
 *
 * `pack`/`unpack` exist because one effect record carries a *nested* object: an
 * animated swing stores its whole `SwingProfile` on the effect. That cannot be
 * flattened into a number list without losing the shape, and losing the shape
 * is exactly how this buffer used to hand the renderer an object it could not
 * draw.
 */
class Pool {
  n = 0;
  readonly num: Float64Array;
  readonly str: string[] = [];
  constructor(
    readonly stride: number, readonly keys: string[], readonly strKeys: string[], readonly cap: number,
    readonly pack?: (ob: any, num: Float64Array, str: string[], base: number) => void,
    readonly unpack?: (dest: any, num: Float64Array, str: string[], base: number) => void,
  ) {
    this.num = new Float64Array(stride * cap);
    this.str = new Array(strKeys.length * cap).fill('');
  }
  reset() { this.n = 0; }
  slot(i: number) { return i * this.stride; }
}

const P = (keys: string[], strKeys: string[], stride: number, cap: number) => new Pool(stride, keys, strKeys, cap);

/**
 * SWING PROFILE ROUND TRIP — the channel that caused the freeze.
 *
 * The swing pool used to list `facing` (a field the effect does not have) and
 * never listed `p`, the one field it does. A restored swing was therefore a bare
 * `{}` with no profile, `drawSwing` destructured `s.p` off `undefined`, and threw
 * a TypeError. That throw lands inside the animation-frame callback, so the loop
 * is never re-armed: the player sees a permanent hang on the last rendered frame
 * with no stack trace and no way out.
 *
 * `p` is now recorded as one numeric style index plus two packed colour strings
 * and rebuilt on restore. `facing` is dropped from the schema because the
 * direction is already baked into `a0`/`a1` at spawn time.
 */
const SWING_STYLE = 9;               // numeric offset, past the 9 packed fields
const SWING_STRIDE = 10;
const SWING_COL = 0, SWING_COL2 = 1; // string slots within the effect's row

const packSwing = (ob: any, num: Float64Array, str: string[], base: number) => {
  const p = ob.p || FALLBACK;
  const i = SWING_STYLE_NAMES.indexOf(p.style as SwingStyle);
  num[base * SWING_STRIDE + SWING_STYLE] = i >= 0 ? i + 1 : 0;
  str[base * 2 + SWING_COL] = p.col || '#ffffff';
  str[base * 2 + SWING_COL2] = p.col2 || '#ffffff';
};
const unpackSwing = (dest: any, num: Float64Array, str: string[], base: number) => {
  const i = num[base * SWING_STRIDE + SWING_STYLE] | 0;
  dest.p = {
    style: i > 0 && i <= SWING_STYLE_NAMES.length ? SWING_STYLE_NAMES[i - 1] : FALLBACK.style,
    col: str[base * 2 + SWING_COL] || FALLBACK.col,
    col2: str[base * 2 + SWING_COL2] || FALLBACK.col2,
  };
};

/** How much of each effect pool is worth replaying. */
const POOLS = {
  parts: P(['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 'grav', 'drag'], ['color', 'kind'], 9, FX_CAP),
  rings: P(['x', 'y', 'r0', 'r1', 'life', 'max', 'w'], ['color'], 8, 32),
  impacts: P(['x', 'y', 'r', 'life', 'max', 'seed'], ['color'], 6, 24),
  blooms: P(['x', 'y', 'r', 'life', 'max', 'grow'], ['color'], 6, 26),
  shocks: P(['x', 'y', 'r', 'life', 'max', 'spin'], ['color'], 6, 18),
  callis: P(['x', 'y', 'life', 'max', 'size', 'ang', 'seed'], ['text', 'color'], 7, 8),
  texts: P(['x', 'y', 'life', 'max', 'size'], ['text', 'color'], 5, 16),
  slashes: P(['x', 'y', 'r', 'a0', 'a1', 'facing', 'life', 'max', 'w'], ['color'], 9, 32),
  swings: new Pool(SWING_STRIDE, ['x', 'y', 'r', 'a0', 'a1', 'life', 'max', 'thick', 'seed'], [], 36, packSwing, unpackSwing),
  beams: P(['x', 'y', 'ang', 'life', 'max'], ['color'], 5, 6),
} as const;

/** Per-fighter fields that actually move the picture. */
const F_STRIDE = 24;
/** Per-projectile fields that actually move the picture. */
const P_STRIDE = 10;

class FrameSlot {
  fNum = new Float64Array(FIGHTER_SLOTS * F_STRIDE);
  fState: string[] = [];
  fMove: string[] = [];
  fCount = 0;
  pNum = new Float64Array(PROJ_SLOTS * P_STRIDE);
  pRefs: (Projectile | null)[] = new Array(PROJ_SLOTS).fill(null);
  pCount = 0;
  cam = new Float64Array(8);
  camStr: string[] = [''];
  // Speed-line bursts, packed. They are a live array on Game, so they have to be
  // recorded as data - writing them into a camera slot once clobbered the array
  // with a number, and the next `step` died iterating it.
  static readonly SL_STRIDE = 5;
  slNum = new Float64Array(SL_SLOTS * FrameSlot.SL_STRIDE);
  slCount = 0;
  readonly pools: Record<string, Pool>;
  constructor() {
    this.pools = {};
    // POOLS is only a template; every slot needs buffers of its own.
    for (const k in POOLS) this.pools[k] = new Pool(POOLS[k].stride, POOLS[k].keys, POOLS[k].strKeys, POOLS[k].cap);
  }
  reset() {
    this.fCount = 0; this.pCount = 0; this.slCount = 0;
    for (let i = 0; i < FIGHTER_SLOTS; i++) { this.fState[i] = ''; this.fMove[i] = ''; this.pRefs[i] = null; }
    for (const k in this.pools) this.pools[k].reset();
  }
}

/** Each slot needs its own buffers; the POOLS table is only a template. */

export interface ReplayStatus {
  /** True while a replay owns the screen. */
  active: boolean;
  /** 0..1 through the lead-in. */
  progress: number;
  /** Frames between the frame on screen and the knockout frame. */
  toKill: number;
  /** True while the knockout frame itself is on screen. */
  onKill: boolean;
  /** True while the replay is ramping into slow motion. */
  slowing: boolean;
}

export class ReplayBuffer {
  private slots: FrameSlot[] = [];
  private head = 0;
  private filled = 0;

  armed = false;
  playing = false;
  private clock = 0;
  private from = 0;
  private koIndex = 0;
  /**
   * True between the frame that raised the replay and the frame that captured
   * it. `ko` fires part-way through a step while `record` runs at the end of it,
   * so at the instant a knockdown is announced the blow itself has *not* been
   * written to the ring yet. Pinning the knockout index here and resolving it
   * from the next `record` is what puts the hit that ended the fight on screen;
   * guessing at it from `filled` instead lands one frame short, and the result
   * banner stamps over the very blow it is announcing.
   */
  private koPending = false;
  /** Frames the KO impact is left to play at full speed before the rewind. */
  private armDelay = 0;
  /** The live world, stashed so the replay can hand it back untouched. */
  private liveProjectiles: Projectile[] | null = null;
  private liveFighters: Float64Array | null = null;
  private liveState: string[] = [];
  private liveMove: string[] = [];
  /** Live frames of no-input owed after the replay, so the KO plays out. */
  aftermath = 0;
  /**
   * Recomputed every frame by `tickAftermath`, and the *only* thing `ownsScreen`
   * trusts. Derived-on-read state cannot latch: if the countdown were ever to
   * stop being ticked, this simply stays false and the match runs at its own
   * time scale again, instead of the fight quietly freezing at 0.35x forever.
   */
  private aftermathLive = false;
  /** Engine frame on which the current no-input window was opened. */
  private aftermathFrame = 0;

  constructor(private readonly capacity = LEAD_IN_FRAMES + 12) {
    for (let i = 0; i < this.capacity; i++) this.slots.push(new FrameSlot());
  }

  /**
   * Usable slots. A completely full ring is ambiguous by exactly one: the oldest
   * logical frame and the newest one resolve to the same slot, so whichever was
   * written last silently overwrote the start of the lead-in. Keeping one slot
   * spare means the ring is never full and the two ends are always distinct.
   */
  private get usable() { return this.capacity - 1; }

  get count() { return this.filled; }
  get active() { return this.playing; }
  /**
   * True whenever the replay owns the screen: the lead-in, the knockout itself
   * and the beat handed back to the live game afterwards. The main loop uses
   * this to ignore the match's own time scale - a match-ending knockout sets
   * `timeScale` to 0.35, and without this a seven-second replay is stretched
   * into twenty of apparent freeze, on precisely the beat that must not drag.
   */
  get ownsScreen() { return this.armed || this.playing || this.aftermathLive; }

  get status(): ReplayStatus {
    const span = Math.max(1, this.koIndex - this.from);
    const toKill = this.koIndex - this.cursor();
    return {
      active: this.playing,
      progress: Math.max(0, Math.min(1, (this.clock - this.from) / span)),
      toKill,
      onKill: this.playing && toKill <= 1,
      slowing: this.playing && toKill > 1 && toKill < 66,
    };
  }

  private index(i: number) { return (this.head - this.filled + i + this.capacity * 2) % this.capacity; }
  private cursor() { return this.from + this.clock; }

  reset() {
    this.head = 0; this.filled = 0;
    this.armed = false; this.playing = false; this.koPending = false;
    this.aftermath = 0;
    this.liveProjectiles = null; this.liveFighters = null;
  }

  /** Packs the fighter block of a live world into a flat array. */
  private packFighters(g: any, n: Float64Array, st: string[], mv: string[]) {
    const c = Math.min(g.fighters.length, FIGHTER_SLOTS);
    for (let i = 0; i < c; i++) {
      const f = g.fighters[i], o = i * F_STRIDE;
      n[o + 0] = f.x; n[o + 1] = f.y; n[o + 2] = f.vx; n[o + 3] = f.vy;
      n[o + 4] = f.facing; n[o + 5] = f.animT; n[o + 6] = f.stateT; n[o + 7] = f.runPhase;
      n[o + 8] = f.grounded ? 1 : 0; n[o + 9] = f.tumble; n[o + 10] = f.landT; n[o + 11] = f.djumpT;
      n[o + 12] = f.invuln; n[o + 13] = f.hitstun; n[o + 14] = f.hitstop; n[o + 15] = f.flashT;
      n[o + 16] = f.damage; n[o + 17] = f.meter; n[o + 18] = f.godT; n[o + 19] = f.devilT;
      n[o + 20] = f.auraT; n[o + 21] = f.evadeT; n[o + 22] = f.moveFrame; n[o + 23] = f.koT;
      st[i] = f.state; mv[i] = f.moveKey || '';
    }
  }

  /** Writes a packed fighter block back onto the live fighters. */
  private unpackFighters(g: any, n: Float64Array, st: string[], mv: string[]) {
    for (let i = 0; i < g.fighters.length && i < FIGHTER_SLOTS; i++) {
      const f = g.fighters[i], o = i * F_STRIDE;
      f.x = n[o]; f.y = n[o + 1]; f.vx = n[o + 2]; f.vy = n[o + 3];
      f.facing = n[o + 4]; f.animT = n[o + 5]; f.stateT = n[o + 6]; f.runPhase = n[o + 7];
      f.grounded = n[o + 8] > .5; f.tumble = n[o + 9]; f.landT = n[o + 10]; f.djumpT = n[o + 11];
      f.invuln = n[o + 12]; f.hitstun = n[o + 13]; f.hitstop = n[o + 14]; f.flashT = n[o + 15];
      f.damage = n[o + 16]; f.meter = n[o + 17]; f.godT = n[o + 18]; f.devilT = n[o + 19];
      f.auraT = n[o + 20]; f.evadeT = n[o + 21]; f.moveFrame = n[o + 22]; f.koT = n[o + 23];
      f.state = st[i] || 'idle';
      const key = mv[i];
      f.moveKey = key && (f.def.moves as any)[key] ? key : null;
      f.move = f.moveKey ? (f.def.moves as any)[f.moveKey] : null;
    }
  }

  /** Records the current world into the next ring slot. */
  record(g: any) {
    const s = this.slots[this.head];
    s.reset();

    // ---- fighters ----
    s.fCount = Math.min(g.fighters.length, FIGHTER_SLOTS);
    this.packFighters(g, s.fNum, s.fState, s.fMove);

    // ---- projectiles (reference + per-frame numbers) ----
    s.pCount = Math.min(g.projectiles.length, PROJ_SLOTS);
    for (let i = 0; i < s.pCount; i++) {
      const p = g.projectiles[i], o = i * P_STRIDE, n = s.pNum;
      s.pRefs[i] = p;
      n[o + 0] = p.x; n[o + 1] = p.y; n[o + 2] = p.vx; n[o + 3] = p.vy;
      n[o + 4] = p.w; n[o + 5] = p.h; n[o + 6] = p.dir; n[o + 7] = p.t;
      n[o + 8] = p.life; n[o + 9] = p.ang;
    }

    // ---- camera + screen juice ----
    s.cam[0] = g.cam.x; s.cam[1] = g.cam.y; s.cam[2] = g.cam.z;
    s.cam[3] = g.shakeAmt; s.cam[4] = g.flash.a; s.cam[5] = g.punch.t;
    s.cam[6] = g.negFrames; s.cam[7] = g.frame;
    s.camStr[0] = g.flash.c;

    // ---- speed-line bursts ----
    s.slCount = Math.min(g.speedLines.length, SL_SLOTS);
    for (let i = 0; i < s.slCount; i++) {
      const l = g.speedLines[i], o = i * FrameSlot.SL_STRIDE;
      s.slNum[o] = l.ang; s.slNum[o + 1] = l.life; s.slNum[o + 2] = l.max;
      s.slNum[o + 3] = l.seed; s.slNum[o + 4] = l.power;
    }

    // ---- effects ----
    const fx = g.fx;
    for (const key in s.pools) {
      const pool = s.pools[key];
      const src = (fx as any)[key] as any[] | undefined;
      pool.reset();
      if (!src || !src.length) continue;
      // Newest-first on record so a truncated pool keeps the freshest sparks.
      const cap = pool.cap;
      const start = Math.max(0, src.length - cap);
      let n = 0;
      for (let i = src.length - 1; i >= start; i--, n++) {
        const ob = src[i], o = pool.slot(n);
        for (let k = 0; k < pool.keys.length; k++) { const v = ob[pool.keys[k]]; pool.num[o + k] = typeof v === 'number' ? v : 0; }
        for (let k = 0; k < pool.strKeys.length; k++) { const v = ob[pool.strKeys[k]]; pool.str[n * pool.strKeys.length + k] = v == null ? '' : String(v); }
        pool.pack?.(ob, pool.num, pool.str, n);
      }
      pool.n = n;
    }

    this.head = (this.head + 1) % this.capacity;
    if (this.filled < this.usable) this.filled++;
    // The knockout has now been written. This is the only moment at which the
    // index of the blow inside the ring is known, so it is resolved here.
    if (this.koPending) { this.koPending = false; this.anchorToKnockout(); }
  }

  /**
   * Points the playhead at the knockout.
   *
   * `filled` counts the frame that was just recorded, so the newest logical
   * index is `filled - 1` - and that is the frame holding the blow, because
   * `koPending` is only set on the step that applies the knockdown. This holds
   * whether or not the ring is full: `filled` is clamped to `usable`, and a
   * capped ring's newest frame is still `filled - 1`.
   */
  private anchorToKnockout() {
    this.koIndex = Math.max(0, this.filled - 1);
    this.from = Math.max(0, this.koIndex - LEAD_IN_FRAMES);
    this.clock = 0;
  }

  /**
   * Raises the replay on the frame that recorded a knockout, and stashes the
   * live world. The KO impact is deliberately left to play at full speed first:
   * rewinding the instant the blow lands throws the read away.
   */
  arm(g: any, holdFrames = 24) {
    if (this.armed || this.playing) return;
    this.armed = true;
    this.koPending = true;
    this.armDelay = holdFrames;
    // A fresh knockdown supersedes any aftermath still owed from a previous
    // replay, so the two can never fight over who owns the screen.
    this.aftermath = 0;
    this.liveProjectiles = g.projectiles;
    if (!this.liveFighters) {
      this.liveFighters = new Float64Array(FIGHTER_SLOTS * F_STRIDE);
      this.liveState = new Array(FIGHTER_SLOTS).fill('');
      this.liveMove = new Array(FIGHTER_SLOTS).fill('');
    }
    this.packFighters(g, this.liveFighters, this.liveState, this.liveMove);
  }

  /**
   * Ticks the full-speed KO beat. Returns true on the frame the replay should
   * start, so Game can branch on it without knowing the delay exists.
   */
  tickArm(): boolean {
    if (!this.armed) return false;
    if (this.armDelay > 0) { this.armDelay--; return false; }
    // Refuse to start before the knockout frame has actually been written, so a
    // replay can never open on a playhead that points at a frame that does not
    // exist yet. Abandoning outright is safe: the KO still played live.
    if (this.koPending) { this.armed = false; this.liveProjectiles = null; return false; }
    if (this.koIndex - this.from < 36) { this.armed = false; this.liveProjectiles = null; return false; }
    this.armed = false;
    this.playing = true;
    this.clock = 0;
    return true;
  }

  /**
   * Advances playback by one 1/60 s of *replay* time. The rate is chosen here:
   * real time through the lead-in, a ramp down for the last second so the
   * approach to the blow can be read, then a near-hold on the knockout.
   *
   * `frame` is the engine clock, carried only so the post-replay window can be
   * stamped and proved finite.
   */
  advance(frame = 0): void {
    if (!this.playing) return;
    const toKill = this.koIndex - this.cursor();
    let rate = 1;
    if (toKill <= 1) rate = 0.12;                                    // hold on the blow
    else if (toKill < 66) rate = 0.12 + (toKill - 1) / 65 * 0.58;       // ramp back to 1x
    this.clock += rate;
    if (this.cursor() >= this.koIndex) this.end(frame);
  }

  end(frame = 0) {
    this.playing = false;
    this.aftermath = AFTERMATH_FRAMES;
    this.aftermathFrame = frame;
    this.aftermathLive = true;
  }

  /**
   * Hands the world back to the live game. Without this the fighters would keep
   * the last replayed frame, and the knockout would appear to un-happen.
   */
  release(g: any) {
    if (this.liveProjectiles) { g.projectiles = this.liveProjectiles; this.liveProjectiles = null; }
    if (this.liveFighters) this.unpackFighters(g, this.liveFighters, this.liveState, this.liveMove);
  }

  /** Pushes the recorded frame currently under the cursor onto the live objects. */
  apply(g: any) {
    if (!this.playing) return;
    const i = Math.min(this.filled - 1, Math.max(0, Math.floor(this.cursor())));
    const s = this.slots[this.index(i)];

    for (let k = 0; k < s.fCount && k < g.fighters.length; k++) {
      const f = g.fighters[k], o = k * F_STRIDE, n = s.fNum;
      f.x = n[o]; f.y = n[o + 1]; f.vx = n[o + 2]; f.vy = n[o + 3];
      f.facing = n[o + 4]; f.animT = n[o + 5]; f.stateT = n[o + 6]; f.runPhase = n[o + 7];
      f.grounded = n[o + 8] > .5; f.tumble = n[o + 9]; f.landT = n[o + 10]; f.djumpT = n[o + 11];
      f.invuln = n[o + 12]; f.hitstun = n[o + 13]; f.hitstop = n[o + 14]; f.flashT = n[o + 15];
      f.damage = n[o + 16]; f.meter = n[o + 17]; f.godT = n[o + 18]; f.devilT = n[o + 19];
      f.auraT = n[o + 20]; f.evadeT = n[o + 21]; f.moveFrame = n[o + 22]; f.koT = n[o + 23];
      f.state = s.fState[k] || 'idle';
      const key = s.fMove[k];
      f.moveKey = key && (f.def.moves as any)[key] ? key : null;
      f.move = f.moveKey ? (f.def.moves as any)[f.moveKey] : null;
    }
    // Projectiles: same objects, current numbers. The live array is handed back
    // by `release`, so mutating these cannot leak into the resumed match.
    const list: Projectile[] = [];
    for (let k = 0; k < s.pCount; k++) {
      const p = s.pRefs[k]; if (!p) continue;
      const o = k * P_STRIDE, n = s.pNum;
      p.x = n[o]; p.y = n[o + 1]; p.vx = n[o + 2]; p.vy = n[o + 3];
      p.w = n[o + 4]; p.h = n[o + 5]; p.dir = n[o + 6]; p.t = n[o + 7];
      p.life = n[o + 8]; p.ang = n[o + 9];
      list.push(p);
    }
    g.projectiles = list;

    g.cam.x = s.cam[0]; g.cam.y = s.cam[1]; g.cam.z = s.cam[2];
    g.shakeAmt = s.cam[3]; g.flash.a = s.cam[4]; g.punch.t = s.cam[5];
    g.negFrames = s.cam[6];
    if (s.camStr[0]) g.flash.c = s.camStr[0];

    // Speed-line bursts: rebuilt in place, because Game owns a live array here
    // and replacing it wholesale would drop whatever `step` is holding.
    const sl = g.speedLines;
    for (let k = 0; k < s.slCount; k++) {
      const o = k * FrameSlot.SL_STRIDE, n = s.slNum;
      const b = sl[k] || (sl[k] = { ang: 0, life: 0, max: 1, seed: 0, power: 0 });
      b.ang = n[o]; b.life = n[o + 1]; b.max = n[o + 2]; b.seed = n[o + 3]; b.power = n[o + 4];
    }
    if (sl.length > s.slCount) sl.length = s.slCount;

    // Effects: repopulate each pool. These are the only objects allocated per
    // replay frame, and only for the pools that actually have something in them.
    const fx = g.fx;
    for (const key in s.pools) {
      const pool = s.pools[key], dest = (fx as any)[key] as any[];
      if (!Array.isArray(dest)) continue;
      const n = pool.n;
      if (dest.length > n) dest.length = n;
      for (let m = 0; m < n; m++) {
        const o = pool.slot(m);
        const ob: any = dest[m] || (dest[m] = {});
        for (let k = 0; k < pool.keys.length; k++) ob[pool.keys[k]] = pool.num[o + k];
        for (let k = 0; k < pool.strKeys.length; k++) ob[pool.strKeys[k]] = pool.str[m * pool.strKeys.length + k];
        pool.unpack?.(ob, pool.num, pool.str, m);
      }
    }
  }

  /**
   * Counts down the post-replay no-input window and republishes whether one is
   * still owed.
   *
   * The window is bounded twice over: by the countdown, and by a staleness
   * check against the engine clock. The second bound is what guarantees a stuck
   * countdown can never hold the match's time scale hostage - the exact failure
   * that shipped as "the game freezes when a replay is active".
   */
  tickAftermath(frame = 0) {
    if (this.aftermath > 0) {
      if (frame - this.aftermathFrame > AFTERMATH_FRAMES * 3) this.aftermath = 0;
      else this.aftermath--;
    }
    this.aftermathLive = this.aftermath > 0;
  }
}
