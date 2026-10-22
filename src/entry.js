import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createWorld, updateWorld, swarm, setStones, fogShader, gradeShader, QUALITY, toWorld } from './world.js';
import { createCourse, updateCourse } from './course.js';
import { HOLES, floorAt, PAR_TOTAL, pose } from './holes.js';
import { R, HS, makeBall, cloneBall, stepBall, shoot as shootBall, simulate, solve, vToPow } from './physics.js';
import { createFX, sparks, puff, updateFX } from './fx.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const CREDIT_TXT = 'Built with Grok Bot · 7 days to Halloween 🎃';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let seed = (window.__ggSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const eo = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3), eio = k => { k = clamp(k, 0, 1); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const browserLang = () => { try { return (navigator.languages && navigator.languages[0] || navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en'; } catch (e) { return 'en'; } };
// ---------------- rules ----------------
const DIFF = { easy: { over: 5, mull: 3, guide: 1, k: .85 }, medium: { over: 4, mull: 1, guide: .4, k: 1 }, hard: { over: 3, mull: 0, guide: .14, k: 1.25 }, kids: { over: 99, mull: 99, guide: 1, k: .75, help: 7 } };
const S = { state: 'intro', mode: 'campaign', lang: ls.get('gg-lang', '') || browserLang(), diff: ls.get('gg-diff', 'medium'), kids: ls.get('gg-kids', '0') === '1', q: ls.get('gg-q', ''), qUser: !!ls.get('gg-q', ''),
  name: ls.get('gg-name', 'Player') || 'Player', gt: 0, ts: 1, hi: 8, player: 0, sc: [[], []], strokes: 0, mulls: [0, 0], aces: [0, 0], tricks: [0, 0], birdies: [0, 0], phase: 'idle', aimAng: 0, aimPow: .5, aiming: false, kbAim: false, fovPunch: 0, vx: 0, vy: 0, obsOff: 0, view: 0, end: '', introT: 0, slow: 0, wakeT: null };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff, D = () => DIFF[dkey()], bestKey = () => `gg-best-${dkey()}`;
A.setClock(() => S.gt);
const t = k => T[S.lang][k] ?? T.en[k] ?? k;
const HOLE = () => HOLES[S.hi], OK = () => D().k;
// obstacles are pure functions of the obstacle clock; the ball's physics clock maps onto it exactly (T = physT * k)
const obsT = () => S.gt * OK() + S.obsOff, physT = () => S.gt + S.obsOff / OK();

// ---------------- renderer / scene / post ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__ggPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer, 13); const scene = W.scene; const C = createCourse(W);
const camera = new THREE.PerspectiveCamera(50, 1, .05, 400);
const F = createFX(scene, W.soft, W.smokeTex);
let composer, bloom, fogPass, gradePass;
function buildComposer() { if (composer) { for (const p of composer.passes) { try { p.dispose && p.dispose(); } catch (e) {} } for (const rt of [composer.renderTarget1, composer.renderTarget2]) { if (rt.depthTexture) rt.depthTexture.dispose(); rt.dispose(); } } // dispose the old passes too (bloom mips, shader quads): a quality switch used to leak ~11 GPU textures
  const q = QUALITY[S.q]; const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa || 0 }); rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.UnsignedIntType;
  composer = new EffectComposer(renderer, rt); composer.renderTarget2.depthTexture = new THREE.DepthTexture(4, 4); composer.renderTarget2.depthTexture.type = THREE.UnsignedIntType;
  composer.addPass(new RenderPass(scene, camera)); fogPass = new ShaderPass(fogShader()); composer.addPass(fogPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .42, .55, .86); composer.addPass(bloom); composer.addPass(new OutputPass()); gradePass = new ShaderPass(gradeShader()); composer.addPass(gradePass); }
function applyQuality(qn, user) {
  S.q = qn; if (user) { S.qUser = true; ls.set('gg-q', qn); } const q = QUALITY[qn];
  renderer.shadowMap.enabled = q.shadows; W.key.castShadow = q.shadows; if (q.shadows) { W.key.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (W.key.shadow.map) { W.key.shadow.map.dispose(); W.key.shadow.map = null; } }
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  buildComposer(); resize(); $('btnQ').textContent = '⚙ ' + t('q_' + qn); if (typeof qLabel === 'function') qLabel(); }
let VW = 1, VH = 1; const portrait = () => VW / VH < .85, wide = () => VW >= 820 && VW >= VH;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); } camera.aspect = VW / VH; camera.updateProjectionMatrix(); }

// ---------------- ball, ghost putter, aim guide, the stone slab ----------------
const ballG = new THREE.Group(); const ballM = new THREE.Mesh(C.ballGeo, C.ballMat); ballM.castShadow = true; ballG.add(ballM); scene.add(ballG);
const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#bfe8ff', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); ballGlow.scale.setScalar(.34); ballG.add(ballGlow);
let ball = null; // physics state (hole-local coords)
const putter = new THREE.Group(); { const m = new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#4fb8e8', emissiveIntensity: .22, transparent: true, opacity: .34, depthWrite: false, roughness: .25, metalness: .3 });
  // a ghostly putter: the pivot is the grip (pendulum swing), the shaft leans down to the head just behind the ball
  const A0 = new THREE.Vector3(0, 0, 0), B0 = new THREE.Vector3(-.2, -.86, .1); const len = A0.distanceTo(B0); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, len, 8), m); shaft.position.copy(A0).lerp(B0, .5); shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), A0.clone().sub(B0).normalize()); putter.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.016, .014, .2, 8), m); grip.position.copy(A0).lerp(B0, -.08); grip.quaternion.copy(shaft.quaternion); putter.add(grip);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .045), m); head.position.set(-.21, -.885, .1); putter.add(head); putter.userData.m = m; scene.add(putter); putter.visible = false; }
const NDOT = 90; const dotGeo = new THREE.BufferGeometry(); const dotPos = new Float32Array(NDOT * 3), dotA = new Float32Array(NDOT), dotS = new Float32Array(NDOT), dotC = new Float32Array(NDOT * 3);
for (let i = 0; i < NDOT; i++) { dotC.set([1, .8, .5], i * 3); dotS[i] = .05; }
dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3)); dotGeo.setAttribute('alpha', new THREE.BufferAttribute(dotA, 1)); dotGeo.setAttribute('size', new THREE.BufferAttribute(dotS, 1)); dotGeo.setAttribute('color', new THREE.BufferAttribute(dotC, 3));
const dots = new THREE.Points(dotGeo, F.mat.clone()); dots.frustumCulled = false; dots.renderOrder = 6; scene.add(dots);
const aimRing = new THREE.Mesh(new THREE.RingGeometry(.13, .155, 40, 1, .4, Math.PI * 2 - .8), new THREE.MeshBasicMaterial({ color: '#ffd08a', transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); aimRing.rotation.order = 'YXZ'; scene.add(aimRing);
const endRing = new THREE.Mesh(new THREE.RingGeometry(.09, .12, 32), aimRing.material.clone()); endRing.rotation.x = -Math.PI / 2; endRing.visible = false; scene.add(endRing);
const slab = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const em = new THREE.CanvasTexture(c); em.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: em, emissiveMap: em, emissive: '#ffffff', emissiveIntensity: .85, roughness: .9 }); const sm = W.mats.stoneM; const g = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, .2), [sm, sm, sm, sm, face, sm]);
  g.castShadow = true; g.visible = false; scene.add(g); g.userData = { c, em }; return g; })();
function paintSlab(txt, sub) { const { c, em } = slab.userData, g = c.getContext('2d'); g.fillStyle = '#2b2933'; g.fillRect(0, 0, 1024, 512); for (let i = 0; i < 2600; i++) { const v = 30 + rng() * 40; g.fillStyle = `rgba(${v},${v},${v + 12},${.25 + rng() * .3})`; g.fillRect(rng() * 1024, rng() * 512, 2 + rng() * 9, 1 + rng() * 3); }
  g.strokeStyle = '#4a4656'; g.lineWidth = 16; g.strokeRect(20, 20, 984, 472); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 150px Fredoka, sans-serif'; g.shadowColor = '#5dff9a'; g.shadowBlur = 40; g.fillStyle = '#9dffbf'; g.fillText(txt, 512, 220); g.shadowBlur = 0; g.font = '600 62px Fredoka, sans-serif'; g.fillStyle = '#ffcf8a'; g.fillText(sub, 512, 380); em.needsUpdate = true; }
function placeBall(x, z) { ball = makeBall(HOLE(), x, z, physT()); syncBall(0); }
const _ax = new THREE.Vector3(), _q = new THREE.Quaternion();
function syncBall(dt) { if (!ball) { ballG.visible = false; return; } const H = HOLE(); const [wx, wz] = toWorld(H, ball.x, ball.z); ballG.position.set(wx, ball.y + R, wz); ballG.visible = !ball.hidden && ball.state !== 'in';
  const sp = Math.hypot(ball.vx, ball.vz); if (sp > 1e-4 && dt > 0) { _ax.set(ball.vz, 0, -ball.vx).normalize(); _q.setFromAxisAngle(_ax, sp * dt / R); ballM.quaternion.premultiply(_q); }
  ballGlow.material.opacity = .18 + Math.min(.25, sp * .05); W.ballLight.position.set(wx, ball.y + .45, wz); W.ballLight.intensity = ballG.visible ? .6 : 0; }
function stepPhys(b, H, ev) { stepBall(b, H, OK(), ev); }

// ---------------- holes / flow ----------------
const timers = []; function setTimer(d, f) { timers.push({ t: S.gt + d, f }); } function clearTimers() { timers.length = 0; }
const music = new Player();
const capOf = H => H.par + D().over;
function lampsFor(H) { const ps = W.posts.filter(p => p.hole === H.id); if (ps[0]) W.lampA.position.set(ps[0].x, 1.62, ps[0].z); if (ps[1]) W.lampB.position.set(ps[1].x, 1.62, ps[1].z); const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); W.cupLight.position.set(cx, H.h(H.cup[0], H.cup[1]) + 1.1, cz); W.cupLight.color.set('#5dff9a'); const [tx, tz] = toWorld(H, 0, 0); W.focus(tx + H.cup[0] * .5, tz, H.cup[1] * .55); }
function resetRun() { clearTimers(); S.hi = 0; S.player = 0; S.sc = [[], []]; S.strokes = 0; S.aces = [0, 0]; S.tricks = [0, 0]; S.birdies = [0, 0]; S.mulls = [D().mull, D().mull]; S.phase = 'idle'; S.end = ''; S.newBest = false; S.ts = 1; S.slow = 0; S.view = 0; W.blood = 0; S.lastShot = null; S.wakeT = null; S.wake = null; slab.visible = false; W.handIM.count = 0; W.ghosts.forEach(g => g.g.visible = false); }
function start(mode) { A.unlock(); resetRun(); S.mode = mode; S.state = 'play'; S.more = false; S.obsOff = 0; window.__banners = []; window.__pops = []; ['end', 'menu', 'scorecard'].forEach(k => $(k).classList.remove('show')); music.start('game', S.gt + .3); music.vol = .85; A.sfx.stinger();
  beginHole(0); $('hint').textContent = t(isTouch ? 'hintT' : 'hint'); setTimer(2.2, () => $('hint').classList.add('show')); setTimer(9, () => $('hint').classList.remove('show')); setUI(); }
