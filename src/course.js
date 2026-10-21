// Builds the nine holes into the graveyard: velvet felt (sheen) on real slopes and ramps, stone cushions, cups with
// flags, open graves, crooked headstones and all moving obstacles (coffin pendulums, zombie hands, the scarecrow mill,
// bats, the ghost, the crypt tunnel, coffin flap and the mausoleum's iron doors).
import * as THREE from 'three';
import { cv, tex, rnd, noise2, normalFrom, woodTexture } from './tex.js';
import { HOLES, pose, floorAt } from './holes.js';
import { R, CUP } from './physics.js';
import { toWorld, pumpkinGeo, mergeGeos, ghostGeo, handGeo, skinTex } from './world.js';
function feltCanvas(seed, base) { const W = 512, [c, g] = cv(W, W), n = noise2(seed), r = rnd(seed); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = n(x / 40, y / 40) * .5 + n(x / 6, y / 6) * .5, i = (y * W + x) * 4, k = .82 + v * .3 + (r() - .5) * .08; im.data[i] = base[0] * k; im.data[i + 1] = base[1] * k; im.data[i + 2] = base[2] * k; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
function feltNormal(seed) { const W = 256, [c, g] = cv(W, W), r = rnd(seed); g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); for (let i = 0; i < 9000; i++) { const x = r() * W, y = r() * W, a = r() * 6.28; g.strokeStyle = `rgba(${r() < .5 ? 255 : 0},${r() < .5 ? 255 : 0},${r() < .5 ? 255 : 0},.12)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); g.stroke(); } return normalFrom(c, 1.4); }
function dimpleNormal() { const W = 256, [c, g] = cv(W, W / 2); g.fillStyle = '#fff'; g.fillRect(0, 0, W, W / 2); for (let j = 0; j < 14; j++) for (let i = 0; i < 28; i++) { const x = (i + (j % 2) * .5) * W / 28, y = (j + .5) * W / 2 / 14; const gr = g.createRadialGradient(x, y, 0, x, y, 4.2); gr.addColorStop(0, '#555'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 4.3, 0, 7); g.fill(); } return normalFrom(c, 2.2); }
export function flagCanvas(n, col = '#d8f8c0') { const [c, g] = cv(256, 160); g.fillStyle = '#1a0d22'; g.fillRect(0, 0, 256, 160); const gr = g.createLinearGradient(0, 0, 256, 160); gr.addColorStop(0, '#5a1d6e'); gr.addColorStop(1, '#2a0d3a'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); for (let x = 256; x >= 0; x -= 32) g.lineTo(x, 150 - (x / 32 % 2) * 22); g.closePath(); g.fill();
  g.font = '700 96px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#12051a'; g.strokeText(String(n), 128, 72); g.fillStyle = col; g.fillText(String(n), 128, 72); return c; }
function signCanvas(n, name) { const [c, g] = cv(256, 256); g.fillStyle = '#2a2833'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#6a6578'; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236);
  g.font = '700 120px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd08a'; g.shadowColor = '#ff8a2a'; g.shadowBlur = 18; g.fillText(String(n), 128, 120); g.shadowBlur = 0; g.font = '600 26px Fredoka, sans-serif'; g.fillStyle = '#d8cce8'; g.fillText(name, 128, 212); return c; }
function windowCanvas() { const [c, g] = cv(256, 256); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); const cols = ['#3dff8a', '#9a4dff', '#ff7a2a', '#2ac8ff'];
  for (let k = 0; k < 12; k++) { g.fillStyle = cols[k % 4]; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 118, k / 12 * 6.283, (k + 1) / 12 * 6.283); g.closePath(); g.fill(); }
  g.strokeStyle = '#000'; g.lineWidth = 9; for (let k = 0; k < 12; k++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(k / 12 * 6.283) * 120, 128 + Math.sin(k / 12 * 6.283) * 120); g.stroke(); } g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 128, 46, 0, 7); g.fillStyle = '#ffe9a8'; g.fill(); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(112, 120, 9, 12, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(144, 120, 9, 12, 0, 0, 7); g.fill(); g.fillRect(118, 146, 20, 8); return c; }
function tombGeo(w, h, d) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2, curveSegments: 12 }); g.translate(0, 0, -d / 2); return g; }
function coffinLidGeo(w, L, d) { const s = new THREE.Shape(); s.moveTo(-w * .35, 0); s.lineTo(-w * .5, L * .72); s.lineTo(-w * .3, L); s.lineTo(w * .3, L); s.lineTo(w * .5, L * .72); s.lineTo(w * .35, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }); g.translate(0, 0, -d / 2); return g; }
function gateGeo(w, h) { const parts = []; for (let x = .06; x < w; x += .13) { const b = new THREE.CylinderGeometry(.016, .016, h, 5); b.translate(x, h / 2, 0); parts.push(b); const sp = new THREE.ConeGeometry(.035, .12, 5); sp.translate(x, h + .06, 0); parts.push(sp); }
  for (const y of [.12, h * .55, h - .06]) { const b = new THREE.BoxGeometry(w, .04, .04); b.translate(w / 2, y, 0); parts.push(b); } const st = new THREE.BoxGeometry(.06, h, .06); st.translate(.03, h / 2, 0); parts.push(st); return mergeGeos(parts); }
export function createCourse(W) {
  const S = W.scene, r = rnd(7), M = W.mats; const C = { holes: [], cupsU: [] };
  const feltM = (base, sheen) => { const ft = tex(feltCanvas(31, base), true, [3, 3]); const fn = tex(feltNormal(5), false, [6, 6]); fn.wrapS = fn.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshPhysicalMaterial({ map: ft, normalMap: fn, normalScale: new THREE.Vector2(.5, .5), roughness: .88, sheen: 1, sheenRoughness: .45, sheenColor: new THREE.Color(sheen), color: '#ffffff' });
    m.onBeforeCompile = sh => { sh.uniforms.cups = { value: C.cupsU }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform vec3 cups[9];').replace('void main() {', 'void main() {\n for (int i = 0; i < 9; i++) { if (length(vWp.xz - cups[i].xy) < cups[i].z) discard; }'); }; return m; };
  const feltG = feltM([44, 112, 80], '#8fe8b0'), feltP = feltM([66, 40, 96], '#b890f0');
  const railStone = M.stoneM, railWood = new THREE.MeshStandardMaterial({ map: tex(woodTexture(41, [52, 30, 24]), true), roughness: .7, color: '#8a6a5a' });
  const ballMat = new THREE.MeshPhysicalMaterial({ color: '#f4f0e6', roughness: .32, clearcoat: 1, clearcoatRoughness: .2, normalMap: tex(dimpleNormal(), false), normalScale: new THREE.Vector2(.22, .22), emissive: '#8a96a8', emissiveIntensity: .22 });
  C.ballMat = ballMat; C.ballGeo = new THREE.SphereGeometry(R, 40, 28);
  const linerM = new THREE.MeshStandardMaterial({ color: '#0a0a0e', roughness: .6, metalness: .6, side: THREE.BackSide }), rimM = new THREE.MeshStandardMaterial({ color: '#c8c8d0', metalness: .9, roughness: .3 });
  const boneM = new THREE.MeshStandardMaterial({ color: '#e8e0cc', roughness: .6 });
  const glowRingM = new THREE.MeshBasicMaterial({ color: '#5dff9a', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ghostM = new THREE.MeshStandardMaterial({ color: '#e4f6ff', emissive: '#7fd0ff', emissiveIntensity: .8, transparent: true, opacity: .85, depthWrite: false, roughness: .5 });
  const skinM = new THREE.MeshStandardMaterial({ map: tex(skinTex(19)), roughness: .8, color: '#b8c8a8' });
  const strawM = new THREE.MeshStandardMaterial({ color: '#b89a5a', roughness: 1 }), sackM = new THREE.MeshStandardMaterial({ color: '#6a5238', roughness: 1 });
  C.mats = { feltG, feltP, ballMat, ghostM };
  for (const H of HOLES) {
    const g = new THREE.Group(); g.position.set(H.off[0], 0, H.off[1]); S.add(g); const hv = { H, g, dyn: [], flagVerts: null };
    const [cwx, cwz] = toWorld(H, H.cup[0], H.cup[1]); C.cupsU.push(new THREE.Vector3(cwx, cwz, CUP));
    // ---- felt: 10 cm grid following the slopes; open graves cut out ----
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const P of H.poly) for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const sp = .1, nx = Math.ceil((x1 - x0) / sp) + 2, nz = Math.ceil((z1 - z0) / sp) + 2, bx = Math.floor(x0 / sp) * sp - sp, bz = Math.floor(z0 / sp) * sp - sp;
    const pos = [], idx = [], uvs = [], vid = new Map(); const V = (i, j) => { const k = i * 100000 + j; if (vid.has(k)) return vid.get(k); const x = bx + i * sp, z = bz + j * sp; pos.push(x, H.h(x, z) + .002, z); uvs.push((x + H.off[0]) * .5, (z + H.off[1]) * .5); vid.set(k, pos.length / 3 - 1); return pos.length / 3 - 1; };
    const inside = (x, z) => { for (const P of H.poly) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } if (c) return true; } return false; };
    const inPit = (x, z) => H.pits && H.pits.some(([a, b, c, d]) => x > a + 1e-4 && x < c - 1e-4 && z > b + 1e-4 && z < d - 1e-4);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = bx + (i + .5) * sp, z = bz + (j + .5) * sp; if (inPit(x, z)) continue;
      let hit = inside(x, z); if (!hit) for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) if (inside(x + dx * sp * .98, z + dz * sp * .98)) { hit = true; break; } if (!hit) continue;
      const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1); idx.push(a, d, b, b, d, c); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.setIndex(idx); fg.computeVertexNormals();
    const felt = new THREE.Mesh(fg, H.id === 9 ? feltP : feltG); felt.receiveShadow = true; g.add(felt); hv.felt = felt;
    // ---- cushions: stone (wood along the coffin run of hole 9), following the floor ----
    for (const P of H.poly) { let area = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (H.tunnel && Math.abs(a[1] - H.tunnel.z) < 1e-6 && Math.abs(b[1] - H.tunnel.z) < 1e-6) continue;
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; const nxo = area > 0 ? uz : -uz, nzo = area > 0 ? -ux : ux; // outward normal
        const coffin = H.id === 9 && Math.abs(a[0]) <= .46 && Math.abs(b[0]) <= .46; const T = coffin ? .08 : .16, top = coffin ? .3 : .21, Lx = L + T * 2;
        const bg = new THREE.BoxGeometry(Lx, 1, T, Math.max(1, Math.ceil(Lx / .25)), 1, 1); const p = bg.attributes.position;
        for (let k = 0; k < p.count; k++) { const lx = p.getX(k), ly = p.getY(k), lz = p.getZ(k); const u = Math.min(L, Math.max(0, lx + L / 2)); const ex = a[0] + ux * u, ez = a[1] + uz * u; const wx = a[0] + ux * (lx + L / 2) + nxo * (lz + T / 2), wz = a[1] + uz * (lx + L / 2) + nzo * (lz + T / 2);
          const hy = H.h(ex, ez); p.setXYZ(k, wx, ly > 0 ? hy + top : Math.min(hy, 0) - .02, wz); }
        bg.computeVertexNormals(); const m = new THREE.Mesh(bg, coffin ? railWood : railStone); m.castShadow = true; m.receiveShadow = true; g.add(m); } }
    // ---- cup: liner, rim, glow ring, bone flag pole with a tattered flag ----
    { const [cx, cz] = H.cup, cy = H.h(cx, cz); const liner = new THREE.Mesh(new THREE.CylinderGeometry(CUP, CUP, .3, 40, 1, true), linerM); liner.position.set(cx, cy - .15, cz); g.add(liner);
      const bot = new THREE.Mesh(new THREE.CircleGeometry(CUP, 40), new THREE.MeshStandardMaterial({ color: '#050507' })); bot.rotation.x = -Math.PI / 2; bot.position.set(cx, cy - .28, cz); g.add(bot);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP + .004, .007, 6, 48), rimM); rim.rotation.x = Math.PI / 2; rim.position.set(cx, cy + .002, cz); g.add(rim);
      const gr = new THREE.Mesh(new THREE.RingGeometry(CUP + .03, CUP + .1, 48), glowRingM.clone()); gr.rotation.x = -Math.PI / 2; gr.position.set(cx, cy + .012, cz); g.add(gr); hv.glow = gr;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.014, .018, 1.25, 8), boneM); pole.position.set(cx, cy + .55, cz); g.add(pole); hv.pole = pole;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), boneM); skull.position.set(cx, cy + 1.2, cz); g.add(skull);
      const fgm = new THREE.PlaneGeometry(.5, .32, 10, 3); fgm.translate(.25, 0, 0); const fl = new THREE.Mesh(fgm, new THREE.MeshStandardMaterial({ map: tex(flagCanvas(H.id)), side: THREE.DoubleSide, roughness: .9, emissive: '#3a1050', emissiveIntensity: .4 })); fl.position.set(cx + .012, cy + 1.0, cz); g.add(fl); hv.flag = fl; hv.flagBase = Float32Array.from(fgm.attributes.position.array); hv.cupY = cy; }
    // ---- tee pad + hole sign ----
    { const [tx, tz] = H.tee; const pad = new THREE.Mesh(new THREE.BoxGeometry(.7, .02, .5), new THREE.MeshStandardMaterial({ color: '#4a1018', roughness: .9 })); pad.position.set(tx, H.h(tx, tz) + .006, tz + .1); pad.receiveShadow = true; g.add(pad);
      const sg = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .08), [M.stoneM, M.stoneM, M.stoneM, M.stoneM, new THREE.MeshStandardMaterial({ map: tex(signCanvas(H.id, '')), emissive: '#ffffff', emissiveMap: tex(signCanvas(H.id, '')), emissiveIntensity: .35, roughness: .8 }), M.stoneM]);
      sg.position.set(tx - 1.65, .45, tz - .6); sg.rotation.y = .25; sg.castShadow = true; g.add(sg); const st = new THREE.Mesh(new THREE.BoxGeometry(.1, .25, .08), M.stoneM); st.position.set(tx - 1.65, .1, tz - .6); g.add(st); }
    // ---- static headstones and posts on the lane ----
    for (const o of H.stat) { if (o.inv) continue; if (o.k === 'box') { const m = new THREE.Mesh(tombGeo(o.w, .78, o.d), M.graveM); m.position.set(o.x, H.h(o.x, o.z) - .02, o.z); m.rotation.y = -o.r; m.rotation.z = (r() - .5) * .08; m.castShadow = m.receiveShadow = true; g.add(m); }
      else { const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r * 1.1, .9, 14), M.stoneM); m.position.set(o.x, H.h(o.x, o.z) + .45, o.z); m.castShadow = true; g.add(m); const ball = new THREE.Mesh(new THREE.SphereGeometry(o.r * .9, 14, 10), M.stoneM); ball.position.set(o.x, H.h(o.x, o.z) + 1.0, o.z); g.add(ball); } }
    // ---- open graves ----
    if (H.pits) for (const [a, b, c, d] of H.pits) { const w = c - a, l = d - b, dep = H.deep ? 1.3 : .9, y0 = H.h((a + c) / 2, (b + d) / 2);
      const pit = new THREE.Mesh(new THREE.BoxGeometry(w, dep, l), new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 1, side: THREE.BackSide })); pit.position.set((a + c) / 2, y0 - dep / 2 + .001, (b + d) / 2); pit.receiveShadow = true; g.add(pit);
      const cof = new THREE.Mesh(coffinLidGeo(Math.min(.8, w * .8), Math.min(1.7, l * .85), .1), railWood); cof.rotation.x = -Math.PI / 2; cof.rotation.z = w > l ? Math.PI / 2 : 0; cof.position.set((a + c) / 2, y0 - dep + .06, (b + d) / 2 + (w > l ? 0 : l * .42)); if (w > l) cof.position.x -= Math.min(1.7, w * .85) * .5 * 0; g.add(cof); }
    // ---- hole 1: the cemetery gate ----
    if (H.deco && H.deco.gate) { const z = H.deco.gate; for (const sx of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(.4, 2.3, .4), M.stoneM); pil.position.set(sx * 1.6, 1.15, z); pil.castShadow = true; g.add(pil); const cap = new THREE.Mesh(new THREE.ConeGeometry(.3, .4, 4), M.stoneM); cap.position.set(sx * 1.6, 2.5, z); cap.rotation.y = Math.PI / 4; g.add(cap);
        const leaf = new THREE.Mesh(gateGeo(1.35, 1.9), M.ironM); leaf.position.set(sx * 1.45, .02, z + .05); leaf.rotation.y = sx < 0 ? Math.PI / 2 + .25 : Math.PI / 2 - .25; if (sx > 0) leaf.scale.x = -1; leaf.castShadow = true; g.add(leaf); }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, .05, 6, 32, Math.PI), M.ironM); arch.position.set(0, 2.25, z); g.add(arch); const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, .06, .06), M.ironM); bar.position.set(0, 2.25, z); g.add(bar); }
    // ---- moving obstacles ----
    for (const o of H.dyn) { const d = { o };
      if (o.k === 'pend') { for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.14, 2.4, .14), M.woodM); p.position.set(sx * 1.62, 1.2, o.z); p.castShadow = true; g.add(p); } const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, .14, .16), M.woodM); beam.position.set(0, 2.36, o.z); beam.castShadow = true; g.add(beam);
        const piv = new THREE.Group(); piv.position.set(0, 2.3, o.z); g.add(piv); const lid = new THREE.Mesh(coffinLidGeo(.64, 2.1, .1), railWood); lid.rotation.z = Math.PI; lid.position.y = -.12; lid.castShadow = true; piv.add(lid);
        const cr = new THREE.Mesh(new THREE.BoxGeometry(.05, .5, .02), boneM); cr.position.set(0, -1.15, .06); piv.add(cr); const cr2 = new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .02), boneM); cr2.position.set(0, -1.05, .06); piv.add(cr2);
        for (const sx of [-.18, .18]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .2, 4), M.ironM); ch.position.set(sx, -.04, 0); piv.add(ch); } d.piv = piv; }
      else if (o.k === 'hand') { const hole = new THREE.Mesh(new THREE.CircleGeometry(.2, 20), new THREE.MeshBasicMaterial({ color: '#050403' })); hole.rotation.x = -Math.PI / 2; hole.position.set(o.x, H.h(o.x, o.z) + .004, o.z); g.add(hole);
        const hm = new THREE.Mesh(handGeo(), skinM); hm.position.set(o.x, -1, o.z); hm.castShadow = true; hm.scale.setScalar(1.15); g.add(hm); d.m = hm; d.y0 = H.h(o.x, o.z); }
      else if (o.k === 'mill') { const grp = new THREE.Group(); grp.position.set(o.x, H.h(o.x, o.z), o.z); g.add(grp); const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, 1.5, 10), M.woodM); post.position.y = .75; grp.add(post); post.castShadow = true;
        const rot = new THREE.Group(); grp.add(rot); d.rot = rot; const body = new THREE.Mesh(new THREE.ConeGeometry(.3, .8, 10, 1, true), sackM); body.position.y = 1.15; rot.add(body);
        const head = new THREE.Mesh(pumpkinGeo(18), W.jacks[0].mat); head.scale.setScalar(.22); head.position.y = 1.68; rot.add(head); const hat = new THREE.Mesh(new THREE.ConeGeometry(.24, .38, 12), new THREE.MeshStandardMaterial({ color: '#1a1420', roughness: 1 })); hat.position.y = 1.98; rot.add(hat); const brim = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .02, 16), hat.material); brim.position.y = 1.82; rot.add(brim);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(o.len * 2, .07, .07), M.woodM); arm.position.y = 1.32; rot.add(arm); const sweep = new THREE.Mesh(new THREE.BoxGeometry(o.len * 2, .12, .09), M.woodM); sweep.position.y = .085; sweep.castShadow = true; rot.add(sweep);
        for (const sx of [-1, 1]) { const h2 = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.25, 6), M.woodM); h2.position.set(sx * (o.len - .06), .7, 0); rot.add(h2); const br = new THREE.Mesh(new THREE.ConeGeometry(.13, .3, 10), strawM); br.position.set(sx * (o.len - .06), .2, 0); br.rotation.x = Math.PI; rot.add(br);
          const sl = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .45, 8, 1, true), sackM); sl.rotation.z = Math.PI / 2; sl.position.set(sx * .45, 1.32, 0); rot.add(sl); }
        rot.traverse(m => { if (m.isMesh) m.castShadow = true; }); }
      else if (o.k === 'bat') { const b = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), W.batMat); body.scale.set(1, .8, 1.5); b.add(body); const L = new THREE.Mesh(W.batGeo, W.batMat), Rr = new THREE.Mesh(W.batGeo, W.batMat); Rr.scale.x = -1; b.add(L, Rr); const eye = new THREE.Mesh(new THREE.SphereGeometry(.015, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff4020' })); eye.position.set(.03, .03, .09); const eye2 = eye.clone(); eye2.position.x = -.03; b.add(eye, eye2);
        b.scale.setScalar(2.1); g.add(b); d.b = b; d.L = L; d.R = Rr; }
      else if (o.k === 'ghost') { const gm = new THREE.Mesh(ghostGeo(), ghostM.clone()); gm.scale.setScalar(1.25); g.add(gm); d.m = gm; const eyes = new THREE.Mesh(new THREE.PlaneGeometry(.34, .17), new THREE.MeshBasicMaterial({ color: '#05060a', transparent: true, depthWrite: false })); eyes.position.set(0, .7, .32); gm.add(eyes); d.eyes = eyes;
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#7fd8ff', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.8); g.add(gl); d.gl = gl;
        const pr = new THREE.Mesh(new THREE.RingGeometry(.16, .26, 40), new THREE.MeshBasicMaterial({ color: '#c070ff', transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); pr.rotation.x = -Math.PI / 2; pr.position.set(H.portal[0], H.h(H.portal[0], H.portal[1]) + .012, H.portal[1]); g.add(pr); d.portal = pr; }
      else if (o.k === 'door') { const piv = new THREE.Group(); piv.position.set(o.hx, H.h(o.hx, o.hz), o.hz); g.add(piv);
        if (o.flap) { const fm = new THREE.Mesh(new THREE.BoxGeometry(o.len, .3, .05), railWood); fm.position.set(o.len / 2, .17, 0); fm.castShadow = true; piv.add(fm); }
        else { const gm = new THREE.Mesh(gateGeo(o.len, 2.3), M.ironM); gm.castShadow = true; piv.add(gm); if (o.a0 > 1) { gm.scale.x = 1; } }
        d.piv = piv; }
      hv.dyn.push(d); }
    // ---- hole 6: the crypt tunnel (entrance + exit) ----
    if (H.tunnel) { const tn = H.tunnel; const mk = (cx, cz, face) => { const cg = new THREE.Group(); cg.position.set(cx, 0, cz); cg.rotation.y = face; g.add(cg);
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.2), M.stoneM); body.position.set(0, 1.2, -1.15); body.castShadow = body.receiveShadow = true; cg.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), M.stoneM); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .7); roof.position.set(0, 3.1, -1.15); roof.castShadow = true; cg.add(roof);
        const cross = new THREE.Mesh(mergeGeos([new THREE.BoxGeometry(.1, .6, .1), (() => { const a = new THREE.BoxGeometry(.36, .1, .1); a.translate(0, .1, 0); return a; })()]), M.stoneM); cross.position.set(0, 4.05, -1.15); cg.add(cross);
        const arch = new THREE.Mesh(new THREE.CircleGeometry(.36, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#000' })); arch.position.set(0, .3, -.04 + .001); cg.add(arch); const sq = new THREE.Mesh(new THREE.PlaneGeometry(.72, .3), arch.material); sq.position.set(0, .15, -.039); cg.add(sq);
        const big = new THREE.Mesh(new THREE.CircleGeometry(.75, 24, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#0c0a12', roughness: 1 })); big.position.set(0, 1.15, -.035); cg.add(big); const big2 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .4), big.material); big2.position.set(0, .95, -.036); cg.add(big2);
        const eyes = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#ff5a2a', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); eyes.position.set(0, 1.2, .1); eyes.scale.set(.9, .35, 1); cg.add(eyes); return cg; };
      hv.crypt = mk(tn.x, tn.z + 0, 0); hv.crypt.children[0].position.z = -1.15; const ex = mk(tn.exit[0], tn.exit[1] + .35, Math.PI); hv.cryptB = ex; }
    // ---- hole 9: the coffin run and the mausoleum ----
    if (H.id === 9) { const lid = new THREE.Mesh(coffinLidGeo(1.05, 2.9, .09), railWood); lid.position.set(.95, .5, -11.1); lid.rotation.set(-Math.PI / 2 + .35, 0, Math.PI / 2 - .2); lid.rotation.order = 'YXZ'; lid.castShadow = true; g.add(lid);
      const cr = new THREE.Mesh(new THREE.BoxGeometry(.07, 1.1, .02), boneM); g.add(cr); cr.position.set(1.05, .78, -11.1); cr.rotation.set(-.4, 0, 0);
      const mz = new THREE.Group(); g.add(mz); const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; mz.add(m); return m; };
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.6, 3.4, 5.6), M.stoneM, sx * 1.98, 1.7, -16.3);
      add(new THREE.BoxGeometry(4.6, 3.4, .5), M.stoneM, 0, 1.7, -19.05); add(new THREE.BoxGeometry(5.4, .9, .9), M.stoneM, 0, 3.0, -13.8);
      add(new THREE.BoxGeometry(4.9, .25, 6.2), M.stoneM, 0, 3.55, -16.3); const ped = add(new THREE.CylinderGeometry(3.0, 3.0, .8, 3, 1), M.stoneM, 0, 3.92, -13.75); ped.rotation.set(-Math.PI / 2, 0, 0); ped.scale.set(1, 1, .31); // triangular gable over the doors
      for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(.22, .26, 2.6, 14), M.stoneM, sx * 2.45, 1.3, -13.45); add(new THREE.BoxGeometry(.6, .2, .6), M.stoneM, sx * 2.45, 2.65, -13.45); add(new THREE.BoxGeometry(.6, .2, .6), M.stoneM, sx * 2.45, .1, -13.45); }
      const roofL = add(new THREE.BoxGeometry(3.2, .2, 6.6), M.stoneM, -1.35, 4.3, -16.3); roofL.rotation.z = .55; const roofR = add(new THREE.BoxGeometry(3.2, .2, 6.6), M.stoneM, 1.35, 4.3, -16.3); roofR.rotation.z = -.55;
      const wt = tex(windowCanvas()); const win = new THREE.Mesh(new THREE.CircleGeometry(.62, 40), new THREE.MeshBasicMaterial({ map: wt, color: '#ffffff' })); win.position.set(0, 2.2, -18.79); mz.add(win); hv.window = win;
      const altar = add(new THREE.BoxGeometry(1.6, .8, .5), M.stoneM, 0, .4, -18.45); altar.castShadow = false;
      hv.candles = []; for (const x of [-.6, -.3, .3, .6]) { const c = add(new THREE.CylinderGeometry(.035, .035, .25, 8), boneM, x, .93, -18.45); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#ffb050', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })); fl.position.set(x, 1.12, -18.45); fl.scale.setScalar(.22); mz.add(fl); hv.candles.push(fl); }
      const sk = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 12), boneM); sk.position.set(0, 3.0, -13.3); sk.scale.set(.6, .66, .3); mz.add(sk);
      hv.torches = []; for (const sx of [-1, 1]) { const br = add(new THREE.BoxGeometry(.08, .32, .08), M.ironM, sx * 2.45, 1.95, -13.18); br.castShadow = false; const cup = add(new THREE.CylinderGeometry(.1, .06, .14, 8), M.ironM, sx * 2.45, 2.15, -13.12); cup.castShadow = false;
        for (const [sz, col, op] of [[.55, '#ff7a2a', .75], [.3, '#ffd08a', .95]]) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); f.position.set(sx * 2.45, 2.32, -13.1); f.scale.set(sz * .7, sz, 1); mz.add(f); hv.torches.push({ f, sz, ph: r() * 6 }); } }
      C.mzTorch = new THREE.PointLight('#ff9040', 9, 9, 1.4); C.mzTorch.position.set(H.off[0], 2.3, H.off[1] - 12.4); S.add(C.mzTorch);
      C.mzLight = new THREE.PointLight('#a070ff', 3, 7, 1.6); C.mzLight.position.set(H.off[0], 2.2, H.off[1] - 17.6); S.add(C.mzLight); hv.mz = mz;
      C.occluders = mz.children.filter(m => m.isMesh); }
    hv.g.updateMatrixWorld(true); C.holes.push(hv);
  }
  // cups sit in shallow bowls and some holes slope below y = 0: a course mask cuts the ground plane away under every
  // hole (the cushions hide the seam), so the ground never pokes through the felt
  { const [mc, mg] = cv(1024, 1024); mg.fillStyle = '#000'; mg.fillRect(0, 0, 1024, 1024); mg.fillStyle = mg.strokeStyle = '#fff'; mg.lineWidth = .1 * 1024 / 60; mg.lineJoin = 'round';
    const X = x => (x + 30) / 60 * 1024, Z = z => (8 - z) / 54 * 1024;
    for (const H of HOLES) for (const P of H.poly) { mg.beginPath(); P.forEach(([x, z], k) => { const [wx, wz] = toWorld(H, x, z); k ? mg.lineTo(X(wx), Z(wz)) : mg.moveTo(X(wx), Z(wz)); }); mg.closePath(); mg.fill(); mg.stroke(); }
    const mt = new THREE.CanvasTexture(mc); mt.flipY = false;
    W.ground.material.onBeforeCompile = sh => { sh.uniforms.cmask = { value: mt }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform sampler2D cmask;').replace('void main() {', 'void main() {\n vec2 mu = vec2((vWp.x + 30.) / 60., (8. - vWp.z) / 54.); if (mu.x > 0. && mu.x < 1. && mu.y > 0. && mu.y < 1. && texture2D(cmask, mu).r > .5) discard;'); }; W.ground.material.needsUpdate = true; }
  return C;
}
const _v = new THREE.Vector3();
export function updateCourse(C, t, k, dt, active) {
  for (const hv of C.holes) { const H = hv.H; const T = t * k;
    for (const d of hv.dyn) { const o = d.o, p = pose(o, T);
      if (o.k === 'pend') d.piv.rotation.z = Math.asin(Math.max(-1, Math.min(1, p.x / 2.2)));
      else if (o.k === 'hand') { d.m.position.y = d.y0 - .78 + p.up * .78; d.m.rotation.set(p.wave * .15 * p.up, o.ph * 2, p.wave * .2 * p.up); d.m.visible = p.up > .01; }
      else if (o.k === 'mill') d.rot.rotation.y = -p.ang;
      else if (o.k === 'bat') { d.b.position.set(p.x, H.h(p.x, p.z) + p.y, p.z); const p2 = pose(o, T + .05); d.b.lookAt(_v.set(p2.x + H.off[0], d.b.position.y, p2.z + H.off[1])); const fl = Math.sin(p.flap) * .9; d.L.rotation.z = fl; d.R.rotation.z = -fl; }
      else if (o.k === 'ghost') { const y = H.h(p.x, p.z) + .15 + Math.sin(T * 2.2) * .08; d.m.position.set(p.x, y, p.z); d.m.rotation.y = Math.sin(T * .9) * .4; d.m.material.opacity = .12 + .75 * p.vis; d.m.material.emissiveIntensity = .3 + .7 * p.vis; d.eyes.material.opacity = .15 + .85 * p.vis; d.gl.position.set(p.x, y + .55, p.z); d.gl.material.opacity = .1 + .35 * p.vis; d.portal.material.opacity = .35 + .25 * Math.sin(T * 3); d.portal.rotation.z = T; }
      else if (o.k === 'door') { d.ho = Math.max(0, Math.min(1, (d.ho || 0) + (C.holdOpen && !o.flap ? .12 : -.05))); d.piv.rotation.y = -(p.ang + (o.a1 - p.ang) * d.ho * d.ho * (3 - 2 * d.ho)); } } // the iron doors swing open for the waking-graveyard crane shot
    // flag waves
    if (hv.flag && (active === H.id || Math.floor(t * 30) % 4 === H.id % 4)) { const p = hv.flag.geometry.attributes.position, b = hv.flagBase; for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 9 - t * 5 + H.id) * .05 * x / .5); } p.needsUpdate = true; hv.flag.rotation.y = Math.sin(t * .5 + H.id) * .3 - .4; }
    if (hv.glow) hv.glow.material.opacity = .22 + .12 * Math.sin(t * 2.5 + H.id) + (hv.glowBoost || 0); if (hv.glowBoost) hv.glowBoost = Math.max(0, hv.glowBoost - dt * .8);
    if (hv.candles) hv.candles.forEach((c, i) => c.scale.setScalar(.2 + .04 * Math.sin(t * 13 + i * 2)));
    if (hv.torches) { hv.torches.forEach((o, i) => { const k = 1 + .12 * Math.sin(t * 17 + o.ph) * Math.sin(t * 7 + o.ph); o.f.scale.set(o.sz * .7 * (2 - k), o.sz * k, 1); }); if (C.mzTorch) C.mzTorch.intensity = 9 * (.9 + .07 * Math.sin(t * 11) + .05 * Math.sin(t * 23)); }
  }
}
