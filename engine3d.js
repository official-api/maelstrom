/* ═══════════════════════════════════════════════════════════════
   MAELSTROM — ENGINE3D
   Real 3D cutaway of the solid-propellant thrust unit, built
   straight from the customer-supplied STEP model (tessellated to
   thrust_unit.glb, one named mesh per CAD solid — grain segments,
   case, nozzle, closures, fins). A local clipping plane slices the
   model open live, like the reference cutaway photo, while it
   slowly turns on a turntable. Neat HTML label pins are projected
   from real 3D anchor points on the named parts every frame.
   ═══════════════════════════════════════════════════════════════ */

window.ENGINE3D = (() => {
  const MODEL_URL = 'thrust_unit.glb';

  // Part name (from the GLB, one node per original STEP solid) → look.
  const PART_STYLE = {
    shell_case:            { kind: 'shell',    color: 0x00d9ff },
    aft_closure_plate:     { kind: 'metal',    color: 0x3fd0ff },
    aft_bulkhead:          { kind: 'metal',    color: 0x3fd0ff },
    grain_seg_1:           { kind: 'grain',    color: 0xff8a1e },
    grain_seg_2:           { kind: 'grain',    color: 0xff8a1e },
    grain_seg_3:           { kind: 'grain',    color: 0xff8a1e },
    grain_seg_4:           { kind: 'grain',    color: 0xff8a1e },
    nozzle_housing:        { kind: 'ablative', color: 0x8a2fe0 },
    nozzle_throat_insert:  { kind: 'throat',   color: 0xff2d2d },
    nozzle_cone:           { kind: 'ablative', color: 0x8a2fe0 },
    nozzle_interface_ring: { kind: 'metal',    color: 0x3fd0ff },
    nozzle_exit_ring:      { kind: 'metal',    color: 0x3fd0ff },
    fin_fwd_0: { kind: 'fin', color: 0x00ffb0 }, fin_fwd_1: { kind: 'fin', color: 0x00ffb0 },
    fin_fwd_2: { kind: 'fin', color: 0x00ffb0 }, fin_fwd_3: { kind: 'fin', color: 0x00ffb0 },
    fin_aft_0: { kind: 'fin', color: 0x00ffb0 }, fin_aft_1: { kind: 'fin', color: 0x00ffb0 },
    fin_aft_2: { kind: 'fin', color: 0x00ffb0 }, fin_aft_3: { kind: 'fin', color: 0x00ffb0 },
    tab_0: { kind: 'metal', color: 0xffd400 }, tab_1: { kind: 'metal', color: 0xffd400 },
    tab_2: { kind: 'metal', color: 0xffd400 }, tab_3: { kind: 'metal', color: 0xffd400 },
  };

  // Labels: anchor = representative mesh name, text = pin label, side = which
  // way the pin leader should point (screen-space).
  const LABELS = [
    { mesh: 'aft_closure_plate', text: 'IGNITER',  side: 'left'  },
    { mesh: 'grain_seg_2',       text: 'GRAIN',    side: 'right' },
    { mesh: 'shell_case',        text: 'CASE',     side: 'left'  },
    { mesh: 'nozzle_cone',       text: 'NOZZLE',   side: 'right' },
    { mesh: 'fin_aft_0',         text: 'FIN',      side: 'right' },
  ];

  let canvas, labelsRoot, svgLine;
  let renderer, scene, camera, root, clock;
  let labelEls = [];
  let labelAnchorMeshes = [];
  let clipPlaneLocal, clipPlaneWorld;
  let loaded = false, loading = false, failed = false;
  let lastW = 0, lastH = 0;
  let spin = -2.4; // radians, current turntable angle
  let elapsed = 0;

  function buildNoiseTexture(size, base, variance, opts) {
    opts = opts || {};
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const [r0, g0, b0] = base;
    for (let i = 0; i < size * size; i++) {
      let n = Math.random();
      if (opts.streaks) {
        const y = Math.floor(i / size);
        n = 0.6 * n + 0.4 * (Math.sin(y * 0.9 + Math.random() * 2) * 0.5 + 0.5);
      }
      const v = (n - 0.5) * variance;
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

  function materialFor(kind, colorHex) {
    const common = { color: colorHex, side: THREE.DoubleSide };
    switch (kind) {
      case 'grain':
        return new THREE.MeshStandardMaterial(Object.assign({}, common, {
          roughness: 0.85, metalness: 0.0,
          emissive: colorHex, emissiveIntensity: 0.35,
          map: buildNoiseTexture(128, [0xd0, 0xd0, 0xd0], 30),
          bumpMap: buildNoiseTexture(128, [128,128,128], 60),
          bumpScale: 0.0008,
        }));
      case 'shell':
        return new THREE.MeshStandardMaterial(Object.assign({}, common, {
          roughness: 0.32, metalness: 0.6,
          emissive: colorHex, emissiveIntensity: 0.12,
          map: buildNoiseTexture(128, [0xc8, 0xc8, 0xc8], 14, { streaks: true }),
        }));
      case 'ablative':
        return new THREE.MeshStandardMaterial(Object.assign({}, common, {
          roughness: 0.55, metalness: 0.25,
          emissive: colorHex, emissiveIntensity: 0.18,
          map: buildNoiseTexture(128, [0xb0, 0xb0, 0xb0], 18),
        }));
      case 'throat':
        return new THREE.MeshStandardMaterial(Object.assign({}, common, {
          roughness: 0.45, metalness: 0.35,
          emissive: colorHex, emissiveIntensity: 0.55,
          map: buildNoiseTexture(96, [0xd8, 0xd8, 0xd8], 22),
        }));
      case 'fin':
        return new THREE.MeshStandardMaterial(Object.assign({}, common, {
          roughness: 0.25, metalness: 0.85,
          emissive: colorHex, emissiveIntensity: 0.2,
        }));
      case 'metal':
      default:
        return new THREE.MeshStandardMaterial(Object.assign({}, common, {
          roughness: 0.3, metalness: 0.8,
          emissive: colorHex, emissiveIntensity: 0.15,
        }));
    }
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.background = null;

    camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10);
    camera.position.set(0.80, 0.44, 0.90);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0x9fc7ff, 0x14100c, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff3e0, 1.35);
    key.position.set(1.4, 1.6, 1.0);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fc4ff, 0.5);
    fill.position.set(-1.2, 0.4, -0.6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x00ffe0, 1.0);
    rim.position.set(-0.6, 0.8, -1.4);
    scene.add(rim);

    root = new THREE.Group();
    scene.add(root);

    // Local-space clip plane (defined relative to `root`, which only ever
    // carries the turntable spin): slices away a radial half of the body so
    // the bore/grain/nozzle geometry is exposed like a physical cutaway
    // model. The loaded CAD model is rotated so its long (CAD-Z) axis lands
    // on root-local X (see wrap.rotation.y below); by the same rotation the
    // CAD's radial X axis lands on root-local Z, which is why the plane
    // normal here is (0,0,1) rather than (1,0,0).
    clipPlaneLocal = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    clipPlaneWorld = clipPlaneLocal.clone();
  }

  function onModelLoaded(gltf) {
    const gscene = gltf.scene;

    // Recenter + rescale so the model sits nicely in view regardless of the
    // exact CAD origin, and orient its long (Z, mm→m) axis horizontally.
    const box = new THREE.Box3().setFromObject(gscene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.85 / span;

    gscene.traverse(obj => {
      if (!obj.isMesh) return;
      // The tessellated CAD export carries positions only — compute proper
      // shading normals so MeshStandardMaterial's lighting isn't black.
      if (obj.geometry && !obj.geometry.attributes.normal) {
        obj.geometry.computeVertexNormals();
      }
      const style = PART_STYLE[obj.name] || { kind: 'metal', color: 0x888888 };
      obj.material = materialFor(style.kind, style.color);
      obj.material.clippingPlanes = [clipPlaneWorld];
      obj.material.clipShadows = true;
      obj.castShadow = obj.receiveShadow = false;
    });

    // Lay the rocket on its side (CAD Z axis → world X axis) for a natural
    // "profile cutaway" framing, then recenter + scale.
    const wrap = new THREE.Group();
    wrap.add(gscene);
    gscene.position.sub(center);
    wrap.rotation.y = Math.PI / 2; // CAD long axis (Z) → world X (lie flat)
    wrap.scale.setScalar(scale);
    root.add(wrap);

    labelAnchorMeshes = LABELS.map(cfg => {
      const mesh = gscene.getObjectByName(cfg.mesh);
      return { cfg, mesh };
    }).filter(a => a.mesh);

    loaded = true;
    // Part-name label pins (IGNITER/GRAIN/CASE/NOZZLE/FIN) are disabled —
    // hidden via CSS (#engineLabels) and skipped here so we don't do the
    // per-frame projection work for something that's never shown.
  }

  function loadModel() {
    if (loading || loaded) return;
    loading = true;
    const loader = new THREE.GLTFLoader();
    loader.load(
      MODEL_URL,
      gltf => { onModelLoaded(gltf); loading = false; },
      undefined,
      err => { console.warn('ENGINE3D: model load failed', err); failed = true; loading = false; buildFallback(); }
    );
  }

  // If the GLB can't be fetched (e.g. opened as a raw file:// page instead of
  // served over http), still show *something* rather than a blank panel.
  function buildFallback() {
    const grp = new THREE.Group();
    const caseMat = materialFor('shell', 0x00d9ff);
    caseMat.clippingPlanes = [clipPlaneWorld];
    const bodyGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 48, 1, true);
    bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, caseMat);
    grp.add(body);
    const grainMat = materialFor('grain', 0xff8a1e);
    grainMat.clippingPlanes = [clipPlaneWorld];
    const grainGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.32, 40, 1, true);
    grainGeo.rotateZ(Math.PI / 2);
    grainGeo.translate(-0.02, 0, 0);
    grp.add(new THREE.Mesh(grainGeo, grainMat));
    const nozzleMat = materialFor('ablative', 0x8a2fe0);
    nozzleMat.clippingPlanes = [clipPlaneWorld];
    const nozzleGeo = new THREE.ConeGeometry(0.09, 0.16, 40, 1, true);
    nozzleGeo.rotateZ(-Math.PI / 2);
    nozzleGeo.translate(0.33, 0, 0);
    grp.add(new THREE.Mesh(nozzleGeo, nozzleMat));
    root.add(grp);
    loaded = true;
  }

  function buildLabelDom() {
    labelsRoot.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    svgLine = document.createElementNS(ns, 'svg');
    svgLine.setAttribute('class', 'gl-leader-svg');
    labelsRoot.appendChild(svgLine);

    labelEls = labelAnchorMeshes.map(a => {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('class', 'gl-leader-line');
      svgLine.appendChild(line);

      const dot = document.createElement('div');
      dot.className = 'gl-pin-dot';
      labelsRoot.appendChild(dot);

      const label = document.createElement('div');
      label.className = 'gl-pin-label gl-pin-' + a.cfg.side;
      label.textContent = a.cfg.text;
      labelsRoot.appendChild(label);

      return { mesh: a.mesh, dot, label, line, side: a.cfg.side };
    });
  }

  function updateLabels() {
    if (!labelEls.length || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    svgLine.setAttribute('width', rect.width);
    svgLine.setAttribute('height', rect.height);
    svgLine.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const v = new THREE.Vector3();
    const margin = 10;

    // Project every anchor first.
    const pts = labelEls.map(item => {
      box.setFromObject(item.mesh);
      box.getCenter(center);
      v.copy(center).project(camera);
      return {
        item,
        x: (v.x * 0.5 + 0.5) * rect.width,
        y: (-v.y * 0.5 + 0.5) * rect.height,
        visible: v.z < 1,
      };
    });

    // Fixed label-text rows per side (top-to-bottom, in LABELS order), so
    // text never overlaps or runs off the panel regardless of where the
    // model has rotated to. The connector line still runs from the live,
    // moving 3D anchor point to its fixed text row — keeping it "alive"
    // without the clutter of dynamically-overlapping text.
    const leftPts = pts.filter(p => p.item.side === 'left');
    const rightPts = pts.filter(p => p.item.side === 'right');
    const rowH = 15;
    const layoutSide = (list, topOffset) => {
      list.forEach((p, i) => { p.rowY = topOffset + i * rowH; });
    };
    layoutSide(leftPts, 14);
    layoutSide(rightPts, 14);

    pts.forEach(p => {
      const { item } = p;
      item.dot.style.display = p.visible ? 'block' : 'none';
      item.label.style.display = p.visible ? 'block' : 'none';
      item.line.style.display = p.visible ? 'block' : 'none';
      if (!p.visible) return;

      const x = Math.max(margin, Math.min(rect.width - margin, p.x));
      const y = Math.max(margin, Math.min(rect.height - margin, p.y));
      item.dot.style.left = x + 'px';
      item.dot.style.top = y + 'px';

      const labelX = item.side === 'right' ? rect.width - margin : margin;
      item.label.style.left = labelX + 'px';
      item.label.style.top = p.rowY + 'px';

      item.line.setAttribute('x1', x);
      item.line.setAttribute('y1', y);
      item.line.setAttribute('x2', item.side === 'right' ? rect.width - 78 : 78);
      item.line.setAttribute('y2', p.rowY);
    });
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
    labelsRoot = document.getElementById(labelsId);
    if (!canvas || typeof THREE === 'undefined') return;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0x000000, 0);
    clock = new THREE.Clock();

    buildScene();
    loadModel();
    resize();
  }

  function render(dt) {
    if (!renderer) return;
    resize();
    if (!loaded) return;
    elapsed += dt;

    // Slow cinematic sweep, biased so the clip plane's cut face stays
    // generally toward the camera (rather than a full spin that spends half
    // its time showing only the solid, uncut side).
    spin = -2.4 + 0.5 * Math.sin(elapsed * 0.35);
    root.rotation.y = spin;

    // Recompute the clip plane in world space every frame since it must
    // rotate together with the (spinning) model to stay a consistent
    // "long-axis" cutaway rather than a fixed screen-space slice.
    clipPlaneWorld.copy(clipPlaneLocal).applyMatrix4(root.matrixWorld);

    renderer.render(scene, camera);
  }

  return { init, render };
})();
