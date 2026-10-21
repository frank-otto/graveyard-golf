// Ball physics for Graveyard Golf: fixed 240 Hz sub-steps on an absolute time line, so the aim solver, the arc guide,
// the tests and the game all compute exactly the same roll (moving obstacles are pure functions of time).
import { HOLES, floorAt, statColliders, dynColliders, pose } from './holes.js';
export const R = .075, CUP = .17, G = 9.81, HS = 1 / 240, VMAX = 6.8, MU = .108, LIN = .05;
export const powToV = p => .2 + (VMAX - .2) * Math.sqrt(Math.min(1, Math.max(0, p))); // roll distance grows ~linearly with power
export const vToPow = v => Math.min(1, Math.max(0, (v - .2) / (VMAX - .2)) ** 2);
const STAT = HOLES.map(statColliders);
export function makeBall(H, x, z, t) { const y = floorAt(H, x, z) ?? 0; return { x, y, z, vx: 0, vy: 0, vz: 0, air: false, t, state: 'rest', rest: 0, wall: 0, lip: 0, jumped: 0, tunnel: 0, ghosted: 0, tunT: 0, sinkT: 0, gvy: 0, hidden: false, cushions: 0 }; }
export function cloneBall(b) { return Object.assign({}, b); }
const dyn = [], tmp = [];
// one physics sub-step; ev(name, data) receives events (hit, bounce, lip, sink, pit, tunnel, exit, ghost, launch, land)
export function stepBall(b, H, k, ev) {
  const h = HS; b.t += h; const T = b.t * k;
  if (b.state === 'tunnel') { if (b.t >= b.tunT) { const tn = H.tunnel; b.state = 'roll'; b.hidden = false; b.x = tn.exit[0]; b.z = tn.exit[1]; const s = Math.max(1.2, b.ts * tn.keep); b.vx = tn.dir[0] * s; b.vz = tn.dir[1] * s; b.y = floorAt(H, b.x, b.z) ?? 0; b.air = false; ev && ev('exit', b); } return; }
  if (b.state === 'sink') { b.sinkT += h; b.y -= h * .9; b.vx *= .9; b.vz *= .9; b.x += (H.cup[0] - b.x) * .2; b.z += (H.cup[1] - b.z) * .2; if (b.sinkT > .5) b.state = 'in'; return; }
  if (b.state === 'pit') { b.vy -= G * h; b.y += b.vy * h; b.x += b.vx * h * .3; b.z += b.vz * h * .3; b.pitT = (b.pitT || 0) + h; if (b.pitT > .7) b.state = 'lost'; return; }
  if (b.state !== 'roll') return;
  const hx = b.x, hz = b.z;
  if (!b.air) {
    const f0 = floorAt(H, b.x, b.z); const e = .01;
    const fx1 = floorAt(H, b.x + e, b.z), fx0 = floorAt(H, b.x - e, b.z), fz1 = floorAt(H, b.x, b.z + e), fz0 = floorAt(H, b.x, b.z - e);
    const gx = fx1 != null && fx0 != null ? (fx1 - fx0) / (2 * e) : 0, gz = fz1 != null && fz0 != null ? (fz1 - fz0) / (2 * e) : 0; const n2 = 1 + gx * gx + gz * gz;
    b.vx += -G * 5 / 7 * gx / n2 * h; b.vz += -G * 5 / 7 * gz / n2 * h;
    const s = Math.hypot(b.vx, b.vz); if (s > 0) { const ns = Math.max(0, s - (MU * G + LIN * s) * h); b.vx *= ns / s; b.vz *= ns / s; }
    b.x += b.vx * h; b.z += b.vz * h;
    const f1 = floorAt(H, b.x, b.z);
    if (f1 == null) { b.air = true; b.vy = b.gvy; b.y += b.vy * h; ev && ev('launch', b); }
    else { const yb = b.y + b.gvy * h - .5 * G * h * h; if (f1 < yb - .0025 && b.gvy > .3) { b.air = true; b.vy = b.gvy; b.y = yb; ev && ev('launch', b); } else { b.gvy = (f1 - b.y) / h; b.y = f1; } }
    // at rest?
    if (!b.air && Math.hypot(b.vx, b.vz) < .045 && G * 5 / 7 * Math.hypot(gx, gz) < MU * G * .98) { b.rest += h; if (b.rest > .12) { b.vx = b.vz = 0; b.gvy = 0; b.state = 'rest'; ev && ev('rest', b); return; } } else b.rest = 0;
  } else {
    b.vy -= G * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    const f1 = floorAt(H, b.x, b.z);
    if (f1 != null && b.y <= f1) { b.y = f1; if (b.vy < -.9) { ev && ev('bounce', b, -b.vy); b.vy = -b.vy * .32; b.vx *= .9; b.vz *= .9; b.jumped = Math.max(b.jumped, 1); } else { ev && ev('land', b); b.air = false; b.gvy = 0; b.vy = 0; } }
    else if (f1 == null && b.y < (H.deep ? -.25 : -.05) - .2) { b.state = 'pit'; b.vy = Math.min(b.vy, -.5); ev && ev('pit', b); return; }
  }
  // tunnel mouth
  if (H.tunnel && b.state === 'roll') { const tn = H.tunnel; if (hz > tn.z && b.z <= tn.z && Math.abs(b.x - tn.x) < tn.w / 2) { b.state = 'tunnel'; b.hidden = true; b.ts = Math.hypot(b.vx, b.vz); b.tunT = b.t + tn.delay; b.tunnel++; ev && ev('tunnel', b); return; } }
  // collisions: walls/stones (static), moving obstacles
  const floorY = floorAt(H, b.x, b.z); const wallTop = (floorY ?? b.y) + .24;
  dyn.length = 0; for (let oi = 0; oi < H.dyn.length; oi++) { const s0 = dyn.length; dynColliders(H.dyn[oi], T, dyn); for (let j = s0; j < dyn.length; j++) { dyn[j].oi = oi; dyn[j].j = j - s0; } }
  const lists = [STAT[H.id - 1], dyn];
  for (let li = 0; li < 2; li++) for (const c of lists[li]) {
    let qx, qz; if (c.s) { const dx = c.c - c.a, dz = c.d - c.b, L2 = dx * dx + dz * dz; let u = L2 > 0 ? ((b.x - c.a) * dx + (b.z - c.b) * dz) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u; qx = c.a + dx * u; qz = c.b + dz * u; c.u = u; } else { qx = c.x; qz = c.z; }
    let nx = b.x - qx, nz = b.z - qz; const d = Math.hypot(nx, nz), rr = R + (c.s ? 0 : c.r);
    if (d >= rr || b.y > wallTop + (c.m === 'bat' ? .2 : 0)) continue;
    if (c.trig === 'ghost') { if (H.portal) { b.ghosted++; ev && ev('ghost', b); b.x = H.portal[0]; b.z = H.portal[1]; b.vx = b.vz = 0; b.y = floorAt(H, b.x, b.z) ?? 0; b.air = false; b.gvy = 0; b.state = 'rest'; return; } continue; }
    if (d < 1e-6) { nx = 0; nz = 1; } else { nx /= d; nz /= d; }
    // obstacle velocity at the contact point (finite difference of the pose)
    let ux = 0, uz = 0; if (li === 1) { tmp.length = 0; dynColliders(H.dyn[c.oi], T + .004, tmp); const c2 = tmp[c.j];
      if (c2 && c2.s === c.s) { let q2x, q2z; if (c2.s) { q2x = c2.a + (c2.c - c2.a) * c.u; q2z = c2.b + (c2.d - c2.b) * c.u; } else { q2x = c2.x; q2z = c2.z; } ux = (q2x - qx) / .004 * k; uz = (q2z - qz) / .004 * k; } }
    b.x = qx + nx * (rr + .0005); b.z = qz + nz * (rr + .0005);
    const rvx = b.vx - ux, rvz = b.vz - uz, vn = rvx * nx + rvz * nz;
    if (vn < 0) { const tx = rvx - vn * nx, tz = rvz - vn * nz; const nvx = tx * .94 - vn * c.e * nx, nvz = tz * .94 - vn * c.e * nz; b.vx = nvx + ux; b.vz = nvz + uz; if (-vn > .25) { b.cushions++; ev && ev('hit', b, -vn, c.m); } }
    else if (ux || uz) { const un = ux * nx + uz * nz; if (un > 0) { b.vx += nx * un * 1.0; b.vz += nz * un * 1.0; ev && ev('hit', b, un, c.m); } }
    b.rest = 0;
  }
  const sp = Math.hypot(b.vx, b.vz); if (sp > 14) { b.vx *= 14 / sp; b.vz *= 14 / sp; }
  // the cup: capture speed shrinks towards the rim; too fast and off-centre = lip-out, dead-centre and too fast = hop over
  const cx = b.x - H.cup[0], cz = b.z - H.cup[1], dc = Math.hypot(cx, cz);
  if (b.lip > 0) b.lip -= h;
  if (dc < CUP && b.y - (floorY ?? b.y) < .06) { const s = Math.hypot(b.vx, b.vz), vcap = .35 + 1.3 * Math.sqrt(Math.max(0, 1 - (dc / CUP) ** 2));
    if (s < vcap) { b.state = 'sink'; b.sinkT = 0; ev && ev('sink', b, s); return; }
    if (b.lip <= 0) { b.lip = .25; if (dc > CUP * .42) { const side = Math.sign(cx * b.vz - cz * b.vx) || 1; const a = side * (.55 + .4 * (1 - dc / CUP)), c = Math.cos(a), s2 = Math.sin(a); const vx = b.vx * c - b.vz * s2, vz = b.vx * s2 + b.vz * c; b.vx = vx * .72; b.vz = vz * .72; ev && ev('lip', b, s); }
      else { b.vx *= .82; b.vz *= .82; b.air = true; b.vy = Math.min(1.1, s * .22); ev && ev('hop', b, s); } } }
  if (!Number.isFinite(b.x + b.z + b.y + b.vx + b.vz + b.vy)) { b.x = H.tee[0]; b.z = H.tee[1]; b.y = floorAt(H, b.x, b.z) ?? 0; b.vx = b.vz = b.vy = 0; b.state = 'rest'; b.air = false; }
}
export function shoot(b, ang, pow) { const v = powToV(pow); b.vx = Math.sin(ang) * v; b.vz = -Math.cos(ang) * v; b.vy = 0; b.gvy = 0; b.state = 'roll'; b.air = false; b.rest = 0; b.lip = 0; b.cushions = 0; b.jumped = 0; b.tunnel = 0; b.ghosted = 0; }
// simulate a shot from a resting ball (a copy); returns the outcome
export function simulate(b0, H, ang, pow, k = 1, maxT = 9, onStep) { const b = cloneBall(b0); shoot(b, ang, pow); let n = 0, minD = 1e9, ev0 = null; const N = Math.round(maxT / HS);
  const ev = (e) => { if (e === 'sink' || e === 'pit' || e === 'ghost') ev0 = ev0 || e; };
  for (; n < N; n++) { stepBall(b, H, k, ev); const d = Math.hypot(b.x - H.cup[0], b.z - H.cup[1]); if (d < minD) minD = d; if (onStep && onStep(b, n)) break; if (b.state === 'rest' || b.state === 'in' || b.state === 'sink' || b.state === 'lost') break; }
  return { b, sink: b.state === 'sink' || b.state === 'in', lost: b.state === 'lost' || b.state === 'pit', ghost: !!b.ghosted, minD, d: Math.hypot(b.x - H.cup[0], b.z - H.cup[1]), t: n * HS }; }
