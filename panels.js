/* ═══════════════════════════════════════════
   MAELSTROM - RIGHT PANEL CANVAS ANIMATIONS v2
   High-resolution, technically detailed
   ═══════════════════════════════════════════ */

const PANELS = (() => {

  /* ─── DPI-aware canvas setup ─── */
  function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth  || parseInt(canvas.style.width)  || canvas.width  || 340;
    const h = canvas.offsetHeight || parseInt(canvas.style.height) || canvas.height || 200;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvas._cssW = w;
    canvas._cssH = h;
    return ctx;
  }

  // Call before each draw to handle panel resize
  function syncCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth  || canvas._cssW || 340;
    const h = canvas.offsetHeight || canvas._cssH || 200;
    if (w < 1 || h < 1) return false;
    const needW = Math.round(w * dpr);
    const needH = Math.round(h * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width  = needW;
      canvas.height = needH;
      ctx.scale(dpr, dpr);
    }
    canvas._cssW = w;
    canvas._cssH = h;
    return true;
  }

  function clear(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#040810';
    ctx.fillRect(0, 0, w, h);
  }

  function subtleGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,180,130,0.05)';
    ctx.lineWidth = 0.5;
    const step = 16;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();
  }

  function monoFont(ctx, size, col) {
    ctx.font = `${size}px 'Share Tech Mono', monospace`;
    ctx.fillStyle = col || 'rgba(0,200,150,0.8)';
  }

  function annoLabel(ctx, txt, x, y, col, size) {
    monoFont(ctx, size || 9, col || 'rgba(0,200,150,0.6)');
    ctx.fillText(txt, x, y);
  }

  function dashed(ctx, x1, y1, x2, y2, col) {
    ctx.save();
    ctx.strokeStyle = col || 'rgba(0,200,150,0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ══════════════════════════════════════════════════
     ENGINE CROSS-SECTION — delegated to ENGINE3D
     (real Three.js scene built from the STEP-derived
     thrust_unit.glb model, with a live clipping plane
     cutaway — see engine3d.js)
  ══════════════════════════════════════════════════ */
  function initEngine() {
    if (window.ENGINE3D) window.ENGINE3D.init('engineCanvas', 'engineLabels');
  }
  function drawEngine(dt) {
    if (window.ENGINE3D) window.ENGINE3D.render(dt);
  }

  /* ══════════════════════════════════════════════════
     AEROFOIL PANEL — delegated to AEROFOIL_CFD
     (WebGL shader CFD-style heatmap around a NACA 0018
     section, oscillating like an active control fin —
     see aerofoil3d.js)
  ══════════════════════════════════════════════════ */
  function initAerofoil() {
    if (window.AEROFOIL_CFD) window.AEROFOIL_CFD.init('aerofoilCanvas');
  }
  function drawAerofoil(dt) {
    if (window.AEROFOIL_CFD) window.AEROFOIL_CFD.render(dt);
  }

  /* ══════════════════════════════════════════════════
     OPTICAL TRACKING PANEL
  ══════════════════════════════════════════════════ */
  let trackT = 0;
  let trackCanvas, trackCtx;

  const sensorDrones = [
    { x: 0.40, y: 0.36 }, { x: 0.56, y: 0.44 }, { x: 0.47, y: 0.54 },
    { x: 0.63, y: 0.34 }, { x: 0.37, y: 0.50 }, { x: 0.60, y: 0.61 },
    { x: 0.43, y: 0.29 }, { x: 0.53, y: 0.40 }, { x: 0.66, y: 0.49 },
    { x: 0.50, y: 0.58 }, { x: 0.44, y: 0.47 }, { x: 0.35, y: 0.38 },
  ];

  function initTracking() {
    trackCanvas = document.getElementById('trackingCanvas');
    if (!trackCanvas) return;
    trackCtx = setupHiDPI(trackCanvas);
  }

  function drawTracking(dt) {
    if (!trackCtx) return;
    trackT += dt;
    const ctx = trackCtx;
    const W = trackCanvas._cssW || trackCanvas.width;
    const H = trackCanvas._cssH || trackCanvas.height;
    clear(ctx, W, H);

    // LWIR false-colour background (thermal scene)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#050c14');
    bgGrad.addColorStop(0.6, '#081810');
    bgGrad.addColorStop(1, '#0a1408');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Thermal noise floor
    for (let i = 0; i < 300; i++) {
      const tx = Math.random() * W;
      const ty = Math.random() * H;
      const bright = Math.random() * 0.06;
      ctx.fillStyle = `rgba(${Math.floor(bright * 60)},${Math.floor(bright * 200)},${Math.floor(bright * 120)},0.6)`;
      ctx.fillRect(tx, ty, 1 + Math.random(), 1 + Math.random());
    }

    // Scene thermal gradient (ground warmer at bottom)
    const thermGrad = ctx.createLinearGradient(0, 0, 0, H);
    thermGrad.addColorStop(0, 'rgba(0,8,4,0)');
    thermGrad.addColorStop(0.7, 'rgba(0,8,4,0)');
    thermGrad.addColorStop(1, 'rgba(20,40,10,0.3)');
    ctx.fillStyle = thermGrad;
    ctx.fillRect(0, 0, W, H);

    const swarmDrift = Math.sin(trackT * 0.4) * 0.015;

    // Drone thermal signatures
    sensorDrones.forEach((d, i) => {
      const px = (d.x + swarmDrift * (i % 3 - 1) * 0.5) * W;
      const py = (d.y + Math.sin(trackT * 0.7 + i) * 0.008) * H;

      // Motor heat plumes (above the drone - warm air rising)
      for (let m = 0; m < 4; m++) {
        const mox = (m % 2 === 0 ? 1 : -1) * 6;
        const moy = (m < 2 ? 1 : -1) * 6;
        const plumeGrad = ctx.createRadialGradient(px + mox, py + moy, 0, px + mox, py + moy, 8);
        plumeGrad.addColorStop(0, 'rgba(255,200,100,0.6)');
        plumeGrad.addColorStop(0.5, 'rgba(255,100,20,0.2)');
        plumeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = plumeGrad;
        ctx.beginPath();
        ctx.ellipse(px + mox, py + moy - 4, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main drone body heat signature
      const bodyGrad = ctx.createRadialGradient(px, py, 0, px, py, 16);
      bodyGrad.addColorStop(0, 'rgba(255,255,230,0.98)');
      bodyGrad.addColorStop(0.2, 'rgba(255,200,80,0.85)');
      bodyGrad.addColorStop(0.5, 'rgba(255,80,0,0.55)');
      bodyGrad.addColorStop(0.8, 'rgba(180,20,0,0.2)');
      bodyGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fill();

      // Bounding box - CNN detection result
      const confidence = 0.91 + Math.sin(trackT * 3 + i * 0.8) * 0.04;
      const blink = Math.sin(trackT * 8 + i * 0.5) > -0.4;
      if (blink) {
        const bw = 32, bh = 22;
        ctx.strokeStyle = `rgba(0,255,120,${0.7 + Math.sin(trackT * 4 + i) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px - bw / 2, py - bh / 2, bw, bh);

        // Corner markers
        const ck = 6;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy]) => {
          const cx2 = px + sx * bw / 2;
          const cy2 = py + sy * bh / 2;
          ctx.beginPath();
          ctx.moveTo(cx2 + sx * ck, cy2); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2 + sy * ck);
          ctx.stroke();
        });

        // Confidence readout
        ctx.fillStyle = 'rgba(0,255,120,0.75)';
        ctx.font = "7px 'Share Tech Mono'";
        ctx.fillText(`${(confidence * 100).toFixed(0)}%`, px - bw / 2, py - bh / 2 - 3);
        ctx.fillText(`T${String(i + 1).padStart(2, '0')}`, px + 2, py - bh / 2 - 3);
      }
    });

    // Swarm centroid / aim point
    const centX = W * (0.505 + swarmDrift * 0.3);
    const centY = H * 0.452;
    const aimR = 18 + Math.sin(trackT * 2.5) * 2;

    // Outer ring (pulsing)
    ctx.strokeStyle = `rgba(255,50,50,${0.6 + Math.sin(trackT * 4) * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(centX, centY, aimR * 1.5, 0, Math.PI * 2); ctx.stroke();

    // Inner crosshair
    ctx.strokeStyle = 'rgba(255,50,50,0.92)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(centX, centY, aimR, 0, Math.PI * 2); ctx.stroke();
    const gap = aimR * 0.3;
    const ext = aimR * 0.7;
    ctx.beginPath();
    ctx.moveTo(centX - aimR - ext, centY); ctx.lineTo(centX - aimR - gap, centY);
    ctx.moveTo(centX + aimR + gap, centY); ctx.lineTo(centX + aimR + ext, centY);
    ctx.moveTo(centX, centY - aimR - ext); ctx.lineTo(centX, centY - aimR - gap);
    ctx.moveTo(centX, centY + aimR + gap); ctx.lineTo(centX, centY + aimR + ext);
    ctx.stroke();

    // Aim point dot
    ctx.fillStyle = 'rgba(255,50,50,0.9)';
    ctx.beginPath(); ctx.arc(centX, centY, 2.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255,50,50,0.7)';
    ctx.font = "8px 'Share Tech Mono'";
    ctx.fillText('CENTROID', centX + aimR + 6, centY - 3);
    ctx.fillText('AIM POINT', centX + aimR + 6, centY + 8);

    // Scan line
    const scanY = (trackT * 55) % H;
    ctx.fillStyle = 'rgba(0,255,150,0.04)';
    ctx.fillRect(0, scanY, W, 3);

    // HUD overlays
    monoFont(ctx, 9.5, '#00c896');
    ctx.fillText('LWIR SEEKER - LIVE ACQUISITION', 6, 13);

    const fps = Math.floor(119 + Math.sin(trackT * 7) * 2);
    monoFont(ctx, 8, 'rgba(0,200,150,0.5)');
    ctx.fillText(`${fps} FPS  |  640*480  |  LWIR`, W - 150, 13);

    const det = sensorDrones.length;
    monoFont(ctx, 8.5, 'rgba(255,170,0,0.8)');
    ctx.fillText(`DETECTIONS: ${det}   TRACKER: PN-GUIDANCE   LOCK: SOLID`, 6, H - 8);
  }

  /* ══════════════════════════════════════════════════
     PAYLOAD PANELS — delegated to PAYLOAD3D
     (real-time Three.js warhead-effects viewport,
     styled to match the engine cutaway — instanced
     fragment burst for hard-kill, Verlet-rope carbon
     filaments for soft-kill — see payload3d.js)
  ══════════════════════════════════════════════════ */
  function initPayload() {
    if (window.PAYLOAD3D) window.PAYLOAD3D.init('payloadCanvas', 'payloadLabels');
  }
  function setPayloadMode(mode) {
    if (window.PAYLOAD3D) window.PAYLOAD3D.setMode(mode);
  }
  function drawPayload(dt) {
    if (window.PAYLOAD3D) window.PAYLOAD3D.render(dt);
  }

  /* ══════════════════════════════════════════════════
     TRAJECTORY PANEL
  ══════════════════════════════════════════════════ */
  let trajCanvas, trajCtx;

  function initTrajectory() {
    trajCanvas = document.getElementById('trajCanvas');
    if (!trajCanvas) return;
    trajCtx = setupHiDPI(trajCanvas);
  }

  function drawTrajectory(pts, rocketPos, swarmCenter) {
    if (!trajCtx) return;
    const ctx = trajCtx;
    const W = trajCanvas._cssW || trajCanvas.width;
    const H = trajCanvas._cssH || trajCanvas.height;
    clear(ctx, W, H);
    subtleGrid(ctx, W, H);

    if (!pts || pts.length < 2) {
      monoFont(ctx, 9, 'rgba(0,200,150,0.3)');
      ctx.fillText('AWAITING LAUNCH DATA...', W / 2 - 68, H / 2 + 4);
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const allPts = swarmCenter ? [...pts, swarmCenter] : pts;
    allPts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });

    const pad = 22;
    const sx = (W - pad * 2) / Math.max(maxX - minX, 1);
    const sy = (H - pad * 2) / Math.max(maxY - minY, 1);
    const scale = Math.min(sx, sy, 5);

    const toS = p => ({
      x: pad + (p.x - minX) * scale,
      y: H - pad - (p.y - minY) * scale
    });

    // Glow path
    ctx.save();
    ctx.filter = 'blur(4px)';
    ctx.beginPath();
    const f0 = toS(pts[0]);
    ctx.moveTo(f0.x, f0.y);
    pts.forEach(p => { const s = toS(p); ctx.lineTo(s.x, s.y); });
    ctx.strokeStyle = 'rgba(0,200,150,0.2)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    // Main path
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    pts.forEach(p => { const s = toS(p); ctx.lineTo(s.x, s.y); });
    ctx.strokeStyle = 'rgba(0,220,160,0.75)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Launch point
    const lp = toS(pts[0]);
    ctx.fillStyle = '#00c896';
    ctx.beginPath(); ctx.arc(lp.x, lp.y, 3.5, 0, Math.PI * 2); ctx.fill();
    monoFont(ctx, 7.5, 'rgba(0,200,150,0.8)');
    ctx.fillText('LAUNCH', lp.x + 5, lp.y + 3);

    // Target
    if (swarmCenter) {
      const tp = toS(swarmCenter);
      ctx.strokeStyle = 'rgba(255,60,60,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tp.x - 9, tp.y); ctx.lineTo(tp.x + 9, tp.y);
      ctx.moveTo(tp.x, tp.y - 9); ctx.lineTo(tp.x, tp.y + 9);
      ctx.stroke();
      monoFont(ctx, 7.5, 'rgba(255,60,60,0.8)');
      ctx.fillText('TARGET', tp.x + 7, tp.y + 3);
    }

    // Current rocket position
    if (rocketPos && pts.length > 0) {
      const rp = toS(rocketPos);
      if (rp.x >= 0 && rp.x <= W && rp.y >= 0 && rp.y <= H) {
        const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
        ctx.save();
        ctx.filter = `blur(${2 + pulse * 2}px)`;
        ctx.fillStyle = 'rgba(255,220,0,0.6)';
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,220,0,0.9)';
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    monoFont(ctx, 8, 'rgba(0,200,150,0.4)');
    ctx.fillText('TOP-DOWN TRAJECTORY', 6, 11);
  }

  /* ─── Public API ─── */
  function init() {
    initEngine();
    initAerofoil();
    initTracking();
    initPayload();
    initTrajectory();
  }

  function update(dt, activePhase, pts, rocketPos, swarmCenter) {
    if (activePhase === 'engine')   drawEngine(dt);
    else if (activePhase === 'aerofoil') drawAerofoil(dt);
    else if (activePhase === 'tracking') drawTracking(dt);
    else if (activePhase === 'payload')  drawPayload(dt);
    drawTrajectory(pts, rocketPos, swarmCenter);
  }

  return { init, update, setPayloadMode };
})();