function beginHole(i) { S.hi = i; const H = HOLE(); S.player = 0; lampsFor(H); S.flyT0 = S.gt; S.phase = 'fly'; placeBall(H.tee[0], H.tee[1]); S.strokes = 0; S.lastShot = null; S.view = 0; slab.visible = false; aimDefault();
  showHoleCard(H); A.sfx.holeStart(); if (H.id === 1) A.sfx.creak('gate'); setUI(); }
function startTurn(p) { const H = HOLE(); S.player = p; placeBall(H.tee[0], H.tee[1]); S.strokes = 0; S.lastShot = null; S.phase = 'aim'; S.aimT0 = S.gt; aimDefault(); if (S.mode === 'duel') { banner(`${t(p ? 'p2' : 'p1')} · ${t('turn')}`); A.sfx.turn(); } setUI(); }
function aimDefault() { const H = HOLE(); let tx = H.cup[0], tz = H.cup[1]; if (H.aim) for (const [ax, az] of H.aim) if (ball.z > az + .3) { tx = ax; tz = az; break; } S.aimAng = Math.atan2(tx - ball.x, -(tz - ball.z)); S.aimPow = clamp(vToPow(Math.sqrt(2 * 1.1 * Math.hypot(tx - ball.x, tz - ball.z)) + .3), .15, .9); }
function canShoot() { return S.state === 'play' && S.phase === 'aim' && ball && ball.state === 'rest' && S.gt - (S.aimT0 || 0) > .25; }
function shoot(ang = S.aimAng, pow = S.aimPow) { if (!canShoot()) return false; ang = fin(ang); pow = clamp(fin(pow, .5), .02, 1);
  S.lastShot = { x: ball.x, z: ball.z, strokes: S.strokes }; S.strokes++; S.shotT = S.gt; S.aimAng = ang; S.aimPow = pow; ball.t = physT(); shootBall(ball, ang, pow); S.phase = 'roll'; S.aiming = false; S.kbAim = false; S.restT = 0; S.rdx = S.rdz = undefined;
  S.shotTags = { cush: 0, jump: 0, tunnel: 0 }; A.sfx.putt(pow, 0); putterSwing(); $('power').classList.remove('show'); $('hint').classList.remove('show'); setUI(); return true; }
function onBallEvent(e, b, k, mat) { const H = HOLE(); const [wx, wz] = toWorld(H, b.x, b.z); const at = new THREE.Vector3(wx, b.y + R, wz); const pn = pan(wx - camera.position.x);
  if (e === 'hit') { A.sfx.wall(k, mat, pn); S.shotTags.cush++; if (k > 1.2) sparks(F, at, 6, { colors: ['#ffe0b0', '#ffffff'], speed: 1.2, up: .6, life: .35, grav: 3, size: .035 }); if (mat === 'hand') popAt(t('handHit'), '#b8ffb0', .9, at); }
  else if (e === 'bounce') A.sfx.bounce(k, pn);
  else if (e === 'launch') { if (b.vy > .4 || !floorAt(H, b.x, b.z)) { A.sfx.launch(); S.shotTags.jump = 1; } }
  else if (e === 'land') { A.sfx.bounce(1.2, pn); if (S.shotTags.jump === 1) { S.shotTags.jump = 2; popAt(t('jump'), '#ffd08a', 1.1, at); S.tricks[S.player]++; } }
  else if (e === 'lip') { A.sfx.lip(); setTimer(.35, () => { if (S.phase === 'roll' && ball && ball.state !== 'sink' && ball.state !== 'in') popAt(t('lip'), '#ffb0a0', 1.2, at); }); } // a lip that still drops is no lip-out
  else if (e === 'hop') { A.sfx.hop(); popAt(t('tooHard'), '#ffb0a0', 1, at); }
  else if (e === 'sink') { if (S.state === 'play') sinkBall(); }
  else if (e === 'pit') { A.sfx.pit(); popAt(S.kids ? t('pitKids') : t('pit'), '#ff9a8a', 1.15, at); puff(F, at, 4, '#4a3a30', .9); }
  else if (e === 'tunnel') { A.sfx.tunnel(); S.shotTags.tunnel = 1; popAt(t('tunnelIn'), '#ffcf6a', 1, at); }
  else if (e === 'exit') { A.sfx.exit(); puff(F, at, 4, '#6a6080', .8); sparks(F, at, 30, { colors: ['#ff8a3a', '#ffe0a0'], speed: 2, up: 1, life: .6, grav: 2, size: .05 }); popAt(t('tunnelOut'), '#ffcf6a', 1.1, at); S.tricks[S.player]++; }
  else if (e === 'ghost') { A.sfx.ghost(); popAt(t('ghosted'), '#bfe8ff', 1.3, at); sparks(F, at, 60, { colors: ['#bfe8ff', '#ffffff', '#c070ff'], speed: 2.5, up: 1.5, life: 1, grav: .5, size: .07 }); const [px, pz] = toWorld(H, H.portal[0], H.portal[1]); sparks(F, new THREE.Vector3(px, .2, pz), 50, { colors: ['#c070ff', '#ffffff'], speed: 2, up: 2, life: .9, grav: .5, size: .06 }); S.restT = 0; } }
function sinkBall() { const H = HOLE(); const ace = S.strokes === 1; const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); const at = new THREE.Vector3(cx, H.h(H.cup[0], H.cup[1]) + .05, cz);
  A.sfx.cup(ace); C.holes[S.hi].glowBoost = .45; S.phase = ace ? 'ace' : 'sink'; S.sinkT0 = S.gt; S.fovPunch = .8;
  sparks(F, at, Math.round((ace ? 90 : 60) * QUALITY[S.q].parts), { colors: ['#5dff9a', '#c8ffd8', '#ffd08a'], speed: ace ? 2.6 : 2, up: 2.2, life: 1, grav: 2.5, size: .04 }); ring(at, '#5dff9a');
  if (S.shotTags.cush >= 2) { popAt(t('bank'), '#ffd08a', 1.1, at); S.tricks[S.player]++; }
  if (ace) { S.aces[S.player]++; wake(H, at); } else { const d = S.strokes - H.par; const nm = scoreName(S.strokes, H.par); A.sfx.score(d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : 'bogey'); if (d === -1) S.birdies[S.player]++; banner(t('s_' + nm)); setTimer(1.9, holeDone); } }
function scoreName(s, par) { if (s === 1) return 'ace'; const d = s - par; return d <= -3 ? 'albatross' : d === -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : d === 2 ? 'double' : 'triple'; }
function holeDone(picked) { if (S.state !== 'play' || S.phase === 'card') return; const H = HOLE(); S.sc[S.player][S.hi] = picked ? capOf(H) + 1 : S.strokes; S.ts = 1; S.slow = 0; S.phase = 'card'; setUI();
  if (S.mode === 'duel' && S.player === 0) { setTimer(.5, () => { renderScorecard(true); setTimer(2.2, () => { hideScorecard(); startTurn(1); }); }); return; }
  setTimer(.4, () => { renderScorecard(true); setTimer(S.hi === 8 ? 3.2 : 2.6, () => { hideScorecard(); if (S.hi + 1 >= HOLES.length) endRun('done'); else beginHole(S.hi + 1); }); }); }
function afterRest() { const H = HOLE(); if (S.phase !== 'roll' || S.state !== 'play') return; S.phase = 'aim'; S.aimT0 = S.gt;
  if (S.kids && S.strokes >= D().help) { kidsHelp(); return; }
  if (!S.kids && S.strokes >= capOf(H)) { banner(t('maxStrokes')); A.sfx.score('bogey'); S.phase = 'wait'; setTimer(1.6, () => { S.phase = 'roll'; holeDone(true); }); return; }
  aimDefault(); setUI(); }
