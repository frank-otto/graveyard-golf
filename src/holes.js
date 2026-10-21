// The nine holes of Graveyard Golf, in local hole coordinates (metres; tee near z = 0, play towards -z).
// Pure data + pure functions of time: physics, aim solver, video and visuals all read the same obstacle poses.
const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const bowl = (x, z, cx, cz, d, r2) => -d * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / r2);
// periodic open/close: fraction open 0..1 with eased transitions (period P, open time o, move time m)
export function cycle(t, P, o, m, ph = 0) { const u = ((t + ph) % P + P) % P; if (u < m) return sm(u / m); if (u < m + o) return 1; if (u < 2 * m + o) return 1 - sm((u - m - o) / m); return 0; }
export const HOLES = [
  { id: 1, key: 'h1', par: 2, off: [-19, 0], tee: [0, 0], cup: [0, -9.6],
    poly: [[[-1.2, 1.2], [1.2, 1.2], [1.2, -11], [-1.2, -11]]],
    h: (x, z) => .14 * sm((-z - 1.5) / 6) + bowl(x, z, 0, -9.6, .05, .5),
    stat: [{ k: 'box', x: -.62, z: -4.6, w: .62, d: .18, r: .12 }, { k: 'box', x: .66, z: -6.6, w: .6, d: .18, r: -.18 }],
    dyn: [], deco: { gate: -2.2 } },
  { id: 2, key: 'h2', par: 3, off: [-12.5, 0], tee: [0, 0], cup: [5.4, -7.9], aim: [[0, -7.6]],
    poly: [[[-1.2, 1.2], [1.2, 1.2], [1.2, -6.2], [7.2, -6.2], [7.2, -9.6], [-1.2, -9.6]]],
    h: (x, z) => .1 * sm((-z) / 7) * (1 - sm((x - 1) / 3)) + .02 * x * (x > 1 ? 1 : 0) * 0 + bowl(x, z, 5.4, -7.9, .06, .6),
    stat: [{ k: 'box', x: -.2, z: -8.5, w: .7, d: .2, r: .55 }, { k: 'box', x: 2.6, z: -8.9, w: .6, d: .18, r: -.3 }, { k: 'box', x: 3.4, z: -6.9, w: .55, d: .18, r: .4 }, { k: 'post', x: .9, z: -3, r: .16 }],
    dyn: [] },
  { id: 3, key: 'h3', par: 3, off: [-4, 0], tee: [0, 0], cup: [0, -11.6],
    poly: [[[-1.3, 1.2], [1.3, 1.2], [1.3, -13], [-1.3, -13]]],
    h: (x, z) => .22 * sm((-z - 9) / 3) + bowl(x, z, 0, -11.6, .06, .5),
    stat: [],
    dyn: [{ k: 'pend', z: -4.4, amp: 1.0, w: 1.7, ph: 0, hw: .32, hd: .1 }, { k: 'pend', z: -7.8, amp: 1.0, w: 1.7, ph: 2.2, hw: .32, hd: .1 }] },
  { id: 4, key: 'h4', par: 3, off: [3, 0], tee: [0, 0], cup: [0, -11.6],
    poly: [[[-1.6, 1.2], [1.6, 1.2], [1.6, -13], [-1.6, -13]]],
    pits: [[-1.3, -5.4, -.3, -3.5], [.3, -8.6, 1.3, -6.7]],
    h: (x, z) => bowl(x, z, 0, -11.6, .06, .5) + .05 * Math.sin(x * 1.3) * sm((-z - 2) / 3),
    stat: [],
    dyn: [{ k: 'hand', x: .7, z: -3.4, P: 3.2, ph: 0 }, { k: 'hand', x: -.75, z: -6.4, P: 3.2, ph: 1.1 }, { k: 'hand', x: .05, z: -9.4, P: 2.8, ph: 2.0 }, { k: 'hand', x: -.9, z: -9.9, P: 3.6, ph: .4 }] },
  { id: 5, key: 'h5', par: 3, off: [9.5, 0], tee: [0, 0], cup: [0, -11],
    poly: [[[-1.3, 1.2], [1.3, 1.2], [1.3, -12.4], [-1.3, -12.4]]],
    h: (x, z) => .3 * sm((-z - 8) / 2.5) + bowl(x, z, 0, -11, .07, .6),
    stat: [],
    dyn: [{ k: 'mill', x: 0, z: -5.6, len: 1.22, w: 1.25, ph: 0 }] },
  { id: 6, key: 'h6', par: 3, off: [15, 0], tee: [0, 0], cup: [4.6, -11], aim: [[0, -5]],
    poly: [[[-1.3, 1.2], [1.3, 1.2], [1.3, -5], [-1.3, -5]], [[3.1, -3.6], [6.1, -3.6], [6.1, -12.4], [3.1, -12.4]]],
    h: (x, z) => x > 2.5 ? .04 * Math.sin(z * 1.1) + bowl(x, z, 4.6, -11, .06, .5) : 0,
    tunnel: { x: 0, z: -5, w: .72, exit: [4.6, -3.9], dir: [0, -1], delay: .9, keep: .92 },
    stat: [{ k: 'box', x: -.83, z: -5.05, w: .94, d: .1, r: 0, inv: 1 }, { k: 'box', x: .83, z: -5.05, w: .94, d: .1, r: 0, inv: 1 }],
    dyn: [{ k: 'bat', cx: 4.6, cz: -7.6, ax: 1.1, az: .9, w: 1.3, ph: 0 }, { k: 'bat', cx: 4.6, cz: -9.2, ax: 1.2, az: .7, w: 1.1, ph: 2.5 }] },
  { id: 7, key: 'h7', par: 3, off: [-7.5, -20], tee: [0, 0], cup: [0, -12],
    poly: [[[-1.7, 1.2], [1.7, 1.2], [1.7, -13.4], [-1.7, -13.4]]],
    h: (x, z) => .16 * Math.exp(-((x + .5) ** 2 / 1.2 + (z + 3.4) ** 2 / 1.6)) + .1 * Math.exp(-((x - .8) ** 2 / 1 + (z + 9) ** 2 / 1.2)) + bowl(x, z, 0, -12, .06, .5),
    portal: [0, -1.2],
    stat: [{ k: 'box', x: -1.0, z: -7.4, w: .55, d: .18, r: .3 }, { k: 'box', x: 1.05, z: -5.2, w: .55, d: .18, r: -.25 }],
    dyn: [{ k: 'ghost', x0: 0, z: -7.0, amp: 1.25, w: .9, ph: 0, r: .36, P: 5.2 }] },
  { id: 8, key: 'h8', par: 3, off: [7.5, -20], tee: [0, 0], cup: [0, -10.6],
    poly: [[[-1.3, 1.2], [1.3, 1.2], [1.3, -12.6], [-1.3, -12.6]]],
    pits: [[-1.3, -6.5, 1.3, -5.0]], deep: 1,
    h: (x, z) => z > -5.0 ? .42 * Math.pow(Math.min(1, Math.max(0, (-z - 2.6) / 2.4)), 2) : .18 * sm((-z - 11) / 1.6) + bowl(x, z, 0, -10.6, .08, .55),
    stat: [],
    dyn: [] },
  { id: 9, key: 'h9', par: 4, off: [0, -20], tee: [0, 0], cup: [0, -17.2], big: 1,
    poly: [[[-1.4, 1.2], [1.4, 1.2], [1.4, -9], [.45, -9.7], [.45, -12.6], [1.6, -13.4], [1.6, -18.6], [-1.6, -18.6], [-1.6, -13.4], [-.45, -12.6], [-.45, -9.7], [-1.4, -9]]],
    h: (x, z) => { const up = .5 * sm((-z - 5.8) / 3.6); const dn = sm((-z - 12.6) / 1.1); return up * (1 - dn) + bowl(x, z, 0, -17.2, .06, .5); },
    stat: [],
    dyn: [{ k: 'door', hx: -.45, hz: -12.6, len: .9, a0: 0, a1: -Math.PI / 2 + .05, P: 4.6, o: 2.0, m: .55, ph: 0, flap: 1 },
      { k: 'door', hx: -1.6, hz: -14, len: 1.58, a0: 0, a1: Math.PI / 2 - .08, P: 5.4, o: 2.6, m: .7, ph: .6 }, { k: 'door', hx: 1.6, hz: -14, len: 1.58, a0: Math.PI, a1: Math.PI / 2 + .08, P: 5.4, o: 2.6, m: .7, ph: .6 }] }
];
// ---- obstacle poses (pure functions of time; k = speed factor per difficulty) ----
export function pose(o, t) {
  switch (o.k) {
    case 'pend': { const a = Math.sin(t * o.w + o.ph); return { x: o.amp * a, z: o.z, ang: a * .62 }; }
    case 'hand': { const u = (((t + o.ph) % o.P) + o.P) % o.P / o.P; const up = u < .12 ? sm(u / .12) : u < .55 ? 1 : u < .67 ? 1 - sm((u - .55) / .12) : 0; return { up, wave: Math.sin(t * 7 + o.ph * 3) }; }
    case 'mill': return { ang: t * o.w + o.ph };
    case 'bat': { const a = t * o.w + o.ph; const y = .16 + .55 * (.5 + .5 * Math.cos(a * 2)); return { x: o.cx + o.ax * Math.sin(a), z: o.cz + o.az * Math.sin(a * 2), y, flap: t * 16 + o.ph, low: y < .34 }; }
    case 'ghost': { const vis = cycle(t, o.P, o.P * .62, .45, 0); return { x: o.x0 + o.amp * Math.sin(t * o.w + o.ph), z: o.z, vis, solid: vis > .5 }; }
    case 'door': { const f = cycle(t, o.P, o.o, o.m, o.ph); return { ang: o.a0 + (o.a1 - o.a0) * f, f }; }
  }
  return {};
}
// colliders of one dynamic obstacle at time t: segments [ax, az, bx, bz] and circles [x, z, r]
function boxSegs(cx, cz, hw, hd, r, out, mat) { const c = Math.cos(r), s = Math.sin(r), P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
  for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; out.push({ s: 1, a: a[0], b: a[1], c: b[0], d: b[1], e: mat.e, m: mat.m }); } }
