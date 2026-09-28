import { Difficulty, InputState, emptyInput, InputKey } from './types';
import type { Fighter } from './fighter';
import type { Game } from './game';

export const DIFF: Record<Difficulty, { react: number; aggr: number; dodge: number; combo: number; recover: number; special: number; idle: number; precision: number; atkCD: number }> = {
  easy: { react: 26, aggr: 0.35, dodge: 0.06, combo: 0.1, recover: 0.55, special: 0.2, idle: 0.3, precision: 0.45, atkCD: 46 },
  medium: { react: 13, aggr: 0.65, dodge: 0.28, combo: 0.45, recover: 0.9, special: 0.5, idle: 0.08, precision: 0.75, atkCD: 22 },
  hard: { react: 3, aggr: 0.97, dodge: 0.72, combo: 0.95, recover: 1, special: 0.88, idle: 0, precision: 1, atkCD: 6 },
};

const PRESS: InputKey[] = ['jump', 'light', 'heavy', 'dodge', 'special', 'awaken'];

export class AI {
  me: Fighter; p: (typeof DIFF)['easy']; diff: Difficulty;
  target: Fighter | null = null; retarget = 0;
  hist: { x: number; y: number; vx: number; vy: number }[] = [];
  last: InputState = emptyInput();
  atkCD = 30; techCD = 70; jumpWait = 0; pause = 0; dodgeWait = 0;
  recGood = true; wasOff = false; hold: InputState = emptyInput(); holdT = 0;
  lastLanded = 0; seenHits = 0;

  constructor(me: Fighter, diff: Difficulty) { this.me = me; this.diff = diff; this.p = DIFF[diff]; }

  private finalize(want: InputState): InputState {
    const out = { ...want };
    for (const k of PRESS) out[k] = want[k] && !this.last[k];
    this.last = want;
    return out;
  }