function kidsHelp() { S.phase = 'help'; banner(t('kidsHelp')); A.sfx.ghost(); S.helpT0 = S.gt; S.helpFrom = [ball.x, ball.z]; }
function endRun(why) { if (S.state !== 'play') return; S.state = 'end'; S.end = why || 'quit'; clearTimers(); S.phase = 'idle'; S.ts = 1; S.slow = 0; hideScorecard();
  const tot = p => S.sc[p].reduce((a, v) => a + (v || 0), 0), done = p => S.sc[p].filter(v => v).length;
  const full = done(0) === HOLES.length; const best = +ls.get(bestKey(), 0);
  if (S.mode === 'campaign' && full) { S.newBest = !best || tot(0) < best; if (S.newBest) ls.set(bestKey(), tot(0)); S.best = S.newBest ? tot(0) : best; } else S.best = best;
  music.start('menu', S.gt + .8); music.vol = .7;
  const parDone = HOLES.slice(0, done(0)).reduce((a, H) => a + H.par, 0);
  if (S.mode === 'duel') { const a = tot(0), b = tot(1), fb = done(1) === HOLES.length; $('eTitle').textContent = t('duelEnd'); $('eRank').textContent = !fb ? t('duelOpen') : a === b ? t('draw') : `${t(a < b ? 'p1' : 'p2')} ${t('wins')}`; $('eScore').textContent = `${a} : ${b}`; $('eBest').textContent = ''; $('eToPar').textContent = ''; }
  else { const d = tot(0) - parDone; $('eTitle').textContent = full ? t('finish') : t('quitT'); $('eRank').textContent = t('r' + rankOf(d, done(0))); $('eScore').textContent = `${tot(0)}`; $('eToPar').textContent = done(0) ? `${fmtPar(d)} · ${done(0)}/${HOLES.length} ${t('holesL')}` : ''; $('eBest').textContent = S.newBest ? t('newBest') : best ? `${t('best')}: ${best}` : ''; }
  const two = v => S.mode === 'duel' ? `${v[0]} : ${v[1]}` : `${v[0]}`;
  $('eStats').innerHTML = `<span>💀 ${t('acesL')} <b>${two(S.aces)}</b></span><span>🐦 ${t('birdiesL')} <b>${two(S.birdies)}</b></span><span>✨ ${t('tricksL')} <b>${two(S.tricks)}</b></span>`;
  $('eCard').innerHTML = cardTable(); $('eName').value = S.name; $('eNameRow').style.display = S.mode === 'duel' ? 'none' : ''; $('end').classList.add('show'); setUI(); A.sfx.win(); }
const fmtPar = d => d === 0 ? 'E' : d > 0 ? `+${d}` : `−${-d}`;
const rankOf = (d, n) => n < HOLES.length ? 6 : d <= -6 ? 0 : d <= -3 ? 1 : d <= 0 ? 2 : d <= 5 ? 3 : d <= 12 ? 4 : 5;
function toMenu() { resetRun(); S.state = 'menu'; S.more = false; S.obsOff = 0; ['end', 'scorecard'].forEach(k => $(k).classList.remove('show')); $('menu').classList.add('show'); music.start('menu', S.gt + .4); music.vol = .8; S.hi = 8; ball = null; lampsFor(HOLES[8]); applyLang(); setUI(); }

// ---------------- THE GRAVEYARD WAKES (hole in one) ----------------
const rings = []; function ring(at, col, big = 1, op = .7) { const m = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(at); m.position.y += .03; scene.add(m); m.material.opacity = op; rings.push({ m, t: 0, big, op }); }
const rockets = []; function fireworks(n, from) { A.play('fw_burst', .4, .8, .6, .5); A.play('fw_burst_b', .35, .75, 1.0, .5); A.play('fw_crackle', .3, .9, 1.3, .5); for (let i = 0; i < n; i++) rockets.push({ p: from.clone().add(new THREE.Vector3((rng() - .5) * 2, 0, 0)), v: new THREE.Vector3((rng() - .5) * 5, 10 + rng() * 4, (rng() - .5) * 3), t: -i * .22, col: ['#5dff9a', '#ffb04a', '#c890ff', '#9de8ff'][i % 4] }); }
function updateRockets(dt) { for (let i = rockets.length - 1; i >= 0; i--) { const Q = rockets[i]; Q.t += dt; if (Q.t < 0) continue; Q.v.y -= 9 * dt; Q.p.addScaledVector(Q.v, dt); if (rng() < .7) sparks(F, Q.p.clone(), 2, { colors: ['#c8ffd0'], speed: .4, life: .4, grav: 1, size: .06 });
    if (Q.v.y < 1.5) { sparks(F, Q.p.clone(), Math.round(150 * QUALITY[S.q].parts), { colors: [Q.col, '#ffffff', Q.col], speed: 6, up: 0, life: 1.4, grav: 1.6, size: .14 }); rockets.splice(i, 1); } } }
function wake(H, at, intro) { const big = H.id === 9 || intro; S.wakeT = S.gt; S.wake = { at: at.clone(), big, H, cam0: camera.position.clone(), intro: !!intro };
  A.sfx.ace(); W.flash = .45; W.moonPunch = 1.2; S.fovPunch = 1.4; flashScreen(.08); ring(at, '#5dff9a', 2.2, .4); setTimer(.25, () => ring(at, '#c890ff', 3, .3)); puff(F, at, 5, '#4a6a58', 1.1);
  sparks(F, at, Math.round(170 * QUALITY[S.q].parts), { colors: ['#5dff9a', '#c8ffd8', '#ffd08a', '#c890ff'], speed: 4.5, up: 3.2, life: 1.3, grav: 2.6, size: .045 });
  // a wave rolls out from the cup: every jack-o'-lantern ignites, tombstones jolt, zombie hands burst out of the graves
  for (const j of W.jacks) { const d = Math.hypot(j.x - at.x, j.z - at.z); j.wakeAt = S.gt + .15 + d * .045; }
  for (const set of W.stoneSets) for (const o of set.L) { const d = Math.hypot(o.x - at.x, o.z - at.z); o.joltAt = d < 26 ? S.gt + .1 + d * .05 : null; }
  const fx = big ? at.x : at.x, fz = big ? at.z + 6.2 : at.z; // the big wake focuses on the graveyard in front of the mausoleum
  const hs = W.hands.map(h => ({ h, d: Math.hypot(h.x - fx, h.z - fz) })).sort((a, b) => a.d - b.d).slice(0, W.handN); S.wakeHands = hs.map(({ h, d }, i) => ({ h, at: S.gt + .35 + d * .05 + (i % 5) * .06, snd: i < 14 && i % 2 === 0 })); W.handIM.count = S.wakeHands.length;
  W.ghosts.forEach((g, i) => { const h = hs[(i * 3) % hs.length].h; g.x = h.x; g.z = h.z; g.t0 = S.gt + .6 + i * .18; g.g.visible = true; });
  const dir = new THREE.Vector3(at.x - camera.position.x, 0, at.z - camera.position.z); if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); dir.normalize(); if (H.id === 9) dir.set(0, 0, -1); else { const [tx, tz] = toWorld(H, H.tee[0], H.tee[1]); dir.set(at.x - tx, 0, at.z - tz); if (dir.lengthSq() > 1e-4) dir.normalize(); else dir.set(0, 0, -1); }
  paintSlab(t('aceSlab'), `${t('holeL')} ${H.id} · ${t('h' + H.id)}`); const sd = H.id === 9 ? .95 : 1.4; slab.userData.y1 = at.y + .5; slab.position.set(at.x + dir.x * sd, -1.2, at.z + dir.z * sd); slab.lookAt(slab.position.x - dir.x, slab.position.y, slab.position.z - dir.z); slab.visible = true; slab.userData.snd = false;
  swarm(W); W.swarmAt = [at.x, at.z]; setTimer(.5, () => A.sfx.bats());
  const from = big ? new THREE.Vector3(H.off[0], 4.4, H.off[1] - 15.5) : at.clone(); setTimer(.9, () => fireworks(big ? 6 : 4, from)); if (big) { W.blood = 0; S.bloodT = S.gt; }
  if (!intro) { banner(t('aceBanner')); setTimer(5.6, holeDone); } }
const _m4 = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _eu = new THREE.Euler(), _hv = new THREE.Vector3(), _hs = new THREE.Vector3();
function updateWake(dt) { if (S.wakeT == null) return; const e = S.gt - S.wakeT;
  for (const j of W.jacks) if (j.wakeAt && S.gt >= j.wakeAt) { j.wakeAt = 0; j.flare = 1; j.on = 1; sparks(F, new THREE.Vector3(j.x, .45, j.z), 12, { colors: ['#ffb04a', '#ffe0a0'], speed: 1.6, up: 1.6, life: .6, grav: 2, size: .05 }); }
  for (const set of W.stoneSets) { let ch = false; for (const o of set.L) { if (o.joltAt && S.gt >= o.joltAt) { o.joltAt = null; o.jolt = 1; } if (o.jolt > 0) { o.jolt = Math.max(0, o.jolt - dt * 1.3); ch = true; } } if (ch) setStones(set); }
  if (S.wakeHands) { let k = 0;
    for (const H of S.wakeHands) { const u = S.gt - H.at; let y = -.9, rx = 0, rz = 0; if (u > 0) { if (H.snd) { H.snd = false; A.sfx.wakeHand(pan(H.h.x - camera.position.x)); sparks(F, new THREE.Vector3(H.h.x, .1, H.h.z), 10, { colors: ['#5a4434', '#8a7058'], speed: 1.5, up: 1.5, life: .6, grav: 5, size: .05 }); }
        const up = u < .35 ? eo(u / .35) : u < 4.2 ? 1 : 1 - smooth((u - 4.2) / .6); y = -.9 + up * .92; rx = Math.sin(u * 9 + H.h.ph) * .25 * up; rz = Math.sin(u * 6 + H.h.ph * 2) * .3 * up; if (u > 4.9) y = -2; }
      _eu.set(rx, H.h.ry, rz); _hq.setFromEuler(_eu); _m4.compose(_hv.set(H.h.x, y, H.h.z), _hq, _hs.setScalar(H.h.s * (S.wake.big ? 1.7 : 1.3))); W.handIM.setMatrixAt(k++, _m4); }
    W.handIM.instanceMatrix.needsUpdate = true; }
  W.ghosts.forEach(g => { if (!g.g.visible) return; const u = S.gt - g.t0; if (u < 0) { g.m.opacity = 0; g.e.material.opacity = 0; return; } const a = u * g.sp + g.ph; g.g.position.set(g.x + Math.cos(a) * g.r * Math.min(1, u), -.3 + u * 1.35, g.z + Math.sin(a) * g.r * Math.min(1, u)); g.g.rotation.y = -a; const o = Math.min(1, u * 2) * (1 - smooth((u - 3.2) / 1.2)); const nc = smooth((g.g.position.distanceTo(camera.position) - 1.2) / 2.2); g.m.opacity = .7 * o * nc; g.e.material.opacity = .9 * o * nc; g.g.scale.setScalar(.9 + u * .1); if (u > 4.5) g.g.visible = false; });
  if (slab.visible) { const u = e - .7; if (u > 0 && !slab.userData.snd) { slab.userData.snd = true; A.play('slab_grind', .55, .9, 0, .5); } slab.position.y = u < 0 ? -1.2 : lerp(-1.2, slab.userData.y1, eo(u / 1.1)); }
  if (S.wake.big && S.bloodT != null) { const u = S.gt - S.bloodT; W.blood = u < 1 ? .7 * smooth(u) : .7 * (1 - smooth((u - 4) / 2)); }
  W.cupLight.intensity = 2.4 + (e < 2.5 ? 1.5 * (1 - e / 2.5) : 0);
  fogPass.uniforms.glow.value.setRGB(.25, 1, .55).multiplyScalar(Math.max(0, 1 - e / 3.5) * .18); fogPass.uniforms.glowPos.value.copy(S.wake.at);
  if (e > 6.5) { S.wakeT = null; S.bloodT = null; W.blood = 0; W.handIM.count = 0; slab.visible = false; fogPass.uniforms.glow.value.setRGB(0, 0, 0); W.cupLight.intensity = 2.4; } }

