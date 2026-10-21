// Music, all played on recorded samples (VSCO 2 CE, CC0): an original D-minor "graveyard swing" (4/4) – walking
// contrabass pizzicato, pipe-organ chords, pizzicato violins, harp and timpani. Layers join as the round goes on.
import { note, play } from './audio.js';
const CH = { Dm: { b: [38, 41, 45, 43], p: [62, 65, 69, 74], o: [50, 53, 57] }, Bb: { b: [34, 38, 41, 39], p: [58, 62, 65, 70], o: [50, 53, 58] }, Gm: { b: [31, 34, 38, 36], p: [55, 58, 62, 67], o: [50, 55, 58] },
  A: { b: [33, 37, 40, 37], p: [57, 61, 64, 69], o: [49, 52, 57] }, F: { b: [29, 33, 36, 38], p: [57, 60, 65, 69], o: [48, 53, 57] }, C: { b: [36, 40, 43, 40], p: [55, 60, 64, 67], o: [48, 52, 55] } };
const GROOVES = {
  menu: { bpm: 84, beats: 4, prog: ['Dm', 'Bb', 'Gm', 'A'], bar(b, c, k) { const E = [];
    E.push([0, () => c.o.forEach(m => note('org', m, .075 * k, 3.4, 0, .75))]); E.push([0, () => note('cb', c.b[0], .34 * k, 0, 0, .4)]); E.push([2, () => note('cb', c.b[2], .26 * k, 0, 0, .4)]);
    E.push([1, () => note('pz', c.p[1], .09 * k, 0, 0, .45, -.3)]); E.push([3, () => note('pz', c.p[2], .09 * k, 0, 0, .45, .3)]); if (b % 2 === 1) E.push([2.5, () => note('hp', c.p[3], .09 * k, 0, 0, .6)]); return E; } },
  game: { bpm: 100, beats: 4, prog: ['Dm', 'Dm', 'Bb', 'A', 'Gm', 'C', 'F', 'A'], bar(b, c, k, I) { const E = [];
    for (let q = 0; q < 4; q++) E.push([q, () => note('cb', c.b[q], (q === 0 ? .4 : .3) * k, 0, 0, .35)]);
    E.push([1.66, () => note('pz', c.p[0], .1 * k, 0, 0, .4, -.25)]); E.push([3.66, () => note('pz', c.p[1], .1 * k, 0, 0, .4, .25)]);
    E.push([0, () => c.o.forEach(m => note('org', m, (.05 + .04 * I) * k, 3.6, 0, .75))]);
    if (I > .25) E.push([0, () => play('tp_4', .22 * k, Math.pow(2, ((c.b[0] - 40) % 12) / 24), 0, .4)]);
    if (I > .5) [1, 2, 3].forEach(q => E.push([q + .66, () => note('pz', c.p[(q + b) % 4], .08 * k, 0, 0, .45, (q - 2) * .3)]));
    if (b % 4 === 0) E.push([0, () => play('bd', .24 * k, .8, 0, .4)]); if (b % 8 === 7) E.push([3, () => play('cymcresc', .08 * k, 1, 0, .5, .8)]); return E; } }
};
export class Player {
  constructor() { this.g = null; this.on = false; this.vol = 1; this.I = 0; }
  start(name, t0) { this.g = GROOVES[name]; this.name = name; this.t0 = t0; this.spb = 60 / this.g.bpm; this.bar = -1; this.q = []; this.on = true; }
  stop() { this.on = false; this.q = []; }
  step(t) { if (!this.on) return; const nb = this.g.beats; const b = Math.floor((t - this.t0) / this.spb / nb);
    while (this.bar < b + 1) { this.bar++; if (this.bar < 0) continue; const ch = CH[this.g.prog[this.bar % this.g.prog.length]]; for (const [be, f] of this.g.bar(this.bar, ch, this.vol, this.I)) this.q.push([this.t0 + (this.bar * nb + be) * this.spb, f]); this.q.sort((a, b2) => a[0] - b2[0]); }
    while (this.q.length && this.q[0][0] <= t) { const [, f] = this.q.shift(); f(); } }
}
