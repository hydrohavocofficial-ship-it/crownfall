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
  function render(g) {
    const saved = console.error;
    console.error = (...args) => { throw new Error(args.map(String).join(' ')); };
    try { g.render(); g.canvas.assertBalanced(); } finally { console.error = saved; }
  }
  const air = f => Object.assign(f, { y: -450, grounded: false, state: 'air', vx: 0, vy: 0 });
  const buttons = ['light', 'heavy', 'special', 'awaken', 'limit', 'ult'];
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
  test('boss roster integration and 44 moves each', () => {
    assert.ok(bosses.length > 0, 'bossKits.ts has not installed any boss routes');
    for (const c of bosses) assert.equal(Object.keys(c.moves).length, 44, `${c.id} move count`);
  });
  for (const c of CHARACTERS) {
    test(`roster ${c.id}: references and input-reachable moves`, () => {
      const reached = reachable(c);
      assert.deepEqual(Object.keys(c.moves).filter(key => !reached.has(key)), [], `${c.id}: unreachable move keys`);
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
          if (/^(nair|sair|dair|rec|gp|aspec|aig|aex|aaw|afu)/.test(key)) { air(f); air(target); }
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
    test(`boss ${c.id}: J J L hit-confirmed route`, () => {
      const g = game(c.id); const [f, target] = g.fighters;
      target.x = 60;
      tick(g, ['KeyJ']); assert.equal(f.moveKey, 'nsig');
      until(g, () => f.hitsLanded > f.moveHitStart && f.hitstop === 0 && f.moveFrame >= f.move.chains.window[0] - 1);
      tick(g, ['KeyJ']); assert.equal(f.moveKey, 'boss_heavy2');
      until(g, () => f.moveKey === 'boss_heavy2' && f.hitsLanded > f.moveHitStart && f.hitstop === 0 && f.moveFrame >= f.move.chains.window[0] - 1);
      const prior = target.dmgTaken;
      tick(g, ['KeyL']); assert.equal(f.moveKey, 'boss_finisher');
      until(g, () => target.dmgTaken > prior);
      assert.ok(f.recentMoves.some(m => m.key === 'boss_heavy2'));
      assert.ok(f.recentMoves.some(m => m.key === 'boss_finisher'));
    });
    test(`boss ${c.id}: whiff and held J cannot confirm a route`, () => {
      const g = game(c.id); const [f, target] = g.fighters;
      target.x = 1700;
      tick(g, ['KeyJ']); frames(g, 8); tick(g, ['KeyJ']); frames(g, 8); tick(g, ['KeyL']); frames(g, 70);
      assert.equal(target.dmgTaken, 0);
      assert.ok(!f.recentMoves.some(m => ['boss_heavy2', 'boss_finisher'].includes(m.key)), 'whiff entered hit-confirm chain');
      const held = game(c.id); const a = held.fighters[0]; held.fighters[1].x = 60;
      frames(held, 120, ['KeyJ']);
      assert.ok(a.hitsLanded > 0);
      assert.ok(!a.recentMoves.some(m => m.key === 'boss_heavy2'), 'held button repeated without fresh edge');
    });
    for (const [label, keys, expected] of [['up J', ['KeyW', 'KeyJ'], 'rec'], ['down J', ['KeyS', 'KeyJ'], 'gp'], ['air K', ['KeyK'], 'aspec'], ['air J', ['KeyJ'], 'aig']]) {
      test(`boss ${c.id}: ${label} routes to ${expected}`, () => {
        const g = game(c.id); const f = g.fighters[0]; air(f);
        tick(g, keys); assert.equal(f.moveKey, expected);
        if (expected === 'rec') assert.equal(f.recoveryUsed, true);
        if (expected === 'aspec' || expected === 'aig') assert.ok(f.cds[expected] > 0);
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
    frames(g, 3);
    assert.equal(ally.dmgTaken, 0); assert.equal(enemy.dmgTaken, 15);
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
    test(`boss ${boss}: finisher shares and respects Limit cooldown`, () => {
      const g = game(boss), f = g.fighters[0];
      f.startMove('boss_finisher', g);
      for (const key of ['nex', 'sex', 'dex', 'aex', 'boss_finisher']) assert.ok(f.cds[key] > 0, `${key} cooldown absent`);
      f.endMove(); f.startMove('boss_heavy2', g); f.moveConnected = true;
      f.moveFrame = f.move.chains.window[0]; tick(g, ['KeyL']);
      assert.equal(f.moveKey, 'boss_heavy2', 'chaining bypassed shared Limit cooldown');
    });
    test(`boss ${boss}: character-builder clone retains combo nodes`, () => {
      const clone = buildCustom({ ...newCustomCfg(), style: boss });
      for (const m of Object.values(clone.moves)) for (const action of buttons) {
        if (m.chains?.[action]) assert.ok(clone.moves[m.chains[action]], `clone missing ${m.chains[action]}`);
      }
    });
    test(`preview ${boss}: real hit-confirmed combo and awakened follow-up`, () => {
      for (const action of ['heavy', 'awaken']) {
        const g = new Game(browser.canvas(), { mode: 'training', rule: 'training', stocks: 1, time: 0, arena: 'rooftops', player: boss, cpus: [] }, { bindings: DEFAULT_BINDINGS, tapJump: false, preview: boss });
        g.queuePreview({ action, stance: 'neutral', followup: true });
        frames(g, 155);
        const keys = g.fighters[0].recentMoves.map(m => m.key);
        assert.ok(keys.includes(action === 'heavy' ? 'boss_finisher' : 'nfu'), `${action} preview never reached finisher: ${keys}`);
        assert.ok(g.fighters[1].dmgTaken > 0, 'preview caused no damage'); render(g);
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
    const combos = [['light'], ['heavy'], ['special'], ['limit'], ['awaken'], ['light', 'up'], ['heavy', 'up'], ['special', 'up'], ['special', 'right'], ['heavy', 'right'], ['light', 'right'], ['limit', 'up'], ['awaken', 'up'], ['ult'], ['ult', 'up']];
    let landedAt = -1;
    for (let i = 0; i < 420 && landedAt < 0; i++) {
      // A different button every frame, so each press is a fresh edge: the fastest possible masher.
      tick(g, combos[i % combos.length].map(b => DEFAULT_BINDINGS[b][0]));
      if (f.moveKey && (f.moveKey !== lastKey || f.moveFrame < lastFrame)) started++;
      lastKey = f.moveKey; lastFrame = f.moveFrame;
      f.meter = 100; g.infiniteMeter = true; f.invuln = 0; if (i < 600) f.godT = 600; // transformations (Super Saiyan, Godspeed) are the worst case
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
    g.fighters[0].startMove('ult', g);
    for (let i = 0; i < 200 && !g.timeStop.active; i++) tick(g);
    assert.ok(g.timeStop.active, 'time stop never activated from the ultimate');
  };

  test('timestop: activates from the ultimate and suspends everyone but the caster', () => {
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

  test('timestop: queued damage never feeds the caster ultimate meter', () => {
    const g = timeStopGame();
    const [dio, foe] = g.fighters;
    activateTimeStop(g);
    assert.equal(dio.meter, 0, 'ultimate did not consume the meter');
    for (let n = 0; n < 3; n++) {
      foe.x = dio.x + 40; foe.invuln = 0;
      dio.startMove('nlight', g);
      for (let i = 0; i < 16 && dio.moveKey === 'nlight'; i++) tick(g);
    }
    g.endTimeStop();
    assert.ok(foe.dmgTaken > 0, 'queued damage never released');
    assert.equal(dio.meter, 0, `released time-stop damage granted ${dio.meter} meter`);
  });

  test('timestop: an interrupted ultimate never starts a time stop', () => {
    const g = timeStopGame();
    const [dio] = g.fighters;
    dio.meter = 100;
    dio.startMove('ult', g);
    for (let i = 0; i < 6; i++) tick(g);
    // Interrupt the startup the way a real hit would.
    dio.state = 'hitstun'; dio.move = null; dio.moveKey = null;
    for (let i = 0; i < 80; i++) tick(g);
    assert.equal(g.timeStop.active, false, 'interrupted ultimate still started a time stop');
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
  // ULTIMATE METER POLICY
  // ===========================================================================
  test('meter: an awakening or ultimate never feeds its own meter', () => {
    const g = game('levi');
    const [a, b] = g.fighters;
    a.meter = 0; a.startMove('ult', g); assert.ok(g.meterLocked(a), 'ultimate did not lock the meter');
    a.endMove(); a.meter = 0; a.godT = 200; assert.ok(g.meterLocked(a), 'transformation did not lock the meter');
    a.godT = 0; a.meter = 0; a.startMove('naw', g); assert.ok(g.meterLocked(a), 'awaken stance did not lock the meter');
    a.endMove(); a.meter = 0; a.startMove('nfu', g); assert.ok(g.meterLocked(a), 'awakened variant did not lock the meter');
    a.endMove();
    a.meter = 0; a.startMove('nlight', g);
    assert.equal(g.meterLocked(a), false, 'a normal attack was wrongly locked');
    a.meter = 0; deal(g, a, b); assert.ok(a.meter > 0, 'a normal attack gave no meter');
  });

  test('meter: a lingering ultimate projectile stays barred after the animation ends', () => {
    const g = game('sukuna');
    const [a, b] = g.fighters;
    a.meter = 0; a.startMove('ult', g);
    g.spawnProj({ owner: a, type: 'sig', sig: 'sukunaShrine', x: b.x, y: b.y - 40, vx: 0, vy: 0, w: 400, h: 300, life: 90, dmg: 2, ang: 70, kb: 1, sc: 0, fx: 'dark', dir: 1 });
    const p = g.projectiles[g.projectiles.length - 1];
    assert.equal(p.ultLocked, true, 'projectile spawned by an ultimate is not locked');
    a.endMove(); a.meter = 0;
    // The very same blow arriving after the animation finished, carried by the
    // projectile's own lock, must still not grant meter.
    g.applyHit(a, b, { dmg: 10, ang: 0, kb: 5, sc: 0, fx: 'dark', ultLocked: p.ultLocked }, 1, b.x, b.cy, false, { x: 0, y: 0, vx: 0, vy: 0, noMeter: p.ultLocked });
    assert.equal(a.meter, 0, 'delayed ultimate damage still granted meter');
    // A normal attack outside the awakening still builds meter as before.
    a.meter = 0; a.startMove('nlight', g);
    g.applyHit(a, b, { dmg: 10, ang: 0, kb: 5, sc: 0, fx: 'slash' }, 1, b.x, b.cy);
    assert.ok(a.meter > 0, 'normal attacks stopped granting meter');
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
    for (const key of ['nlight_spec', 'nlight_heavy', 'slight_spec', 'slight_heavy', 'dsig', 'nex', 'naw', 'boss_finisher']) {
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
    assert.equal(clipFor('sukuna', 'ult', { frames: 200 }), 'sukuna-domain', 'Domain Expansion clip missing');
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
    assert.equal(clipFor('gojo', 'ult', { frames: 200 }), null, 'Gojo unexpectedly requested a recorded clip');
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
    df.startMove('ult', dome);
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
    f.startMove('ult', g);
    for (let i = 0; i < 140; i++) tick(g);
    assert.ok(flat > 0, 'no other fighter uses the flat slash any more');
  });

  test('sukuna shrine: the domain draws the supplied PNG, never a generated shrine', () => {
    const g = game('sukuna');
    const f = g.fighters[0];
    f.meter = 100;
    f.startMove('ult', g);
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
    a.meter = 100;
    a.startMove('ult', g);
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
    a.meter = 100;
    a.startMove('ult', g);
    g.cin = null;
    const shrineFrames = [];
    const active = [];
    let footprint = null;
    b.x = a.x; b.grounded = true;
    // The sample starts on the move's startup frame; every beat below is counted
    // from there, exactly the way the chant is staged in the game.
    const cast = a.def.moves.ult.startup;
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