// ---------------- the cinematic opening: a ball's-eye ride through The Mausoleum ----------------
// 0–1 s macro shot of the ball on the tee under the moon, the ghost putter swings – TOCK.
// then the camera rides the REAL shot (game physics, real obstacle timing): up the ramp, through the coffin, past the
// iron doors, into the cup – THE GRAVEYARD WAKES – and GRAVEYARD GOLF slams in huge and recedes into the stars.
const INTRO_STRIKE = 1.0; let INTRO_LEN = 9.8; let INTRO_SHOT = { ang: 0, pow: .97, off: 2.7 };
const INTRO_SND = [[0, () => { A.play('rumble', .6, 1, 0, .3); A.play('boom_bass', .45, .8, 0, .3); A.play('thunder_soft', .3, .9, .2, .3); }], [.3, () => A.play('swoosh_rise', .4, .8, 0, .4)], [.5, () => A.play('whisper', .3, .9, 0, .5)]];
function startIntro() { clearTimers(); resetRun(); S.state = 'intro'; S.mode = 'campaign'; S.introT0 = S.gt; S.hi = 8; S.kidsSave = S.kidsSave ?? S.kids; S.diffSave = S.diffSave ?? S.diff; S.kids = false; S.diff = 'medium';
  S.obsOff = INTRO_SHOT.off - (S.gt + INTRO_STRIKE); ['menu', 'end', 'scorecard'].forEach(k => $(k).classList.remove('show')); music.stop(); S.introSnd = 0; S.introShot = false; S.titleT = null; S.slow = 0;
  lampsFor(HOLES[8]); placeBall(0, 0); W.jacks.forEach(j => { j.on = .3; }); putter.visible = true; $('oTitle').style.opacity = 0; $('oSub').style.opacity = 0; setUI(); }
function endIntro() { if (S.state !== 'intro') return; S.kids = S.kidsSave; S.diff = S.diffSave; S.kidsSave = S.diffSave = undefined; W.jacks.forEach(j => j.on = 1); $('oTitle').style.opacity = 0; $('oSub').style.opacity = 0; putter.visible = false; S.ts = 1; toMenu(); }
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3(), _d1 = new THREE.Vector3();
// crane shot out of the mausoleum: low through the open doorway (under the lintel), then up and back so the waking
// graveyard fills the frame in front of the mausoleum
function mzCrane(u, cx, cy, cz, P, L) { // hold on the drop, dolly back out through the door, then crane up over the waking graveyard
  const a1 = smooth((u - .7) / 1.6), a2 = smooth((u - 2.3) / 2.6);
  P.set(cx + lerp(.5, 1.2, a1), cy + lerp(.32, 1.3, smooth(a1 / .3)) + lerp(0, 4.3, smooth((a1 - .35) / .65)) + a2 * 1.1, cz + lerp(1.2, 12, a1) + a2 * 2.2 - smooth(u / .7) * .25 * (1 - a1));
  L.set(cx, lerp(cy + .08, 1.5, smooth(a1 / .5)), cz + lerp(.1, 3.5, smooth(a1)) + a2 * .8); }
function introStep() { const e = S.gt - S.introT0; S.introT = e; const H = HOLES[8]; while (S.introSnd < INTRO_SND.length && INTRO_SND[S.introSnd][0] <= e) INTRO_SND[S.introSnd++][1]();
  const [bx, bz] = toWorld(H, ball.x, ball.z); const by = ball.y + R; let pos, lk, fov; const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); const cy = H.h(H.cup[0], H.cup[1]);
  if (e < INTRO_STRIKE) { const k = e / INTRO_STRIKE; pos = _cp.set(bx + lerp(.5, .34, k), by + lerp(.13, .08, k), bz + lerp(.85, .58, k)); lk = _cl.set(bx - .08, by + lerp(.5, .42, k), bz - 2.2); fov = lerp(44, 40, k);
    const sw = e < .72 ? -smooth(e / .72) * .5 : -.5 + eo((e - .72) / .28) * .85; putter.position.set(bx + .2, ball.y + .91, bz); putter.rotation.set(sw, 0, 0); putter.userData.m.opacity = .34 * Math.min(1, e * 3); putter.visible = true;
  } else { if (!S.introShot) { S.introShot = true; S.strokes = 1; S.lastShot = null; ball.t = physT(); shootBall(ball, INTRO_SHOT.ang, INTRO_SHOT.pow); S.phase = 'roll'; S.shotTags = { cush: 0, jump: 0, tunnel: 0 }; A.sfx.putt(1, 0); A.play('boom_cine', .45, 1.2, 0, .3); S.fovPunch = 1; }
    putter.userData.m.opacity = Math.max(0, .34 - (e - INTRO_STRIKE) * 1.2); putter.rotation.x = Math.min(.5, putter.rotation.x + .02); if (putter.userData.m.opacity <= 0) putter.visible = false;
    if (S.wakeT == null) { const v = Math.hypot(ball.vx, ball.vz); const dx = v > .1 ? ball.vx / v : 0, dz = v > .1 ? ball.vz / v : -1; S.idx = lerp(S.idx ?? dx, dx, .15); S.idz = lerp(S.idz ?? dz, dz, .15); const k = smooth((e - INTRO_STRIKE) / .6);
      pos = _cp.set(bx - S.idx * lerp(.58, 1.35, k) + lerp(.34, .1, k), by + lerp(.08, .36, k), bz - S.idz * lerp(.58, 1.35, k)); lk = _cl.set(bx + S.idx * 2.2, by + .12, bz + S.idz * 2.2); fov = lerp(40, 60, k);
      if (S.slow) { const s = smooth(S.slow * 1.3); pos.lerp(_d1.set(cx + .5, cy + .3, cz + 1.2), s); lk.lerp(_d1.set(cx, cy + .03, cz + .2), s); fov = lerp(fov, 46, s); } }
    else { const u = S.gt - S.wakeT; mzCrane(u, cx, cy, cz, _cp, _cl); pos = _cp; lk = _cl; fov = lerp(46, 58, smooth(u / 3.6));
      if (S.titleT == null && u > 2.9) { S.titleT = S.gt; INTRO_LEN = e + 4.2; A.play('hit_dram', .65, .8, 0, .5); A.play('boom', .45, .9, 0, .4); } } }
  // title: slams in huge (a scale punch), then tilts back and recedes into the stars, Star Wars style
  const ot = $('oTitle'), os = $('oSub');
  if (S.titleT != null) { const tE = S.gt - S.titleT; const slam = eo(tE / .4), rec = Math.max(0, tE - .9); const sc = lerp(2.6, 1, slam) * Math.max(.3, 1 - rec * .16); const fade = e > INTRO_LEN - .6 ? Math.max(0, (INTRO_LEN - e) / .6) : 1;
    ot.style.opacity = (Math.min(1, tE / .08) * fade).toFixed(3); ot.style.transform = `perspective(700px) rotateX(${(smooth(rec / 1.4) * 30).toFixed(1)}deg) translateY(${(-rec * 24).toFixed(1)}px) scale(${sc.toFixed(3)})`;
    os.style.opacity = (clamp((tE - .5) / .4, 0, 1) * fade).toFixed(3); } else { ot.style.opacity = 0; os.style.opacity = 0; }
  if (e >= INTRO_LEN || (e > 7 && S.wakeT == null && ball.state !== 'roll')) endIntro();
  return { pos, look: lk, fov }; }

// ---------------- UI ----------------
function setUI() { const st = S.state; document.body.dataset.state = st; const more = !!S.more && st === 'menu'; document.body.dataset.more = more ? '1' : '0'; $('more').classList.toggle('show', more); $('btnMore').setAttribute('aria-expanded', more); document.body.dataset.mode = S.mode; document.body.dataset.kids = S.kids ? '1' : '0'; document.body.dataset.phase = S.phase;
  const H = HOLE(); $('hHole').textContent = `${S.hi + 1}/${HOLES.length}`; $('hHoleN').textContent = t('h' + H.id); $('hPar').textContent = H.par; $('hStrokes').textContent = S.strokes;
  const row = S.sc[S.player], tot = row.reduce((a, v) => a + (v || 0), 0), pd = HOLES.reduce((a, h, i) => a + (row[i] ? h.par : 0), 0); $('hTotal').textContent = row.some(v => v) ? fmtPar(tot - pd) : 'E';
  $('dP1').textContent = `${t('p1')} · ${S.sc[0].reduce((a, v) => a + (v || 0), 0)}`; $('dP2').textContent = `${t('p2')} · ${S.sc[1].reduce((a, v) => a + (v || 0), 0)}`; $('dP1').classList.toggle('on', S.player === 0); $('dP2').classList.toggle('on', S.player === 1);
  $('btnMull').textContent = `↶ ${S.kids ? '∞' : S.mulls[S.player]}`; $('btnMull').disabled = !(S.phase === 'aim' && S.lastShot && (S.kids || S.mulls[S.player] > 0)); $('btnMull').style.display = (S.kids || D().mull > 0) && st === 'play' ? '' : 'none'; }
