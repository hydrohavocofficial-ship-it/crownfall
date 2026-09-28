import { CharDef, MoveKey } from './characters';
import { Controller } from './input';
import { MoveDef } from './types';
import { computePose, drawFighter, drawStandDio, drawGhosts, type Ghost } from './render';
import { runVfx } from './vfx';
import { sfx, attackSound, slashTierFor } from './audio';
import { AWAKEN_DAMAGE, AWAKEN_SPEED, AWAKEN_SEAL, GAUGE_DRAIN, JUGGLE_BUDGET, AWAKEN_FLOOR } from './combat';

export const GRAV = 0.62;
const SPECIALS: MoveKey[] = ['nspec', 'sspec', 'dspec'];
export const AWAKEN_MOVES: MoveKey[] = ['naw', 'saw', 'daw', 'aaw'];
const AWAKEN_LIGHT: MoveKey[] = ['nwl', 'swl', 'dwl', 'awl'];
const AWAKEN_HEAVY: MoveKey[] = ['nwh', 'swh', 'dwh', 'awh'];
const AWAKEN_SPECIAL: MoveKey[] = ['nfu', 'sfu', 'dfu', 'afu'];
const COOLDOWN_MOVES: MoveKey[] = [...SPECIALS, ...AWAKEN_MOVES, ...AWAKEN_LIGHT, ...AWAKEN_HEAVY, ...AWAKEN_SPECIAL];
const EXTRA_COOLDOWN_MOVES = ['aspec', 'aig', 'boss_heavy2'] as const;
const SIGS: MoveKey[] = ['nsig', 'ssig', 'dsig'];

/** The buttons a cancel can be bound to, in the order they are offered. */
const CHAIN_ACTIONS = ['light', 'heavy', 'special', 'awaken'] as const;

export class Fighter {
  def: CharDef; look: CharDef['look']; scale: number; hw: number; h: number;
  idx: number; label: string; color: string; isCPU: boolean;
  x = 0; y = 0; vx = 0; vy = 0; facing = 1;
  grounded = false; state = 'air'; stateT = 0;
  maxJumps = 3; jumps = 3; recoveryUsed = false;
  /** Anti-infinite-flight: rising moves used this airtime, and frames spent floating. */
  airLifts = new Set<string>(); airLiftCount = 0; hoverT = 0;
 airDodgeUsed = false; dodgeCD = 0;
  damage = 0; stocks = 3; score = 0; kos = 0; falls = 0; dmgDealt = 0; dmgTaken = 0; hitsLanded = 0;
  move: MoveDef | null = null; moveKey: MoveKey | null = null; moveFrame = 0; moveDur = 0; moveActiveEnd = 0;
  hitMap = new Map<Fighter, Map<number, number>>();
  hitstun = 0; hitstop = 0; invuln = 0; tumble = 0; shakeT = 0;
  meter = 0; cds: Record<string, number> = { nspec: 0, sspec: 0, dspec: 0, naw: 0, saw: 0, daw: 0, aaw: 0, nwl: 0, swl: 0, dwl: 0, awl: 0, nwh: 0, swh: 0, dwh: 0, awh: 0, nfu: 0, sfu: 0, dfu: 0, afu: 0, aspec: 0, aig: 0, boss_heavy2: 0 };
  godT = 0; devilT = 0; auraT = 0;
  /**
   * AWAKENED.
   *
   * Set the frame a full gauge is spent, cleared when the gauge empties or the
   * fighter falls. While it is set, the three attack buttons address a different
   * moveset (see `AWAKENED_TIERS`) and the gauge drains on its own.
   */
  awakened = false;
  /** Frames the transformation itself has been locked out for. */
  awakenLock = 0;
  /**
   * Frames after the Awakening closed during which this fighter's own blows
   * still cannot build the gauge.
   *
   * The state is resolved in `update`, and a hit lands after it, so without this
   * the last hit of an exhausted Awakening - the one that emptied the bar - would
   * be paid for with a sliver of the gauge it just spent. The Awakening's damage
   * is never the Awakening's fuel, including on the frame it ends.
   */
  awakenSealedT = 0;
  /**
   * Re-launches this fighter can still be given before they stop being lifted.
   *
   * Damage-scaled knockback alone does not stop a juggle: a move with a wide
   * active window can keep touching a body that gravity has not yet caught, and
   * the sequence never ends. This is the hard stop. Reset on landing and on
   * respawn; see `JUGGLE_BUDGET`.
   */
  juggleLeft = JUGGLE_BUDGET;
  /** How many times this sequence has already launched them. */
  juggleCount = 0;
  animT = 0; runPhase = 0; djumpT = 99; landT = 0;
  dropT = 0; wallSide = 0; fastFall = false;
  trail: { x: number; y: number }[] = [];
  lastHitBy: Fighter | null = null; lastHitTime = 0;
  /** Damage of the most recent hit taken; drives the flinch pose severity. */
  lastHitDmg = 0;
  koT = 0; eliminated = false; placement = 0;
  ultTarget: Fighter | null = null; ultStart = 0;
  ctrl = new Controller();
  comboHits = 0; comboDmg = 0; comboTimer = 0;
  tipX = 0; tipY = 0; footX = 0; footY = 0; handX = 0; handY = 0;
  lastAttackFrame = -999;
  moveHitStart = 0;
  moveConnected = false;
  recentMoves: { key: string; name: string; frame: number }[] = [];
  flashT = 0;
  sukunaFlash = 0; sukunaBlackFlash = false;
  sukunaLaunchTarget: Fighter | null = null; sukunaGrabTarget: Fighter | null = null;
  /** Shadow DIO's Blood Drain victim, held on the throat for the whole drain. */
  dioDrainTarget: Fighter | null = null;
  /** Per-knockout guards so a single fall can never retrigger a KO cue. */
  koCueFired = false;
  laughCueFired = false;
  /** Stand manifestation: counts down while the summoned entity is visible. */
  standT = 0; standDur = 0; standAttackT = 0; standActive = false;
  /** Set by the engine each step while this fighter is held in frozen time. */
  frozen = false;
  /**
   * ULTRA INSTINCT — Migatte no Gokui (movement without thought).
   * `evadeT` counts down the silver after-image window left by an autonomous
   * slip; `evadeCD` is the two-second internal gauge that keeps the passive
   * from becoming an unconditional "no".
   */
  evadeT = 0; evadeCD = 0;
  /** Motion after-images. Filled only while the body is genuinely moving fast. */
  ghosts: Ghost[] = [];
  /** Guards the one-shot launch speed-line burst per hitstun. */
  launchFx = false;

