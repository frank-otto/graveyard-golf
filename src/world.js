// The graveyard at night: giant moon behind the mausoleum, sky dome with stars and drifting clouds, rolling ground,
// crooked tombstones, dead trees, an iron fence, jack-o'-lanterns, lantern posts, god rays, wisps, bats, rising ghosts
// and zombie hands for THE GRAVEYARD WAKES, plus the screen-space height fog and the colour grade passes.
import * as THREE from 'three';
import { cv, tex, rnd, noise2, softTexture, smokeTexture, stoneTextures, woodTexture, grassTexture } from './tex.js';
import { HOLES } from './holes.js';
export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .7, parts: .45, fogSteps: 3, flies: 50, msaa: 0 },
  mid: { dpr: 1.25, shadows: true, shadowSize: 2048, bloom: 1, parts: .8, fogSteps: 5, flies: 110, msaa: 4 },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, parts: 1, fogSteps: 6, flies: 160, msaa: 4 },
  ultra: { dpr: 2, shadows: true, shadowSize: 4096, bloom: 1, parts: 1.3, fogSteps: 8, flies: 220, msaa: 4 }
};
export const MOON_DIR = new THREE.Vector3(.12, .2, -1).normalize();
const fin = (v, d = 0) => Number.isFinite(v) ? v : d;
export const toWorld = (H, x, z) => [x + H.off[0], z + H.off[1]];
function skyMaterial() {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, flash: { value: 0 }, blood: { value: 0 }, glowK: { value: 1 }, moonDir: { value: MOON_DIR.clone() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform float time, flash, blood, glowK; uniform vec3 moonDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
      void main(){ vec3 d = normalize(vDir); float h = d.y; float md = max(dot(d, moonDir), 0.);
        vec3 low = mix(vec3(.085, .10, .2), vec3(.16, .07, .1), blood), high = vec3(.006, .009, .03);
        vec3 col = mix(low, high, smoothstep(-.02, .55, h));
        col += glowK * pow(md, 6.) * mix(vec3(.14, .18, .33), vec3(.3, .08, .05), blood) + glowK * pow(md, 40.) * mix(vec3(.22, .27, .42), vec3(.45, .15, .08), blood);
        vec2 sp = floor(d.xy * 380. + d.z * 41.); float tw = .6 + .4 * sin(time * (1.5 + hash(sp) * 3.) + hash(sp.yx) * 6.);
        col += step(.9965, hash(sp)) * smoothstep(.05, .35, h) * vec3(.75, .8, 1.) * tw * (1. - smoothstep(.96, .995, md));
        vec2 uv = d.xz / (h + .25) * 1.2 + vec2(time * .02, time * .006);
        float c = fbm(uv * 1.2 + fbm(uv * .5 + time * .012) * .7);
        float cl = smoothstep(.5, .8, c) * smoothstep(-.05, .2, h);
        vec3 ccol = mix(vec3(.035, .04, .07), vec3(.2, .22, .32), c) + pow(md, 12.) * vec3(.5, .55, .7) * c * 1.4;
        col = mix(col, ccol, cl * .85); col += flash * vec3(.4, 1., .55) * .1;
        gl_FragColor = vec4(col, 1.); }` });
}
function moonCanvas() { const S = 512, [c, g] = cv(S, S), n = noise2(77), r = rnd(78); const im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (x - S / 2) / (S / 2 - 6), dy = (y - S / 2) / (S / 2 - 6), d = Math.hypot(dx, dy); const i = (y * S + x) * 4;
    if (d > 1) { im.data[i + 3] = 0; continue; } const mare = n(x / 70 + 2, y / 70), v = .8 + n(x / 9, y / 9) * .2 - Math.max(0, mare - .45) * 1.1, limb = .72 + .28 * Math.sqrt(1 - d * d);
    im.data[i] = 255 * v * limb; im.data[i + 1] = 246 * v * limb; im.data[i + 2] = 222 * v * limb; im.data[i + 3] = 255 * Math.min(1, (1 - d) * 90); }
  g.putImageData(im, 0, 0); for (let k = 0; k < 40; k++) { const a = r() * 6.28, rr = Math.sqrt(r()) * S * .43, x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr, s = 3 + r() * r() * 26;
    const cg = g.createRadialGradient(x + s * .25, y + s * .25, 0, x, y, s); cg.addColorStop(0, 'rgba(60,54,50,.18)'); cg.addColorStop(.8, 'rgba(60,54,50,.1)'); cg.addColorStop(1, 'rgba(255,250,240,.12)'); g.fillStyle = cg; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  return c; }
function faceCanvas() { const [c, g] = cv(256, 128); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(60, 50); g.lineTo(96, 50); g.lineTo(78, 22); g.fill(); g.beginPath(); g.moveTo(160, 50); g.lineTo(196, 50); g.lineTo(178, 22); g.fill();
  g.beginPath(); g.moveTo(118, 70); g.lineTo(138, 70); g.lineTo(128, 56); g.fill();
  g.beginPath(); g.moveTo(52, 82); g.quadraticCurveTo(128, 128, 204, 82); g.lineTo(184, 88); g.lineTo(176, 100); g.lineTo(160, 92); g.lineTo(144, 104); g.lineTo(128, 94); g.lineTo(112, 104); g.lineTo(96, 92); g.lineTo(80, 100); g.lineTo(72, 88); g.closePath(); g.fill(); return c; }
export function pumpkinGeo(seg = 28) { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .6)); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), rib = 1 - .07 * Math.pow(Math.abs(Math.cos(a * 5)), 2.5); v.x *= rib; v.z *= rib; v.y = v.y * (v.y < 0 ? .8 : .72) - (Math.abs(v.y) > .9 ? .08 * Math.sign(v.y) * (Math.abs(v.y) - .9) * 10 : 0); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; }
function pumpkinTex(seed) { const W = 256, H = 128, [c, g] = cv(W, H), n = noise2(seed); const im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const rib = Math.abs(Math.sin(x / W * Math.PI * 10)); const v = .75 + n(x / 10, y / 10) * .3, k = (.62 + .38 * rib) * v; const i = (y * W + x) * 4; im.data[i] = 235 * k; im.data[i + 1] = 105 * k; im.data[i + 2] = 22 * k; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
export function treeGeo(r, depth = 4) { const parts = []; const grow = (p, dir, len, rad, d) => { const end = p.clone().addScaledVector(dir, len); const g = new THREE.CylinderGeometry(rad * .62, rad, len, 6, 1); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate(p.x, p.y, p.z); parts.push(g);
    if (d <= 0) return; const n = d > 2 ? 3 : 2; for (let i = 0; i < n; i++) grow(end, dir.clone().add(new THREE.Vector3((r() - .5) * 1.5, (r() - .2) * .7, (r() - .5) * 1.2)).normalize(), len * (.62 + r() * .2), rad * .62, d - 1); };
  grow(new THREE.Vector3(), new THREE.Vector3((r() - .5) * .2, 1, 0).normalize(), 2.4, .3, depth); return mergeGeos(parts); }
export function mergeGeos(list) { let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of list) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o; oi += g.index.count; } else { for (let i = 0; i < c; i++) idx[oi + i] = o + i; oi += c; } o += c; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m; }
// a zombie hand + forearm, fingers spread (origin at the wrist bottom, +y up)
export function handGeo() { const parts = []; const arm = new THREE.CylinderGeometry(.055, .07, .42, 8); arm.translate(0, .21, 0); parts.push(arm);
  const palm = new THREE.BoxGeometry(.13, .14, .05); palm.translate(0, .48, 0); parts.push(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.CylinderGeometry(.013, .017, .13, 5); f.translate(0, .065, 0); f.rotateZ((i - 1.5) * .2); f.translate(-.045 + i * .03, .55, 0); parts.push(f); const tip = new THREE.CylinderGeometry(.01, .013, .07, 5); tip.translate(0, .035, 0); tip.rotateX(.5); tip.rotateZ((i - 1.5) * .2); tip.translate(-.045 + i * .03 + (i - 1.5) * .028, .675, .0); parts.push(tip); }
  const th = new THREE.CylinderGeometry(.014, .018, .1, 5); th.translate(0, .05, 0); th.rotateZ(1); th.translate(-.07, .46, 0); parts.push(th); return mergeGeos(parts); }
export function skinTex(seed) { const W = 128, [c, g] = cv(W, W), n = noise2(seed); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = n(x / 8, y / 8), i = (y * W + x) * 4, k = .7 + v * .5; im.data[i] = 96 * k; im.data[i + 1] = 128 * k; im.data[i + 2] = 82 * k; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
export function ghostGeo() { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; const u = Math.min(1, t / .42); pts.push(new THREE.Vector2(.3 * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))) + (t > .42 ? (t - .42) * .16 : 0), 1 - t)); } // round head, flowing skirt
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(.001, p.x), p.y * .9)), 24); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < .25) { const a = Math.atan2(v.z, v.x); v.y += Math.sin(a * 7) * .05 * (1 - v.y / .25); } p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; }
function eyesCanvas() { const [c, g] = cv(128, 64); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(44, 30, 10, 14, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(84, 30, 10, 14, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(64, 52, 8, 7, 0, 0, 7); g.fill(); return c; }
// keep decor off the playing lanes
function nearCourse(x, z, m = .8) { for (const H of HOLES) for (const P of H.poly) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [px, pz] of P) { const [wx, wz] = toWorld(H, px, pz); x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); }
    if (x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m) return true; }
  if (Math.abs(x) < 3.6 && z < -32 && z > -41) return true; return false; }
export function createWorld(renderer, seed = 13) {
  const S = new THREE.Scene(); const r = rnd(seed);
  const W = { scene: S, soft: softTexture(), smokeTex: smokeTexture(), bats: [], fogs: [], lanterns: [], rays: [], jacks: [], stones: [], hands: [], ghosts: [], t: 0, flash: 0, blood: 0, moonPunch: 0, wake: null };
  S.fog = new THREE.FogExp2('#10162c', .018); S.background = new THREE.Color('#04050c');
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), skyMaterial()); W.sky.frustumCulled = false; W.sky.renderOrder = -10; S.add(W.sky);
  W.moonGrp = new THREE.Group(); S.add(W.moonGrp);
  W.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(moonCanvas()), transparent: true, fog: false, depthWrite: false, color: '#d8ccb4' })); W.moon.scale.setScalar(34); W.moon.renderOrder = -9; W.moonGrp.add(W.moon);
  W.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#8ea4ff', transparent: true, opacity: .5, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); W.halo.scale.setScalar(88); W.halo.renderOrder = -8; W.moonGrp.add(W.halo);
  // ---- lights: cold moon key from behind (backlit silhouettes), cool fill, shared warm/green point lights that follow the active hole ----
  W.hemi = new THREE.HemisphereLight('#5868b0', '#1a1612', .75); S.add(W.hemi);
  W.key = new THREE.DirectionalLight('#aebfff', 2.4); S.add(W.key, W.key.target); W.key.shadow.bias = -.0004; W.key.shadow.normalBias = .03;
  const sc = W.key.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 13; sc.bottom = -13; sc.near = 2; sc.far = 80;
  W.front = new THREE.DirectionalLight('#7684cc', .5); W.front.position.set(3, 8, 12); S.add(W.front, W.front.target);
  W.cupLight = new THREE.PointLight('#5dff9a', 2.4, 5, 1.6); S.add(W.cupLight);
  W.lampA = new THREE.PointLight('#ff9b4a', 7, 9, 1.5); W.lampB = new THREE.PointLight('#ff8a3a', 6, 9, 1.5); S.add(W.lampA, W.lampB);
  W.ballLight = new THREE.PointLight('#bfe8ff', 0, 2.2, 1.8); S.add(W.ballLight);
  W.focus = (x, z, dz = -6) => { W.key.target.position.set(x, 0, z + dz); W.key.position.set(x + MOON_DIR.x * 30, 22, z + dz + MOON_DIR.z * 30); W.key.target.updateMatrixWorld(); W.front.target.position.set(x, 0, z + dz); W.front.position.set(x + 3, 8, z + 12); };
  // ---- ground ----
  const n = noise2(seed + 4); const gt = tex(grassTexture(seed), true, [60, 60]);
  const gg = new THREE.PlaneGeometry(220, 220, 140, 140); gg.rotateX(-Math.PI / 2); { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i), n)); gg.computeVertexNormals(); }
  W.ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: '#7f8a94' })); W.ground.receiveShadow = true; S.add(W.ground);
  for (const [x, z, s] of [[-70, -105, 44], [5, -120, 58], [75, -100, 42], [-120, -55, 40], [120, -45, 40]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshStandardMaterial({ color: '#080b14', roughness: 1 })); h.scale.set(s, s * .3, s * .5); h.position.set(x, -3, z); S.add(h); }
  // ---- materials ----
  const ST = stoneTextures(seed + 4, 512, 256); const stoneMap = tex(ST.map), stoneNor = tex(ST.normal, false); stoneMap.wrapS = stoneMap.wrapT = stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;
  const stoneM = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneNor, normalScale: new THREE.Vector2(1.2, 1.2), roughness: .93, color: '#a3a2b4' });
  const graveM = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneNor, roughness: .9, color: '#8c8b9c' });
  const woodT = tex(woodTexture(seed + 9, [84, 58, 40]), true); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; const woodM = new THREE.MeshStandardMaterial({ map: woodT, roughness: .85, color: '#9a8474' });
  const ironM = new THREE.MeshStandardMaterial({ color: '#2a2a30', metalness: .85, roughness: .45 });
  const barkM = new THREE.MeshStandardMaterial({ color: '#17130f', roughness: 1 });
  const dirtM = new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 1 });
  W.mats = { stoneM, graveM, woodM, ironM, barkM, dirtM };
  // ---- tombstones (instanced, 3 shapes), each with its own crooked tilt; they jolt during THE GRAVEYARD WAKES ----
  { const arch = new THREE.CylinderGeometry(.32, .32, .14, 18, 1, false, 0, Math.PI); arch.rotateX(Math.PI / 2); arch.rotateZ(Math.PI / 2); arch.rotateY(Math.PI / 2); arch.translate(0, .62, 0); const base = new THREE.BoxGeometry(.64, .62, .14); base.translate(0, .31, 0);
    const cross = mergeGeos([(() => { const a = new THREE.BoxGeometry(.13, 1.05, .12); a.translate(0, .52, 0); return a; })(), (() => { const a = new THREE.BoxGeometry(.56, .12, .12); a.translate(0, .74, 0); return a; })()]);
    const slab = new THREE.BoxGeometry(.56, .86, .16); slab.translate(0, .43, 0);
    const shapes = [mergeGeos([arch, base]), cross, slab]; const lists = [[], [], []];
    for (let gx = -30; gx <= 30; gx += 1.7) for (let gz = 6; gz >= -46; gz -= 1.9) { const x = gx + (r() - .5) * 1.1, z = gz + (r() - .5) * 1.0; if (nearCourse(x, z, .7) || r() < .35) continue; lists[Math.floor(r() * 3)].push({ x, z, ry: (r() - .5) * .5 + (r() < .1 ? Math.PI : 0), rx: (r() - .5) * .22, rz: (r() - .5) * .25, s: .8 + r() * .5 }); }
    W.stoneSets = lists.map((L, k) => { const im = new THREE.InstancedMesh(shapes[k], graveM, L.length); im.castShadow = true; im.receiveShadow = true; S.add(im); const set = { im, L }; L.forEach(o => o.jolt = 0); setStones(set); return set; });
    // dirt mounds in front of some stones (graves), zombie hands burst out of them
    const moundG = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); const ml = []; lists.flat().forEach(o => { if (r() < .55) ml.push(o); });
    const mi = new THREE.InstancedMesh(moundG, dirtM, ml.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    ml.forEach((o, i) => { const fx = o.x + Math.sin(o.ry) * .75, fz = o.z + Math.cos(o.ry) * .75; q.setFromEuler(new THREE.Euler(0, o.ry, 0)); m4.compose(new THREE.Vector3(fx, -.02, fz), q, new THREE.Vector3(.42 * o.s, .14, .8 * o.s)); mi.setMatrixAt(i, m4); W.hands.push({ x: fx + (r() - .5) * .3, z: fz + (r() - .5) * .4, ry: o.ry + (r() - .5) * 1.5, s: .9 + r() * .4, ph: r() * 6 }); });
    mi.receiveShadow = true; S.add(mi); }
  // ---- zombie hands (instanced; hidden until the graveyard wakes) ----
  { const hm = new THREE.MeshStandardMaterial({ map: tex(skinTex(seed + 3)), roughness: .8, color: '#b8c8a8', emissive: '#3a5a34', emissiveIntensity: .35 }); W.handMat = hm; const N = Math.min(70, W.hands.length);
    W.handIM = new THREE.InstancedMesh(handGeo(), hm, N); W.handIM.castShadow = true; W.handIM.count = 0; W.handIM.frustumCulled = false; S.add(W.handIM); W.handN = N; }
  // ---- dead trees ----
  for (const [x, z, s] of [[-24, -6, 1.4], [24.5, -9, 1.5], [-17, -16, 1.2], [13, -17, 1.25], [-24, -30, 1.7], [24, -34, 1.8], [-6, -44, 2.0], [8, -46, 2.1], [-30, -45, 2.2], [31, -20, 1.9]]) { const t = new THREE.Mesh(treeGeo(r, 4), barkM); t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = r() * 6; t.castShadow = true; S.add(t); }
  // ---- iron fence around the graveyard ----
  { const bars = []; const add = (x, z) => bars.push([x, z]); for (let x = -27; x <= 27; x += .26) { add(x, 5); add(x, -43); } for (let z = 5; z >= -43; z -= .26) { add(-27, z); add(27, z); }
    const bg = mergeGeos([(() => { const a = new THREE.CylinderGeometry(.018, .018, 1.6, 5); a.translate(0, .8, 0); return a; })(), (() => { const a = new THREE.ConeGeometry(.04, .14, 5); a.translate(0, 1.66, 0); return a; })()]);
    const im = new THREE.InstancedMesh(bg, ironM, bars.length); const m4 = new THREE.Matrix4(); bars.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); im.setMatrixAt(i, m4); }); S.add(im);
    for (const [x0, z0, x1, z1] of [[-27, 5, 27, 5], [-27, -43, 27, -43], [-27, 5, -27, -43], [27, 5, 27, -43]]) for (const y of [.3, 1.35]) { const L = Math.hypot(x1 - x0, z1 - z0); const b = new THREE.Mesh(new THREE.BoxGeometry(L, .04, .04), ironM); b.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); b.rotation.y = -Math.atan2(z1 - z0, x1 - x0); S.add(b); } }
  // ---- jack-o'-lanterns (emissive faces + glow; a wave ignites them when the graveyard wakes) ----
  { const fgeo = pumpkinGeo(22); const PT = tex(pumpkinTex(seed)); const faceT = tex(faceCanvas()); const stemM = new THREE.MeshStandardMaterial({ color: '#4a5a24', roughness: .8 });
    const spots = []; for (const H of HOLES) { const [tx, tz] = toWorld(H, H.tee[0], H.tee[1]); const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]); spots.push([tx - 1.9, tz + .6, .34], [cx + (H.id % 2 ? 2.2 : -2.2), cz - .4, .4]); }
    for (let i = 0; i < 16; i++) { let x, z; do { x = (r() - .5) * 50; z = 4 - r() * 46; } while (nearCourse(x, z, 1)); spots.push([x, z, .3 + r() * .25]); }
    for (const [x, z, s] of spots) { const mat = new THREE.MeshStandardMaterial({ map: PT, roughness: .55, emissiveMap: faceT, emissive: '#ff8a20', emissiveIntensity: 0 }); const j = new THREE.Mesh(fgeo, mat); j.scale.setScalar(s); j.position.set(x, s * .7, z); j.lookAt(x * .9, s * .7, z + 6); j.castShadow = true; S.add(j);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .18, 6), stemM); st.position.set(x, s * 1.4 + .04, z); S.add(st);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#ff8a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(x, s * .8, z + .15); gl.scale.setScalar(s * 3); S.add(gl);
      W.jacks.push({ mesh: j, mat, gl, on: 1, ph: r() * 6, x, z, flare: 0 }); } }
  // ---- lantern posts (two per hole; shared point lights sit in the two of the active hole) ----
  { const capM = new THREE.MeshStandardMaterial({ color: '#ffd08a', emissive: '#ff9a3a', emissiveIntensity: 2.4 }); W.posts = [];
    for (const H of HOLES) { const [tx, tz] = toWorld(H, H.tee[0], H.tee[1]); const [cx, cz] = toWorld(H, H.cup[0], H.cup[1]);
      for (const [x, z] of [[tx + 1.75, tz + .4], [cx + (H.id === 9 ? 2.5 : -1.9), cz + (H.id === 9 ? 4.0 : .8)]]) { if (H.id === 9 && z < -30) continue; const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.9, .1), ironM); post.position.y = .95; g.add(post);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(.4, .05, .05), ironM); arm.position.set(.18, 1.85, 0); g.add(arm); const cage = new THREE.Mesh(new THREE.CylinderGeometry(.11, .085, .24, 6), capM); cage.position.set(.36, 1.68, 0); g.add(cage);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#ffa050', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(.36, 1.68, 0); glow.scale.setScalar(1.3); g.add(glow);
        g.position.set(x, 0, z); g.rotation.y = x < cx ? 0 : Math.PI; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); S.add(g); W.posts.push({ g, x: x + Math.cos(g.rotation.y) * .36, z: z - Math.sin(g.rotation.y) * .36, hole: H.id, glow, ph: r() * 6 }); } } }
  // ---- god rays from the moon ----
  { const [c, g] = cv(64, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.3, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
    const rt = tex(c); for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4 + r() * 4, 60), new THREE.MeshBasicMaterial({ map: rt, color: '#7d90d8', transparent: true, opacity: .05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.position.set(-14 + i * 5.5 + r() * 2, 12, -52 - r() * 10); m.rotation.set(-.2, 0, (r() - .5) * .5 + (i - 2.5) * .1); S.add(m); W.rays.push({ m, ph: r() * 6, o: .03 + r() * .03 }); } }
  // ---- drifting ground mist sprites (on top of the screen-space height fog) ----
  for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.smokeTex, color: '#8796c8', transparent: true, opacity: .08, depthWrite: false })); s.position.set((r() - .5) * 50, .35 + r() * .5, 4 - r() * 46); s.scale.set(6 + r() * 6, 1.4 + r() * 1.2, 1); s.userData = { vx: (r() - .5) * .3 + .12, o: .05 + r() * .06 }; S.add(s); W.fogs.push(s); }
  // ---- wisps / fireflies ----
  { const N = 220, p = new Float32Array(N * 3), c = new Float32Array(N * 3), s = new Float32Array(N), a = new Float32Array(N); W.flyBase = []; const col = new THREE.Color();
    for (let i = 0; i < N; i++) { const b = [(r() - .5) * 50, .3 + r() * 2.2, 4 - r() * 46]; W.flyBase.push({ b, ph: r() * 6.28, sp: .4 + r() * .8 }); col.set(r() < .6 ? '#a8ffb0' : '#ffb04a'); c.set([col.r, col.g, col.b], i * 3); s[i] = .05 + r() * .06; a[i] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('size', new THREE.BufferAttribute(s, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(a, 1));
    W.flyMat = new THREE.ShaderMaterial({ uniforms: { map: { value: W.soft }, scale: { value: 800 }, t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale, t; void main(){ vC = color; vA = alpha * (.45 + .55 * sin(t * 3. + position.x * 4. + position.z)); vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * max(vA, 0.)); }' });
    W.flies = new THREE.Points(g, W.flyMat); W.flies.frustumCulled = false; S.add(W.flies); }
  // ---- bats (swarm) ----
  { const batM = new THREE.MeshBasicMaterial({ color: '#06060a', side: THREE.DoubleSide, fog: false }); const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -.06, .32, .04, -.02, 0, 0, .08, .32, .04, -.02, .26, -.05, .07, 0, 0, .08]), 3));
    W.batGeo = wing; W.batMat = batM;
    for (let i = 0; i < 36; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), batM); b.scale.set(1, .8, 1.5); g.add(b); const L = new THREE.Mesh(wing, batM), R = new THREE.Mesh(wing, batM); R.scale.x = -1; g.add(L, R); g.visible = false; g.scale.setScalar(1.1 + r() * .9); S.add(g); W.bats.push({ g, L, R, ph: r() * 6.28, sp: .8 + r() * .6, dy: (r() - .5) * 3, dx: (r() - .5) * 8 }); } }
  // ---- spirits that rise when the graveyard wakes ----
  { const gg2 = ghostGeo(); const eyes = tex(eyesCanvas());
    for (let i = 0; i < 10; i++) { const m = new THREE.MeshStandardMaterial({ color: '#dff4ff', emissive: '#8fd8ff', emissiveIntensity: .7, transparent: true, opacity: 0, depthWrite: false, roughness: .6 }); const g = new THREE.Mesh(gg2, m);
      const e = new THREE.Mesh(new THREE.PlaneGeometry(.3, .15), new THREE.MeshBasicMaterial({ map: eyes, color: '#05060a', transparent: true, opacity: 0, depthWrite: false, alphaMap: eyes })); e.position.set(0, .66, .3); g.add(e); g.visible = false; S.add(g); W.ghosts.push({ g, m, e, ph: r() * 6, r: .9 + r() * 1.6, sp: .8 + r() * .7 }); } }
  return W;
}
export function setStones(set) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  set.L.forEach((o, i) => { const j = o.jolt || 0, w = Math.sin(j * 40) * j * .25; e.set(o.rx + w, o.ry, o.rz + w * .6); q.setFromEuler(e); m4.compose(v.set(o.x, j * .06 * Math.abs(Math.sin(j * 30)), o.z), q, s.setScalar(o.s)); set.im.setMatrixAt(i, m4); }); set.im.instanceMatrix.needsUpdate = true; }
export function groundH(x, z, n) { const far = Math.max(0, Math.abs(x) - 28) + Math.max(0, -z - 44) + Math.max(0, z - 7); return far > 0 ? (n ? (n(x * .04 + 5, z * .04) - .3) * Math.min(1, far / 10) * 4 : 0) : 0; }
export function swarm(W) { W.swarm = 6; W.bats.forEach((b, i) => { b.g.visible = true; b.t0 = i * .04; }); }
// ---- screen-space height fog (ray-marched through a noisy ground layer, lit by the moon) ----
export function fogShader() { return {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, cameraNear: { value: .1 }, cameraFar: { value: 400 }, projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
    time: { value: 0 }, density: { value: .5 }, height: { value: 1.1 }, color: { value: new THREE.Color('#4a5a8a') }, moonCol: { value: new THREE.Color('#9fb0e8') }, moonDir: { value: MOON_DIR.clone() }, steps: { value: 5 }, glow: { value: new THREE.Color('#000') }, glowPos: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `#include <packing>
    varying vec2 vUv; uniform sampler2D tDiffuse, tDepth; uniform float cameraNear, cameraFar, time, density, height, steps; uniform mat4 projInv, camWorld; uniform vec3 camPos, color, moonCol, moonDir, glow, glowPos;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p){ return noise(p) * .55 + noise(p * 2.1 + 3.7) * .3 + noise(p * 4.3 + 1.3) * .15; }
    void main(){ vec4 col = texture2D(tDiffuse, vUv); float d = texture2D(tDepth, vUv).x;
      vec4 ndc = vec4(vUv * 2. - 1., d * 2. - 1., 1.); vec4 vp = projInv * ndc; vp /= vp.w; vec3 wp = (camWorld * vec4(vp.xyz, 1.)).xyz;
      vec3 rd = wp - camPos; float L = length(rd); if (d >= 1.) { L = 90.; wp = camPos + normalize(rd) * L; } vec3 dir = rd / max(length(rd), 1e-4);
      float Lm = min(L, 70.); float acc = 0.; float jit = hash(vUv * 731. + time) ;
      for (int i = 0; i < 8; i++) { if (float(i) >= steps) break; float s = (float(i) + jit) / steps; vec3 p = camPos + dir * (Lm * s * s);
        float hh = exp(-max(p.y, 0.) / height); float nz = fbm(p.xz * .22 + vec2(time * .05, time * .02)) * .8 + fbm(p.xz * .6 - vec2(time * .07, 0.)) * .4;
        acc += hh * (.35 + nz) * (Lm / steps) * (2. * s); }
      float f = 1. - exp(-acc * density * .06); float sc = pow(max(dot(dir, moonDir), 0.), 8.);
      vec3 fc = color + moonCol * sc * .55; float gd = length(wp - glowPos); fc += glow * exp(-gd * gd * .08);
      col.rgb = mix(col.rgb, fc, clamp(f, 0., .82)); gl_FragColor = col; }` }; }
export function gradeShader() { return { uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .32 }, grain: { value: .035 }, lift: { value: new THREE.Vector3(.0, .004, .018) }, sat: { value: 1.06 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time, vig, grain, sat; uniform vec3 lift;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb; float l = dot(x, vec3(.299, .587, .114));
      x = mix(vec3(l), x, sat); x += lift * (1. - l); x = mix(x, x * vec3(1.03, .99, .97), smoothstep(.35, .9, l));
      vec2 q = vUv - .5; float v = 1. - vig * smoothstep(.2, .85, dot(q, q) * 2.2); x *= v;
      x += (hash(vUv * 900. + fract(time * 7.)) - .5) * grain * (1. - l * .6); gl_FragColor = vec4(x, c.a); }` }; }
