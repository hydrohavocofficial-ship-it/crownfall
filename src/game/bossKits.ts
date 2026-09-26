import type { AnimName, HitDef, MoveDef } from './types';
import type { Fighter } from './fighter';
import type { Game } from './game';
import type { ProjSpec } from './projectiles';
import { cleave } from './vfx';
import {
  SHRINE_CAST, SHRINE_RISE, SHRINE_APPEAR, SHRINE_ACTIVE, SHRINE_FADE,
  SHRINE_SLASHES, SHRINE_DUR, DOMAIN_W, DOMAIN_H,
} from './sukuna';

type BossId = 'sukuna' | 'gojo';
type Frame = NonNullable<MoveDef['onFrame']>;
type Shot = Partial<Omit<ProjSpec, 'owner'>>;
const CUT = '#ff315d', BLUE = '#5fd2ff', RED = '#ff5577', PURPLE = '#b067ff';
const hit = (a: number, b: number, x: number, y: number, w: number, h: number, dmg: number, ang: number, kb = 4, sc = 3, extra: Partial<HitDef> = {}): HitDef =>
  ({ f: [a, b], x, y, w, h, dmg, ang, kb, sc, ...extra });
const cut = (...args: Parameters<typeof hit>) => ({ ...hit(...args), fx: 'slash' as const });
const blue = (...args: Parameters<typeof hit>) => ({ ...hit(...args), fx: 'purple' as const });
const chain = (window: [number, number], links: Omit<NonNullable<MoveDef['chains']>, 'window'>): MoveDef['chains'] => ({ window, ...links });
const at = (frame: number, fn: (f: Fighter, g: Game) => void): Frame => (f, fr, g) => { if (fr === frame) fn(f, g); };
const sequence = (...frames: Frame[]): Frame => (f, fr, g) => frames.forEach(fn => fn(f, fr, g));

/** All projectile offsets are facing-relative; velocity uses the same convention. */
function shot(f: Fighter, g: Game, sig: string, o: Shot = {}) {
  const { x = 60, y = -45, vx = 0, vy = 0, ...rest } = o;
  g.spawnProj({ owner: f, type: 'sig', sig, x: f.x + x * f.facing, y: f.y + y,
    vx: vx * f.facing, vy, w: 64, h: 64, life: 20, dmg: 8, ang: 40, kb: 5, sc: 5,
    dir: f.facing, fx: sig.startsWith('sukuna') ? 'slash' : 'purple', reflectable: false, ...rest });
}

// Defense and friendship are checked before *any* custom displacement, not only damage.
function eligible(f: Fighter, t: Fighter | undefined, g: Game, radius: number): t is Fighter {
  const rules = g as Game & { areEnemies?: (a: Fighter, b: Fighter) => boolean };
  return !!t && t !== f && f.alive && t.alive && t.invuln <= 0 &&
    (rules.areEnemies ? rules.areEnemies(f, t) : true) && Math.hypot(t.x - f.x, t.y - f.y) <= radius;
}

interface Capture { target: Fighter; move: MoveDef; attack: number; stocks: number; }
const captures = new WeakMap<Fighter, Capture>();
function clearCapture(f: Fighter) {
  captures.delete(f); f.sukunaGrabTarget = null; f.sukunaLaunchTarget = null;
}
function remember(f: Fighter, t: Fighter, g: Game) {
  if (!captures.has(f) && f.move && eligible(f, t, g, 150))
    captures.set(f, { target: t, move: f.move, attack: f.lastAttackFrame, stocks: t.stocks });
}
function captured(f: Fighter, g: Game, range = 180): Fighter | undefined {
  const c = captures.get(f);
  if (!c || c.move !== f.move || c.attack !== f.lastAttackFrame || f.state !== 'attack' ||
      c.target.stocks !== c.stocks || !eligible(f, c.target, g, range) || c.target.lastHitBy !== f) {
    clearCapture(f); return undefined;
  }
  return c.target;
}

/** Acquired only from a confirmed contact. Interruption leaves at most six frames of pin. */
function grab(throwFrame: number, slam: boolean): Partial<MoveDef> {
  return {
    onHit: remember,
    onFrame: (f: Fighter, fr: number, g: Game) => {
      const t = captured(f, g, 120); if (!t) return;
      if (t.state !== 'hitstun') { clearCapture(f); return; }
      if (fr < throwFrame) {
        t.x = f.x + f.facing * 43; t.y = f.y; t.vx = 0; t.vy = 0;
        t.hitstun = 6; f.vx *= .45;
        if (fr === 12 || fr === 18) {
          if (!g.applyHit(f, t, { dmg: 3, ang: 90, kb: 0, sc: 0, fx: 'slash', pull: true }, f.facing, t.x, t.y - 42)) { clearCapture(f); return; }
          cleave(g, t.x, t.y - 42, 44, -1.4 + (Math.random() - .5) * .2, .7);
        }
      } else if (fr === throwFrame) {
        g.applyHit(f, t, { dmg: slam ? 13 : 11, ang: slam ? -75 : 30, kb: slam ? 9 : 8, sc: 8, fx: 'dark' }, f.facing, t.x, t.y - 38);
        g.fx.impact(t.x, t.y - (slam ? 8 : 40), 80, CUT); clearCapture(f);
      }
    },
  };
}

function counter(color: string, frame: number, power: number): Partial<MoveDef> {
  return { counter: [3, frame], onCounter: (f: Fighter, a: Fighter, g: Game) => {
    // No overlapping invuln window: Game.applyHit checks invuln before counters.
    if (!eligible(f, a, g, 175)) return;
    f.facing = a.x >= f.x ? 1 : -1;
    f.invuln = 10; f.moveFrame = frame + 1;
    g.fx.ring(f.x, f.y - 40, 10, 115, color, 20, 8);
    g.applyHit(f, a, { dmg: power, ang: 55, kb: 7, sc: 7, fx: 'purple' }, f.facing, a.x, a.y - 40);
  } };
}

function move(id: BossId, name: string, desc: string, anim: AnimName, dur: number, startup: number,
  hits: HitDef[], opts: Partial<MoveDef> = {}): MoveDef {
  const isCut = id === 'sukuna';
  const m: MoveDef = { name, desc, anim, dur, startup, hits, sfx: isCut ? 'sukuna-cut' : 'gojo-blue',
    vfx: isCut ? 'sukunaCleave' : 'limitless', ...opts };
  const start = m.onStart, frame = m.onFrame;
  m.onStart = (f, g) => { clearCapture(f); start?.(f, g); };
  m.onFrame = (f, fr, g) => {
    // Draw each contact where its collision geometry really is, including rear/overhead hits.
    for (const h of hits) if (fr === h.f[0]) {
      const x = f.x + h.x * f.scale * f.facing, y = f.y + h.y * f.scale;
      if (isCut) {
        // Sukuna's grounded blade visual is the original animated black cut;
        // the sweeping crescent only rides cuts that land while he is airborne.
        const spread = Math.max(h.w, h.h) / Math.max(1, f.scale);
        const n = spread > 110 ? 3 : spread > 62 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          cleave(g, x, y + (i - (n - 1) / 2) * spread * .3, spread * 1.4 + 20,
            (h.ang > 0 ? -1 : 1) * (1.25 + (i - 1) * .5) * f.facing, h.dmg >= 9 ? 1.7 : 1.05, i * 2, !f.grounded);
        }
      } else {
        g.fx.ring(x, y, h.pull ? Math.max(h.w, h.h) * .6 : 5, h.pull ? 5 : Math.max(h.w, h.h) * .55,
          m.sfx === 'gojo-red' ? RED : m.sfx === 'gojo-purple' ? PURPLE : BLUE, 12, 5);
      }
    }
    frame?.(f, fr, g);
  };
  return m;
}

