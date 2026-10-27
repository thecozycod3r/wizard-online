// Physics dice. The throw is simulated with cannon-es first (fixed step, so it's the same everywhere), then the die
// meshes are turned inside so the faces that end up on top show the engine's roll. Played back over the island.
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";

// local face normals in BoxGeometry material order (+x, -x, +y, -y, +z, -z) and the pips on each
const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a));
const PIPS = [3, 4, 1, 6, 2, 5];   // opposite faces sum to 7
const SIZE = 0.55, STEP = 1 / 120;

function faceTex(n) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 110, 30, 128, 128, 190); grd.addColorStop(0, "#fffaf0"); grd.addColorStop(1, "#e7dcc4");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const at = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }[n];
  for (const [x, y] of at) {
    const cx = 58 + x * 70, cy = 58 + y * 70, r = n === 1 ? 30 : 22;
    const pg = g.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, r); pg.addColorStop(0, n === 1 ? "#d23a2a" : "#3a2a1e"); pg.addColorStop(1, n === 1 ? "#7a120b" : "#0f0a06");
    g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createDice(world) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50); cam.position.set(0, 9, 4.2); cam.lookAt(0, 0, 0.3);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.4));
  const key = new THREE.DirectionalLight(0xfff2dd, 2.4); key.position.set(3, 8, 3); key.castShadow = true; key.shadow.mapSize.setScalar(1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(key);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);
  const mats = PIPS.map(n => new THREE.MeshStandardMaterial({ map: faceTex(n), roughness: 0.35, metalness: 0 }));
  const geo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.07);
  const dice = [0, 1].map(() => { const holder = new THREE.Group(), m = new THREE.Mesh(geo, mats); m.castShadow = true; holder.add(m); holder.visible = false; scene.add(holder); return { holder, mesh: m }; });

  let play = null, fade = 0;
  const renderer = world.renderer;
  function simulate(seed) {
    let s = seed >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const w = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) });
    w.allowSleep = true;
    const mat = new CANNON.Material(), contact = new CANNON.ContactMaterial(mat, mat, { friction: 0.3, restitution: 0.42 });
    w.addContactMaterial(contact);
    const ground = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(ground);
    for (const [x, z, ry] of [[0, -2.6, 0], [0, 2.8, Math.PI], [-3.2, 0, Math.PI / 2], [3.2, 0, -Math.PI / 2]]) {
      const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() }); b.position.set(x, 0, z); b.quaternion.setFromEuler(0, ry, 0); w.addBody(b);
    }
    const bodies = [0, 1].map(i => {
      const b = new CANNON.Body({ mass: 1, material: mat, shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)), sleepSpeedLimit: 0.15, sleepTimeLimit: 0.25 });
      b.position.set(-2.6 + i * 0.6, 1.4 + i * 0.4, 1.2 - i * 0.6);
      b.quaternion.setFromEuler(r() * 6, r() * 6, r() * 6);
      b.velocity.set(5 + r() * 2.5, 1.5 + r() * 2, -2.5 - r() * 2.5);
      b.angularVelocity.set((r() - 0.5) * 30, (r() - 0.5) * 30, (r() - 0.5) * 30);
      w.addBody(b); return b;
    });
    const frames = [];
    for (let i = 0; i < 600; i++) {
      w.step(STEP);
      frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      if (i > 60 && bodies.every(b => b.sleepState === CANNON.Body.SLEEPING)) break;
    }
    return frames;
  }
  // which local face points up for a resting quaternion
  function upFace(q) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert());
    let best = 0, bd = -2; FACES.forEach((f, i) => { const d = f.dot(up); if (d > bd) { bd = d; best = i; } });
    return best;
  }
  function roll(values, seed = Math.floor(Math.random() * 1e9)) {
    const frames = simulate(seed), lastF = frames[frames.length - 1];
    dice.forEach((d, i) => {
      const [, , , x, y, z, w] = lastF[i], q = new THREE.Quaternion(x, y, z, w);
      const got = upFace(q), want = PIPS.indexOf(values[i]);
      // rotate the mesh inside its holder so face "want" sits where face "got" landed
      d.mesh.quaternion.setFromUnitVectors(FACES[want], FACES[got]);
      d.holder.visible = true;
    });
    fade = 1;
    return new Promise(res => { play = { frames, t0: performance.now(), res, clacks: 0 }; });
  }
  function render() {
    if (!play && fade <= 0) return;
    const r = renderer.domElement, w = r.clientWidth, h = r.clientHeight;
    cam.aspect = w / h; cam.position.set(0, w < h ? 15 : 12, w < h ? 6 : 5); cam.lookAt(0, 0, 0.3); cam.updateProjectionMatrix();
    if (play) {
      const i = Math.min(play.frames.length - 1, Math.floor((performance.now() - play.t0) / 1000 / STEP));
      play.frames[i].forEach((f, k) => { dice[k].holder.position.set(f[0], f[1], f[2]); dice[k].holder.quaternion.set(f[3], f[4], f[5], f[6]); });
      if (i > 0) { const a = play.frames[i][0][1], b = play.frames[Math.max(0, i - 6)][0][1]; if (a < SIZE * 0.55 && b > SIZE * 0.7 && play.clacks < 5) { play.clacks++; world.sfx("dice"); } }
      if (i >= play.frames.length - 1) { const p = play; play = null; setTimeout(() => { fade = 0.999; }, 1300); p.res(); }
    } else if (fade < 1) { fade -= 0.04; dice.forEach(d => d.holder.scale.setScalar(Math.max(0.01, fade))); if (fade <= 0) dice.forEach(d => { d.holder.visible = false; d.holder.scale.setScalar(1); }); }
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, cam); renderer.autoClear = true;
  }
  world.dice.render = render;
  return { roll, get busy() { return !!play; } };
}