  think(g: Game): InputState {
    const me = this.me; const w = emptyInput(); const p = this.p;
    if (!me.alive) return this.finalize(w);
    if (this.atkCD > 0) this.atkCD--;
    if (this.techCD > 0) this.techCD--;
    if (this.jumpWait > 0) this.jumpWait--;
    if (this.dodgeWait > 0) this.dodgeWait--;
    if (me.hitsLanded !== this.seenHits) { this.seenHits = me.hitsLanded; this.lastLanded = g.frame; }

    // pick target
    if (--this.retarget <= 0 || !this.target || !this.target.alive || !g.areEnemies(me, this.target)) {
      const enemies = g.fighters.filter((f: Fighter) => g.areEnemies(me, f) && f.alive);
      let best: Fighter | null = null, bd = 1e9;
      for (const e of enemies) {
        let d = Math.hypot(e.x - me.x, e.y - me.y);
        if (this.diff === 'hard') d -= e.damage * 1.5;
        if (!e.isCPU) d -= 80;
        if (d < bd) { bd = d; best = e; }
      }
      this.target = best; this.retarget = 60 + Math.random() * 60;
      this.hist = [];
    }
    const T = this.target;

    const ground = g.groundBelow(me.x, me.y - 2);
    const offstage = ground === null;

    // ----- hitstun: DI toward stage -----
    if (me.state === 'hitstun') {
      if (Math.random() < p.precision) { if (me.x > 0) w.left = true; else w.right = true; }
      this.wasOff = false;
      return this.finalize(w);
    }

    // ----- recovery -----
    if (offstage) {
      if (!this.wasOff) { this.wasOff = true; this.recGood = Math.random() < p.recover; }
      return this.finalize(this.recover(g, w));
    }
    this.wasOff = false;

    if (me.state === 'wall') { w.jump = Math.random() < 0.2; w.left = me.wallSide < 0; w.right = me.wallSide > 0; return this.finalize(w); }

    if (!T) { return this.finalize(w); }
    this.hist.push({ x: T.x, y: T.y, vx: T.vx, vy: T.vy });
    if (this.hist.length > 40) this.hist.shift();
    const seen = this.hist[Math.max(0, this.hist.length - 1 - p.react)];

    // ----- defense -----
    if (this.dodgeWait <= 0 && me.dodgeCD <= 0 && me.state !== 'attack') {
      for (const e of g.fighters as Fighter[]) {
        if (!g.canDamage(e, me) || !e.alive || e.state !== 'attack' || !e.move) continue;
        const d = Math.abs(e.x - me.x), dy = Math.abs(e.y - me.y);
        const facingMe = Math.sign(me.x - e.x) === e.facing || d < 40;
        if (d < 150 && dy < 120 && facingMe && e.moveFrame <= e.move.startup + 1) {
          this.dodgeWait = 18;
          if (Math.random() < p.dodge) {
            const cs = me.def.ai.counterSpec;
            if (cs && me.cds[cs] <= 0 && Math.random() < p.special * 0.6) { w.special = true; w.down = true; }
            else {
              w.dodge = true;
              if (me.grounded && Math.random() < 0.5) { if (e.x > me.x) w.left = true; else w.right = true; }
            }
            return this.finalize(w);
          }
          break;
        }
      }
      for (const pr of g.projectiles) {
        if (!g.canDamage(pr.owner, me) || !pr.active && pr.t > pr.delay) continue;
        const d = Math.abs(pr.x - me.x), dy = Math.abs(pr.y - (me.y - 40));
        const coming = pr.type === 'bolt' ? d < 60 : Math.sign(me.x - pr.x) === Math.sign(pr.vx || pr.dir) && d < 220 + pr.w / 2;
        if (coming && dy < 160) {
          this.dodgeWait = 25;
          if (Math.random() < p.dodge * 1.2) {
            if (me.def.ai.counterSpec === 'dspec' && me.def.id === 'asta' && me.cds.dspec <= 0) { w.special = true; w.down = true; }
            else if (me.grounded && Math.random() < 0.5) w.jump = true; else w.dodge = true;
            return this.finalize(w);
          }
          break;
        }
      }
    }

    if (this.pause > 0) { this.pause--; return this.finalize(w); }
    if (Math.random() < p.idle * 0.02) { this.pause = 20 + Math.random() * 40; }

    if (me.state === 'attack') {
      if (me.move?.chains) {
        const ch = me.move.chains;
        const cw = ch.window || [Math.max(1, me.move.startup - 1), me.move.dur - 1];
        if (me.moveFrame >= cw[0] && me.moveFrame <= cw[1]) {
          const r = Math.random();
          if (ch.light && r < p.combo * 0.9) { w.light = true; return this.finalize(w); }
          if (ch.special && r < p.special * 0.95) { w.special = true; return this.finalize(w); }
          if (ch.awaken && r < p.special * 0.7) { w.awaken = true; return this.finalize(w); }
          if (ch.heavy && r < p.combo * 0.7) { w.heavy = true; return this.finalize(w); }
        }
      }
      return this.finalize(w);
    }
    if (me.state === 'dodge') return this.finalize(w);

    const dx = seen.x - me.x, dy = seen.y - me.y, adx = Math.abs(dx);
    const dir = Math.sign(dx) || 1;
    const range = 62 * me.scale + 20;
    const tOff = g.groundBelow(T.x, T.y - 2) === null;
    const comboWindow = T.state === 'hitstun' ? 50 + (p.combo > 0.8 ? 15 : 0) : 0;
    const comboing = T.state === 'hitstun' && g.frame - this.lastLanded < comboWindow && Math.random() < p.combo;

    const faceT = () => { if (dir > 0) w.right = true; else w.left = true; };

    /**
     * THE AWAKENING.
     *
     * A CPU only spends a full gauge when it is actually going to use the window:
     * close enough to hurt, not already committed to something better, and with
     * enough of the match left to land hits inside it. Opening the state in the
     * corner at four percent would just throw the advantage away.
     */
    if (me.meter >= 100 && me.awakenLock <= 0 && adx < me.def.ai.ultRange && Math.abs(dy) < 200
      && Math.random() < 0.02 * p.precision * (this.diff === 'hard' ? 2.4 : 1) && this.techCD <= 0) {
      faceT();
      w.awaken = true;
      this.techCD = 200;
      return this.finalize(w);
    }
    // Zoning special. While Awakened, L is a different move entirely, so the CPU
    // has to stop reaching for a stance it does not have.
    if (!me.awakened) {
      const zs = me.def.ai.zoneSpec;
      if (zs && me.cds[zs] <= 0 && adx > 180 && adx < 520 && Math.abs(dy) < 200 && Math.random() < p.special * 0.05) {
        w.special = true; if (zs === 'sspec') faceT(); if (zs === 'dspec') w.down = true;
        return this.finalize(w);
      }
    } else if (me.cds.nfu <= 0 && adx > 120 && adx < 480 && Math.abs(dy) < 200 && Math.random() < p.special * 0.06) {
      faceT(); w.special = true;
      return this.finalize(w);
    }

    let attacked = false;
    if (this.atkCD <= 0 || comboing) {
      const r = Math.random();
      // `horizSpec` names one of the base-kit specials. While Awakened, L points
      // somewhere else entirely, so the CPU must not reach for it by name.
      const spec = me.awakened ? undefined : me.def.ai.horizSpec;
      if (adx < range && Math.abs(dy) < 55) {
        faceT();
        const killable = T.damage > 100 + (1 - p.precision) * 60;
        if (me.grounded) {
          if (killable && r < 0.55) { w.heavy = true; if (Math.random() < 0.6) faceT(); else { w.left = w.right = false; } }
          else if (comboing && r < 0.18 && spec && me.cds[spec] <= 0 && Math.random() < p.special) { w.special = true; }
          else if (comboing && r < 0.28 && T.state === 'hitstun' && Math.random() < p.combo) { w.heavy = true; }
          else if (r < 0.12 && spec && me.cds[spec] <= 0 && Math.random() < p.special) { w.special = true; }
          else if (r < 0.45) w.light = true;
          else if (r < 0.75) { w.light = true; w.left = w.right = false; }
          else if (r < 0.88) { w.light = true; w.down = true; w.left = w.right = false; }
          else if (this.diff === 'hard' && comboing && r < 0.7 && me.def.moves['nsig'].dur > 0 && me.grounded) { w.heavy = true; }
          else { w.heavy = true; }
        } else {
          w.light = true; if (r < 0.5) { w.left = w.right = false; }
        }
        attacked = true;
      } else if (adx < 100 && dy < -50 && dy > -260) {
        if (me.grounded) {
          if (r < 0.45) { w.heavy = true; w.left = w.right = false; attacked = true; }
          else if (this.jumpWait <= 0) { w.jump = true; this.jumpWait = 16; }
        } else if (dy > -120) { w.light = true; attacked = true; }
        else if (me.jumps > 0 && me.vy > -2 && this.jumpWait <= 0) { w.jump = true; this.jumpWait = 14; }
      } else if (adx < 70 && dy > 40 && dy < 260 && !me.grounded) {
        w.down = true; if (r < 0.35 && T.damage > 90) w.heavy = true; else w.light = true; attacked = true;
      } else if (adx < 240 && adx > 120 && Math.abs(dy) < 60 && me.grounded && r < 0.04 * p.aggr) {
        if (spec && me.cds[spec] <= 0 && Math.random() < p.special) { faceT(); w.special = true; if (spec === 'dspec') w.down = true; if (spec === 'nspec') { w.left = w.right = false; } attacked = true; }
        else { faceT(); w.light = true; attacked = true; } // dash-in side light
      }
      if (attacked) this.atkCD = p.atkCD * (0.6 + Math.random() * 0.8) * (comboing ? 0.3 : 1);
    }
    if (attacked) return this.finalize(w);

    // ----- movement -----
    const wantChase = !tOff || (this.diff === 'hard' && T.y < me.y + 150);
    if (adx > range * 0.7 && wantChase) {
      faceT();
      // don't run off stage
      const aheadGround = g.groundBelow(me.x + dir * 50, me.y - 2);
      if (aheadGround === null && me.grounded) {
        const tGrounded = !tOff && T.grounded;
        if (tGrounded && Math.sign(T.x - me.x) === dir && this.jumpWait <= 0) { w.jump = true; this.jumpWait = 30; }
        else if (!(this.diff === 'hard' && Math.random() < 0.02)) { w.left = w.right = false; }
      }
      if (me.grounded && adx > 260 && Math.random() < 0.02 * p.aggr && me.dodgeCD <= 0 && aheadGround !== null) w.dodge = true; // dash
    } else if (tOff && me.grounded) {
      // edge guard: stay near edge facing target
      const edgeDist = Math.abs(dx);
      if (edgeDist > 200) faceT();
    } else if (adx < 20) {
      // spacing
      if (Math.random() < 0.5) { if (dir > 0) w.left = true; else w.right = true; }
    }
    if (dy < -100 && this.jumpWait <= 0 && adx < 360) {
      if (me.grounded || (me.jumps > 0 && me.vy > 0)) { w.jump = true; this.jumpWait = 22; }
    }
    if (dy > 60 && me.grounded && g.onOneWay(me) && Math.random() < 0.1) w.down = true;
    if (comboing && dy < -40 && me.grounded) { w.jump = true; faceT(); }
    return this.finalize(w);
  }

