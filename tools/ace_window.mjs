import { HOLES } from '../src/holes.js';
import { makeBall, simulate } from '../src/physics.js';
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
for (const H of HOLES) { if (only && !only.includes(H.id)) continue;
  const b = makeBall(H, H.tee[0], H.tee[1], 0); const base = Math.atan2(H.cup[0] - b.x, -(H.cup[1] - b.z)); let n = 0, ace = 0, lost = 0, near = 0, sumd = 0; const aces = [];
  for (let i = 0; i <= 80; i++) for (let j = 0; j <= 24; j++) { const a = base + (i / 80 * 2 - 1) * .7, p = .25 + j / 24 * .75; const r = simulate(b, H, a, p, 1, 9); n++; if (r.sink) { ace++; aces.push([a.toFixed(2), p.toFixed(2)]); } else if (r.lost) lost++; else { if (r.d < 1) near++; sumd += r.d; } }
  console.log(H.id, `ace ${(ace / n * 100).toFixed(1)}%  lost ${(lost / n * 100).toFixed(0)}%  near<1m ${(near / n * 100).toFixed(0)}%`, aces.slice(0, 6).map(x => x.join('/')).join(' '));
}
