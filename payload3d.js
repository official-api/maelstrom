/* ═══════════════════════════════════════════════════════════════
   MAELSTROM — PAYLOAD3D
   Real-time 3D warhead-effects viewport, styled to match the
   engine cutaway (engine3d.js): MeshStandardMaterial with baked
   procedural grain/noise maps, a three-point + rim light rig, and
   a slow cinematic turntable.

   HARD KILL — the tungsten fragmentation sleeve shears open and
   several dozen chunky fragments are hurled outward in every
   direction on the sphere (not a flat 2D cone), each spinning on
   its own random axis and sagging slightly under gravity as it
   flies — driven by a simple per-fragment ballistic integrator.
   The warhead's own casing (outer body tube + tail sleeve) is built
   from a ring of curved shell shards rather than one solid mesh, so
   at the same instant the casing itself blows apart into pieces
   using the same outward ballistic motion as the small fragments —
   only bigger, slower, and heavier-looking.

   SOFT KILL — the carbon-fibre tow is ejected from the canister as
   a bundle of flexible multi-segment filaments. Each filament is a
   tiny Verlet-integrated rope (point masses + distance constraints,
   gravity + drag) whose anchor end now travels outward along the
   same ballistic path as a fragment, instead of staying pinned to
   the canister — so the whole tow shoots outward like shrapnel,
   with the rope physics only adding a trailing whip/bend behind
   that outward motion rather than a downward hang. The canister
   casing (tube + end cap) is likewise built as a ring of shards
   that blow apart the same way the hard-kill casing does.
   ═══════════════════════════════════════════════════════════════ */

