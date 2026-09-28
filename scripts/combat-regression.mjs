#!/usr/bin/env node
/**
 * Run: node scripts/combat-regression.mjs [--filter substring] [--list]
 * Bundles the actual TypeScript engine with the existing Vite/esbuild dependency.
 * Temporary bundle is removed on exit. No runtime files are written or patched.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installBrowser } from './combat-headless.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = installBrowser();
const temp = await mkdtemp(join(root, 'scripts', '.combat-regression-'));
const filterIndex = process.argv.indexOf('--filter');
const filter = filterIndex < 0 ? '' : process.argv[filterIndex + 1];
assert.ok(typeof filter === 'string', '--filter needs a substring');
const exists = async path => access(path).then(() => true, () => false);
let failures = 0;
let passes = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: expected ${expected}, got ${actual}`);

try {
  const hasCatalog = await exists(join(root, 'src/game/moveCatalog.ts'));
  const bundle = await build({
    stdin: { contents: [
      "export { Game } from './src/game/game';",
      "export { Fighter } from './src/game/fighter';",
      "export { AI } from './src/game/ai';",
      "export { CHARACTERS, charById } from './src/game/characters';",
      "export { DEFAULT_BINDINGS, keyboard } from './src/game/input';",
      "export { emptyInput } from './src/game/types';",
      "export { buildCustom, newCustomCfg } from './src/game/custom';",
      "export { PREVIEW_ARENA } from './src/game/arenas';",
      "export * as catalog from './src/game/moveCatalog';",
      "export { lastClipRequest, clearClipRequests } from './src/game/sfx';",
    ].join('\n'), resolveDir: root, sourcefile: 'combat-regression-entry.ts' },
    bundle: true, platform: 'node', format: 'esm', target: 'node20', write: false,
    loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl', '.mp3': 'dataurl' }, logLevel: 'silent',
  });
  const entry = join(temp, 'engine.mjs');
  await writeFile(entry, bundle.outputFiles[0].text);
  const { Game, Fighter, AI, CHARACTERS, charById, DEFAULT_BINDINGS, keyboard, emptyInput, PREVIEW_ARENA, catalog, buildCustom, newCustomCfg, lastClipRequest, clearClipRequests } = await import(pathToFileURL(entry).href);
  const bosses = CHARACTERS.filter(c => c.moves.boss_heavy2 || c.moves.boss_finisher);

  function game(player = 'levi', overrides = {}) {
    keyboard.down.clear();
    const cfg = { mode: 'training', rule: 'training', stocks: 3, time: 180, arena: 'rooftops', player,
      cpus: [{ char: 'asta', diff: 'hard' }], ...overrides };
    const g = new Game(browser.canvas(), cfg, { bindings: DEFAULT_BINDINGS, tapJump: false });
    // Flat real arena fixture removes platforms, stage hazards and blast KOs from move tests.
    g.arena = { ...PREVIEW_ARENA, spawns: [[0, 0], [55, 0], [300, 0], [450, 0]] };
    g.countdown = 0;
    g.fighters.forEach((f, i) => {
      assert.ok(f instanceof Fighter);
      Object.assign(f, { x: i * 55, y: 0, vx: 0, vy: 0, grounded: true, state: 'idle', invuln: 0, facing: i ? -1 : 1 });
      // Scripted opponent input replaces only input generation, never simulation methods.
      if (f.isCPU) g.ais.set(f, { think: emptyInput });
    });
    return g;
  }
  function tick(g, keys = []) {
    keyboard.down = new Set(keys);
    browser.advance();
    g.step();
  }
  function frames(g, n, keys = []) { for (let i = 0; i < n; i++) tick(g, keys); }
  function until(g, condition, limit = 300) {
    for (let i = 0; i < limit && !condition(); i++) tick(g);
    assert.ok(condition(), `condition timed out at frame ${g.frame}; ${g.fighters.map(f => `${f.def.id}:${f.state}:${f.moveKey}:${f.moveFrame}`).join(', ')}`);
  }

  /* ================= KO REPLAY =================================================
   * These exist because the replay shipped broken and the whole suite still went
   * green. Every other check here drives `step()` directly, and the replay only
   * misbehaves on the way *back* - the frame after it hands the world over - so
   * nothing short of running a knockout all the way through would ever see it.
   * One channel of the replay buffer was named `speedLines`, which is a live
   * array on Game: restoring a frame wrote a number into it, the next `step`
   * threw `this.speedLines is not iterable`, and because that throw lands inside
   * the animation-frame callback the whole loop dies and the canvas freezes on
   * its last frame forever. The player sees a hang, not a stack trace.
   */
  test('replay: a knockout arms the buffer and the lead-in plays back', () => {
    const g = game('goku_ui', { rule: 'stock', mode: 'stock', stocks: 3 });
    frames(g, 200);
    assert.ok(g.replay.count > 100, `buffer only held ${g.replay.count} frames of footage`);
    g.ko(g.fighters[1]);
    assert.ok(g.replay.armed, 'the knockout did not raise the replay');
    // The KO impact is left to play at full speed before the rewind begins.
    assert.ok(!g.replay.active, 'the replay started on the knockout frame instead of after it');
    until(g, () => g.replay.active, 120);
    assert.ok(g.replay.armed === false, 'replay stayed armed after it started');
  });

  test('replay: the world is stepped, not frozen, while it plays', () => {
    const g = game('goku_ui', { rule: 'stock', mode: 'stock', stocks: 3 });
    frames(g, 200);
    g.ko(g.fighters[1]);
    until(g, () => g.replay.active, 120);
    // The simulation must be suspended...
    const frozen = g.fighters[1];
    const before = { x: frozen.x, y: frozen.y, state: frozen.state };
    frames(g, 30);
    assert.equal(frozen.x, before.x); assert.equal(frozen.state, before.state,
      'the live fighter was simulated during a replay - the replay would be writing over a running world');
    // ...while the picture advances, so it is playing back and not hanging.
    const seen = new Set();
    for (let i = 0; i < 120 && g.replay.active; i++) { tick(g); seen.add(`${g.cam.x.toFixed(3)}|${g.cam.y.toFixed(3)}|${g.frame}`); }
    assert.ok(seen.size > 20, `replay only produced ${seen.size} distinct frames - it is not playing`);
  });

  test('replay: hands the world back intact and the match keeps running', () => {
    const g = game('goku_ui', { rule: 'stock', mode: 'stock', stocks: 3 });
    frames(g, 200);
    const [player, foe] = g.fighters;
    const projectilesBefore = g.projectiles;
    g.ko(foe);
    until(g, () => g.replay.active, 120);
    until(g, () => !g.replay.active, 900);
    // The live world comes back: same array, same fighters, no stuck KO.
    assert.equal(g.projectiles, projectilesBefore, 'the live projectile array was swapped out and never returned');
    assert.equal(foe.state, 'ko', `the KO'd fighter came back as ${foe.state} - the world was not restored`);
    assert.ok(!g.replay.active, 'replay never finished');
    // And the engine survives its own aftermath. This is the check that catches
    // a replay channel clobbering a live array: the next step is where it blows up.
    const threw = [];
    for (let i = 0; i < 240; i++) { try { tick(g); } catch (e) { threw.push(e.message); break; } }
    assert.deepEqual(threw, [], `the engine threw after the replay: ${threw[0]}`);
    assert.ok(g.frame > 0, 'the frame counter stopped');
    assert.ok(Array.isArray(g.speedLines), 'speed lines is no longer an array - a replay channel is writing into it');
    // Simulated motion resumes once the no-input window closes.
    const moved = g.fighters.some(f => f.state !== 'ko');
    assert.ok(moved, 'every fighter was still downed after the replay');
  });

  test('replay: a match-ending knockout still plays at wall-clock speed', () => {
    // endMatch drops the match to 0.35x. A replay that inherits that turns a
    // seven-second knockout into twenty seconds that read as a hang, so the
    // loop must ignore the match time scale while one owns the screen.
    const g = game('goku_ui', { rule: 'stock', mode: 'stock', stocks: 1 });
    frames(g, 200);
    g.ko(g.fighters[1]);
    until(g, () => g.ended, 60);
    assert.equal(g.timeScale, 0.35, 'fixture assumption: the match ends in slow motion');
    const armedAt = g.frame;
    until(g, () => g.replay.active, 120);
    let played = 0;
    while (g.replay.active && played < 2000) { tick(g); played++; }
    assert.ok(g.replay.active === false, 'replay never finished');
    // ~5s lead-in plus the slow ramp, on a 1/60s step. Anything near 2000
    // means it ran on the match clock instead of the wall clock.
    assert.ok(played < 700, `the replay took ${played} steps - it is inheriting the end-of-match time scale`);
    assert.ok(g.frame - armedAt < 800, 'the whole KO sequence overran its budget');
  });

  test('replay: every replay frame renders without throwing', () => {
    // THE FREEZE. The swing pool recorded a `facing` field the effect does not
    // have and never recorded `p`, the profile it does. Restoring footage
    // therefore produced swings with no profile, `drawSwing` destructured
    // `undefined`, and threw inside the animation-frame callback - which is not
    // caught anywhere, so the loop was never re-armed and the match hung on its
    // last frame forever. Rendering the whole replay is the only way to see it.
    const g = game('levi', { rule: 'stock', mode: 'stock', stocks: 3 });
    frames(g, 200);
    // Real swing effects of every shape the renderer knows, in a pool longer than
    // a single recorded frame can hold.
    for (let i = 0; i < 40; i++) {
      g.fx.swing(i * 6 - 120, -40, 40 + (i % 9) * 8, -0.9, 0.9, { style: 'blade3', col: '#8dffbe', col2: '#ffffff' }, 1, 40, 1.2);
    }
    g.ko(g.fighters[1]);
    until(g, () => g.replay.active, 120);
    let played = 0;
    while (g.replay.active && played < 2000) { tick(g); render(g); played++; }
    assert.ok(played > 60, 'the replay never really played, so nothing was rendered');
    // The restored swings must be drawable, not merely non-throwing.
    assert.ok(g.fx.swings.every(s => s.p && typeof s.p.style === 'string' && s.p.col && s.p.col2),
      'a restored swing is missing its render profile');
  });

  test('replay: the aftermath window closes and the match clock is handed back', () => {
    // `ownsScreen` suppresses the match time scale. A no-input window that never
    // counted down would latch that override on, and a match that ended at 0.35x
    // would then run at a third speed forever - a quiet, permanent freeze.
    const g = game('goku_ui', { rule: 'stock', mode: 'stock', stocks: 1 });
    frames(g, 200);
    g.ko(g.fighters[1]);
    until(g, () => g.ended, 60);
    until(g, () => g.replay.active, 120);
    while (g.replay.active) { tick(g); }
    assert.ok(g.replay.ownsScreen, 'the post-replay window did not open');
    let guard = 0;
    while (g.replay.ownsScreen && guard++ < 600) tick(g);
    assert.equal(g.replay.ownsScreen, false, `the replay never handed the screen back (${guard} frames)`);
    // With the screen handed back the match's own clock applies again, and the
    // end-of-match slow motion runs its course to full speed.
    guard = 0;
    while (g.timeScale !== 1 && guard++ < 400) tick(g);
    assert.equal(g.timeScale, 1, 'the match time scale was never restored');
  });

  test('replay: the footage ends on the blow, not one frame before it', () => {
    // `ko` fires part-way through a step while `record` runs at the end of it, so
    // the knockdown frame is the one written *after* the replay was raised. If
    // the knockout index is guessed from the ring's length at the wrong moment
    // the result banner stamps over the hit that caused it.
    const g = game('levi', { rule: 'stock', mode: 'stock', stocks: 3 });
    frames(g, 200);
    g.ko(g.fighters[1]);
    until(g, () => g.replay.active, 120);
    // The last frame of the ring must be the knockout frame, so playback ends on it.
    let last = null, played = 0;
    while (g.replay.active && played++ < 2000) { tick(g); last = g.replay.status.toKill; }
    assert.ok(last !== null && last <= 1, `playback ended ${last} frames short of the knockout`);
  });

  test('loop: a frame fault is absorbed and the match keeps running', () => {
    // The animation-frame callback has no caller above it. A throw there kills
    // the loop, and the player is left looking at a still frame of a game that
    // will never respond again. The loop is the boundary that stops that.
    const g = game('levi');
    frames(g, 60);
    g.running = true;            // the harness drives step() directly, so start() never ran
    const realRender = g.render.bind(g);
    const realError = console.error;
    console.error = () => {};    // the fault is expected to be reported; do not spam the log
    let threw = false;
    try {
      g.render = () => { if (!threw) { threw = true; throw new Error('synthetic render fault'); } realRender(); };
      g.runFrame(0);
      assert.equal(g.faults, 1, 'a frame fault was not counted');
      assert.match(g.lastFault || '', /synthetic render fault/);
      assert.ok(g.running, 'a frame fault stopped the match');
      // And the counter stays reported-once rather than spamming the console.
      g.render = () => { throw new Error('synthetic render fault'); };
      g.runFrame(16.7); g.runFrame(33.4);
      assert.equal(g.faults, 3);
    } finally { console.error = realError; }
  });
  function render(g) {
    const saved = console.error;
    console.error = (...args) => { throw new Error(args.map(String).join(' ')); };
    try { g.render(); g.canvas.assertBalanced(); } finally { console.error = saved; }
  }
  const air = f => Object.assign(f, { y: -450, grounded: false, state: 'air', vx: 0, vy: 0 });
  /**
   * The four buttons. `limit` and `ult` are gone: the extra ability and the
   * ultimate were both retired, and R is now the Awakening.
   */
  const buttons = ['light', 'heavy', 'special', 'awaken'];
  /**
   * Discovers moves through real input routing only - no invented roots. The
   * awakened tier is discovered by actually spending a gauge, because that is the
   * only way the controller will produce one, and every probe gets its own game so
   * a recovery or a cooldown from one press cannot hide the next.
   */
  function reachable(c) {
    const seen = new Set();
    // Discover direct roots through actual input routing; do not duplicate an engine root list.
    for (const airborne of [false, true]) for (const direction of [null, 'right', 'down', 'up']) for (const button of buttons) {
      const g = game(c.id);
      const f = g.fighters[0];
      if (airborne) air(f);
      f.meter = 100;
      tick(g, [DEFAULT_BINDINGS[button][0], ...(direction ? [DEFAULT_BINDINGS[direction][0]] : [])]);
      if (f.moveKey) seen.add(f.moveKey);
    }
    // The awakened kit: spend a gauge, let the transformation finish, then press
    // every attack button in every stance, grounded and airborne.
    for (const airborne of [false, true]) for (const direction of [null, 'right', 'down']) for (const button of ['light', 'heavy', 'special']) {
      const g = game(c.id);
      const f = g.fighters[0];
      f.meter = 100;
      tick(g, [DEFAULT_BINDINGS.awaken[0]]);
      if (!f.moveKey) continue;
      // The transformation cuts, so on a hit it spends hitstop frames and runs long.
      until(g, () => f.moveKey === null, 300);
      assert.ok(f.awakened, `${c.id}: a full gauge did not open the Awakening`);
      if (airborne) air(f);
      tick(g, [DEFAULT_BINDINGS[button][0], ...(direction ? [DEFAULT_BINDINGS[direction][0]] : [])]);
      if (f.moveKey) seen.add(f.moveKey);
    }
    const queue = [...seen];
    for (let i = 0; i < queue.length; i++) {
      const chains = c.moves[queue[i]]?.chains;
      for (const action of buttons) {
        const key = chains?.[action];
        if (key && !seen.has(key)) { assert.ok(c.moves[key], `${c.id}:${queue[i]} references missing ${key}`); seen.add(key); queue.push(key); }
      }
    }
    return seen;
  }

  test('catalog integration exists', () => assert.ok(catalog, 'moveCatalog.ts is not integrated yet'));
  test('boss roster integration, and the full reachable kit', () => {
    assert.ok(bosses.length > 0, 'bossKits.ts has not installed any boss routes');
    for (const c of bosses) {
      // The boss kit is a bespoke route layered over a generated awakening tree,
      // so the count is whatever the kit plus the tree actually produce. What
      // matters is that nothing is defined and unreachable - `reachable` proves
      // that per fighter - and that the count has not silently collapsed.
      assert.ok(Object.keys(c.moves).length >= 40, `${c.id} move count collapsed to ${Object.keys(c.moves).length}`);
      assert.ok(c.moves.boss_finisher, `${c.id} lost its finisher`);
      assert.equal(c.moves.nfu, c.moves.boss_finisher, `${c.id} finisher is not the awakened special`);
      assert.ok(c.moves.nwl && c.moves.nwh, `${c.id} has no bespoke awakened light or heavy`);
    }
  });
  for (const c of CHARACTERS) {
    test(`roster ${c.id}: references and input-reachable moves`, () => {
      const reached = reachable(c);
      // Two keys can be one move: a boss finisher is authored under its own name
      // and installed as the awakened special, so it is reachable the moment
      // `nfu` is. What must never happen is a move no press can ever produce.
      const live = new Set([...reached].map(key => c.moves[key]));
      assert.deepEqual(Object.keys(c.moves).filter(key => !live.has(c.moves[key])), [], `${c.id}: unreachable move keys`);
      for (const [key, m] of Object.entries(c.moves)) {
        assert.ok(m && m.dur > 0 && m.startup >= 0 && m.startup < m.dur, `${key}: invalid duration/startup`);
        for (const action of buttons) if (m.chains?.[action]) assert.ok(c.moves[m.chains[action]], `${key}: dangling ${action} chain`);
        for (const h of m.hits) {
          assert.ok(h.f[0] <= h.f[1] && h.f[0] < m.dur, `${key}: hit cannot become active`);
          assert.ok(h.w > 0 && h.h > 0 && h.dmg >= 0, `${key}: invalid hit geometry/damage`);
        }
      }
    });
    test(`render ${c.id}: every move simulates and draws`, () => {
      for (const [key, m] of Object.entries(c.moves)) {
        try {
          const g = game(c.id);
          const [f, target] = g.fighters;
          target.x = 200;
          if (/^(nair|sair|dair|rec|gp|aspec|aig|aaw|awl|awh|afu|awf)/.test(key)) { air(f); air(target); }
          f.meter = 100;
          f.startMove(key, g);
          assert.equal(f.moveKey, key);
          let activeFrames = 0;
          render(g);
          for (let i = 0; i < m.dur + 260; i++) {
            tick(g);
            if (f.moveKey === key) activeFrames++;
            // Render every frame while the move or its projectiles exist, including delayed signatures.
            render(g);
            for (const entity of [...g.fighters, ...g.projectiles]) for (const prop of ['x', 'y', 'vx', 'vy']) {
              assert.ok(Number.isFinite(entity[prop]), `${prop} became non-finite`);
            }
            if (!g.cin && f.moveKey !== key && g.projectiles.length === 0 && i > m.dur) break;
          }
          assert.ok(activeFrames > 0, 'move never progressed');
          assert.notEqual(f.moveKey, key, 'move did not finish');
        } catch (error) { throw new Error(`${c.id}/${key}: ${error.message}`, { cause: error }); }
      }
    });
  }

  test('melee: real keyboard hit, single-hit deduplication, opposite facing whiff', () => {
    const g = game(); const [f, target] = g.fighters;
    tick(g, ['KeyH']); until(g, () => target.dmgTaken > 0);
    assert.ok(f.hitsLanded > 0 && target.state === 'hitstun');
    const hits = f.hitsLanded;
    frames(g, 4);
    assert.equal(f.hitsLanded, hits, 'same hit group applied repeatedly during hitstop');
    const miss = game(); miss.fighters[0].facing = -1; miss.fighters[1].x = 200;
    tick(miss, ['KeyH']); frames(miss, 60);
    assert.equal(miss.fighters[1].dmgTaken, 0);
  });

  for (const c of bosses) {
    /**
     * A boss finisher has no button of its own: it *is* the neutral awakened
     * special. The route is therefore L from neutral, inside the state, and the
     * test is that the same press resolves to something different on either side
     * of it - a route that opens in both states is as broken as one that never
     * opens.
     */
    const openRoute = () => {
      const g = game(c.id); const [f, target] = g.fighters;
      f.meter = 100;
      target.x = 60;
      tick(g, [DEFAULT_BINDINGS.awaken[0]]);
      assert.equal(f.moveKey, 'naw');
      // The transformation cuts, so on a hit it spends hitstop frames and runs
      // long. Wait for the body to be free rather than guessing a frame count.
      until(g, () => f.moveKey === null, 240);
      assert.ok(f.awakened, 'the Awakening did not open for the boss route');
      return g;
    };
    test(`boss ${c.id}: the finisher is the awakened special, and the K K route still exists`, () => {
      assert.equal(c.moves.nfu, c.moves.boss_finisher, `${c.id}: the finisher is not filed as the awakened special`);
      assert.equal(c.moves.nwh.chains.special, 'nfu', `${c.id}: the awakened heavy does not lead into the finisher`);
      assert.equal(c.moves.nsig.chains.heavy, 'boss_heavy2', `${c.id}: the K K confirm is gone`);

      // Sealed: L from neutral is the base special, never the finisher.
      const shut = game(c.id); const [sf, st] = shut.fighters;
      st.x = 60;
      assert.equal(sf.moveKey, null);
      tick(shut, [DEFAULT_BINDINGS.special[0]]);
      assert.equal(sf.moveKey, 'nspec', `${c.id}: the sealed special is not the base special`);
      assert.notEqual(sf.moveKey, 'boss_finisher', 'the finisher opened with the Awakening sealed');

      // Open: the same press is the finisher.
      const g = openRoute();
      const [f, target] = g.fighters;
      Object.assign(target, { x: 60, damage: 0, invuln: 0, state: 'idle', hitstun: 0 });
      const prior = target.dmgTaken;
      tick(g, [DEFAULT_BINDINGS.special[0]]);
      assert.equal(f.moveKey, 'nfu', `${c.id}: the awakened special is not the finisher`);
      assert.equal(f.move, c.moves.boss_finisher, `${c.id}: the finisher installed under another key`);
      until(g, () => target.dmgTaken > prior);
      assert.ok(f.recentMoves.some(m => m.key === 'nfu'));

      // The awakened heavy leads into it, so the climax is still a route.
      const h = openRoute();
      const [hf, ht] = h.fighters;
      Object.assign(ht, { x: 60, damage: 0, invuln: 0, state: 'idle', hitstun: 0 });
      tick(h, [DEFAULT_BINDINGS.heavy[0]]);
      assert.equal(hf.moveKey, 'nwh', `${c.id}: neutral K while Awakened is not the awakened heavy`);
      const w = hf.move.chains.window;
      until(h, () => hf.moveKey === 'nwh' && hf.hitstop === 0 && hf.moveFrame >= w[0] + 1 && hf.moveFrame <= w[1] - 1);
      tick(h, [DEFAULT_BINDINGS.special[0]]);
      assert.equal(hf.moveKey, 'nfu', `${c.id}: the awakened heavy did not lead into the finisher`);
    });
    test(`boss ${c.id}: the K K confirm needs a landed heavy and a fresh press`, () => {
      // Whiffing the opener never reaches the second heavy.
      const g = game(c.id); const [f, target] = g.fighters;
      target.x = 1700;
      tick(g, [DEFAULT_BINDINGS.heavy[0]]); frames(g, 8);
      tick(g, [DEFAULT_BINDINGS.heavy[0]]); frames(g, 8);
      tick(g, [DEFAULT_BINDINGS.special[0]]); frames(g, 70);
      assert.equal(target.dmgTaken, 0);
      assert.ok(!f.recentMoves.some(m => ['boss_heavy2', 'boss_finisher'].includes(m.key)), 'whiff entered hit-confirm chain');
      // A held button is not a fresh edge.
      const held = game(c.id); const a = held.fighters[0]; held.fighters[1].x = 60;
      frames(held, 120, [DEFAULT_BINDINGS.heavy[0]]);
      assert.ok(a.hitsLanded > 0);
      assert.ok(!a.recentMoves.some(m => m.key === 'boss_heavy2'), 'held button repeated without fresh edge');
      // Landed: K then K reaches the boss-only second heavy.
      const hit = game(c.id); const [hf, ht] = hit.fighters;
      ht.x = 60;
      tick(hit, [DEFAULT_BINDINGS.heavy[0]]);
      assert.equal(hf.moveKey, 'nsig');
      until(hit, () => hf.hitsLanded > hf.moveHitStart && hf.hitstop === 0 && hf.moveFrame >= hf.move.chains.window[0] - 1);
      tick(hit, [DEFAULT_BINDINGS.heavy[0]]);
      assert.equal(hf.moveKey, 'boss_heavy2', `${c.id}: a landed heavy did not confirm into the second K`);
    });
    // Every attack button resolves to a different move in the air, in both states.
    for (const [label, keys, expected] of [
      ['air K, sealed', [DEFAULT_BINDINGS.heavy[0]], 'aig'],
      ['air L, sealed', [DEFAULT_BINDINGS.special[0]], null],
      ['air J, Awakened', [DEFAULT_BINDINGS.light[0]], 'awl'],
      ['air K, Awakened', [DEFAULT_BINDINGS.heavy[0]], 'awh'],
      ['air L, Awakened', [DEFAULT_BINDINGS.special[0]], 'afu'],
    ]) {
      test(`boss ${c.id}: ${label} routes to ${expected || 'the aerial special'}`, () => {
        const g = game(c.id); const f = g.fighters[0]; air(f);
        if (label.includes('Awakened')) { f.meter = 100; tick(g, [DEFAULT_BINDINGS.awaken[0]]); frames(g, 40); air(f); assert.ok(f.awakened); }
        tick(g, keys);
        if (expected) {
          assert.equal(f.moveKey, expected);
          if (expected === 'awh' || expected === 'nwh' || expected === 'afu') assert.ok(f.cds[expected] > 0, `${expected} spent no cooldown`);
        } else {
          assert.ok(f.moveKey === 'aspec' || f.moveKey === 'nspec', `unexpected aerial special: ${f.moveKey}`);
        }
        render(g);
      });
    }
    for (const [label, keys, expected] of [['up K', ['KeyW', 'KeyK'], 'rec'], ['down K', ['KeyS', 'KeyK'], 'gp']]) {
      test(`boss ${c.id}: ${label} routes to ${expected}`, () => {
        const g = game(c.id); const f = g.fighters[0]; air(f);
        tick(g, keys); assert.equal(f.moveKey, expected);
        if (expected === 'rec') assert.equal(f.recoveryUsed, true);
        render(g);
      });
    }
  }

  function custom(overrides = {}, fighterOverrides = []) {
    return game('levi', { mode: 'custom', rule: 'stock', cpus: [{ char: 'asta', diff: 'hard' }, { char: 'goku', diff: 'hard' }, { char: 'naruto', diff: 'hard' }],
      custom: { teams: true, friendlyFire: false, damageMode: 'percent', health: 200, damage: 1, knockback: 1,
        fighters: [0, 0, 1, 1].map((team, i) => ({ team, damage: 1, knockback: 1, ...fighterOverrides[i] })), ...overrides } });
  }
  const hit = { dmg: 10, ang: 0, kb: 8, sc: 0, fx: 'blunt' };
  const deal = (g, from, to, h = hit, force = false) => g.applyHit(from, to, h, 1, to.x, to.cy, force);

  test('custom: teammates cannot receive direct or forced damage', () => {
    const g = custom(); const [a, ally, enemy] = g.fighters;
    assert.equal(deal(g, a, ally), false); assert.equal(deal(g, a, ally, hit, true), false);
    assert.equal(ally.damage, 0); assert.equal(ally.dmgTaken, 0); assert.equal(a.hitsLanded, 0);
    assert.equal(deal(g, a, enemy), true); assert.equal(enemy.damage, 10);
  });
  test('custom: melee collision skips teammates but hits opponents', () => {
    const g = custom(); const [a, ally, enemy, other] = g.fighters;
    ally.x = enemy.x = 55; other.x = 1500;
    tick(g, ['KeyH']); until(g, () => enemy.dmgTaken > 0);
    assert.equal(ally.dmgTaken, 0); assert.ok(a.hitsLanded > 0);
  });
  test('custom: projectile collision and expiry blast skip teammates', () => {
    const g = custom(); const [a, ally, enemy, other] = g.fighters;
    ally.x = enemy.x = 90; other.x = 1500;
    g.spawnProj({ owner: a, type: 'fireball', x: 90, y: -40, vx: 0, vy: 0, w: 90, h: 100, life: 2, ...hit, dir: 1,
      fin: { dmg: 5, ang: 0, kb: 0, sc: 0 } });
    frames(g, 1);
    const impact = enemy.dmgTaken;
    assert.ok(impact > 0, 'the impact never landed on the enemy');
    assert.equal(ally.dmgTaken, 0);
    frames(g, 3);
    // The expiry blast is the second hit of a sequence, so combo scaling takes a
    // slice off it. It still has to be there: scaling is not a cut-off.
    assert.ok(enemy.dmgTaken > impact, 'the expiry blast never landed on the enemy');
    assert.ok(enemy.dmgTaken <= impact + 5, 'the expiry blast ignored combo scaling');
    assert.equal(ally.dmgTaken, 0, 'a teammate was hit by the blast');
  });
  test('custom: nearestEnemy and real AI targeting ignore closer allies', () => {
    const g = custom(); const [player, ally, enemy, other] = g.fighters;
    player.x = 0; ally.x = 10; enemy.x = 300; other.x = 700;
    assert.equal(g.nearestEnemy(player), enemy);
    const ai = new AI(ally, 'hard'); ai.think(g); assert.equal(ai.target, enemy);
    enemy.eliminated = true; ai.think(g); assert.equal(ai.target, other, 'AI did not retarget eliminated enemy');
  });
  test('custom: friendly fire opt-in and free-for-all retain damage', () => {
    for (const settings of [{ friendlyFire: true }, { teams: false }]) {
      const g = custom(settings); const [a, ally] = g.fighters;
      assert.equal(deal(g, a, ally), true); assert.equal(ally.damage, 10);
      assert.equal(g.nearestEnemy(a), settings.teams === false ? ally : g.fighters[2]);
    }
  });
  test('custom: global and attacker damage/knockback multipliers compose', () => {
    const base = custom(); const boosted = custom({ damage: 1.5, knockback: 0.5 }, [{ damage: 2, knockback: 3 }]);
    deal(base, base.fighters[0], base.fighters[2]); deal(boosted, boosted.fighters[0], boosted.fighters[2]);
    close(boosted.fighters[2].dmgTaken, 30, 'stacked outgoing damage');
    close(boosted.fighters[0].dmgDealt, 30, 'damage statistics');
    close(boosted.fighters[2].vx, base.fighters[2].vx * 1.5, 'stacked knockback with zero scaling');
  });
  test('custom: zero knockback disables launch including pulling hits', () => {
    for (const pull of [false, true]) {
      const g = custom({ knockback: 0 }); const [a, , enemy] = g.fighters;
      deal(g, a, enemy, { ...hit, pull });
      assert.equal(enemy.dmgTaken, 10); close(enemy.vx, 0, 'zero horizontal knockback'); close(enemy.vy, 0, 'zero vertical knockback');
    }
  });
  test('custom: stamina health override, lethal KO, automatic respawn', () => {
    const g = custom({ damageMode: 'stamina', health: 150 }, [{ health: 90 }, {}, { health: 30 }]);
    const [a, ally, enemy] = g.fighters;
    assert.equal(g.health.get(a)?.current, 90); assert.equal(g.health.get(ally)?.current, 150); assert.equal(g.health.get(enemy)?.current, 30);
    deal(g, a, enemy); assert.equal(g.health.get(enemy)?.current, 20);
    deal(g, a, enemy, { ...hit, dmg: 25 }); tick(g);
    assert.equal(enemy.state, 'ko'); assert.equal(enemy.stocks, 2); assert.equal(a.kos, 1);
    until(g, () => enemy.alive, 160);
    assert.equal(g.health.get(enemy)?.current, 30); assert.equal(enemy.damage, 0); assert.ok(enemy.invuln > 0);
    assert.equal(enemy.lastHitBy, null);
    assert.equal(enemy.moveKey, null, 'respawn retained stale move identity');
  });
  test('custom: stock victory requires elimination of all opposing teammates', () => {
    const g = custom(); const [player, ally, enemy, other] = g.fighters;
    enemy.stocks = other.stocks = 1;
    g.ko(enemy); tick(g); assert.equal(g.ended, false);
    g.ko(other); tick(g); assert.equal(g.ended, true, 'two surviving allies should end the match');
    const result = g.results();
    assert.equal(result.teams, true); assert.equal(result.playerWon, true);
    assert.equal(result.fighters.find(f => f.label === player.label).place, 1);
    assert.equal(result.fighters.find(f => f.label === ally.label).place, 1);
  });
  test('custom: eliminated P1 still wins when surviving teammate wins', () => {
    const g = custom(); const [player, , enemy, other] = g.fighters;
    for (const f of [player, enemy, other]) { f.stocks = 1; g.ko(f); }
    tick(g); assert.equal(g.ended, true); assert.equal(g.results().playerWon, true);
  });
  test('custom: timed score aggregates teams and equal scores produce draw', () => {
    const g = custom(); g.cfg.rule = 'timed'; g.timeLeft = 1;
    [4, -1, 2, 0].forEach((score, i) => { g.fighters[i].score = score; });
    tick(g); assert.equal(g.ended, true);
    assert.equal(g.results().playerWon, true);
    assert.equal(g.results().teamResults.find(t => t.team === 0).score, 3);
    // Completed results are intentionally immutable; exercise a second real match for a tie.
    const tieGame = custom(); tieGame.cfg.rule = 'timed'; tieGame.timeLeft = 1;
    [4, -1, 2, 1].forEach((score, i) => { tieGame.fighters[i].score = score; }); tick(tieGame);
    const tied = tieGame.results(); assert.equal(tied.draw, true); assert.equal(tied.playerWon, false);
  });

  for (const boss of ['sukuna', 'gojo']) {
    test(`boss ${boss}: the finisher is spent with the whole awakened special tier`, () => {
      const g = game(boss), f = g.fighters[0];
      assert.equal(f.def.moves.nfu, f.def.moves.boss_finisher, `${boss}: finisher and awakened special diverged`);
      f.meter = 100; g.fighters[1].x = 60;
      tick(g, [DEFAULT_BINDINGS.awaken[0]]);
      until(g, () => f.moveKey === null, 240);
      assert.ok(f.awakened);
      tick(g, [DEFAULT_BINDINGS.special[0]]);
      assert.equal(f.moveKey, 'nfu');
      for (const key of ['nfu', 'sfu', 'dfu', 'afu']) {
        assert.ok(f.cds[key] > 0, `${key} cooldown absent`);
      }
      // One finisher spends the tier, so the other three awakened specials are
      // refused on the same button in every stance.
      f.endMove();
      for (const [label, keys] of [['neutral', []], ['side', ['KeyD']], ['down', ['KeyS']]]) {
        tick(g, [...keys, DEFAULT_BINDINGS.special[0]]);
        assert.equal(f.moveKey, null, `${boss}: an awakened ${label} special started while the tier was spent`);
      }
    });
    test(`boss ${boss}: character-builder clone retains combo nodes`, () => {
      const clone = buildCustom({ ...newCustomCfg(), style: boss });
      for (const m of Object.values(clone.moves)) for (const action of buttons) {
        if (m.chains?.[action]) assert.ok(clone.moves[m.chains[action]], `clone missing ${m.chains[action]}`);
      }
    });
    test(`preview ${boss}: awakened heavy chains into the finisher, and the awakened special is it`, () => {
      for (const action of ['heavy', 'awaken', 'awakened']) {
        const g = new Game(browser.canvas(), { mode: 'training', rule: 'training', stocks: 1, time: 0, arena: 'rooftops', player: boss, cpus: [] }, { bindings: DEFAULT_BINDINGS, tapJump: false, preview: boss });
        g.fighters[0].meter = 100;
        g.queuePreview({ action, stance: 'neutral', followup: true });
        frames(g, 155);
        const keys = g.fighters[0].recentMoves.map(m => m.key);
        if (action === 'awaken') assert.ok(keys.includes('nfu'), `R -> L never reached the awakened special: ${keys}`);
        if (action === 'awakened') assert.ok(keys.includes('nfu'), `the awakened special is not the finisher: ${keys}`);
        if (action === 'heavy') assert.ok(keys.includes('boss_heavy2'), `K -> K never reached the second heavy: ${keys}`);
        render(g);
      }
    });
  }
  test('custom: zero knockback also disables Blue and Red field forces', () => {
    for (const sig of ['blueOrb', 'redBlast']) {
      const g = custom({ knockback: 0 }), [owner, , enemy] = g.fighters;
      enemy.x = 90; enemy.y = 0;
      g.spawnProj({ owner, type: 'sig', sig, x: 60, y: -40, w: 150, h: 150, vx: 0, vy: 0, life: 20, delay: 1, dmg: 1, ang: 45, kb: 4, sc: 0, dir: 1 });
      tick(g); close(enemy.vx, 0, `${sig} field horizontal force`); close(enemy.vy, 0, `${sig} field vertical force`);
    }
  });
  for (const c of CHARACTERS) test(`flight ${c.id}: mashing aerial moves cannot keep a fighter airborne forever`, () => {
    const g = game(c.id), f = g.fighters[0];
    air(f); f.y = -600; let started = 0, lastKey = null, lastFrame = -1;
    const combos = [['light'], ['heavy'], ['special'], ['awaken'], ['light', 'up'], ['heavy', 'up'], ['special', 'up'], ['special', 'right'], ['heavy', 'right'], ['light', 'right'], ['awaken', 'up'], ['awaken', 'down'], ['awaken', 'right'], ['awaken'], ['awaken', 'up']];
    let landedAt = -1;
    for (let i = 0; i < 420 && landedAt < 0; i++) {
      // A different button every frame, so each press is a fresh edge: the fastest possible masher.
      tick(g, combos[i % combos.length].map(b => DEFAULT_BINDINGS[b][0]));
      if (f.moveKey && (f.moveKey !== lastKey || f.moveFrame < lastFrame)) started++;
      lastKey = f.moveKey; lastFrame = f.moveFrame;
      f.meter = 100; g.infiniteMeter = true; f.invuln = 0; if (i < 600) f.awakened = true; // the Awakening is the worst case
      if (f.grounded) landedAt = i;
    }
    if (process.env.FLIGHT_DEBUG) console.log(c.id, landedAt, started, f.recentMoves.map(r => r.key).join(","));
    assert.ok(landedAt >= 0, `${c.id} stayed airborne for 7s from mashing (y=${f.y.toFixed(0)}, move=${f.moveKey})`);
  });
  // ===========================================================================
  // TIME STOP (Shadow DIO · Za Warudo)
  // ===========================================================================
  function timeStopGame() {
    const g = game('shadowdio');
    const [dio, foe] = g.fighters;
    foe.x = 60; foe.y = 0; foe.grounded = true;
    dio.meter = 100; dio.invuln = 0;
    g.infiniteMeter = false;
    return g;
  }
  const activateTimeStop = (g) => {
    // Za Warudo is a retained set-piece: it is his neutral awakened special, and
    // the Awakening is what pays for it, so the route is R and then L. The dummy
    // is parked out of reach for the transformation, which cuts, so the stop is
    // the only thing that has touched it by the time this returns.
    const dio = g.fighters[0], foe = g.fighters[1];
    foe.x = dio.x + 700; foe.dmgTaken = 0; foe.damage = 0;
    tick(g, [DEFAULT_BINDINGS.awaken[0]]);
    until(g, () => dio.moveKey === null, 300);
    assert.ok(dio.awakened, 'the Awakening did not open for Za Warudo');
    foe.x = dio.x + 60; foe.invuln = 0;
    tick(g, [DEFAULT_BINDINGS.special[0]]);
    assert.equal(dio.moveKey, 'nfu', 'L while Awakened is not Za Warudo');
    for (let i = 0; i < 200 && !g.timeStop.active; i++) tick(g);
    assert.ok(g.timeStop.active, 'time stop never activated from the awakened special');
    foe.dmgTaken = 0; foe.damage = 0;
  };

  test('timestop: activates from the awakened special and suspends everyone but the caster', () => {
    const g = timeStopGame();
    assert.equal(g.timeStop.active, false);
    activateTimeStop(g);
    assert.equal(g.timeStop.owner, g.fighters[0]);
    assert.equal(g.fighters[1].frozen, true);
    assert.equal(g.fighters[0].frozen, false);
    assert.equal(g.timeStop.radius, 0, 'wave front must start at the caster');
    for (let i = 0; i < 30; i++) tick(g);
    assert.ok(g.timeStop.radius > 100, 'wave front must expand from the caster');
  });

  test('timestop: a frozen fighter does not move, attack or decay', () => {
    const g = timeStopGame();
    activateTimeStop(g);
    const foe = g.fighters[1];
    foe.vx = 6; foe.vy = -5; foe.state = 'air';
    const x0 = foe.x, y0 = foe.y;
    foe.hitstun = 30; foe.state = 'hitstun'; foe.hitstun = 30;
    const stun0 = foe.hitstun;
    g.ais.get(foe).think = () => { throw new Error('AI ran while frozen'); };
    for (let i = 0; i < 40; i++) tick(g);
    assert.equal(foe.x, x0, 'frozen fighter drifted horizontally');
    assert.equal(foe.y, y0, 'frozen fighter drifted vertically');
    assert.equal(foe.hitstun, stun0, 'frozen hitstun decayed');
  });

  test('timestop: damage during the stop is accumulated, not applied, then released at once', () => {
    const g = timeStopGame();
    activateTimeStop(g);
    const [dio, foe] = g.fighters;
    const dealt = () => foe.dmgTaken;
    assert.equal(dealt(), 0, 'foe took damage before the stop began');
    // Five separate real hits while time is frozen.
    for (let n = 0; n < 5; n++) {
      foe.x = dio.x + 40; foe.invuln = 0;
      dio.startMove('nlight', g);
      for (let i = 0; i < 16 && dio.moveKey === 'nlight'; i++) tick(g);
      assert.equal(dealt(), 0, `damage leaked out on hit ${n + 1}`);
    }
    assert.equal(foe.vx, 0, 'knockback applied while time was stopped');
    assert.ok(g.pendingDamageLength() >= 5, `expected >=5 queued events, got ${g.pendingDamageLength()}`);
    // Resume: every queued blow lands in the same frame.
    g.endTimeStop();
    assert.ok(dealt() > 0, 'accumulated damage was never released');
    assert.ok(foe.vx !== 0 || foe.state === 'hitstun', 'knockback never applied on resume');
    assert.equal(g.timeStop.active, false);
  });

  test('timestop: expires after five real seconds and restores everything', () => {
    const g = timeStopGame();
    activateTimeStop(g);
    assert.equal(g.timeStop.realLeft, 5000);
    let elapsed = 0;
    for (let i = 0; i < 600 && g.timeStop.active; i++) { tick(g); elapsed++; }
    assert.equal(g.timeStop.active, false, 'time stop never ended');
    // The five-second clock only starts once the caster is free to move, so the
    // whole stop is his activation plus 5.0 s (300 steps at a fixed 1/60 s step).
    assert.ok(elapsed > 295 && elapsed < 340, `time stop ran for ${elapsed} steps (~${(elapsed / 60).toFixed(2)}s)`);
    assert.ok(g.timeStop.resumeFx > 0, 'resume transition did not start');
    for (const f of g.fighters) assert.equal(f.frozen, false, `${f.def.id} left frozen`);
  });

  test('timestop: projectiles in the world freeze and resume from the same position', () => {
    const g = timeStopGame();
    const [dio, foe] = g.fighters;
    foe.x = 400; foe.y = 0;
    activateTimeStop(g);
    g.spawnProj({ owner: dio, type: 'sig', sig: 'dioKnife', x: dio.x + 60, y: dio.y - 46, vx: 14, vy: 0, w: 40, h: 40, life: 120, dmg: 3, ang: 30, kb: 2, sc: 1, fx: 'blunt', dir: 1 });
    const p = g.projectiles[g.projectiles.length - 1];
    const x0 = p.x, t0 = p.t, life0 = p.life;
    for (let i = 0; i < 60; i++) tick(g);
    assert.equal(p.x, x0, 'frozen projectile moved');
    assert.equal(p.t, t0, 'frozen projectile aged');
    assert.equal(p.life, life0, 'frozen projectile lost lifetime');
    // A projectile created *during* the stop also hangs.
    g.spawnProj({ owner: dio, type: 'sig', sig: 'dioKnife', x: dio.x + 120, y: dio.y - 46, vx: 14, vy: 0, w: 40, h: 40, life: 120, dmg: 3, ang: 30, kb: 2, sc: 1, fx: 'blunt', dir: 1 });
    const q = g.projectiles[g.projectiles.length - 1];
    const qx = q.x;
    for (let i = 0; i < 30; i++) tick(g);
    assert.equal(q.x, qx, 'projectile created during the stop moved');
    g.endTimeStop();
    for (let i = 0; i < 10; i++) tick(g);
    assert.ok(p.x > x0, 'frozen projectile never resumed moving');
  });

  test('timestop: a second activation is refused while one is running', () => {
    const g = timeStopGame();
    activateTimeStop(g);
    const started = g.timeStop.age;
    assert.equal(g.startTimeStop(g.fighters[1]), false, 'overlapping time stop was allowed');
    for (let i = 0; i < 20; i++) tick(g);
    assert.equal(g.timeStop.owner, g.fighters[0], 'ownership changed on a refused activation');
    assert.ok(g.timeStop.age > started, 'simulation halted during time stop');
  });

  test('timestop: match end and stop() both clear the suspension', () => {
    const ending = timeStopGame();
    activateTimeStop(ending);
    ending.endMatch();
    assert.equal(ending.timeStop.active, false, 'ended match left the world frozen');
    const quitting = timeStopGame();
    activateTimeStop(quitting);
    quitting.stop();
    assert.equal(quitting.timeStop.active, false, 'quit match left the world frozen');
    for (const f of quitting.fighters) assert.equal(f.frozen, false);
  });

  test('timestop: pausing holds the countdown and pausing does not end the stop', () => {
    const g = timeStopGame();
    activateTimeStop(g);
    g.setPaused(true);
    for (let i = 0; i < 300; i++) g.advanceRealTime(16.7);
    assert.equal(g.timeStop.active, true, 'paused match drained the time stop budget');
    g.setPaused(false);
    assert.equal(g.timeStop.realLeft, 5000);
  });

  test('timestop: queued damage never feeds the caster Awakening gauge', () => {
    const g = timeStopGame();
    const [dio, foe] = g.fighters;
    activateTimeStop(g);
    assert.ok(dio.meter < 100, 'the Awakening did not spend the gauge');
    for (let n = 0; n < 3; n++) {
      foe.x = dio.x + 40; foe.invuln = 0;
      dio.startMove('nlight', g);
      for (let i = 0; i < 16 && dio.moveKey === 'nlight'; i++) tick(g);
    }
    const before = dio.meter;
    g.endTimeStop();
    assert.ok(foe.dmgTaken > 0, 'queued damage never released');
    // The release lands three hits at once. If they fed the gauge the number
    // would jump; nothing ticks in between, so it has to be exactly unchanged.
    assert.equal(dio.meter, before, `released time-stop damage granted ${(dio.meter - before).toFixed(2)} gauge`);
  });

  test('timestop: an interrupted time stop never starts one', () => {
    const g = timeStopGame();
    const [dio] = g.fighters;
    dio.meter = 100;
    dio.awakened = true; dio.startMove('nfu', g);
    for (let i = 0; i < 6; i++) tick(g);
    // Interrupt the startup the way a real hit would.
    dio.state = 'hitstun'; dio.move = null; dio.moveKey = null;
    for (let i = 0; i < 80; i++) tick(g);
    assert.equal(g.timeStop.active, false, 'an interrupted time stop still started one');
  });

  test('timestop: losing the caster mid-stop releases the queue and unfreezes the world', () => {
    const g = timeStopGame();
    const [dio, foe] = g.fighters;
    activateTimeStop(g);
    foe.x = dio.x + 40; foe.invuln = 0;
    dio.startMove('nlight', g);
    for (let i = 0; i < 16 && dio.moveKey === 'nlight'; i++) tick(g);
    assert.ok(g.pendingDamageLength() > 0, 'no damage was queued');
    const prior = foe.dmgTaken;
    g.ko(dio);
    assert.equal(g.timeStop.active, false, 'a dead caster left the world frozen');
    assert.equal(g.pendingDamageLength(), 0, 'queued damage was dropped instead of released');
    assert.ok(foe.dmgTaken > prior, 'queued damage was not released on the caster KO');
    for (const f of g.fighters) assert.equal(f.frozen, false, `${f.def.id} left frozen after the caster fell`);
  });

  // ===========================================================================
  // THE AWAKENING GAUGE
  // ===========================================================================
  test('gauge: an Awakening never feeds its own gauge', () => {
    const g = game('levi');
    const [a, b] = g.fighters;
    a.meter = 0; a.startMove('naw', g);
    assert.ok(g.meterLocked(a), 'the transformation did not lock the gauge');
    assert.ok(a.awakened, 'the transformation did not open the state');
    a.endMove();
    a.meter = 0; a.awakened = true; a.startMove('nfu', g);
    assert.ok(g.meterLocked(a), 'the awakened special did not lock the gauge');
    a.endAwaken();
    a.meter = 0; a.awakened = true; a.startMove('nwh', g);
    assert.ok(g.meterLocked(a), 'the awakened heavy did not lock the gauge');
    a.endAwaken();
    a.meter = 0; a.awakened = true; a.startMove('nwl', g);
    assert.ok(g.meterLocked(a), 'the awakened light did not lock the gauge');
    a.endAwaken();
    // The seal is a few frames of tail, not a new rule: an ordinary attack is
    // gauge-earning again almost immediately.
    a.awakenSealedT = 0;
    a.meter = 0; a.startMove('nlight', g);
    assert.equal(g.meterLocked(a), false, 'a normal attack was wrongly locked');
    a.meter = 0; deal(g, a, b); assert.ok(a.meter > 0, 'a normal attack gave no gauge');
  });

  test('gauge: a lingering set-piece projectile stays barred after the animation ends', () => {
    const g = game('sukuna');
    const [a, b] = g.fighters;
    a.meter = 0; a.startMove('dfu', g);
    g.spawnProj({ owner: a, type: 'sig', sig: 'sukunaShrine', x: b.x, y: b.y - 40, vx: 0, vy: 0, w: 400, h: 300, life: 90, dmg: 2, ang: 70, kb: 1, sc: 0, fx: 'dark', dir: 1 });
    const p = g.projectiles[g.projectiles.length - 1];
    assert.equal(p.ultLocked, true, 'projectile spawned by a set-piece is not locked');
    a.endMove(); a.meter = 0;
    // The very same blow arriving after the animation finished, carried by the
    // projectile's own lock, must still not grant gauge.
    g.applyHit(a, b, { dmg: 10, ang: 0, kb: 5, sc: 0, fx: 'dark', ultLocked: p.ultLocked }, 1, b.x, b.cy, false, { x: 0, y: 0, vx: 0, vy: 0, noMeter: p.ultLocked });
    assert.equal(a.meter, 0, 'delayed set-piece damage still granted gauge');
    // A normal attack outside the Awakening still builds gauge as before.
    a.meter = 0; a.endAwaken(); a.startMove('nlight', g);
    g.applyHit(a, b, { dmg: 10, ang: 0, kb: 5, sc: 0, fx: 'slash' }, 1, b.x, b.cy);
    assert.ok(a.meter > 0, 'normal attacks stopped granting gauge');
  });

  test('gauge: filling it takes a real exchange, and dealing beats taking', () => {
    const g = game('levi'); g.infiniteMeter = false;
    const [a, b] = g.fighters;
    // One hundred points of damage dealt is a quarter of the bar: a full gauge is
    // a quarter of a stock at full aggression, not a formality.
    a.meter = 0; b.meter = 0;
    g.applyHit(a, b, { dmg: 100, ang: 0, kb: 0, sc: 0, fx: 'slash' }, 1, b.x, b.cy);
    close(a.meter, 24, 'gauge for damage dealt');
    close(b.meter, 13, 'gauge for damage taken');
    // So the cheapest possible route to the Awakening is a real exchange: it takes
    // four hundred points of damage dealt, or seven hundred taken.
    assert.ok(100 / (a.meter / 100) > 400, `a full gauge only needs ${(100 / (a.meter / 100)).toFixed(0)} damage dealt`);
    assert.ok(100 / (b.meter / 100) > 700, `being beaten to a full gauge only needs ${(100 / (b.meter / 100)).toFixed(0)} damage taken`);
  });

  test('awakening: the gauge drains to zero on its own and hands the base kit back', () => {
    const g = game('levi'); g.infiniteMeter = false;
    const [f, target] = g.fighters;
    target.x = 900;
    f.meter = 100;
    tick(g, [DEFAULT_BINDINGS.awaken[0]]);
    until(g, () => f.moveKey === null, 300);
    assert.ok(f.awakened, 'a full gauge did not open the Awakening');
    const start = f.meter;
    // Thirty seconds of gauge, spent whether or not it is being used.
    let frames = 0;
    while (f.awakened && frames < 2400) { tick(g); frames++; }
    assert.equal(f.awakened, false, `the Awakening was still open after ${frames} frames`);
    assert.equal(f.meter, 0, `the gauge ended at ${f.meter}`);
    assert.ok(frames > 1500 && frames < 2100, `one Awakening lasted ${(frames / 60).toFixed(1)}s`);
    assert.ok(start < 100, 'the gauge was not clamped below full on entry');
    // And the buttons point at the base moveset again.
    tick(g, [DEFAULT_BINDINGS.heavy[0]]);
    assert.equal(f.moveKey, 'nlight_heavy' in f.def.moves ? f.moveKey : 'nlight_heavy');
  });

  test('awakening: a knockout ends the state but keeps the gauge', () => {
    const g = game('levi');
    const [f] = g.fighters;
    f.meter = 100;
    tick(g, [DEFAULT_BINDINGS.awaken[0]]);
    until(g, () => f.moveKey === null, 300);
    assert.ok(f.awakened);
    frames(g, 120);
    const left = f.meter;
    assert.ok(left > 0 && left < 100, `unexpected gauge before the knockout: ${left}`);
    g.ko(f);
    assert.equal(f.awakened, false, 'the state survived a knockout');
    close(f.meter, left, 'gauge kept through the knockout');
    g.respawn(f);
    close(f.meter, left, 'gauge kept through the respawn');
    assert.equal(f.awakened, false, 'respawn handed the state straight back');
    // Banked charge that was never spent survives a knockout too.
    f.meter = 63; g.ko(f); g.respawn(f);
    close(f.meter, 63, 'banked charge kept through a knockout');
    // Nothing is left on cooldown either: the next stock starts clean.
    for (const key of ['naw', 'nfu', 'nwh', 'nwl']) assert.equal(f.cds[key], 0, `${key} survived the knockout`);
  });

  test('awakening: the blow that empties the gauge cannot refill it', () => {
    const g = game('levi');
    const [a, b] = g.fighters;
    a.meter = 0.05; a.awakened = true;
    b.damage = 20; b.grounded = false;
    // The state closes inside the fighter's update; the hit lands after it.
    tick(g);
    assert.equal(a.awakened, false, 'an empty gauge did not close the Awakening');
    assert.equal(a.meter, 0, `the closing blow refilled ${a.meter} of gauge`);
    a.startMove('nlight', g);
    b.invuln = 0;
    g.applyHit(a, b, { dmg: 20, ang: 0, kb: 0, sc: 0, fx: 'slash' }, 1, b.x, b.cy);
    assert.equal(a.meter, 0, 'the frame after the Awakening closed still paid for itself');
    // A third of a second later it is an ordinary exchange again.
    frames(g, 40);
    a.startMove('nlight', g);
    g.applyHit(a, b, { dmg: 20, ang: 0, kb: 0, sc: 0, fx: 'slash' }, 1, b.x, b.cy);
    assert.ok(a.meter > 0, 'the seal outlived the Awakening by too long');
  });

  // ===========================================================================
  // THE COMBAT MODEL: scaling, juggle budget, launch decay
  // ===========================================================================
  test('combat: every hit after the first in a string is worth less, and never nothing', () => {
    const g = game('levi');
    const [a, b] = g.fighters;
    a.startMove('nlight', g);
    const blow = { dmg: 10, ang: 0, kb: 4, sc: 0, fx: 'slash' };
    const dealt = [];
    for (let i = 0; i < 10; i++) {
      const before = b.dmgTaken;
      g.applyHit(a, b, blow, 1, b.x, b.cy);
      dealt.push(+(b.dmgTaken - before).toFixed(3));
    }
    close(dealt[0], 10, 'the first hit of a string');
    for (let i = 1; i < dealt.length; i++) {
      assert.ok(dealt[i] <= dealt[i - 1], `hit ${i + 1} was worth more than hit ${i}: ${dealt.join(', ')}`);
      assert.ok(dealt[i] > 10 * 0.3, `hit ${i + 1} fell off a cliff: ${dealt[i]}`);
    }
    assert.ok(dealt[8] < dealt[1], 'the tail of a string was not discounted at all');
    // A ten-hit mash is worth about half its face value, not ten times one hit.
    const total = dealt.reduce((s, d) => s + d, 0);
    assert.ok(total < 80, `a ten-hit string was not scaled (${total})`);
    assert.ok(total > 40, `a ten-hit string was scaled into nothing (${total})`);
  });

  test('combat: the juggle budget runs out and a launcher stops launching', () => {
    const g = game('levi');
    const [a, b] = g.fighters;
    a.startMove('nsig', g);
    b.damage = 20;
    const launch = { dmg: 8, ang: 80, kb: 9, sc: 4, fx: 'slash' };
    const rises = [];
    for (let i = 0; i < 6; i++) {
      b.grounded = false;
      const before = b.vy;
      g.applyHit(a, b, launch, 1, b.x, b.cy);
      rises.push(+b.vy.toFixed(2));
      // Never higher than the last one: a spent juggle cannot be topped up.
      if (i > 0) assert.ok(b.vy >= before - 0.001, `hit ${i + 1} sent a spent juggle higher (${b.vy} < ${before})`);
    }
    // The budget is two re-launches; everything after it is a shove, not a lift.
    assert.ok(rises[0] < -3 && rises[1] < -3, `the first two launches did not lift: ${rises.join(', ')}`);
    assert.ok(rises[2] > -2, `the third launch was still a launch: ${rises.join(', ')}`);
    assert.ok(rises.slice(2).every(v => v > -2), `the juggle never stopped: ${rises.join(', ')}`);
    // Landing restores the budget, so a fresh combo can juggle again.
    b.grounded = true; b.juggleCount = 0; b.juggleLeft = 0; b.vy = 0;
    g.applyHit(a, b, launch, 1, b.x, b.cy);
    assert.equal(b.juggleLeft, 2, 'landing did not restore the juggle budget');
    assert.ok(b.vy < -3, 'the restored budget did not launch again');
  });

  // ===========================================================================
  // RECORDED AUDIO ROUTING
  // ===========================================================================
  /** Plays one move to its first active frame and reports the clip it asked for. */
  function clipFor(id, key, { airborne = false, frames = null } = {}) {
    const g = game(id);
    const f = g.fighters[0];
    if (airborne) air(f);
    f.meter = 100;
    clearClipRequests();
    f.startMove(key, g);
    const limit = frames ?? Math.max(40, f.def.moves[key].dur + 12);
    for (let i = 0; i < limit; i++) { tick(g); if (lastClipRequest()) return lastClipRequest(); }
    return lastClipRequest();
  }

  test('audio sukuna: basic slashes use the pitched basic sample', () => {
    for (const key of ['nlight', 'nlight2', 'slight', 'dlight', 'nair', 'sair']) {
      assert.equal(clipFor('sukuna', key, { airborne: key.startsWith('s') || key === 'nair' }), 'sukuna-slash', `${key} did not use the basic cleave`);
    }
  });

  test('audio sukuna: powerful slashes use the strong sample', () => {
    // Heavy damage, travelling Dismantles and every technique-class move.
    for (const key of ['nlight_spec', 'nlight_heavy', 'slight_spec', 'slight_heavy', 'dsig', 'naw', 'boss_finisher']) {
      assert.equal(clipFor('sukuna', key), 'sukuna-strong-slash', `${key} did not use the strong cleave`);
    }
  });

  test('audio sukuna: light combo starters keep the basic sample', () => {
    // A high-damage blow and a technique always escalate; a light route starter
    // that only deals single-digit damage must not pretend to be a finisher.
    for (const key of ['nsig', 'ssig']) {
      assert.equal(clipFor('sukuna', key), 'sukuna-slash', `${key} should use the basic cleave`);
    }
    // A single 10-damage finisher inside the light string still escalates.
    assert.equal(clipFor('sukuna', 'nlight3'), 'sukuna-strong-slash', 'nlight3 should use the strong cleave');
  });

  test('audio sukuna: Fuga, Domain Expansion and the KO laugh each fire their own clip', () => {
    assert.equal(clipFor('sukuna', 'aspec', { airborne: true }), 'sukuna-fuga', 'Fuga clip missing');
    assert.equal(clipFor('sukuna', 'dfu', { frames: 200 }), 'sukuna-domain', 'Domain Expansion clip missing');
    const g = game('sukuna');
    const [a, b] = g.fighters;
    a.startMove('nlight', g);
    until(g, () => a.hitsLanded > 0);
    clearClipRequests();
    g.ko(b);
    assert.equal(lastClipRequest(), 'sukuna-laugh', 'Sukuna did not laugh at his knockout');
  });

  test('audio sukuna: the KO laugh fires exactly once per knockout', () => {
    const g = game('sukuna');
    const [a, b] = g.fighters;
    a.startMove('nlight', g);
    until(g, () => a.hitsLanded > 0);
    clearClipRequests();
    g.ko(b); g.ko(b); g.ko(b);
    assert.equal(b.falls, 1, 'the same fighter was knocked out more than once');
    assert.equal(lastClipRequest(), 'sukuna-laugh', 'no laugh on the credited knockout');
    assert.equal(b.laughCueFired, true);
    // A later, separate knockout must laugh again: the guard is per fall.
    g.respawn(b);
    a.invuln = 0; b.invuln = 0; a.hitstop = 0; b.hitstop = 0; a.hitsLanded = 0;
    b.x = a.x + 40; b.y = 0; b.vx = 0; b.vy = 0; b.grounded = true; b.state = 'idle'; b.hitstun = 0;
    const prior = b.dmgTaken;
    a.startMove('nlight', g);
    until(g, () => b.dmgTaken > prior);
    assert.equal(b.lastHitBy, a, 'second hit did not credit Sukuna');
    clearClipRequests();
    g.ko(b);
    assert.equal(lastClipRequest(), 'sukuna-laugh', 'a second knockout did not laugh again');
  });

  test('audio shadowdio: Stand, Time Stop, resume and defeat clips all fire', () => {
    assert.equal(clipFor('shadowdio', 'nsig'), 'shadowdio-appear', 'Stand summon clip missing');
    assert.equal(clipFor('shadowdio', 'dsig'), 'shadowdio-appear', 'Stand summon clip missing on side heavy');
    const g = timeStopGame();
    activateTimeStop(g);
    assert.equal(lastClipRequest(), 'shadowdio-timestop', 'Time Stop clip missing');
    g.endTimeStop();
    assert.equal(lastClipRequest(), 'shadowdio-time-resume', 'time resume clip missing');
    const death = game('shadowdio');
    clearClipRequests();
    death.ko(death.fighters[0]);          // Shadow DIO himself falls
    assert.equal(lastClipRequest(), 'shadowdio-death', 'Shadow DIO death clip missing');
    death.ko(death.fighters[0]);
    assert.equal(death.fighters[0].falls, 1, 'death cue retriggered on one fall');
  });

  test('audio: characters without recorded samples keep the synthesised palette', () => {
    assert.equal(clipFor('levi', 'nlight'), null, 'Levi unexpectedly requested a recorded clip');
    assert.equal(clipFor('gojo', 'dfu', { frames: 200 }), null, 'Gojo unexpectedly requested a recorded clip');
  });

  // ===========================================================================
  // SUKUNA SLASH PRESENTATION
  // ===========================================================================
  test('sukuna slashes: every move uses the animated black cut, never the flat slash', () => {
    for (const key of Object.keys(CHARACTERS.find(c => c.id === 'sukuna').moves)) {
      const g = game('sukuna');
      const f = g.fighters[0];
      f.meter = 100;
      let flat = 0, cut = 0, staticShape = 0;
      const realSlash = g.fx.slash.bind(g.fx), realCut = g.fx.cut.bind(g.fx), realShape = g.fx.shape.bind(g.fx);
      g.fx.slash = (...a) => { flat++; return realSlash(...a); };
      g.fx.cut = (...a) => { cut++; return realCut(...a); };
      g.fx.shape = (kind, ...rest) => {
        // 'fuga' is a fire arrow silhouette, not a blade; anything else that used
        // the old cut/cleave kinds would be the removed unanimated slash.
        if (kind !== 'fuga') staticShape++;
        return realShape(kind, ...rest);
      };
      f.startMove(key, g);
      const limit = f.def.moves[key].dur + 200;
      for (let i = 0; i < limit; i++) {
        tick(g);
        if (f.moveKey !== key && g.projectiles.length === 0 && i > f.def.moves[key].dur) break;
      }
      assert.equal(flat, 0, `sukuna/${key} spawned ${flat} unanimated slash effect(s)`);
      assert.equal(staticShape, 0, `sukuna/${key} spawned ${staticShape} static slash geometry effect(s)`);
      // Moves with no visual blade beat (pure displacement) are allowed to be silent.
      void cut;
    }
  });

  test('sukuna slashes: the sweeping crescent is reserved for aerial cuts', () => {
    const countArcs = (g) => {
      const state = { n: 0 };
      const real = g.fx.arcCut.bind(g.fx);
      g.fx.arcCut = (...a) => { state.n++; return real(...a); };
      return state;
    };
    // Grounded blade work is the original animated cut only: no crescent anywhere.
    for (const key of ['nlight', 'nlight2', 'nlight3', 'slight', 'dlight', 'nsig', 'dsig']) {
      const g = game('sukuna');
      const f = g.fighters[0];
      f.meter = 100;
      const arcs = countArcs(g);
      f.startMove(key, g);
      frames(g, f.def.moves[key].dur + 40);
      assert.equal(arcs.n, 0, `grounded sukuan/${key} drew ${arcs.n} crescent(s)`);
    }
    // An airborne blade beat is the one place the crescent belongs.
    const air = game('sukuna');
    const f = air.fighters[0];
    f.startMove('nlight', air);
    frames(air, f.def.moves.nlight.dur + 10);
    Object.assign(f, { y: -420, vy: 0, grounded: false, state: 'air' });
    const arcs = countArcs(air);
    f.startMove('nair', air);
    frames(air, f.def.moves.nair.dur + 30);
    assert.ok(arcs.n > 0, 'the airborne Heavenward Backflip never drew its downward crescent');
    // The domain Dismantle storm is a grounded entity and must stay crescent-free.
    const dome = game('sukuna');
    const df = dome.fighters[0];
    df.meter = 100;
    df.startMove('dfu', dome);
    dome.cin = null;
    for (let i = 0; i < 320 && !dome.projectiles.some(p => p.sig === 'sukunaShrine'); i++) tick(dome);
    const storm = countArcs(dome);
    frames(dome, 360);
    assert.equal(storm.n, 0, `the shrine storm drew ${storm.n} crescent(s)`);
  });

  test('other fighters: the flat slash effect is still in use, so nothing was dead-coded away', () => {
    const g = game('levi');
    const f = g.fighters[0];
    let flat = 0;
    const realSlash = g.fx.slash.bind(g.fx);
    g.fx.slash = (...a) => { flat++; return realSlash(...a); };
    f.startMove('nfu', g);
    for (let i = 0; i < 140; i++) tick(g);
    assert.ok(flat > 0, 'no other fighter uses the flat slash any more');
  });

  test('sukuna shrine: the domain draws the supplied PNG, never a generated shrine', () => {
    const g = game('sukuna');
    const f = g.fighters[0];
    f.meter = 100;
    f.startMove('dfu', g);
    // The cinematic is skipped here, so step through the three-second chant until
    // the domain entity exists.
    g.cin = null;
    for (let i = 0; i < 320 && !g.projectiles.some(p => p.sig === 'sukunaShrine'); i++) tick(g);
    const p = g.projectiles.find(x => x.sig === 'sukunaShrine');
    assert.ok(p, 'Sukuna never created a shrine domain');
    let images = 0;
    const realDrawImage = g.ctx.drawImage.bind(g.ctx);
    g.ctx.drawImage = (...a) => { images++; return realDrawImage(...a); };
    p.draw(g.ctx, 10);
    p.draw(g.ctx, 40);
    g.ctx.drawImage = realDrawImage;
    assert.ok(images >= 2, `shrine never drew the supplied artwork (drawImage calls: ${images})`);
  });

  test('sukuna shrine: the domain still damages the area it covers', () => {
    const g = game('sukuna');
    const [a, b] = g.fighters;
    a.meter = 100; a.awakened = true; a.meter = 100;
    a.startMove('dfu', g);
    g.cin = null;
    // The shrine appears three seconds in; the Dismantle storm starts half a
    // second after that, when the domain becomes active.
    for (let i = 0; i < 320 && !g.projectiles.some(p => p.sig === 'sukunaShrine'); i++) tick(g);
    b.x = a.x; b.invuln = 0;
    const prior = b.dmgTaken;
    for (let i = 0; i < 120; i++) { b.x = a.x; b.invuln = 0; tick(g); }
    assert.ok(b.dmgTaken > prior, 'the shrine domain dealt no damage');
  });

  test('sukuna shrine: the domain opens on the anime beat and keeps cutting for five seconds', () => {
    const g = game('sukuna');
    const [a, b] = g.fighters;
    a.meter = 100; a.awakened = true; a.meter = 100;
    a.startMove('dfu', g);
    g.cin = null;
    const shrineFrames = [];
    const active = [];
    let footprint = null;
    b.x = a.x; b.grounded = true;
    // The sample starts on the move's startup frame; every beat below is counted
    // from there, exactly the way the chant is staged in the game.
    const cast = a.def.moves.dfu.startup;
    for (let i = 0; i < 580; i++) {
      tick(g);
      const p = g.projectiles.find(x => x.sig === 'sukunaShrine');
      if (p) { shrineFrames.push(i); if (!footprint) footprint = p; if (p.active) active.push(i); }
      b.x = a.x; b.invuln = 0;
      // The caster must stay untouchable and rooted for the whole three-second
      // chant, and only then is he released.
      if (i > 0 && i < cast + 210) {
        assert.ok(a.invuln > 0, `Sukuna was vulnerable on frame ${i}`);
        assert.ok(Math.abs(a.vx) < 0.001, `Sukuna was not rooted on frame ${i}`);
        assert.equal(a.state, 'attack', `Sukuna left the cast on frame ${i}`);
      }
    }
    assert.ok(shrineFrames.length, 'the shrine never appeared');
    // 3.0 s after the sample starts the shrine exists.
    const appearAt = shrineFrames[0] - cast + 1;
    assert.ok(appearAt >= 175 && appearAt <= 185, `shrine appeared ${appearAt} frames after the sample`);
    // ...and 3.5 s in, the domain starts cutting — half a second later.
    const activeAt = active[0] - cast + 1;
    assert.ok(activeAt >= 205 && activeAt <= 215, `domain activated ${activeAt} frames after the sample`);
    // Five real seconds of continuous Dismantle, not a 1.5 s burst.
    assert.ok(active.length >= 290, `domain only cut for ${active.length} frames`);
    assert.ok(footprint.w >= 1050 && footprint.h >= 610, `domain footprint shrank to ${footprint.w}x${footprint.h}`);
  });

  const selected = tests.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
  assert.ok(selected.length > 0, `No tests matched ${JSON.stringify(filter)}`);
  if (process.argv.includes('--list')) for (const t of selected) console.log(t.name);
  else {
    console.log(`Combat regression: ${CHARACTERS.length} fighters, ${bosses.length} boss kits, ${selected.length} checks`);
    for (const { name, fn } of selected) {
      browser.reset(); keyboard.down.clear();
      try { await fn(); passes++; console.log(`PASS ${name}`); }
      catch (error) { failures++; console.log(`FAIL ${name}\n  ${error.message.replaceAll('\n', '\n  ')}`); }
    }
    console.log(`\n${passes} passed; ${failures} failed; ${browser.draws.toLocaleString('en-US')} canvas operations. Seed: 0x5eed; step: 1/60 s.`);
    process.exitCode = failures ? 1 : 0;
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