function showHoleCard(H) { $('hcNum').textContent = `${t('holeL')} ${H.id}`; $('hcName').textContent = t('h' + H.id); $('hcPar').textContent = `${t('parL')} ${H.par}`; $('hcTip').textContent = t('tip' + H.id); const el = $('holecard'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); (window.__banners = window.__banners || []).push(`${t('holeL')} ${H.id} · ${t('h' + H.id)}`); }
function cardTable() { const rows = S.mode === 'duel' ? [0, 1] : [0]; const cell = (p, i) => { const v = S.sc[p][i]; if (!v) return '<td></td>'; const d = v - HOLES[i].par; const cls = v === 1 ? 'ace' : d < 0 ? 'under' : d === 0 ? 'even' : 'over'; return `<td class="${cls}">${v === 1 ? '💀' : v}</td>`; };
  const tot = p => S.sc[p].reduce((a, v) => a + (v || 0), 0);
  return `<table><tr><th>${t('holeL')}</th>${HOLES.map(H => `<th class="${H.id - 1 === S.hi && S.state === 'play' ? 'cur' : ''}">${H.id}</th>`).join('')}<th>Σ</th></tr><tr class="par"><td>${t('parL')}</td>${HOLES.map(H => `<td>${H.par}</td>`).join('')}<td>${PAR_TOTAL}</td></tr>` +
    rows.map(p => `<tr><td>${S.mode === 'duel' ? t(p ? 'p2s' : 'p1s') : t('youL')}</td>${HOLES.map((H, i) => cell(p, i)).join('')}<td class="sum">${tot(p) || ''}</td></tr>`).join('') + '</table>'; }
function renderScorecard(show) { $('scTitle').textContent = `${t('holeL')} ${S.hi + 1} · ${t('h' + (S.hi + 1))}`; const v = S.sc[S.player][S.hi]; $('scRes').textContent = v ? (S.mode === 'duel' ? t(S.player ? 'p2' : 'p1') + ': ' : '') + (v > capOf(HOLE()) ? t('picked') : t('s_' + scoreName(v, HOLE().par))) : ''; $('scTable').innerHTML = cardTable(); if (show) $('scorecard').classList.add('show'); }
function hideScorecard() { $('scorecard').classList.remove('show'); }
function applyLang() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('keysTip').textContent = t(isTouch ? 'keysHintT' : 'keysHint'); $('btnSkip').textContent = t(isTouch ? 'tapPlay' : 'clickPlay'); $('oSub').textContent = t('countdown');
  const kidsOn = S.state === 'intro' ? S.kidsSave ?? S.kids : S.kids, diffOn = S.state === 'intro' ? S.diffSave ?? S.diff : S.diff;
  $('btnKids').classList.toggle('on', kidsOn); $('btnKids').setAttribute('aria-pressed', kidsOn); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === diffOn)); $('diff').classList.toggle('off', kidsOn);
  const b = +ls.get(bestKey(), 0); $('playL').textContent = `${t('campaignT')} · ${kidsOn ? t('kidsT') : t(diffOn)}${b ? ` · 🏆 ${b} (${fmtPar(b - PAR_TOTAL)})` : ''}`;
  $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; $('btnQ').textContent = '⚙ ' + t('q_' + S.q); qLabel(); setUI(); }
function qLabel() { const el = $('btnQ2'); if (el) el.textContent = `⚙ ${t('q_' + S.q)}${S.qUser ? '' : ' · ' + t('auto')}`; }
let popQ = 0; const _sp = new THREE.Vector3();
function popAt(txt, col, big, at) { if (S.state === 'intro') return; (window.__pops = window.__pops || []).push(txt); let x = 0, y = 0; if (at) { _sp.copy(at).project(camera); if (_sp.z < 1) { x = clamp(_sp.x * .5 * VW, -VW * .34, VW * .34); y = clamp(-_sp.y * .5 * VH, -VH * .3, VH * .2) - 50; } }
  const now = performance.now(), delay = Math.max(0, popQ - now); popQ = Math.max(now, popQ) + 260;
  setTimeout(() => { const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt; el.style.color = col; el.style.left = x + 'px'; el.style.top = (y + VH * .06) + 'px'; el.style.fontSize = (27 * big * (VW < 600 ? .8 : 1)) + 'px'; $('pops').appendChild(el); setTimeout(() => el.remove(), 1500); }, window.__ggManual ? 0 : delay); }
function banner(s) { (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = ''; for (const part of String(s).split(/(\p{Extended_Pictographic}\uFE0F?)/u)) { if (!part) continue; if (/\p{Extended_Pictographic}/u.test(part)) { const sp = document.createElement('span'); sp.className = 'emo'; sp.textContent = part; el.appendChild(sp); } else el.appendChild(document.createTextNode(part)); } el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function toast(s) { if (S.state !== 'play') return; const el = $('toast'); el.textContent = s; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
function flashScreen(k) { const el = $('flash'); el.style.transition = 'none'; el.style.opacity = Math.min(.3, k); void el.offsetWidth; el.style.transition = 'opacity .8s ease-out'; el.style.opacity = 0; }
function pan(x) { return clamp(x / 6, -.8, .8); }
function putterSwing() { S.swingT = S.gt; }

// ---------------- input: pull back and release ----------------
let isTouch = (() => { try { return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; } catch (e) { return false; } })(), drag = null;
const _r = new THREE.Vector3(), _f = new THREE.Vector3();
function showPow() { $('powerFill').style.transform = `scaleX(${S.aimPow.toFixed(3)})`; $('powerTxt').textContent = Math.round(S.aimPow * 100) + '%'; $('power').classList.add('show'); }
function aimFromDrag(x, y) { const sc = Math.min(VW, VH) * .38; const dx = (x - drag.x) / sc, dy = (y - drag.y) / sc; const L = Math.hypot(dx, dy); S.aimPow = clamp(L, 0, 1); S.dragAmt = L;
  if (L > .03) { const wx = -(drag.rx * dx - drag.fx * dy), wz = -(drag.rz * dx - drag.fz * dy); S.aimAng = Math.atan2(wx, -wz); } showPow(); } // pull back: the shot goes the opposite way of the drag
function unlockAudio() { A.unlock(); setTimeout(audioBadge, 60); }
function audioBadge() { document.body.dataset.audio = A.state() === 'running' ? 'on' : 'locked'; }
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } unlockAudio(); e.preventDefault();
  if (S.state === 'play' && (S.phase === 'ace' || S.phase === 'fly')) { skipCine(); return; }
  if (!canShoot()) return; camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x); drag = { x: e.clientX, y: e.clientY, id: e.pointerId, rx: _r.x, rz: _r.z, fx: _f.x, fz: _f.z };
  S.aiming = true; S.kbAim = false; S.dragAmt = 0; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} A.sfx.aim(); });
canvas.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; aimFromDrag(e.clientX, e.clientY); });
function endDrag(e) { if (!drag || (e && e.pointerId !== drag.id)) return; if (e) aimFromDrag(e.clientX, e.clientY); drag = null; $('power').classList.remove('show'); if (S.dragAmt > .07) shoot(); else S.aiming = false; }
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', () => { drag = null; S.aiming = false; $('power').classList.remove('show'); });
const keys = {};
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; unlockAudio(); const k = e.code; keys[k] = true;
  if (S.state === 'intro' && (k === 'Enter' || k === 'Space')) { e.preventDefault(); playNow(); return; }
  if (S.state === 'intro' && k === 'Escape') { e.preventDefault(); endIntro(); return; }
  if (S.state === 'menu' && S.more && k === 'Escape') { S.more = false; setUI(); return; }
  if (S.state === 'play' && (k === 'Space' || k === 'Enter') && !e.repeat) { e.preventDefault(); if (S.phase === 'ace' || S.phase === 'fly') skipCine(); else if (canShoot()) shoot(); return; }
  if (S.state === 'play' && /^Arrow|^Key[AD]$/.test(k)) { e.preventDefault(); S.kbAim = true; }
  if (S.state === 'play' && k === 'KeyV') toggleView(); if (S.state === 'play' && k === 'KeyM') mulligan();
  if (k === 'Escape') { if (S.state === 'play') endRun('quit'); else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && !S.more && k === 'Enter') start('campaign'); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
function keyAim(dt) { if (S.state !== 'play' || S.phase !== 'aim') return; const f = keys.ShiftLeft || keys.ShiftRight ? .25 : 1; const a = (keys.ArrowLeft || keys.KeyA ? -1 : 0) + (keys.ArrowRight || keys.KeyD ? 1 : 0), p = (keys.ArrowUp || keys.KeyW ? 1 : 0) + (keys.ArrowDown || keys.KeyS ? -1 : 0);
  if (a) S.aimAng += a * dt * .8 * f; if (p) S.aimPow = clamp(S.aimPow + p * dt * .4 * f, .02, 1); if (a || p) showPow(); }
