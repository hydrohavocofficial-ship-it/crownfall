import type { Look } from './render';

type Point = [number, number];
const TAU = Math.PI * 2;
const GOLD = '#ffe45c';
function line(c: CanvasRenderingContext2D, points: Point[], color: string, width = 1.4) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
}
function panel(c: CanvasRenderingContext2D, points: Point[], fill: string, edge = '#080b14') {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = edge; c.lineWidth = 1.4; c.stroke();
}
function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

/** Art is attached to animated body landmarks, so costumes follow every combat pose. */
export function drawCostume(c: CanvasRenderingContext2D, id: string, look: Look, head: Point, shoulder: Point, hip: number, time: number, empowered: boolean) {
  const [x, y] = shoulder, [hx, hy] = head, flow = Math.sin(time * .12) * 2;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  // Cel-shaded lapel edges and fabric folds retain the character palette at small scale.
  line(c, [[x - 8, y + 4], [x - 5, y + 13], [-6, hip - 3]], look.top2, 1.1);
  line(c, [[x + 9, y + 4], [x + 6, y + 14], [7, hip - 4]], '#070913', 1.8);
  switch (id) {
    case 'sukuna': {
      // White robe, indigo sash, exposed tattooed collar, paired eye markings.
      for (const side of [-1, 1]) {
        panel(c, [[x + side * 11, y - 2], [x + side * 4, y + 10], [side * 4, hip], [side * 13, hip + 15 + flow]], side < 0 ? '#bcc6d6' : '#f3e9dc');
        line(c, [[x + side * 9, y], [x + side * 2, y + 12], [side * 4, hip - 1]], '#242643', 2.3);
      }
      panel(c, [[-11, hip - 3], [11, hip - 3], [12, hip + 4], [-12, hip + 4]], '#25253f');
      line(c, [[-3, hip + 2], [-8 + flow, hip + 22]], '#36365a', 4);
      line(c, [[hx - 4, hy - 9], [hx, hy - 5], [hx + 4, hy - 9]], '#25111c', 1.7);
      for (const side of [-1, 1]) {
        line(c, [[hx + side * 3, hy + 2], [hx + side * 9, hy + 4], [hx + side * 6, hy + 7]], '#24121d', 1.5);
        line(c, [[hx + side * 3, hy + 6], [hx + side * 7, hy + 7]], '#f03853', 1);
      }
      line(c, [[hx - 2, hy + 9], [hx, hy + 12], [hx + 2, hy + 9]], '#24121d', 1.4);
      break;
    }
    case 'gojo': {
      panel(c, [[x - 12, y + 1], [x - 8, y - 10], [x + 6, y - 8], [x + 12, y + 3], [7, hip], [-8, hip]], '#161e35', '#556780');
      line(c, [[x - 8, y - 8], [x + 4, y - 6], [x + 2, y + 6], [1, hip]], '#697b94', 1.1);
      for (let i = 0; i < 3; i++) disc(c, x + 4, y + 4 + i * 6, .9, '#d4dce9');
      panel(c, [[hx - 12, hy - 5], [hx + 12, hy - 3], [hx + 11, hy + 3], [hx - 12, hy + 1]], '#080b16');
      line(c, [[hx - 12, hy - 2], [hx - 22 - flow, hy + 2], [hx - 25, hy + 8]], '#344766', 3);
      if (empowered) { line(c, [[hx + 4, hy], [hx + 10, hy]], '#92edff', 2); disc(c, hx + 7, hy, 1.1, '#ffffff'); }
      break;
    }
    case 'levi': case 'eren': {
      for (const side of [-1, 1]) {
        panel(c, [[side * 9, hip - 3], [side * 19, hip + 1], [side * 18, hip + 17], [side * 10, hip + 16]], '#677c88');
        line(c, [[side * 12, hip + 1], [side * 12, hip + 13]], '#e1eff2', 1);
        line(c, [[x + side * 8, y + 3], [-side * 7, hip]], '#302828', 2.5);
      }
      if (id === 'levi') panel(c, [[x - 5, y - 2], [x + 5, y - 2], [x + 3, y + 10], [x - 2, y + 6], [x - 5, y + 10]], '#f4ece5');
      else { line(c, [[hx - 6, hy + 3], [hx - 8, hy + 9]], '#756058', .8); line(c, [[hx + 7, hy + 3], [hx + 9, hy + 8]], '#756058', .8); }
      break;
    }
    case 'killua': {
      panel(c, [[x - 9, y - 3], [x + 8, y - 3], [x + 12, y + 6], [x + 5, y + 7], [x - 4, y + 3], [x - 11, y + 6]], '#fbf8ff', '#b1bada');
      line(c, [[x - 5, y - 3], [x - 4, y + 7], [x + 2, y + 7]], '#664787', 2);
      for (const side of [-1, 1]) { disc(c, side * 12, hip + 2, 4, '#9384d1'); disc(c, side * 12, hip + 2, 2.5, '#e5e7ff'); }
      break;
    }
    case 'rengoku': {
      for (const side of [-1, 1]) {
        panel(c, [[x + side * 10, y - 3], [side * 16, hip + 13], [side * 12, hip + 22], [side * 8, hip + 13], [side * 4, hip + 22], [side * 2, hip + 11]], '#fff4d9');
        panel(c, [[side * 15, hip + 12], [side * 12, hip + 21], [side * 8, hip + 9], [side * 5, hip + 19], [side * 3, hip + 11], [side * 8, hip + 2]], '#ff7b21', '#af2923');
      }
      break;
    }
    case 'madara': {
      for (let i = 0; i < 3; i++) {
        panel(c, [[x - 12, y + i * 7], [x + 12, y + i * 7], [x + 13, y + 6 + i * 7], [x - 13, y + 6 + i * 7]], i % 2 ? '#8c2637' : '#b13943', '#43192b');
        disc(c, x - 8, y + 3 + i * 7, 1, '#e8ad94'); disc(c, x + 8, y + 3 + i * 7, 1, '#e8ad94');
      }
      for (const side of [-1, 1]) panel(c, [[x + side * 8, y], [x + side * 19, y + 2], [x + side * 18, y + 10], [x + side * 10, y + 7]], '#aa3040');
      break;
    }
    case 'asta': {
      panel(c, [[x - 10, y - 4], [x + 8, y], [x + 4, y + 15], [x - 9, y + 8]], '#151c25', '#c19a51');
      disc(c, x - 3, y + 6, 4, '#caa34a');
      line(c, [[x - 6, y + 3], [x - 3, y + 9], [x, y + 3]], '#1b1920', 1.3);
      line(c, [[hx - 11, hy - 5], [hx + 8, hy - 6]], '#101722', 3);
      break;
    }
    case 'goku': {
      disc(c, x + 6, y + 10, 5.5, '#f7e8ca'); disc(c, x + 6, y + 10, 4.3, '#18233f');
      line(c, [[x + 3, y + 8], [x + 8, y + 8], [x + 5, y + 10], [x + 8, y + 13], [x + 4, y + 13]], '#f7e8ca', .9);
      line(c, [[-10, hip], [10, hip]], '#224796', 5);
      line(c, [[4, hip], [14 + flow, hip + 8], [10, hip + 17]], '#224796', 3);
      break;
    }
    case 'ichigo': {
      for (const side of [-1, 1]) panel(c, [[x + side * 9, y + 1], [side * 9, hip], [side * 19 + flow, hip + 23], [side * 3, hip + 16]], '#121728', '#737895');
      line(c, [[x - 7, y], [x + 3, y + 14], [x + 6, hip - 4]], '#dddce8', 2);
      line(c, [[-9, hip], [10, hip]], '#e5decb', 4);
      break;
    }
    case 'naruto': {
      panel(c, [[x - 9, y - 2], [x - 5, y + 7], [x + 7, y + 7], [x + 10, y - 1]], '#25304a');
      line(c, [[x, y + 6], [0, hip - 3]], '#e8e5d6', 1.5);
      disc(c, x - 7, y + 13, 4, '#b53b37');
      c.strokeStyle = '#efc384'; c.lineWidth = 1; c.beginPath(); c.arc(x - 7, y + 13, 2.5, 0, 5.4); c.stroke();
      break;
    }
    case 'tanjiro': {
      // Check pattern on the torso remains readable even when the coat folds behind the body.
      for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
        panel(c, [[x + side * 5, y + row * 7], [x + side * 12, y + row * 7], [side * 11, y + row * 7 + 7], [side * 5, y + row * 7 + 7]], row % 2 ? '#153029' : '#4d9d72');
      }
      panel(c, [[hx - 5, hy - 9], [hx, hy - 12], [hx + 3, hy - 7], [hx - 1, hy - 5]], '#9a414b');
      break;
    }
    case 'sasuke': {
      for (let i = 0; i < 5; i++) { c.strokeStyle = '#9274b1'; c.lineWidth = 3; c.beginPath(); c.ellipse(-8 + i * 4, hip, 3, 4, -.5, 0, TAU); c.stroke(); }
      line(c, [[6, hip + 1], [15 + flow, hip + 8], [9, hip + 20]], '#75568f', 4);
      disc(c, hx + 6, hy, 2, '#de5369'); disc(c, hx + 6, hy, .8, '#10091b');
      break;
    }
    case 'luffy': {
      panel(c, [[x - 3, y + 1], [x + 4, y + 1], [6, hip - 2], [-5, hip - 2]], look.skin);
      line(c, [[x - 1, y + 10], [x + 4, y + 17]], '#a9644f', 1.4);
      line(c, [[x + 4, y + 10], [x - 1, y + 17]], '#a9644f', 1.4);
      line(c, [[-11, hip], [11, hip]], '#edd294', 5);
      for (let i = 0; i < 3; i++) disc(c, x - 7, y + 5 + i * 6, 1.3, '#f7cc62');
      break;
    }
    case 'zoro': {
      line(c, [[-11, hip], [11, hip]], '#56816b', 7);
      for (let i = 0; i < 3; i++) line(c, [[-13 - i * 3, hip - 7], [-19 - i * 3 + flow, hip + 22]], ['#e8ddd0', '#692e42', '#152333'][i], 3);
      line(c, [[hx + 6, hy - 5], [hx + 7, hy + 6]], '#925851', 1.1);
      break;
    }
    case 'saitama': {
      for (const side of [-1, 1]) disc(c, x + side * 8, y, 3.2, '#e8e4d9');
      line(c, [[x, y + 1], [0, hip - 3]], '#635451', 1.6);
      panel(c, [[-10, hip - 3], [10, hip - 3], [10, hip + 3], [-10, hip + 3]], '#5b3334');
      panel(c, [[-3, hip - 4], [3, hip - 4], [3, hip + 4], [-3, hip + 4]], '#d6c7a4');
      break;
    }
    case 'yuji': {
      panel(c, [[x - 12, y - 4], [x - 7, y - 9], [x + 6, y - 8], [x + 11, y - 3], [x + 7, y + 6], [x - 5, y + 5]], '#ad354b', '#64233b');
      line(c, [[x - 5, y + 1], [x - 6, y + 14]], '#efad96'); line(c, [[x + 6, y + 1], [x + 7, y + 12]], '#efad96');
      disc(c, x + 6, y + 16, 1.6, '#dcb779'); break;
    }
    case 'deku': {
      panel(c, [[x - 10, y - 5], [x + 10, y - 5], [x + 8, y + 4], [x - 6, y + 4]], '#b8c4c6', '#384c55');
      for (let i = 0; i < 4; i++) line(c, [[x - 6 + i * 4, y - 3], [x - 6 + i * 4, y + 1]], '#23343e', 1.2);
      for (const side of [-1, 1]) panel(c, [[side * 7, hip - 2], [side * 14, hip], [side * 14, hip + 7], [side * 6, hip + 6]], '#bd4550');
      break;
    }
    case 'todoroki': {
      line(c, [[x - 6, y + 2], [-6, hip]], '#e4ddd1', 2.5); line(c, [[x + 6, y + 2], [6, hip]], '#e4ddd1', 2.5);
      for (let i = 0; i < 3; i++) { c.fillStyle = '#a0aeb8'; c.fillRect(-10 + i * 8, hip - 1, 5, 6); }
      panel(c, [[hx + 1, hy - 7], [hx + 9, hy - 5], [hx + 10, hy + 2], [hx + 4, hy + 4]], '#b55a66');
      disc(c, hx + 7, hy, 1.4, '#b1ecf3'); break;
    }
    case 'denji': {
      panel(c, [[x - 10, y], [x - 3, y + 7], [x + 1, y + 2], [x + 5, y + 7], [x + 10, y]], '#e4dfce');
      panel(c, [[x, y + 3], [x + 3, y + 6], [x + 5 + flow, hip - 2], [x + 1 + flow, hip + 3], [x - 1, y + 7]], '#262536');
      line(c, [[x - 3, y + 10], [x - 3, y + 15]], '#333443', 1.2); disc(c, x - 3, y + 17, 2, '#141723'); break;
    }
    case 'shadowdio': {
      // The gold coat body and heart clasp live in render.ts, keyed to the same
      // skeleton. Here: the high green collar, the belted strap run, the
      // fingerless glove and the purple wristband DIO wears on his right hand.
      panel(c, [[x - 12, y - 2], [x - 6, y - 13], [x + 7, y - 12], [x + 13, y - 1], [8, hip - 2], [-9, hip - 2]], '#0b1512', '#2f6a4f');
      for (const side of [-1, 1]) {
        panel(c, [[x + side * 9, y - 9], [x + side * 15, y - 3], [x + side * 13, y + 8], [x + side * 7, y + 3]], '#16302a', '#3d8a63');
        line(c, [[x + side * 10, y - 6], [x + side * 12, y + 5]], '#7de0b0', 1.1);
      }
      // Strap running across the chest with a gold buckle.
      line(c, [[x - 9, y + 1], [x + 8, hip - 2]], '#1d4a38', 3.4);
      line(c, [[x - 9, y + 1], [x + 8, hip - 2]], '#7de0b0', 1);
      line(c, [[x - 1, y + 5], [5, hip - 1]], GOLD, 1.6);
      // Purple wristband on the striking hand side.
      line(c, [[x + 12, y + 7], [x + 14, y + 11]], '#8b3fa8', 4);
      line(c, [[x + 12, y + 7], [x + 14, y + 11]], '#d489e0', 1.4);
      break;
    }
  }
  c.restore();
}

