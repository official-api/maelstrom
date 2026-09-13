/* ═══════════════════════════════════════════
   MAELSTROM - THREE.JS 3D SIMULATION ENGINE v2
   Photorealistic terrain, detailed rocket, improved guidance
   ═══════════════════════════════════════════ */

const SIM = (() => {
  let renderer, scene, camera, clock;
  let ground, skyDome;
  let rocketGroup = null;
  let drones = [];
  let trees = [];
  let launchPod;
  let radarDish, radarScanRing;
  let explosionParticles = [];
  let fiberParticles = [];
  let trailParticles = [];

  // State
  let simState = 'idle';
  let killMode = null;
  let missionTime = 0;
  let rocketPos = new THREE.Vector3();
  let rocketVel = new THREE.Vector3();
  let droneSwarmCenter = new THREE.Vector3();
  let trajectoryPoints = [];
  let launchOrigin = new THREE.Vector3();
  let controlFinAngle = 0;
  let engineFlame, engineFlame2, engineLight;
  let rocketFired = false;
  let interceptDone = false;
  let finRotDir = 1;
  let radarScanAngle = 0;
  let cameraTimer = 0;
  let sunLight;

  // Callbacks
  let onAlertCb = null;
  let onRocketLaunchCb = null;
  let onInterceptCb = null;
  let onDoneCb = null;

  // ─── Noise helpers ───
  function hash(n) { return Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1; }
  function noise2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return hash(ix + iz * 57) * (1 - ux) * (1 - uz)
         + hash(ix + 1 + iz * 57) * ux * (1 - uz)
         + hash(ix + (iz + 1) * 57) * (1 - ux) * uz
         + hash(ix + 1 + (iz + 1) * 57) * ux * uz;
  }
  function fbm(x, z, oct) {
    let v = 0, a = 0.5, freq = 1;
    for (let i = 0; i < oct; i++) { v += a * noise2(x * freq, z * freq); a *= 0.5; freq *= 2; }
    return v;
  }

  /* ════════════════════════════════════
     INIT
  ════════════════════════════════════ */
  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight - 24;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x8ca0a0, 0.007);

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(52, W / H, 0.05, 2000);
    camera.position.set(-14, 7, 20);
    camera.lookAt(0, 2, 0);

    buildLighting();
    buildSky();
    buildGround();
    buildTrees();
    buildLaunchPod();
    buildDroneSwarm();

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
    animate();
  }

  function onResize() {
    const canvas = renderer.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    const W = parent.clientWidth;
    const H = parent.clientHeight - 22;
    if (W < 1 || H < 1) return;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  /* ════════════════════════════════════
     LIGHTING
  ════════════════════════════════════ */
  function buildLighting() {
    // Rich ambient sky light
    const ambient = new THREE.AmbientLight(0x304060, 0.35);
    scene.add(ambient);

    // Sun - warm golden hour
    sunLight = new THREE.DirectionalLight(0xffd080, 2.0);
    sunLight.position.set(60, 80, -30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // Sky fill - cool blue opposite
    const fillLight = new THREE.DirectionalLight(0x4488cc, 0.6);
    fillLight.position.set(-30, 20, 40);
    scene.add(fillLight);

    // Hemisphere - sky/ground bounce
    const hemi = new THREE.HemisphereLight(0x4477aa, 0x1a3310, 0.5);
    scene.add(hemi);

    // Ground bounce (warm)
    const bounce = new THREE.DirectionalLight(0x887755, 0.3);
    bounce.position.set(0, -10, 0);
    scene.add(bounce);
  }

  /* ════════════════════════════════════
     SKY
  ════════════════════════════════════ */
  function buildSky() {
    const skyGeo = new THREE.SphereGeometry(800, 48, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:  { value: new THREE.Color(0x0d2a5e) },
        midColor:  { value: new THREE.Color(0x2a6080) },
        botColor:  { value: new THREE.Color(0x8ab8c8) },
        sunDir:    { value: new THREE.Vector3(0.6, 0.8, -0.3).normalize() },
        sunColor:  { value: new THREE.Color(1.0, 0.9, 0.6) },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor, midColor, botColor, sunDir, sunColor;
        varying vec3 vWorldDir;
        void main() {
          float h = vWorldDir.y;
          vec3 sky = mix(botColor, midColor, smoothstep(-0.1, 0.3, h));
          sky = mix(sky, topColor, smoothstep(0.2, 0.9, h));
          // Sun disc
          float sun = max(0.0, dot(normalize(vWorldDir), sunDir));
          float disc = pow(sun, 180.0);
          float halo = pow(sun, 8.0) * 0.4;
          sky += sunColor * disc * 3.0 + sunColor * halo;
          // Atmospheric scattering tint near horizon
          float horiz = exp(-abs(h) * 6.0);
          sky = mix(sky, vec3(0.7, 0.85, 0.9), horiz * 0.25);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide
    });
    skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Clouds - simple billboard planes
    buildClouds();
  }

  function buildClouds() {
    const cloudPositions = [
      [80, 55, -120], [-60, 48, -100], [130, 52, -80],
      [-100, 60, -150], [50, 45, -200], [-150, 50, -60]
    ];
    cloudPositions.forEach(([x, y, z]) => {
      const w = 40 + Math.random() * 50;
      const h2 = 12 + Math.random() * 10;
      const geo = new THREE.PlaneGeometry(w, h2);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.95, 0.97, 1.0),
        transparent: true,
        opacity: 0.35 + Math.random() * 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const cloud = new THREE.Mesh(geo, mat);
      cloud.position.set(x, y, z);
      cloud.rotation.y = Math.random() * Math.PI;
      scene.add(cloud);
    });
  }

  /* ════════════════════════════════════
     GROUND - procedural terrain
  ════════════════════════════════════ */
  function buildGround() {
    // Simple flat ground — reliable baseline for r128
    const groundGeo = new THREE.PlaneGeometry(400, 400, 80, 80);
    const pos = groundGeo.attributes.position;

    // Displace Y (local, pre-rotation) — PlaneGeometry in r128 uses X/Y in plane, Z=0
    // After rotation.x=-PI/2: local X->worldX, local Y->world-Z, local Z->worldY
    // So to get height bumps in worldY we set local Z
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = fbm(x * 0.04, y * 0.04, 4) * 2.5;
      pos.setZ(i, h);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Darker patches near launch pad
    const patchMat = new THREE.MeshLambertMaterial({ color: 0x6a5535 });
    [[- 8, 8, 3.5], [-10, 6, 2], [-6, 11, 1.5]].forEach(([px, pz, pr]) => {
      const pg = new THREE.Mesh(new THREE.CircleGeometry(pr, 10), patchMat);
      pg.rotation.x = -Math.PI / 2;
      pg.position.set(px, 0.02, pz);
      scene.add(pg);
    });

  }

  /* ════════════════════════════════════
     TREES - detailed
  ════════════════════════════════════ */
  function buildTrees() {
    const positions = [
      [-28, -15], [-33, 4], [-22, 22], [-18, -28],
      [25, -20], [30, -4], [20, 14], [38, 18],
      [12, -30], [-8, -35], [45, -5], [-40, 10],
      [22, -35], [-15, 32],
    ];
    positions.forEach(([x, z]) => {
      const h = fbm(x * 0.04, z * 0.04, 5) * 3.0 - fbm(x * 0.1 + 5, z * 0.1 + 5, 3) * 0.6;
      const t = buildDetailedTree(x, h, z);
      trees.push(t);
      scene.add(t);
    });
  }

  function buildDetailedTree(x, yBase, z) {
    const group = new THREE.Group();
    group.position.set(x, yBase, z);

    const treeH = 6 + Math.random() * 5;
    const treeType = Math.random() > 0.5 ? 'pine' : 'deciduous';

    // Trunk - tapered cylinder with bark detail
    const trunkSegs = 10;
    const trunkGeo = new THREE.CylinderGeometry(
      0.12 + Math.random() * 0.06,
      0.25 + Math.random() * 0.1,
      treeH * 0.45, trunkSegs
    );
    // Warp trunk vertices for natural feel
    const tp = trunkGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      tp.setX(i, tp.getX(i) + (Math.random() - 0.5) * 0.04);
      tp.setZ(i, tp.getZ(i) + (Math.random() - 0.5) * 0.04);
    }
    trunkGeo.computeVertexNormals();

    const barkH = new THREE.Color().setHSL(0.07, 0.4, 0.13 + Math.random() * 0.05);
    const trunkMat = new THREE.MeshStandardMaterial({ color: barkH, roughness: 0.95, metalness: 0 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = treeH * 0.225;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Root flares
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const flareGeo = new THREE.CylinderGeometry(0.04, 0.18, treeH * 0.12, 5);
      const flare = new THREE.Mesh(flareGeo, trunkMat);
      flare.position.set(Math.cos(a) * 0.15, treeH * 0.06, Math.sin(a) * 0.15);
      flare.rotation.z = Math.cos(a) * 0.4;
      flare.rotation.x = Math.sin(a) * 0.4;
      flare.castShadow = true;
      group.add(flare);
    }

    if (treeType === 'pine') {
      // Pine: layered cones
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1);
        const r = (1.5 - t * 0.8) * (1.8 + Math.random() * 0.4);
        const ly = treeH * 0.38 + i * treeH * 0.12;
        const coneH = treeH * 0.22;
        const leafH = new THREE.Color().setHSL(0.28 + Math.random() * 0.06, 0.55, 0.16 + Math.random() * 0.08);
        const leafMat = new THREE.MeshStandardMaterial({ color: leafH, roughness: 0.9, metalness: 0, side: THREE.FrontSide });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, coneH, 10 + i, 1), leafMat);
        cone.position.y = ly;
        cone.rotation.y = Math.random() * Math.PI;
        cone.castShadow = true;
        cone.receiveShadow = true;
        group.add(cone);
      }
    } else {
      // Deciduous: cluster of icospheres
      const leafH = new THREE.Color().setHSL(0.27 + Math.random() * 0.06, 0.58, 0.18 + Math.random() * 0.10);
      const leafMat = new THREE.MeshStandardMaterial({ color: leafH, roughness: 0.88, metalness: 0 });
      const clusterCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < clusterCount; i++) {
        const r = 1.8 + Math.random() * 1.2;
        const cx2 = (Math.random() - 0.5) * r;
        const cy2 = treeH * 0.5 + Math.random() * treeH * 0.3;
        const cz2 = (Math.random() - 0.5) * r;
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.5 + Math.random() * 0.4, 1), leafMat);
        blob.position.set(cx2, cy2, cz2);
        blob.rotation.set(Math.random(), Math.random(), Math.random());
        blob.castShadow = true;
        blob.receiveShadow = true;
        group.add(blob);
      }
    }

    return group;
  }

  /* ════════════════════════════════════
     LAUNCH POD - detailed military
  ════════════════════════════════════ */
  function buildLaunchPod() {
    launchPod = new THREE.Group();
    launchPod.position.set(-8, 0, 8);
    scene.add(launchPod);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5545, roughness: 0.65, metalness: 0.55 });
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x2a3030, roughness: 0.55, metalness: 0.7 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x181e1e, roughness: 0.4, metalness: 0.8 });
    const yBase = fbm(-8 * 0.04, 8 * 0.04, 5) * 3.0 - fbm(-8 * 0.1 + 5, 8 * 0.1 + 5, 3) * 0.6;

    // ── Baseplate
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.12, 8), metalMat);
    base.position.y = yBase + 0.06;
    base.castShadow = true; base.receiveShadow = true;
    launchPod.add(base);

    // ── Tripod legs (3 heavy)
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const lx = Math.cos(angle) * 1.0, lz = Math.sin(angle) * 1.0;
      // Main leg
      const legGeo = new THREE.CylinderGeometry(0.055, 0.075, 2.2, 8);
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(lx * 0.5, yBase + 1.1, lz * 0.5);
      leg.rotation.z = Math.sin(angle) * 0.38;
      leg.rotation.x = Math.cos(angle) * 0.38;
      leg.castShadow = true;
      launchPod.add(leg);
      // Foot pad
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.06, 6), darkMat);
      foot.position.set(lx, yBase + 0.03, lz);
      launchPod.add(foot);
      // Cross brace
      const braceGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6);
      const brace = new THREE.Mesh(braceGeo, metalMat);
      brace.position.set(lx * 0.4, yBase + 0.7, lz * 0.4);
      brace.rotation.z = Math.sin(angle + Math.PI / 6) * 0.6;
      brace.rotation.x = Math.cos(angle + Math.PI / 6) * 0.6;
      launchPod.add(brace);
    }

    // ── Central mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10), metalMat);
    mast.position.y = yBase + 1.3;
    mast.castShadow = true;
    launchPod.add(mast);

    // ── Elevation pivot housing
    const pivot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), darkMat);
    pivot.position.y = yBase + 2.65;
    pivot.castShadow = true;
    launchPod.add(pivot);

    // ── Launch tube cluster (4 tubes like a real MANPAD quad-pack)
    const tubeGroup = new THREE.Group();
    tubeGroup.position.set(0, yBase + 2.65, 0);
    const elevAngle = Math.PI / 5.5; // ~33° elevation
    tubeGroup.rotation.z = elevAngle;

    const tubeOffsets = [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14], [0.14, -0.14]];
    tubeOffsets.forEach(([ty, tz]) => {
      // Outer tube
      const outerTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 2.4, 12, 1, false),
        blackMat
      );
      // Inner bore
      const innerBore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 2.4, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x080e0e, roughness: 0.3, metalness: 0.9, side: THREE.BackSide })
      );
      outerTube.add(innerBore);
      outerTube.position.set(0, 0, 0);
      // Orient tubes along X axis (horizontal in tube-group local space)
      outerTube.rotation.z = Math.PI / 2;
      outerTube.position.set(0.6, ty, tz);
      outerTube.castShadow = true;
      tubeGroup.add(outerTube);

      // Tube bands / reinforcements
      for (let b = 0; b < 3; b++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.015, 6, 12), metalMat);
        band.position.set(-0.6 + b * 0.6, ty, tz);
        band.rotation.y = Math.PI / 2;
        tubeGroup.add(band);
      }
    });

    // Tube support rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 0.38), metalMat);
    rail.position.set(0.6, 0, 0);
    tubeGroup.add(rail);

    launchPod.add(tubeGroup);

    // ── Radar / sensor mast (separate boom)
    const radarBoom = new THREE.Group();
    radarBoom.position.set(0.6, yBase + 2.8, 0);

    const boomPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 8), metalMat);
    boomPole.position.y = 0.45;
    radarBoom.add(boomPole);

    // Radar dish - parabolic look
    const dishGeo = new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x6a7a70, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide });
    radarDish = new THREE.Mesh(dishGeo, dishMat);
    radarDish.position.y = 0.95;
    radarDish.rotation.x = -Math.PI * 0.45;
    radarBoom.add(radarDish);

    // Feed horn
    const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.2, 8), blackMat);
    feedHorn.position.set(0, 0.75, 0.25);
    feedHorn.rotation.x = 0.4;
    radarBoom.add(feedHorn);

    launchPod.add(radarBoom);

    // Compute launch origin - tip of tube cluster in world space
    // Tube group centre at yBase+2.65, rotated, tubes extend +X by 0.6+1.2 = 1.2 from centre
    const podWorldPos = new THREE.Vector3(-8, 0, 8);
    const tubeLen = 1.2;
    launchOrigin.set(
      podWorldPos.x + Math.cos(elevAngle) * tubeLen,
      yBase + 2.65 + Math.sin(elevAngle) * tubeLen,
      podWorldPos.z
    );
  }

  /* ════════════════════════════════════
     ROCKET - detailed geometry
     840mm = 0.84 units, scaled *10 for scene
  ════════════════════════════════════ */
  function buildRocket() {
    rocketGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb0c0d0, roughness: 0.25, metalness: 0.75 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x252e35, roughness: 0.4, metalness: 0.85 });
    const finMat   = new THREE.MeshStandardMaterial({ color: 0x4a5a62, roughness: 0.35, metalness: 0.8 });
    const noseMat  = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.18, metalness: 0.9 });
    const nozzleMat= new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.3, metalness: 0.95 });

    // Rocket total length: 840mm. In scene units (*10): 8.4 units.
    // Sections:
    //   Nose tip: hemisphere r=0.45 units (45mm radius)
    //   Forward body: from y=0 to y=5.4 (540mm)
    //   Engine section: y=-3.0 to y=0 (300mm)
    // Coords: nose tip at +4.2, tail at -4.2, body centre at 0

    // ── Nose - hemisphere
    const noseGeo = new THREE.SphereGeometry(0.45, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.y = 4.2;
    nose.rotation.x = Math.PI;
    nose.castShadow = true;
    rocketGroup.add(nose);

    // ── Ogive forward fairing (nose to forward body junction)
    const fairingPts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const r = 0.45 * Math.sin(t * Math.PI * 0.5);
      fairingPts.push(new THREE.Vector2(r, 4.2 - t * 0.9));
    }
    const fairingGeo = new THREE.LatheGeometry(fairingPts, 20);
    const fairing = new THREE.Mesh(fairingGeo, noseMat);
    fairing.castShadow = true;
    rocketGroup.add(fairing);

    // ── Forward body (540mm)
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.45, 5.4, 24);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;  // centre of 5.4 length starting at 3.3...-2.1? Let me recalc:
    // nose tip at 4.2, hemisphere ends at 4.2-0.45=3.75 approx
    // body: from 3.3 (top) down to -2.1 (bottom of forward body = engine start)
    // body centre = (3.3 + -2.1) / 2 = 0.6
    body.position.y = 0.6;
    body.castShadow = true;
    rocketGroup.add(body);

    // Paint stripe / panel lines on body
    const stripe1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.452, 0.452, 0.12, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.3, metalness: 0.7 })
    );
    stripe1.position.y = 1.8;
    rocketGroup.add(stripe1);
    const stripe2 = stripe1.clone();
    stripe2.position.y = -0.6;
    rocketGroup.add(stripe2);

    // ── Warhead section indicator ring
    const wring = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.3, metalness: 0.6 }));
    wring.position.y = 2.1;
    wring.rotation.x = Math.PI / 2;
    rocketGroup.add(wring);

    // ── Engine section (300mm)
    const engGeo = new THREE.CylinderGeometry(0.45, 0.42, 3.0, 24);
    const eng = new THREE.Mesh(engGeo, engineMat);
    eng.position.y = -3.6;  // centre of -2.1 to -5.1 = -3.6
    eng.castShadow = true;
    rocketGroup.add(eng);

    // Engine detail rings
    for (let i = 0; i < 4; i++) {
      const ering = new THREE.Mesh(
        new THREE.TorusGeometry(0.45 - i * 0.005, 0.018, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x3a4a50, roughness: 0.5, metalness: 0.8 })
      );
      ering.position.y = -2.3 - i * 0.5;
      ering.rotation.x = Math.PI / 2;
      rocketGroup.add(ering);
    }

    // ── Nozzle - converging-diverging bell
    const nozzlePts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      // Bell: starts at 0.35, throat 0.2, exit 0.32
      let r;
      if (t < 0.4) { r = 0.35 - t * 0.375; }
      else { r = 0.05 + Math.pow((t - 0.4) / 0.6, 0.6) * 0.3; }
      nozzlePts.push(new THREE.Vector2(r, -5.1 - t * 0.8));
    }
    const nozzleGeo = new THREE.LatheGeometry(nozzlePts, 20);
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.castShadow = true;
    rocketGroup.add(nozzle);

    // ── FIXED FINS * 4 - clipped delta, forward of engine section
    // Control fins sit at 0°, 90°, 180°, 270°.
    // Fixed fins are staggered 45° between them: 45°, 135°, 225°, 315°.
    for (let i = 0; i < 4; i++) {
      const orbitalAngle = (i / 4) * Math.PI * 2; // 0°, 90°, 180°, 270°
      const fxGrp = new THREE.Group();
      fxGrp.position.y = -2.6;
      fxGrp.rotation.y = orbitalAngle; // rotate the group around the rocket axis
      const fin = makeFixedFin(finMat);  // fin geometry points outward along +X inside the group
      fxGrp.add(fin);
      rocketGroup.add(fxGrp);
    }

    // ── CONTROL FINS * 4 - rectangular, all-moving, at aft section
    // Sit at 0°, 90°, 180°, 270° - interleaved with fixed fins above
    const ctrlFinGroups = [];
    for (let i = 0; i < 4; i++) {
      const orbitalAngle = (i / 4) * Math.PI * 2; // 0°, 90°, 180°, 270°
      const cfGrp = new THREE.Group();
      cfGrp.position.y = -4.6;
      cfGrp.rotation.y = orbitalAngle;
      const fin = makeCtrlFin(finMat);
      cfGrp.add(fin);
      rocketGroup.add(cfGrp);
      ctrlFinGroups.push(cfGrp);
    }
    rocketGroup._ctrlFins = ctrlFinGroups;

    // ── Engine flame - multi-layer
    const flameMat1 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.75 });
    const flameMat3 = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.5, side: THREE.BackSide });

    engineFlame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 16), flameMat1);
    engineFlame.position.y = -6.1;
    engineFlame.rotation.x = Math.PI;
    engineFlame.visible = false;
    rocketGroup.add(engineFlame);

    engineFlame2 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 16), flameMat2);
    engineFlame2.position.y = -6.5;
    engineFlame2.rotation.x = Math.PI;
    engineFlame2.visible = false;
    rocketGroup.add(engineFlame2);

    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 16), flameMat3);
    flameOuter.position.y = -7.2;
    flameOuter.rotation.x = Math.PI;
    flameOuter.visible = false;
    flameOuter.name = 'flameOuter';
    rocketGroup.add(flameOuter);

    engineLight = new THREE.PointLight(0xff6600, 0, 12);
    engineLight.position.y = -6.5;
    engineLight.visible = false;
    rocketGroup.add(engineLight);

    rocketGroup.scale.setScalar(1.0); // Already in scene units *10
    rocketPos.copy(launchOrigin);
    rocketGroup.position.copy(rocketPos);
    scene.add(rocketGroup);
    rocketGroup.visible = false;

    return ctrlFinGroups;
  }

    function makeFixedFin(mat) {
    const shape = new THREE.Shape();
    shape.moveTo(0,    0);      
    shape.lineTo(0,    0.65);   
    shape.lineTo(0.6,  0.5);    // Adjusted for 1.0 unit maximum tip span
    shape.lineTo(1.0, -0.1);    // <-- EXACTLY 1.0 units (100mm) outer tip span
    shape.lineTo(0.7,  -0.55);  // Adjusted to match new taper profile
    shape.lineTo(0,    -0.55);  
    shape.lineTo(0,    0);
    const ext = { depth: 0.07, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2 };
    const geo = new THREE.ExtrudeGeometry(shape, ext);
    const fin = new THREE.Mesh(geo, mat);
    // Offset root so fin starts at body surface (radius ≈ 0.45)
    fin.position.set(0.45, 0, -0.035);
    fin.castShadow = true;
    return fin;
  }

    function makeCtrlFin(mat) {
    const shape = new THREE.Shape();
    shape.moveTo(0,    0);
    shape.lineTo(0,    0.7);
    shape.lineTo(1.0,  0.7);    // <-- EXACTLY 1.0 units (100mm) span width
    shape.lineTo(1.0,  0);      // <-- EXACTLY 1.0 units (100mm) span width
    shape.lineTo(0,    0);
    const ext = { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 };
    const geo = new THREE.ExtrudeGeometry(shape, ext);
    const fin = new THREE.Mesh(geo, mat);
    fin.position.set(0.45, -0.35, -0.03);
    fin.castShadow = true;
    return fin;
  }

  /* ════════════════════════════════════
     DRONE SWARM - placed far away
  ════════════════════════════════════ */
  function buildDroneSwarm() {
    // Place swarm FAR - 90 units away so rocket has ample flight time
    const swarmCenter = new THREE.Vector3(55, 10, -45);
    droneSwarmCenter.copy(swarmCenter);

    const offsets = [
      [0,0,0],[4,1.5,-2],[-3,2,2],[2,-2,4],[-2,3,-3],
      [6,-1,3],[-4,-2,-3],[3,3.5,-4],[-2,-3,3],[5,2,2],
      [-5,1,-1],[1,-1.5,-5],[3.5,2.5,1],[-1,3.5,3]
    ].map(arr => arr.map ? arr : [0,0,0]);

    const droneOffsets = [
      [0,0,0],[4,1.5,-2],[-3,2,2],[2,-2,4],[-2,3,-3],
      [6,-1,3],[-4,-2,-3],[3,3.5,-4],[-2,-3,3],[5,2,2],
      [-5,1,-1],[1,-1.5,-5],[3.5,2.5,1],[-1,3.5,3]
    ];

    droneOffsets.forEach(([dx, dy, dz]) => {
      const drone = buildDetailedDrone();
      drone.position.set(swarmCenter.x + dx, swarmCenter.y + dy, swarmCenter.z + dz);
      drone._basePos = drone.position.clone();
      drone._vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.02
      );
      drone._alive = true;
      drone._fallVel = 0;
      scene.add(drone);
      drones.push(drone);
    });
  }

  function buildDetailedDrone() {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.4 });
    const armMat   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.75, metalness: 0.35 });
    const propMat  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.7 });
    const camMat   = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.9 });
    const ledMatR  = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const ledMatG  = new THREE.MeshBasicMaterial({ color: 0x00ff66 });

    // Centre frame plate
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), frameMat);
    group.add(frame);

    // Battery pack
    const battery = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.28), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.6, metalness: 0.5 }));
    battery.position.y = -0.07;
    group.add(battery);

    // Flight controller board
    const fcb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.5, metalness: 0.4 }));
    fcb.position.y = 0.05;
    group.add(fcb);

    // 4 Arms + motor + propeller
    const armDirs = [[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]];
    armDirs.forEach(([ax, ay, az], idx) => {
      const armLen = 0.45;
      const armGeo = new THREE.BoxGeometry(armLen, 0.035, 0.04);
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(ax * armLen / 2, 0, az * armLen / 2);
      arm.rotation.y = Math.atan2(az, ax);
      arm.castShadow = true;
      group.add(arm);

      // Motor bell
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.06, 10), armMat);
      motor.position.set(ax * armLen, 0.04, az * armLen);
      motor.castShadow = true;
      group.add(motor);

      // Prop disc (thin translucent cylinder)
      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.005, 12), propMat);
      prop.position.set(ax * armLen, 0.08, az * armLen);
      group.add(prop);

      // Prop blades
      for (let b = 0; b < 2; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.004, 0.04),
          new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.8 })
        );
        blade.position.set(ax * armLen, 0.082, az * armLen);
        blade.rotation.y = b * Math.PI / 2;
        group.add(blade);
      }

      // LEDs
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), idx < 2 ? ledMatR : ledMatG);
      led.position.set(ax * armLen, 0, az * armLen);
      group.add(led);
    });

    // FPV camera turret
    const camTurret = new THREE.Group();
    camTurret.position.set(0, -0.04, 0.16);
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.065), camMat);
    camTurret.add(camBody);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0x113344, roughness: 0.05, metalness: 0.98 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.035;
    camTurret.add(lens);
    group.add(camTurret);

    // Antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 5), armMat);
    ant.position.set(0.1, 0.14, -0.05);
    group.add(ant);

    group.scale.setScalar(0.9 + Math.random() * 0.25);
    return group;
  }

  /* ════════════════════════════════════
     TRAIL PARTICLES
  ════════════════════════════════════ */
  function spawnTrail() {
    if (!rocketFired) return;
    const layers = [
      { col: new THREE.Color(1, 1, 0.9), r: 0.06, speed: 0.6 },
      { col: new THREE.Color(1, 0.55, 0.05), r: 0.12, speed: 0.4 },
      { col: new THREE.Color(0.8, 0.2, 0.0), r: 0.18, speed: 0.25 },
      { col: new THREE.Color(0.4, 0.4, 0.4), r: 0.28, speed: 0.15 },
    ];
    layers.forEach(({ col, r, speed }) => {
      const geo = new THREE.SphereGeometry(r + Math.random() * r * 0.5, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(rocketPos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      ));
      p._vel = rocketVel.clone().normalize().multiplyScalar(-speed * (0.5 + Math.random() * 0.5)).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.04 + Math.random() * 0.06, (Math.random() - 0.5) * 0.06)
      );
      p._life = 1;
      p._decay = 0.9 + Math.random() * 0.5;
      scene.add(p);
      trailParticles.push(p);
    });
  }

  /* ════════════════════════════════════
     INTERCEPT EFFECTS
  ════════════════════════════════════ */
  function spawnHardKillExplosion(center) {
    // Primary fireball
    for (let i = 0; i < 350; i++) {
      const size = 0.06 + Math.random() * 0.22;
      const geo = new THREE.SphereGeometry(size, 5, 5);
      const t = Math.random();
      const col = new THREE.Color(1, 0.3 + t * 0.5, 0);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3
      ));
      const speed = 3 + Math.random() * 12;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      p._vel = dir.multiplyScalar(speed * 0.016);
      p._life = 1;
      p._decay = 0.5 + Math.random() * 0.6;
      p._gravity = 0.003 + Math.random() * 0.004;
      scene.add(p);
      explosionParticles.push(p);
    }

    // Debris shards
    for (let i = 0; i < 80; i++) {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(0.05 + Math.random() * 0.1, 0.05 + Math.random() * 0.08, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.7 })
      );
      shard.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2
      ));
      const speed = 1 + Math.random() * 6;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      shard._vel = dir.multiplyScalar(speed * 0.016);
      shard._life = 1;
      shard._decay = 0.25 + Math.random() * 0.3;
      shard._gravity = 0.006;
      shard._rot = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.1);
      scene.add(shard);
      explosionParticles.push(shard);
    }

    // Smoke puffs
    for (let i = 0; i < 40; i++) {
      const r = 0.4 + Math.random() * 0.8;
      const geo = new THREE.SphereGeometry(r, 8, 8);
      const grey = 0.3 + Math.random() * 0.4;
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(grey, grey, grey), transparent: true, opacity: 0.6 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6
      ));
      const speed = 0.3 + Math.random() * 1.5;
      const dir = new THREE.Vector3(Math.random() - 0.5, 1 + Math.random(), Math.random() - 0.5).normalize();
      p._vel = dir.multiplyScalar(speed * 0.016);
      p._life = 1;
      p._decay = 0.12 + Math.random() * 0.15;
      p._gravity = -0.001;
      p._type = 'smoke';
      scene.add(p);
      explosionParticles.push(p);
    }

    // Flash lights
    const flash1 = new THREE.PointLight(0xffffff, 30, 40);
    flash1.position.copy(center);
    flash1._life = 1; flash1._decay = 3; flash1.isLight = true;
    scene.add(flash1);
    explosionParticles.push({ isLight: true, light: flash1, _life: 1, _decay: 3 });

    const flash2 = new THREE.PointLight(0xff8800, 15, 60);
    flash2.position.copy(center);
    flash2._life = 1; flash2._decay = 0.8;
    scene.add(flash2);
    explosionParticles.push({ isLight: true, light: flash2, _life: 1, _decay: 0.8 });
  }

  function spawnSoftKillFibers(center) {
    // Carbon fiber burst - thin filaments
    for (let i = 0; i < 500; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const dist = 1 + Math.random() * 5;
      const endPt = center.clone().addScaledVector(dir, dist);
      const pts = [center.clone(), endPt];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const brightness = 0.5 + Math.random() * 0.5;
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(brightness * 0.7, brightness * 0.9, brightness),
        transparent: true, opacity: 0.85
      });
      const line = new THREE.Line(geo, mat);
      line._vel = dir.clone().multiplyScalar((0.4 + Math.random() * 2.5) * 0.016);
      line._life = 1;
      line._decay = 0.25 + Math.random() * 0.2;
      line._gravity = 0.003;
      scene.add(line);
      fiberParticles.push(line);
    }

    // Soft blue flash
    const flash = new THREE.PointLight(0x44aaff, 12, 35);
    flash.position.copy(center);
    scene.add(flash);
    fiberParticles.push({ isLight: true, light: flash, _life: 1, _decay: 1.2 });
  }

  /* ════════════════════════════════════
     RADAR SCAN VFX
  ════════════════════════════════════ */
  function buildRadarScan() {
    if (radarScanRing) return;
    const geo = new THREE.RingGeometry(0, 30, 64);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    radarScanRing = new THREE.Mesh(geo, mat);
    radarScanRing.rotation.x = -Math.PI / 2;
    radarScanRing.position.set(-8, 0.08, 8);
    scene.add(radarScanRing);
  }

  /* ════════════════════════════════════
     UPDATE LOOPS
  ════════════════════════════════════ */
  function updateRadar(dt) {
    if (!radarDish) return;
    radarDish.rotation.z += dt * 1.8;
    if (radarScanRing) {
      radarScanAngle += dt * 1.8;
      radarScanRing.rotation.z = radarScanAngle;
    }
  }

  function updateDrones(dt) {
    drones.forEach((drone, i) => {
      if (!drone._alive) {
        drone._fallVel += dt * 9.8 * 0.8;
        drone.position.y -= drone._fallVel * dt;
        drone.rotation.x += dt * (0.4 + i * 0.15);
        drone.rotation.z += dt * (0.25 + i * 0.1);
        drone.rotation.y += dt * 0.5;
        if (drone.position.y < -5) drone.visible = false;
        return;
      }

      if (simState === 'approach') {
        const towardPod = new THREE.Vector3(-8, 0, 8).sub(drone.position);
        const dist2 = towardPod.length();
        if (dist2 > 5) {
          towardPod.normalize().multiplyScalar(0.008);
          drone._vel.add(towardPod);
          drone._vel.clampLength(0, 0.025);
        }
      }

      drone.position.addScaledVector(drone._vel, 1);
      drone.position.y = drone._basePos.y + Math.sin(missionTime * 1.1 + i * 0.7) * 0.2;
      drone.rotation.y += dt * 0.4;
    });
  }

  function updateRocket(dt) {
    if (!rocketFired || !rocketGroup) return;
    if (interceptDone) return;

    // Direct pursuit with clamped turn rate -- guaranteed convergence
    const toTarget = droneSwarmCenter.clone().sub(rocketPos);
    const dist = toTarget.length();
    const desiredDir = toTarget.clone().normalize();
    const currentDir = rocketVel.clone().normalize();

    // Rotate current heading toward desired by max turn rate (rad/s)
    const maxTurnRate = dist > 20 ? 4.0 : 8.0;
    const maxTurn = maxTurnRate * dt;
    const dot = Math.min(1, Math.max(-1, currentDir.dot(desiredDir)));
    const angle = Math.acos(dot);
    let newDir;
    if (angle < 0.0001) {
      newDir = desiredDir.clone();
    } else {
      const t = Math.min(1, maxTurn / angle);
      newDir = currentDir.clone().lerp(desiredDir, t).normalize();
    }

    // Accelerate along new direction
    const maxSpeed = 30;
    const spd = Math.min(rocketVel.length() + 12 * dt, maxSpeed);
    rocketVel.copy(newDir).multiplyScalar(spd);


    rocketPos.add(rocketVel.clone().multiplyScalar(dt));
    rocketGroup.position.copy(rocketPos);

    // Orient rocket along velocity
    const dir = rocketVel.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rocketGroup.quaternion.slerp(quat, Math.min(dt * 12, 1));

    // Control fin deflection - hinge is along the span (local Z of the group after rotation.x = -PI/2)
    // Deflecting the child fin mesh around its local Z gives a realistic pitch/yaw deflection
    controlFinAngle += dt * finRotDir * 2.2;
    if (Math.abs(controlFinAngle) > 0.35) finRotDir *= -1;
    if (rocketGroup._ctrlFins) {
      rocketGroup._ctrlFins.forEach((fg, i) => {
        // Alternate fins deflect in opposite directions for roll-neutral pitch+yaw
        fg.children[0].rotation.z = controlFinAngle * (i % 2 === 0 ? 1 : -1) * 0.45;
      });
    }

    // Flame flicker
    if (engineFlame) {
      const f1 = 0.82 + Math.random() * 0.36;
      const f2 = 0.88 + Math.random() * 0.24;
      engineFlame.scale.set(f1, f1 * (0.9 + Math.random() * 0.2), f1);
      engineFlame2.scale.set(f2, f2 * (0.85 + Math.random() * 0.3), f2);
      const flameOuter = rocketGroup.getObjectByName('flameOuter');
      if (flameOuter) flameOuter.scale.setScalar(0.9 + Math.random() * 0.2);
      engineLight.intensity = 8 + Math.random() * 4;
    }

    if (Math.random() < 0.9) spawnTrail();

    trajectoryPoints.push(rocketPos.clone());

    // Intercept check
    if (dist < 3.5) triggerIntercept();
  }

  function triggerIntercept() {
    interceptDone = true;
    simState = 'intercept';
    rocketGroup.visible = false;

    const center = droneSwarmCenter.clone();
    if (killMode === 'hard') {
      spawnHardKillExplosion(center);
      setTimeout(() => drones.forEach(d => { d._alive = false; d._fallVel = 0; }), 250);
    } else {
      spawnSoftKillFibers(center);
      setTimeout(() => drones.forEach(d => { d._alive = false; d._fallVel = 0; }), 700);
    }
    if (onInterceptCb) onInterceptCb(killMode);
    setTimeout(() => { simState = 'done'; if (onDoneCb) onDoneCb(); }, 4000);
  }

  function updateParticles(dt) {
    // Trail
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const p = trailParticles[i];
      p._life -= dt * p._decay;
      p.position.add(p._vel);
      p.material.opacity = Math.max(0, p._life * 0.85);
      p.scale.setScalar(Math.max(0.1, p._life));
      if (p._life <= 0) { scene.remove(p); trailParticles.splice(i, 1); }
    }

    // Explosion
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const item = explosionParticles[i];
      if (item.isLight) {
        item._life -= dt * item._decay;
        item.light.intensity = Math.max(0, item._life * (item.light === item.light ? 30 : 15));
        if (item._life <= 0) { scene.remove(item.light); explosionParticles.splice(i, 1); }
      } else {
        item._life -= dt * item._decay;
        item.position.add(item._vel);
        item._vel.y -= item._gravity || 0;
        if (item._rot) item.rotation.x += item._rot.x; // shard rotation
        item.material.opacity = Math.max(0, item._type === 'smoke' ? item._life * 0.6 : item._life);
        if (item._life <= 0) { scene.remove(item); explosionParticles.splice(i, 1); }
      }
    }

    // Fibers
    for (let i = fiberParticles.length - 1; i >= 0; i--) {
      const item = fiberParticles[i];
      if (item.isLight) {
        item._life -= dt * item._decay;
        item.light.intensity = Math.max(0, item._life * 12);
        if (item._life <= 0) { scene.remove(item.light); fiberParticles.splice(i, 1); }
      } else {
        item._life -= dt * item._decay;
        item.position.add(item._vel);
        item._vel.y -= item._gravity || 0;
        item.material.opacity = Math.max(0, item._life * 0.85);
        if (item._life <= 0) { scene.remove(item); fiberParticles.splice(i, 1); }
      }
    }
  }

  /* ════════════════════════════════════
     CAMERA
  ════════════════════════════════════ */
  let cameraMode = 'orbit'; // orbit | swarm-zoom | launch | flight | intercept

  function updateCamera(dt) {
    cameraTimer += dt;

    if (cameraMode === 'orbit') {
      const t = cameraTimer * 0.04;
      camera.position.x = Math.cos(t) * 22;
      camera.position.z = Math.sin(t) * 22 + 5;
      camera.position.y = 8 + Math.sin(t * 1.2) * 2;
      camera.lookAt(0, 3, 0);
    } else if (cameraMode === 'swarm-zoom') {
      // Zoom to distant swarm
      const target = droneSwarmCenter.clone().add(new THREE.Vector3(-15, 5, 15));
      camera.position.lerp(target, dt * 1.0);
      camera.lookAt(droneSwarmCenter.x, droneSwarmCenter.y, droneSwarmCenter.z);
    } else if (cameraMode === 'launch') {
      const target = new THREE.Vector3(-18, 8, 18);
      camera.position.lerp(target, dt * 1.5);
      camera.lookAt(-8, 4, 8);
    } else if (cameraMode === 'flight') {
      const dir = rocketVel.clone().normalize();
      const behind = dir.clone().multiplyScalar(-18);
      const up2 = new THREE.Vector3(0, 5, 0);
      const targetCamPos = rocketPos.clone().add(behind).add(up2);
      camera.position.lerp(targetCamPos, dt * 3);
      const lookAhead = rocketPos.clone().addScaledVector(dir, 8);
      camera.lookAt(lookAhead.x, lookAhead.y, lookAhead.z);
    } else if (cameraMode === 'intercept') {
      const back = new THREE.Vector3(
        droneSwarmCenter.x - 10,
        droneSwarmCenter.y + 14,
        droneSwarmCenter.z + 22
      );
      camera.position.lerp(back, dt * 0.7);
      camera.lookAt(droneSwarmCenter.x, droneSwarmCenter.y, droneSwarmCenter.z);
    }
  }

  /* ════════════════════════════════════
     ANIMATE LOOP
  ════════════════════════════════════ */
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    missionTime += dt;

    updateRadar(dt);
    updateDrones(dt);
    updateRocket(dt);
    updateParticles(dt);
    updateCamera(dt);

    renderer.render(scene, camera);
  }

  /* ════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════ */
  function startApproach() {
    simState = 'approach';
    cameraMode = 'swarm-zoom'; // show distant swarm first
    buildRadarScan();

    drones.forEach(d => {
      d._vel.set(
        (Math.random() - 0.5) * 0.015 - 0.006,
        0,
        (Math.random() - 0.5) * 0.015 + 0.012
      );
    });

    // After 3s zoomed on swarm, pull back and trigger alert
    setTimeout(() => {
      cameraMode = 'launch';
      if (onAlertCb) onAlertCb();
    }, 3200);
  }

  function launchRocket(mode) {
    killMode = mode;
    simState = 'launch';
    buildRocket();
    rocketGroup.visible = true;
    rocketFired = false;
    rocketPos.copy(launchOrigin);
    rocketGroup.position.copy(rocketPos);

    cameraMode = 'launch';

    setTimeout(() => {
      if (engineFlame) { engineFlame.visible = true; engineFlame2.visible = true; }
      const flameOuter = rocketGroup.getObjectByName('flameOuter');
      if (flameOuter) flameOuter.visible = true;
      if (engineLight) { engineLight.visible = true; }

      const toSwarm = droneSwarmCenter.clone().sub(launchOrigin).normalize();
      const launchDir = new THREE.Vector3(toSwarm.x, 0.55, toSwarm.z).normalize();
      rocketVel.copy(launchDir.multiplyScalar(6));
      rocketFired = true;
      simState = 'flight';
      cameraMode = 'flight';
      if (onRocketLaunchCb) onRocketLaunchCb();
    }, 700);
  }

  function getTrajectoryPoints() { return trajectoryPoints; }
  function getRocketPos() { return rocketPos; }
  function getSwarmCenter() { return droneSwarmCenter; }
  function getSimState() { return simState; }
  function getMissionTime() { return missionTime; }

  function resetSim() {
    drones.forEach(d => scene.remove(d));
    drones = [];
    trailParticles.forEach(p => scene.remove(p));
    trailParticles = [];
    explosionParticles.forEach(item => { if (item.isLight) scene.remove(item.light); else scene.remove(item); });
    explosionParticles = [];
    fiberParticles.forEach(item => { if (item.isLight) scene.remove(item.light); else scene.remove(item); });
    fiberParticles = [];
    if (rocketGroup) { scene.remove(rocketGroup); rocketGroup = null; }
    if (radarScanRing) { scene.remove(radarScanRing); radarScanRing = null; }

    simState = 'idle';
    killMode = null;
    missionTime = 0;
    rocketFired = false;
    interceptDone = false;
    trajectoryPoints = [];
    rocketPos.set(0, 0, 0);
    rocketVel.set(0, 0, 0);
    controlFinAngle = 0;
    cameraMode = 'orbit';
    cameraTimer = 0;

    buildDroneSwarm();
  }

  function onAlert(cb) { onAlertCb = cb; }
  function onRocketLaunch(cb) { onRocketLaunchCb = cb; }
  function onIntercept(cb) { onInterceptCb = cb; }
  function onDone(cb) { onDoneCb = cb; }

  return {
    init, startApproach, launchRocket, resetSim,
    getTrajectoryPoints, getRocketPos, getSwarmCenter,
    getSimState, getMissionTime,
    onAlert, onRocketLaunch, onIntercept, onDone
  };
})();
