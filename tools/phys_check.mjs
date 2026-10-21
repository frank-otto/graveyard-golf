import { HOLES, floorAt } from '../src/holes.js';
import { makeBall, solve, simulate } from '../src/physics.js';
for (const H of HOLES) {
  let t0 = Date.now(); const res = [];
  for (const st of [0, 0.7, 1.4, 2.1]) { const b = makeBall(H, H.tee[0], H.tee[1], st); const s = solve(b, H, 1); res.push(`${st}:${s.sink ? 'ACE' : 'd' + s.d.toFixed(2)}${s.lost ? 'L' : ''}(a${s.ang.toFixed(3)} p${s.pow.toFixed(2)})`); }
  console.log(H.id, 'par', H.par, ((Date.now() - t0) / 4).toFixed(0) + 'ms/solve', res.join(' '));
}
