/**
 * File-backed sound effects.
 *
 * The original game synthesised every sound through Web Audio oscillators.
 * Characters that ship recorded audio (Sukuna, Shadow DIO) use this module
 * instead, so the real samples are played with controllable pitch, volume and
 * per-clip rate limiting. Clips are decoded once into AudioBuffers, pooled by
 * voice count, and silently degrade when Web Audio or the media element is
 * unavailable (the headless regression harness has neither).
 */
import sukunaSlash from '../assets/sfx/sukuna/slash.mp3';
import sukunaStrongSlash from '../assets/sfx/sukuna/strongSlash.mp3';
import sukunaFuga from '../assets/sfx/sukuna/fuga.mp3';
import sukunaDomain from '../assets/sfx/sukuna/domainExpansion.mp3';
import sukunaLaugh from '../assets/sfx/sukuna/laugh.mp3';
import shadowdioAppear from '../assets/sfx/shadowdio/appear.mp3';
import shadowdioDeath from '../assets/sfx/shadowdio/death.mp3';
import shadowdioTimeStop from '../assets/sfx/shadowdio/timestop.mp3';
import shadowdioTimeResume from '../assets/sfx/shadowdio/timeResume.mp3';

export type ClipId =
  | 'sukuna-slash' | 'sukuna-strong-slash' | 'sukuna-fuga' | 'sukuna-domain' | 'sukuna-laugh'
  | 'shadowdio-appear' | 'shadowdio-death' | 'shadowdio-timestop' | 'shadowdio-time-resume';

interface ClipDef { src: string; volume: number; rate: number; minGap: number; }

const CLIPS: Record<ClipId, ClipDef> = {
  // Basic cleaves are pitched up so repeated light slashes read sharp and fast.
  'sukuna-slash': { src: sukunaSlash, volume: 0.42, rate: 1.2, minGap: 0.055 },
  'sukuna-strong-slash': { src: sukunaStrongSlash, volume: 0.62, rate: 1.0, minGap: 0.11 },
  'sukuna-fuga': { src: sukunaFuga, volume: 0.66, rate: 1.0, minGap: 0.2 },
  'sukuna-domain': { src: sukunaDomain, volume: 0.7, rate: 1.0, minGap: 0.5 },
  'sukuna-laugh': { src: sukunaLaugh, volume: 0.62, rate: 1.0, minGap: 0.6 },
  'shadowdio-appear': { src: shadowdioAppear, volume: 0.55, rate: 1.0, minGap: 0.2 },
  'shadowdio-death': { src: shadowdioDeath, volume: 0.6, rate: 1.0, minGap: 0.5 },
  'shadowdio-timestop': { src: shadowdioTimeStop, volume: 0.7, rate: 1.0, minGap: 0.5 },
  'shadowdio-time-resume': { src: shadowdioTimeResume, volume: 0.6, rate: 1.0, minGap: 0.4 },
};

const MAX_VOICES = 14;
const buffers = new Map<ClipId, AudioBuffer>();
const lastPlayed = new Map<ClipId, number>();
/** Live voices keyed `clipId:…`, so a single cue can be faded as a group. */
const live = new Map<string, { node: AudioBufferSourceNode; gain: GainNode }>();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let warned = false;
let lastRequested: ClipId | null = null;

/**
 * The most recent clip the game asked for. Recorded regardless of whether the
 * audio graph is available, so behaviour can be verified headlessly.
 */
export function lastClipRequest() { return lastRequested; }
export function clearClipRequests() { lastRequested = null; }

function ready(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.18;
      master.connect(comp); comp.connect(ctx.destination);
    } catch { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

async function decode(id: ClipId, url: string) {
  if (buffers.has(id)) return;
  if (typeof fetch !== 'function' || typeof URL !== 'function') return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const bytes = await res.arrayBuffer();
    const c = ready(); if (!c) return;
    buffers.set(id, await c.decodeAudioData(bytes));
  } catch {
    if (!warned) { warned = true; console.warn(`[sfx] could not decode "${id}" — falling back silently.`); }
  }
}

