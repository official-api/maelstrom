import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function createSceneSetup(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd8e8);
  scene.fog = new THREE.FogExp2(0xc3dbe9, 0.012);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  camera.position.set(-6, 3.2, 10);
  camera.lookAt(0, 1, 0);

  // ---------------------------------------------------------------- lights
  const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
  sun.position.set(-18, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x33421f, 0.9);
  scene.add(hemi);

  const fillLight = new THREE.DirectionalLight(0xdfeeff, 0.35);
  fillLight.position.set(10, 8, -10);
  scene.add(fillLight);

  // ---------------------------------------------------------------- environment (PMREM for realistic PBR reflections)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  // ---------------------------------------------------------------- ground
  const groundTex = makeGrassTexture();
  const groundGeo = new THREE.PlaneGeometry(400, 400, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex.color,
    normalMap: groundTex.normal,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // scattered grass detail using a low mesh count of instanced blades-ish tufts
  scene.add(makeGrassTufts());

  // ---------------------------------------------------------------- trees
  const treePositions = [
    [-14, 0, -6], [-19, 0, 4], [-9, 0, 14], [16, 0, -10],
    [21, 0, 2], [12, 0, 16], [-24, 0, -16], [26, 0, -8],
  ];
  const treeGroup = new THREE.Group();
  treePositions.forEach((p, i) => {
    const t = makeTree(1 + (i % 3) * 0.18);
    t.position.set(p[0], 0, p[2]);
    t.rotation.y = i * 1.7;
    treeGroup.add(t);
  });
  scene.add(treeGroup);

  let lastW = 0, lastH = 0;
  function onResize(container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, sun, onResize };
}

// ---------------------------------------------------------------- procedural grass texture
function makeGrassTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#3c5a2c");
  g.addColorStop(1, "#4a6b34");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 20 + Math.random() * 60;
    const tone = Math.random() > 0.5 ? [70, 100, 45] : [50, 75, 35];
    ctx.strokeStyle = `rgba(${tone[0] + shade * 0.2},${tone[1] + shade * 0.2},${tone[2]},0.5)`;
    ctx.lineWidth = 1 + Math.random();
    const len = 3 + Math.random() * 6;
    const ang = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  const colorTex = new THREE.CanvasTexture(canvas);
  colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(60, 60);
  colorTex.colorSpace = THREE.SRGBColorSpace;

  // cheap normal map derived from the same noise for subtle surface variation
  const nCanvas = document.createElement("canvas");
  nCanvas.width = nCanvas.height = size;
  const nctx = nCanvas.getContext("2d");
  nctx.fillStyle = "#8080ff";
  nctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 110 + Math.random() * 60;
    nctx.fillStyle = `rgba(${v},${v},255,0.4)`;
    nctx.fillRect(x, y, 2, 2);
  }
  const normalTex = new THREE.CanvasTexture(nCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(60, 60);

  return { color: colorTex, normal: normalTex };
}

function makeGrassTufts() {
  const group = new THREE.Group();
  const bladeGeo = new THREE.PlaneGeometry(0.14, 0.4);
  bladeGeo.translate(0, 0.2, 0);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x4f7a34,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const count = 500;
  const inst = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
  inst.castShadow = false;
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const r = 3 + Math.random() * 40;
    const a = Math.random() * Math.PI * 2;
    dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.8;
    dummy.scale.set(s, s * (0.8 + Math.random() * 0.6), s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  group.add(inst);
  return group;
}

function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3826, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 8), trunkMat);
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3c6b2f, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const r = 1.5 - i * 0.32;
    const cone = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
    cone.position.y = 2.4 + i * 1.05;
    cone.scale.y = 1.15;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  g.scale.setScalar(scale);
  return g;
}