function skipCine() { if (S.phase === 'fly') { S.flyT0 = S.gt - 9; return; } if (S.phase === 'ace' && S.wakeT != null && S.gt - S.wakeT > .8) { clearTimers(); S.wakeT = S.gt - 6.6; updateWake(0); holeDone(); } }
function toggleView() { if (S.phase !== 'aim') return; S.view = 1 - S.view; A.sfx.ui(); }
function mulligan() { if (!(S.state === 'play' && S.phase === 'aim' && S.lastShot && (S.kids || S.mulls[S.player] > 0))) return; if (!S.kids) S.mulls[S.player]--; const L = S.lastShot; placeBall(L.x, L.z); S.strokes = L.strokes; S.lastShot = null; A.sfx.mulligan(); popAt(t('mullDone'), '#c8b0ff', 1, null); aimDefault(); setUI(); }
$('btnPlay').onclick = () => start('campaign'); $('btnDuel').onclick = () => start('duel');
$('btnAgain').onclick = () => start(S.mode); $('btnMenu').onclick = () => { A.sfx.ui(); toMenu(); };
$('btnQuit').onclick = () => { if (S.state === 'play') endRun('quit'); else if (S.state === 'end') toMenu(); };
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('gg-lang', S.lang); applyLang(); A.sfx.ui(); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; ls.set('gg-diff', S.diff); applyLang(); A.unlock(); A.sfx.ui(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('gg-kids', S.kids ? '1' : '0'); applyLang(); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.unlock(); A.setMuted(!A.isMuted()); applyLang(); };
$('btnQ').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % 4], true); };
$('btnView').onclick = () => toggleView(); $('btnMull').onclick = () => mulligan();
// ---- ONE TAP TO PLAY: the first tap/click anywhere on the opening goes straight into hole 1 (sound unlocks on that same tap) ----
let eatClick = 0;
function playNow() { if (S.state !== 'intro') return; A.unlock(); setTimeout(audioBadge, 60); endIntro(); start('campaign'); }
function introTap(e) { if (S.state !== 'intro') return; if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } eatClick = performance.now() + 450; playNow(); }
window.addEventListener('pointerup', introTap);
window.addEventListener('click', e => { if (performance.now() < eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = 0; return; } introTap(e); }, true); // the same tap must not also hit a button
for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, () => A.unlock(), { capture: true, passive: true }); // iOS: resume audio inside a real user gesture
$('btnMore').onclick = () => { S.more = true; A.unlock(); A.sfx.ui(); setUI(); }; $('btnMoreX').onclick = $('moreBg').onclick = () => { S.more = false; A.sfx.ui(); setUI(); };
$('btnQ2').onclick = () => { $('btnQ').onclick(); applyLang(); };
$('btnIntro').onclick = () => { A.unlock(); S.more = false; startIntro(); };
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize);

// ---------------- share card (1080×1350) ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim().slice(0, 18) || 'Player'; ls.set('gg-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH);
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() }; const hv = [dots.visible, aimRing.visible, endRing.visible, ballG.visible, putter.visible]; dots.visible = aimRing.visible = endRing.visible = putter.visible = false;
  camera.clearViewOffset(); camera.aspect = CW / CH; camera.fov = 54; camera.position.set(3.2, 2.6, -24.5); camera.lookAt(-.4, 2.2, -36); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  updateWorld(W, S.gt, 0, { camX: camera.position.x, camY: camera.position.y, camZ: camera.position.z, fogN: 26, flies: 160 }); prepFog(); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); [dots.visible, aimRing.visible, endRing.visible, ballG.visible, putter.visible] = hv; resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(5,4,14,.9)'); gr.addColorStop(.3, 'rgba(5,4,14,.08)'); gr.addColorStop(.52, 'rgba(5,4,14,.12)'); gr.addColorStop(.64, 'rgba(5,4,14,.84)'); gr.addColorStop(1, 'rgba(5,4,14,.97)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(10,6,20,.88)', lw = 8) => { if (lw) { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); } k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 88); txt('GRAVEYARD GOLF', CW / 2, 108, '#d8ffe4', 'rgba(10,40,24,.92)', 10);
  const tot = p => S.sc[p].reduce((a, v) => a + (v || 0), 0), done = S.sc[0].filter(v => v).length, pd = HOLES.reduce((a, H, i) => a + (S.sc[0][i] ? H.par : 0), 0);
  if (S.mode === 'duel') { k.font = Fo(700, 124); txt(`${tot(0)} : ${tot(1)}`, CW / 2, 262, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 48); txt($('eRank').textContent, CW / 2, 336, '#ffb35a'); }
  else { k.font = Fo(700, 150); txt(`${tot(0)}`, CW / 2, 266, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 46); txt(`${done ? fmtPar(tot(0) - pd) + '  ·  ' : ''}${t('r' + rankOf(tot(0) - pd, done))}`, CW / 2, 338, '#ffb35a'); k.font = Fo(500, 36); txt(`${t('by')} ${S.name}`, CW / 2, 394, '#ffffff'); }
  if (S.aces[0] + S.aces[1] > 0) { k.save(); k.translate(CW - 170, 470); k.rotate(-.18); k.fillStyle = 'rgba(20,60,36,.85)'; k.strokeStyle = '#7dffaa'; k.lineWidth = 6; k.beginPath(); k.arc(0, 0, 104, 0, 7); k.fill(); k.stroke(); k.font = Fo(700, 66); txt('💀', 0, -10, '#fff', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 30); txt(t('aceStamp'), 0, 48, '#b8ffd0', 'rgba(0,0,0,0)', 0); k.restore(); }
  const gx = 70, gw = CW - 140, cw = gw / 11, top = 912, rows = S.mode === 'duel' ? [0, 1] : [0]; k.fillStyle = 'rgba(12,10,26,.82)'; k.strokeStyle = 'rgba(200,180,255,.35)'; k.lineWidth = 2; k.beginPath(); if (k.roundRect) k.roundRect(gx - 14, top - 52, gw + 28, 92 + 64 * (rows.length + 1), 22); else k.rect(gx - 14, top - 52, gw + 28, 92 + 64 * (rows.length + 1)); k.fill(); k.stroke();
  k.font = Fo(600, 28); [t('holeL'), ...HOLES.map(H => String(H.id)), 'Σ'].forEach((s, i) => txt(s, gx + cw * (i + .5), top, '#bfb0e0', '', 0));
  [t('parL'), ...HOLES.map(H => String(H.par)), String(PAR_TOTAL)].forEach((s, i) => txt(s, gx + cw * (i + .5), top + 56, '#9a90b8', '', 0));
  rows.forEach((p, ri) => { const y = top + 120 + ri * 64; k.font = Fo(600, 28); txt(S.mode === 'duel' ? t(p ? 'p2s' : 'p1s') : t('youL'), gx + cw * .5, y, '#ffffff', '', 0); k.font = Fo(600, 30);
    HOLES.forEach((H, i) => { const v = S.sc[p][i]; if (!v) return; const d = v - H.par, cx = gx + cw * (i + 1.5); if (v === 1) { k.fillStyle = 'rgba(93,255,154,.22)'; k.beginPath(); k.arc(cx, y - 11, 27, 0, 7); k.fill(); k.font = Fo(700, 34); txt('💀', cx, y, '#9dffbf', '', 0); k.font = Fo(600, 30); }
      else { if (d < 0) { k.strokeStyle = '#ffcf6a'; k.lineWidth = 3; k.beginPath(); k.arc(cx, y - 11, 24, 0, 7); k.stroke(); } txt(String(v), cx, y, d < 0 ? '#ffe08a' : d === 0 ? '#ffffff' : '#ffa8a0', '', 0); } });
    k.font = Fo(700, 32); txt(String(tot(p)), gx + cw * 10.5, y, '#fff0c0', '', 0); });
  k.font = Fo(600, 32); txt(`${t(S.mode === 'duel' ? 'duelT' : 'campaignT')} · ${S.kids ? t('kidsT') : t(S.diff)} · 💀 ${S.mode === 'duel' ? S.aces[0] + ':' + S.aces[1] : S.aces[0]} · ✨ ${S.mode === 'duel' ? S.tricks[0] + ':' + S.tricks[1] : S.tricks[0]}`, CW / 2, 1172, '#ffe08a');
  k.font = Fo(600, 42); txt(t('cardTag'), CW / 2, 1240, '#c8ffd8'); k.font = Fo(400, 32); txt(CREDIT_TXT, CW / 2, 1298, 'rgba(255,255,255,.92)');
  window.__ggCard = { w: c.width, h: c.height }; return c; }
async function saveCard(share) { const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-graveyard-golf.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Graveyard Golf · ${t('cardTag')}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-graveyard-golf.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved')); }

// ---------------- simulation ----------------
let rollV = 0;
function beds() { const sp = ball && ball.state === 'roll' && !ball.air ? Math.hypot(ball.vx, ball.vz) : 0; rollV = lerp(rollV, sp, .2); A.loop('roll_loop', Math.min(.5, rollV * .12), .75 + Math.min(.45, rollV * .08), .12);
  A.loop('wind', .12, 1, 1.2); A.loop('night_loop', S.state === 'play' ? .15 : .2, 1, 1.5); A.loop('mill_loop', S.state === 'play' && S.hi === 4 ? .14 : 0, 1, 1); }
let owlT = 9, crowT = 15; function ambient(dt) { owlT -= dt; if (owlT <= 0) { owlT = 14 + rng() * 14; rng() < .5 ? A.sfx.owl() : A.sfx.howl(); } crowT -= dt; if (crowT <= 0) { crowT = 18 + rng() * 16; A.sfx.crow(); } }
function obstacleSounds() { if (S.state !== 'play') return; const H = HOLE(); const T0 = obsT();
  for (const o of H.dyn) { if (o.k === 'pend') { const s = Math.sign(Math.cos(T0 * o.w + o.ph)); if (o._s !== undefined && s !== o._s) A.sfx.creak('lid', pan(o.amp * Math.sin(T0 * o.w + o.ph))); o._s = s; }
    else if (o.k === 'door') { const f = pose(o, T0).f; const m = f > .02 && f < .98; if (m && !o._m) A.sfx.creak(o.len < 1.2 ? 'lid' : 'iron'); o._m = m; }
    else if (o.k === 'hand') { const up = pose(o, T0).up; if (up > .05 && !(o._u > .05)) A.sfx.handUp(pan(o.x)); o._u = up; } } }
const camPos = new THREE.Vector3(0, 3, 6), look = new THREE.Vector3(0, 1.2, -10), _tp = new THREE.Vector3(), _tl = new THREE.Vector3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function aimCam(H, out, outL) { const pt = portrait(); const [bx, bz] = toWorld(H, ball.x, ball.z); const dx = Math.sin(S.aimAng), dz = -Math.cos(S.aimAng); const dist = pt ? 3.5 : 2.8, hgt = pt ? 2.1 : 1.45;
  out.set(bx - dx * dist, ball.y + hgt, bz - dz * dist); outL.set(bx + dx * (pt ? 2.2 : 2.8), ball.y + (pt ? -.2 : .1), bz + dz * (pt ? 2.2 : 2.8));
  if (S.view) { const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); const mx = (bx + cx) / 2, mz = (bz + cz) / 2, L = Math.max(4, Math.hypot(cx - bx, cz - bz)); out.set(mx + .01, (pt ? 1.5 : 1.0) * L + 2.5, mz + L * .45 + 1.2); outL.set(mx, 0, mz - .3); } }