function sukunaKit(): Record<string, MoveDef> {
  const M = (name: string, desc: string, anim: AnimName, dur: number, su: number, hits: HitDef[], o: Partial<MoveDef> = {}) => move('sukuna', name, desc, anim, dur, su, hits, o);
  return {
    nlight: M('Cleave: Finger Edge', 'A fast, short horizontal finger cut. H extends; K reaches farther; J launches.', 'slash', 18, 3,
      [cut(3, 6, 36, -46, 54, 32, 4.5, 20, 2.5, 1)], { chains: chain([6, 16], { light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy' }), trail: 'hand' }),
    nlight2: M('Cleave: Cross Stitch', 'Two crossing cuts catch torso then head; the second hit holds the target for H, K or J.', 'backslash', 22, 3,
      [cut(3, 5, 43, -32, 64, 28, 3, 70, 2, 0), cut(8, 10, 44, -65, 66, 40, 4, 60, 2.8, 1, { g: 1, stun: 6 })],
      { chains: chain([10, 20], { light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy' }) }),
    nlight3: M('Cleave: Headman Wheel', 'A rear cut swings into a broad front execution, covering a roll behind the light string.', 'spin', 30, 5,
      [cut(5, 8, -37, -44, 74, 80, 5, 150, 4, 2), cut(12, 16, 62, -46, 114, 72, 10, 38, 7, 8, { g: 1 })], { turns: 1 }),
    nlight_spec: M('Dismantle: Wrist Flick', 'Light-cancel into a narrow, fast travelling slash; creates distance instead of continuing melee.', 'thrust', 27, 6, [],
      { onFrame: at(6, (f, g) => shot(f, g, 'sukunaCleave', { vx: 16, w: 32, h: 76, life: 24, dmg: 9, kb: 5, sc: 5 })) }),
    nlight_heavy: M('Cleave: Rib Ladder', 'A close vertical cut rises with Sukuna and lifts the victim into an aerial juggle.', 'upslash', 30, 5,
      [cut(5, 13, 28, -83, 56, 116, 10, 87, 7, 5)], { vel: [[5, 2, -9]], grav: .65 }),
    slight: M('Predator Step', 'A short dash knee catches moving opponents; H, K and J branch after contact frames.', 'kick', 22, 5,
      [hit(5, 9, 43, -36, 66, 42, 6, 25, 3, 1, { fx: 'dark' })], { vel: [[2, 13, null], [10, 2, null]], chains: chain([9, 20], { light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy' }) }),
    slight2: M('Puncture: Heel Turn', 'Skids to a stop, then kicks backward to punish opponents who crossed through the dash.', 'backslash', 26, 5,
      [cut(5, 10, -44, -42, 90, 56, 9, 145, 6, 5)], { vel: [[1, 0, null]], chains: chain([10, 24], { special: 'slight_spec', heavy: 'slight_heavy' }) }),
    slight_spec: M('Dismantle: Parallel Rails', 'Fires separated high and low blades. The narrow gap between them rewards precise evasion.', 'cast', 31, 7, [],
      { onFrame: at(7, (f, g) => { for (const y of [-16, -86]) shot(f, g, 'sukunaCleave', { x: 65, y, vx: 12, w: 88, h: 24, life: 24, dmg: 6, kb: 4, sc: 3 }); }) }),
    slight_heavy: M('Cleave: Gut Check', 'A committed low shoulder drive ends in a delayed point-blank gut cut with strong horizontal knockback.', 'thrust', 36, 8,
      [hit(8, 12, 40, -34, 62, 60, 3, 20, 2, 0, { pull: true, fx: 'dark' }), cut(17, 21, 57, -30, 88, 54, 12, 20, 8, 8, { g: 1 })], { vel: [[4, 15, 0], [13, 0, null]] }),
    dlight: M('Ankle Sever', 'An ankle-height sweep pops grounded opponents upward; its shallow hitbox misses high jumps.', 'sweep', 23, 4,
      [cut(4, 9, 40, -10, 82, 22, 5, 78, 4, 1)], { trail: 'foot', chains: chain([9, 21], { light: 'dlight2', special: 'dlight_spec' }) }),
    dlight2: M('Crescent Scythe', 'A rising heel traces a tall crescent above the sweep, catching its launched victim.', 'upslash', 27, 5,
      [cut(5, 12, 26, -86, 70, 130, 9, 90, 6, 5)], { trail: 'foot', vel: [[4, 0, -5]] }),
    dlight_spec: M('Spiderweb: Tripwire', 'Sets a delayed wide floor cut ahead. Excellent landing trap, but opponents can jump over it.', 'slam', 33, 7, [],
      { onFrame: at(7, (f, g) => shot(f, g, 'sukunaCleave', { x: 100, y: -9, w: 200, h: 24, delay: 12, activeFor: 5, life: 22, dmg: 11, ang: 78, kb: 6, sc: 6 })) }),
    nair: M('Heavenward Backflip', 'Aerial H: Sukuna kips off the air into a genuine backflip, then drags a long black crescent straight down through whatever is beneath him.', 'flip', 30, 5,
      [cut(5, 12, -6, -42, 108, 92, 4.6, 64, 3, 2), cut(15, 21, 30, -14, 76, 124, 8.8, -72, 6, 5, { g: 1 })],
      { turns: 1, land: true, vel: [[5, 2, -4], [16, 1, 5]], grav: .3, trail: 'foot',
        onFrame: at(15, (f, g) => { g.fx.directional(f.x + f.facing * 26, f.y - 12, 7, Math.PI / 2, .55, '#ff2749', 14, 'streak', 15, 3); g.fx.ring(f.x + f.facing * 26, f.y - 12, 6, 58, '#ff315d', 15, 4); g.shake(4); }),
        chains: chain([12, 26], { light: 'nair2', special: 'nair_spec' }) }),
    nair2: M('Falling Guillotine', 'Stops horizontal drift and dives nearly straight down with a narrow meteor cut.', 'dive', 29, 5,
      [cut(5, 18, 4, 0, 48, 76, 9, -85, 6, 5)], { land: true, vel: [[4, 0, 13]] }),
    nair_spec: M('Dismantle: Hanging Blade', 'Leaves a delayed blade at the current height while recoiling backward; intercepts aerial pursuit.', 'cast', 29, 6, [],
      { vel: [[6, -7, -3]], onFrame: at(6, (f, g) => shot(f, g, 'sukunaCleave', { x: 75, y: -44, w: 38, h: 160, delay: 8, activeFor: 6, life: 22, dmg: 10, ang: 35, kb: 7, sc: 6 })) }),
    sair: M('Sky Puncture', 'A fast horizontal aerial thrust pursues knockback; H brakes and K attacks behind.', 'thrust', 22, 4,
      [cut(4, 10, 53, -43, 78, 34, 6, 25, 3.4, 2)], { land: true, vel: [[3, 12, 0]], chains: chain([10, 20], { light: 'sair2', special: 'sair_spec' }) }),
    sair2: M('Air Brake Cleave', 'Brakes the aerial dash and opens a long thin horizontal cut, sending foes at a shallow angle.', 'slash', 27, 5,
      [cut(5, 12, 74, -40, 142, 28, 10, 16, 7, 6)], { land: true, vel: [[1, 0, 0]], grav: .3 }),
    sair_spec: M('Reverse Skywheel', 'Backflips out of pursuit while cutting behind and above, reversing the direction of a juggle.', 'flip', 30, 5,
      [cut(5, 13, -45, -67, 100, 100, 11, 135, 6, 7)], { land: true, vel: [[3, -7, -6]], turns: 1 }),
    dair: M('Talons: Diagonal Drop', 'A forward diagonal dive spikes beneath Sukuna while carrying him toward the ledge.', 'dkick', 30, 6,
      [cut(6, 18, 37, -2, 58, 64, 9, -55, 5, 5)], { land: true, vel: [[5, 7, 12]], trail: 'foot' }),
    nsig: M('Elbow: Execution Warrant', 'A short stunning elbow confirms J into Rib Cage, then L into World-Cutting Sentence. Whiffs cannot start the route.', 'uppercut', 34, 7,
      [hit(7, 11, 42, -45, 68, 64, 8, 75, 2, 0, { fx: 'dark', stun: 14, pull: true })],
      { chains: chain([12, 28], { heavy: 'boss_heavy2', onHitOnly: true }), chainLabel: 'J → J → L · EXECUTION' }),
    boss_heavy2: M('Rib Cage', 'Combo-only second J: three close cleaves hold the victim in front. Confirm the final cut with L.', 'slash', 38, 4,
      [cut(4, 6, 47, -34, 88, 66, 3, 65, 1, 0, { pull: true, stun: 6 }), cut(10, 12, 45, -62, 84, 90, 3, 80, 1, 0, { pull: true, stun: 6, g: 1 }), cut(16, 19, 53, -44, 96, 88, 5, 65, 1.5, 0, { pull: true, stun: 12, g: 2 })],
      { vel: [[1, 4, 0]], grav: .35, chains: chain([20, 34], { limit: 'boss_finisher', onHitOnly: true }), chainLabel: 'L · WORLD-CUTTING SENTENCE' }),
    boss_finisher: M('World-Cutting Sentence', 'Only J → J → L: pins space with a brief crosscut, then releases a long delayed execution plane. Uses Limit cooldown.', 'cast', 49, 7,
      [cut(7, 10, 65, -42, 118, 112, 4, 80, 1, 0, { pull: true, stun: 18 }), cut(20, 23, 195, -50, 420, 80, 23, 28, 10, 10, { g: 1 })],
      { ability: 'limit', cd: 290, sfx: 'sukuna-cleave', vel: [[0, 0, 0]], grav: .2 }),
    ssig: M('Throat Drag', 'Contact-only grab from a lunging palm, two close cuts, then a horizontal throw. Dodges, allies and distant targets cannot be grabbed.', 'thrust', 40, 7,
      [hit(7, 9, 42, -44, 62, 54, 4, 90, 0, 0, { fx: 'dark', stun: 8 })], { vel: [[3, 9, null], [10, 0, null]], ...grab(26, false), sfx: 'sukuna-cleave' }),
    dsig: M('Cleave: Skyhook', 'Crouches beneath pressure then cuts a narrow vertical column. Strong anti-air with little horizontal reach.', 'upslash', 40, 11,
      [cut(11, 19, 15, -115, 62, 204, 15, 88, 8, 9)], { vel: [[1, 0, null]] }),
    rec: M('Shrine Stair', 'Up + aerial J: a rising spinning cleave gains height, ending in an upward kick. Uses the normal recovery allowance.', 'rise', 36, 4,
      [cut(4, 17, 0, -50, 90, 104, 2.5, 90, 1.4, 0, { rehit: 6, pull: true }), cut(18, 22, 20, -94, 78, 100, 7, 84, 6, 6, { g: 1 })], { grav: .35, vel: [[4, 2, -15]], turns: 2 }),
    gp: M('Malevolent Heel', 'Down + aerial J: a steep ground-pound with a wide heel hitbox and strong downward knockback.', 'dive', 44, 8,
      [cut(8, 37, 0, -4, 106, 58, 13, -78, 7, 8)], { land: true, vel: [[8, 0, 18]] }),
    aig: M('Phantom Passage', 'Neutral aerial J: briefly phases through pressure and dashes horizontally; a rear slash catches the opponent after passing.', 'thrust', 36, 7,
      [cut(7, 12, 52, -44, 88, 52, 5, 40, 2, 1), cut(17, 21, -54, -44, 100, 76, 9, 142, 7, 7, { g: 1 })],
      { cd: 110, invuln: [3, 7], vel: [[5, 18, 0], [14, 0, 0]], grav: .25, vfx: 'sukunaPhantom' }),
    nspec: M('Dismantle: Unseen Line', 'Launches a fast tall travelling cut down the lane; it is aimed by facing and can be dodged.', 'cast', 33, 8, [],
      { ability: 'special', stance: 'neutral', cd: 130, onFrame: at(8, (f, g) => shot(f, g, 'sukunaCleave', { vx: 18, w: 38, h: 100, life: 32, dmg: 12, ang: 32, kb: 7, sc: 7 })) }),
    sspec: M('Face Slam', 'A slower close face grab cuts twice, then drives the victim downward. The opener must physically connect.', 'punch', 44, 8,
      [hit(8, 10, 43, -49, 68, 48, 5, 90, 0, 0, { fx: 'dark', stun: 9 })], { ability: 'special', stance: 'side', cd: 170, vel: [[3, 12, null], [11, 0, null]], ...grab(28, true), sfx: 'sukuna-cleave' }),
    dspec: M('Black Flash: Delayed Heartbeat', 'A delayed compact body blow. Press K again during the red primer window to empower its impact.', 'punch', 37, 12,
      [hit(12, 16, 49, -41, 68, 58, 10, 34, 6, 7, { fx: 'dark', stun: 8 })], { ability: 'special', stance: 'down', cd: 160, vfx: 'sukunaBlackFlash', vel: [[10, 7, 0]], sfx: 'sukuna-cleave' }),
    aspec: M('Fuga: Falling Arrow', 'Aerial K: recoil upward while firing a gravity-curved fire arrow down-forward; its landing burst denies the ground below.', 'flip', 37, 7, [],
      { ability: 'special', stance: 'air', cd: 180, turns: 1, vel: [[4, -3, -5]], sfx: 'sukuna-fuga', vfx: 'sukunaFuga',
        onFrame: at(7, (f, g) => shot(f, g, 'sukunaFuga', { x: 35, y: -20, vx: 10, vy: 7, w: 72, h: 72, life: 65, dmg: 12, ang: 65, kb: 7, sc: 7, fx: 'fire', fin: { dmg: 8, ang: 75, kb: 6, sc: 5 } })) }),
    nex: M('Dismantle: Fan of Ruin', 'Neutral L sends three narrow blades at ascending angles, covering separate ground and jump lanes.', 'cast', 42, 11, [],
      { ability: 'limit', stance: 'neutral', cd: 260, onFrame: at(11, (f, g) => { for (const vy of [-6, 0, 6]) shot(f, g, 'sukunaCleave', { vx: 14, vy, w: 72, h: 28, life: 28, dmg: 10, ang: vy < 0 ? 72 : 32, kb: 7, sc: 7 }); }) }),
    sex: M('Cleave: Butcher Run', 'Side L carries an opponent through repeated close cuts before a broad outward slash. Committed forward movement.', 'spin', 46, 8,
      [cut(8, 26, 38, -42, 90, 80, 2.5, 70, 1, 0, { pull: true, rehit: 6 }), cut(29, 33, 65, -42, 136, 94, 13, 32, 9, 9, { g: 1 })],
      { ability: 'limit', stance: 'side', cd: 260, vel: [[5, 13, 0], [27, 0, null]], turns: 2 }),
    dex: M('Spiderweb: Fracture Ground', 'Down L lays three delayed low cutting zones spreading left, center and right. Jumping escapes the shallow web.', 'slam', 43, 12, [],
      { ability: 'limit', stance: 'down', cd: 260, onFrame: at(12, (f, g) => { for (const [x, delay] of [[0, 1], [-130, 9], [130, 17]]) shot(f, g, 'sukunaCleave', { x, y: -10, w: 130, h: 30, delay, activeFor: 4, life: delay + 12, dmg: 12, ang: 82, kb: 7, sc: 7 }); }) }),
    aex: M('Cleave: Heaven Lattice', 'Aerial L stalls and seeds three vertical delayed blades at different distances; controls a broad landing corridor.', 'castUp', 42, 9, [],
      { ability: 'limit', stance: 'air', cd: 260, grav: .12, vel: [[0, 0, 0]], onFrame: at(9, (f, g) => { for (const x of [-100, 30, 160]) shot(f, g, 'sukunaCleave', { x, y: 50, w: 38, h: 240, delay: 12, activeFor: 6, life: 28, dmg: 13, ang: -60, kb: 6, sc: 7 }); }) }),
    naw: M('King of Curses: Coronation', 'Neutral U detonates a close radial cut and gains a short damage aura; K branches into a forward Shrine Gate.', 'castUp', 37, 9,
      [cut(9, 15, 0, -43, 176, 128, 8, 78, 3, 2, { stun: 8 })], { ability: 'awaken', stance: 'neutral', cd: 340,
        onFrame: at(9, f => { f.devilT = Math.max(f.devilT, 150); }), chains: chain([16, 34], { special: 'nfu' }) }),
    saw: M('King of Curses: Pursuit', 'Side U advances with a low palm that pulls a victim into close range; K continues into a rising cleave chase.', 'thrust', 36, 7,
      [hit(7, 14, 45, -31, 90, 54, 8, 70, 2, 0, { pull: true, stun: 8, fx: 'dark' })], { ability: 'awaken', stance: 'side', cd: 340, vel: [[4, 16, 0], [15, 0, null]], chains: chain([15, 33], { special: 'sfu' }) }),
    daw: M('King of Curses: Dethrone', 'Down U sweeps behind then in front, pulling nearby ankles inward. K ignites a delayed furnace at your feet.', 'sweep', 38, 6,
      [cut(6, 10, -55, -13, 110, 30, 4, 110, 2, 0, { pull: true }), cut(13, 17, 60, -13, 120, 30, 6, 75, 3, 1, { g: 1, stun: 6 })],
      { ability: 'awaken', stance: 'down', cd: 340, chains: chain([18, 35], { special: 'dfu' }) }),
    aaw: M('King of Curses: Sky Throne', 'Aerial U rises briefly with an overhead rotating cut; K releases a downward rain of execution blades.', 'rise', 36, 6,
      [cut(6, 16, 0, -96, 150, 76, 8, 95, 5, 3)], { ability: 'awaken', stance: 'air', cd: 340, grav: .2, vel: [[4, 0, -8]], chains: chain([17, 33], { special: 'afu' }) }),
    nfu: M('Shrine Gate: Four Pillars', 'Neutral U → K creates four staggered tall cleaves moving outward. Each pillar has a visible delay and can be escaped.', 'cast', 51, 10, [],
      { ability: 'awakened', stance: 'neutral', sfx: 'sukuna-domain', onFrame: at(10, (f, g) => { for (let i = 0; i < 4; i++) shot(f, g, 'sukunaCleave', { x: 65 + i * 95, y: -75, w: 56, h: 170, delay: i * 6 + 1, activeFor: 5, life: i * 6 + 15, dmg: 8, ang: 40, kb: 6, sc: 5 }); }) }),
    sfu: M('Rising Execution: Blood Ladder', 'Side U → K rises through three staggered levels, carrying a close opponent upward before the high finishing cut.', 'upslash', 44, 5,
      [cut(5, 10, 38, -38, 78, 70, 4, 90, 1, 0, { pull: true }), cut(13, 18, 34, -85, 80, 110, 4, 90, 2, 0, { pull: true, g: 1 }), cut(22, 26, 24, -110, 106, 136, 14, 86, 9, 9, { g: 2 })],
      { ability: 'awakened', stance: 'side', vel: [[3, 6, -8], [18, 1, -7]], grav: .4, sfx: 'sukuna-cleave' }),
    dfu: M('Fuga: Furnace Mouth', 'Down U → K plants a wide stationary flame charge. It detonates after a readable delay and launches vertically.', 'slam', 50, 13, [],
      { ability: 'awakened', stance: 'down', sfx: 'sukuna-fuga', vfx: 'sukunaFuga', onFrame: at(13, (f, g) => shot(f, g, 'sukunaFurnace', { x: 0, y: -35, w: 270, h: 130, delay: 18, activeFor: 5, life: 30, dmg: 22, ang: 85, kb: 10, sc: 9, fx: 'fire', col: '#ff7a24' })) }),
    afu: M('Dismantle: Execution Rain', 'Aerial U → K sends five separated blades down-forward in sequence; drifting between their lanes avoids the barrage.', 'castUp', 48, 7, [],
      { ability: 'awakened', stance: 'air', grav: .2, vel: [[0, -2, 0]], onFrame: (f, fr, g) => { if ([7, 12, 17, 22, 27].includes(fr)) shot(f, g, 'sukunaCleave', { x: (fr - 7) * 6 - 45, y: 8, vx: 3, vy: 14, w: 28, h: 90, life: 26, dmg: 6, ang: -72, kb: 5, sc: 4 }); } }),
    /**
     * Malevolent Shrine, staged as the five-beat anime sequence: the chant's own
     * sample runs alone for three seconds while Sukuna is rooted and untouchable,
     * the shrine then rises out of the floor over half a second, the domain opens
     * and dismantles everything inside it for a full five seconds, and the roar
     * clears the mix at four seconds without the cutting ever stopping.
     */
    ult: M('Malevolent Shrine', 'R at full meter: Sukuna chants alone for three seconds — rooted and untouchable — then the Malevolent Shrine rises and Dismantles a domain half again as wide as it used to be for five straight seconds. Leave its footprint before the third second or eat every cut.', 'castUp', SHRINE_DUR, SHRINE_CAST, [],
      { ability: 'ultimate', stance: 'neutral', ult: 'DOMAIN EXPANSION: MALEVOLENT SHRINE', invuln: [1, SHRINE_ACTIVE], vfx: 'sukunaShrine', sfx: 'sukuna-domain',
        onFrame: sequence(
          at(SHRINE_CAST, (f, g) => {
            g.fx.text(f.x, f.y - 182, 'DOMAIN EXPANSION', '#ff4765', 26, 74);
            g.fx.ring(f.x, f.y, 12, 300, '#ff2347', 30, 14);
            g.flashScreen('#18020a', .5); g.shake(16);
          }),
          // The chanting: cursed energy spirals in while the sample runs alone.
          (f, fr, g) => {
            // Rooted for the whole cast — the domain is opened standing still.
            f.vx = 0;
            if (fr > SHRINE_CAST && fr < SHRINE_ACTIVE && fr % 4 === 0) {
              const a = Math.random() * 6.28, r = 34 + Math.random() * 96;
              g.fx.add({ x: f.x + Math.cos(a) * r, y: f.y - 46 + Math.sin(a) * r * .8, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3 - 1, color: Math.random() < .55 ? '#ff2347' : '#ffd4cb', kind: 'glow', life: 22, size: 4 + Math.random() * 6 });
            }
          },
          at(SHRINE_APPEAR, (f, g) => {
            const floor = g.groundBelow(f.x, f.y) ?? f.y;
            g.spawnProj({
              owner: f, type: 'sig', sig: 'sukunaShrine',
              x: f.x, y: floor - DOMAIN_H / 2, vx: 0, vy: 0,
              w: DOMAIN_W, h: DOMAIN_H, life: SHRINE_SLASHES + SHRINE_RISE + 40,
              delay: SHRINE_RISE, activeFor: SHRINE_SLASHES, rehit: 12,
              dmg: 1.6, ang: 70, kb: 1.1, sc: 0, fx: 'dark',
              dir: f.facing, col: '#ff2749', col2: '#fff0e9', behind: true, data: { domain: true },
            });
            g.fx.text(f.x, f.y - 206, 'MALEVOLENT SHRINE', '#ff4765', 32, 90);
          }),
          // Four seconds in the roar clears the mix; the cutting does not stop.
          at(SHRINE_FADE, (_f, g) => { g.fadeDomainVoice(2.2); }),
          (f, fr, g) => {
            if (fr <= SHRINE_ACTIVE || fr % 30 !== 0) return;
            g.shake(5);
            g.fx.add({ x: f.x + (Math.random() - .5) * 60, y: f.y - 6, vx: (Math.random() - .5) * 5, vy: -2.4 - Math.random() * 3, color: '#ff2347', kind: 'glow', life: 20, size: 5 });
          },
        ) }),
  };
}

function gojoKit(): Record<string, MoveDef> {
  const M = (name: string, desc: string, anim: AnimName, dur: number, su: number, hits: HitDef[], o: Partial<MoveDef> = {}) => move('gojo', name, desc, anim, dur, su, hits, o);
  return {
    nlight: M('Blue-Touched Jab', 'A quick short jab pulls the opponent slightly toward Gojo. H continues, K compresses space, J launches.', 'punch', 19, 4,
      [blue(4, 7, 34, -46, 52, 34, 5, 35, 2, 0, { pull: true })], { trail: 'hand', chains: chain([7, 17], { light: 'nlight2', special: 'nlight_spec', heavy: 'nlight_heavy' }) }),
    nlight2: M('Infinity Palm', 'An open palm reaches higher and holds the target for the third light or a technique cancel.', 'cast', 22, 4,
      [blue(4, 10, 48, -60, 78, 66, 7, 78, 3, 1, { stun: 8 })], { chains: chain([10, 20], { light: 'nlight3', special: 'nlight_spec', heavy: 'nlight_heavy' }) }),
    nlight3: M('Blue: Compression Knuckle', 'A small inward squeeze catches twice, then a narrow upward punch ejects the target from the light string.', 'uppercut', 31, 5,
      [blue(5, 13, 44, -42, 100, 80, 2, 80, 1, 0, { rehit: 6, pull: true }), blue(17, 21, 40, -83, 56, 104, 9, 84, 7, 7, { g: 1 })]),
    nlight_spec: M('Blue: Pocket Singularity', 'Light-cancel places a stationary close Blue sphere that repeatedly pulls on contact, freeing Gojo to reposition.', 'cast', 28, 6, [],
      { onFrame: at(6, (f, g) => shot(f, g, 'blueOrb', { x: 90, w: 80, h: 80, life: 34, rehit: 9, pull: true, dmg: 2.5, kb: 1, sc: 0 })) }),
    nlight_heavy: M('Red: Upper Atmosphere', 'A rising Red palm launches almost straight up through a tall overhead lane.', 'castUp', 33, 8,
      [blue(8, 15, 24, -98, 78, 158, 12, 88, 8, 8)], { sfx: 'gojo-red' }),
    slight: M('Blue Step', 'A rapid advancing elbow drags the opponent along. H hits behind; K retreats; J crushes the landing.', 'thrust', 23, 5,
      [blue(5, 10, 43, -40, 70, 48, 6, 30, 2, 0, { pull: true })], { vel: [[3, 12, 0], [11, 2, null]], chains: chain([10, 21], { light: 'slight2', special: 'slight_spec', heavy: 'slight_heavy' }) }),
    slight2: M('Blind-Side Backhand', 'Stops the dash and backhands behind Gojo, reversing opponents who passed through him.', 'backslash', 25, 4,
      [blue(4, 11, -46, -46, 88, 58, 9, 150, 6, 5)], { vel: [[1, 0, null]], chains: chain([11, 23], { special: 'slight_spec', heavy: 'slight_heavy' }) }),
    slight_spec: M('Red: Recoil Shot', 'Slides backward while launching a compact Red orb forward; creates room against chasing opponents.', 'cast', 31, 7, [],
      { sfx: 'gojo-red', vel: [[7, -9, -2]], onFrame: at(7, (f, g) => shot(f, g, 'redBlast', { vx: 11, w: 75, h: 75, life: 28, activeFor: 28, dmg: 11, ang: 20, kb: 8, sc: 6 })) }),
    slight_heavy: M('Lapse: Floor Compression', 'A slow forward stomp hits only near floor level; strong vertical launch punishes grounded evasions.', 'slam', 37, 12,
      [blue(12, 19, 78, -13, 150, 34, 14, 80, 8, 8)], { vel: [[2, 4, null], [9, 0, null]], trail: 'foot' }),
    dlight: M('Low Orbit Sweep', 'A low ankle sweep starts a grounded juggle. H raises the orbit and K plants a floor well.', 'sweep', 23, 4,
      [hit(4, 9, 39, -10, 76, 24, 5, 74, 3.5, 1, { fx: 'blunt' })], { trail: 'foot', chains: chain([9, 21], { light: 'dlight2', special: 'dlight_spec' }) }),
    dlight2: M('Blue: Ascending Orbit', 'A small sphere climbs from knee to overhead height, catching the swept target without advancing.', 'castUp', 30, 5, [],
      { onFrame: at(5, (f, g) => shot(f, g, 'blueOrb', { x: 40, y: -20, vy: -7, w: 68, h: 68, life: 23, dmg: 3, rehit: 8, pull: true, kb: 1, sc: 0 })) }),
    dlight_spec: M('Blue: Floor Well', 'A low, wide stationary well catches landings after a delay. High jumps clear the contact field.', 'slam', 34, 8, [],
      { onFrame: at(8, (f, g) => shot(f, g, 'blueOrb', { x: 105, y: -8, w: 160, h: 30, delay: 8, activeFor: 24, life: 34, dmg: 3, rehit: 8, pull: true, kb: 1, sc: 0, data: { attractionRadius: 105 } })) }),
    nair: M('Infinity Cartwheel', 'A rotating aerial kick covers both sides. H creates a falling well; K lifts targets above you.', 'flip', 25, 4,
      [blue(4, 12, 0, -44, 120, 108, 6, 60, 3, 2)], { turns: 1, land: true, chains: chain([12, 23], { light: 'nair2', special: 'nair_spec' }) }),
    nair2: M('Blue: Falling Satellite', 'Releases a slow downward sphere while Gojo hangs above it, separating the fighter from the attack.', 'cast', 29, 5, [],
      { grav: .2, onFrame: at(5, (f, g) => shot(f, g, 'blueOrb', { x: 20, y: 10, vy: 8, w: 84, h: 84, life: 30, dmg: 4, rehit: 9, pull: true, kb: 1, sc: 0 })) }),
    nair_spec: M('Red: Ceiling Reversal', 'Aerial light-cancel fires an upward burst above Gojo; spikes him down slightly while launching targets skyward.', 'castUp', 30, 7,
      [blue(7, 14, 0, -123, 120, 104, 11, 92, 8, 7)], { sfx: 'gojo-red', vel: [[7, 0, 5]] }),
    sair: M('Warp Heel', 'A forward aerial heel extends farther than the jab; H ejects outward and K checks behind.', 'kick', 22, 4,
      [blue(4, 10, 55, -40, 86, 36, 7, 26, 3.5, 2)], { trail: 'foot', land: true, vel: [[3, 8, null]], chains: chain([10, 20], { light: 'sair2', special: 'sair_spec' }) }),
    sair2: M('Red: Point-Blank Ejection', 'Brakes in midair, then a short heavy palm ejects the target almost horizontally.', 'punch', 27, 6,
      [blue(6, 12, 42, -44, 64, 70, 11, 12, 8, 7)], { sfx: 'gojo-red', vel: [[1, 0, 0]], grav: .2, land: true }),
    sair_spec: M('Red: Rearview Burst', 'Detonates behind Gojo while propelling him forward, punishing a pursuing aerial opponent.', 'backslash', 30, 7,
      [blue(7, 15, -66, -42, 130, 90, 12, 150, 8, 7)], { sfx: 'gojo-red', vel: [[7, 11, -2]], grav: .5 }),
    dair: M('Heel of the Strongest', 'A precise downward heel spikes directly beneath Gojo; narrow reach demands accurate positioning.', 'dkick', 28, 6,
      [blue(6, 16, 12, 5, 46, 68, 10, -88, 6, 6)], { trail: 'foot', land: true, vel: [[5, 1, 11]] }),
    nsig: M('Blue: Arresting Palm', 'A short pull-palm confirms J into Red Suspension, then L into Point-Zero Purple. Missing the palm cannot start the route.', 'punch', 35, 8,
      [blue(8, 12, 45, -44, 84, 76, 7, 85, 1.5, 0, { pull: true, stun: 14 })],
      { chains: chain([13, 29], { heavy: 'boss_heavy2', onHitOnly: true }), chainLabel: 'J → J → L · CONVERGENCE' }),
    boss_heavy2: M('Red Suspension', 'Combo-only second J: a low pull catches into an overhead compressing blow. Confirm with L for Purple.', 'castUp', 37, 5,
      [blue(5, 8, 42, -30, 88, 70, 4, 70, 1, 0, { pull: true, stun: 7 }), blue(13, 17, 40, -65, 110, 120, 6, 85, 1.5, 0, { pull: true, stun: 14, g: 1 })],
      { sfx: 'gojo-red', grav: .3, vel: [[0, 2, 0]], chains: chain([18, 33], { limit: 'boss_finisher', onHitOnly: true }), chainLabel: 'L · POINT-ZERO PURPLE' }),
    boss_finisher: M('Point-Zero Purple', 'Only J → J → L: an inward compression holds briefly before a close Purple explosion ejects the target. Uses Limit cooldown.', 'cast', 47, 6,
      [blue(6, 11, 55, -48, 134, 116, 4, 80, 1, 0, { pull: true, stun: 16 }), blue(19, 23, 80, -52, 198, 168, 24, 38, 10, 10, { g: 1 })],
      { ability: 'limit', cd: 290, sfx: 'gojo-purple', vfx: 'hollowPurple', vel: [[0, 0, 0]], grav: .15 }),
    ssig: M('Red: Rail Cannon', 'A committed thin horizontal repulsion lane reaches far forward but leaves the space above Gojo open.', 'cast', 42, 13,
      [blue(13, 19, 150, -45, 290, 54, 16, 22, 9, 9)], { sfx: 'gojo-red', vel: [[13, -5, null]] }),
    dsig: M('Infinity: Expanding Boundary', 'A slow circular push starts close, then catches a wider ring. Two separate timing windows punish late approaches.', 'slam', 44, 12,
      [blue(12, 15, 0, -43, 110, 108, 5, 75, 3, 1), blue(21, 25, 0, -43, 260, 158, 12, 66, 8, 8, { g: 1 })], { sfx: 'gojo-red' }),
    rec: M('Blue: Vertical Transit', 'Up + aerial J: rides a rising Blue pull before an overhead finishing palm. Uses the normal recovery allowance.', 'rise', 36, 4,
      [blue(4, 17, 0, -62, 76, 118, 2, 90, 1, 0, { pull: true, rehit: 6 }), blue(19, 23, 0, -109, 110, 90, 8, 90, 6, 6, { g: 1 })],
      { vel: [[4, 0, -16]], grav: .35 }),
    gp: M('Red: Terminal Descent', 'Down + aerial J: drops straight down behind a broad downward repulsion field; ends on landing.', 'dive', 44, 8,
      [blue(8, 36, 0, 5, 118, 70, 13, -80, 7, 8)], { sfx: 'gojo-red', land: true, vel: [[8, 0, 18]] }),
    aig: M('Infinity: Air Fold', 'Neutral aerial J: a brief evasive fold moves backward, then a forward palm punishes the missed approach.', 'counter', 35, 11,
      [blue(11, 18, 61, -46, 120, 86, 12, 45, 7, 7)], { invuln: [3, 8], cd: 110, vel: [[3, -9, -2], [9, 0, 0]], grav: .3 }),
    nspec: M('Blue: Roaming Singularity', 'Neutral K launches a slow attraction sphere. Repeated contact pulls victims along its path; it controls space rather than bursting.', 'cast', 39, 10, [],
      { ability: 'special', stance: 'neutral', cd: 180, onFrame: at(10, (f, g) => shot(f, g, 'blueOrb', { vx: 5, w: 100, h: 100, life: 56, rehit: 10, pull: true, dmg: 2.7, kb: 1.5, sc: 0 })) }),
    sspec: M('Red: Reversal Mine', 'Side K plants a delayed repulsion sphere ahead. Retreat or push an enemy into the marked detonation point.', 'cast', 35, 8, [],
      { ability: 'special', stance: 'side', cd: 150, sfx: 'gojo-red', onFrame: at(8, (f, g) => shot(f, g, 'redBlast', { x: 145, w: 160, h: 136, delay: 13, activeFor: 5, life: 27, dmg: 14, ang: 32, kb: 9, sc: 8 })) }),
    dspec: M('Infinity: Still Point', 'Down K counters a nearby attacker during frames 3–22. It has no simultaneous invulnerability, so successful contact triggers the retaliation.', 'counter', 39, 3, [],
      { ability: 'special', stance: 'down', cd: 180, ...counter(BLUE, 22, 14), onFrame: (f, fr, g) => { if (fr >= 3 && fr <= 22 && fr % 5 === 0) g.fx.ring(f.x, f.y - 42, 50, 54, BLUE, 9, 3); } }),
    aspec: M('Red: Aerial Thruster', 'Aerial K fires a downward Red burst and kicks Gojo upward and back. The attack stays below the escape path.', 'cast', 34, 7, [],
      { ability: 'special', stance: 'air', cd: 175, sfx: 'gojo-red', vel: [[7, -4, -9]], onFrame: at(7, (f, g) => shot(f, g, 'redBlast', { x: 15, y: 30, vx: 2, vy: 10, w: 105, h: 70, life: 25, activeFor: 25, dmg: 12, ang: -65, kb: 7, sc: 7 })) }),
    nex: M('Maximum Blue: Fixed Star', 'Neutral L plants a large stationary Blue ahead with sustained inward pressure. Its final collapse launches those still nearby.', 'cast', 44, 13, [],
      { ability: 'limit', stance: 'neutral', cd: 275, onFrame: at(13, (f, g) => shot(f, g, 'blueOrb', { x: 180, w: 155, h: 155, life: 60, dmg: 2, rehit: 10, pull: true, kb: 1, sc: 0, fin: { dmg: 12, ang: 78, kb: 8, sc: 7 } })) }),
    sex: M('Maximum Red: Twin Reversal', 'Side L fires a low red shot, then a higher faster shot. Staggered heights cover retreating ground and aerial targets.', 'cast', 46, 10, [],
      { ability: 'limit', stance: 'side', cd: 275, sfx: 'gojo-red', onFrame: sequence(
        at(10, (f, g) => shot(f, g, 'redBlast', { y: -18, vx: 10, w: 110, h: 50, life: 32, activeFor: 32, dmg: 9, ang: 25, kb: 6, sc: 5 })),
        at(22, (f, g) => shot(f, g, 'redBlast', { y: -98, vx: 15, w: 86, h: 70, life: 30, activeFor: 30, dmg: 13, ang: 35, kb: 9, sc: 8 }))) }),
    dex: M('Infinity: Reversal Shell', 'Down L offers a short close counter; whether attacked or not, a delayed circular Red pulse clears space around Gojo.', 'counter', 45, 3,
      [blue(27, 32, 0, -42, 290, 180, 14, 65, 8, 8)], { ability: 'limit', stance: 'down', cd: 275, sfx: 'gojo-red', ...counter(RED, 18, 10) }),
    aex: M('Hollow Purple: Oblique Ray', 'Aerial L fires a compact Purple orb diagonally downward while hovering; a precise ledge and landing punish.', 'cast', 43, 12, [],
      { ability: 'limit', stance: 'air', cd: 275, sfx: 'gojo-purple', vfx: 'hollowPurple', grav: .1, vel: [[0, 0, 0]],
        onFrame: at(12, (f, g) => shot(f, g, 'hollowPurple', { vx: 12, vy: 8, w: 105, h: 105, life: 38, dmg: 18, ang: -42, kb: 8, sc: 8 })) }),
    naw: M('Six Eyes: Focus', 'Neutral U concentrates a tight inward field and briefly accelerates Gojo. K combines the colors into Hollow Purple.', 'castUp', 36, 8,
      [blue(8, 14, 0, -45, 140, 126, 6, 80, 1, 0, { pull: true, stun: 8 })], { ability: 'awaken', stance: 'neutral', cd: 350,
        onFrame: at(8, f => { f.godT = Math.max(f.godT, 130); }), chains: chain([15, 33], { special: 'nfu' }) }),
    saw: M('Six Eyes: Shortest Path', 'Side U slips forward through a brief defensive window and pulls with an elbow. K unfolds a delayed rear Red trap.', 'thrust', 35, 7,
      [blue(7, 13, 36, -42, 70, 72, 8, 60, 2, 0, { pull: true, stun: 7 })], { ability: 'awaken', stance: 'side', cd: 350, invuln: [3, 6], vel: [[3, 18, 0], [14, 0, null]], chains: chain([14, 32], { special: 'sfu' }) }),
    daw: M('Six Eyes: Event Horizon', 'Down U sweeps both sides at foot level, drawing nearby grounded targets inward. K raises the Infinite Void barrier.', 'slam', 38, 9,
      [blue(9, 17, 0, -16, 230, 44, 2.5, 80, 1, 0, { pull: true, rehit: 7, stun: 6 })], { ability: 'awaken', stance: 'down', cd: 350, chains: chain([18, 35], { special: 'dfu' }) }),
    aaw: M('Six Eyes: Weightless', 'Aerial U arrests the fall and repels above both shoulders; K splits Blue and Red into opposing aerial lanes.', 'castUp', 35, 6,
      [blue(6, 13, 0, -100, 180, 66, 8, 92, 5, 4)], { ability: 'awaken', stance: 'air', cd: 350, grav: .05, vel: [[0, 0, -4]], chains: chain([14, 32], { special: 'afu' }) }),
    nfu: M('Hollow Purple: Convergence', 'Neutral U → K charges for 16 frames then releases a large travelling Purple. Strong straight-line damage with a visible startup.', 'cast', 56, 16, [],
      { ability: 'awakened', stance: 'neutral', sfx: 'gojo-purple', vfx: 'hollowPurple', onFrame: at(16, (f, g) => shot(f, g, 'hollowPurple', { x: 70, vx: 12, w: 150, h: 150, life: 58, dmg: 24, ang: 38, kb: 10, sc: 10 })) }),
    sfu: M('Red: Reversed Causality', 'Side U → K places a delayed blast behind Gojo while he retreats toward it; a second forward palm traps a pursuing foe between timings.', 'backslash', 47, 8,
      [blue(22, 27, 50, -43, 96, 90, 11, 28, 8, 7)], { ability: 'awakened', stance: 'side', sfx: 'gojo-red', vel: [[3, -6, 0], [16, 0, null]],
        onFrame: at(8, (f, g) => shot(f, g, 'redBlast', { x: -110, w: 160, h: 150, dir: -f.facing, delay: 16, activeFor: 5, life: 30, dmg: 14, ang: 38, kb: 8, sc: 8 })) }),
    dfu: M('Infinite Void: Blink', 'Down U → K forms a small brief domain. Two low-damage pulses add hitstun without forcibly freezing dodging or invulnerable targets.', 'castUp', 50, 14,
      [blue(14, 17, 0, -60, 310, 210, 4, 90, 0, 0, { stun: 18 }), blue(29, 32, 0, -60, 310, 210, 9, 80, 6, 6, { g: 1 })],
      { ability: 'awakened', stance: 'down', sfx: 'gojo-void', onFrame: at(14, (f, g) => { g.fx.ring(f.x, f.y - 60, 10, 160, PURPLE, 30, 10); g.flashScreen('#061026', .28); }) }),
    afu: M('Limitless: Binary Stars', 'Aerial U → K sends Blue forward and Red backward on diverging diagonals, covering opposite sides with pull and repulsion.', 'spin', 45, 9, [],
      { ability: 'awakened', stance: 'air', grav: .2, turns: 1, sfx: 'gojo-purple', onFrame: at(9, (f, g) => {
        shot(f, g, 'blueOrb', { x: 65, vx: 7, vy: -3, w: 110, h: 110, life: 36, dmg: 3, rehit: 10, pull: true, kb: 1, sc: 0 });
        shot(f, g, 'redBlast', { x: -65, vx: -10, vy: 6, dir: -f.facing, w: 120, h: 90, life: 34, activeFor: 34, dmg: 17, ang: 32, kb: 9, sc: 9 });
      }) }),
    ult: M('Unlimited Void', 'R at full meter: a wide stationary barrier pulses information overload three times, then ejects caught targets. The boundary can be escaped; invulnerability is respected.', 'castUp', 99, 26,
      [blue(26, 29, 0, -85, 630, 340, 5, 90, 0, 0, { stun: 17 }), blue(44, 47, 0, -85, 630, 340, 5, 90, 0, 0, { stun: 17, g: 1 }),
        blue(62, 65, 0, -85, 630, 340, 5, 90, 0, 0, { stun: 17, g: 2 }), blue(79, 83, 0, -85, 630, 340, 22, 70, 10, 10, { g: 3 })],
      { ability: 'ultimate', stance: 'neutral', ult: 'DOMAIN EXPANSION: UNLIMITED VOID', invuln: [1, 19], grav: 0, vel: [[0, 0, 0]], sfx: 'gojo-void',
        onFrame: (f, fr, g) => { if ([26, 44, 62, 79].includes(fr)) { g.fx.ring(f.x, f.y - 85, 5, 330, PURPLE, 24, 12); g.fx.ring(f.x, f.y - 85, 310, 35, BLUE, 22, 5); g.flashScreen('#08112f', .36); g.shake(7); } } }),
  };
}

/** Run AFTER applySignatures so generic overrides cannot erase the bespoke boss kit. */
export function installBossKit<T extends Record<string, MoveDef>>(id: string, _look: { energy: string }, moves: T): T & Record<string, MoveDef> {
  if (id !== 'sukuna' && id !== 'gojo') return moves;
  Object.assign(moves, id === 'sukuna' ? sukunaKit() : gojoKit());
  return moves;
}

/** Input roots deliberately mirror fighter dispatch, not every defined move. */
export const BOSS_INPUT_ROOTS = ['nlight', 'slight', 'dlight', 'nair', 'sair', 'dair', 'nsig', 'ssig', 'dsig', 'rec', 'gp',
  'aig', 'nspec', 'sspec', 'dspec', 'aspec', 'nex', 'sex', 'dex', 'aex', 'naw', 'saw', 'daw', 'aaw', 'ult'] as const;

export function auditBossKit(moves: Record<string, MoveDef>) {
  const seen = new Set<string>(); const queue: string[] = [...BOSS_INPUT_ROOTS]; const errors: string[] = [];
  while (queue.length) {
    const key = queue.shift()!; if (seen.has(key)) continue;
    const m = moves[key]; if (!m) { errors.push(`Missing reachable move: ${key}`); continue; }
    seen.add(key);
    if (!m.desc?.trim()) errors.push(`Missing description: ${key}`);
    if (!(m.startup > 0 && m.startup < m.dur)) errors.push(`Invalid startup: ${key}`);
    for (const h of m.hits) if (h.f[0] > h.f[1] || h.f[0] < 1 || h.f[1] >= m.dur || h.w <= 0 || h.h <= 0) errors.push(`Invalid hitbox: ${key}`);
    const c = m.chains;
    if (c) {
      if (!c.window || c.window[0] > c.window[1] || c.window[1] >= m.dur) errors.push(`Invalid chain window: ${key}`);
      if (c.onHitOnly && !m.hits.length) errors.push(`Hit-confirm chain lacks melee: ${key}`);
      for (const action of ['light', 'heavy', 'special', 'limit', 'awaken'] as const) if (c[action]) queue.push(c[action]!);
    }
  }
  for (const key of Object.keys(moves)) if (!seen.has(key)) errors.push(`Unreachable: ${key}`);
  if (moves.nsig.chains?.heavy !== 'boss_heavy2' || moves.boss_heavy2?.chains?.limit !== 'boss_finisher') errors.push('Missing J → J → L route');
  if (new Set([...seen].map(k => moves[k].name)).size !== seen.size) errors.push('Duplicate move names');
  return { reachable: seen.size, keys: [...seen], errors };
}
