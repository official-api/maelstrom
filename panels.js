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
     PAYLOAD PANELS
  ══════════════════════════════════════════════════ */
  let payloadT = 0;
  let payloadCanvas, payloadCtx;
  let currentKillMode = 'hard';

  function initPayload() {
    payloadCanvas = document.getElementById('payloadCanvas');
    if (!payloadCanvas) return;
    payloadCtx = setupHiDPI(payloadCanvas);
  }

  function setPayloadMode(mode) { currentKillMode = mode; payloadT = 0; }

  function drawPayload(dt) {
    if (!payloadCtx) return;
    payloadT += dt;
    if (currentKillMode === 'hard') drawHardKillPayload(payloadT);
    else drawSoftKillPayload(payloadT);
  }

  function drawHardKillPayload(t) {
    const ctx = payloadCtx;
    const W = payloadCanvas._cssW || payloadCanvas.width;
    const H = payloadCanvas._cssH || payloadCanvas.height;
    clear(ctx, W, H);
    subtleGrid(ctx, W, H);

    const cx = W * 0.35, cy = H / 2;
    const wh = H * 0.7, ww = W * 0.08;

    // Warhead body - outer casing
    const bodyGrad = ctx.createLinearGradient(cx - ww, cy, cx + ww, cy);
    bodyGrad.addColorStop(0,   '#252e35');
    bodyGrad.addColorStop(0.25,'#3a4850');
    bodyGrad.addColorStop(0.5, '#455560');
    bodyGrad.addColorStop(0.75,'#3a4850');
    bodyGrad.addColorStop(1,   '#1e2830');
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, cx - ww / 2, cy - wh / 2, ww, wh, 3);
    ctx.fill();
    ctx.strokeStyle = '#5a6a74';
    ctx.lineWidth = 1.2;
    roundRect(ctx, cx - ww / 2, cy - wh / 2, ww, wh, 3);
    ctx.stroke();

    // Fragmentation sleeve - tungsten pre-formed fragments
    const sleeveInset = ww * 0.12;
    const sleeveGrad = ctx.createLinearGradient(cx - ww + sleeveInset, cy, cx + ww - sleeveInset, cy);
    sleeveGrad.addColorStop(0, '#1a1a2a');
    sleeveGrad.addColorStop(0.5, '#222235');
    sleeveGrad.addColorStop(1, '#1a1a2a');
    ctx.fillStyle = sleeveGrad;
    ctx.fillRect(cx - ww / 2 + sleeveInset, cy - wh / 2 + 10, ww - sleeveInset * 2, wh - 20);

    // Fragment notch pattern (ball fragments visible in cross-section)
    const fragRows = 14, fragCols = 3;
    const fragH = (wh - 22) / fragRows;
    const fragW = (ww - sleeveInset * 2 - 4) / fragCols;
    for (let r = 0; r < fragRows; r++) {
      for (let c = 0; c < fragCols; c++) {
        const fx = cx - ww / 2 + sleeveInset + 2 + c * fragW + fragW / 2;
        const fy = cy - wh / 2 + 11 + r * fragH + fragH / 2;
        ctx.fillStyle = '#2a2a3a';
        ctx.beginPath();
        ctx.arc(fx, fy, fragW * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Explosive core (HMX/RDX - tan-yellow)
    const coreGrad = ctx.createLinearGradient(cx - ww * 0.15, cy, cx + ww * 0.15, cy);
    coreGrad.addColorStop(0, '#5a5020');
    coreGrad.addColorStop(0.5, '#7a7030');
    coreGrad.addColorStop(1, '#5a5020');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(cx - ww / 2 + sleeveInset + fragW, cy - wh / 2 + 12, fragW, wh - 24);

    // Fuze (nose)
    ctx.fillStyle = '#2a3840';
    ctx.beginPath();
    ctx.arc(cx, cy - wh / 2 - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a5860';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Fuze wire
    ctx.strokeStyle = '#cc8800';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx, cy - wh / 2); ctx.lineTo(cx, cy - wh / 2 - 4); ctx.stroke();

    // ── Animated fragment dispersion (right side)
    const deployPhase = (t % 3.2) / 3.2;
    const fragCount = 40;
    for (let i = 0; i < fragCount; i++) {
      const angle = -Math.PI * 0.55 + (i / fragCount) * Math.PI * 1.1;
      const fDist = deployPhase * 80;
      const fOpacity = Math.max(0, (1 - deployPhase) * 0.9 + 0.1);
      const fx2 = cx + ww / 2 + Math.cos(angle) * fDist;
      const fy2 = cy + Math.sin(angle) * fDist;
      const fragSize = 2 + Math.random() * 2;
      ctx.fillStyle = `rgba(200,190,160,${fOpacity})`;
      ctx.beginPath();
      ctx.rect(fx2 - fragSize / 2, fy2 - fragSize / 2, fragSize, fragSize);
      ctx.fill();

      // Fragment velocity vectors (short lines)
      if (deployPhase > 0.05 && deployPhase < 0.5) {
        ctx.strokeStyle = `rgba(255,180,50,${fOpacity * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(fx2, fy2);
        ctx.lineTo(fx2 + Math.cos(angle) * 8, fy2 + Math.sin(angle) * 8);
        ctx.stroke();
      }
    }

    // Dispersion cone boundary
    if (deployPhase > 0.08) {
      const coneLen = deployPhase * 85;
      const halfAngle = Math.PI * 0.55;
      ctx.strokeStyle = `rgba(255,120,0,${0.35 * (1 - deployPhase)})`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cx + ww / 2, cy);
      ctx.lineTo(cx + ww / 2 + Math.cos(-halfAngle) * coneLen, cy + Math.sin(-halfAngle) * coneLen);
      ctx.moveTo(cx + ww / 2, cy);
      ctx.lineTo(cx + ww / 2 + Math.cos(halfAngle) * coneLen, cy + Math.sin(halfAngle) * coneLen);
      ctx.stroke();
      ctx.setLineDash([]);

      // Kill radius arc
      ctx.strokeStyle = `rgba(255,60,0,${0.2 * (1 - deployPhase)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx + ww / 2, cy, coneLen, -halfAngle, halfAngle);
      ctx.stroke();
    }

    // Annotations
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,150,0.35)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 4]);
    dashed(ctx, cx, cy - wh / 2 - 2, cx, cy - wh / 2 - 20, 'rgba(0,200,150,0.35)');
    annoLabel(ctx, 'W FRAG SLEEVE (W-Ni-Fe)', cx - 50, cy - wh / 2 - 23, 'rgba(0,200,150,0.7)', 8);
    dashed(ctx, cx + ww / 2 + 4, cy, cx + ww / 2 + 40, cy - 25, 'rgba(0,200,150,0.35)');
    annoLabel(ctx, '±35° CONE', cx + ww / 2 + 42, cy - 23, 'rgba(255,150,0,0.8)', 8);
    dashed(ctx, cx, cy + wh / 2 + 2, cx, cy + wh / 2 + 16, 'rgba(0,200,150,0.35)');
    annoLabel(ctx, 'PROX. FUZE', cx - 22, cy + wh / 2 + 26, 'rgba(255,200,0,0.7)', 8);
    ctx.setLineDash([]);
    ctx.restore();

    monoFont(ctx, 9.5, '#00c896');
    ctx.fillText('HARD KILL - FRAG WARHEAD CROSS-SECTION', 6, 13);
    monoFont(ctx, 8, 'rgba(255,100,80,0.8)');
    ctx.fillText(`R_KILL: 15m  V_FRAG: >400 m/s  FUZE: PROX+IMPACT`, 6, H - 8);
  }

  function drawSoftKillPayload(t) {
    const ctx = payloadCtx;
    const W = payloadCanvas._cssW || payloadCanvas.width;
    const H = payloadCanvas._cssH || payloadCanvas.height;
    clear(ctx, W, H);
    subtleGrid(ctx, W, H);

    const cx = W * 0.3, cy = H / 2;
    const ph = H * 0.65, pw = W * 0.07;

    // Canister body
    const canGrad = ctx.createLinearGradient(cx - pw, cy, cx + pw, cy);
    canGrad.addColorStop(0, '#1e2830');
    canGrad.addColorStop(0.3, '#2e3e48');
    canGrad.addColorStop(0.7, '#384858');
    canGrad.addColorStop(1, '#1e2830');
    ctx.fillStyle = canGrad;
    roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 3);
    ctx.fill();
    ctx.strokeStyle = '#4a6070';
    ctx.lineWidth = 1.2;
    roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 3);
    ctx.stroke();

    // CF package (compressed tow)
    const packRows = 18;
    for (let r = 0; r < packRows; r++) {
      const py2 = cy - ph / 2 + 8 + r * ((ph - 16) / packRows);
      const darkness = 0.08 + (r % 2) * 0.05;
      ctx.fillStyle = `rgb(${Math.floor(darkness * 255)}, ${Math.floor(darkness * 255)}, ${Math.floor(darkness * 255)})`;
      ctx.fillRect(cx - pw / 2 + 3, py2, pw - 6, (ph - 16) / packRows - 0.5);
    }

    // Ejection charge at base
    const deployPhase = (t % 3.5) / 3.5;
    if (deployPhase < 0.12) {
      const flashAlpha = 1 - deployPhase / 0.12;
      const flashGrad = ctx.createRadialGradient(cx, cy + ph / 2, 0, cx, cy + ph / 2, 16);
      flashGrad.addColorStop(0, `rgba(255,220,120,${flashAlpha})`);
      flashGrad.addColorStop(0.5, `rgba(255,100,0,${flashAlpha * 0.5})`);
      flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath(); ctx.arc(cx, cy + ph / 2, 16, 0, Math.PI * 2); ctx.fill();
    }

    // Carbon fibers deploying - detailed filament simulation
    const fiberCount = 80;
    for (let i = 0; i < fiberCount; i++) {
      const seed  = i * 137.5;
      const angle = (seed % 360) * Math.PI / 180;
      const fLen  = deployPhase * (25 + (seed % 60));
      const startX = cx + (Math.sin(seed * 7) * pw * 0.4);
      const startY = cy + (Math.cos(seed * 7) * ph * 0.35);
      const alpha  = Math.min(1, deployPhase * 3.5) * (0.4 + (seed % 10) * 0.05);

      const brightness = 120 + (seed % 80);
      const blueShift  = Math.floor(brightness * 1.3);
      ctx.strokeStyle = `rgba(${brightness - 40},${brightness},${Math.min(255, blueShift)},${alpha})`;
      ctx.lineWidth    = 0.5 + (seed % 3) * 0.3;

      // Curled fibers with turbulence
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const cp1x = startX + Math.cos(angle + 0.6) * fLen * 0.4;
      const cp1y = startY + Math.sin(angle + 0.6) * fLen * 0.4;
      const cp2x = startX + Math.cos(angle - 0.3) * fLen * 0.8;
      const cp2y = startY + Math.sin(angle - 0.3) * fLen * 0.8;
      const ex   = startX + Math.cos(angle) * fLen;
      const ey   = startY + Math.sin(angle) * fLen;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
      ctx.stroke();
    }

    // EMP/EM glow (CF conducts - shorts electronics)
    if (deployPhase > 0.3) {
      const empAlpha = Math.sin(deployPhase * Math.PI) * 0.15;
      ctx.fillStyle = `rgba(50,150,255,${empAlpha})`;
      ctx.beginPath();
      ctx.arc(cx + pw / 2 + 40, cy, 50, 0, Math.PI * 2);
      ctx.fill();
    }

    // Annotations
    dashed(ctx, cx, cy - ph / 2 - 2, cx, cy - ph / 2 - 18, 'rgba(0,200,150,0.35)');
    annoLabel(ctx, 'COMPRESSED CF TOW', cx - 44, cy - ph / 2 - 22, 'rgba(0,200,150,0.7)', 8);
    dashed(ctx, cx + pw / 2 + 4, cy - 10, cx + pw / 2 + 42, cy - 25, 'rgba(0,200,150,0.35)');
    annoLabel(ctx, 'CF FILAMENTS', cx + pw / 2 + 44, cy - 23, 'rgba(100,180,255,0.8)', 8);
    dashed(ctx, cx, cy + ph / 2 + 2, cx, cy + ph / 2 + 16, 'rgba(0,200,150,0.35)');
    annoLabel(ctx, 'PYRO EJECT CHARGE', cx - 46, cy + ph / 2 + 26, 'rgba(255,200,0,0.7)', 8);

    monoFont(ctx, 9.5, '#00aaff');
    ctx.fillText('SOFT KILL - CARBON FIBRE BURST', 6, 13);
    monoFont(ctx, 8, 'rgba(100,180,255,0.8)');
    ctx.fillText(`R_EFFECT: 20m  ENTANGLEMENT + ROTOR JAM + SHORTS`, 6, H - 8);
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