function camTarget(dt) { const st = S.state, pt = portrait(); let fov = pt ? 62 : 50;
  if (st === 'menu' || st === 'end') { const a = S.gt * .045; _tp.set(Math.sin(a) * 6 + 1, pt ? 4.2 : 3.4, -20.5 + Math.cos(a) * 2.5 + (pt ? 3 : 0)); _tl.set(Math.sin(a * .7) * 1.2, 2.0, -34); return pt ? 64 : 50; }
  const H = HOLE(); const [bx, bz] = ball ? toWorld(H, ball.x, ball.z) : [0, 0];
  if (S.phase === 'fly') { const e = S.gt - S.flyT0, k = eio(e / 2.6); const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); aimCam(H, _tp, _tl); _v.set(cx + 1.4, pt ? 7.5 : 5.5, cz + 2.8); _v2.set(cx, .3, cz); _tp.lerpVectors(_v, _tp, k); _tl.lerpVectors(_v2, _tl, k); if (e > 2.7) startTurn(0); return pt ? 64 : 52; }
  if (S.phase === 'aim' || S.phase === 'wait' || S.phase === 'help' || S.phase === 'card' && !ball.state.match(/sink|in/)) { aimCam(H, _tp, _tl); return S.view ? (pt ? 66 : 54) : fov; }
  if (S.phase === 'roll') { if (ball.state === 'tunnel') { const tn = H.tunnel; const [ex, ez] = toWorld(H, tn.exit[0], tn.exit[1]); _tp.set(ex - 1.4, 1.8, ez + 2.4); _tl.set(ex, .2, ez - 1.6); return fov; }
    const v = Math.hypot(ball.vx, ball.vz); const dx = v > .2 ? ball.vx / v : Math.sin(S.aimAng), dz = v > .2 ? ball.vz / v : -Math.cos(S.aimAng); const kd = 1 - Math.exp(-dt * 2.2); S.rdx = lerp(S.rdx ?? dx, dx, kd); S.rdz = lerp(S.rdz ?? dz, dz, kd); const dn = Math.hypot(S.rdx, S.rdz) || 1;
    const dist = pt ? 3.3 : 2.7; _tp.set(bx - S.rdx / dn * dist, ball.y + (pt ? 1.9 : 1.35), bz - S.rdz / dn * dist); _tl.set(bx + S.rdx / dn * 1.2, ball.y + .1, bz + S.rdz / dn * 1.2);
    if (S.slow > 0) { const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); const cy = H.h(H.cup[0], H.cup[1]); const ox = cx - bx, oz = cz - bz, ol = Math.hypot(ox, oz) || 1; _v.set(cx + oz / ol * .8 + ox / ol * .45, cy + .26, cz - ox / ol * .8 + oz / ol * .45); const s = smooth(S.slow); _tp.lerp(_v, s); _tl.lerp(_v2.set(lerp(bx, cx, .6), cy + .04, lerp(bz, cz, .6)), s); fov = lerp(fov, 44, s); }
    return fov; }
  if (S.phase === 'sink' || S.phase === 'card') { const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); _tl.lerp(_v.set(cx, H.h(H.cup[0], H.cup[1]) + .1, cz), .05); return fov - 4; }
  if (S.phase === 'ace' && S.wake) { const u = S.gt - S.wakeT, a = H.id === 9 ? eio(u / 3.8) : eio(Math.max(0, u - .05) / 2.3), at = S.wake.at; let dx = S.wake.cam0.x - at.x, dz = S.wake.cam0.z - at.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (H.id === 9) mzCrane(u, at.x, at.y - .05, at.z, _tp, _tl);
    else { const [tx, tz] = toWorld(H, H.tee[0], H.tee[1]); let bx = tx - at.x, bz = tz - at.z; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl; // crane straight back up the lane (clear of trees and props)
      const k0 = Math.min(1, u / .5), ex = lerp(dx, bx, smooth(k0)), ez = lerp(dz, bz, smooth(k0)), rr = lerp(1.0, Math.min(7.4, bl * .8), a); _tp.set(at.x + ex * rr - ez * .9 * a, lerp(at.y + .28, 4.3, a), at.z + ez * rr + ex * .9 * a); _tl.set(lerp(at.x, slab.position.x, .35 * a), lerp(at.y + .1, .8, a), lerp(at.z, slab.position.z, .35 * a)); }
    return lerp(46, pt ? 64 : 54, a); }
  return fov; }
function prepFog() { const u = fogPass.uniforms; camera.updateMatrixWorld(); u.projInv.value.copy(camera.projectionMatrixInverse); u.camWorld.value.copy(camera.matrixWorld); u.camPos.value.copy(camera.position); u.time.value = S.gt; u.steps.value = QUALITY[S.q].fogSteps; u.tDepth.value = composer.readBuffer.depthTexture; }
const occ = C.occluders || []; const ray = new THREE.Raycaster();
function physics(dt) { if (!ball || !(S.state === 'play' || S.state === 'intro')) return; const H = HOLE(); const ev = onBallEvent; const pt = physT();
  if (ball.state === 'rest' || ball.state === 'in') ball.t = pt; else { let n = 0; while (ball.t + HS <= pt && n < 80) { n++; stepPhys(ball, H, ev); if (ball.state === 'rest' || ball.state === 'in') { ball.t = pt; break; } } if (n >= 80) ball.t = pt; }
  if (S.state === 'play') {
    if (S.phase === 'roll' && ball.state === 'rest') { S.restT += dt; if (S.restT > .35) afterRest(); }
    if (S.phase === 'roll' && ball.state === 'lost') { const L = S.lastShot || { x: H.tee[0], z: H.tee[1], strokes: 0 }; if (!S.kids) S.strokes++; placeBall(L.x, L.z); S.restT = 1; afterRest(); }
    if (S.phase === 'help') { const e = S.gt - S.helpT0, k2 = eio(e / 1.6); ball.x = lerp(S.helpFrom[0], H.cup[0], k2); ball.z = lerp(S.helpFrom[1], H.cup[1], k2); ball.y = (floorAt(H, ball.x, ball.z) ?? 0) + Math.sin(k2 * Math.PI) * .8; ball.state = 'rest';
      if (e > 1.6) { ball.state = 'in'; S.phase = 'sink'; A.sfx.cup(false); A.sfx.kids(); C.holes[S.hi].glowBoost = 1; banner(t('s_' + scoreName(S.strokes, H.par))); setTimer(1.6, holeDone); } } }
  // slow motion when a hole in one is about to drop (the same physics, run ahead)
  const first = S.state === 'intro' || S.strokes === 1;
  if ((S.phase === 'roll' || S.state === 'intro') && first && !S.slow && ball.state === 'roll' && Math.hypot(ball.x - H.cup[0], ball.z - H.cup[1]) < 2.2) { const b2 = cloneBall(ball); let sunk = false; for (let i = 0; i < 132; i++) { stepPhys(b2, H, null); if (b2.state === 'sink' || b2.state === 'in') { sunk = true; break; } if (b2.state !== 'roll') break; } if (sunk) S.slow = .001; }
  if (S.state === 'intro' && S.introShot && !S.slow && S.wakeT == null) S.ts = Math.min(1.5, S.ts + dt * 2); // speed ramp on the ride
  if (S.wakeT != null) { const u = S.gt - S.wakeT; S.ts = u < .4 ? .5 : Math.min(1, S.ts + dt * 1.6); S.slow = 0; }
  else if (S.slow > 0) { S.slow = Math.min(1, S.slow + dt * 2.4); S.ts = Math.min(S.ts, lerp(1.2, .3, smooth(S.slow))); if (ball.state === 'rest' || ball.state === 'lost') { S.slow = 0; S.ts = 1; } }
  if (S.state === 'intro' && (ball.state === 'sink' || ball.state === 'in') && S.wakeT == null) { const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); wake(H, new THREE.Vector3(cx, H.h(H.cup[0], H.cup[1]) + .05, cz), true); A.sfx.cup(true); } }