window.PAYLOAD3D = (() => {
  const CYCLE = 3.4;     // seconds per deploy/reset loop
  const BURST_AT = 0.06; // fraction of the cycle where the charge fires

  let canvas, renderer, scene, camera, clock;
  let root, activeGroup, flashLight;
  let mode = 'hard';
  let builtFor = null;
  let elapsed = 0, cycleT = 0;
  let lastW = 0, lastH = 0;

  let titleEl, infoEl;

  const dummy = new THREE.Object3D();
  const quat = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);

  /* ─── shared helpers (same recipe as ENGINE3D) ─── */
  function buildNoiseTexture(size, base, variance) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const [r0, g0, b0] = base;
    for (let i = 0; i < size * size; i++) {
      const v = (Math.random() - 0.5) * variance;
      img.data[i * 4 + 0] = Math.max(0, Math.min(255, r0 + v));
      img.data[i * 4 + 1] = Math.max(0, Math.min(255, g0 + v));
      img.data[i * 4 + 2] = Math.max(0, Math.min(255, b0 + v));
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function metalMat(color, roughness, metalness, opts) {
    opts = opts || {};
    const params = { color, roughness, metalness, side: THREE.DoubleSide };
    if (opts.noisy) params.map = buildNoiseTexture(96, opts.base || [color >> 16 & 255, color >> 8 & 255, color & 255], opts.variance || 16);
    if (opts.transparent) { params.transparent = true; params.opacity = 1; }
    if (opts.emissive !== undefined) {
      params.emissive = opts.emissive;
      params.emissiveIntensity = opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 0.4;
    }
    return new THREE.MeshStandardMaterial(params);
  }

  function randSphereDir() {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const rxy = Math.sqrt(Math.max(0, 1 - u * u));
    return new THREE.Vector3(rxy * Math.cos(theta), u, rxy * Math.sin(theta));
  }

  function disposeDeep(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  /* ─── shared casing-shard burst (used by both HARD and SOFT kill) ───
     Builds a tube/cylinder not as one solid mesh but as a ring of curved
     shell shards. Pre-burst they sit exactly where the solid piece would
     be, so the casing reads as intact; once the charge fires they fly
     outward radially (plus a little axial scatter) using the same
     dist/drop ballistic shape as the small tungsten fragments, so the
     casing itself visibly breaks apart rather than just sitting there
     while fragments/filaments emerge from it. */
  function buildCaseChunks(count, radius, length, colorHex, matOpts, axialOffset) {
    axialOffset = axialOffset || 0;
    const group = new THREE.Group();
    const mat = metalMat(colorHex, matOpts.roughness, matOpts.metalness, matOpts);
    const data = [];
    const sliceAngle = (Math.PI * 2) / count;

    for (let k = 0; k < count; k++) {
      const thetaStart = k * sliceAngle;
      // slight under-coverage (0.9) leaves a hairline seam between shards
      // so the pre-burst tube still reads as a fabricated, riveted casing.
      const geo = new THREE.CylinderGeometry(radius, radius, length, 5, 1, true, thetaStart, sliceAngle * 0.9);
      geo.rotateZ(Math.PI / 2); // align tube axis to X, matching the rest of the payload geometry
      if (axialOffset) geo.translate(axialOffset, 0, 0);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      const midAngle = thetaStart + sliceAngle / 2;
      // Outward burst direction: mostly radial (perpendicular to the tube
      // axis), with a small random axial component so the shards scatter
      // rather than fly out in one perfectly flat ring.
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        Math.cos(midAngle),
        Math.sin(midAngle)
      ).normalize();

      data.push({
        mesh, dir,
        speed: 0.6 + Math.random() * 0.7,     // heavier/slower than the small shrapnel fragments
        spinAxis: randSphereDir(),
        spinSpeed: 1.4 + Math.random() * 3.2,
        seed: Math.random() * 10,
        delay: Math.random() * 0.08,
      });
    }
    return { group, data, mat };
  }

  function updateCaseChunks(data, local) {
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const t = Math.max(0, local - c.delay);
      const dist = t * c.speed * 1.4;
      const drop = 0.4 * t * t; // same downward arc as the small fragments, for a consistent look
      c.mesh.position.set(c.dir.x * dist, c.dir.y * dist - drop, c.dir.z * dist);
      quat.setFromAxisAngle(c.spinAxis, elapsed * c.spinSpeed + c.seed);
      c.mesh.quaternion.copy(quat);
    }
  }

  /* ═════════════════ HARD KILL — fragmentation ═════════════════ */
  const FRAG_COUNT = 90;
  const CASE_CHUNK_COUNT = 12;
  const SLEEVE_CHUNK_COUNT = 6;
  let fragMesh, fragData;
  let bodyChunks, sleeveChunks;

  function buildHardKill() {
    const group = new THREE.Group();

    // Explosive core stays put at the centre — only the metal casing
    // around it blows apart.
    const coreGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.42, 22, 1, true);
    coreGeo.rotateZ(Math.PI / 2);
    group.add(new THREE.Mesh(coreGeo, metalMat(0xffb020, 0.65, 0.05, { noisy: true, base: [0xd8, 0xd8, 0xd8], variance: 26 })));

    // Warhead body casing — built as a ring of curved shell shards
    // (rather than one solid tube) so it can burst apart into pieces
    // right alongside the fragments it releases.
    bodyChunks = buildCaseChunks(
      CASE_CHUNK_COUNT, 0.15, 0.46, 0xff3300,
      { noisy: true, base: [0xd8, 0xd8, 0xd8], variance: 14, transparent: true }
    );
    group.add(bodyChunks.group);

    // Tail sleeve — same shard treatment, so the whole casing (body +
    // sleeve) shears apart together instead of leaving a static stub.
    sleeveChunks = buildCaseChunks(
      SLEEVE_CHUNK_COUNT, 0.155, 0.10, 0xff6a00,
      { transparent: true }, -0.16
    );
    group.add(sleeveChunks.group);

    // Fragments — chunky, angular tungsten-alloy shards, flung out to
    // every point on the sphere, each tumbling on its own random axis.
    const fragGeo = new THREE.IcosahedronGeometry(1, 0);
    const fragMat = metalMat(0xffa030, 0.55, 0.65, { transparent: true, emissive: 0xff5500, emissiveIntensity: 0.5 });
    fragMesh = new THREE.InstancedMesh(fragGeo, fragMat, FRAG_COUNT);

    const col = new THREE.Color();
    fragData = [];
    for (let i = 0; i < FRAG_COUNT; i++) {
      const dir = randSphereDir();
      fragData.push({
        dir,
        speed: 1.3 + Math.random() * 1.9,
        spinAxis: randSphereDir(),
        spinSpeed: 3.5 + Math.random() * 8,
        scale: 0.016 + Math.random() * 0.024,
        seed: Math.random() * 10,
        delay: Math.random() * 0.12, // slight stagger so the burst isn't a perfect sphere shell
      });
      const shade = 0.8 + Math.random() * 0.4;
      col.setRGB(1.0 * shade, 0.55 * shade, 0.12 * shade);
      fragMesh.setColorAt(i, col);
    }
    group.add(fragMesh);
    return group;
  }

  function updateHardKill(dt) {
    cycleT = (cycleT + dt) % CYCLE;
    const phase = cycleT / CYCLE;
    const local = Math.max(0, (phase - BURST_AT) / (1 - BURST_AT));

    fragMesh.material.opacity = local <= 0 ? 1 : Math.max(0.12, 1 - local * 0.8);

    for (let i = 0; i < FRAG_COUNT; i++) {
      const f = fragData[i];
      const t = Math.max(0, local - f.delay);
      const dist = t * f.speed * 1.7;
      const drop = 0.4 * t * t; // fragments arc downward under gravity as they travel

      dummy.position.set(f.dir.x * dist, f.dir.y * dist - drop, f.dir.z * dist);
      quat.setFromAxisAngle(f.spinAxis, elapsed * f.spinSpeed + f.seed);
      dummy.quaternion.copy(quat);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      fragMesh.setMatrixAt(i, dummy.matrix);
    }
    fragMesh.instanceMatrix.needsUpdate = true;

    // Casing shards (body + sleeve) burst outward on the same clock as
    // the fragments, so the whole payload — not just its shrapnel —
    // visibly blows apart.
    updateCaseChunks(bodyChunks.data, local);
    updateCaseChunks(sleeveChunks.data, local);
    const caseOpacity = local <= 0 ? 1 : Math.max(0.15, 1 - local * 0.7);
    bodyChunks.mat.opacity = caseOpacity;
    sleeveChunks.mat.opacity = caseOpacity;

    // Detonation flash right as the sleeve shears open
    const win = 0.05;
    if (phase > BURST_AT - 0.01 && phase < BURST_AT + win) {
      flashLight.intensity = Math.max(0, 1 - (phase - (BURST_AT - 0.01)) / (win + 0.01)) * 8.5;
      flashLight.color.setHex(0xff5500);
    } else {
      flashLight.intensity = 0;
    }

    activeGroup.rotation.y = 0.18 * Math.sin(elapsed * 0.4);
  }

  /* ═════════════════ SOFT KILL — carbon fibre (Verlet rope) ═════════════════ */
  const FIBER_COUNT = 44;
  const SEG_COUNT = 6; // point masses per fibre -> SEG_COUNT-1 rendered links
  const GRAVITY = -1.1;
  const DAMPING = 0.986;
  const CAN_CHUNK_COUNT = 12;
  const CAP_CHUNK_COUNT = 6;
  let fiberMesh, fibers;
  let canChunks, capChunks;

  function buildSoftKill() {
    const group = new THREE.Group();

    // Canister casing — a ring of shell shards (not one solid tube) so
    // it bursts apart the same way the hard-kill casing does.
    canChunks = buildCaseChunks(
      CAN_CHUNK_COUNT, 0.10, 0.5, 0x1560ff,
      { noisy: true, base: [0xd8, 0xd8, 0xd8], variance: 10, transparent: true }
    );
    group.add(canChunks.group);

    capChunks = buildCaseChunks(
      CAP_CHUNK_COUNT, 0.105, 0.03, 0x7a2aff,
      { transparent: true }, -0.26
    );
    group.add(capChunks.group);

    // Glossy filament material — carbon fibre tow look, now a vibrant
    // glowing cyan so it reads clearly against the dark stage instead
    // of disappearing like the original near-black finish did.
    const fiberMat = metalMat(0x00e5ff, 0.32, 0.35, { emissive: 0x00c8ff, emissiveIntensity: 0.65 });
    const linkGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); // unit cylinder, scaled per-instance
    const totalLinks = FIBER_COUNT * (SEG_COUNT - 1);
    fiberMesh = new THREE.InstancedMesh(linkGeo, fiberMat, totalLinks);
    fiberMesh.frustumCulled = false;

    fibers = [];
    for (let i = 0; i < FIBER_COUNT; i++) {
      const points = [], prev = [];
      for (let s = 0; s < SEG_COUNT; s++) { points.push(new THREE.Vector3()); prev.push(new THREE.Vector3()); }
      fibers.push({
        dir: randSphereDir(),
        segLen: 0.045 + Math.random() * 0.03,
        burstSpeed: 1.5 + Math.random() * 1.6,
        thickness: 0.0035 + Math.random() * 0.003,
        points, prev,
        released: false,
        anchor: new THREE.Vector3(), // world-space offset of this fibre's root — travels outward like a fragment
        delay: Math.random() * 0.1,  // slight stagger so the tow doesn't leave as one flat shell
      });
    }
    group.add(fiberMesh);
    return group;
  }

  function resetFibers() {
    fibers.forEach(f => {
      for (let s = 0; s < SEG_COUNT; s++) { f.points[s].set(0, 0, 0); f.prev[s].set(0, 0, 0); }
      f.released = false;
    });
  }

  function updateSoftKill(dt) {
    const prevCycle = cycleT;
    cycleT = (cycleT + dt) % CYCLE;
    const phase = cycleT / CYCLE;
    const wrapped = cycleT < prevCycle;
    if (wrapped) resetFibers();
    const local = Math.max(0, (phase - BURST_AT) / (1 - BURST_AT));

    // Canister casing (tube + cap) bursts apart on the same clock as the
    // hard-kill casing, instead of sitting there as a static shell.
    updateCaseChunks(canChunks.data, local);
    updateCaseChunks(capChunks.data, local);
    const canOpacity = local <= 0 ? 1 : Math.max(0.15, 1 - local * 0.7);
    canChunks.mat.opacity = canOpacity;
    capChunks.mat.opacity = canOpacity;

    // Each fibre's root travels outward along the same ballistic path as a
    // fragment/casing shard (dist + gravity drop) — the Verlet rope below
    // only adds a trailing whip/bend behind that motion, so the tow shoots
    // outward instead of hanging straight down off the canister.
    fibers.forEach(f => {
      const t = Math.max(0, local - f.delay);
      const dist = t * f.burstSpeed * 1.7;
      const drop = 0.4 * t * t;
      f.anchor.set(f.dir.x * dist, f.dir.y * dist - drop, f.dir.z * dist);
    });

    if (phase >= BURST_AT) {
      if (!fibers[0].released) {
        // Kick every filament outward from the canister tip with an initial
        // burst velocity (set via the Verlet previous-position trick).
        fibers.forEach(f => {
          for (let s = 1; s < SEG_COUNT; s++) {
            f.points[s].copy(f.dir).multiplyScalar(0.002 * s);
            f.prev[s].copy(f.points[s]).sub(f.dir.clone().multiplyScalar(f.burstSpeed * dt));
          }
          f.released = true;
        });
      }

      const gravStep = GRAVITY * dt * dt;
      fibers.forEach(f => {
        // Integrate free point masses (Verlet: implicit velocity = pos - prevPos).
        for (let s = 1; s < SEG_COUNT; s++) {
          const p = f.points[s], pp = f.prev[s];
          const vx = (p.x - pp.x) * DAMPING;
          const vy = (p.y - pp.y) * DAMPING + gravStep;
          const vz = (p.z - pp.z) * DAMPING;
          pp.copy(p);
          p.x += vx; p.y += vy; p.z += vz;
        }
        f.points[0].set(0, 0, 0); // anchored to the canister tip

        // Distance constraints (Jakobsen relaxation) keep each link near its
        // rest length, which is what makes the tow bend/whip like a rope
        // instead of stretching like a spring or staying ruler-straight.
        for (let iter = 0; iter < 3; iter++) {
          for (let s = 0; s < SEG_COUNT - 1; s++) {
            const a = f.points[s], b = f.points[s + 1];
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
            const diff = (dist - f.segLen) / dist;
            const cx = dx * 0.5 * diff, cy = dy * 0.5 * diff, cz = dz * 0.5 * diff;
            if (s === 0) {
              b.x -= cx * 2; b.y -= cy * 2; b.z -= cz * 2;
            } else {
              a.x += cx; a.y += cy; a.z += cz;
              b.x -= cx; b.y -= cy; b.z -= cz;
            }
          }
          f.points[0].set(0, 0, 0);
        }
      });
    }

    // Render each link as an oriented, scaled unit cylinder between its
    // two point masses.
    let idx = 0;
    fibers.forEach(f => {
      for (let s = 0; s < SEG_COUNT - 1; s++) {
        const a = f.points[s], b = f.points[s + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (phase < BURST_AT || len < 1e-5) {
          dummy.scale.set(0, 0, 0);
        } else {
          // Offset by the fibre's own ballistic anchor so the whole link
          // rides outward with it — only orientation/length come from the
          // local rope simulation (the whip), position comes from both.
          dummy.position.set(
            (a.x + b.x) * 0.5 + f.anchor.x,
            (a.y + b.y) * 0.5 + f.anchor.y,
            (a.z + b.z) * 0.5 + f.anchor.z
          );
          quat.setFromUnitVectors(yAxis, new THREE.Vector3(dx / len, dy / len, dz / len));
          dummy.quaternion.copy(quat);
          dummy.scale.set(f.thickness, len, f.thickness);
        }
        dummy.updateMatrix();
        fiberMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    });
    fiberMesh.instanceMatrix.needsUpdate = true;

    // Pyro ejection-charge flash
    const win = 0.05;
    if (phase > BURST_AT - 0.01 && phase < BURST_AT + win) {
      flashLight.intensity = Math.max(0, 1 - (phase - (BURST_AT - 0.01)) / (win + 0.01)) * 6.5;
      flashLight.color.setHex(0x40e0ff);
    } else {
      flashLight.intensity = 0;
    }

    activeGroup.rotation.y = 0.12 * Math.sin(elapsed * 0.3);
  }

  /* ─── scene / lifecycle plumbing ─── */
  function buildScene() {
    scene = new THREE.Scene();
    scene.background = null;

    camera = new THREE.PerspectiveCamera(38, 1, 0.02, 20);
    camera.position.set(0.55, 0.3, 1.35);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0x9fc7ff, 0x14100c, 0.6);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff3e0, 1.3);
    key.position.set(1.6, 1.8, 1.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fc4ff, 0.45);
    fill.position.set(-1.4, 0.5, -0.8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x00ffb0, 0.55);
    rim.position.set(-0.8, 1.0, -1.8);
    scene.add(rim);

    flashLight = new THREE.PointLight(0xffddaa, 0, 8, 2);
    scene.add(flashLight);

    root = new THREE.Group();
    scene.add(root);
  }

  function clearActive() {
    if (!activeGroup) return;
    root.remove(activeGroup);
    disposeDeep(activeGroup);
    activeGroup = null;
  }

  function ensureMode(m) {
    if (builtFor === m) return;
    clearActive();
    builtFor = m;
    cycleT = 0;
    activeGroup = m === 'hard' ? buildHardKill() : buildSoftKill();
    root.add(activeGroup);
    updateOverlay(m);
  }

  function updateOverlay(m) {
    if (!titleEl) return;
    if (m === 'hard') {
      titleEl.textContent = 'HARD KILL — FRAG WARHEAD';
      titleEl.style.color = '#ff5500';
      infoEl.textContent = 'R_KILL: 15m   V_FRAG: >400 m/s   FUZE: PROX+IMPACT';
    } else {
      titleEl.textContent = 'SOFT KILL — CARBON FIBRE BURST';
      titleEl.style.color = '#00e5ff';
      infoEl.textContent = 'R_EFFECT: 20m   ENTANGLEMENT + ROTOR JAM + SHORTS';
    }
  }

  function buildOverlay(container) {
    container.querySelectorAll('.gl-payload-ui').forEach(n => n.remove());
    const title = document.createElement('div');
    title.className = 'gl-payload-ui gl-payload-title';
    container.appendChild(title);
    titleEl = title;
    const info = document.createElement('div');
    info.className = 'gl-payload-ui gl-payload-info';
    container.appendChild(info);
    infoEl = info;
  }

  function resize() {
    if (!canvas || !renderer) return;
    const w = canvas.clientWidth || canvas.offsetWidth || 340;
    const h = canvas.clientHeight || canvas.offsetHeight || 200;
    if (w < 2 || h < 2) return;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function init(canvasId, labelsId) {
    canvas = document.getElementById(canvasId);
    if (!canvas || typeof THREE === 'undefined') return;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    clock = new THREE.Clock();

    buildScene();
    if (labelsId) {
      const labelsRoot = document.getElementById(labelsId);
      if (labelsRoot) buildOverlay(labelsRoot);
    }
    ensureMode(mode);
    resize();
  }

  function setMode(m) {
    mode = m === 'soft' ? 'soft' : 'hard';
    if (renderer) ensureMode(mode);
  }

  function render(dt) {
    if (!renderer) return;
    resize();
    elapsed += dt;
    if (builtFor === 'hard') updateHardKill(dt);
    else if (builtFor === 'soft') updateSoftKill(dt);
    renderer.render(scene, camera);
  }

  return { init, render, setMode };
})();
