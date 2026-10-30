// Catan 3D world: the island, the sea, the sky, every piece on the board and the table effects.
// The kit re-renders the HTML HUD on every update; this world lives on its own <canvas> behind it and is only told what
// changed (sync), what to animate (fx*) and what may be tapped (arm). Pure presentation — the engine owns the rules.
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { Sky } from "three/addons/Sky.js";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";
import { DIRS, key, unkey, ring, nbrs, sectorOf, TERRAIN, vXY, sideEnds } from "./engine.js";

const S3 = Math.sqrt(3);
export const hexXZ = k => { const [q, r] = typeof k === "string" ? unkey(k) : k; return [S3 * (q + r / 2), 1.5 * r]; };
// a hex centre, or a corner ("a~b~c") where three hexes meet
export const posXZ = k => (typeof k === "string" && k.includes("~") ? vXY(k) : hexXZ(k));
const TOP = 0.32;                       // land surface height at a tile's edge
const AMP = { pine: 0.12, quarry: 0.2, flax: 0.05, barley: 0.04, copper: 0.3, ruins: 0.06 };
const VER = "?v=1";

// ---------------------------------------------------------------- noise (value noise, deterministic per tile)
function hash(x, y, s) { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 3) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 7) * 0.1;
// distance from the centre to the hex edge in direction (lx,lz), as a 0..1 fraction (pointy-top hex of radius 1)
function hexFrac(lx, lz) {
  let m = 0;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, nx = Math.cos(a), nz = Math.sin(a); m = Math.max(m, (lx * nx + lz * nz) / (S3 / 2)); }
  return m;
}
// surface height of a tile at local offset (lx,lz); the centre is flattened for the token, and the rim (where outposts and
// trails stand on corners and sides) always sits at TOP
function tileHeight(t, lx, lz) {
  const f = Math.min(1, hexFrac(lx, lz)), fall = Math.pow(Math.max(0, 1 - f), 0.8);
  let h = (fbm(lx * 1.6 + t.q * 3.1, lz * 1.6 + t.r * 2.3, t.q * 13 + t.r) - 0.35) * (AMP[t.terrain] || 0.05) * 2 * fall;
  if (t.terrain === "copper" || t.terrain === "quarry") h += 0.12 * Math.max(0, 1 - Math.hypot(lx * 1.3, lz * 1.3)) * fall;
  let flat = Math.max(0, 1 - Math.hypot(lx, lz) / 0.28);
  const plateau = (fbm(t.q + 0.5, t.r + 0.5, 9) - 0.5) * 0.06 + 0.04;
  return TOP + plateau * fall + h * (1 - Math.min(1, flat * 1.4));
}