/** Warm the clip cache so first activation never stutters. */
export function preloadClips(ids: ClipId[] = Object.keys(CLIPS) as ClipId[]) {
  for (const id of ids) void decode(id, CLIPS[id].src);
}

export function clipAvailable(id: ClipId) { return !!buffers.get(id); }

export interface PlayOptions {
  /** Playback-rate multiplier. 1 = original pitch. */
  rate?: number;
  volume?: number;
  /** Extra seconds added to the clip's built-in minimum gap. */
  gap?: number;
  /** Skip the rate limiter entirely (used for a deliberate layered effect). */
  force?: boolean;
}

/**
 * Plays a recorded clip. Returns true when a voice was actually started, so
 * callers can suppress the synthesised fallback.
 */
export function playClip(id: ClipId, o: PlayOptions = {}): boolean {
  const def = CLIPS[id];
  if (!def) return false;
  lastRequested = id;
  const buf = buffers.get(id);
  if (!buf) { void decode(id, def.src); return false; }
  const c = ready(); if (!c || !master) return false;

  const now = c.currentTime;
  const gap = def.minGap + (o.gap || 0);
  if (!o.force) {
    const last = lastPlayed.get(id);
    if (last !== undefined && now - last < gap) return false;
  }
  lastPlayed.set(id, now);

  // Voice cap: a screen full of simultaneous abilities must never clip the mix.
  if (live.size >= MAX_VOICES) {
    const oldest = live.keys().next().value as string | undefined;
    if (oldest) {
      const voice = live.get(oldest);
      live.delete(oldest);
      try { voice?.node.stop(); } catch { /* already stopped */ }
    }
  }

  const node = c.createBufferSource();
  const gain = c.createGain();
  node.buffer = buf;
  // `rate` also shifts pitch, which is how the regular cleave gets its bite.
  node.playbackRate.value = Math.max(0.25, Math.min(4, def.rate * (o.rate ?? 1)));
  const peak = Math.max(0, Math.min(1.5, def.volume * (o.volume ?? 1)));
  // 4 ms ramp avoids the click that an abrupt gain edge produces on a hard transient.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.004);
  gain.gain.setTargetAtTime(0.0001, now + Math.max(0.05, buf.duration * 0.9), 0.05);
  node.connect(gain); gain.connect(master);
  const key = `${id}:${live.size}:${now}`;
  live.set(key, { node, gain });
  node.onended = () => { live.delete(key); try { node.disconnect(); gain.disconnect(); } catch { /* noop */ } };
  node.start(now);
  return true;
}

/**
 * Ramps every live voice of one clip down to silence over `seconds`, then stops
 * it. Long sustained cues (a domain's roar) must clear the mix on cue instead of
 * being chopped off mid-sample or ringing over the next beat.
 *
 * Returns true when at least one voice was actually found, so callers can tell
 * "faded" apart from "the audio graph is unavailable".
 */
export function fadeOutClip(id: ClipId, seconds = 1): boolean {
  const c = ready();
  if (!c || !master) return false;
  const fade = Math.max(0.05, Math.min(6, seconds));
  const now = c.currentTime;
  let found = false;
  for (const [key, voice] of [...live]) {
    if (!key.startsWith(`${id}:`)) continue;
    found = true;
    live.delete(key);
    try {
      const g = voice.gain.gain;
      const from = Math.max(0.0001, g.value);
      g.cancelScheduledValues(now);
      g.setValueAtTime(from, now);
      g.exponentialRampToValueAtTime(0.0001, now + fade);
      voice.node.stop(now + fade + 0.05);
    } catch { /* already stopped */ }
  }
  return found;
}

export function setClipVolume(v: number) {
  if (master) master.gain.value = Math.max(0, Math.min(1.4, v));
}