export function drawPresence(c: CanvasRenderingContext2D, id: string, look: Look, time: number, powered: boolean, attacking: boolean) {
  const boss = id === 'sukuna' || id === 'gojo' || id === 'shadowdio';
  if (!boss && !powered && !attacking) return;
  c.save(); c.globalAlpha *= powered ? .55 : attacking ? .32 : .17;
  c.strokeStyle = look.energy; c.lineWidth = 1.2;
  if (id === 'gojo') {
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, -44, 32 + i * 4, 47, Math.sin(time * .018 + i) * .5, i + time * .018, i + time * .018 + 3.8); c.stroke(); }
    for (let i = 0; i < 7; i++) disc(c, Math.sin(i * 2.4 + time * .02) * 40, -44 + Math.cos(i * 2.4 + time * .02) * 53, 1.2, i % 2 ? '#8deaff' : '#ddc0ff');
  } else if (id === 'sukuna') {
    // Cursed-energy presence: orbiting motes only. No trailing shapes behind him.
    for (let i = 0; i < 9; i++) {
      const a = time * .022 + i * (TAU / 9), r = 27 + (i % 3) * 5;
      const x = Math.cos(a) * r, y = -46 + Math.sin(a) * (r + 12);
      c.globalAlpha = (i % 2 ? .55 : .9) * (0.4 + Math.sin(a * 2) * .3);
      disc(c, x, y, 1 + (i % 2), i % 3 ? '#ff2347' : '#ffd4cb');
    }
    c.globalAlpha = 1;
  } else if (id === 'shadowdio') {
    // Clock-hand motes: the visual signature of stopped time.
    for (let i = 0; i < 6; i++) {
      const a = time * (i % 2 ? .03 : -.022) + i * (TAU / 6);
      const r = 24 + (i % 3) * 7;
      const px = Math.cos(a) * r, py = -46 + Math.sin(a) * (r + 16);
      c.globalAlpha = (i % 2 ? .5 : .85) * (0.4 + Math.sin(a * 2) * .35);
      disc(c, px, py, 1.1 + (i % 2) * .6, i % 3 ? '#8affd0' : '#ffe45c');
      c.strokeStyle = i % 3 ? '#8affd0' : '#ffe45c'; c.lineWidth = .8;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - Math.cos(a) * 4, py - Math.sin(a) * 4); c.stroke();
    }
    c.globalAlpha = 1;
  } else {
    for (let i = 0; i < 4; i++) {
      const phase = (time * .008 + i * .25) % 1;
      c.beginPath(); c.moveTo(-28 + i * 17, -12 - phase * 66); c.quadraticCurveTo(-40 + i * 20, -35 - phase * 40, -22 + i * 16, -63 - phase * 40); c.stroke();
    }
  }
  c.restore();
}
