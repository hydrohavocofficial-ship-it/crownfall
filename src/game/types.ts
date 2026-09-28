export interface InputState {
  left: boolean; right: boolean; up: boolean; down: boolean;
  jump: boolean; light: boolean; heavy: boolean; dodge: boolean;
  special: boolean; awaken: boolean;
}
export type InputKey = keyof InputState;
export type TechniqueVisualStyle =
  | 'blade' | 'storm' | 'flame' | 'meteor' | 'void' | 'ki' | 'spirit' | 'fox' | 'water'
  | 'shadow' | 'rubber' | 'trio' | 'pressure' | 'singularity' | 'curse' | 'hero'
  | 'twin' | 'titan' | 'saw';

export type Action = InputKey | 'pause';

export const emptyInput = (): InputState => ({
  left: false, right: false, up: false, down: false, jump: false, light: false, heavy: false, dodge: false,
  special: false, awaken: false,
});

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ModeId = '1v1' | 'ffa' | 'stock' | 'timed' | 'training' | 'custom';
export type DummyMode = 'stand' | 'jump' | 'move' | 'dodge' | 'cpu';

export interface FighterSettings {
  team: number; // 0–3; ignored in free-for-all
  damage: number; // outgoing multiplier, stacked with global damage
  knockback: number; // outgoing multiplier, stacked with global knockback
  health?: number; // optional maximum HP override
}
export interface CustomMatchSettings {
  teams: boolean;
  friendlyFire: boolean;
  damageMode: 'percent' | 'stamina';
  health: number;
  damage: number;
  knockback: number;
  fighters: FighterSettings[]; // slot 0 = P1, slots 1–3 = CPUs
}

export interface MatchConfig {
  mode: ModeId;
  rule: 'stock' | 'timed' | 'training';
  stocks: number;
  time: number; // seconds
  arena: string;
  player: string;
  cpus: { char: string; diff: Difficulty }[];
  custom?: CustomMatchSettings;
}

export interface FighterResult {
  char: string; name: string; isCPU: boolean; kos: number; falls: number;
  dmgDealt: number; dmgTaken: number; place: number; score: number; color: string; label: string;
  team?: number; stocks?: number; health?: number;
}
export interface MatchResult {
  fighters: FighterResult[]; duration: number; rule: string;
  teams?: boolean; draw?: boolean; playerWon?: boolean;
  teamResults?: { team: number; place: number; score: number; stocks: number }[];
}

export interface Rect { x: number; y: number; w: number; h: number; }

export type AnimName =
  | 'slash' | 'upslash' | 'lowslash' | 'thrust' | 'punch' | 'uppercut' | 'kick' | 'dkick'
  | 'spin' | 'flip' | 'cast' | 'castUp' | 'slam' | 'dive' | 'counter' | 'sweep' | 'backslash' | 'rise'
  // Unarmed silhouettes so a brawler never reuses a swordsman's swing.
  | 'jab' | 'hook' | 'elbow' | 'backfist' | 'palm' | 'knee' | 'axeKick' | 'roundhouse'
  | 'stomp' | 'headbutt' | 'flurry' | 'spinKick';

export interface HitDef {
  f: [number, number];
  x: number; y: number; w: number; h: number;
  dmg: number; ang: number; kb: number; sc: number;
  g?: number;          // hit group
  rehit?: number;      // can rehit every n frames
  fx?: 'fire' | 'elec' | 'dark' | 'slash' | 'blunt' | 'purple';
  stun?: number;       // extra hitstun
  pull?: boolean;      // pull target toward attacker center (multi-hit)
}

export interface MoveDef {
  name?: string;
  dur: number;
  startup: number;
  anim: AnimName;
  hits: HitDef[];
  vel?: [number, number | null, number | null][]; // frame, vx (facing), vy
  grav?: number;
  land?: boolean;
  cd?: number;
  turns?: number;
  sfx?: string;
  invuln?: [number, number];
  counter?: [number, number];
  onStart?: (f: any, g: any) => void;
  onFrame?: (f: any, frame: number, g: any) => void;
  onHit?: (f: any, target: any, g: any, hit: HitDef) => void;
  onCounter?: (f: any, attacker: any, g: any) => void;
  airDrift?: number;
  trail?: string;
  desc?: string;
  vfx?: string;
  variantOf?: string;
  /**
   * Identifies the input family and stance for HUD, tutorials, and preview choreography.
   *
   * `awaken` is the transformation itself, and the three `awaken*` tiers are the
   * kit it grants. They are distinct from `special` because the awakened kit is
   * only reachable while the gauge is draining, which the HUD has to say out loud.
   */
  ability?: 'special' | 'awaken' | 'awakenLight' | 'awakenHeavy' | 'awakened';
  stance?: 'neutral' | 'side' | 'down' | 'air';
  /**
   * The move is performed by a summoned Stand rather than by the fighter's own
   * body. The Stand materialises shortly before startup and dismisses itself
   * after the move recovers.
   */
  stand?: boolean;
  /** Frames of pre-move cinematic. Defaults to the shared 70. */
  cin?: number;
  chainLabel?: string;
  techniqueProfile?: string;
  techniqueStyle?: TechniqueVisualStyle;
  /**
   * Suppresses the generic per-contact impact punctuation (the hard glow disc,
   * the shock ring and the manga star). Sustained and piercing attacks re-hit on
   * a short cadence, so punctuating every frame stacks dozens of rings on one
   * point and buries the attack's own visual. The damage, hitstun and hitstop
   * are all unaffected — this is presentation only.
   */
  quietHits?: boolean;
  /**
   * Scales everything this move deals, projectiles included, to `p`.
   *
   * Set on a retained set-piece so a re-homed domain is weakened *completely*:
   * the melee hits are scaled when the move is built, and `Game.spawnProj` reads
   * this off the owner for anything the choreography throws. Without it, a domain
   * with a 4-damage melee and a 34-damage blast would only look weakened.
   */
  domainPower?: number;
  /** Banner text stamped on the frame the move releases. */
  label?: string;
  chains?: {
    light?: string;
    heavy?: string;
    special?: string;
    /** Only the awakened kit can chain into these; unreachable while sealed. */
    awaken?: string;
    window?: [number, number];
    onHitOnly?: boolean;
  };
}