const _a = new THREE.Vector3(), _c = new THREE.Vector3();
export function updateWorld(W, t, dt, I = {}) {
  W.t = t; const u = W.sky.material.uniforms; u.time.value = t; u.flash.value = fin(W.flash); u.blood.value = fin(W.blood); u.glowK.value = fin(W.haloK ?? 1, 1);
  W.flash = Math.max(0, fin(W.flash) - dt * 1.6); W.moonPunch = Math.max(0, fin(W.moonPunch) - dt * 1.2);
  if (I.camX !== undefined) { W.sky.position.set(I.camX, I.camY, I.camZ); W.moonGrp.position.set(I.camX, I.camY, I.camZ).addScaledVector(MOON_DIR, 130); W.moonGrp.lookAt(I.camX, I.camY, I.camZ); }
  W.moon.material.color.setRGB(.86, .8 - .4 * W.blood, .7 - .5 * W.blood); W.halo.material.color.setRGB(.56 + .3 * W.blood, .64 - .25 * W.blood, 1 - .55 * W.blood); W.halo.material.opacity = (.4 + W.moonPunch * .35 + W.flash * .2) * fin(W.haloK ?? 1);
  W.moon.scale.setScalar(34 * (1 + W.moonPunch * .07)); W.key.color.setRGB(.68 + .3 * W.blood, .75 - .3 * W.blood, 1 - .55 * W.blood);
  // jack-o'-lanterns flicker (flare = wake ignition)
  const near = (x, z) => I.camX === undefined ? 1 : Math.min(1, Math.max(0, (Math.hypot(x - I.camX, z - I.camZ) - 1.2) / 2.5)); // glow sprites fade out right next to the camera: no glare
  for (const j of W.jacks) { j.flare = Math.max(0, fin(j.flare) - dt * 1.2); const k = fin(j.on) * (.8 + .2 * Math.sin(t * 11 + j.ph) * Math.sin(t * 7.3 + j.ph)) + j.flare * 1.5; j.mat.emissiveIntensity = k * 2.2; j.gl.material.opacity = Math.min(.9, k * .4) * near(j.x, j.z); j.gl.scale.setScalar(j.mesh.scale.x * (3 + j.flare * 3)); }
  for (const p of W.posts) p.glow.material.opacity = (.45 + .08 * Math.sin(t * 9 + p.ph)) * near(p.x, p.z);
  W.lampA.intensity = 7 * (.88 + .08 * Math.sin(t * 9) + .05 * Math.sin(t * 23)); W.lampB.intensity = 6 * (.88 + .08 * Math.sin(t * 8 + 2) + .05 * Math.sin(t * 19));
  W.fogs.forEach((s, i) => { s.position.x += s.userData.vx * dt; if (s.position.x > 27) s.position.x = -27; s.material.opacity = s.userData.o * (i < (I.fogN || 26) ? 1 : 0); });
  W.rays.forEach(R => R.m.material.opacity = R.o * (.7 + .3 * Math.sin(t * .4 + R.ph)) * (1 + W.moonPunch));
  { const p = W.flies.geometry.attributes.position, a = W.flies.geometry.attributes.alpha, N = I.flies || 110; for (let i = 0; i < W.flyBase.length; i++) { const f = W.flyBase[i]; const ph = f.ph + t * f.sp; p.setXYZ(i, f.b[0] + Math.sin(ph) * .8, f.b[1] + Math.sin(ph * 1.7) * .3, f.b[2] + Math.cos(ph * .8) * .8); a.setX(i, i < N ? 1 : 0); }
    p.needsUpdate = true; a.needsUpdate = true; W.flyMat.uniforms.t.value = t; if (I.scale) W.flyMat.uniforms.scale.value = I.scale; }
  if (W.swarm > 0) { W.swarm -= dt; const e = 6 - W.swarm, o = W.swarmAt || [0, 0]; W.bats.forEach((b, i) => { const k = Math.max(0, e - b.t0); b.ph += dt * 14 * b.sp; const fl = Math.sin(b.ph) * .9; b.L.rotation.z = fl; b.R.rotation.z = -fl;
      b.g.position.set(o[0] - 10 + k * 5 + b.dx, 1.5 + b.dy * .6 + k * 1.6 + Math.sin(k * 2 + i) * .6, o[1] + 3 - k * 4 - i * .1); b.g.lookAt(_c.set(b.g.position.x + 5, b.g.position.y + 1.6, b.g.position.z - 4)); });
    if (W.swarm <= 0) W.bats.forEach(b => b.g.visible = false); }
}
