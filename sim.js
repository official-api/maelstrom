/* ═══════════════════════════════════════════
   MAELSTROM — THREE.JS 3D SIMULATION ENGINE
   ═══════════════════════════════════════════ */

const SIM = (() => {
  let renderer, scene, camera, clock;
  let ground, skyDome;
  let rocketMesh, rocketGroup;
  let drones = [];
  let trees = [];
  let launchPod;
  let radarDish;
  let particles = [];
  let explosionParticles = [];
  let fiberParticles = [];

  // State
  let simState = 'idle'; // idle, approach, launch, flight, intercept, done
  let killMode = null;
  let missionTime = 0;
  let rocketPos = new THREE.Vector3();
  let rocketTarget = new THREE.Vector3();
  let rocketVel = new THREE.Vector3();
  let droneSwarmCenter = new THREE.Vector3();
  let trajectoryPoints = [];
  let launchOrigin = new THREE.Vector3();
  let controlFinAngle = 0;
  let engineFlame;
  let engineLight;
  let rocketFired = false;
  let interceptDone = false;
  let finRotDir = 1;

  // Callbacks
  let onAlertCb = null;
  let onRocketLaunchCb = null;
  let onInterceptCb = null;
  let onDoneCb = null;

  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight - 24;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a2a1a, 60, 300);

    clock = new THREE.Clock();

    // Camera — cinematic third-person
    camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
    camera.position.set(-12, 6, 18);
    camera.lookAt(0, 2, 0);

    buildLighting();
    buildSky();
    buildGround();
    buildTrees();
    buildLaunchPod();
    buildDroneSwarm();

    // Handle resize
    window.addEventListener('resize', onResize);

    animate();
  }

  function onResize() {
    const canvas = renderer.domElement;
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight - 24;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  /* ─────────────── LIGHTING ─────────────── */
  function buildLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x334455, 0.6);
    scene.add(ambient);

    // Sun — warm late-afternoon
    const sun = new THREE.DirectionalLight(0xffd0a0, 1.8);
    sun.position.set(40, 60, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    // Fill from opposite
    const fill = new THREE.DirectionalLight(0x6688aa, 0.4);
    fill.position.set(-20, 10, 30);
    scene.add(fill);

    // Hemi for sky/ground colour
    const hemi = new THREE.HemisphereLight(0x5577aa, 0x334422, 0.5);
    scene.add(hemi);
  }

  /* ─────────────── SKY ─────────────── */
  function buildSky() {
    // Gradient sky sphere
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1a3a6a) },
        botColor: { value: new THREE.Color(0x6a9080) },
        offset: { value: 20 },
        exponent: { value: 0.4 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 botColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + offset).y;
          gl_FragColor = vec4(mix(botColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Distant haze
    const hazeGeo = new THREE.PlaneGeometry(800, 800);
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0x88aa88, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    const haze = new THREE.Mesh(hazeGeo, hazeMat);
    haze.rotation.x = -Math.PI / 2;
    haze.position.y = 0.1;
    scene.add(haze);
  }

  /* ─────────────── GROUND ─────────────── */
  function buildGround() {
    // Base grass
    const groundGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
    // Perturb vertices for realistic terrain
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const noise = Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.4
                  + Math.sin(x * 0.7 + 1.2) * Math.cos(z * 0.6 - 0.8) * 0.2;
      pos.setY(i, noise);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a6235 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Dirt patches
    for (let i = 0; i < 8; i++) {
      const patchGeo = new THREE.CircleGeometry(2 + Math.random() * 3, 8);
      const patchMat = new THREE.MeshLambertMaterial({ color: 0x5a4a2a });
      const patch = new THREE.Mesh(patchGeo, patchMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((Math.random() - 0.5) * 60, 0.01, (Math.random() - 0.5) * 60);
      scene.add(patch);
    }
  }

  /* ─────────────── TREES ─────────────── */
  function buildTrees() {
    const treePositions = [
      [-25, 0, -15], [-30, 0, 5], [-20, 0, 20],
      [22, 0, -18], [28, 0, -5], [18, 0, 12],
      [-15, 0, -30], [10, 0, -25], [35, 0, 15]
    ];

    treePositions.forEach(([x, y, z]) => {
      const tree = buildTree(x, y, z);
      trees.push(tree);
      scene.add(tree);
    });
  }

  function buildTree(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const h = 5 + Math.random() * 4;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, h * 0.4, 7), trunkMat);
    trunk.position.y = h * 0.2;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage layers
    const leafCol = new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.6, 0.2 + Math.random() * 0.1);
    const leafMat = new THREE.MeshLambertMaterial({ color: leafCol });
    for (let i = 0; i < 3; i++) {
      const r = (3 - i) * 1.8 + Math.random() * 0.5;
      const lh = h * 0.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, lh * 0.5, 8), leafMat);
      cone.position.y = h * 0.35 + i * lh * 0.3;
      cone.rotation.y = Math.random() * Math.PI;
      cone.castShadow = true;
      group.add(cone);
    }
    return group;
  }

  /* ─────────────── LAUNCH POD ─────────────── */
  function buildLaunchPod() {
    launchPod = new THREE.Group();
    launchPod.position.set(-8, 0, 8);
    scene.add(launchPod);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a4040, roughness: 0.7, metalness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.6, metalness: 0.4 });

    // Base tripod legs
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2, 6), metalMat);
      leg.position.set(Math.cos(angle) * 0.7, 1, Math.sin(angle) * 0.7);
      leg.rotation.z = Math.sin(angle) * 0.35;
      leg.rotation.x = Math.cos(angle) * 0.35;
      leg.castShadow = true;
      launchPod.add(leg);
    }

    // Pod body — elevated launcher
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), metalMat);
    body.position.y = 2;
    body.castShadow = true;
    launchPod.add(body);

    // Tube — angled launcher barrel
    const tubeAngle = Math.PI / 6; // 30° elevation
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 12, 1, true), darkMat);
    tube.rotation.z = tubeAngle;
    tube.position.set(0, 2.4, 0);
    tube.castShadow = true;
    launchPod.add(tube);

    // Radar dish
    const dishGeo = new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x556066, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
    radarDish = new THREE.Mesh(dishGeo, dishMat);
    radarDish.position.set(0.8, 2.5, 0);
    radarDish.rotation.z = -Math.PI / 4;
    launchPod.add(radarDish);

    // Radar arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), metalMat);
    arm.position.set(0.4, 2.3, 0);
    arm.rotation.z = Math.PI / 4;
    launchPod.add(arm);

    // Radar scan ring
    const ringGeo = new THREE.TorusGeometry(0.05, 0.01, 6, 12);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0.8, 2.5, 0);
    launchPod.add(ring);

    // Store launch origin from tube tip
    launchOrigin.set(-8 + Math.sin(tubeAngle) * 1.1, 2.4 + Math.cos(tubeAngle) * 1.1, 8);
  }

  /* ─────────────── ROCKET MESH ─────────────── */
  function buildRocket() {
    rocketGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.3, metalness: 0.7 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x303840, roughness: 0.5, metalness: 0.8 });
    const finMat = new THREE.MeshStandardMaterial({ color: 0x556070, roughness: 0.4, metalness: 0.6 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.2, metalness: 0.8 });

    // ── NOSE CONE (hemisphere + short fairing)
    const noseSphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), noseMat);
    noseSphere.position.y = 0.84;
    noseSphere.rotation.x = Math.PI / 2;
    rocketGroup.add(noseSphere);

    // ── BODY (forward section ~540mm → 0.54 units)
    const bodyCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.54, 16), bodyMat);
    bodyCyl.position.y = 0.57; // center of body section
    rocketGroup.add(bodyCyl);

    // ── ENGINE SECTION (aft 300mm)
    const engCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.30, 16), engineMat);
    engCyl.position.y = 0.15;
    rocketGroup.add(engCyl);

    // Nozzle bell
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.06, 12), engineMat);
    nozzle.position.y = -0.03;
    rocketGroup.add(nozzle);

    // ── FIXED FINS (4x clipped delta) at y~0.28 (forward of engine)
    const fixedFinGroup = new THREE.Group();
    fixedFinGroup.position.y = 0.28;
    for (let i = 0; i < 4; i++) {
      const fin = makeFixedFin(finMat);
      fin.rotation.y = (i / 4) * Math.PI * 2;
      fixedFinGroup.add(fin);
    }
    rocketGroup.add(fixedFinGroup);

    // ── CONTROL FINS (4x rectangular, all-moving) at y~0.06 (aft)
    const ctrlFinGroups = [];
    for (let i = 0; i < 4; i++) {
      const cfGrp = new THREE.Group();
      cfGrp.position.y = 0.08;
      cfGrp.rotation.y = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = makeCtrlFin(finMat);
      cfGrp.add(fin);
      rocketGroup.add(cfGrp);
      ctrlFinGroups.push(cfGrp);
    }
    rocketGroup._ctrlFins = ctrlFinGroups;

    // Engine glow
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.85 });
    engineFlame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 8), flameMat);
    engineFlame.position.y = -0.125;
    engineFlame.rotation.x = Math.PI;
    engineFlame.visible = false;
    rocketGroup.add(engineFlame);

    engineLight = new THREE.PointLight(0xff6600, 3, 4);
    engineLight.position.y = -0.2;
    engineLight.visible = false;
    rocketGroup.add(engineLight);

    // Scale up: 1 unit = 1m, rocket is 0.84m — scale by ~8 for visibility
    rocketGroup.scale.setScalar(8);

    // Orient rocket pointing along +Z initially (we'll point it at target)
    rocketPos.copy(launchOrigin);
    rocketGroup.position.copy(rocketPos);
    scene.add(rocketGroup);
    rocketGroup.visible = false;

    return ctrlFinGroups;
  }

  function makeFixedFin(mat) {
    // Clipped delta fin — hand-built quad
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.18, -0.12);
    shape.lineTo(0.18, -0.03);
    shape.lineTo(0.06, 0.06);
    shape.lineTo(0, 0);

    const extSettings = { depth: 0.008, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extSettings);
    const fin = new THREE.Mesh(geo, mat);
    fin.position.set(0.09, 0, 0);
    fin.rotation.y = Math.PI / 2;
    return fin;
  }

  function makeCtrlFin(mat) {
    // Rectangular control fin
    const geo = new THREE.BoxGeometry(0.16, 0.07, 0.008);
    const fin = new THREE.Mesh(geo, mat);
    fin.position.set(0.17, 0, 0);
    return fin;
  }

  /* ─────────────── DRONE SWARM ─────────────── */
  function buildDroneSwarm() {
    const swarmCenter = new THREE.Vector3(18, 8, -10);
    droneSwarmCenter.copy(swarmCenter);

    const dronePositions = [
      [0, 0, 0], [3, 1, -1], [-2.5, 1.5, 1.5], [1, -1.5, 2.5], [-1, 2, -2],
      [4, -0.5, 2], [-3, -1, -2], [2, 2.5, -2.5], [-1.5, -2, 2], [2.5, 1, 1]
    ];

    dronePositions.forEach(([dx, dy, dz]) => {
      const drone = buildDrone();
      drone.position.set(
        swarmCenter.x + dx,
        swarmCenter.y + dy,
        swarmCenter.z + dz
      );
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

  function buildDrone() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.3 });
    const armMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.2 });
    const propMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), bodyMat);
    group.add(body);

    // Arms + motors
    const armDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    armDirs.forEach(([ax, az]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), armMat);
      arm.position.set(ax * 0.25, 0, az * 0.25);
      arm.rotation.y = az !== 0 ? Math.PI / 2 : 0;
      group.add(arm);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), armMat);
      motor.position.set(ax * 0.45, 0.05, az * 0.45);
      group.add(motor);

      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 8), propMat);
      prop.position.set(ax * 0.45, 0.09, az * 0.45);
      group.add(prop);
    });

    // Camera turret
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bodyMat);
    cam.position.set(0, -0.08, 0.1);
    group.add(cam);

    group.scale.setScalar(0.8 + Math.random() * 0.4);
    return group;
  }

  /* ─────────────── RADAR SCAN VFX ─────────────── */
  let radarScanAngle = 0;
  let radarScanRing;
  function buildRadarScan() {
    const geo = new THREE.RingGeometry(0, 25, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff88, transparent: true, opacity: 0.07,
      side: THREE.DoubleSide
    });
    radarScanRing = new THREE.Mesh(geo, mat);
    radarScanRing.rotation.x = -Math.PI / 2;
    radarScanRing.position.set(-8, 0.05, 8);
    radarScanRing.visible = false;
    scene.add(radarScanRing);
  }

  /* ─────────────── EXHAUST TRAIL ─────────────── */
  let trailParticles = [];
  function spawnTrail() {
    if (!rocketFired) return;
    const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 0.5 + Math.random() * 0.3, 0),
      transparent: true,
      opacity: 0.8
    });
    const p = new THREE.Mesh(geo, mat);
    const backDir = rocketPos.clone().sub(
      rocketPos.clone().add(new THREE.Vector3(0, 0, 0.1))
    ).normalize();
    p.position.copy(rocketPos).addScaledVector(rocketVel.clone().normalize(), -0.5);
    p.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
    p._life = 1;
    p._vel = rocketVel.clone().normalize().multiplyScalar(-0.1).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.02, (Math.random() - 0.5) * 0.05)
    );
    scene.add(p);
    trailParticles.push(p);
  }

  /* ─────────────── INTERCEPT EFFECTS ─────────────── */
  function spawnHardKillExplosion(center) {
    const count = 200;
    for (let i = 0; i < count; i++) {
      const size = 0.05 + Math.random() * 0.15;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const heat = Math.random();
      const col = new THREE.Color(1, heat * 0.6, 0);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ));
      const speed = 2 + Math.random() * 8;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      p._vel = dir.multiplyScalar(speed * 0.016);
      p._life = 1;
      p._type = 'frag';
      scene.add(p);
      explosionParticles.push(p);
    }

    // Flash light
    const flash = new THREE.PointLight(0xff8800, 20, 30);
    flash.position.copy(center);
    flash._life = 1;
    flash._type = 'flash';
    scene.add(flash);
    explosionParticles.push({ isLight: true, light: flash, _life: 1 });
  }

  function spawnSoftKillFibers(center) {
    const count = 300;
    for (let i = 0; i < count; i++) {
      const points = [];
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      points.push(center.clone());
      points.push(center.clone().addScaledVector(dir, 1 + Math.random() * 3));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(geo, mat);
      line._vel = dir.clone().multiplyScalar((0.5 + Math.random() * 2) * 0.016);
      line._life = 1;
      scene.add(line);
      fiberParticles.push(line);
    }

    // Soft blue flash
    const flash = new THREE.PointLight(0x00aaff, 8, 20);
    flash.position.copy(center);
    fiberParticles.push({ isLight: true, light: flash, _life: 1 });
    scene.add(flash);
  }

  /* ─────────────── CAMERA ANIMATION ─────────────── */
  let cameraPhase = 0;
  let cameraTimer = 0;

  function updateCamera(dt) {
    cameraTimer += dt;

    if (simState === 'idle' || simState === 'approach') {
      // Slow orbit
      const t = cameraTimer * 0.05;
      camera.position.x = Math.cos(t) * 20;
      camera.position.z = Math.sin(t) * 20 + 5;
      camera.position.y = 7 + Math.sin(t * 1.3) * 1.5;
      camera.lookAt(0, 3, 0);
    } else if (simState === 'launch') {
      // Look at launch pod
      camera.position.lerp(new THREE.Vector3(-14, 5, 14), dt * 1.2);
      camera.lookAt(launchPod.position.x, 3, launchPod.position.z);
    } else if (simState === 'flight') {
      // Track missile in flight
      const behind = rocketVel.clone().normalize().multiplyScalar(-12);
      const target = rocketPos.clone().add(behind).add(new THREE.Vector3(0, 4, 0));
      camera.position.lerp(target, dt * 2.5);
      camera.lookAt(rocketPos.x, rocketPos.y, rocketPos.z);
    } else if (simState === 'intercept' || simState === 'done') {
      // Pull back to show explosion
      const back = new THREE.Vector3(-5, 12, 20);
      camera.position.lerp(back, dt * 0.8);
      camera.lookAt(droneSwarmCenter.x, droneSwarmCenter.y, droneSwarmCenter.z);
    }
  }

  /* ─────────────── MAIN ANIMATE LOOP ─────────────── */
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

  function updateRadar(dt) {
    if (!radarDish) return;
    radarDish.rotation.z += dt * 1.2;

    if (simState === 'approach' || simState === 'idle') {
      if (!radarScanRing) buildRadarScan();
      if (radarScanRing) {
        radarScanRing.visible = simState === 'approach';
        radarScanAngle += dt * 1.5;
        radarScanRing.rotation.z = radarScanAngle;
      }
    }
  }

  function updateDrones(dt) {
    drones.forEach((drone, i) => {
      if (!drone._alive) {
        if (drone._fallVel !== undefined) {
          drone._fallVel += dt * 9.8;
          drone.position.y -= drone._fallVel * dt;
          drone.rotation.x += dt * (0.5 + i * 0.2);
          drone.rotation.z += dt * (0.3 + i * 0.15);
          if (drone.position.y < -1) drone.visible = false;
        }
        return;
      }

      // Drift slowly towards launch pod in approach phase
      if (simState === 'approach' || simState === 'launch') {
        const towardPod = new THREE.Vector3(-8, 0, 8).sub(drone.position).normalize().multiplyScalar(0.005);
        drone._vel.add(towardPod);
        drone._vel.clampLength(0, 0.02);
      }

      drone.position.add(drone._vel);
      // Bob
      drone.position.y = drone._basePos.y + Math.sin(missionTime * 1.2 + i) * 0.15;
      // Slow rotation
      drone.rotation.y += dt * 0.3;
      drone.children.forEach(c => {
        if (c.geometry && c.geometry.type === 'CylinderGeometry') {
          c.rotation.y += dt * 5;
        }
      });
    });
  }

  function updateRocket(dt) {
    if (!rocketFired || !rocketGroup) return;
    if (interceptDone) return;

    const speed = rocketVel.length();

    // Steer toward target
    const toTarget = droneSwarmCenter.clone().sub(rocketPos).normalize();
    const currentDir = rocketVel.clone().normalize();
    const steerForce = toTarget.sub(currentDir).multiplyScalar(0.12);
    rocketVel.add(steerForce);

    // Accelerate
    const maxSpeed = 22;
    if (speed < maxSpeed) {
      rocketVel.normalize().multiplyScalar(speed + 8 * dt);
    }
    rocketVel.clampLength(0, maxSpeed);

    rocketPos.add(rocketVel.clone().multiplyScalar(dt));
    rocketGroup.position.copy(rocketPos);

    // Orient rocket along velocity
    const dir = rocketVel.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rocketGroup.quaternion.slerp(quaternion, dt * 8);

    // Control fin waggle
    controlFinAngle += dt * finRotDir * 1.5;
    if (Math.abs(controlFinAngle) > 0.3) finRotDir *= -1;
    if (rocketGroup._ctrlFins) {
      rocketGroup._ctrlFins.forEach((fg, i) => {
        fg.children[0].rotation.z = controlFinAngle * (i % 2 === 0 ? 1 : -1) * 0.4;
      });
    }

    // Engine flame flicker
    if (engineFlame) {
      const flicker = 0.85 + Math.random() * 0.3;
      engineFlame.scale.setScalar(flicker);
      engineLight.intensity = 3 * flicker;
    }

    // Trail
    if (Math.random() < 0.7) spawnTrail();

    // Track trajectory
    trajectoryPoints.push(rocketPos.clone());

    // Check intercept distance
    const dist = rocketPos.distanceTo(droneSwarmCenter);
    if (dist < 2.5) {
      triggerIntercept();
    }
  }

  function triggerIntercept() {
    interceptDone = true;
    simState = 'intercept';
    rocketGroup.visible = false;
    if (engineFlame) engineFlame.visible = false;
    if (engineLight) engineLight.visible = false;

    const center = droneSwarmCenter.clone();
    if (killMode === 'hard') {
      spawnHardKillExplosion(center);
      // Kill all drones
      setTimeout(() => {
        drones.forEach(d => { d._alive = false; d._fallVel = 0; });
      }, 300);
    } else {
      spawnSoftKillFibers(center);
      // Drones drop after brief delay
      setTimeout(() => {
        drones.forEach(d => { d._alive = false; d._fallVel = 0; });
      }, 800);
    }

    if (onInterceptCb) onInterceptCb(killMode);

    setTimeout(() => {
      simState = 'done';
      if (onDoneCb) onDoneCb();
    }, 3500);
  }

  function updateParticles(dt) {
    // Trail
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const p = trailParticles[i];
      p._life -= dt * 1.5;
      p.position.add(p._vel);
      p.material.opacity = Math.max(0, p._life * 0.8);
      p.scale.setScalar(p._life * 0.8 + 0.2);
      if (p._life <= 0) { scene.remove(p); trailParticles.splice(i, 1); }
    }

    // Explosion fragments
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const item = explosionParticles[i];
      if (item.isLight) {
        item._life -= dt * 1.5;
        item.light.intensity = Math.max(0, item._life * 20);
        if (item._life <= 0) { scene.remove(item.light); explosionParticles.splice(i, 1); }
      } else {
        const p = item;
        p._life -= dt * 0.8;
        p.position.add(p._vel);
        p._vel.y -= dt * 0.1;
        p.material.opacity = Math.max(0, p._life);
        if (p._life <= 0) { scene.remove(p); explosionParticles.splice(i, 1); }
      }
    }

    // Fibers
    for (let i = fiberParticles.length - 1; i >= 0; i--) {
      const item = fiberParticles[i];
      if (item.isLight) {
        item._life -= dt * 1.0;
        item.light.intensity = Math.max(0, item._life * 8);
        if (item._life <= 0) { scene.remove(item.light); fiberParticles.splice(i, 1); }
      } else {
        item._life -= dt * 0.4;
        item.position.add(item._vel);
        item._vel.y -= dt * 0.05;
        item.material.opacity = Math.max(0, item._life * 0.8);
        if (item._life <= 0) { scene.remove(item); fiberParticles.splice(i, 1); }
      }
    }
  }

  /* ─────────────── PUBLIC API ─────────────── */
  function startApproach() {
    simState = 'approach';
    buildRadarScan();
    // Move drones slowly
    drones.forEach(d => {
      d._vel.set(
        (Math.random() - 0.5) * 0.01 - 0.005,
        0,
        (Math.random() - 0.5) * 0.01 + 0.01
      );
    });
    // Alert after 2.5s
    setTimeout(() => {
      if (onAlertCb) onAlertCb();
    }, 2500);
  }

  function launchRocket(mode) {
    killMode = mode;
    simState = 'launch';
    buildRocket();

    rocketGroup.visible = true;
    rocketFired = false;
    rocketPos.copy(launchOrigin);
    rocketGroup.position.copy(rocketPos);

    // Ignition delay
    setTimeout(() => {
      if (engineFlame) engineFlame.visible = true;
      if (engineLight) engineLight.visible = true;

      // Launch direction — up and toward swarm
      const toSwarm = droneSwarmCenter.clone().sub(launchOrigin).normalize();
      const launchDir = new THREE.Vector3(toSwarm.x, 0.5, toSwarm.z).normalize();
      rocketVel.copy(launchDir.multiplyScalar(4));
      rocketFired = true;
      simState = 'flight';
      if (onRocketLaunchCb) onRocketLaunchCb();
    }, 600);
  }

  function getTrajectoryPoints() { return trajectoryPoints; }
  function getRocketPos() { return rocketPos; }
  function getSwarmCenter() { return droneSwarmCenter; }
  function getSimState() { return simState; }
  function getMissionTime() { return missionTime; }

  function resetSim() {
    // Remove existing drones and particles
    drones.forEach(d => scene.remove(d));
    drones = [];
    trailParticles.forEach(p => scene.remove(p));
    trailParticles = [];
    explosionParticles.forEach(p => { if (p.isLight) scene.remove(p.light); else scene.remove(p); });
    explosionParticles = [];
    fiberParticles.forEach(p => { if (p.isLight) scene.remove(p.light); else scene.remove(p); });
    fiberParticles = [];
    if (rocketGroup) { scene.remove(rocketGroup); rocketGroup = null; }
    if (radarScanRing) { scene.remove(radarScanRing); radarScanRing = null; }

    // Reset state
    simState = 'idle';
    killMode = null;
    missionTime = 0;
    rocketFired = false;
    interceptDone = false;
    trajectoryPoints = [];
    rocketPos.set(0, 0, 0);
    rocketVel.set(0, 0, 0);
    controlFinAngle = 0;

    buildDroneSwarm();
    cameraTimer = 0;
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
