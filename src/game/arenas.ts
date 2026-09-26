import { Rect } from './types';
import rooftopsBg from '../assets/arenas/rooftops.jpg';
import trainBg from '../assets/arenas/train.jpg';
import valleyBg from '../assets/arenas/valley.jpg';
import castleBg from '../assets/arenas/castle.jpg';

export interface ArenaDef {
  id: string;
  name: string;
  subtitle: string;
  bg: string;
  solids: Rect[];
  platforms: { x: number; y: number; w: number }[];
  blast: { l: number; r: number; t: number; b: number };
  spawns: [number, number][];
  respawn: [number, number];
  theme: {
    top: string; body: string; body2: string; edge: string; plat: string; platTop: string;
    particle: 'ember' | 'petal' | 'mist' | 'sparkle' | 'dust';
    tint: string; sky: [string, string];
  };
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'rooftops', name: 'Trost Rooftops', subtitle: 'Attack on Titan', bg: rooftopsBg,
    solids: [{ x: -520, y: 0, w: 1040, h: 520 }],
    platforms: [{ x: -380, y: -175, w: 230 }, { x: 150, y: -175, w: 230 }, { x: -115, y: -330, w: 230 }],
    blast: { l: -1400, r: 1400, t: -1100, b: 800 },
    spawns: [[-300, -10], [300, -10], [-100, -10], [100, -10]],
    respawn: [0, -520],
    theme: { top: '#b4553d', body: '#6b4a3a', body2: '#3d2a22', edge: '#e3a27a', plat: '#7a5140', platTop: '#c9704f',
      particle: 'dust', tint: 'rgba(255,140,60,0.10)', sky: ['#f59e5b', '#6d3b5e'] },
  },
  {
    id: 'train', name: 'Mugen Train', subtitle: 'Demon Slayer', bg: trainBg,
    solids: [{ x: -660, y: 0, w: 540, h: 220 }, { x: 120, y: 0, w: 540, h: 220 }],
    platforms: [{ x: -130, y: -170, w: 260 }, { x: -560, y: -200, w: 200 }, { x: 360, y: -200, w: 200 }],
    blast: { l: -1500, r: 1500, t: -1100, b: 800 },
    spawns: [[-380, -10], [380, -10], [-220, -10], [220, -10]],
    respawn: [0, -500],
    theme: { top: '#3c3f52', body: '#1d2233', body2: '#0c0f1a', edge: '#e05a2b', plat: '#2a2f45', platTop: '#8c6b4a',
      particle: 'ember', tint: 'rgba(40,20,80,0.18)', sky: ['#1b1f4b', '#05060f'] },
  },
  {
    id: 'valley', name: 'Valley of the End', subtitle: 'Naruto', bg: valleyBg,
    solids: [{ x: -400, y: 0, w: 800, h: 520 }, { x: -760, y: -130, w: 200, h: 700 }, { x: 560, y: -130, w: 200, h: 700 }],
    platforms: [{ x: -150, y: -200, w: 300 }, { x: -470, y: -300, w: 170 }, { x: 300, y: -300, w: 170 }],
    blast: { l: -1550, r: 1550, t: -1150, b: 800 },
    spawns: [[-250, -10], [250, -10], [-660, -140], [660, -140]],
    respawn: [0, -560],
    theme: { top: '#6f7a5a', body: '#5b5e66', body2: '#2c2f38', edge: '#b9c4a0', plat: '#4d5058', platTop: '#8b9677',
      particle: 'mist', tint: 'rgba(80,120,160,0.12)', sky: ['#8fa8c0', '#34465a'] },
  },
  {
    id: 'castle', name: 'Clover Castle Isles', subtitle: 'Black Clover', bg: castleBg,
    solids: [{ x: -470, y: 0, w: 940, h: 260 }],
    platforms: [{ x: -620, y: -130, w: 190 }, { x: 430, y: -130, w: 190 }, { x: -270, y: -210, w: 200 }, { x: 70, y: -210, w: 200 }, { x: -100, y: -370, w: 200 }],
    blast: { l: -1450, r: 1450, t: -1150, b: 800 },
    spawns: [[-300, -10], [300, -10], [-520, -140], [520, -140]],
    respawn: [0, -540],
    theme: { top: '#5fae57', body: '#b9b1a3', body2: '#6e6558', edge: '#e8f4c8', plat: '#8f8677', platTop: '#72c064',
      particle: 'sparkle', tint: 'rgba(120,200,255,0.06)', sky: ['#7cc3ff', '#dff1ff'] },
  },
];

for (const a of ARENAS) a.bg = a.bg.replace(/^\//, '');

export const PREVIEW_ARENA: ArenaDef = {
  id: 'preview', name: 'Preview', subtitle: '', bg: '',
  solids: [{ x: -2000, y: 0, w: 4000, h: 200 }], platforms: [],
  blast: { l: -99999, r: 99999, t: -99999, b: 99999 }, spawns: [[0, 0], [260, 0]], respawn: [0, -100],
  theme: { top: '#333', body: '#222', body2: '#111', edge: '#555', plat: '#333', platTop: '#444', particle: 'dust', tint: 'transparent', sky: ['#000', '#000'] },
};

export const arenaById = (id: string) => ARENAS.find((a) => a.id === id) || ARENAS[0];
