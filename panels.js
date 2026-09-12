/* ═══════════════════════════════════════════
   MAELSTROM — RIGHT PANEL CANVAS ANIMATIONS
   Engine, Aerofoil, Tracking, Payload panels
   ═══════════════════════════════════════════ */

const PANELS = (() => {

  /* ─── Shared helpers ─── */
  function clear(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }

  function gridLines(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,150,0.06)';
    ctx.lineWidth = 0.5;
    const step = 20;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();
  }

  function mono(ctx, size, col) {
    ctx.font = `${size}px 'Share Tech Mono', monospace`;
    ctx.fillStyle = col || 'rgba(0,200,150,0.7)';
  }

  function label(ctx, txt, x, y, col) {
    mono(ctx, 9, col || 'rgba(0,200,150,0.5)');
    ctx.fillText(txt, x, y);
  }

  /* ═══════════════════════════════════════
     ENGINE CROSS-SECTION PANEL
     ═══════════════════════════════════════ */
  let engineT = 0;
  let engineCanvas, engineCtx;

  function initEngine() {
    engineCanvas = document.getElementById('engineCanvas');
    if (!engineCanvas) return;
    engineCtx = engineCanvas.getContext('2d');
  }

  function drawEngine(dt) {
    if (!engineCtx) return;
    engineT += dt;
    const ctx = engineCtx;
    const W = engineCanvas.width;
    const H = engineCanvas.height;
    clear(ctx, W, H);
    gridLines(ctx, W, H);

    const cx = W / 2;
    const cy = H / 2;

    // ── Outer casing
    const caseW = W * 0.75, caseH = H * 0.42;
    const caseX = (W - caseW) / 2, caseY = (H - caseH) / 2;
    ctx.save();
    ctx.strokeStyle = '#4a6070';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#111820';
    ctx.beginPath();
    ctx.rect(caseX, caseY, caseW, caseH);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ── Propellant grain (HTPB — beige/tan)
    const grainInset = 10;
    const grainX = caseX + grainInset;
    const grainW = caseW - grainInset * 2 - 38; // leave nozzle space
    const grainH = caseH - grainInset * 2;
    const grainY = caseY + grainInset;

    const grainGrad = ctx.createLinearGradient(grainX, grainY, grainX, grainY + grainH);
    grainGrad.addColorStop(0, '#6a5a30');
    grainGrad.addColorStop(0.5, '#8a7040');
    grainGrad.addColorStop(1, '#5a4a25');
    ctx.fillStyle = grainGrad;
    ctx.fillRect(grainX, grainY, grainW, grainH);

    // ── Core bore (burning cavity)
    const coreR = grainH * 0.22 + Math.sin(engineT * 4) * 1.5;
    const coreCx = grainX + grainW * 0.45;
    const coreCy = cy;

    const coreGrad = ctx.createRadialGradient(coreCx, coreCy, 0, coreCx, coreCy, coreR);
    coreGrad.addColorStop(0, 'rgba(255,255,200,1)');
    coreGrad.addColorStop(0.3, 'rgba(255,140,0,0.9)');
    coreGrad.addColorStop(0.7, 'rgba(255,60,0,0.6)');
    coreGrad.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(coreCx, coreCy, coreR * 4.0, coreR, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hot gas stream toward nozzle
    const gasX = grainX + grainW;
    for (let i = 0; i < 8; i++) {
      const t = ((engineT * 3 + i * 0.4) % 1);
      const gx = gasX + t * 32;
      const gy = coreCy + (Math.random() - 0.5) * (grainH * 0.3 * (1 - t));
      const alpha = 1 - t;
      ctx.fillStyle = `rgba(255,${100 + Math.floor(t * 100)},0,${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(gx, gy, 3 - t * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Nozzle block
    const nozX = caseX + caseW - 38, nozW = 38;
    const nozGrad = ctx.createLinearGradient(nozX, caseY, nozX, caseY + caseH);
    nozGrad.addColorStop(0, '#2a3840');
    nozGrad.addColorStop(0.5, '#3a4a58');
    nozGrad.addColorStop(1, '#2a3840');
    ctx.fillStyle = nozGrad;
    // Converging nozzle shape
    ctx.beginPath();
    ctx.moveTo(nozX, caseY);
    ctx.lineTo(nozX + nozW, caseY + caseH * 0.25);
    ctx.lineTo(nozX + nozW, caseY + caseH * 0.75);
    ctx.lineTo(nozX, caseY + caseH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#556070';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Throat highlight
    ctx.strokeStyle = 'rgba(0,200,150,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nozX + nozW, caseY + caseH * 0.35);
    ctx.lineTo(nozX + nozW, caseY + caseH * 0.65);
    ctx.stroke();

    // ── Plume outside nozzle
    const plumeX = caseX + caseW;
    const plumeW = W - plumeX - 4;
    for (let i = 0; i < 15; i++) {
      const t2 = ((engineT * 5 + i * 0.3) % 1);
      const spread = t2 * plumeW * 0.5;
      const px = plumeX + t2 * plumeW;
      const py = coreCy + (Math.random() - 0.5) * spread;
      const alpha2 = (1 - t2) * 0.9;
      const col = `rgba(255,${Math.floor(200 * (1 - t2))},0,${alpha2})`;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 3 + t2 * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Annotation lines
    ctx.strokeStyle = 'rgba(0,200,150,0.35)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);

    // Label: HTPB/AP Propellant
    annoLine(ctx, grainX + grainW * 0.3, caseY - 1, grainX + grainW * 0.3, caseY - 16);
    label(ctx, 'HTPB/AP/Al GRAIN', grainX + 2, caseY - 20);

    // Label: Burning Core
    annoLine(ctx, coreCx, coreCy - coreR - 2, coreCx, caseY - 1);
    label(ctx, 'CORE BORE', coreCx - 20, caseY - 20);

    // Label: Nozzle
    annoLine(ctx, nozX + nozW - 2, caseY + caseH + 1, nozX + nozW - 2, caseY + caseH + 16);
    label(ctx, 'CONV. NOZZLE', nozX - 20, caseY + caseH + 25);

    ctx.setLineDash([]);

    // ── Title
    mono(ctx, 10, '#00c896');
    ctx.fillText('ENGINE CROSS-SECTION — FIRING', 8, 12);

    // ── Pressure readout
    const pct = 0.78 + Math.sin(engineT * 2.3) * 0.07;
    mono(ctx, 9, 'rgba(255,170,0,0.8)');
    ctx.fillText(`CHAMBER P: ${(pct * 6.8).toFixed(1)} MPa`, W - 120, H - 8);
  }

  function annoLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /* ═══════════════════════════════════════
     AEROFOIL PANEL
     ═══════════════════════════════════════ */
  let aeroT = 0;
  let aeroCanvas, aeroCtx;
  const streamParticles = [];

  function initAerofoil() {
    aeroCanvas = document.getElementById('aerofoilCanvas');
    if (!aeroCanvas) return;
    aeroCtx = aeroCanvas.getContext('2d');
    // Seed stream particles
    for (let i = 0; i < 30; i++) {
      streamParticles.push({
        x: Math.random() * aeroCanvas.width,
        y: 15 + Math.random() * (aeroCanvas.height - 30),
        speed: 1.5 + Math.random() * 2.5,
        lane: Math.random()
      });
    }
  }

  function naca0008(x) {
    // NACA 0008 thickness equation
    const t = 0.08;
    return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
  }

  function drawAerofoil(dt) {
    if (!aeroCtx) return;
    aeroT += dt;
    const ctx = aeroCtx;
    const W = aeroCanvas.width;
    const H = aeroCanvas.height;
    clear(ctx, W, H);
    gridLines(ctx, W, H);

    const cx = W / 2, cy = H / 2;
    const chord = W * 0.55;
    const foilX = W * 0.18;

    // AoA — slight angle to show control
    const aoaDeg = 6 + Math.sin(aeroT * 0.8) * 4;
    const aoa = aoaDeg * Math.PI / 180;

    ctx.save();
    ctx.translate(cx - chord * 0.1, cy);
    ctx.rotate(aoa);

    // Build foil path
    const upper = [], lower = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const xn = i / steps;
      const y = naca0008(xn);
      upper.push({ x: xn * chord - chord / 2, y: -y * chord });
      lower.push({ x: xn * chord - chord / 2, y: y * chord });
    }

    // Fill foil
    const foilGrad = ctx.createLinearGradient(-chord / 2, -chord * 0.08, -chord / 2, chord * 0.08);
    foilGrad.addColorStop(0, '#3a5566');
    foilGrad.addColorStop(0.5, '#556070');
    foilGrad.addColorStop(1, '#2a3840');
    ctx.fillStyle = foilGrad;
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    upper.forEach(p => ctx.lineTo(p.x, p.y));
    for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i].x, lower[i].y);
    ctx.closePath();
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#7a9aaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // ── Streamlines
    const spd = 2.5 + Math.sin(aeroT) * 0.3;
    for (let i = 0; i < streamParticles.length; i++) {
      const p = streamParticles[i];
      p.x += p.speed * spd * 0.3;
      if (p.x > W + 10) { p.x = -10; p.y = 15 + Math.random() * (H - 30); }

      // Color by proximity to foil (blue = fast upper, red = slow lower)
      const dy = p.y - cy;
      const isAbove = dy < 0;
      const distFromCenter = Math.abs(dy) / (H / 2);
      let hue = isAbove ? 180 : 0;
      const alpha = 0.4 + distFromCenter * 0.3;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - p.speed * 4, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // ── Pressure labels
    ctx.save();
    ctx.font = "9px 'Share Tech Mono', monospace";

    // High pressure lower
    ctx.fillStyle = 'rgba(255,100,100,0.7)';
    ctx.fillText('▲ HIGH P', foilX - 5, cy + 40);

    // Low pressure upper
    ctx.fillStyle = 'rgba(100,180,255,0.7)';
    ctx.fillText('▼ LOW P', foilX - 5, cy - 32);

    // AoA readout
    ctx.fillStyle = 'rgba(0,200,150,0.8)';
    ctx.fillText(`AoA: ${aoaDeg.toFixed(1)}°`, W - 80, 14);

    ctx.restore();

    // ── Force vector
    const liftMag = 18 + aoaDeg * 2.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,150,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 8, cy - liftMag);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    mono(ctx, 10, '#00c896');
    ctx.fillText('CONTROL FIN — NACA 0008 PROFILE', 8, 12);
    mono(ctx, 9, 'rgba(0,200,150,0.5)');
    ctx.fillText(`MACH: 0.85–1.4  |  SWEEP: RECT`, 8, H - 8);
  }

  /* ═══════════════════════════════════════
     OPTICAL TRACKING PANEL
     ═══════════════════════════════════════ */
  let trackT = 0;
  let trackCanvas, trackCtx;

  // Simulated drone positions in "sensor view"
  const sensorDrones = [
    { x: 0.42, y: 0.38 }, { x: 0.55, y: 0.45 }, { x: 0.48, y: 0.55 },
    { x: 0.62, y: 0.35 }, { x: 0.38, y: 0.52 }, { x: 0.58, y: 0.60 },
    { x: 0.44, y: 0.30 }, { x: 0.52, y: 0.42 }, { x: 0.65, y: 0.50 }
  ];

  function initTracking() {
    trackCanvas = document.getElementById('trackingCanvas');
    if (!trackCanvas) return;
    trackCtx = trackCanvas.getContext('2d');
  }

  function drawTracking(dt) {
    if (!trackCtx) return;
    trackT += dt;
    const ctx = trackCtx;
    const W = trackCanvas.width;
    const H = trackCanvas.height;
    clear(ctx, W, H);

    // LWIR sensor background — thermal noise
    for (let i = 0; i < 200; i++) {
      const tx = Math.random() * W;
      const ty = Math.random() * H;
      const bright = Math.random() * 0.08;
      ctx.fillStyle = `rgba(0,${Math.floor(bright * 255)},${Math.floor(bright * 180)},0.4)`;
      ctx.fillRect(tx, ty, 1, 1);
    }

    // Sky gradient in sensor (IR false-colour)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, 'rgba(0,10,30,0.8)');
    bgGrad.addColorStop(1, 'rgba(0,20,10,0.6)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Scan lines
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, W, 1);
    }

    // Drone blobs in IR (hot — bright)
    const drift = Math.sin(trackT * 0.5) * 0.02;
    sensorDrones.forEach((d, i) => {
      const px = (d.x + drift * (i % 3 === 0 ? 1 : -1)) * W;
      const py = (d.y + Math.sin(trackT * 0.8 + i) * 0.01) * H;

      // Thermal glow
      const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, 14);
      glowGrad.addColorStop(0, 'rgba(255,255,220,0.95)');
      glowGrad.addColorStop(0.3, 'rgba(255,140,0,0.6)');
      glowGrad.addColorStop(0.7, 'rgba(255,60,0,0.2)');
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();

      // Bounding box
      const blink = Math.sin(trackT * 6 + i) > -0.5;
      if (blink) {
        const bw = 28 + Math.sin(trackT * 3 + i) * 3;
        const bh = 18;
        ctx.strokeStyle = 'rgba(0,255,120,0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - bw / 2, py - bh / 2, bw, bh);

        // Corner ticks
        const tk = 5;
        ['tl', 'tr', 'bl', 'br'].forEach(corner => {
          const cx2 = corner.includes('l') ? px - bw / 2 : px + bw / 2;
          const cy2 = corner.includes('t') ? py - bh / 2 : py + bh / 2;
          const sx = corner.includes('l') ? 1 : -1;
          const sy = corner.includes('t') ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(cx2, cy2 + sy * tk);
          ctx.lineTo(cx2, cy2);
          ctx.lineTo(cx2 + sx * tk, cy2);
          ctx.stroke();
        });

        // Label
        ctx.fillStyle = 'rgba(0,255,120,0.8)';
        ctx.font = "8px 'Share Tech Mono'";
        ctx.fillText(`T${String(i + 1).padStart(2, '0')}`, px - bw / 2, py - bh / 2 - 3);
      }
    });

    // Centroid crosshair — aim point
    const centX = W * (0.51 + drift * 0.5);
    const centY = H * 0.45;
    const aimR = 16 + Math.sin(trackT * 3) * 2;

    ctx.strokeStyle = 'rgba(255,60,60,0.9)';
    ctx.lineWidth = 1.5;
    // Circle
    ctx.beginPath();
    ctx.arc(centX, centY, aimR, 0, Math.PI * 2);
    ctx.stroke();
    // Cross
    ctx.beginPath();
    ctx.moveTo(centX - aimR - 6, centY); ctx.lineTo(centX - aimR + 4, centY);
    ctx.moveTo(centX + aimR - 4, centY); ctx.lineTo(centX + aimR + 6, centY);
    ctx.moveTo(centX, centY - aimR - 6); ctx.lineTo(centX, centY - aimR + 4);
    ctx.moveTo(centX, centY + aimR - 4); ctx.lineTo(centX, centY + aimR + 6);
    ctx.stroke();

    // Aim label
    ctx.fillStyle = 'rgba(255,60,60,0.8)';
    ctx.font = "8px 'Share Tech Mono'";
    ctx.fillText('AIM PT', centX + aimR + 4, centY + 3);

    // ── HUD overlays
    mono(ctx, 10, '#00c896');
    ctx.fillText('LWIR SENSOR — LIVE FEED', 6, 13);

    // Detection count
    mono(ctx, 9, 'rgba(255,170,0,0.8)');
    ctx.fillText(`DETECTIONS: ${sensorDrones.length}  CONF: 0.97`, 6, H - 8);

    // Scan bar
    const scanY = (trackT * 60) % H;
    ctx.fillStyle = 'rgba(0,255,150,0.05)';
    ctx.fillRect(0, scanY, W, 4);

    // Frame counter
    const fps = Math.floor(118 + Math.sin(trackT * 5) * 3);
    mono(ctx, 9, 'rgba(0,200,150,0.5)');
    ctx.fillText(`${fps} FPS`, W - 48, 13);
  }

  /* ═══════════════════════════════════════
     PAYLOAD PANEL (Hard Kill / Soft Kill)
     ═══════════════════════════════════════ */
  let payloadT = 0;
  let payloadCanvas, payloadCtx;
  let currentKillMode = 'hard';

  function initPayload() {
    payloadCanvas = document.getElementById('payloadCanvas');
    if (!payloadCanvas) return;
    payloadCtx = payloadCanvas.getContext('2d');
  }

  function setPayloadMode(mode) {
    currentKillMode = mode;
    payloadT = 0;
  }

  function drawPayload(dt) {
    if (!payloadCtx) return;
    payloadT += dt;
    if (currentKillMode === 'hard') drawHardKillPayload(payloadT);
    else drawSoftKillPayload(payloadT);
  }

  function drawHardKillPayload(t) {
    const ctx = payloadCtx;
    const W = payloadCanvas.width;
    const H = payloadCanvas.height;
    clear(ctx, W, H);
    gridLines(ctx, W, H);

    const cx = W * 0.38, cy = H / 2;

    // Warhead body
    const wh = 90, ww = 28;
    const bodyGrad = ctx.createLinearGradient(cx - ww, cy - wh / 2, cx + ww, cy + wh / 2);
    bodyGrad.addColorStop(0, '#303840');
    bodyGrad.addColorStop(0.5, '#4a5a60');
    bodyGrad.addColorStop(1, '#252e35');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.rect(cx - ww / 2, cy - wh / 2, ww, wh);
    ctx.fill();
    ctx.strokeStyle = '#5a6a70';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fragmentation sleeve (tungsten — darker rings)
    const fragSleeveGrad = ctx.createLinearGradient(cx - ww / 2, cy - wh / 2, cx - ww / 2, cy + wh / 2);
    fragSleeveGrad.addColorStop(0, '#1a1a2a');
    fragSleeveGrad.addColorStop(0.5, '#252535');
    fragSleeveGrad.addColorStop(1, '#1a1a2a');
    ctx.fillStyle = fragSleeveGrad;
    ctx.fillRect(cx - ww / 2 + 3, cy - wh / 2 + 8, ww - 6, wh - 16);

    // Fragment notches
    const notchCount = 10;
    for (let i = 0; i < notchCount; i++) {
      const fy = (cy - wh / 2 + 10) + i * ((wh - 20) / notchCount);
      ctx.strokeStyle = 'rgba(150,160,180,0.4)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - ww / 2 + 3, fy);
      ctx.lineTo(cx + ww / 2 - 3, fy);
      ctx.stroke();
    }

    // Explosive core
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
    coreGrad.addColorStop(0, 'rgba(255,220,100,0.9)');
    coreGrad.addColorStop(0.5, 'rgba(200,80,0,0.5)');
    coreGrad.addColorStop(1, 'rgba(150,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, wh / 2 - 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Animated fragment dispersion (right side)
    const deployPhase = (t % 3) / 3;
    const fragCount = 28;
    for (let i = 0; i < fragCount; i++) {
      const angle = (i / fragCount) * Math.PI * 2;
      const coneAngle = Math.PI / 6; // 30° half-cone
      const clampedAngle = angle; // full sphere for cross-section view
      const fDist = deployPhase * 55;
      const fOpacity = Math.max(0, 1 - deployPhase * 1.2);

      // Only show right hemisphere for cross section
      if (Math.cos(angle) > -0.2) {
        const fx = cx + Math.cos(angle) * fDist;
        const fy = cy + Math.sin(angle) * fDist;
        ctx.fillStyle = `rgba(200,180,140,${fOpacity})`;
        ctx.beginPath();
        ctx.rect(fx - 1.5, fy - 1.5, 3, 3);
        ctx.fill();
      }
    }

    // Coverage cone lines
    if (deployPhase > 0.1) {
      const coneA = Math.PI / 5;
      const coneLen = deployPhase * 60;
      ctx.strokeStyle = `rgba(255,150,0,${0.4 * (1 - deployPhase)})`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx + ww / 2, cy);
      ctx.lineTo(cx + ww / 2 + Math.cos(coneA) * coneLen, cy - Math.sin(coneA) * coneLen);
      ctx.moveTo(cx + ww / 2, cy);
      ctx.lineTo(cx + ww / 2 + Math.cos(coneA) * coneLen, cy + Math.sin(coneA) * coneLen);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Annotations
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,150,0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);

    annoLine2(ctx, cx, cy - wh / 2 - 1, cx, cy - wh / 2 - 14);
    label(ctx, 'W-FRAG SLEEVE', cx - 38, cy - wh / 2 - 17);

    annoLine2(ctx, cx + ww / 2, cy, cx + ww / 2 + 30, cy - 20);
    label(ctx, '±30° CONE', cx + ww / 2 + 32, cy - 18);

    ctx.setLineDash([]);
    ctx.restore();

    mono(ctx, 10, '#00c896');
    ctx.fillText('HARD KILL — FRAG WARHEAD', 6, 13);
    mono(ctx, 9, 'rgba(255,100,100,0.7)');
    ctx.fillText(`R_KILL: 15m  V_FRAG: >400 m/s`, 6, H - 8);
  }

  function drawSoftKillPayload(t) {
    const ctx = payloadCtx;
    const W = payloadCanvas.width;
    const H = payloadCanvas.height;
    clear(ctx, W, H);
    gridLines(ctx, W, H);

    const cx = W * 0.38, cy = H / 2;

    // Payload canister
    const ph = 70, pw = 24;
    const canGrad = ctx.createLinearGradient(cx - pw, 0, cx + pw, 0);
    canGrad.addColorStop(0, '#283040');
    canGrad.addColorStop(0.5, '#3a4a58');
    canGrad.addColorStop(1, '#202830');
    ctx.fillStyle = canGrad;
    ctx.beginPath();
    ctx.rect(cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.fill();
    ctx.strokeStyle = '#4a6070';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Carbon fibre pack inside
    const packGrad = ctx.createLinearGradient(cx - pw / 2 + 4, 0, cx + pw / 2 - 4, 0);
    packGrad.addColorStop(0, '#1a1a1a');
    packGrad.addColorStop(0.5, '#222222');
    packGrad.addColorStop(1, '#111111');
    ctx.fillStyle = packGrad;
    ctx.fillRect(cx - pw / 2 + 4, cy - ph / 2 + 8, pw - 8, ph - 16);

    // Deployment phase
    const deployPhase = (t % 3.5) / 3.5;

    // Ejection charge (small flash at base)
    if (deployPhase < 0.15) {
      const flashA = 1 - deployPhase / 0.15;
      const flashGrad = ctx.createRadialGradient(cx, cy + ph / 2, 0, cx, cy + ph / 2, 12);
      flashGrad.addColorStop(0, `rgba(255,200,100,${flashA})`);
      flashGrad.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(cx, cy + ph / 2, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Carbon fibers deploying
    const fiberCount = 60;
    for (let i = 0; i < fiberCount; i++) {
      const angle = -Math.PI / 2 + (Math.random() * 0.4 - 0.2) + (i / fiberCount) * Math.PI * 2;
      const fLen = deployPhase * (20 + Math.random() * 50);
      const startX = cx + (Math.random() - 0.5) * pw * 0.6;
      const startY = cy + (Math.random() - 0.5) * ph * 0.4;
      const alpha = Math.min(1, deployPhase * 3) * (0.5 + Math.random() * 0.5);

      ctx.strokeStyle = `rgba(${100 + Math.floor(Math.random() * 50)},${150 + Math.floor(Math.random() * 60)},${200 + Math.floor(Math.random() * 55)},${alpha})`;
      ctx.lineWidth = 0.6 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      // Curving fibers
      const cpX = startX + Math.cos(angle + 0.5) * fLen * 0.5;
      const cpY = startY + Math.sin(angle + 0.5) * fLen * 0.5;
      ctx.quadraticCurveTo(cpX, cpY, startX + Math.cos(angle) * fLen, startY + Math.sin(angle) * fLen);
      ctx.stroke();
    }

    // Annotations
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,150,0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);

    annoLine2(ctx, cx, cy - ph / 2 - 1, cx, cy - ph / 2 - 14);
    label(ctx, 'CF PACKAGE', cx - 24, cy - ph / 2 - 17);

    annoLine2(ctx, cx + pw / 2 + 20, cy, cx + pw / 2 + 60, cy - 15);
    label(ctx, 'CF FILAMENTS', cx + pw / 2 + 62, cy - 13);

    ctx.setLineDash([]);
    ctx.restore();

    mono(ctx, 10, '#00aaff');
    ctx.fillText('SOFT KILL — CF BURST', 6, 13);
    mono(ctx, 9, 'rgba(100,180,255,0.7)');
    ctx.fillText(`R_EFFECT: 20m  ENTANGLEMENT  NO DEBRIS`, 6, H - 8);
  }

  function annoLine2(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /* ═══════════════════════════════════════
     TRAJECTORY PANEL
     ═══════════════════════════════════════ */
  let trajCanvas, trajCtx;

  function initTrajectory() {
    trajCanvas = document.getElementById('trajCanvas');
    if (!trajCanvas) return;
    trajCtx = trajCanvas.getContext('2d');
  }

  function drawTrajectory(pts, rocketPos, swarmCenter) {
    if (!trajCtx) return;
    const ctx = trajCtx;
    const W = trajCanvas.width;
    const H = trajCanvas.height;
    clear(ctx, W, H);
    gridLines(ctx, W, H);

    if (!pts || pts.length < 2) {
      // No trajectory yet — show standby grid
      mono(ctx, 9, 'rgba(0,200,150,0.3)');
      ctx.fillText('AWAITING LAUNCH DATA...', W / 2 - 70, H / 2);
      return;
    }

    // Compute bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const allPts = [...pts];
    if (swarmCenter) allPts.push(swarmCenter);

    allPts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });

    const pad = 20;
    const scaleX = (W - pad * 2) / Math.max(maxX - minX, 1);
    const scaleY = (H - pad * 2) / Math.max(maxY - minY, 1);
    const scale = Math.min(scaleX, scaleY, 4);

    const toScreen = (p) => ({
      x: pad + (p.x - minX) * scale,
      y: H - pad - (p.y - minY) * scale
    });

    // Draw trajectory path
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,200,150,0.6)';
    ctx.lineWidth = 1.5;
    const first = toScreen(pts[0]);
    ctx.moveTo(first.x, first.y);
    pts.forEach(p => {
      const sp = toScreen(p);
      ctx.lineTo(sp.x, sp.y);
    });
    ctx.stroke();

    // Glow effect
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,200,150,0.25)';
    ctx.lineWidth = 4;
    ctx.moveTo(first.x, first.y);
    pts.forEach(p => { const sp = toScreen(p); ctx.lineTo(sp.x, sp.y); });
    ctx.stroke();
    ctx.restore();

    // Launch point
    const lp = toScreen(pts[0]);
    ctx.fillStyle = '#00c896';
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, 3, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, 'LAUNCH', lp.x + 5, lp.y - 4, '#00c896');

    // Target
    if (swarmCenter) {
      const tp = toScreen(swarmCenter);
      ctx.strokeStyle = 'rgba(255,60,60,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 5, 0, Math.PI * 2);
      ctx.stroke();
      const crossS = 8;
      ctx.beginPath();
      ctx.moveTo(tp.x - crossS, tp.y); ctx.lineTo(tp.x + crossS, tp.y);
      ctx.moveTo(tp.x, tp.y - crossS); ctx.lineTo(tp.x, tp.y + crossS);
      ctx.stroke();
      label(ctx, 'TARGET', tp.x + 7, tp.y + 3, 'rgba(255,60,60,0.8)');
    }

    // Current position
    if (rocketPos && pts.length > 0) {
      const rp = toScreen(rocketPos);
      if (rp.x >= 0 && rp.x <= W && rp.y >= 0 && rp.y <= H) {
        const pulse = (Math.sin(Date.now() * 0.008) + 1) * 0.5;
        ctx.fillStyle = `rgba(255,220,0,${0.6 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 3 + pulse * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    mono(ctx, 8, 'rgba(0,200,150,0.4)');
    ctx.fillText('TOP-DOWN TRAJECTORY', 6, 10);
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
    if (activePhase === 'engine') drawEngine(dt);
    else if (activePhase === 'aerofoil') drawAerofoil(dt);
    else if (activePhase === 'tracking') drawTracking(dt);
    else if (activePhase === 'payload') drawPayload(dt);

    drawTrajectory(pts, rocketPos, swarmCenter);
  }

  return { init, update, setPayloadMode };
})();