  constructor(def: CharDef, idx: number, label: string, color: string, isCPU: boolean) {
    this.def = def; this.look = def.look; this.scale = def.stats.scale;
    this.hw = 15 * this.scale; this.h = 78 * this.scale;
    this.idx = idx; this.label = label; this.color = color; this.isCPU = isCPU;
  }

  get alive() { return this.state !== 'ko' && !this.eliminated; }
  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }

  /**
   * Which of the three awakened tiers a button addresses right now.
   *
   * The base kit is a plain stance lookup; the awakened kit is the same lookup
   * into a different table. Both take their direction from the stick at the
   * instant of the press, so the Awakening changes *what* the buttons do without
   * changing how they are aimed.
   */
  private stanceTier(tiers: MoveKey[]): MoveKey {
    const c = this.ctrl;
    if (!this.grounded) return tiers[3];
    return c.dirY() > 0 ? tiers[2] : c.dirX() ? tiers[1] : tiers[0];
  }

  speedMul() {
    return (this.godT > 0 ? 1.4 : 1) * (this.devilT > 0 ? 1.12 : 1) * (this.awakened ? AWAKEN_SPEED : 1);
  }
  dmgMul() {
    // The Awakening's own bonus is deliberately small. The power is supposed to
    // be in the moveset it grants; a flat multiplier on top of a stronger kit is
    // how a transformation quietly doubles a character's output.
    return (this.devilT > 0 ? 1.3 : this.godT > 0 ? 1.1 : 1) * (this.awakened ? AWAKEN_DAMAGE : 1);
  }

  /**
   * Ends the Awakening and hands the fighter back to their base kit.
   *
   * The gauge is *not* refunded: it has been spent, and the time it bought has
   * been lived through. Leaving a sliver behind would let a player re-awaken on
   * the next hit and never be out of the state.
   */
  endAwaken() {
    if (!this.awakened) return;
    this.awakened = false;
    this.meter = 0;
    this.auraT = 0;
    this.awakenSealedT = AWAKEN_SEAL;
    // A pending transformation is cancelled outright: it is the same resource.
    this.move = null; this.moveKey = null;
    this.state = this.grounded ? 'idle' : 'air';
    this.stateT = 0; this.trail = [];
  }

  startMove(key: MoveKey, g: any) {
    const m = this.def.moves[key];
    if (!m) return;
    const dx = this.ctrl.dirX();
    if (dx !== 0 && this.state !== 'wall') this.facing = dx;
    if (this.state === 'wall') this.facing = -this.wallSide;
    this.move = m; this.moveKey = key; this.moveFrame = 0; this.moveDur = m.dur;
    this.state = 'attack'; this.stateT = 0; this.hitMap.clear(); this.trail = [];
    this.moveActiveEnd = m.hits.length ? Math.max(...m.hits.map((h) => h.f[1])) : m.startup + 6;
    this.fastFall = false;
    // Stand-based moves manifest the Stand just before startup so the summon is
    // never an instant pop-in, and it dismisses itself after recovery.
    if (m.stand) {
      this.standT = 0; this.standDur = m.dur + 26; this.standAttackT = m.startup + 4; this.standActive = true;
      sfx('clip/appear');
    }
    if (key === 'dspec' && this.def.id === 'sukuna') { this.sukunaFlash = 24; this.sukunaBlackFlash = false; }
    this.lastAttackFrame = g.frame;
    this.moveHitStart = this.hitsLanded;
    this.moveConnected = false;
    this.recentMoves.push({ key, name: m.name || key, frame: g.frame });
    this.recentMoves = this.recentMoves.slice(-4);
    /**
     * COOLDOWNS.
     *
     * Cooldowns are per *tier*, not per move, so a whole stance set is spent
     * together. A boss's finisher is their neutral awakened special, so it is
     * covered by the awakened-special tier like everyone else's.
     */
    const rate = this.godT > 0 ? 0.5 : 1;
    if (AWAKEN_MOVES.includes(key)) {
      const cd = Math.max(240, m.cd || 240) * rate;
      for (const moveKey of AWAKEN_MOVES) this.cds[moveKey] = cd;
      // The gauge is not spent here - it *is* the clock. It was full a frame ago
      // (the engine gates the press on it) and it now falls from 100 to 0 over
      // the life of the state. Zeroing it here would end the Awakening on the
      // frame it began.
      this.meter = Math.min(100, Math.max(this.meter, AWAKEN_FLOOR));
      this.awakened = true;
      this.awakenLock = Math.max(this.awakenLock, 240);
    } else if (AWAKEN_SPECIAL.includes(key)) {
      const cd = Math.max(240, m.cd || 240) * rate;
      for (const moveKey of AWAKEN_SPECIAL) this.cds[moveKey] = cd;
    } else if (AWAKEN_HEAVY.includes(key)) {
      this.cds[key] = Math.max(90, m.cd || 90) * rate;
    } else if (SPECIALS.includes(key)) this.cds[key] = Math.max(150, m.cd || 150) * rate;
    else if (key === 'aspec' as MoveKey) this.cds.aspec = Math.max(150, m.cd || 150) * rate;
    else if (key === 'aig' as MoveKey) this.cds.aig = Math.max(150, m.cd || 150) * rate;
    if (key === 'rec') this.recoveryUsed = true;
    /**
     * ULTRA INSTINCT FORM. A `uiForm` fighter's Awakening repaints him in the
     * silver crown and the cosmic shell. This is a rule rather than a hook inside
     * each move, because a fighter's transformation can be re-homed after
     * authoring (Goku's Spirit Bomb arrives as a signature override) and the
     * silver form has to survive that.
     */
    if (this.def.uiForm && m.ability === 'awaken') this.godT = Math.max(this.godT, 220);
    // A retained set-piece earns a short cinematic. It is the one place the
    // engine still stops the world, and it is now behind a cooldown and a
    // fifteen-second window rather than a spent bar.
    if (m.cin && m.ability === 'awakened' && this.grounded) g.cinematic(this, m.name, m.cin);
    this.applyVel(0);
    m.onStart?.(this, g);
  }
  applyVel(fr: number) {
    const m = this.move; if (!m?.vel) return;
    for (const [f, vx, vy] of m.vel) if (f === fr) {
      if (vx !== null) this.vx = vx * this.facing * (this.godT > 0 ? 1.15 : 1);
      if (vy !== null) {
        // Each rising move lifts only once per airtime, and at most two
        // different rising moves may chain before gravity takes over again.
        if (vy < 0 && !this.grounded && this.moveKey !== 'rec') {
          const k = this.moveKey || '';
          if (this.airLifts.has(k) || this.airLiftCount >= 2) { this.vy = Math.max(this.vy, 0); continue; }
          if (fr === 0 || !this.airLifts.has(k)) { this.airLifts.add(k); this.airLiftCount++; }
        }
        this.vy = vy;
      }
    }
  }
  endMove() {
    this.move = null; this.moveKey = null; this.ultTarget = null;
    this.sukunaLaunchTarget = null; this.sukunaGrabTarget = null; this.sukunaBlackFlash = false;
    this.dioDrainTarget = null;
    this.state = this.grounded ? 'idle' : 'air'; this.stateT = 0; this.trail = [];
    // The Stand lingers for a few frames, then sinks away.
    if (this.standDur) this.standDur = Math.min(this.standDur, 22);
  }

  tryActions(g: any): boolean {
    const c = this.ctrl;
    const dx = c.dirX(), dy = c.dirY();
    // jump
    if (c.pressed('jump')) {
      c.consume('jump');
      if (this.grounded) {
        this.vy = -this.def.stats.jump * 1.1 * (this.godT > 0 ? 1.08 : 1); this.grounded = false; this.state = 'air'; this.jumps = this.maxJumps - 1;
        sfx('jump'); g.fx.burst(this.x, this.y, 6, 'rgba(230,230,230,0.8)', 3, 'smoke', 20, 6);
        return true;
      } else if (this.jumps > 0) {
        this.vy = -this.def.stats.jump * 0.95 * (this.godT > 0 ? 1.08 : 1); this.jumps--; this.djumpT = 0; this.fastFall = false;
        if (dx) this.vx = dx * this.def.stats.air * 0.8;
        sfx('djump'); g.fx.ring(this.x, this.y - 6, 6, 34, 'rgba(255,255,255,0.8)', 14, 4);
        return true;
      }
    }
    if (c.pressed('dodge') && this.dodgeCD <= 0) {
      c.consume('dodge');
      if (this.grounded) {
        if (dx) { this.state = 'dash'; this.stateT = 0; this.facing = dx; this.vx = dx * 13.5; this.invuln = Math.max(this.invuln, 5); this.dodgeCD = 28; sfx('dash');
          g.fx.burst(this.x, this.y, 5, 'rgba(230,230,230,0.7)', 3, 'smoke', 18, 6); }
        else { this.state = 'dodge'; this.stateT = 0; this.invuln = Math.max(this.invuln, 18); this.vx *= 0.3; this.dodgeCD = 45; sfx('dodge'); }
        return true;
      } else if (!this.airDodgeUsed) {
        this.state = 'dodge'; this.stateT = 0; this.airDodgeUsed = true; this.invuln = Math.max(this.invuln, 18); this.fastFall = false;
        const len = Math.hypot(dx, dy) || 1;
        this.vx = (dx / len) * 10; this.vy = (dy / len) * 10; if (!dx && !dy) { this.vx = 0; this.vy = Math.min(this.vy, 0); }
        sfx('dodge'); g.fx.ring(this.x, this.y - 40, 10, 50, 'rgba(200,240,255,0.7)', 14, 3);
        return true;
      }
    }
    /**
     * AWAKEN. The only thing the gauge buys.
     *
     * A full gauge opens the transformation; the press itself is gated on it, so
     * there is no way to "start" an Awakening and finish it later. Once it is
     * open the button does nothing for the rest of the state - the Awakening is
     * already running, and the player is fighting in it, not choosing to.
     */
    if (c.pressed('awaken') && !this.awakened) {
      const key = this.stanceTier(AWAKEN_MOVES);
      if (this.meter >= 100 && this.awakenLock <= 0 && (this.cds[key] ?? 0) <= 0) {
        c.consume('awaken');
        this.startMove(key, g);
        return true;
      }
    }
    if (c.pressed('special')) {
      const key: MoveKey = this.awakened
        ? this.stanceTier(AWAKEN_SPECIAL)
        : this.def.moves.aspec && !this.grounded && this.state !== 'wall' ? 'aspec'
          : dy > 0 ? 'dspec' : dx ? 'sspec' : 'nspec';
      if ((this.cds[key] ?? 0) <= 0) { c.consume('special'); this.startMove(key, g); return true; }
    }
    if (c.pressed('heavy')) {
      // The awakened heavy is a launcher first and a signature second: it always
      // answers, so a player who is mid-combo never has to think about it.
      if (this.awakened) {
        const key = this.stanceTier(AWAKEN_HEAVY);
        if ((this.cds[key] ?? 0) <= 0) { c.consume('heavy'); this.startMove(key, g); return true; }
      }
      if (this.grounded || this.state === 'dash') { c.consume('heavy'); this.startMove(dy > 0 ? 'dsig' : dx ? 'ssig' : 'nsig', g); return true; }
      if (dy > 0) { c.consume('heavy'); this.startMove('gp', g); return true; }
      if (dy === 0 && this.def.moves.aig && (this.cds.aig ?? 0) <= 0) { c.consume('heavy'); this.startMove('aig', g); return true; }
      if (!this.recoveryUsed) { c.consume('heavy'); this.startMove('rec', g); return true; }
    }
    if (c.pressed('light')) {
      c.consume('light');
      if (this.awakened) { this.startMove(this.stanceTier(AWAKEN_LIGHT), g); return true; }
      if (this.grounded || this.state === 'dash') this.startMove(dy > 0 ? 'dlight' : dx ? 'slight' : 'nlight', g);
      else this.startMove(dy > 0 ? 'dair' : dx ? 'sair' : 'nair', g);
      return true;
    }
    return false;
  }

  /**
   * THE AWAKENING CLOCK.
   *
   * The gauge is the clock. It falls for as long as the state is open, and when
   * it reaches zero the state closes - there is no timer to remember, so the
   * bar on screen and the time left are the same number and a player can always
   * tell exactly how long they have.
   *
   * It is its own method because the engine also calls it while a cinematic is
   * holding the screen: a set-piece that stops the world must not stop the
   * fifteen seconds the HUD is still promising.
   */
  drainAwaken() {
    if (!this.awakened) return;
    this.meter = Math.max(0, this.meter - GAUGE_DRAIN);
    if (this.meter <= 0) this.endAwaken();
  }

  update(g: any) {
    this.animT++;
    if (this.state === 'ko') {
      this.koT--;
      if (this.koT <= 0 && !this.eliminated) g.respawn(this);
      return;
    }
    if (this.invuln > 0) this.invuln--;
    if (this.dodgeCD > 0) this.dodgeCD--;
    if (this.awakenLock > 0) this.awakenLock--;
    if (this.awakenSealedT > 0) this.awakenSealedT--;
    for (const k of [...COOLDOWN_MOVES, ...EXTRA_COOLDOWN_MOVES]) if (this.cds[k] > 0) this.cds[k] -= this.godT > 0 ? 2 : 1;
    /**
     * THE AWAKENING DRAINS.
     *
     * See `drainAwaken`: the gauge is the clock, and it runs for as long as the
     * state is open - including while a cinematic is holding the screen.
     */
    if (this.awakened) {
      this.drainAwaken();
      this.auraT = Math.max(this.auraT, 12);
      if (this.animT % 3 === 0) {
        const a = Math.random() * 6.28;
        g.fx.add({ x: this.x + Math.cos(a) * 30, y: this.y - 40 + Math.sin(a) * 34, vx: -Math.cos(a) * 1.6, vy: -Math.sin(a) * 1.6 - 0.6, color: Math.random() < .5 ? this.look.energy : this.look.energy2, kind: 'glow', life: 18, size: 5 + Math.random() * 4 });
      }
    }
    if (this.godT > 0) { this.godT--; if (this.animT % 3 === 0) g.fx.bolt(this.x, this.y - 40, this.x + (Math.random() - .5) * 70, this.y - 40 + (Math.random() - .5) * 90, '#7fd8ff', 4, 1.5); }
    if (this.devilT > 0) { this.devilT--; if (this.animT % 2 === 0) g.fx.add({ x: this.x + (Math.random() - .5) * 36, y: this.y - Math.random() * 80, vy: -1.5, color: Math.random() < .5 ? '#150306' : '#c0102a', kind: Math.random() < .5 ? 'smoke' : 'glow', life: 26, size: 7 }); }
    if (this.auraT > 0) this.auraT--;
    if (this.evadeT > 0) this.evadeT--;
    if (this.evadeCD > 0) this.evadeCD--;
    // ---- motion after-images -------------------------------------------------
    // Only a genuinely fast body leaves ghosts, so a normal walk costs nothing.
    const ghSpeed = Math.hypot(this.vx, this.vy);
    const teleporting = this.state === 'dodge' || (this.state === 'dash' && this.invuln > 0) || this.evadeT > 0;
    if (ghSpeed > 6.5 || teleporting) {
      const life = this.evadeT > 0 ? 14 : 10;
      this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, scale: this.scale, life, max: life, color: this.look.energy });
      if (this.ghosts.length > 5) this.ghosts.shift();
    }
    for (const gh of this.ghosts) gh.life--;
    // Oldest first, one at a time, so the trail fades out smoothly instead of
    // vanishing in a block.
    while (this.ghosts.length && this.ghosts[0].life <= 0) this.ghosts.shift();
    if (this.state === 'ko') this.ghosts.length = 0;
    if (this.standActive) {
      this.standT++;
      if (this.standDur > 0) this.standDur--;
      if (this.standDur <= 0) this.standActive = false;
    }
    if (this.standAttackT > 0) this.standAttackT--;
    if (this.comboTimer > 0 && this.state !== 'hitstun') { this.comboTimer--; if (this.comboTimer <= 0) { this.comboHits = 0; this.comboDmg = 0; } }
    if (this.flashT > 0) this.flashT--;
    if (this.sukunaFlash > 0) this.sukunaFlash--;
    if (this.hitstop > 0) { this.hitstop--; return; }
    this.stateT++;
    if (this.djumpT < 99) this.djumpT++;
    if (this.landT > 0) this.landT--;
    if (this.dropT > 0) this.dropT--;

    const c = this.ctrl; const st = this.def.stats; const spd = st.speed * this.speedMul();
    const dx = c.dirX();
    let gravMul = 1;

    switch (this.state) {
      case 'idle': case 'run': case 'air': {
        if (this.tryActions(g)) break;
        if (this.grounded) {
          if (dx) {
            this.vx += (dx * spd - this.vx) * 0.3; this.facing = dx; this.state = 'run';
            this.runPhase += 0.12 + Math.abs(this.vx) * 0.035;
            if (this.animT % 14 === 0) g.fx.add({ x: this.x - dx * 8, y: this.y - 3, vx: -dx, vy: -0.5, color: 'rgba(220,220,220,0.6)', kind: 'smoke', life: 18, size: 4 });
          } else { this.vx *= 0.72; this.state = 'idle'; }
          if (c.justPressed('down') && g.onOneWay(this)) { this.dropT = 12; this.y += 3; this.grounded = false; this.state = 'air'; }
        } else {
          this.state = 'air';
          const air = st.air * this.speedMul();
          if (dx) {
            if (Math.abs(this.vx) > air && Math.sign(this.vx) === dx) this.vx *= 0.97;
            else this.vx += Math.max(-0.7, Math.min(0.7, dx * air - this.vx));
            this.facing = dx;
          } else this.vx *= Math.abs(this.vx) > air ? 0.95 : 0.93;
          if (c.justPressed('down') && this.vy > -3) { this.fastFall = true; this.vy = Math.max(this.vy, 9); }

        }
        break;
      }
      case 'dash': {
        this.vx *= 0.9;
        if (this.stateT > 3 && this.tryActions(g)) break;
        if (this.stateT >= 14 || !this.grounded) { this.state = this.grounded ? 'idle' : 'air'; }
        // Speed lines trailing the dash make the burst readable at any zoom.
        if (this.animT % 2 === 0) {
          g.fx.directional(this.x - this.vx * 2, this.y - 40 + (Math.random() - .5) * 60, 1,
            this.vx > 0 ? 0 : Math.PI, .25, this.look.energy, 12, 'streak', 10, 2.5);
        }
        this.runPhase += 0.4;
        // A ground dash is a teleport at speed: the panel gets its speed lines.
        if (this.stateT === 1) g.speedBurst(this.vx > 0 ? 0 : Math.PI, 0.6);
        break;
      }
      case 'dodge': {
        if (this.grounded) this.vx *= 0.8; else { this.vx *= 0.88; this.vy *= 0.88; gravMul = 0.25; }
        const len = this.grounded ? 22 : 20;
        if (this.stateT >= len) this.state = this.grounded ? 'idle' : 'air';
        break;
      }
      case 'wall': {
        this.facing = -this.wallSide;
        this.jumps = Math.max(this.jumps, 1); this.recoveryUsed = false; this.airLiftCount = Math.min(this.airLiftCount, 1); this.hoverT = 0;
        if (c.pressed('jump')) {
          c.consume('jump');
          this.vx = -this.wallSide * 8.5; this.vy = -st.jump * 0.95; this.state = 'air'; this.djumpT = 0;
          sfx('djump'); g.fx.ring(this.x + this.wallSide * this.hw, this.y - 40, 6, 30, 'rgba(255,255,255,0.8)', 12, 3);
          break;
        }
        if (this.tryActions(g)) break;
        if (dx !== this.wallSide || this.grounded || !g.touchingWall(this, this.wallSide)) { this.state = this.grounded ? 'idle' : 'air'; }
        break;
      }
      case 'attack': {
        const m = this.move!;
        this.moveFrame++;
        const fr = this.moveFrame;

        // Sukuna's Down Special can be upgraded into Black Flash by pressing
        // Special again during the short red-flash window.
        if (this.def.id === 'sukuna' && this.moveKey === 'dspec' && !this.sukunaBlackFlash && this.sukunaFlash > 0 && fr < m.startup && c.pressed('special')) {
          c.consume('special');
          this.sukunaBlackFlash = true;
          this.sukunaFlash = 24;
          g.flashScreen('#ff174d', .82);
          g.fx.text(this.x, this.y - 142, 'BLACK FLASH', '#ff315d', 32, 42);
          g.fx.impact(this.x + this.facing * 48, this.y - 44, 108, '#ff315d');
          g.fx.ring(this.x + this.facing * 42, this.y - 44, 10, 130, '#ff174d', 20, 9);
          g.shake(14);
          g.spawnProj({ owner: this, type: 'sig', sig: 'sukunaBlackFlash', x: this.x + this.facing * 54, y: this.y - 44, vx: 0, vy: 0, w: 74, h: 74, delay: 9999, life: 20, dmg: 0, ang: 0, kb: 0, sc: 0, fx: 'dark', dir: this.facing, data: { followup: false } });
        }

        // A chain is a timed, edge-triggered cancel, not a simultaneous chord.
        if (m.chains) {
          const ch = m.chains;
          const w = ch.window || [Math.max(1, m.startup - 1), m.dur - 1];
          if (fr >= w[0] && fr <= w[1] && (!ch.onHitOnly || this.moveConnected)) {
            const action = CHAIN_ACTIONS.find((a) => {
              const key = ch[a] as MoveKey | undefined;
              return key && this.def.moves[key] && (this.cds[key] ?? 0) <= 0 && c.pressed(a);
            });
            if (action) {
              const next = ch[action] as MoveKey;
              c.consume(action);
              this.startMove(next, g);
              g.fx.text(this.x, this.y - 118, this.move?.name || 'CHAIN', this.look.energy, 20, 24);
              g.fx.ring(this.x, this.y - 35, 8, 40, this.look.energy, 12, 3);
              break;
            }
          }
        }

        this.applyVel(fr);
        if (m.invuln && fr >= m.invuln[0] && fr <= m.invuln[1]) this.invuln = Math.max(this.invuln, 2);
        if (fr === m.startup) {
          // Characters with recorded samples own their own attack audio; everyone
          // else keeps the original synthesised palette.
          if (this.def.styleId === 'sukuna') {
            if (m.vfx === 'sukunaShrine') g.sukunaDomainSound(this);
            else if (m.vfx === 'sukunaFuga') g.sukunaFugaSound(this);
            else g.sukunaSlash(this, slashTierFor(m));
          } else {
            sfx(m.sfx || attackSound(this.def.styleId || this.def.id, SIGS.includes(this.moveKey!) || this.moveKey === 'gp'));
          }
        }
        if (this.devilT > 0 && fr === m.startup && SIGS.includes(this.moveKey!)) {
          g.spawnProj({ owner: this, type: 'wave', x: this.x + this.facing * 50, y: this.y - 44, vx: this.facing * 12, vy: 0, w: 40, h: 90, life: 34, dmg: 6, ang: 35, kb: 4, sc: 4, fx: 'dark', dir: this.facing });
        }
        runVfx(m.vfx, this, g, fr, m);
        m.onFrame?.(this, fr, g);
        gravMul = m.grav ?? 1;
        // Floaty moves (grav < 1) can only suspend a fighter for ~1.5s per airtime.
        if (!this.grounded && gravMul < 1) { this.hoverT++; if (this.hoverT > 90) gravMul = 1; }
        const hasVel = m.vel && m.vel.some(([f]) => f <= fr && fr < f + 12);
        if (!this.grounded) {
          if (m.land || this.moveKey === 'nair' || this.moveKey === 'sair') {
            const air = st.air * this.speedMul();
            if (dx && !hasVel) this.vx += Math.max(-0.35, Math.min(0.35, dx * air - this.vx));
          }
        } else if (!hasVel) this.vx *= 0.8;
        // trail
        if (fr >= m.startup - 1 && fr <= this.moveActiveEnd + 2) {
          const tr = m.trail === 'foot' ? [this.footX, this.footY] : m.trail === 'hand' || this.look.weapon === 'claws' ? [this.handX, this.handY] : [this.tipX, this.tipY];
          if (tr[0] || tr[1]) this.trail.push({ x: tr[0], y: tr[1] });
          if (this.trail.length > 9) this.trail.shift();
        } else if (this.trail.length) this.trail.shift();
        if (m.land && this.grounded && fr > 3 && m.ability !== 'awaken') {
          if (this.moveKey === 'gp') { g.fx.ring(this.x, this.y, 10, 60, 'rgba(255,255,255,0.7)', 14, 5); g.shake(4); }
          this.endMove(); this.landT = 8; break;
        }
        if (fr >= this.moveDur) this.endMove();
        break;
      }
      case 'hitstun': {
        this.hitstun--;
        this.vx += dx * 0.12;
        this.vx *= 0.972; this.vy *= 0.975;
        gravMul = 0.72;
        if (Math.hypot(this.vx, this.vy) > 9) {
          this.tumble += 0.25 * Math.sign(this.vx || 1);
          if (this.animT % 2 === 0) g.fx.add({ x: this.x, y: this.y - 40, color: 'rgba(255,255,255,0.35)', kind: 'smoke', life: 20, size: 7 });
          // A launch is the one moment the whole screen should react: full-screen
          // speed lines along the launch vector, once, on the way out.
          if (this.animT === 1 && !this.launchFx) {
            this.launchFx = true;
            g.speedBurst(Math.atan2(this.vy, this.vx), 1.15);
            g.punchIn(this.x, this.y - 40, 0.1);
            g.fx.word(this.x, this.y - 108, 'ZASH!', this.lastHitBy?.look.energy || '#ffffff', 44, 30);
          }
        } else this.tumble *= 0.85;
        if (this.hitstun <= 0) { this.state = this.grounded ? 'idle' : 'air'; this.tumble = 0; this.launchFx = false; }
        break;
      }
    }

    // gravity
    if (this.state === 'wall') { this.vy = Math.min(this.vy + 0.35, this.stateT > 80 ? 5 : 2.2); }
    else {
      this.vy += (st.gravity ?? GRAV) * gravMul;
      const maxFall = this.state === 'hitstun' ? 22 : this.fastFall ? 16 : 10.5;
      if (this.vy > maxFall) this.vy = maxFall;
    }
    const wasGrounded = this.grounded;
    const impactVy = this.vy;
    g.collide(this);
    if (this.grounded && !wasGrounded) {
      // landing
      if (this.state === 'hitstun' && impactVy > 6) {
        this.vy = -impactVy * 0.45; this.grounded = false; this.vx *= 0.8;
        g.fx.burst(this.x, this.y, 8, 'rgba(230,230,230,0.8)', 4, 'smoke', 22, 7); g.shake(3);
      } else {
        this.jumps = this.maxJumps; this.recoveryUsed = false; this.airDodgeUsed = false; this.fastFall = false;
        this.airLifts.clear(); this.airLiftCount = 0; this.hoverT = 0;
        if (this.state === 'air') { this.state = 'idle'; this.landT = 6; sfx('land'); }
        if (this.state === 'dodge') this.state = 'idle';
        g.fx.burst(this.x, this.y, 4, 'rgba(230,230,230,0.6)', 2, 'smoke', 16, 5);
      }
    }
    if (!this.grounded && wasGrounded && this.state !== 'attack' && this.state !== 'hitstun') {
      if (this.jumps === this.maxJumps) this.jumps = this.maxJumps - 1;
      if (this.state === 'idle' || this.state === 'run') this.state = 'air';
    }
    // wall cling detection
    if (!this.grounded && (this.state === 'air') && dx !== 0 && this.vy > -5 && g.touchingWall(this, dx)) {
      this.state = 'wall'; this.wallSide = dx; this.stateT = 0; this.vy = Math.min(this.vy, 1); this.vx = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, showHit: boolean) {
    if (this.state === 'ko') return;
    drawGhosts(ctx, this.ghosts);
    // Motion trail: a tapered smear whose width follows the weapon or fist tip.
    if (this.trail.length > 2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const heavy = this.move?.ability && this.move.ability !== 'special';
      const col = this.devilT > 0 ? '#ff2040' : this.godT > 0 ? '#9fe6ff' : this.look.energy;
      const n = this.trail.length;
      for (let i = 1; i < n; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const k = i / n;
        ctx.strokeStyle = col; ctx.globalAlpha = k * 0.55; ctx.lineWidth = (heavy ? 15 : 11) * k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = k * 0.75; ctx.lineWidth = Math.max(1, 4 * k);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // A brighter leading tip sells the direction of the swing.
      const tip = this.trail[n - 1], prev = this.trail[n - 2];
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(tip.x + (tip.x - prev.x) * 1.6, tip.y + (tip.y - prev.y) * 1.6); ctx.stroke();
      ctx.restore();
    }
    const pose = computePose(this);
    ctx.save();
    if (this.hitstop > 0 && this.state === 'hitstun') ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);
    if (this.moveKey === ('aig' as MoveKey) && this.moveFrame < 24) {
      ctx.globalAlpha = 0.22;
      ctx.save(); ctx.globalAlpha = 0.24; ctx.translate(-this.vx * 2.6, 0); drawFighter(ctx, this, pose, time); ctx.restore();
    } else if (this.state === 'dodge' || (this.state === 'dash' && this.invuln > 0)) {
      ctx.globalAlpha = 0.45;
      // afterimage
      ctx.save(); ctx.globalAlpha = 0.18; ctx.translate(-this.vx * 3, -this.vy * 3); drawFighter(ctx, this, pose, time); ctx.restore();
    } else if (this.invuln > 0 && this.state !== 'attack' && Math.floor(time / 4) % 2 === 0) ctx.globalAlpha = 0.55;
    if (this.godT > 0 && Math.abs(this.vx) > 3) { ctx.save(); ctx.globalAlpha = 0.25; ctx.translate(-this.vx * 4, 0); drawFighter(ctx, this, pose, time); ctx.restore(); }
    // The Stand is a summoned ally: it lives behind the body it is protecting.
    drawStandDio(ctx, this, pose, time);
    drawFighter(ctx, this, pose, time, showHit);
    if (this.flashT > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.flashT / 8;
      drawFighter(ctx, this, pose, time);
    }
    ctx.restore();
  }
}