export function dynColliders(o, t, out) {
  const p = pose(o, t);
  if (o.k === 'pend') boxSegs(p.x, o.z, o.hw, o.hd, 0, out, { e: .6, m: 'wood' });
  else if (o.k === 'hand') { if (p.up > .35) out.push({ s: 0, x: o.x, z: o.z, r: .13 * (.6 + .4 * p.up), e: .5, m: 'hand' }); }
  else if (o.k === 'mill') { const c = Math.cos(p.ang), s = Math.sin(p.ang); out.push({ s: 1, a: o.x - c * o.len, b: o.z - s * o.len, c: o.x + c * o.len, d: o.z + s * o.len, e: .55, m: 'wood' }); out.push({ s: 0, x: o.x, z: o.z, r: .12, e: .6, m: 'wood' }); }
  else if (o.k === 'bat') { if (p.low) out.push({ s: 0, x: p.x, z: p.z, r: .16, e: .9, m: 'bat' }); }
  else if (o.k === 'ghost') { if (p.solid) out.push({ s: 0, x: p.x, z: p.z, r: o.r, e: 0, m: 'ghost', trig: 'ghost' }); }
  else if (o.k === 'door') out.push({ s: 1, a: o.hx, b: o.hz, c: o.hx + Math.cos(p.ang) * o.len, d: o.hz + Math.sin(p.ang) * o.len, e: .45, m: o.flap ? 'wood' : 'iron' });
}
export function statColliders(H) { const out = [];
  for (const P of H.poly) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (H.tunnel && Math.abs(a[1] - H.tunnel.z) < 1e-6 && Math.abs(b[1] - H.tunnel.z) < 1e-6) continue; out.push({ s: 1, a: a[0], b: a[1], c: b[0], d: b[1], e: .72, m: 'stone' }); }
  for (const o of H.stat) { if (o.k === 'box') boxSegs(o.x, o.z, o.w / 2, o.d / 2, o.r, out, { e: .66, m: 'stone' }); else out.push({ s: 0, x: o.x, z: o.z, r: o.r, e: .66, m: 'stone' }); }
  return out; }
export function inPoly(P, x, z) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
// floor height at (x, z) or null (open grave / outside the course)
export function floorAt(H, x, z) { let inside = false; for (const P of H.poly) if (inPoly(P, x, z)) { inside = true; break; } if (!inside) return null;
  if (H.pits) for (const [x0, z0, x1, z1] of H.pits) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return null; return H.h(x, z); }
export const PAR_TOTAL = HOLES.reduce((a, H) => a + H.par, 0);