// aim solver: coarse grid over direction x power, then a local refinement. Prefers sinking; otherwise the closest safe rest.
export function solve(b0, H, k = 1, opt = {}) { const base = Math.atan2(H.cup[0] - b0.x, -(H.cup[1] - b0.z)); let best = null;
  const score = r => r.sink ? -10 + r.t * .01 : r.lost ? 50 : (r.ghost ? 8 : 0) + r.d + r.minD * .3;
  const tryShot = (a, p) => { const r = simulate(b0, H, a, p, k, opt.maxT || 8); const s = score(r); if (!best || s < best.s) best = { a, p, s, r }; return r; };
  const NA = opt.na || 60, NP = opt.np || 9, span = opt.span || Math.PI;
  for (let i = 0; i < NA; i++) { const a = base + (i / NA * 2 - 1) * span; for (let j = 1; j <= NP; j++) tryShot(a, j / (NP + 1)); }
  for (let pass = 0; pass < (opt.passes || 3); pass++) { if (best.r.sink && pass > 0) break; const a0 = best.a, p0 = best.p, da = span / NA * Math.pow(.35, pass), dp = .5 / NP * Math.pow(.4, pass);
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) tryShot(a0 + i * da / 1.5, Math.min(1, Math.max(.02, p0 + j * dp / 1.5))); }
  return { ang: best.a, pow: best.p, sink: best.r.sink, d: best.r.d, lost: best.r.lost, t: best.r.t }; }
