// WebAudio for the embedded CC0 recordings (window.GG_SOUNDS): zombie groans and grunts, wood, bone and stone thuds,
// a creaking crane rope, chains, thunder, rain and wind, bats, a real pipe organ (VSCO 2 CE), timpani, contrabass and
// pizzicato strings. Nothing is synthesized: pitched instruments re-pitch the nearest recorded note; the graveyard
// echo is a generated convolution reverb (processing only).
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  hp: { D4: 62, A4: 69 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.2) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
export function state() { return ctx ? ctx.state : 'none'; }
export function isReady() { return ready; }
export async function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.GG_SOUNDS || {};
  // base64 → bytes is synchronous: do it a few sounds per tick so the first tap never freezes a frame (beds and loops first)
  const keys = Object.keys(src).sort((a, b) => (b.endsWith('_loop') || b === 'wind') - (a.endsWith('_loop') || a === 'wind')); const jobs = [];
  for (let i = 0; i < keys.length; i += 4) { for (const k of keys.slice(i, i + 4)) jobs.push(new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })); await new Promise(r => setTimeout(r, 0)); }
  await Promise.all(jobs);
  ready = true; window.__ggAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
export const sfx = {
  ui() { play('knock', .22, 1.0, 0, .15); },
  aim() { play('putt_soft', .12, .7, 0, .2); },
  putt(k = .5, pan = 0) { k = Math.max(0, Math.min(1, k)); play('putt', .5 + k * .45, (.92 - k * .12) * jit(.03), 0, .3, 0, pan); play('thump', .18 + k * .4, .9, 0, .2, 0, pan); if (k > .55) play('sub', .25 * k, 1, 0, .1); if (k > .8) play('whoosh', .22 * k, .6, .01, .3, 0, pan); },
  wall(k, mat, pan = 0) { k = Math.max(.08, Math.min(1, k / 4)); if (mat === 'wood') { play(rr(['thud_wood', 'wall_2']), .25 + k * .55, .85 * jit(), 0, .35, 0, pan); }
    else if (mat === 'iron') { play('clank', .2 + k * .4, .62 * jit(), 0, .45, 0, pan); play('wall_1', .3 * k, .8, 0, .3, 0, pan); }
    else if (mat === 'hand') { play('splat', .3 + k * .3, .7, 0, .3, 0, pan); play(rr(['groan_short', 'groan_1']), .35, 1 * jit(), .05, .45, 0, pan); }
    else if (mat === 'bat') { play('flap_1', .4, .8, 0, .3, 0, pan); play('bats', .3, 1, .02, .4, 1, pan); }
    else { play(rr(['wall_1', 'wall_2']), .3 + k * .6, (.8 + .1 * k) * jit(), 0, .35, 0, pan); play('stone_1', .1 + k * .25, .7, .005, .35, 0, pan); } },
  bounce(k, pan = 0) { play(rr(['bounce_1', 'bounce_2']), Math.min(.8, .2 + k * .15), .78 * jit(), 0, .3, 0, pan); play('thump_b', Math.min(.5, k * .1), 1.1, 0, .2, 0, pan); },
  launch() { play('swoosh_rise', .35, 1.05, 0, .4); },
  cup(ace) { play(rr(['cup', 'cup_b', 'cup_c']), .85, .95 * jit(.03), 0, .35); play('thump', .35, .7, .05, .3); if (!ace) [50, 53, 57].forEach((m, i) => note('org', m + 12 * 0, .22 - i * .03, 1.6, .12 + i * .05, .6)); },
  lip() { play('cup_c', .5, 1.1, 0, .3); play('knock', .3, .7, .02, .3); },
  hop() { play('bounce_1', .5, .8, 0, .3); },
  pit() { play('body_fall', .45, .8, .15, .4); play('dirt', .5, .8, .2, .35); play('groan_short', .35, .9, .5, .5); },
  tunnel() { play('tunnel', .7, 1, 0, .55, 1.6); play('roll_heavy', .5, .8, 0, .6); },
  exit() { play('fwoosh', .45, .7, 0, .5); play('thump_b', .35, .7, 0, .3); },
  ghost() { play('ghosts', .6, 1, 0, .6, 2.2); play('boo', .45, .85, 0, .55); play('whisper', .35, .9, .2, .6); play('swoosh_rise', .3, .7, .1, .5); },
  creak(kind, pan = 0) { if (kind === 'iron') play('iron_creak', .35, .85 * jit(), 0, .55, 0, pan); else if (kind === 'gate') play('gate_creak', .4, .9, 0, .55, 0, pan); else play('lid_creak', .32, .9 * jit(), 0, .5, 0, pan); },
  handUp(pan = 0) { play('dirt', .35, .8 * jit(), 0, .35, 0, pan); play('crumble', .2, 1.1, 0, .3, 0, pan); },
  mill() { play('creak_1', .2, .7, 0, .5); },
  score(name) { const m = { eagle: 0, birdie: 1, par: 2, bogey: 3 }[name];
    if (name === 'eagle' || name === 'albatross') { [38, 45, 50, 53, 57, 62].forEach((x, i) => note(i < 2 ? 'ped' : 'org', x, i < 2 ? .5 : .3, 2.6, i * .02, .7)); play('choir_swell', .45, 1, .1, .7); play('bell_strike', .45, .9, 0, .6); play('tproll', .3, 1, 0, .5, 1.2); }
    else if (name === 'birdie') { [50, 54, 57, 62].forEach((x, i) => note('org', x, .26, 1.8, i * .06, .65)); note('ped', 38, .4, 1.8, 0, .6); play('harp', .3, 1, .1, .6); play(rr(['tp_1', 'tp_2']), .35, 1, 0, .4); }
    else if (name === 'par') { [50, 53, 57].forEach((x, i) => note('org', x, .22, 1.4, i * .02, .6)); play('tp_3', .3, 1, 0, .4); }
    else { [48, 51].forEach((x, i) => note('org', x, .2, 1.4, i * .03, .6)); note('ped', 24, .35, 1.6, 0, .6); play('crow', .3, 1, .3, .5); } },
  ace() { play('boom_cine', 1, 1, 0, .4); play('hit_dram', .85, .9, 0, .5); play('bell_deep', .85, .85, 0, .7); play('sub', .9, 1, 0, .2); play('gong', .55, .75, .04, .6); play('crash', .35, .8, .05, .6);
    [26, 33, 38].forEach((m, i) => note('ped', m, .55, 4.5, i * .02, .7)); [50, 53, 57, 62, 65].forEach((m, i) => note('org', m, .28, 4, .04 + i * .02, .7)); play('choir_swell', .6, 1, .15, .7); play('choir_ah', .4, .9, .6, .7);
    play('rumble', .6, 1, .1, .4); play('groan_crowd', .65, 1, .7, .55); play('stone_grind', .55, .9, .9, .5); play('thunder_big', .45, .9, .4, .4); play('bell_deep', .6, .8, 1.8, .7); play('applause', .3, .8, 1.6, .5, 3); },
  wakeHand(pan = 0) { play(rr(['dirt', 'crumble', 'gravel_1']), .35, .8 * jit(), 0, .35, 0, pan); if (R() < .4) play(rr(['groan_1', 'groan_2', 'groan_3', 'groan_short']), .4, jit(), .1, .5, 0, pan); },
  holeStart() { play('bell_strike', .35, .8, 0, .6); play('swoosh_rise', .25, .9, .1, .4); },
  mulligan() { play('glissup', .3, .8, 0, .5); play('whisper', .3, 1.1, 0, .5); },
  turn() { play('bell_far', .35, 1, 0, .6); },
  win() { play('success', .4, .9, 0, .4); play('choir_ah', .3, 1, .1, .6); play('bell_strike', .35, .9, 0, .6); },
  cheer() { play('cheer', .3, .9, 0, .4); play('applause', .3, 1, .1, .4); },
  owl() { play('owl', .22, 1, 0, .6, 0, (R() - .5) * 1.4); }, crow() { play('crow', .24, 1, 0, .5, 0, (R() - .5) * 1.2); }, howl() { play('howl', .28, 1, 0, .7, 0, (R() - .5) * 1.2); },
  stinger() { play('stinger', .35, 1, 0, .5); }, kids() { play('laugh_kids', .4, 1, 0, .4); }, tick() { play('knock', .2, 1.3, 0, .1); },
  bats() { play('bat_swarm', .5, 1, 0, .4, 4); play('bats', .4, 1, .2, .4); }
};
