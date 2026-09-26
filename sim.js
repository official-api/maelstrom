/* ═══════════════════════════════════════
   MAELSTROM - THREE.JS 3D SIMULATION ENGINE v2
   Photorealistic terrain, detailed rocket, improved guidance
   ═══════════════════════════════════════ */

const SIM = (() => {
  let renderer, scene, camera, clock;
  let ground, skyDome;
  let rocketGroup = null;
  let drones = [];
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
  let launchDir = new THREE.Vector3(0, 1, 0); // world-space direction the launch tube (and loaded rocket) points
  // Swarm manoeuvre: forward -> strafe right -> forward again, flat altitude.
  let dronePhase = 0;
  const DRONE_STRAFE_START = 0.35; // fraction of totalFlightDistance where strafe begins
  const DRONE_STRAFE_END   = 0.60; // fraction where strafe ends and forward resumes
  // Initial forward direction
  const _swarmFwd   = new THREE.Vector3(-158, 0, 138).normalize();
  // Right-hand perpendicular of _swarmFwd in XZ plane
  const _swarmRight = new THREE.Vector3(_swarmFwd.z, 0, -_swarmFwd.x);
  const DRONE_START_ALT = 78;   // fixed altitude — swarm flies flat
  let engineFlame, engineFlame2, engineLight;
  let rocketFired = false;
  let interceptDone = false;
  let rocketPaused = false;

  const STAGE_FRACTIONS = [0.25, 0.5, 0.75];
  let totalFlightDistance = 0;
  let distanceTraveled = 0;
  let nextCheckpointIdx = 0;
  let onStageCb = null;
  let radarScanAngle = 0;
  let cameraTimer = 0;
  let sunLight;

  // Callbacks
  let onAlertCb = null;
  let onRocketLaunchCb = null;
  let onInterceptCb = null;
  let onDoneCb = null;
  let onLoadProgressCb = null;
  let onAssetsReadyCb = null;

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
    scene.fog = new THREE.FogExp2(0xcdbd9c, 0.0021);

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(52, W / H, 0.05, 2000);
    camera.position.set(-14, 7, 20);
    camera.lookAt(0, 2, 0);

    THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      if (onLoadProgressCb) onLoadProgressCb(itemsLoaded, itemsTotal);
    };
    THREE.DefaultLoadingManager.onLoad = () => {
      if (onAssetsReadyCb) onAssetsReadyCb();
    };
    THREE.DefaultLoadingManager.onError = (url) => {
      console.warn('[MAELSTROM] Asset failed to load:', url);
    };

    buildLighting();
    buildSky();
    buildGround();
    buildMountains();
    buildDroneSwarm();   // must exist first so the launch pod can be oriented to face it
    buildLaunchPod();
    buildRocket();       // rocket is loaded in the tube and visible from the very start

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
    const ambient = new THREE.AmbientLight(0x554a3c, 0.3);
    scene.add(ambient);

    sunLight = new THREE.DirectionalLight(0xfff2d8, 2.4);
    sunLight.position.set(70, 95, -20);
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

    const fillLight = new THREE.DirectionalLight(0xaecbdc, 0.45);
    fillLight.position.set(-30, 20, 40);
    scene.add(fillLight);

    const hemi = new THREE.HemisphereLight(0x9fc4dd, 0x8a6a45, 0.55);
    scene.add(hemi);

    const bounce = new THREE.DirectionalLight(0xcaa877, 0.35);
    bounce.position.set(0, -10, 0);
    scene.add(bounce);
  }

  /* ════════════════════════════════════
     SKY
  ════════════════════════════════════ */
  const SKY_HDRI_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/goegap.jpg';

  function buildSky() {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      SKY_HDRI_URL,
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.encoding = THREE.sRGBEncoding;
        scene.background = tex;
        scene.environment = tex;
      },
      undefined,
      (err) => {
        console.warn('[MAELSTROM] Sky HDRI failed to load — using procedural fallback sky.', err);
        buildProceduralSkyFallback();
      }
    );
  }

  function buildProceduralSkyFallback() {
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
          float sun = max(0.0, dot(normalize(vWorldDir), sunDir));
          float disc = pow(sun, 180.0);
          float halo = pow(sun, 8.0) * 0.4;
          sky += sunColor * disc * 3.0 + sunColor * halo;
          float horiz = exp(-abs(h) * 6.0);
          sky = mix(sky, vec3(0.7, 0.85, 0.9), horiz * 0.25);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide
    });
    skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);
  }

  /* ════════════════════════════════════
     GROUND - procedural terrain
  ════════════════════════════════════ */
  const GROUND_TEX_BASE = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sandy_gravel_02/sandy_gravel_02_';
  const ROCK_TEX_BASE   = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_face_03/rock_face_03_';

  function loadRepeatingTexture(loader, url, repeatX, repeatY, isColorMap) {
    const tex = loader.load(url, undefined, undefined, () => {
      console.warn('[MAELSTROM] texture failed to load:', url);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (isColorMap) tex.encoding = THREE.sRGBEncoding;
    if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function buildGround() {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const GROUND_SIZE = 700;
    const REPEAT = 30 * (GROUND_SIZE / 400);

    const diffuseMap  = loadRepeatingTexture(loader, GROUND_TEX_BASE + 'diff_2k.jpg', REPEAT, REPEAT, true);
    const normalMap   = loadRepeatingTexture(loader, GROUND_TEX_BASE + 'nor_gl_2k.jpg', REPEAT, REPEAT, false);
    const roughMap    = loadRepeatingTexture(loader, GROUND_TEX_BASE + 'rough_2k.jpg', REPEAT, REPEAT, false);
    const aoMap       = loadRepeatingTexture(loader, GROUND_TEX_BASE + 'ao_2k.jpg', REPEAT, REPEAT, false);
    const dispMap     = loadRepeatingTexture(loader, GROUND_TEX_BASE + 'disp_2k.jpg', REPEAT, REPEAT, false);

    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 160, 160);
    const pos = groundGeo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = fbm(x * 0.04, y * 0.04, 4) * 2.5;
      pos.setZ(i, h);
    }
    groundGeo.computeVertexNormals();
    groundGeo.setAttribute('uv2', new THREE.BufferAttribute(groundGeo.attributes.uv.array.slice(), 2));

    const groundMat = new THREE.MeshStandardMaterial({
      map: diffuseMap,
      normalMap: normalMap,
      roughnessMap: roughMap,
      aoMap: aoMap,
      displacementMap: dispMap,
      displacementScale: 0.3,
      displacementBias: -0.12,
      roughness: 1.0,
      metalness: 0.0,
    });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const patchMat = new THREE.MeshStandardMaterial({ color: 0x352a1f, roughness: 1.0 });
    [[-8, 8, 3.5], [-10, 6, 2], [-6, 11, 1.5]].forEach(([px, pz, pr]) => {
      const pg = new THREE.Mesh(new THREE.CircleGeometry(pr, 16), patchMat);
      pg.rotation.x = -Math.PI / 2;
      pg.position.set(px, 0.02, pz);
      scene.add(pg);
    });
  }

  /* ════════════════════════════════════
     DISTANT MOUNTAINS
  ════════════════════════════════════ */
  function buildMountains() {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    const diffuseMap = loadRepeatingTexture(loader, ROCK_TEX_BASE + 'diff_2k.jpg', 18, 3, true);
    const normalMap  = loadRepeatingTexture(loader, ROCK_TEX_BASE + 'nor_gl_2k.jpg', 18, 3, false);
    const roughMap   = loadRepeatingTexture(loader, ROCK_TEX_BASE + 'rough_2k.jpg', 18, 3, false);

    const MOUNTAIN_RADIUS = 300;
    const height = 95;
    const geo = new THREE.CylinderGeometry(MOUNTAIN_RADIUS, MOUNTAIN_RADIUS * 1.04, height, 128, 10, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const angle = Math.atan2(z, x);
      const ridge = fbm(Math.cos(angle) * 3 + 40, Math.sin(angle) * 3 + 40, 5);
      const heightRatio = (y + height / 2) / height;
      const profile = 0.22 + Math.pow(ridge, 1.3) * 0.85;
      pos.setY(i, -height / 2 + heightRatio * height * profile);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: diffuseMap,
      normalMap: normalMap,
      roughnessMap: roughMap,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      fog: true,
    });
    const mountains = new THREE.Mesh(geo, mat);
    mountains.position.y = height / 2 - 3;
    scene.add(mountains);
  }

  /* ════════════════════════════════════
     LAUNCH POD - Tripod launcher station with launch tubes & tripod-mounted radar
  ════════════════════════════════════ */
  function buildLaunchPod() {
    launchPod = new THREE.Group();
    const podBasePos = new THREE.Vector3(-8, 0, 8);
    launchPod.position.copy(podBasePos);
    scene.add(launchPod);

    const yBase = fbm(-8 * 0.04, 8 * 0.04, 5) * 3.0 - fbm(-8 * 0.1 + 5, 8 * 0.1 + 5, 3) * 0.6;

    // Rocket longitudinal reference points:
    const ROCKET_TAIL_Y = -6.05;
    const ROCKET_MUZZLE_Y = -0.35;
    const TUBE_LEN = ROCKET_MUZZLE_Y - ROCKET_TAIL_Y;
    const TUBE_OUTER_R = 0.62;
    const TUBE_INNER_R = 0.52;
    const ELEV_ANGLE = Math.PI / 6.5;

    // Materials
    const hullMat    = new THREE.MeshStandardMaterial({ color: 0x4a5446, roughness: 0.55, metalness: 0.5 });
    const darkMat    = new THREE.MeshStandardMaterial({ color: 0x222725, roughness: 0.5, metalness: 0.7 });
    const chromeMat  = new THREE.MeshStandardMaterial({ color: 0x8899a6, roughness: 0.25, metalness: 0.85 });
    const blackMat   = new THREE.MeshStandardMaterial({ color: 0x121517, roughness: 0.4, metalness: 0.8 });
    const hazardMat  = new THREE.MeshStandardMaterial({ color: 0xc7a423, roughness: 0.5, metalness: 0.3 });
    const boreMat    = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.3, metalness: 0.9, side: THREE.BackSide });
    const dishMat    = new THREE.MeshStandardMaterial({ color: 0x5a6560, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
    const radomeMat  = new THREE.MeshStandardMaterial({ color: 0x333b38, roughness: 0.3, metalness: 0.8 });

    /* ── TRIPOD BASE ASSEMBLY ── */
    const tripodCenterY = yBase + 0.85;

    // Central structural hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.85, 16), darkMat);
    hub.position.y = tripodCenterY - 0.2;
    hub.castShadow = true; hub.receiveShadow = true;
    launchPod.add(hub);

    // Heavy-duty mounting platform plate on tripod hub
    const tripodTopPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.95, 0.12, 24), darkMat);
    tripodTopPlate.position.y = tripodCenterY + 0.18;
    tripodTopPlate.castShadow = true;
    launchPod.add(tripodTopPlate);

    // 3 Heavy-duty Outrigger Tripod Legs spaced 120° apart
    for (let i = 0; i < 3; i++) {
      const legAngle = (i / 3) * Math.PI * 2;
      const legGroup = new THREE.Group();
      legGroup.rotation.y = legAngle;
      legGroup.position.set(0, tripodCenterY - 0.2, 0);

      // Main structural leg beam
      const legLen = 2.2;
      const legBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, legLen), hullMat);
      legBeam.position.set(0, -0.4, legLen / 2);
      legBeam.rotation.x = 0.48; // angled down to terrain
      legBeam.castShadow = true; legBeam.receiveShadow = true;
      legGroup.add(legBeam);

      // Hydraulic bracing strut
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), chromeMat);
      strut.position.set(0, -0.55, 0.65);
      strut.rotation.x = 0.22;
      legGroup.add(strut);

      // Articulated ground footpad
      const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.1, 12), blackMat);
      footPad.position.set(0, -0.85, 1.95);
      footPad.receiveShadow = true; footPad.castShadow = true;
      legGroup.add(footPad);

      // Ground anchor screw / locking pin
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), darkMat);
      screw.position.set(0, -0.7, 1.95);
      legGroup.add(screw);

      launchPod.add(legGroup);
    }

    /* ── Slew Bearing Ring ── */
    const slewRing = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.14, 32), darkMat);
    slewRing.position.y = tripodCenterY + 0.28;
    slewRing.castShadow = true;
    launchPod.add(slewRing);

    /* ── Turret Yaw Group ── */
    const turretYaw = new THREE.Group();
    turretYaw.position.set(0, tripodCenterY + 0.33, 0);
    launchPod.add(turretYaw);

    // Turret swivel base on tripod hub
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.82, 0.28, 24), hullMat);
    turretBase.position.y = 0.14;
    turretBase.castShadow = true; turretBase.receiveShadow = true;
    turretYaw.add(turretBase);

    // Side mounting pillars for elevation trunnions
    [-0.72, 0.72].forEach((tx) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.7), hullMat);
      pillar.position.set(tx, 0.55, 0.3);
      pillar.castShadow = true;
      turretYaw.add(pillar);

      const trunCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 16), darkMat);
      trunCap.rotation.z = Math.PI / 2;
      trunCap.position.set(tx, 0.82, 0.3);
      trunCap.castShadow = true;
      turretYaw.add(trunCap);
    });

    // Central avionics housing box
    const eBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.8), darkMat);
    eBox.position.set(0, 0.4, 0.1);
    eBox.castShadow = true;
    turretYaw.add(eBox);

    // Hazard stripe trim on front
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.82), hazardMat);
    stripe.position.set(0, 0.22, 0.1);
    turretYaw.add(stripe);

    /* ── Elevation Cradle Group ── */
    const elevGroup = new THREE.Group();
    elevGroup.position.set(0, 0.82, 0.3);
    elevGroup.rotation.x = -ELEV_ANGLE;
    turretYaw.add(elevGroup);

    // Cradle frame & longitudinal mounting rails
    [-0.58, 0.58].forEach((cx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, TUBE_LEN + 0.4), darkMat);
      rail.position.set(cx, -0.05, TUBE_LEN / 2);
      rail.castShadow = true;
      elevGroup.add(rail);
    });

    // Twin hydraulic elevation cylinders
    [-0.45, 0.45].forEach((rx) => {
      const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 10), chromeMat);
      ram.position.set(rx, -0.38, 0.15);
      ram.rotation.x = -ELEV_ANGLE * 0.5;
      turretYaw.add(ram);
    });

    // ── Launch Tubes (Canisters) ──
    const tubeXOffsets = [0.34, -0.34];
    tubeXOffsets.forEach((tx, idx) => {
      // Cylindrical Launch Canister
      const outerTube = new THREE.Mesh(
        new THREE.CylinderGeometry(TUBE_OUTER_R, TUBE_OUTER_R * 1.03, TUBE_LEN, 24, 1, false),
        hullMat
      );
      outerTube.rotation.x = Math.PI / 2;
      outerTube.position.set(tx, 0, TUBE_LEN / 2);
      outerTube.castShadow = true;
      elevGroup.add(outerTube);

      // Bore liner
      const bore = new THREE.Mesh(
        new THREE.CylinderGeometry(TUBE_INNER_R, TUBE_INNER_R, TUBE_LEN - 0.06, 20, 1, true),
        boreMat
      );
      bore.rotation.x = Math.PI / 2;
      bore.position.set(tx, 0, TUBE_LEN / 2);
      elevGroup.add(bore);

      // Muzzle collar and breach cap
      const muzzleRim = new THREE.Mesh(new THREE.TorusGeometry(TUBE_OUTER_R * 0.95, 0.048, 10, 28), darkMat);
      muzzleRim.position.set(tx, 0, TUBE_LEN);
      elevGroup.add(muzzleRim);

      const breachCap = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_OUTER_R * 0.94, TUBE_OUTER_R * 0.94, 0.12, 20), darkMat);
      breachCap.rotation.x = Math.PI / 2;
      breachCap.position.set(tx, 0, 0.02);
      elevGroup.add(breachCap);

      // Reinforcement collars & hazard rings
      for (let b = 0; b < 4; b++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(TUBE_OUTER_R * 1.02, 0.035, 8, 24), darkMat);
        band.position.set(tx, 0, 0.4 + b * (TUBE_LEN - 0.8) / 3);
        elevGroup.add(band);
      }

      const tipRing = new THREE.Mesh(new THREE.TorusGeometry(TUBE_OUTER_R * 1.01, 0.04, 6, 24), hazardMat);
      tipRing.position.set(tx, 0, TUBE_LEN - 0.35);
      elevGroup.add(tipRing);

      // Reference point for rocket placement in Tube 0
      if (idx === 0) {
        const breachPoint = new THREE.Object3D();
        breachPoint.position.set(tx, 0, 0);
        elevGroup.add(breachPoint);
        elevGroup.userData.breachPoint = breachPoint;
      }
    });

    // Structural tie-bars between tubes
    for (let b = 0; b < 3; b++) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.1), darkMat);
      brace.position.set(0, 0, 0.5 + b * (TUBE_LEN - 0.9) / 2);
      elevGroup.add(brace);
    }

    /* ── TRIPOD-MOUNTED FIRE-CONTROL RADAR SYSTEM ── */
    // Attached directly to launchPod (tripod station structure)
    const radarMast = new THREE.Group();
    const mastX = -1.05;
    const mastZ = -0.55;
    radarMast.position.set(mastX, tripodCenterY + 0.18, mastZ);
    launchPod.add(radarMast);

    // Structural mounting arm bridging central tripod top plate directly to the radar mast base
    const armX = mastX / 2;
    const armZ = mastZ / 2;
    const armLen = Math.sqrt(mastX * mastX + mastZ * mastZ) + 0.3;
    const armAngle = Math.atan2(mastX, mastZ);

    const tripodArm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, armLen), darkMat);
    tripodArm.position.set(armX, tripodCenterY + 0.12, armZ);
    tripodArm.rotation.y = armAngle;
    tripodArm.castShadow = true;
    tripodArm.receiveShadow = true;
    launchPod.add(tripodArm);

    // Structural clamp collar connecting arm to tripod hub plate
    const hubClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.98, 0.14, 24), darkMat);
    hubClamp.position.set(0, tripodCenterY + 0.12, 0);
    hubClamp.castShadow = true;
    launchPod.add(hubClamp);

    // Heavy-duty mast pedestal socket resting directly on the mounting arm
    const mastSocket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.25, 16), hullMat);
    mastSocket.position.set(0, 0.05, 0);
    mastSocket.castShadow = true;
    radarMast.add(mastSocket);

    // Dual heavy-duty diagonal hydraulic support struts anchoring mast directly to tripod frame
    const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), chromeMat);
    strut1.position.set(0.18, -0.35, 0.12);
    strut1.rotation.z = 0.52;
    strut1.rotation.x = -0.2;
    strut1.castShadow = true;
    radarMast.add(strut1);

    const strut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), chromeMat);
    strut2.position.set(0.18, -0.35, -0.12);
    strut2.rotation.z = 0.52;
    strut2.rotation.x = 0.2;
    strut2.castShadow = true;
    radarMast.add(strut2);

    // Heavy-duty mast pedestal & gear housing
    const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 12), darkMat);
    mastBase.position.y = 0.7;
    mastBase.castShadow = true;
    radarMast.add(mastBase);

    // Radar Azimuth Rotator Head (`radarDish` continuously rotates 360° around Y-axis)
    radarDish = new THREE.Group();
    radarDish.position.set(0, 1.42, 0);
    radarMast.add(radarDish);

    // Rotator hub motor box
    const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.32), radomeMat);
    motorBox.castShadow = true;
    radarDish.add(motorBox);

    // Radar dish back-frame & yoke arm
    const yokeArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.26), darkMat);
    yokeArm.position.set(0, 0.22, -0.05);
    yokeArm.rotation.x = -0.15;
    radarDish.add(yokeArm);

    // Realistic Parabolic Dish Reflector Mesh
    const dishReflectorGeo = new THREE.SphereGeometry(0.54, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const dishReflector = new THREE.Mesh(dishReflectorGeo, dishMat);
    dishReflector.position.set(0, 0.42, 0.12);
    dishReflector.rotation.x = -Math.PI * 0.42; // Tilted upwards towards sky
    dishReflector.castShadow = true;
    radarDish.add(dishReflector);

    // Dish rear structural reinforcement ribs
    for (let r = 0; r < 4; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.52, 0.12), darkMat);
      rib.rotation.z = (r / 4) * Math.PI;
      rib.position.set(0, 0.42, 0.05);
      radarDish.add(rib);
    }

    // Feedhorn focal support tripod (3 struts holding transceiver horn)
    for (let s = 0; s < 3; s++) {
      const strutAngle = (s / 3) * Math.PI * 2;
      const fStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.48, 6), darkMat);
      fStrut.position.set(Math.sin(strutAngle) * 0.19, 0.42 + Math.cos(strutAngle) * 0.19, 0.23);
      fStrut.rotation.x = 0.6;
      fStrut.rotation.z = -strutAngle * 0.5;
      radarDish.add(fStrut);
    }

    // Feedhorn Transceiver / Waveguide Box
    const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.16, 10), radomeMat);
    feedHorn.position.set(0, 0.42, 0.44);
    feedHorn.rotation.x = Math.PI / 2;
    radarDish.add(feedHorn);

    // Counterweight at rear of dish
    const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.13), darkMat);
    counterWeight.position.set(0, 0.38, -0.24);
    radarDish.add(counterWeight);

    // Radar active status green LED indicator
    const radarLED = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff66 })
    );
    radarLED.position.set(0, 0.74, 0.1);
    radarDish.add(radarLED);

    /* ── Traverse Turret to Face Drone Swarm Target ── */
    const toSwarmFlat = new THREE.Vector3(droneSwarmCenter.x - podBasePos.x, 0, droneSwarmCenter.z - podBasePos.z);
    const yaw = toSwarmFlat.lengthSq() > 1e-6 ? Math.atan2(toSwarmFlat.x, toSwarmFlat.z) : 0;
    turretYaw.rotation.y = yaw;

    launchDir.set(
      Math.sin(yaw) * Math.cos(ELEV_ANGLE),
      Math.sin(ELEV_ANGLE),
      Math.cos(yaw) * Math.cos(ELEV_ANGLE)
    ).normalize();

    // Resolve launch origin from Tube 0 breach point
    launchPod.updateMatrixWorld(true);
    const breachWorld = new THREE.Vector3();
    elevGroup.userData.breachPoint.getWorldPosition(breachWorld);
    launchOrigin.copy(breachWorld).addScaledVector(launchDir, -ROCKET_TAIL_Y);
  }

  /* ════════════════════════════════════
     ROCKET - detailed geometry
  ════════════════════════════════════ */
  function buildRocket() {
    rocketGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb0c0d0, roughness: 0.25, metalness: 0.75 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x252e35, roughness: 0.4, metalness: 0.85 });
    const finMat   = new THREE.MeshStandardMaterial({ color: 0x4a5a62, roughness: 0.35, metalness: 0.8 });
    const noseMat  = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.18, metalness: 0.9 });
    const nozzleMat= new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.3, metalness: 0.95 });

    // ── Hemispherical Nose Cone
    const noseGeo = new THREE.SphereGeometry(0.45, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.y = 3.3; 
    nose.castShadow = true;
    rocketGroup.add(nose);

    // ── Forward body
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.45, 5.4, 24);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
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

    // ── Engine section
    const engGeo = new THREE.CylinderGeometry(0.45, 0.42, 3.0, 24);
    const eng = new THREE.Mesh(engGeo, engineMat);
    eng.position.y = -3.6;
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
      let r;
      if (t < 0.4) { r = 0.35 - t * 0.375; }
      else { r = 0.05 + Math.pow((t - 0.4) / 0.6, 0.6) * 0.3; }
      nozzlePts.push(new THREE.Vector2(r, -5.1 - t * 0.8));
    }
    const nozzleGeo = new THREE.LatheGeometry(nozzlePts, 20);
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.castShadow = true;
    rocketGroup.add(nozzle);

    // ── FIXED FINS * 4 - clipped delta
    for (let i = 0; i < 4; i++) {
      const orbitalAngle = (i / 4) * Math.PI * 2;
      const fxGrp = new THREE.Group();
      fxGrp.position.y = -2.6;
      fxGrp.rotation.y = orbitalAngle;
      const fin = makeFixedFin(finMat);
      fxGrp.add(fin);
      rocketGroup.add(fxGrp);
    }

    // ── CONTROL FINS * 4 - rectangular, all-moving
    const ctrlFinGroups = [];
    for (let i = 0; i < 4; i++) {
      const orbitalAngle = (i / 4) * Math.PI * 2;
      const cfGrp = new THREE.Group();
      cfGrp.rotation.order = 'YXZ';
      cfGrp.position.y = -4.6;
      cfGrp.rotation.y = orbitalAngle;
      const fin = makeCtrlFin(finMat);
      cfGrp.add(fin);
      rocketGroup.add(cfGrp);
      ctrlFinGroups.push(cfGrp);
    }
    rocketGroup._ctrlFins = ctrlFinGroups;

    // ── Engine flame
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

    rocketGroup.scale.setScalar(1.0);
    rocketPos.copy(launchOrigin);
    rocketGroup.position.copy(rocketPos);

    const initialQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), launchDir);
    rocketGroup.quaternion.copy(initialQuat);

    scene.add(rocketGroup);
    rocketGroup.visible = true;

    return ctrlFinGroups;
  }

  function makeFixedFin(mat) {
    const ROOT_LE_Y = 0.78;
    const ROOT_TE_Y = -0.62;
    const TIP_LE_Y  = 0.18;
    const TIP_TE_Y  = -0.22;
    const SPAN      = 1.0;

    const shape = new THREE.Shape();
    shape.moveTo(0,    ROOT_LE_Y);
    shape.lineTo(SPAN, TIP_LE_Y);
    shape.lineTo(SPAN, TIP_TE_Y);
    shape.lineTo(0,    ROOT_TE_Y);
    shape.lineTo(0,    ROOT_LE_Y);
    const ext = { depth: 0.07, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2 };
    const geo = new THREE.ExtrudeGeometry(shape, ext);
    const fin = new THREE.Mesh(geo, mat);
    fin.position.set(0.45, 0, -0.035);
    fin.castShadow = true;
    return fin;
  }

  function makeCtrlFin(mat) {
    const shape = new THREE.Shape();
    shape.moveTo(0,    0);
    shape.lineTo(0,    0.7);
    shape.lineTo(1.0,  0.7);
    shape.lineTo(1.0,  0);
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
    const swarmCenter = new THREE.Vector3(150, 78, -130);
    droneSwarmCenter.copy(swarmCenter);

    const droneOffsets = [
      [0,0,0],[4,1.5,-2],[-3,2,2],[2,-2,4],[-2,3,-3],
      [6,-1,3],[-4,-2,-3],[3,3.5,-4],[-2,-3,3],[5,2,2],
      [-5,1,-1],[1,-1.5,-5],[3.5,2.5,1],[-1,3.5,3]
    ];

    droneOffsets.forEach(([dx, dy, dz]) => {
      const drone = buildDetailedDrone();
      drone.position.set(swarmCenter.x + dx, swarmCenter.y + dy, swarmCenter.z + dz);
      drone._basePos = drone.position.clone();
      drone._dynamicBase = drone.position.clone();
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

    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), frameMat);
    group.add(frame);

    // Battery
    const battery = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.28), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.6, metalness: 0.5 }));
    battery.position.y = -0.07;
    group.add(battery);

    // Board
    const fcb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.5, metalness: 0.4 }));
    fcb.position.y = 0.05;
    group.add(fcb);

    // 4 Arms
    const armDirs = [[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]];
    armDirs.forEach(([ax, ay, az], idx) => {
      const armLen = 0.45;
      const armGeo = new THREE.BoxGeometry(armLen, 0.035, 0.04);
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(ax * armLen / 2, 0, az * armLen / 2);
      arm.rotation.y = Math.atan2(az, ax);
      arm.castShadow = true;
      group.add(arm);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.06, 10), armMat);
      motor.position.set(ax * armLen, 0.04, az * armLen);
      motor.castShadow = true;
      group.add(motor);

      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.005, 12), propMat);
      prop.position.set(ax * armLen, 0.08, az * armLen);
      group.add(prop);

      for (let b = 0; b < 2; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.004, 0.04),
          new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.8 })
        );
        blade.position.set(ax * armLen, 0.082, az * armLen);
        blade.rotation.y = b * Math.PI / 2;
        group.add(blade);
      }

      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), idx < 2 ? ledMatR : ledMatG);
      led.position.set(ax * armLen, 0, az * armLen);
      group.add(led);
    });

    // Camera
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

  function spawnTrail() { /* trail removed */ }

  /* ════════════════════════════════════
     INTERCEPT EFFECTS
  ════════════════════════════════════ */
  function spawnHardKillExplosion(center) {
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
    // Continuous 360-degree azimuth rotation of the parabolic radar antenna
    radarDish.rotation.y += dt * 2.2;
    if (radarScanRing) {
      radarScanAngle += dt * 2.2;
      radarScanRing.rotation.z = radarScanAngle;
    }
  }

  function updateDrones(dt) {
    const paused = rocketPaused && simState === 'flight';

    if (rocketFired && totalFlightDistance > 0) {
      const frac = distanceTraveled / totalFlightDistance;
      if (dronePhase === 0 && frac >= DRONE_STRAFE_START) {
        dronePhase = 1;
      } else if (dronePhase === 1 && frac >= DRONE_STRAFE_END) {
        dronePhase = 2;
      }
    }

    const ADVANCE_SPEED = 5;

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

      if (!rocketFired || paused) return;

      const step = ADVANCE_SPEED * dt;

      if (dronePhase === 0 || dronePhase === 2) {
        drone._dynamicBase.x += _swarmFwd.x * step;
        drone._dynamicBase.z += _swarmFwd.z * step;
      } else {
        drone._dynamicBase.x += _swarmRight.x * step;
        drone._dynamicBase.z += _swarmRight.z * step;
      }

      const offsetY = drone._basePos.y - DRONE_START_ALT;
      drone.position.x = drone._dynamicBase.x;
      drone.position.z = drone._dynamicBase.z;
      drone.position.y = DRONE_START_ALT + offsetY;

      drone.rotation.order = 'YXZ';
      drone.rotation.y = Math.atan2(_swarmFwd.x, _swarmFwd.z);
      drone.rotation.x = 0;
      drone.rotation.z = 0;
    });

    if (drones.length > 0) {
      let cx = 0, cy = 0, cz = 0, count = 0;
      for (let i = 0; i < drones.length; i++) {
        const d = drones[i];
        if (d._alive === false) continue;
        cx += d._dynamicBase.x; cy += d.position.y; cz += d._dynamicBase.z;
        count++;
      }
      if (count > 0) droneSwarmCenter.set(cx / count, cy / count, cz / count);
    }
  }

  function idleMotorEffects() {
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
  }

  function updateRocket(dt) {
    if (!rocketFired || !rocketGroup) return;
    if (interceptDone) return;

    if (rocketPaused) {
      idleMotorEffects();
      return;
    }

    const toTarget = droneSwarmCenter.clone().sub(rocketPos);
    const dist = toTarget.length();
    const desiredDir = toTarget.clone().normalize();
    const currentDir = rocketVel.clone().normalize();

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

    const maxSpeed = 8;
    const spd = Math.min(rocketVel.length() + 3 * dt, maxSpeed);
    rocketVel.copy(newDir).multiplyScalar(spd);

    rocketPos.add(rocketVel.clone().multiplyScalar(dt));
    rocketGroup.position.copy(rocketPos);

    distanceTraveled += spd * dt;
    if (nextCheckpointIdx < STAGE_FRACTIONS.length &&
        distanceTraveled >= totalFlightDistance * STAGE_FRACTIONS[nextCheckpointIdx]) {
      const reachedIdx = nextCheckpointIdx;
      nextCheckpointIdx++;
      rocketPaused = true;
      if (onStageCb) onStageCb(reachedIdx);
    }

    const dir = rocketVel.clone().normalize();
    {
      const fwd = dir;
      const worldUp = (Math.abs(fwd.y) > 0.99)
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(fwd, worldUp).normalize();
      const up    = new THREE.Vector3().crossVectors(right, fwd).normalize();
      const m = new THREE.Matrix4().makeBasis(right, fwd, up);
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
      rocketGroup.quaternion.slerp(targetQuat, Math.min(dt * 12, 1));
    }

    if (rocketGroup._ctrlFins) {
      const bodyFwd = currentDir.clone();
      const worldUp = (Math.abs(bodyFwd.y) > 0.99) ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const bodyRight = new THREE.Vector3().crossVectors(bodyFwd, worldUp).normalize();
      const bodyUp    = new THREE.Vector3().crossVectors(bodyRight, bodyFwd).normalize();

      const rotAxis = new THREE.Vector3().crossVectors(currentDir, desiredDir);
      const pitchCmd = THREE.MathUtils.clamp(rotAxis.dot(bodyRight) * 120, -0.5, 0.5);
      const yawCmd   = THREE.MathUtils.clamp(-rotAxis.dot(bodyUp)   * 120, -0.5, 0.5);

      rocketGroup._ctrlFins.forEach((fg, i) => {
        const theta = (i / 4) * Math.PI * 2;
        fg.rotation.x = pitchCmd * Math.cos(theta) + yawCmd * Math.sin(theta);
      });
    }

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

    const distAfterMove = droneSwarmCenter.distanceTo(rocketPos);
    let nearestDroneDist = distAfterMove;
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      if (d._alive === false) continue;
      const dd = d.position.distanceTo(rocketPos);
      if (dd < nearestDroneDist) nearestDroneDist = dd;
    }
    if (distAfterMove < 3.5 || nearestDroneDist < 2.5) triggerIntercept();
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
        if (item._rot) item.rotation.x += item._rot.x;
        item.material.opacity = Math.max(0, item._type === 'smoke' ? item._life * 0.6 : item._life);
        if (item._life <= 0) { scene.remove(item); explosionParticles.splice(i, 1); }
      }
    }

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
    cameraMode = 'swarm-zoom';
    buildRadarScan();

    drones.forEach(d => {
      d._vel.set(
        (Math.random() - 0.5) * 0.015 - 0.006,
        0,
        (Math.random() - 0.5) * 0.015 + 0.012
      );
    });

    setTimeout(() => {
      cameraMode = 'launch';
      if (onAlertCb) onAlertCb();
    }, 3200);
  }

  function launchRocket(mode) {
    killMode = mode;
    simState = 'launch';

    if (!rocketGroup) buildRocket();

    rocketGroup.visible = true;
    rocketFired = false;
    rocketPaused = false;
    totalFlightDistance = launchOrigin.distanceTo(droneSwarmCenter);
    distanceTraveled = 0;
    nextCheckpointIdx = 0;
    rocketPos.copy(launchOrigin);
    rocketGroup.position.copy(rocketPos);
    rocketGroup.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), launchDir));

    cameraMode = 'launch';

    setTimeout(() => {
      if (engineFlame) { engineFlame.visible = true; engineFlame2.visible = true; }
      const flameOuter = rocketGroup.getObjectByName('flameOuter');
      if (flameOuter) flameOuter.visible = true;
      if (engineLight) { engineLight.visible = true; }

      rocketVel.copy(launchDir).multiplyScalar(6);
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

  function pauseRocket() { rocketPaused = true; }
  function resumeRocket() { rocketPaused = false; }
  function isRocketPaused() { return rocketPaused; }
  function onStageReached(cb) { onStageCb = cb; }

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
    rocketPaused = false;
    totalFlightDistance = 0;
    distanceTraveled = 0;
    nextCheckpointIdx = 0;
    trajectoryPoints = [];
    rocketPos.set(0, 0, 0);
    rocketVel.set(0, 0, 0);
    cameraMode = 'orbit';
    cameraTimer = 0;
    dronePhase = 0;

    buildDroneSwarm();
    buildRocket();
  }

  function onAlert(cb) { onAlertCb = cb; }
  function onRocketLaunch(cb) { onRocketLaunchCb = cb; }
  function onIntercept(cb) { onInterceptCb = cb; }
  function onDone(cb) { onDoneCb = cb; }
  function onLoadProgress(cb) { onLoadProgressCb = cb; }
  function onAssetsReady(cb) { onAssetsReadyCb = cb; }

  return {
    init, startApproach, launchRocket, resetSim,
    getTrajectoryPoints, getRocketPos, getSwarmCenter,
    getSimState, getMissionTime,
    pauseRocket, resumeRocket, isRocketPaused, onStageReached,
    onAlert, onRocketLaunch, onIntercept, onDone,
    onLoadProgress, onAssetsReady
  };
})();