function step(dt) {
  dt = Math.max(0, Math.min(fin(dt), 1 / 20)); // never step backwards, never jump
  S.ts = clamp(fin(S.ts, 1), .05, 1.6); const gdt = dt * S.ts; S.gt += gdt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i] && timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'blood', 'moonPunch']) if (!Number.isFinite(W[k])) W[k] = 0; // NaN guards
  for (const k of ['aimAng', 'aimPow', 'fovPunch', 'vx', 'vy', 'slow']) if (!Number.isFinite(S[k])) S[k] = k === 'aimPow' ? .5 : 0;
  if (ball && !Number.isFinite(ball.x + ball.z + ball.y + ball.vx + ball.vz)) { const H = HOLE(); placeBall(H.tee[0], H.tee[1]); }
  music.I = clamp((S.hi + (S.aces[0] + S.aces[1]) * 2) / 8, 0, 1); music.step(S.gt); ambient(dt); beds(); keyAim(dt); obstacleSounds();
  const st = S.state; const ic = st === 'intro' ? introStep() : null; physics(dt);
  updateWake(dt); C.holdOpen = S.wakeT != null && !!(S.wake && S.wake.big); updateCourse(C, obsT(), 1, gdt, st === 'play' ? HOLE().id : 9);
  syncBall(gdt); updatePutter(); updateGuide(); updateRockets(gdt);
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += gdt; const k = r.t / (.9 * r.big); r.m.scale.setScalar(1 + k * 5 * r.big); r.m.material.opacity = r.op * (1 - k); if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); } }
  // camera
  let fov; if (ic) { camPos.copy(ic.pos); look.copy(ic.look); const asp = VW / VH; fov = asp < 1.3 ? Math.min(80, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(ic.fov / 2)) * Math.min(1.3 / asp, 2.2)))) : ic.fov; }
  else { fov = camTarget(dt); const kc = 1 - Math.exp(-dt * (S.phase === 'fly' ? 7 : S.phase === 'ace' ? 5 : S.slow > 0 ? 3.5 : 3)); camPos.lerp(_tp, kc); look.lerp(_tl, kc); }
  if (!Number.isFinite(camPos.x + camPos.y + camPos.z)) camPos.set(0, 3, 6); if (!Number.isFinite(look.x + look.y + look.z)) look.set(0, 1.2, -10);
  // never inside the mausoleum walls, never under the ground
  if (occ.length && st === 'play' && S.wakeT == null) { _v.subVectors(camPos, look); const L = _v.length(); if (L > .1) { ray.set(look, _v.multiplyScalar(1 / L)); ray.far = L; const hit = ray.intersectObjects(occ, false)[0]; if (hit) camPos.copy(look).addScaledVector(_v, Math.max(.3, hit.distance - .25)); } }
  camPos.y = Math.max(camPos.y, .12);
  S.fovPunch = Math.max(0, S.fovPunch - dt * 2.2); camera.fov = fin(ic ? fov : lerp(camera.fov, fov, 1 - Math.exp(-dt * 3)), 50) - S.fovPunch * 2.2; // impact = smooth zoom punch, never a shake
  camera.position.copy(camPos); camera.lookAt(look);
  const W2 = wide(), menuish = st === 'menu' || st === 'end'; const vx = menuish && W2 ? -.17 : 0, vy = menuish && !W2 ? .14 : 0; const kv = 1 - Math.exp(-dt * 2.5); S.vx = lerp(fin(S.vx), vx, kv); S.vy = lerp(fin(S.vy), vy, kv);
  camera.setViewOffset(VW, VH, S.vx * VW, S.vy * VH, VW, VH); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const pscale = VH * renderer.getPixelRatio() * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  updateWorld(W, S.gt, gdt, { camX: camera.position.x, camY: camera.position.y, camZ: camera.position.z, fogN: 26, flies: QUALITY[S.q].flies, scale: pscale });
  bloom.strength = (S.wakeT != null ? .46 : .4) * QUALITY[S.q].bloom; gradePass.uniforms.time.value = S.gt;
  updateFX(F, gdt, pscale); dots.material.uniforms.scale.value = pscale;
}
function updatePutter() { if (S.state === 'intro') return; const H = HOLE(); const swing = S.swingT != null && S.gt - S.swingT < .45; const show = S.state === 'play' && ball && (S.phase === 'aim' && ball.state === 'rest' || swing);
  putter.visible = !!show; if (!show) return; const [bx, bz] = toWorld(H, ball.x, ball.z); const ang = S.aimAng; let sw, op = .38;
  if (swing && S.phase !== 'aim') { const u = (S.gt - S.swingT) / .45; sw = lerp(-S.aimPow * .55, .38, eo(u * 3)); op = .42 * (1 - u); } else sw = -(S.aiming || S.kbAim ? S.aimPow : .06) * .55;
  // the ghost putter's grip sits to the right of the ball; it swings like a pendulum along the aim line
  const rx = Math.cos(ang), rz = Math.sin(ang); putter.position.set(bx + rx * .2, ball.y + .91, bz + rz * .2); putter.rotation.set(sw, -ang, 0, 'YXZ'); putter.userData.m.opacity = op; }
const _gp = []; let _gTick = 0;
function updateGuide() { const show = S.state === 'play' && S.phase === 'aim' && ball && ball.state === 'rest'; dots.visible = show; aimRing.visible = show; endRing.visible = false; if (!show) { S._gKey = ''; return; }
  const H = HOLE(); const [bx, bz] = toWorld(H, ball.x, ball.z); aimRing.position.set(bx, ball.y + .012, bz); aimRing.rotation.set(-Math.PI / 2, 0, 0); aimRing.rotateZ(Math.PI / 2 - S.aimAng); aimRing.material.color.setHSL(.13 - S.aimPow * .12, 1, .62);
  const key = `${S.aimAng.toFixed(3)}|${S.aimPow.toFixed(3)}|${S.hi}|${ball.x.toFixed(3)}`; const dyn = H.dyn.length > 0; _gTick++;
  if (key !== S._gKey || (dyn && _gTick % 3 === 0)) { S._gKey = key; const frac = D().guide; _gp.length = 0;
    const b = cloneBall(ball); b.t = physT(); shootBall(b, S.aimAng, S.aimPow); const N = Math.round((frac >= 1 ? 6 : 2.4) / HS); let cush = 0, n = 0;
    for (; n < N; n++) { stepPhys(b, H, null); if (n % 5 === 0) _gp.push([b.x, b.y, b.z]); if (frac < 1 && b.cushions > cush) break; if (b.state !== 'roll') break; }
    const m = frac >= 1 ? _gp.length : Math.max(3, Math.floor(_gp.length * frac)); for (let i = 0; i < NDOT; i++) { const j = Math.floor(i / NDOT * m); const P = _gp[j]; if (P && j < m) { const [wx, wz] = toWorld(H, P[0], P[2]); dotPos.set([wx, P[1] + R * .5, wz], i * 3); dotA[i] = .8 * (frac < 1 ? 1 - i / NDOT : 1 - i / NDOT * .45); dotS[i] = .05 * (1 - i / NDOT * .4); } else dotA[i] = 0; }
    dotGeo.attributes.position.needsUpdate = true; dotGeo.attributes.alpha.needsUpdate = true; dotGeo.attributes.size.needsUpdate = true; S._gEnd = frac >= 1 ? { b, sink: b.state === 'sink' || b.state === 'in' } : null; }
  if (S._gEnd) { const b = S._gEnd.b; const [wx, wz] = toWorld(H, b.x, b.z); endRing.visible = true; endRing.position.set(wx, (b.y || 0) + .015, wz); endRing.material.color.set(S._gEnd.sink ? '#5dff9a' : '#ffd08a'); } }
function solveHere(opt = {}) { const H = HOLE(); const b0 = cloneBall(ball); b0.t = physT(); return solve(b0, H, OK(), opt); }
function render() { prepFog(); composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++; // ignore the first 6 s (shader compile, decode): no false step-down at startup
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__ggNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }

applyQuality(S.q); applyLang(); resize();
A.unlock(); audioBadge(); setTimeout(audioBadge, 400);
if (window.__ggSkipIntro) toMenu(); else startIntro();
try { renderer.compile(scene, camera); } catch (e) {}
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__ggManual) { step(dt); fpsTick(dt); } return dt; } // rAF stamps can be earlier than the last one: never run the clock backwards
function frameLoop(now) { advance(now); render(); requestAnimationFrame(frameLoop); }
step(0); requestAnimationFrame(frameLoop);
window.__gg = { S, W, C, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer, start, end: endRun, toMenu, shoot, startIntro, endIntro, skip: skipCine, mulligan, toggleView,
  beginHole: i => { clearTimers(); hideScorecard(); beginHole(i); }, ball: () => ball && { x: ball.x, y: ball.y, z: ball.z, state: ball.state, v: Math.hypot(ball.vx, ball.vz), air: ball.air }, canShoot, hole: () => ({ i: S.hi, id: HOLE().id, par: HOLE().par, cup: HOLE().cup, strokes: S.strokes, phase: S.phase, player: S.player }),
  solve: opt => solveHere(opt), aimSimple: (perr = 0, aerr = 0) => { const H = HOLE(); let tx = H.cup[0], tz = H.cup[1]; if (H.aim) for (const [ax, az] of H.aim) if (ball.z > az + .3) { tx = ax; tz = az; break; } const a = Math.atan2(tx - ball.x, -(tz - ball.z)); return shoot(a + aerr, clamp(vToPow(Math.sqrt(2 * 1.2 * Math.hypot(tx - ball.x, tz - ball.z)) + .25) * (1 + perr), .05, 1)); },
  sim: (ang, pow, dt = 0) => { const H = HOLE(); const b0 = cloneBall(ball); b0.t = physT() + dt; const r = simulate(b0, H, ang, pow, OK(), 9); return { x: r.b.x, z: r.b.z, sink: r.sink, lost: r.lost, ghost: r.ghost, d: r.d, t: r.t, tunnel: r.b.tunnel, jumped: r.b.jumped, cush: r.b.cushions }; },
  placeBall: (x, z) => { placeBall(x, z); }, camera, cam: () => ({ p: camera.position.toArray(), fov: camera.fov }), screen: v => { _sp.set(...v).project(camera); return { x: (_sp.x * .5 + .5) * VW, y: (-_sp.y * .5 + .5) * VH, z: _sp.z }; }, toWorld: (x, z) => toWorld(HOLE(), x, z),
  fps, card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .9), sparks: () => { let n = 0; for (let i = 0; i < F.life.length; i++) if (F.life[i] > 0) n++; return n; }, advance, last: () => last, play: A.play, sfx: A.sfx, audioState: A.state,
  guide: () => ({ visible: dots.visible, ring: endRing.visible, n: Array.from(dotA).filter(a => a > 0).length, frac: D().guide }), setIntroShot: s => { INTRO_SHOT = s; }, obsT, physT, setObsOff: v => { S.obsOff = v; },
  wakeNow: () => { const H = HOLE(); const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); S.phase = 'ace'; S.strokes = 1; wake(H, new THREE.Vector3(cx, H.h(H.cup[0], H.cup[1]) + .05, cz)); }, occ: () => occ.length,
  camClip: () => { const p = camera.position; const lp = new THREE.Vector3(); for (const m of occ) { if (m.geometry.type !== 'BoxGeometry') continue; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const bx = m.geometry.boundingBox.clone().expandByScalar(-.02); m.updateWorldMatrix(true, false); lp.copy(p); m.worldToLocal(lp); if (bx.containsPoint(lp)) return 'inside mausoleum stone at ' + p.toArray().map(v => v.toFixed(2)); }
    for (const H of HOLES) { const lx = p.x - H.off[0], lz = p.z - H.off[1]; const f = floorAt(H, lx, lz); if (f != null && p.y < f + .05) return 'below the felt of hole ' + H.id; } return p.y < .05 ? 'below ground' : ''; },
  _dbg: { scene, camera, composer, bloom, F, THREE, slab, putter, fogPass, HOLES } };
document.body.classList.add('ready');