// ---------------------------------------------------------------- textures
const loader = new THREE.TextureLoader();
const texCache = {};
function tex(name, rep = 1) {
  const k = name + rep;
  if (texCache[k]) return texCache[k];
  const t = loader.load(`art/${name}.webp${VER}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[k] = t);
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const tokenTex = {};
function markTex(m, spent) {
  const k = m + (spent ? "s" : "");
  if (tokenTex[k]) return tokenTex[k];
  return (tokenTex[k] = canvasTex(256, 256, (g, w) => {
    const hot = m >= 6 && m <= 8;
    const grd = g.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2);
    grd.addColorStop(0, spent ? "#9c958a" : "#f6ecd2"); grd.addColorStop(1, spent ? "#6d675e" : "#d8c49a");
    g.fillStyle = grd; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 4, 0, 7); g.fill();
    g.lineWidth = 8; g.strokeStyle = spent ? "#4b463f" : "#7a5a2b"; g.stroke();
    g.fillStyle = spent ? "#3a3631" : hot ? "#a3241b" : "#2b2117"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `800 ${hot ? 132 : 120}px Georgia, serif`; g.fillText(String(m), w / 2, w / 2 - 16);
    const p = 6 - Math.abs(7 - m);
    for (let i = 0; i < p; i++) { g.beginPath(); g.arc(w / 2 + (i - (p - 1) / 2) * 20, w / 2 + 62, 7, 0, 7); g.fill(); }
  }));
}
const softTex = canvasTex(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.4, "rgba(255,255,255,.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
const cloudTex = canvasTex(256, 256, (g, w) => {
  for (let i = 0; i < 26; i++) {
    const x = w / 2 + (Math.random() - 0.5) * w * 0.55, y = w / 2 + (Math.random() - 0.5) * w * 0.3, r = 30 + Math.random() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, "rgba(255,255,255,.5)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  }
});

// ---------------------------------------------------------------- geometry builders
function hexTopGeometry(t, rings) {
  const pos = [], uv = [], idx = [], grid = new Map();
  const id = (a, b) => `${a},${b}`;
  // triangular lattice inside the hex
  const n = rings, step = 1 / n;
  let vi = 0;
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const c = -a - b; if (Math.abs(c) > n) continue;
    const fx = (a + b * 0.5) * step, fz = b * step * (S3 / 2);   // flat-top lattice, corner at (1,0)
    const ang = Math.PI / 6, X2 = fx * Math.cos(ang) - fz * Math.sin(ang), Z2 = fx * Math.sin(ang) + fz * Math.cos(ang);
    const h = tileHeight(t, X2, Z2);
    pos.push(X2, h, Z2); uv.push(X2 * 0.5 + 0.5, Z2 * 0.5 + 0.5);
    grid.set(id(a, b), vi++);
  }
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const p = grid.get(id(a, b)), q = grid.get(id(a + 1, b)), r = grid.get(id(a, b + 1)), s = grid.get(id(a + 1, b - 1));
    if (p != null && q != null && r != null) idx.push(p, r, q);
    if (p != null && q != null && s != null) idx.push(p, q, s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function hexSkirt(top, bottom) {
  const g = new THREE.CylinderGeometry(1, 1.08, top - bottom, 6, 1, true);
  g.rotateY(Math.PI / 6 + Math.PI / 2); g.translate(0, (top + bottom) / 2, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 1.1);
  return g;
}
function pineGeo() {
  const trunk = new THREE.CylinderGeometry(0.012, 0.018, 0.08, 5); trunk.translate(0, 0.04, 0);
  const parts = [trunk];
  for (let i = 0; i < 3; i++) { const c = new THREE.ConeGeometry(0.075 - i * 0.018, 0.12, 7); c.translate(0, 0.1 + i * 0.06, 0); parts.push(c); }
  parts.forEach((p, i) => { const col = new Float32Array(p.attributes.position.count * 3); const cc = i ? new THREE.Color(0x2f5a33).offsetHSL(0, 0, i * 0.03) : new THREE.Color(0x5a3d26); for (let k = 0; k < col.length; k += 3) { col[k] = cc.r; col[k + 1] = cc.g; col[k + 2] = cc.b; } p.setAttribute("color", new THREE.BufferAttribute(col, 3)); });
  return mergeGeometries(parts.map(p => p.toNonIndexed()));
}
function bladeGeo() {
  const g = new THREE.PlaneGeometry(0.012, 0.09, 1, 2); g.translate(0, 0.045, 0);
  const p = g.attributes.position; p.setX(4, 0); p.setX(5, 0);   // pointed tip
  return g;
}
function rockGeo(seed) {
  const g = new THREE.DodecahedronGeometry(0.06, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + hash(i, seed, 3) * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  g.computeVertexNormals(); return g;
}
const windChunk = (strength) => (sh) => {
  sh.uniforms.uTime = WORLD_TIME; sh.uniforms.uWind = { value: strength };
  sh.vertexShader = "uniform float uTime; uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    { vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); float sway = sin(uTime*1.7 + wp.x*2.3 + wp.z*1.7) * 0.5 + sin(uTime*3.1 + wp.x*5.) * 0.25;
      transformed.x += sway * uWind * position.y * position.y * 30.; transformed.z += sway * uWind * 0.6 * position.y * position.y * 30.; }`);
};
const WORLD_TIME = { value: 0 };
const TOKEN_FACE = new THREE.CircleGeometry(0.235, 32).rotateX(-Math.PI / 2);
const SEASON_TINT = [new THREE.Color(1.0, 1.04, 0.95), new THREE.Color(1.06, 1.02, 0.86), new THREE.Color(1.12, 0.92, 0.7), new THREE.Color(0.92, 0.96, 1.05)];
const U = { snow: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, time: WORLD_TIME };
function seasonal(mat, { snowy = true } = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSnow = U.snow; sh.uniforms.uTint = U.tint; sh.uniforms.uSpent = mat.userData.spent || (mat.userData.spent = { value: 0 });
    sh.vertexShader = "varying vec3 vWN;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = "uniform float uSnow; uniform vec3 uTint; uniform float uSpent; varying vec3 vWN;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      diffuseColor.rgb *= uTint;
      float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum)*vec3(.85,.8,.75), uSpent*.75);
      ${snowy ? "float sn = smoothstep(.55,.9, vWN.y) * uSnow; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93,.96,1.), sn*.85);" : ""}`);
  };
  return mat;
}

// ---------------------------------------------------------------- the world
export function createWorld(canvas, opts = {}) {
  const phone = matchMedia("(pointer:coarse)").matches || innerWidth < 700;
  let quality = opts.quality || (phone ? "low" : "high");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === "high" ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9fb8c8, 0.012);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.position.set(0, 13, 13);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 5, maxDistance: 30, minPolarAngle: 0.25, maxPolarAngle: 1.2, enablePan: true, panSpeed: 0.6, rotateSpeed: 0.6 });
  controls.target.set(0, 0, 0.6);
  let idle = true, lastTouch = 0;
  controls.addEventListener("start", () => { idle = false; lastTouch = performance.now(); camTween = null; });

  // sky + light
  const sky = new Sky(); sky.scale.setScalar(300); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.85;
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3b26, 0.7); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9db4ff, 0); moon.position.set(-10, 14, -6); scene.add(moon);
  const stars = (() => {
    const g = new THREE.BufferGeometry(), p = [];
    for (let i = 0; i < 900; i++) { const u = Math.random(), v = Math.random() * 0.45 + 0.05, th = u * Math.PI * 2, ph = Math.acos(1 - v); p.push(Math.sin(ph) * Math.cos(th) * 150, Math.cos(ph) * 150, Math.sin(ph) * Math.sin(th) * 150); }
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const s = new THREE.Points(g, m); scene.add(s); return s;
  })();

  // ------------------------------------------------ sea
  const SEA_SIZE = 70, segs = quality === "high" ? 220 : 120;
  const shore = document.createElement("canvas"); shore.width = shore.height = 256;
  const shoreTex = new THREE.CanvasTexture(shore);
  const waterU = {
    uTime: WORLD_TIME, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color(0x9fc6e0) },
    uDeep: { value: new THREE.Color(0x07465f) }, uShallow: { value: new THREE.Color(0x27b4ad) }, uShore: { value: shoreTex }, uSize: { value: SEA_SIZE },
    uNight: { value: 0 }, uStorm: { value: 0 }, fogColor: { value: scene.fog.color }, fogDensity: { value: scene.fog.density },
  };
  const WAVES = `
    vec3 gerst(vec2 p, vec2 d, float st, float wl, float t, inout vec3 tan, inout vec3 bin){
      float k = 6.2831/wl, c = sqrt(9.8/k), f = k*(dot(d,p) - c*t*.35), a = st/k;
      tan += vec3(-d.x*d.x*st*sin(f), d.x*st*cos(f), -d.x*d.y*st*sin(f));
      bin += vec3(-d.x*d.y*st*sin(f), d.y*st*cos(f), -d.y*d.y*st*sin(f));
      return vec3(d.x*a*cos(f), a*sin(f), d.y*a*cos(f));
    }
    vec3 waves(vec2 p, float t, float storm, out vec3 n){
      vec3 tan = vec3(1.,0.,0.), bin = vec3(0.,0.,1.), o = vec3(0.);
      float s = 1. + storm*1.6;
      o += gerst(p, normalize(vec2(1.,.6)), .07*s, 3.1, t, tan, bin);
      o += gerst(p, normalize(vec2(-.4,1.)), .05*s, 1.9, t, tan, bin);
      o += gerst(p, normalize(vec2(.7,-.3)), .04*s, 1.1, t, tan, bin);
      o += gerst(p, normalize(vec2(-.8,-.5)), .03*s, .7, t, tan, bin);
      n = normalize(cross(bin, tan));
      return o;
    }`;
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterU, transparent: true, fog: true,
    vertexShader: `uniform float uTime; uniform float uStorm; uniform sampler2D uShore; uniform float uSize; varying vec3 vW; varying vec3 vN; varying float vShore; ${WAVES}
      void main(){ vec3 p = position; vec2 uv = (p.xz/uSize)+.5; float sh = texture2D(uShore, uv).r; vShore = sh;
        vec3 n; vec3 d = waves(p.xz, uTime, uStorm, n); float damp = 1. - sh*.75; p += d*damp; vN = normalize(mix(vec3(0.,1.,0.), n, damp));
        vec4 w = modelMatrix*vec4(p,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uTime; uniform float uNight; uniform float uStorm;
      uniform vec3 fogColor; uniform float fogDensity; varying vec3 vW; varying vec3 vN; varying float vShore;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec2 q = vW.xz*3. + vec2(uTime*.15, uTime*.11);
        vec3 N = normalize(vN + vec3(n2(q)-.5, 0., n2(q+17.)-.5)*.18);
        float fres = pow(1. - max(dot(N, V), 0.), 4.)*.85 + .04;
        vec3 base = mix(uDeep, uShallow, smoothstep(.05, .75, vShore));
        vec3 col = mix(base, uSky, fres);
        vec3 H = normalize(V + normalize(uSun));
        col += uSunCol * pow(max(dot(N, H), 0.), 260.) * 2.2 * (1.-uNight);
        float foam = smoothstep(.62, .95, vShore + (n2(vW.xz*6.+uTime*.6)-.5)*.35) * (.55 + .45*sin(uTime*1.3 + vShore*14.));
        foam += smoothstep(.12, .2, vW.y) * (.5 + uStorm*.5) * n2(vW.xz*9.);
        col = mix(col, vec3(.92,.96,.98), clamp(foam, 0., 1.)*.8);
        col *= mix(1., .28, uNight);
        float fogF = 1. - exp(-fogDensity*fogDensity*dot(vW-cameraPosition, vW-cameraPosition));
        col = mix(col, fogColor, clamp(fogF, 0., 1.));
        gl_FragColor = vec4(col, mix(.82, .95, 1.-vShore*.6));
        #include <colorspace_fragment>
      }`,
  });
  const waterGeo = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, segs, segs); waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat); water.renderOrder = 2; scene.add(water);
  const floorMat = new THREE.MeshStandardMaterial({ map: tex("tex-sand", 18), color: 0xa79a80, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(SEA_SIZE / 2, 64), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.55; floor.receiveShadow = true; scene.add(floor);
  // CPU copy of the same waves so ships ride the surface
  function wave(x, z, t) {
    let y = 0, nx = 0, nz = 0;
    const W = [[1, .6, .07, 3.1], [-.4, 1, .05, 1.9], [.7, -.3, .04, 1.1], [-.8, -.5, .03, .7]], s = 1 + waterU.uStorm.value * 1.6;
    for (const [dx0, dz0, st0, wl] of W) {
      const l = Math.hypot(dx0, dz0), dx = dx0 / l, dz = dz0 / l, st = st0 * s, k = 6.2831 / wl, c = Math.sqrt(9.8 / k), f = k * (dx * x + dz * z - c * t * 0.35);
      y += (st / k) * Math.sin(f); nx += dx * st * Math.cos(f); nz += dz * st * Math.cos(f);
    }
    return { y, nx, nz };
  }

  // ------------------------------------------------ board groups
  const board = new THREE.Group(); scene.add(board);
  const tilesG = new THREE.Group(), decoG = new THREE.Group(), piecesG = new THREE.Group(), seaG = new THREE.Group(), fxG = new THREE.Group(), hiG = new THREE.Group();
  board.add(tilesG, decoG, piecesG, seaG, fxG, hiG);
  const cliffMat = seasonal(new THREE.MeshStandardMaterial({ map: tex("tex-cliff", 1), roughness: 0.95 }), { snowy: false });
  const tileMats = {}, tileObjs = {};
  const terrTex = { pine: "tex-pine", quarry: "tex-quarry", flax: "tex-flax", barley: "tex-barley", copper: "tex-copper", ruins: "tex-ruins" };
  function makeTile(k, t) {
    const [x, z] = hexXZ(k), g = new THREE.Group(); g.position.set(x, 0, z);
    const mat = seasonal(new THREE.MeshStandardMaterial({ map: tex(terrTex[t.terrain], 1.4), roughness: 0.92 }));
    const top = new THREE.Mesh(hexTopGeometry(t, quality === "high" ? 10 : 7), mat); top.receiveShadow = true; top.castShadow = true;
    const skirt = new THREE.Mesh(hexSkirt(TOP + 0.02, -0.7), cliffMat); skirt.receiveShadow = true;
    // a beach lip so the coast reads as land meeting water
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.1, 0.06, 6, 1), new THREE.MeshStandardMaterial({ map: tex("tex-sand", 2), roughness: 1 }));
    lip.rotation.y = Math.PI / 6 + Math.PI / 2; lip.position.y = 0.02;
    g.add(top, skirt, lip); g.userData = { k, top, mat };
    if (t.mark) {
      // a wooden disc with the number painted on a flat decal on top (cylinder caps mirror canvas text)
      const y = tileHeight(t, 0, 0) + 0.03, tok = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0x7a5a2b, roughness: 0.6 })); disc.castShadow = true;
      const face = new THREE.Mesh(TOKEN_FACE, new THREE.MeshStandardMaterial({ map: markTex(t.mark), roughness: 0.55 })); face.position.y = 0.021;
      tok.add(disc, face); tok.position.y = y; g.add(tok); g.userData.tok = face;
    }
    tilesG.add(g); tileObjs[k] = g; tileMats[k] = mat;
    return g;
  }
  const isLandK = k => !!view?.tiles[k]?.land;
  function heightAt(x, z) {
    const k = pixelToHex(x, z), t = view?.tiles[k];
    if (!t?.land) return 0.05;
    const [cx, cz] = hexXZ(k); return tileHeight(t, x - cx, z - cz);
  }
  function pixelToHex(x, z) {
    const q = (S3 / 3 * x - 1 / 3 * z), r = (2 / 3 * z);
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    return key(rx, rz);
  }

  // decoration (instanced, per terrain), rebuilt when the land changes (isles appear)
  const decoMats = {
    pine: seasonal(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })),
    blade: new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.85, side: THREE.DoubleSide }),
    flax: new THREE.MeshStandardMaterial({ color: 0x5f8f45, roughness: 0.9, side: THREE.DoubleSide }),
    bloom: new THREE.MeshStandardMaterial({ color: 0x6f9fff, roughness: 0.6, emissive: 0x1a2c66, emissiveIntensity: 0.25 }),
    rock: seasonal(new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.95, flatShading: true })),
    ore: seasonal(new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.7, metalness: 0.35, flatShading: true })),
    column: seasonal(new THREE.MeshStandardMaterial({ color: 0xd8d0bf, roughness: 0.9 })),
  };
  decoMats.blade.onBeforeCompile = windChunk(0.012); decoMats.flax.onBeforeCompile = windChunk(0.01); decoMats.pine.onBeforeCompile = (() => { const s = decoMats.pine.onBeforeCompile; return sh => { s(sh); windChunk(0.0035)(sh); }; })();
  const GEO = { pine: pineGeo(), blade: bladeGeo(), bloom: new THREE.SphereGeometry(0.008, 5, 4), rock: rockGeo(1), ore: rockGeo(2), column: new THREE.CylinderGeometry(0.03, 0.035, 0.18, 8) };
  function scatter(t, n, avoid = 0.2, seed = 1) {
    const pts = [];
    for (let i = 0; pts.length < n && i < n * 6; i++) {
      const a = hash(i, seed, t.q * 7 + t.r) * Math.PI * 2, d = Math.sqrt(hash(i, seed + 1, t.q + t.r * 5)) * 0.92;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (hexFrac(x, z) > 1 - avoid * 0.6 || Math.hypot(x, z) < 0.26) continue;   // keep the rim clear for trails and outposts
      pts.push([x, z]);
    }
    return pts;
  }
  function rebuildDeco() {
    decoG.clear();
    const lists = { pine: [], blade: [], flax: [], bloom: [], rock: [], ore: [], column: [] };
    const dens = quality === "high" ? 1 : 0.5;
    for (const k in view.tiles) {
      const t = view.tiles[k]; if (!t.land) continue;
      const [cx, cz] = hexXZ(k), put = (kind, x, z, s = 1, ry = 0, tilt = 0) => lists[kind].push({ x: cx + x, z: cz + z, y: tileHeight(t, x, z), s, ry, tilt });
      if (t.terrain === "pine") scatter(t, Math.round(26 * dens + 8), 0.2, 1).forEach(([x, z], i) => put("pine", x, z, 0.8 + hash(i, 2, t.q) * 0.7, hash(i, 3, 1) * 6));
      if (t.terrain === "barley") scatter(t, Math.round(520 * dens), 0.17, 2).forEach(([x, z], i) => put("blade", x, z, 0.8 + hash(i, 4, 2) * 0.5, hash(i, 5, 2) * 6, (hash(i, 6, 2) - 0.5) * 0.4));
      if (t.terrain === "flax") scatter(t, Math.round(380 * dens), 0.17, 3).forEach(([x, z], i) => { put("flax", x, z, 0.9 + hash(i, 4, 3) * 0.4, hash(i, 5, 3) * 6); if (i % 2 === 0) lists.bloom.push({ x: cx + x, z: cz + z, y: tileHeight(t, x, z) + 0.085, s: 1, ry: 0, tilt: 0 }); });
      if (t.terrain === "quarry") scatter(t, 16, 0.22, 4).forEach(([x, z], i) => put("rock", x, z, 0.7 + hash(i, 4, 4) * 1.3, hash(i, 5, 4) * 6, hash(i, 6, 4)));
      if (t.terrain === "copper") scatter(t, 14, 0.22, 5).forEach(([x, z], i) => put(i % 3 ? "rock" : "ore", x, z, 0.6 + hash(i, 4, 5) * 1.1, hash(i, 5, 5) * 6, hash(i, 6, 5)));
      if (t.terrain === "ruins") scatter(t, 9, 0.24, 6).forEach(([x, z], i) => put("column", x, z, 0.6 + hash(i, 4, 6) * 1.2, 0, (hash(i, 6, 6) - 0.5) * 0.5));
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [kind, arr] of Object.entries(lists)) {
      if (!arr.length) continue;
      const im = new THREE.InstancedMesh(GEO[kind], decoMats[kind], arr.length);
      arr.forEach((p, i) => { e.set(p.tilt, p.ry, p.tilt * 0.5); q.setFromEuler(e); v.set(p.x, p.y, p.z); sc.setScalar(p.s); m4.compose(v, q, sc); im.setMatrixAt(i, m4); });
      im.castShadow = kind !== "blade" && kind !== "flax" && kind !== "bloom"; im.receiveShadow = true;
      decoG.add(im);
    }
  }
  function paintShore() {
    const g = shore.getContext("2d"), W = shore.width, sc = W / SEA_SIZE;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, W);
    g.filter = "blur(7px)"; g.fillStyle = "#fff";
    for (const k in view.tiles) if (view.tiles[k].land) {
      const [x, z] = hexXZ(k); g.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo((x + Math.cos(a) * 1.15 + SEA_SIZE / 2) * sc, (z + Math.sin(a) * 1.15 + SEA_SIZE / 2) * sc); }
      g.fill();
    }
    g.filter = "none"; shoreTex.needsUpdate = true;
  }

  // ------------------------------------------------ sea features (fog, shoals, reefs, wrecks, currents)
  const fogObjs = {}, seaObjs = {};
  const fogMat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xeef2f5, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  function makeFog(k) {
    const [x, z] = hexXZ(k), g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(fogMat.clone()); s.position.set(x + (hash(i, x, 1) - 0.5) * 0.9, 0.35 + i * 0.18, z + (hash(i, z, 2) - 0.5) * 0.9); s.scale.set(2.4, 1.3, 1); s.userData.ph = hash(i, x + z, 3) * 6; g.add(s); }
    seaG.add(g); fogObjs[k] = g;
  }
  function makeSeaFeature(k, t) {
    const [x, z] = hexXZ(k), g = new THREE.Group(); g.position.set(x, 0, z);
    if (t.sea === "reef") for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(GEO.rock, decoMats.rock); r.position.set((hash(i, k.length, 1) - 0.5) * 1.2, -0.05, (hash(i, x, 2) - 0.5) * 1.2); r.scale.setScalar(1.5 + hash(i, z, 3) * 2.5); r.castShadow = true; g.add(r); }
    if (t.sea === "shoal") {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0x9be6dd, transparent: true, opacity: 0.25, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
      const tok = new THREE.Group(), disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), new THREE.MeshStandardMaterial({ color: 0x2b6f7a }));
      const face = new THREE.Mesh(TOKEN_FACE, new THREE.MeshStandardMaterial({ map: markTex(t.mark) })); face.scale.setScalar(0.8); face.position.y = 0.016;
      tok.add(disc, face); tok.position.y = 0.16; g.add(tok); g.userData.float = tok;
    }
    if (t.sea === "wreck") {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 })); hull.rotation.set(0.4, 0.6, 0.3); hull.position.y = 0.02;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.5), hull.material); mast.position.set(0.05, 0.15, 0); mast.rotation.z = 0.7; g.add(hull, mast);
    }
    if (t.sea === "current") {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 3), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.45, depthWrite: false }));
      a.rotation.x = Math.PI / 2; const [dx, dz] = hexXZ(DIRS[t.dir]); a.rotation.z = -Math.atan2(dx, dz) + Math.PI; a.position.y = 0.12; a.rotation.order = "XZY";
      const holder = new THREE.Group(); holder.add(a); holder.rotation.y = Math.atan2(dx, dz); a.rotation.set(Math.PI / 2, 0, 0); holder.userData.drift = true; g.add(holder);
    }
    seaG.add(g); seaObjs[k] = g;
  }

  // ------------------------------------------------ pieces
  const COLORS = opts.colors || ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6"];
  const colOf = pid => new THREE.Color(COLORS[Math.max(0, view.players.findIndex(p => p.id === pid))]);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc2, roughness: 0.9 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5b3b22, roughness: 0.85 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: tex("tex-quarry", 0.5), color: 0xb9b3aa, roughness: 0.95 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2b2116, emissive: 0xffb347, emissiveIntensity: 0 });
  const roofMats = {};
  const roofMat = pid => (roofMats[pid] ||= new THREE.MeshStandardMaterial({ color: colOf(pid).multiplyScalar(0.85), roughness: 0.75 }));
  function prism(w, h, d) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; }
  const charMat = new THREE.MeshStandardMaterial({ color: 0x1c1714, roughness: 1 });
  function house(pid, hall, burned = false) {
    const g = new THREE.Group(), w = hall ? 0.2 : 0.15, d = hall ? 0.34 : 0.17, h = hall ? 0.12 : 0.09;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), burned ? charMat : wallMat); body.position.y = h / 2;
    const roof = new THREE.Mesh(prism(w * 1.25, hall ? 0.13 : 0.1, d * 1.1), burned ? charMat : roofMat(pid)); roof.position.y = h; if (burned) { roof.scale.set(0.9, 0.5, 0.7); roof.rotation.z = 0.25; }
    g.userData.smoke = burned;
    const beams = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.015, d * 1.02), timberMat); beams.position.y = h * 0.98;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.005), timberMat); door.position.set(0, 0.03, d / 2 + 0.002);
    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.025, 0.03), winMat); win1.position.set(w / 2 + 0.002, h * 0.6, 0);
    const win2 = win1.clone(); win2.position.x = -w / 2 - 0.002;
    g.add(body, roof, beams, door, win1, win2);
    if (!burned) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), stoneMat); ch.position.set(w * 0.25, h + 0.06, -d * 0.2); g.add(ch); g.userData.chimney = ch; }
    else { const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshStandardMaterial({ color: colOf(pid), side: THREE.DoubleSide })); flag.position.set(0, h + 0.09, 0); g.add(flag); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  const hullGeo = (() => {
    const s = new THREE.Shape(); s.moveTo(-0.2, 0.05); s.quadraticCurveTo(-0.18, -0.04, 0, -0.05); s.quadraticCurveTo(0.18, -0.04, 0.24, 0.07); s.lineTo(-0.2, 0.05);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.01, bevelSegments: 2 }); g.translate(0, 0, -0.05); return g;
  })();
  function ship(pid, raider = false) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const hull = new THREE.Mesh(hullGeo, raider ? new THREE.MeshStandardMaterial({ color: 0x1d1612, roughness: 0.8 }) : timberMat);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.42), timberMat); mast.position.set(0.01, 0.22, 0);
    const sailG = new THREE.PlaneGeometry(0.28, 0.26, 6, 6); const sp = sailG.attributes.position; for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, 0.04 * (1 - (x / 0.14) ** 2) * (1 - (y / 0.13) ** 2)); } sailG.computeVertexNormals();
    const sail = new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ color: raider ? 0x9b1d14 : 0xf1e6cf, roughness: 0.9, side: THREE.DoubleSide })); sail.position.set(0.01, 0.24, 0); sail.rotation.y = Math.PI / 2; sail.castShadow = true;
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.025), new THREE.MeshStandardMaterial({ color: raider ? 0x111111 : colOf(pid), side: THREE.DoubleSide })); pennant.position.set(0.04, 0.44, 0);
    body.add(hull, mast, sail, pennant); body.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { body, sail, pennant };
    return g;
  }
  // a trail runs along the side two hexes share, from corner to corner, leaving room for an outpost at each end
  function trailMesh(a, b, pid) {
    const [e1, e2] = sideEnds(a, b), [ax, az] = vXY(e1), [bx, bz] = vXY(e2), g = new THREE.Group();
    const y = (isLandK(a) || isLandK(b) ? TOP : 0.05) + 0.015;
    const n = 7, pts = [];
    for (let i = 0; i <= n; i++) { const f = 0.2 + (i / n) * 0.6, x = ax + (bx - ax) * f, z = az + (bz - az) * f; pts.push(new THREE.Vector3(x, y, z)); }
    const dir = new THREE.Vector3(bx - ax, 0, bz - az).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (let i = 0; i < n; i++) {
      const p = pts[i].clone().lerp(pts[i + 1], 0.5);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.075), timberMat);
      plank.position.copy(p); plank.lookAt(p.clone().add(dir)); plank.rotateY(Math.PI / 2 * 0); plank.castShadow = true; plank.receiveShadow = true; g.add(plank);
      if (i % 2 === 0) for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06), roofMat(pid)); post.position.copy(p).addScaledVector(side, s * 0.07); post.position.y += 0.03; post.castShadow = true; g.add(post); }
    }
    return g;
  }

  // ------------------------------------------------ particles (smoke, dust, sparks, rain, snow, leaves)
  const parts = [];
  const smokeMat = new THREE.SpriteMaterial({ map: softTex, color: 0xcfcac2, transparent: true, depthWrite: false, opacity: 0.5 });
  function puff(pos, { n = 8, col = 0xd8cdb8, size = 0.25, life = 1.4, up = 0.3, spread = 0.3, add = false } = {}) {
    for (let i = 0; i < n; i++) {
      const m = smokeMat.clone(); m.color.set(col); if (add) m.blending = THREE.AdditiveBlending;
      const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(size * 0.4); fxG.add(s);
      parts.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * spread, up * (0.5 + Math.random()), (Math.random() - 0.5) * spread), age: 0, life: life * (0.7 + Math.random() * 0.6), size });
    }
  }
  const weather = (() => {
    const N = quality === "high" ? 4000 : 1600, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - 0.5) * 30; p[i * 3 + 1] = Math.random() * 12; p[i * 3 + 2] = (Math.random() - 0.5) * 30; }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0, depthWrite: false, map: softTex });
    const pts = new THREE.Points(g, m); scene.add(pts); return { pts, m, kind: null, until: 0 };
  })();
  const clouds = [];
  for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false })); s.position.set((Math.random() - 0.5) * 90, 24 + Math.random() * 6, (Math.random() - 0.5) * 90); s.scale.set(26, 10, 1); scene.add(s); clouds.push(s); }
  const lightning = new THREE.PointLight(0xcfe3ff, 0, 80); lightning.position.set(5, 12, -6); scene.add(lightning);

  // ------------------------------------------------ highlight / picking
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const hiRing = new THREE.RingGeometry(0.82, 0.95, 6, 1); hiRing.rotateX(-Math.PI / 2); hiRing.rotateY(Math.PI / 6);
  const cornerRing = new THREE.RingGeometry(0.2, 0.28, 24, 1); cornerRing.rotateX(-Math.PI / 2);
  const hiDisc = new THREE.CircleGeometry(0.95, 6); hiDisc.rotateX(-Math.PI / 2); hiDisc.rotateY(Math.PI / 6);
  let armed = null;   // { kind: "tile"|"corner"|"link"|"sea", targets: [...], onPick }
  function arm(spec) {
    hiG.clear(); armed = spec || null;
    if (!spec) return;
    for (const t of spec.targets) {
      if (spec.kind === "link") {   // a glowing bar along the side
        const [e1, e2] = sideEnds(t.a, t.b), [ax, az] = vXY(e1), [bx, bz] = vXY(e2), x = (ax + bx) / 2, z = (az + bz) / 2;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.16), hiMat.clone()); bar.position.set(x, TOP + 0.07, z); bar.rotation.y = -Math.atan2(bz - az, bx - ax);
        bar.userData.target = t; bar.userData.pulse = true; hiG.add(bar);
      } else if (spec.kind === "corner") {   // a glowing bead on the corner
        const [x, z] = vXY(t.v), bead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10), hiMat.clone()); bead.position.set(x, TOP + 0.14, z);
        bead.userData.target = t; bead.userData.pulse = true; hiG.add(bead);
      } else {
        const [x, z] = hexXZ(t.k), land = view.tiles[t.k]?.land;
        const m = new THREE.Mesh(spec.kind === "sea" ? hiDisc : hiRing, hiMat.clone()); m.position.set(x, land ? heightAt(x, z) + 0.06 : 0.15, z);
        if (spec.kind === "sea") m.material.opacity = 0.22;
        m.userData.target = t; m.userData.pulse = true; hiG.add(m);
      }
    }
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; idle = false; lastTouch = performance.now(); });
  canvas.addEventListener("pointerup", e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 600) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (armed) {
      const hits = ray.intersectObjects(hiG.children, false);
      if (hits[0]) { armed.onPick(hits[0].object.userData.target); return; }
      if (armed.kind === "corner") {   // a near miss still picks the closest corner
        const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), p);
        let best = null, bd = 0.4;
        for (const t of armed.targets) { const [x, z] = vXY(t.v), d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = t; } }
        if (best) { armed.onPick(best); return; }
      } else if (armed.kind !== "link") {
        const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(armed.kind === "sea" ? 0.05 : TOP)), p);
        const k = pixelToHex(p.x, p.z), t = armed.targets.find(x => x.k === k);
        if (t) { armed.onPick(t); return; }
      }
    }
    // a ship tapped?
    const sh = ray.intersectObjects(Object.values(shipObjs), true)[0];
    if (sh) { let o = sh.object; while (o && !o.userData.shipId) o = o.parent; if (o) opts.onShip?.(o.userData.shipId); return; }
    const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), p);
    opts.onTile?.(pixelToHex(p.x, p.z));
  });

  // ------------------------------------------------ sync with the game view
  let view = null;
  const buildObjs = {}, trailObjs = {}, shipObjs = {};
  let season = -1, landSig = "";
  function sync(v, { instant = false } = {}) {
    const prevV = view; view = v;
    // land (the island + revealed isles)
    const sig = Object.keys(v.tiles).filter(k => v.tiles[k].land).sort().join(";") + "|" + Object.values(v.tiles).map(t => t.mark || 0).join("");
    if (sig !== landSig) {
      const fresh = Object.keys(v.tiles).filter(k => v.tiles[k].land && !tileObjs[k]);
      for (const k of Object.keys(tileObjs)) if (!v.tiles[k]?.land || v.tiles[k].mark !== prevV?.tiles[k]?.mark) { tilesG.remove(tileObjs[k]); delete tileObjs[k]; }
      for (const k in v.tiles) if (v.tiles[k].land && !tileObjs[k]) { const g = makeTile(k, v.tiles[k]); if (!instant && prevV && fresh.includes(k)) rise(g); }
      landSig = sig; rebuildDeco(); paintShore();
    }
    for (const k in tileObjs) { const sp = v.tiles[k].rich <= 0 ? 1 : 0, u = tileMats[k].userData.spent; if (u) u.value += (sp - u.value) * (instant ? 1 : 0.5); else tileMats[k].userData.spent = { value: sp }; const tok = tileObjs[k].userData.tok; if (tok) tok.material.map = markTex(v.tiles[k].mark, sp); }
    // sea
    for (const k in v.tiles) {
      const t = v.tiles[k]; if (t.land) { if (fogObjs[k]) { seaG.remove(fogObjs[k]); delete fogObjs[k]; } continue; }
      if (t.fog && !fogObjs[k]) makeFog(k);
      if (!t.fog && fogObjs[k]) { const g = fogObjs[k]; delete fogObjs[k]; if (instant) seaG.remove(g); else lift(g); }
      const want = !t.fog && t.sea !== "open" ? t.sea : null;
      if (seaObjs[k] && seaObjs[k].userData.kind !== want) { seaG.remove(seaObjs[k]); delete seaObjs[k]; }
      if (want && !seaObjs[k]) { makeSeaFeature(k, t); seaObjs[k].userData.kind = want; }
    }
    // outposts (charred and smoking while burned)
    const seen = new Set();
    for (const b of v.builds) {
      const id = `${b.pid}@${b.v}`; seen.add(id);
      const [cx, cz] = vXY(b.v);
      let o = buildObjs[id];
      if (o && !!o.userData.burned !== !!b.burned) { piecesG.remove(o); o = null; delete buildObjs[id]; }
      if (!o) {
        o = house(b.pid, false, b.burned); o.userData.burned = !!b.burned; o.userData.pid = b.pid;
        o.position.set(cx, TOP, cz); o.rotation.y = Math.atan2(cx, cz) + Math.PI; o.scale.setScalar(1.7); o.userData.s = 1.7;   // door faces the island's middle
        piecesG.add(o); buildObjs[id] = o; if (!instant && prevV && !b.burned) drop(o);
      }
    }
    for (const id of Object.keys(buildObjs)) if (!seen.has(id)) { piecesG.remove(buildObjs[id]); delete buildObjs[id]; }
    syncFleet(v, instant || !prevV);
    // trails
    for (const t of v.trails) if (!trailObjs[t.k]) { const m = trailMesh(t.a, t.b, t.pid); piecesG.add(m); trailObjs[t.k] = m; if (!instant && prevV) layTrail(m); }
    // ships
    for (const s of v.ships) {
      let o = shipObjs[s.id];
      const [x, z] = hexXZ(s.at);
      if (!o) { o = ship(s.pid); o.scale.setScalar(1.6); o.userData.s = 1.6; o.userData.shipId = s.id; o.position.set(x, 0, z); o.userData.to = new THREE.Vector3(x, 0, z); scene.add(o); shipObjs[s.id] = o; if (!instant && prevV) drop(o, 0.6); }
      else o.userData.to.set(x, 0, z);
    }
    for (const id of Object.keys(shipObjs)) if (!v.ships.some(s => String(s.id) === id)) { scene.remove(shipObjs[id]); delete shipObjs[id]; }
    // season look
    if (v.season !== season) { season = v.season; seasonTo(season, instant || !prevV); }
    waterU.uStorm.value = Math.max(waterU.uStorm.value, 0);
    // time of day: the round is a day, each seat's turn moves the sun on
    const n = v.players.length, f = v.phase === "setup" ? 0.15 + 0.6 * (v.setupStep / Math.max(1, v.setupLen)) : 0.08 + 0.84 * ((v.turn + (v.phase === "act" ? 0.5 : 0)) / n);
    if (prevV && prevV.round !== v.round && !instant) nightPass(); else dayTarget = f;
    if (!prevV || instant) day = dayTarget;
  }
  // ------------------------------------------------ animations
  const tweens = [];
  const ease = x => 1 - Math.pow(1 - x, 3), back = x => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
  function tween(ms, fn, done) { tweens.push({ t0: performance.now(), ms, fn, done }); }
  function drop(o, h = 1.2) { const y = o.position.y, S = o.userData.s || 1; o.position.y = y + h; o.scale.setScalar(0.6 * S); tween(650, f => { o.position.y = y + h * (1 - ease(f)); o.scale.setScalar(S * (0.6 + 0.4 * back(f))); }, () => { o.position.y = y; o.scale.setScalar(S); puff(o.position.clone().add(new THREE.Vector3(0, 0.02, 0)), { n: 7, size: 0.22, up: 0.08, spread: 0.5, life: 0.9 }); sfx("thunk"); }); }
  function rise(g) { g.position.y = -1.2; tween(1600, f => { g.position.y = -1.2 * (1 - ease(f)); }, () => { g.position.y = 0; puff(g.position.clone().setY(0.1), { n: 14, col: 0xffffff, size: 0.6, up: 0.15, spread: 1.4, life: 1.6 }); }); }
  function lift(g) { tween(1400, f => { g.children.forEach(s => { s.material.opacity = 0.85 * (1 - f); s.position.y += 0.01; s.scale.x *= 1.004; }); }, () => seaG.remove(g)); }
  function layTrail(g) { g.children.forEach((c, i) => { c.visible = false; setTimeout(() => { c.visible = true; c.scale.setScalar(0.01); tween(220, f => c.scale.setScalar(back(f)), () => c.scale.setScalar(1)); if (i === 0) sfx("tap"); }, i * 45); }); }
  let day = 0.3, dayTarget = 0.3, night = null;
  function nightPass() { night = { t0: performance.now(), from: day }; dayTarget = 0.08; }
  function seasonTo(s, instant) {
    const tint = SEASON_TINT[s], snow = s === 3 ? 1 : 0;
    if (instant) { U.tint.value.copy(tint); U.snow.value = snow; }
    else { const t0 = U.tint.value.clone(), s0 = U.snow.value; tween(2600, f => { U.tint.value.copy(t0).lerp(tint, f); U.snow.value = s0 + (snow - s0) * f; }); }
    weather.kind = s === 3 ? "snow" : s === 2 ? "leaves" : null; weather.until = Infinity;
    decoMats.blade.color.set(s === 0 ? 0x9fbf5a : s === 1 ? 0xe2bc5c : s === 2 ? 0xc9993e : 0xb8ad8c);
    decoMats.flax.color.set(s === 3 ? 0x8a8a74 : 0x5f8f45); decoMats.bloom.visible = s < 2;
  }
  function storm(ms = 6000) { weather.kind = "rain"; weather.until = performance.now() + ms; stormUntil = performance.now() + ms; sfx("thunder"); }
  let stormUntil = 0;

  // ------------------------------------------------ effects used by the HUD
  const tmpV = new THREE.Vector3();
  function screenOf(k, y = 0.5) { const [x, z] = posXZ(k); tmpV.set(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return { left: r.left + (tmpV.x + 1) / 2 * r.width - 1, top: r.top + (1 - tmpV.y) / 2 * r.height - 1, width: 2, height: 2 }; }
  function pulseTile(k, col = 0xffe08a) {
    const corner = k.includes("~"), [x, z] = posXZ(k), m = new THREE.Mesh(corner ? cornerRing : hiRing, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(x, corner ? TOP + 0.05 : heightAt(x, z) + 0.08, z); fxG.add(m);
    const glow = new THREE.PointLight(col, 3, 2.2); glow.position.set(x, 0.9, z); fxG.add(glow);
    tween(1300, f => { m.scale.setScalar(1 + f * 0.25); m.material.opacity = 0.9 * (1 - f); glow.intensity = 3 * (1 - f); }, () => { fxG.remove(m, glow); });
  }
  function focus(k, dist = 9, ms = 1200) { const [x, z] = posXZ(k); camTo(new THREE.Vector3(x, 0, z), dist, ms); }
  let camTween = null;
  function camTo(target, dist, ms = 1400) {
    const off = camera.position.clone().sub(controls.target).normalize().multiplyScalar(dist);
    camTween = { t0: performance.now(), ms, fromT: controls.target.clone(), toT: target.clone(), fromP: camera.position.clone(), toP: target.clone().add(off) };
  }
  function home(ms = 1400) {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, base = view && view.R > 2 ? 17 : 14.5;
    camTo(new THREE.Vector3(0, 0, 0.6), base * Math.max(1, (h / w) * 0.62), ms);
  }
  // raid: longships come in from the horizon on the sector's bearing, fire arrows, then withdraw or burn
  function raid(R) {
    return new Promise(res => {
      const ang = (R.sector * 60) * Math.PI / 180, dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const coast = dir.clone().multiplyScalar((view.R + 1.3) * 1.6), far = dir.clone().multiplyScalar(28);
      camTo(coast.clone().multiplyScalar(0.55), 9, 1600); weather.kind = "rain"; weather.until = performance.now() + 9000; stormUntil = performance.now() + 9000; sfx("horn");
      const fleet = [];
      for (let i = 0; i < Math.min(6, R.strength + 1); i++) { const s = ship(null, true); s.scale.setScalar(1.6); const off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((i - 1.5) * 0.9); s.position.copy(far).add(off); s.userData.raid = { off, i }; scene.add(s); fleet.push(s); }
      fleetObjs.forEach(o => scene.remove(o)); fleetObjs.length = 0;
      tween(4200, f => { for (const s of fleet) { s.position.lerpVectors(far, coast, ease(f)).add(s.userData.raid.off); s.lookAt(coast); s.rotateY(-Math.PI / 2); } }, () => {
        for (let i = 0; i < 24; i++) setTimeout(() => { const from = fleet[i % fleet.length].position.clone().add(new THREE.Vector3(0, 0.4, 0)); const to = coast.clone().multiplyScalar(0.7).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.3, (Math.random() - 0.5) * 2)); arrow(from, to); }, i * 90);
        setTimeout(() => {
          if (R.won) { for (const s of fleet) puff(s.position.clone().add(new THREE.Vector3(0, 0.3, 0)), { n: 6, col: 0xff7a2a, size: 0.5, up: 0.6, add: true, life: 1.2 }); sfx("cheer"); }
          else for (const L of R.burned) { const [x, z] = posXZ(L.v); puff(new THREE.Vector3(x, 0.5, z), { n: 26, col: 0x3a302a, size: 0.8, up: 0.5, spread: 0.5, life: 3 }); puff(new THREE.Vector3(x, 0.45, z), { n: 12, col: 0xff6a1a, size: 0.4, up: 0.4, add: true, life: 1.4 }); }
          tween(2600, f => { for (const s of fleet) { s.position.lerpVectors(coast, far, ease(f) * 0.7).add(s.userData.raid.off); if (R.won) s.position.y = -f * 0.8; } }, () => { fleet.forEach(s => scene.remove(s)); home(); res(); });
        }, 2400);
      });
    });
  }
  function arrow(from, to) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa040 })); fxG.add(m);
    const l = new THREE.PointLight(0xff8a3a, 1.2, 1); m.add(l);
    tween(700, f => { m.position.lerpVectors(from, to, f); m.position.y += Math.sin(f * Math.PI) * 0.9; }, () => { fxG.remove(m); puff(to, { n: 3, col: 0xff8a3a, size: 0.25, up: 0.3, add: true, life: 0.6 }); });
  }
  function lightningFlash() { lightning.intensity = 60; setTimeout(() => (lightning.intensity = 0), 90); setTimeout(() => (lightning.intensity = 40), 160); setTimeout(() => (lightning.intensity = 0), 230); }

  // ------------------------------------------------ sound (WebAudio, synthesised; off when the table's sound switch is off)
  let ac = null;
  function sfx(kind) {
    if (!opts.soundOn?.()) return;
    try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch { return; }
    const t = ac.currentTime, out = ac.createGain(); out.connect(ac.destination);
    const noise = (dur, f0, f1, vol) => { const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; const fl = ac.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(g).connect(out); s.start(t); };
    const osc = (type, f0, f1, dur, vol) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur); };
    if (kind === "thunk") { osc("sine", 160, 60, 0.25, 0.25); noise(0.12, 900, 300, 0.15); }
    if (kind === "tap") noise(0.06, 2400, 1200, 0.08);
    if (kind === "dice") noise(0.05, 3000, 2000, 0.12);
    if (kind === "coin") { osc("triangle", 1760, 1700, 0.18, 0.08); osc("triangle", 2350, 2300, 0.22, 0.05); }
    if (kind === "horn") { osc("sawtooth", 98, 92, 2.2, 0.12); osc("sawtooth", 147, 140, 2.2, 0.06); }
    if (kind === "thunder") noise(2.4, 220, 40, 0.5);
    if (kind === "cheer") { osc("triangle", 523, 523, 0.3, 0.1); setTimeout(() => sfx("coin"), 200); }
    if (kind === "season") { osc("sine", 392, 392, 0.8, 0.07); osc("sine", 587, 587, 1.2, 0.05); }
  }

  // ------------------------------------------------ frame loop
  const clock = new THREE.Clock(); let running = true, mode = "backdrop", fno = 0;
  const lite = new URLSearchParams(location.search).has("lite");   // test harness: many tables on one machine
  const sunDir = new THREE.Vector3();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (lite) return;   // test phones: no drawing unless asked (renderOnce)
    const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
    WORLD_TIME.value += dt;
    const T = WORLD_TIME.value;
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i], f = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(f); if (f >= 1) { tweens.splice(i, 1); tw.done?.(); } }
    // day / night
    if (night) { const f = (now - night.t0) / 3200; if (f >= 1) { night = null; day = 0.02; } else day = f < 0.5 ? night.from + (1.08 - night.from) * (f * 2) : -0.08 + (f - 0.5) * 2 * 0.1; }
    else day += (dayTarget - day) * Math.min(1, dt * 0.8);
    const dd = ((day % 1) + 1) % 1, elev = Math.sin(dd * Math.PI) * 62 - 4, az = 100 + dd * 160;
    const ph = THREE.MathUtils.degToRad(90 - elev), th = THREE.MathUtils.degToRad(az);
    sunDir.setFromSphericalCoords(1, ph, th); su.sunPosition.value.copy(sunDir);
    const dark = THREE.MathUtils.clamp((4 - elev) / 10, 0, 1), low = THREE.MathUtils.clamp(1 - elev / 25, 0, 1);
    sun.position.copy(sunDir).multiplyScalar(30); sun.intensity = 2.8 * (1 - dark); sun.color.setHSL(0.09, 0.6 + low * 0.3, 0.92 - low * 0.18);
    hemi.intensity = 0.25 + 0.55 * (1 - dark); moon.intensity = dark * 0.5; stars.material.opacity = dark;
    renderer.toneMappingExposure = 0.75 - dark * 0.35 + (stormUntil > now ? -0.15 : 0);
    winMat.emissiveIntensity = dark * 2.5 + low * 0.4;
    scene.fog.color.setHSL(0.57, 0.25 - low * 0.1, 0.62 - dark * 0.5); scene.fog.density = 0.012 + (stormUntil > now ? 0.012 : 0);
    waterU.uSun.value.copy(sunDir); waterU.uSunCol.value.copy(sun.color); waterU.uNight.value = dark;
    waterU.uSky.value.setHSL(0.55, 0.5, 0.62 - dark * 0.5 - low * 0.08);
    waterU.uStorm.value += ((stormUntil > now ? 1 : 0) - waterU.uStorm.value) * dt * 0.8;
    if (stormUntil > now && Math.random() < dt * 0.35) { lightningFlash(); if (Math.random() < 0.5) sfx("thunder"); }
    // weather particles
    const wk = weather.until > now ? weather.kind : season === 3 ? "snow" : season === 2 ? "leaves" : null;
    weather.m.opacity += ((wk ? (wk === "rain" ? 0.55 : 0.85) : 0) - weather.m.opacity) * dt * 2;
    if (weather.m.opacity > 0.01) {
      const p = weather.pts.geometry.attributes.position, sp = wk === "rain" ? 9 : wk === "snow" ? 0.6 : 0.8;
      weather.m.color.set(wk === "rain" ? 0xaabbd0 : wk === "leaves" ? 0xd07a2c : 0xffffff); weather.m.size = wk === "rain" ? 0.05 : wk === "leaves" ? 0.07 : 0.06;
      for (let i = 0; i < p.count; i++) { let y = p.getY(i) - sp * dt; let x = p.getX(i) + Math.sin(T + i) * dt * (wk === "rain" ? 1.5 : 0.3); if (y < 0) { y = 12; x = (Math.random() - 0.5) * 30; } p.setXY(i, x, y); }
      p.needsUpdate = true;
    }
    for (const c of clouds) { c.position.x += dt * 0.25; if (c.position.x > 35) c.position.x = -35; c.material.opacity = 0.5 * (1 - dark * 0.7) + (stormUntil > now ? 0.3 : 0); c.material.color.setScalar(stormUntil > now ? 0.55 : 1 - dark * 0.6); }
    // particles
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; const f = p.age / p.life; if (f >= 1) { fxG.remove(p.s); parts.splice(i, 1); continue; } p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 0.6); p.s.scale.setScalar(p.size * (0.4 + f * 1.4)); p.s.material.opacity = (p.s.material.blending === THREE.AdditiveBlending ? 0.9 : 0.55) * (1 - f); }
    // chimneys smoke
    for (const o of Object.values(buildObjs)) {
      if (o.userData.chimney && Math.random() < dt * 0.9 * (0.4 + dark)) { const w = o.userData.chimney.getWorldPosition(new THREE.Vector3()); w.y += 0.05; puff(w, { n: 1, col: 0xbdb6ad, size: 0.14, up: 0.2, spread: 0.06, life: 2.2 }); }
      if (o.userData.smoke && Math.random() < dt * 3) puff(o.position.clone().setY(o.position.y + 0.12), { n: 1, col: 0x2e2824, size: 0.22, up: 0.3, spread: 0.1, life: 2.6 });
    }
    if (beacon.obj) { const f = beacon.heat; beacon.light.intensity = f * (2.2 + Math.sin(T * 13) * 0.4 + Math.random() * 0.3); if (f > 0.05 && Math.random() < dt * 14 * f) puff(beacon.obj.position.clone().setY(beacon.obj.position.y + 0.15), { n: 1, col: 0xff7a26, size: 0.18 + f * 0.2, up: 0.5, spread: 0.12, life: 0.8, add: true }); }
    for (const s of fleetObjs) { const w = wave(s.position.x, s.position.z, T); s.position.y = w.y; s.userData.body.rotation.set(-w.nz * 0.3, 0, w.nx * 0.3); }
    // ships ride the waves and glide to their hex
    for (const s of Object.values(shipObjs)) {
      const to = s.userData.to, d = to.clone().sub(s.position).setY(0);
      if (d.length() > 0.01) { const step = Math.min(d.length(), dt * 1.4); s.position.addScaledVector(d.normalize(), step); s.userData.heading = Math.atan2(-d.z, d.x); }
      const w = wave(s.position.x, s.position.z, T);
      s.position.y = w.y + 0.02; const b = s.userData.body; b.rotation.set(-w.nz * 0.25, 0, w.nx * 0.25); s.rotation.y += (((s.userData.heading ?? 0) - s.rotation.y + Math.PI) % (Math.PI * 2) - Math.PI) * dt * 2;
      s.userData.sail.scale.z = 1 + Math.sin(T * 2 + s.position.x) * 0.15;
    }
    for (const g of Object.values(seaObjs)) { if (g.userData.float) g.userData.float.position.y = 0.16 + wave(g.position.x, g.position.z, T).y; }
    for (const g of Object.values(fogObjs)) g.children.forEach(s => { s.position.x += Math.sin(T * 0.3 + s.userData.ph) * dt * 0.05; });
    for (const m of hiG.children) if (m.userData.pulse) m.material.opacity = 0.35 + 0.3 * Math.sin(T * 4);
    // camera
    if (camTween) { const f = Math.min(1, (now - camTween.t0) / camTween.ms), e = ease(f); controls.target.lerpVectors(camTween.fromT, camTween.toT, e); camera.position.lerpVectors(camTween.fromP, camTween.toP, e); if (f >= 1) camTween = null; }
    if (mode === "backdrop" || (idle && now - lastTouch > 25000)) { const r = camera.position.clone().sub(controls.target); r.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.05); camera.position.copy(controls.target).add(r); }
    controls.update();
    renderer.render(scene, camera);
    dice.render?.();
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 55 : 42; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();
  document.addEventListener("visibilitychange", () => { running = document.visibilityState === "visible"; if (running) { clock.getDelta(); frame(); } });
  const dice = { render: null };
  requestAnimationFrame(frame);

  // a demo island for the landing page, so the backdrop is alive before a game starts
  function setMode(m) { mode = m; if (m === "game") { idle = true; lastTouch = performance.now(); } }

  // the raider fleet waits on the horizon of its sector and closes in as the days pass; the shared beacon burns on that coast
  const fleetObjs = [], beacon = { obj: null, light: null, heat: 0, sector: -1 };
  function syncFleet(v, instant) {
    const F = v.raiders && v.phase !== "setup" ? v.fleet : null;
    if (!F) { fleetObjs.forEach(o => scene.remove(o)); fleetObjs.length = 0; if (beacon.obj) { piecesG.remove(beacon.obj); beacon.obj = null; } return; }
    const ang = F.sector * Math.PI / 3, dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const dist = (v.R + 2.2) * 1.7 + F.eta * 2.6, n = Math.min(5, Math.max(2, F.strength));
    while (fleetObjs.length < n) { const o = ship(null, true); o.scale.setScalar(1.5); scene.add(o); fleetObjs.push(o); if (!instant) o.position.copy(dir).multiplyScalar(34); }
    while (fleetObjs.length > n) scene.remove(fleetObjs.pop());
    fleetObjs.forEach((o, i) => {
      const to = dir.clone().multiplyScalar(dist + (i % 2) * 0.8).addScaledVector(side, (i - (n - 1) / 2) * 1.1);
      if (instant) o.position.copy(to);
      else { const from = o.position.clone(); tween(2400, f => { o.position.x = from.x + (to.x - from.x) * ease(f); o.position.z = from.z + (to.z - from.z) * ease(f); }); }
      o.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
    });
    // beacon: on the coast tile nearest the fleet's bearing
    if (beacon.sector !== F.sector || !beacon.obj) {
      if (beacon.obj) piecesG.remove(beacon.obj);
      let bestK = null, bd = -1e9;
      for (const k in v.tiles) { const t = v.tiles[k]; if (!t.land || t.isle) continue; const [x, z] = hexXZ(k); const d = x * dir.x + z * dir.z; if (d > bd) { bd = d; bestK = k; } }
      const [x, z] = hexXZ(bestK), lx = dir.x * 0.55, lz = dir.z * 0.55, g = new THREE.Group();
      const cairn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.14, 7), stoneMat); cairn.position.y = 0.07; cairn.castShadow = true;
      for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2), timberMat); l.position.set(Math.cos(i) * 0.04, 0.2, Math.sin(i) * 0.04); l.rotation.set(Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4); g.add(l); }
      const light = new THREE.PointLight(0xff8a3a, 0, 3.5); light.position.y = 0.35; g.add(cairn, light);
      g.position.set(x + lx, tileHeight(v.tiles[bestK], lx, lz), z + lz); piecesG.add(g);
      beacon.obj = g; beacon.light = light; beacon.sector = F.sector;
    }
    beacon.heat = Math.min(1, v.beacon.def / Math.max(1, F.strength));
  }
  function reset() {
    fleetObjs.forEach(o => scene.remove(o)); fleetObjs.length = 0; beacon.obj = null; beacon.sector = -1;
    for (const g of [tilesG, decoG, piecesG, seaG, fxG, hiG]) g.clear();
    for (const o of Object.values(shipObjs)) scene.remove(o);
    for (const m of [tileObjs, tileMats, fogObjs, seaObjs, buildObjs, trailObjs, shipObjs]) for (const k of Object.keys(m)) delete m[k];
    landSig = ""; view = null; season = -1; armed = null; parts.length = 0;
  }

  // where each glowing target sits on screen (used by the browser tests to tap the board like a player)
  function targetsOnScreen() {
    const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
    return hiG.children.map(m => { m.getWorldPosition(v); v.project(camera); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, t: m.userData.target }; })
      .filter(p => p.x > 0 && p.y > 0 && p.x < r.width && p.y < r.height);
  }
  function renderOnce() { controls.update(); renderer.render(scene, camera); }
  return {
    reset, targetsOnScreen, renderOnce, renderer, scene, camera, controls, sync, arm, focus, home, pulseTile, puff, screenOf, raid, storm, sfx, setMode, dice, hexXZ, heightAt,
    lightningFlash, get view() { return view; }, tween,
    setQuality(q) { quality = q; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === "high" ? 2 : 1.25)); resize(); },
  };
}
