import { CustomMatchSettings, FighterSettings, MatchConfig } from './types';

export const TEAM_NAMES = ['RED', 'BLUE', 'GREEN', 'GOLD'];
export const TEAM_COLORS = ['#ff4757', '#3fa9ff', '#44e07a', '#ffb52e'];
export const defaultFighterSettings = (slot: number): FighterSettings => ({ team: slot === 0 ? 0 : 1, damage: 1, knockback: 1 });
const clamp = (n: number | undefined, fallback: number, min: number, max: number) => Number.isFinite(n) ? Math.max(min, Math.min(max, n!)) : fallback;

export function customSettings(cfg: MatchConfig): CustomMatchSettings {
  const c = cfg.custom;
  return {
    teams: c?.teams ?? true, friendlyFire: c?.friendlyFire ?? false,
    damageMode: c?.damageMode === 'stamina' ? 'stamina' : 'percent',
    health: clamp(c?.health, 200, 10, 2000), damage: clamp(c?.damage, 1, 0.1, 5), knockback: clamp(c?.knockback, 1, 0, 3),
    fighters: Array.from({ length: 4 }, (_, i) => {
      const f = c?.fighters?.[i] ?? defaultFighterSettings(i);
      return { team: Math.round(clamp(f.team, i === 0 ? 0 : 1, 0, 3)), damage: clamp(f.damage, 1, 0.1, 5), knockback: clamp(f.knockback, 1, 0, 3),
        health: f.health === undefined ? undefined : clamp(f.health, 200, 10, 2000) };
    }),
  };
}

export function customMatchError(cfg: MatchConfig): string | null {
  if (cfg.mode !== 'custom') return null;
  if (cfg.cpus.length < 1 || cfg.cpus.length > 3) return 'Choose between one and three CPU fighters.';
  const c = customSettings(cfg);
  if (c.teams && new Set(c.fighters.slice(0, cfg.cpus.length + 1).map(f => f.team)).size < 2) return 'Assign at least one fighter to an opposing team.';
  return null;
}

export function normalizeMatchConfig(cfg: MatchConfig): MatchConfig {
  if (cfg.mode !== 'custom') return cfg;
  return { ...cfg, rule: cfg.rule === 'timed' ? 'timed' : 'stock',
    stocks: Math.round(clamp(cfg.stocks, 3, 1, 9)),
    time: Math.round(clamp(cfg.time, 180, cfg.rule === 'timed' ? 60 : 0, 900)),
    cpus: cfg.cpus.slice(0, 3).map(c => ({ ...c, diff: ['easy', 'medium', 'hard'].includes(c.diff) ? c.diff : 'medium' })),
    custom: customSettings(cfg) };
}
