// Browser boundary only: combat, physics, controllers, AI, effects and rendering stay real.
import assert from 'node:assert/strict';

export function installBrowser() {
  let now = 0;
  let seed = 1;
  let draws = 0;
  const storage = new Map();
  const listeners = new Map();
  const numeric = (args, label) => {
    for (const value of args) if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `${label}: non-finite drawing coordinate ${value}`);
    }
  };
  function canvas() {
    const cv = {
      width: 960, height: 640, style: {},
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 960, height: 640 }),
      toDataURL: () => 'data:image/png;base64,',
    };
    const stack = [];
    const ctx = { canvas: cv, globalAlpha: 1, lineWidth: 1 };
    const gradient = (...args) => {
      numeric(args, 'gradient');
      return { addColorStop(offset) { assert.ok(offset >= 0 && offset <= 1, `gradient stop ${offset}`); } };
    };
    for (const name of ['beginPath', 'closePath', 'fill', 'stroke', 'clip', 'fillRect', 'clearRect', 'strokeRect',
      'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'roundRect', 'translate', 'rotate', 'scale',
      'transform', 'setTransform', 'resetTransform', 'drawImage', 'fillText', 'strokeText', 'setLineDash']) {
      ctx[name] = (...args) => { numeric(args, name); draws++; };
    }
    ctx.arc = (...args) => { numeric(args, 'arc'); assert.ok(args[2] >= 0, `negative arc radius ${args[2]}`); draws++; };
    ctx.ellipse = (...args) => { numeric(args, 'ellipse'); assert.ok(args[2] >= 0 && args[3] >= 0, 'negative ellipse radius'); draws++; };
    ctx.createLinearGradient = gradient;
    ctx.createRadialGradient = (...args) => {
      assert.ok(args[2] >= 0 && args[5] >= 0, 'negative radial gradient radius');
      return gradient(...args);
    };
    ctx.measureText = text => ({ width: String(text).length * 8 });
    ctx.save = () => stack.push(Object.fromEntries(Object.entries(ctx).filter(([, value]) => typeof value !== 'function' && value !== cv)));
    ctx.restore = () => { const state = stack.pop(); if (state) Object.assign(ctx, state); };
    cv.getContext = type => { assert.equal(type, '2d'); return ctx; };
    cv.assertBalanced = () => assert.equal(stack.length, 0, 'canvas save/restore imbalance');
    return cv;
  }
  const on = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
  const off = (type, fn) => listeners.get(type)?.delete(fn);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    devicePixelRatio: 1, addEventListener: on, removeEventListener: off,
    // Absent Web Audio is the real engine's supported silent fallback.
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag) { assert.equal(tag, 'canvas', `unexpected DOM element ${tag}`); return canvas(); },
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.Image = class { complete = true; naturalWidth = 1600; naturalHeight = 900; width = 1600; height = 900; src = ''; };
  globalThis.requestAnimationFrame = () => { throw new Error('Use deterministic Game.step(), not requestAnimationFrame'); };
  globalThis.cancelAnimationFrame = () => {};
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  return {
    canvas,
    reset(value = 0x5eed) { now = 0; seed = value; storage.clear(); },
    advance() { now += 1000 / 60; },
    get draws() { return draws; },
  };
}