  recover(g: Game, w: InputState): InputState {
    const me = this.me; const p = this.p;
    const T = this.target;
    const bias = T && T.alive && T.grounded ? T.x : undefined;
    if (me.state === 'attack' || me.state === 'dodge') {
      const e = g.nearestEdge(me, bias); if (e.x > me.x) w.right = true; else w.left = true; return w;
    }
    const e = g.nearestEdge(me, bias);
    const hd = e.x - me.x, dirE = Math.sign(hd) || 1;
    if (dirE > 0) w.right = true; else w.left = true;
    if (me.state === 'wall') { if (me.stateT > 4) w.jump = true; return w; }
    const below = me.y - e.y; // positive = below ledge
    if (me.jumps > 0 && this.jumpWait <= 0 && (me.vy > 1.5 || below > 60) && below > (this.recGood ? -120 : 100)) {
      w.jump = true; this.jumpWait = this.recGood ? 12 : 20; return w;
    }
    if (me.jumps === 0 && me.vy > 0) {
      const vs = me.def.ai.vertSpec, hs = me.def.ai.horizSpec;
      if (!me.recoveryUsed && below > (this.recGood ? 20 : 120) && Math.abs(hd) < 300) { w.heavy = true; w.down = false; w.up = true; return w; }
      if (Math.abs(hd) > 220 && hs && me.cds[hs] <= 0 && below > -40 && Math.random() < p.recover) { w.special = true; if (hs === 'dspec') w.down = true; if (hs === 'nspec') w.left = w.right = false; return w; }
      if (vs && me.cds[vs] <= 0 && below > 40 && Math.random() < p.recover) { w.special = true; w.left = w.right = false; if (vs === 'dspec') w.down = true; return w; }
      if (!me.airDodgeUsed && below > 60 && me.recoveryUsed) { w.dodge = true; w.up = true; return w; }
    }
    return w;
  }
}
