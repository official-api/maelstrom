/* ═══════════════════════════════════════════
   MAELSTROM — RIGHT PANEL CANVAS ANIMATIONS v2
   High-resolution, technically detailed
   ═══════════════════════════════════════════ */

const PANELS = (() => {

  /* ─── DPI-aware canvas setup ─── */
  function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.offsetWidth || canvas.width;
    const h = canvas.offsetHeight || canvas.height;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvas._cssW = w;
    canvas._cssH = h;
    return ctx;
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

  /* ══════════════════════════════════════════════════
     ENGINE CROSS-SECTION — fully redrawn
     Technically accurate solid propellant cross-section
     with burning core, gas dynamics, nozzle flow
  ══════════════════════════════════════════════════ */
  let engineT = 0;
  let engineCanvas, engineCtx;
  let engineParticles = [];

  function initEngine() {
    engineCanvas = document.getElementById('engineCanvas');
    if (!engineCanvas) return;
    engineCtx = setupHiDPI(engineCanvas);
    // Seed hot gas particles
    engineParticles = [];
  }

  function drawEngine(dt) {
    if (!engineCtx) return;
    engineT += dt;
    const ctx = engineCtx;
    const W = engineCanvas._cssW || engineCanvas.width;
    const H = engineCanvas._cssH || engineCanvas.height;
    clear(ctx, W, H);
    subtleGrid(ctx, W, H);

    // Layout constants
    const caseX  = W * 0.06;
    const caseY  = H * 0.18;
    const caseW  = W * 0.58;
    const caseH  = H * 0.64;
    const nozzX  = caseX + caseW;
    const nozzW  = W * 0.18;
    const coreCy = caseY + caseH * 0.5;

    // ── 1. Outer motor casing (aluminium)
    const casingGrad = ctx.createLinearGradient(caseX, caseY, caseX, caseY + caseH);
    casingGrad.addColorStop(0,   '#5a6a74');
    casingGrad.addColorStop(0.08,'#8a9ea8');
    casingGrad.addColorStop(0.5, '#6a7a84');
    casingGrad.addColorStop(0.92,'#8a9ea8');
    casingGrad.addColorStop(1,   '#4a5a64');
    ctx.fillStyle = casingGrad;
    // Rounded rect for casing
    roundRect(ctx, caseX, caseY, caseW + nozzW * 0.15, caseH, 4);
    ctx.fill();
    ctx.strokeStyle = '#3a4a54';
    ctx.lineWidth = 1.5;
    roundRect(ctx, caseX, caseY, caseW + nozzW * 0.15, caseH, 4);
    ctx.stroke();

    // Casing thickness lines (wall detail)
    const wallT = caseH * 0.065;
    ctx.strokeStyle = 'rgba(60,80,90,0.8)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(caseX + wallT, caseY + wallT);
    ctx.lineTo(caseX + caseW, caseY + wallT);
    ctx.moveTo(caseX + wallT, caseY + caseH - wallT);
    ctx.lineTo(caseX + caseW, caseY + caseH - wallT);
    ctx.stroke();

    // Liner layer (insulating rubber liner inside casing)
    const linerH = caseH - wallT * 2;
    const linerY = caseY + wallT;
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(caseX + wallT, linerY, caseW - wallT * 2, caseH - wallT * 2);

    // ── 2. Propellant grain (HTPB/AP/Al composite — creamy tan)
    const propInset = wallT * 1.6;
    const propY = caseY + propInset;
    const propH = caseH - propInset * 2;
    const propW = caseW - propInset * 2 - 10;
    const propX = caseX + propInset;

    // Propellant colour with slight variation for texture
    const propGrad = ctx.createLinearGradient(propX, propY, propX + propW, propY + propH);
    propGrad.addColorStop(0,   '#b8a060');
    propGrad.addColorStop(0.15,'#c8b070');
    propGrad.addColorStop(0.4, '#d4bb78');
    propGrad.addColorStop(0.6, '#c8b070');
    propGrad.addColorStop(0.85,'#b8a060');
    propGrad.addColorStop(1,   '#a89050');
    ctx.fillStyle = propGrad;
    ctx.fillRect(propX, propY, propW, propH);

    // AP crystal texture (tiny bright flecks)
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 60; i++) {
      const fx = propX + Math.random() * propW;
      const fy = propY + Math.random() * propH;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
      ctx.fillRect(fx, fy, 1 + Math.random() * 2, 1 + Math.random() * 1.5);
    }
    ctx.restore();

    // ── 3. Central perforation (star bore) — the burning cavity
    const boreR   = propH * 0.24 + Math.sin(engineT * 5) * 0.8;
    const boreCx  = propX + propW * 0.48;
    const boreCy  = coreCy;
    const starPts = 6;

    // Star bore shape
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < starPts * 2; i++) {
      const angle = (i / (starPts * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? boreR : boreR * 0.5;
      const px2 = boreCx + Math.cos(angle) * r;
      const py2 = boreCy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    }
    ctx.closePath();

    // Burning surface glow at bore walls
    const burnGrad = ctx.createRadialGradient(boreCx, boreCy, boreR * 0.3, boreCx, boreCy, boreR * 1.1);
    burnGrad.addColorStop(0,   'rgba(255,255,220,0.0)');
    burnGrad.addColorStop(0.7, 'rgba(255,160,0,0.0)');
    burnGrad.addColorStop(0.85,'rgba(255,100,0,0.4)');
    burnGrad.addColorStop(0.93,'rgba(255,200,50,0.9)');
    burnGrad.addColorStop(1,   'rgba(255,255,180,1.0)');
    ctx.fillStyle = burnGrad;
    ctx.fill();
    ctx.restore();

    // Burning inner surface — bright hot zone
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < starPts * 2; i++) {
      const angle = (i / (starPts * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? boreR : boreR * 0.5;
      const px2 = boreCx + Math.cos(angle) * r;
      const py2 = boreCy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    }
    ctx.closePath();

    // Hot gas cavity fill
    const hotGrad = ctx.createRadialGradient(boreCx, boreCy, 0, boreCx, boreCy, boreR);
    hotGrad.addColorStop(0,   'rgba(255,255,240,0.95)');
    hotGrad.addColorStop(0.25,'rgba(255,220,80,0.88)');
    hotGrad.addColorStop(0.55,'rgba(255,120,10,0.75)');
    hotGrad.addColorStop(0.8, 'rgba(220,60,0,0.55)');
    hotGrad.addColorStop(1,   'rgba(180,20,0,0.3)');
    ctx.fillStyle = hotGrad;
    ctx.fill();
    ctx.restore();

    // ── 4. Hot gas particles streaming toward nozzle
    // Spawn new particles
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const r2 = boreR * (0.3 + Math.random() * 0.6);
      engineParticles.push({
        x: boreCx + Math.cos(angle) * r2,
        y: boreCy + Math.sin(angle) * r2,
        vx: 1.5 + Math.random() * 2.5,
        vy: (Math.random() - 0.5) * 0.8,
        life: 1,
        size: 1.5 + Math.random() * 3,
        temp: Math.random()
      });
    }

    // Update & draw particles
    for (let i = engineParticles.length - 1; i >= 0; i--) {
      const p = engineParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      // Funnel toward nozzle centerline
      const dyCent = coreCy - p.y;
      p.vy += dyCent * 0.015;
      p.vx += 0.15;
      p.life -= 0.04;

      if (p.x > nozzX + nozzW + 20 || p.life <= 0) {
        engineParticles.splice(i, 1);
        continue;
      }

      const t2 = 1 - p.life;
      let col;
      if (p.temp > 0.7) col = `rgba(255,255,${Math.floor(200 + p.life * 55)},${p.life * 0.85})`;
      else if (p.temp > 0.4) col = `rgba(255,${Math.floor(140 + p.life * 80)},10,${p.life * 0.8})`;
      else col = `rgba(${Math.floor(180 + p.life * 75)},${Math.floor(60 + p.life * 40)},0,${p.life * 0.7})`;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // ── 5. Nozzle — converging-diverging (de Laval)
    drawNozzle(ctx, nozzX, caseY, nozzW, caseH, coreCy, engineT);

    // ── 6. Exhaust plume outside nozzle
    drawExhaustPlume(ctx, nozzX + nozzW, coreCy, W, H, engineT);

    // ── 7. Pressure contour lines inside bore (Mach lines)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.6;
    for (let m = 0; m < 5; m++) {
      const mx = boreCx + (nozzX - boreCx) * ((m + 1) / 6);
      const spread = (propH * 0.3) * (1 - m / 6);
      ctx.beginPath();
      ctx.moveTo(mx, coreCy - spread);
      ctx.quadraticCurveTo(mx + 10, coreCy, mx, coreCy + spread);
      ctx.stroke();
    }
    ctx.restore();

    // ── 8. Temperature scale bar (right side)
    drawTempScale(ctx, W - 22, H * 0.2, 12, H * 0.6, engineT);

    // ── 9. Annotations
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,150,0.4)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 4]);

    // Grain label
    ctx.beginPath(); ctx.moveTo(propX + propW * 0.3, propY - 1); ctx.lineTo(propX + propW * 0.3, caseY - 14); ctx.stroke();
    annoLabel(ctx, 'HTPB/AP/Al GRAIN', propX, caseY - 18, 'rgba(0,200,150,0.65)', 8.5);

    // Core label
    ctx.beginPath(); ctx.moveTo(boreCx, coreCy - boreR - 2); ctx.lineTo(boreCx, caseY - 14); ctx.stroke();
    annoLabel(ctx, 'STAR BORE', boreCx - 18, caseY - 18, 'rgba(255,180,0,0.7)', 8.5);

    // Nozzle label
    ctx.beginPath(); ctx.moveTo(nozzX + nozzW * 0.5, caseY + caseH + 2); ctx.lineTo(nozzX + nozzW * 0.5, caseY + caseH + 16); ctx.stroke();
    annoLabel(ctx, 'DE LAVAL NOZZLE', nozzX - 10, caseY + caseH + 26, 'rgba(0,200,150,0.65)', 8.5);

    // Burn surface label
    ctx.beginPath(); ctx.moveTo(boreCx + boreR + 2, coreCy); ctx.lineTo(boreCx + boreR + 22, coreCy - 18); ctx.stroke();
    annoLabel(ctx, 'BURN SURFACE', boreCx + boreR + 24, coreCy - 16, 'rgba(255,130,0,0.8)', 8.5);

    ctx.setLineDash([]);
    ctx.restore();

    // ── 10. Readouts
    const chamberP = (6.5 + Math.sin(engineT * 2.2) * 0.4).toFixed(2);
    const chamberT = Math.floor(3200 + Math.sin(engineT * 1.5) * 80);
    const isp      = Math.floor(240 + Math.sin(engineT * 0.8) * 6);

    monoFont(ctx, 9.5, '#00c896');
    ctx.fillText('SOLID PROPELLANT ENGINE — CROSS SECTION', 8, 12);

    monoFont(ctx, 8.5, 'rgba(255,180,0,0.85)');
    ctx.fillText(`Pc: ${chamberP} MPa`, 8, H - 28);
    ctx.fillText(`Tc: ${chamberT} K`, 8, H - 18);
    ctx.fillText(`Isp: ${isp} s`, 8, H - 8);

    monoFont(ctx, 8, 'rgba(0,200,150,0.5)');
    ctx.fillText('BURN TIME: 1.8s  |  HTPB/AP/Al', W * 0.35, H - 8);
  }

  function drawNozzle(ctx, nx, cy, nw, caseH, coreCy, t) {
    // De Laval nozzle silhouette — converging then diverging
    const nozzTop = cy;
    const nozzBot = cy + caseH;
    const wallT = caseH * 0.065;
    const innerH = caseH - wallT * 2;
    const innerTop = nozzTop + wallT;
    const innerBot = nozzBot - wallT;

    // Outer nozzle body (metal)
    const nozzGrad = ctx.createLinearGradient(nx, nozzTop, nx + nw, nozzTop + caseH);
    nozzGrad.addColorStop(0,   '#3a4a54');
    nozzGrad.addColorStop(0.5, '#4a5a64');
    nozzGrad.addColorStop(1,   '#2a3a44');
    ctx.fillStyle = nozzGrad;
    ctx.beginPath();
    ctx.moveTo(nx, nozzTop);
    ctx.lineTo(nx + nw, nozzTop + caseH * 0.3);
    ctx.lineTo(nx + nw, nozzTop + caseH * 0.7);
    ctx.lineTo(nx, nozzBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a3840';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner throat profile — converging-diverging
    const throat = caseH * 0.16;
    const throatX = nx + nw * 0.42;
    const exitH = caseH * 0.28;

    ctx.save();
    // Upper wall
    ctx.beginPath();
    ctx.moveTo(nx, innerTop);
    ctx.bezierCurveTo(nx + nw * 0.3, innerTop, throatX, coreCy - throat, throatX, coreCy - throat);
    ctx.bezierCurveTo(throatX + (nx + nw - throatX) * 0.3, coreCy - throat * 1.1, nx + nw, coreCy - exitH, nx + nw, coreCy - exitH);

    // Lower wall (mirror)
    ctx.lineTo(nx + nw, coreCy + exitH);
    ctx.bezierCurveTo(throatX + (nx + nw - throatX) * 0.3, coreCy + throat * 1.1, throatX, coreCy + throat, throatX, coreCy + throat);
    ctx.bezierCurveTo(nx + nw * 0.3, innerBot, nx, innerBot, nx, innerBot);
    ctx.closePath();

    // Fill with hot gas gradient
    const hotG = ctx.createLinearGradient(nx, coreCy, nx + nw, coreCy);
    hotG.addColorStop(0,   'rgba(255,200,60,0.9)');
    hotG.addColorStop(0.35,'rgba(255,130,20,0.85)');
    hotG.addColorStop(0.6, 'rgba(255,80,0,0.7)');
    hotG.addColorStop(1,   'rgba(200,40,0,0.4)');
    ctx.fillStyle = hotG;
    ctx.fill();
    ctx.restore();

    // Throat highlight ring
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,200,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(throatX, coreCy - throat);
    ctx.lineTo(throatX, coreCy + throat);
    ctx.stroke();
    ctx.restore();

    // Mach number labels in nozzle
    monoFont(ctx, 7.5, 'rgba(255,255,150,0.7)');
    ctx.fillText('M<1', nx + 4, coreCy - 4);
    ctx.fillText('M=1', throatX - 6, coreCy - throat - 5);
    ctx.fillText('M>1', nx + nw - 22, coreCy - 4);
  }

  function drawExhaustPlume(ctx, startX, cy, W, H, t) {
    const plumeW = W - startX - 4;

    // Shock diamonds (Mach diamonds) — characteristic of supersonic exhaust
    const diamondCount = 4;
    for (let d = 0; d < diamondCount; d++) {
      const dx = startX + d * (plumeW / diamondCount) * 0.85;
      const dy = cy;
      const spread = (plumeW * 0.35) * (d / diamondCount + 0.3) * (1 - d * 0.15);
      const alpha = 0.6 - d * 0.12;

      // Expansion fan
      const fg = ctx.createRadialGradient(dx, dy, 0, dx, dy, spread);
      fg.addColorStop(0,   `rgba(255,255,200,${alpha})`);
      fg.addColorStop(0.3, `rgba(255,160,30,${alpha * 0.85})`);
      fg.addColorStop(0.6, `rgba(255,80,0,${alpha * 0.6})`);
      fg.addColorStop(1,   `rgba(180,30,0,0)`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(dx + spread * 0.4, dy, spread * 0.55, spread * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mach disc (normal shock — bright perpendicular band)
      const mdX = dx + spread * 0.9;
      ctx.save();
      ctx.globalAlpha = 0.3 - d * 0.06;
      ctx.strokeStyle = 'rgba(255,255,200,0.8)';
      ctx.lineWidth = 2 - d * 0.3;
      ctx.beginPath();
      ctx.moveTo(mdX, dy - spread * 0.3);
      ctx.lineTo(mdX, dy + spread * 0.3);
      ctx.stroke();
      ctx.restore();
    }

    // Turbulent mixing layer — shear instabilities
    for (let i = 0; i < 22; i++) {
      const tx = startX + ((t * 3 + i * 0.7) % 1) * plumeW * 1.1;
      const spread2 = (tx - startX) / plumeW * (H * 0.22);
      const oy = (Math.sin(t * 4 + i * 1.3) * 0.5) * spread2;
      const r2 = 3 + (tx - startX) / plumeW * 8;
      const alpha2 = Math.max(0, (1 - (tx - startX) / (plumeW * 1.1)) * 0.5);
      const col2 = i % 3 === 0
        ? `rgba(255,220,100,${alpha2})`
        : i % 3 === 1
          ? `rgba(255,120,20,${alpha2 * 0.8})`
          : `rgba(180,80,0,${alpha2 * 0.6})`;
      ctx.beginPath();
      ctx.arc(tx, cy + oy, r2, 0, Math.PI * 2);
      ctx.fillStyle = col2;
      ctx.fill();
    }

    // Plume outer boundary (schlieren-like edge)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,60,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    for (let px = startX; px < W - 4; px += 2) {
      const spread3 = (px - startX) / (W - 4 - startX) * (H * 0.3);
      const wave = Math.sin(px * 0.05 + t * 3) * spread3 * 0.12;
      ctx.lineTo(px, cy - spread3 - wave);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    for (let px = startX; px < W - 4; px += 2) {
      const spread3 = (px - startX) / (W - 4 - startX) * (H * 0.3);
      const wave = Math.sin(px * 0.05 + t * 3 + Math.PI) * spread3 * 0.12;
      ctx.lineTo(px, cy + spread3 + wave);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTempScale(ctx, x, y, w, h, t) {
    // Vertical temperature colour bar
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0,    '#ffffff');
    grad.addColorStop(0.15, '#ffffaa');
    grad.addColorStop(0.35, '#ffaa00');
    grad.addColorStop(0.6,  '#ff4400');
    grad.addColorStop(0.8,  '#882200');
    grad.addColorStop(1,    '#220000');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,200,150,0.3)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, y, w, h);

    monoFont(ctx, 7, 'rgba(255,255,200,0.8)');
    ctx.fillText('3500K', x - 30, y + 8);
    monoFont(ctx, 7, 'rgba(255,180,0,0.8)');
    ctx.fillText('2000K', x - 30, y + h * 0.5);
    monoFont(ctx, 7, 'rgba(180,80,0,0.8)');
    ctx.fillText('800K', x - 26, y + h - 4);

    // Moving indicator
    const prog = (Math.sin(t * 0.8) * 0.5 + 0.5) * 0.35;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x - 4, y + prog * h, 4 + w, 1.5);
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
     AEROFOIL PANEL — CFD-style professional sim
  ══════════════════════════════════════════════════ */
  let aeroT = 0;
  let aeroCanvas, aeroCtx;

  function initAerofoil() {
    aeroCanvas = document.getElementById('aerofoilCanvas');
    if (!aeroCanvas) return;
    aeroCtx = setupHiDPI(aeroCanvas);
  }

  // NACA 0008 thickness function
  function naca0008(xn) {
    const t = 0.08;
    return 5 * t * (0.2969 * Math.sqrt(xn)
                  - 0.1260 * xn
                  - 0.3516 * xn * xn
                  + 0.2843 * xn * xn * xn
                  - 0.1015 * xn * xn * xn * xn);
  }

  // Pressure coefficient (simplified thin-aerofoil at AoA)
  function cpDistrib(xn, aoa_deg) {
    const aoa = aoa_deg * Math.PI / 180;
    // Leading edge suction peak, then pressure recovery
    const suction = -2.5 * aoa / (xn + 0.04);
    const recovery = Math.pow(xn, 0.4) * 0.8 * aoa;
    return Math.max(-4, Math.min(1, suction + recovery - 0.3));
  }

  function drawAerofoil(dt) {
    if (!aeroCtx) return;
    aeroT += dt;
    const ctx = aeroCtx;
    const W = aeroCanvas._cssW || aeroCanvas.width;
    const H = aeroCanvas._cssH || aeroCanvas.height;
    clear(ctx, W, H);

    // Oscillating AoA to mimic active control
    const aoaDeg = 7 + Math.sin(aeroT * 0.7) * 5.5;
    const aoa    = aoaDeg * Math.PI / 180;

    const chord   = W * 0.52;
    const foilX   = W * 0.16;  // leading edge X
    const foilY   = H * 0.54;  // chord line Y

    // ── Pre-compute foil geometry
    const steps = 80;
    const upper = [], lower = [];
    for (let i = 0; i <= steps; i++) {
      const xn = i / steps;
      const yt  = naca0008(xn);
      upper.push({ x: foilX + xn * chord, y: foilY - yt * chord - Math.sin(aoa) * xn * chord * 0.15 });
      lower.push({ x: foilX + xn * chord, y: foilY + yt * chord - Math.sin(aoa) * xn * chord * 0.15 });
    }

    // ── 1. Pressure colour field (Cp contour)
    drawPressureField(ctx, foilX, foilY, chord, upper, lower, aoaDeg, W, H);

    // ── 2. Streamlines with velocity colouring
    drawStreamlines(ctx, foilX, foilY, chord, upper, lower, aoa, W, H, aeroT);

    // ── 3. Aerofoil body
    const foilGrad = ctx.createLinearGradient(foilX, foilY - chord * 0.08, foilX, foilY + chord * 0.08);
    foilGrad.addColorStop(0,   '#4a6070');
    foilGrad.addColorStop(0.35,'#6a8090');
    foilGrad.addColorStop(0.5, '#506070');
    foilGrad.addColorStop(0.65,'#6a8090');
    foilGrad.addColorStop(1,   '#3a5060');
    ctx.fillStyle = foilGrad;
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    upper.forEach(p => ctx.lineTo(p.x, p.y));
    for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i].x, lower[i].y);
    ctx.closePath();
    ctx.fill();

    // Specular highlight on upper surface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    upper.slice(0, Math.floor(steps * 0.5)).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // Foil outline
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    upper.forEach(p => ctx.lineTo(p.x, p.y));
    for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i].x, lower[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#8ab0c0';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ── 4. AoA indicator arc
    drawAoAIndicator(ctx, foilX - 28, foilY, aoa, aoaDeg, chord);

    // ── 5. Cp distribution graph (below foil)
    drawCpGraph(ctx, foilX, H * 0.82, chord, aoaDeg, W, H);

    // ── 6. Force arrows
    const lift = Math.abs(aoaDeg) * 2.8;
    const drag = 0.8 + aoaDeg * 0.15;
    const cx2  = foilX + chord * 0.38;
    const cy2  = foilY;

    // Lift arrow (perpendicular to chord)
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,120,0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx2, cy2);
    ctx.lineTo(cx2, cy2 - lift * 0.9);
    ctx.stroke();
    arrowHead(ctx, cx2, cy2 - lift * 0.9, 0, -1, 'rgba(0,255,120,0.85)');
    ctx.restore();

    // Drag arrow (along chord)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,100,80,0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx2, cy2);
    ctx.lineTo(cx2 + drag * 4, cy2);
    ctx.stroke();
    arrowHead(ctx, cx2 + drag * 4, cy2, 1, 0, 'rgba(255,100,80,0.8)');
    ctx.restore();

    // Arrow labels
    monoFont(ctx, 8, 'rgba(0,255,120,0.8)');
    ctx.fillText(`L: ${lift.toFixed(1)} N`, cx2 + 4, cy2 - lift * 0.9 - 4);
    monoFont(ctx, 8, 'rgba(255,100,80,0.8)');
    ctx.fillText(`D: ${drag.toFixed(2)} N`, cx2 + drag * 4 + 4, cy2 + 4);

    // ── 7. Legend & readouts
    monoFont(ctx, 9.5, '#00c896');
    ctx.fillText('CONTROL FIN — CFD ANALYSIS (NACA 0008)', 6, 12);

    monoFont(ctx, 8.5, 'rgba(0,200,150,0.7)');
    ctx.fillText(`AoA: ${aoaDeg.toFixed(1)}°  |  MACH 0.9`, W - 130, 12);

    // Cp scale
    monoFont(ctx, 7.5, 'rgba(100,180,255,0.8)');
    ctx.fillText('Cp+', W - 30, H * 0.22);
    monoFont(ctx, 7.5, 'rgba(255,80,80,0.8)');
    ctx.fillText('Cp−', W - 30, H * 0.22 + 30);

    // L/D ratio
    const ld = (lift / drag).toFixed(1);
    monoFont(ctx, 8, 'rgba(255,200,0,0.8)');
    ctx.fillText(`L/D: ${ld}`, 8, H - 8);
  }

  function drawPressureField(ctx, foilX, foilY, chord, upper, lower, aoaDeg, W, H) {
    // Simplified pressure field with coloured cells
    const rows = 20, cols = 32;
    const fieldX = foilX - chord * 0.2;
    const fieldW = chord * 1.55;
    const fieldY = foilY - H * 0.42;
    const fieldH = H * 0.78;
    const cellW = fieldW / cols, cellH = fieldH / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = fieldX + c * cellW + cellW / 2;
        const py = fieldY + r * cellH + cellH / 2;

        // Estimate local pressure from proximity to foil
        const xn = (px - foilX) / chord;
        const isOnFoil = xn >= 0 && xn <= 1;
        let cp = 0;

        if (isOnFoil) {
          // Above foil — low pressure (blue)
          if (py < foilY) {
            cp = -1.2 - Math.max(0, cpDistrib(xn, aoaDeg)) * 0.8;
          } else {
            cp = 0.4 + Math.max(0, cpDistrib(xn, -aoaDeg * 0.4)) * 0.3;
          }
        } else {
          // Free stream
          const nearDist = Math.min(Math.abs(py - foilY) / (H * 0.3), 1);
          cp = (py < foilY ? -0.3 : 0.1) * (1 - nearDist);
        }

        // Map Cp to colour (blue=low, red=high)
        const t = (cp + 2) / 3; // normalise to 0-1
        const r2 = t > 0.5 ? (t - 0.5) * 2 : 0;
        const g2 = t > 0.25 && t < 0.75 ? Math.sin((t - 0.25) / 0.5 * Math.PI) * 0.3 : 0;
        const b2 = t < 0.5 ? (0.5 - t) * 2 : 0;

        ctx.fillStyle = `rgba(${Math.floor(r2 * 220)},${Math.floor(g2 * 180)},${Math.floor(b2 * 255)},0.18)`;
        ctx.fillRect(fieldX + c * cellW, fieldY + r * cellH, cellW, cellH);
      }
    }
  }

  function drawStreamlines(ctx, foilX, foilY, chord, upper, lower, aoa, W, H, t) {
    const nLines = 16;
    for (let li = 0; li < nLines; li++) {
      const yStart = foilY - H * 0.42 + (li / (nLines - 1)) * H * 0.78;
      const isUpper = yStart < foilY;
      const distFromChord = Math.abs(yStart - foilY) / (H * 0.35);
      const proximity = Math.max(0, 1 - distFromChord);

      // Speed — faster above (upper surface = lower pressure)
      const speed = isUpper
        ? 1.0 + proximity * 0.7 * (1 + Math.sin(aoa) * 0.8)
        : 0.85 - proximity * 0.15;

      // Velocity colouring: blue=slow, red=fast
      const t2 = Math.min(1, (speed - 0.8) / 0.9);
      const sr = Math.floor(t2 * 255);
      const sg = Math.floor((1 - Math.abs(t2 - 0.5) * 2) * 180);
      const sb = Math.floor((1 - t2) * 255);
      const lineCol = `rgba(${sr},${sg},${sb},0.55)`;

      ctx.save();
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = 0.9 + proximity * 0.5;

      ctx.beginPath();
      let x = -20;
      let y = yStart;
      ctx.moveTo(x, y);

      while (x < W + 20) {
        // Deflect streamline around foil
        const xn = (x - foilX) / chord;
        let dy = 0;
        if (xn >= -0.1 && xn <= 1.1) {
          // Deflect based on foil camber & AoA
          const camber = Math.sin(xn * Math.PI) * aoa * chord * 0.25;
          const boundary = proximity * (isUpper ? -camber : camber) * 0.4;
          dy = boundary * Math.exp(-distFromChord * 3);
        }
        const dx = 2.5 * speed;
        x += dx;
        y += dy;
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Velocity arrow markers along line
      for (let ax = foilX - 30; ax < W - 20; ax += 48) {
        const axn = (ax - foilX) / chord;
        const localSpeed = (xn >= 0 && xn <= 1) ? speed : 1.0;
        const arrowLen = 5 + localSpeed * 4;
        ctx.beginPath();
        ctx.moveTo(ax, yStart);
        ctx.lineTo(ax + arrowLen, yStart);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(ax + arrowLen, yStart);
        ctx.lineTo(ax + arrowLen - 3, yStart - 2);
        ctx.lineTo(ax + arrowLen - 3, yStart + 2);
        ctx.closePath();
        ctx.fillStyle = lineCol;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawCpGraph(ctx, x, y, chord, aoaDeg, W, H) {
    const graphH = H * 0.14;
    const steps = 60;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 2, y - graphH - 2, chord + 4, graphH + 4);
    ctx.strokeStyle = 'rgba(0,200,150,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 2, y - graphH - 2, chord + 4, graphH + 4);

    // Zero line
    const zeroY = y - graphH * 0.35;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, zeroY); ctx.lineTo(x + chord, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // Upper surface Cp
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(80,150,255,0.85)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= steps; i++) {
      const xn = i / steps;
      const cp = -cpDistrib(xn, aoaDeg);
      const px = x + xn * chord;
      const py = zeroY + cp * graphH * 0.28;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Lower surface Cp
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,100,100,0.75)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= steps; i++) {
      const xn = i / steps;
      const cp = cpDistrib(xn, -aoaDeg * 0.35);
      const px = x + xn * chord;
      const py = zeroY + cp * graphH * 0.28;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Axis labels
    monoFont(ctx, 7, 'rgba(0,200,150,0.6)');
    ctx.fillText('Cp', x - 14, y - graphH * 0.5);
    ctx.fillText('x/c', x + chord - 12, y + 3);
    monoFont(ctx, 7, 'rgba(80,150,255,0.8)');
    ctx.fillText('— upper', x + chord - 52, y - graphH * 0.88);
    monoFont(ctx, 7, 'rgba(255,100,100,0.8)');
    ctx.fillText('— lower', x + chord - 52, y - graphH * 0.7);
  }

  function drawAoAIndicator(ctx, cx, cy, aoa, aoaDeg, chord) {
    const r = 22;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,150,0.4)';
    ctx.lineWidth = 0.8;

    // Reference line (horizontal)
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx - r - 8, cy); ctx.lineTo(cx + r + 8, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, -aoa - 0.05, 0.05, false);
    ctx.strokeStyle = 'rgba(255,200,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // AoA chord line
    ctx.beginPath();
    ctx.moveTo(cx - r * Math.cos(aoa), cy + r * Math.sin(aoa));
    ctx.lineTo(cx + r * Math.cos(aoa), cy - r * Math.sin(aoa));
    ctx.strokeStyle = 'rgba(255,200,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    monoFont(ctx, 8, 'rgba(255,200,0,0.9)');
    ctx.fillText(`α=${aoaDeg.toFixed(1)}°`, cx - 14, cy + r + 12);
    ctx.restore();
  }

  function arrowHead(ctx, x, y, dx, dy, col) {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.translate(x, y);
    const angle = Math.atan2(dy, dx);
    ctx.rotate(angle);
    ctx.moveTo(0, 0);
    ctx.lineTo(-6, -3);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

      // Motor heat plumes (above the drone — warm air rising)
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

      // Bounding box — CNN detection result
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
    ctx.fillText('LWIR SEEKER — LIVE ACQUISITION', 6, 13);

    const fps = Math.floor(119 + Math.sin(trackT * 7) * 2);
    monoFont(ctx, 8, 'rgba(0,200,150,0.5)');
    ctx.fillText(`${fps} FPS  |  640×480  |  LWIR`, W - 150, 13);

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

    // Warhead body — outer casing
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

    // Fragmentation sleeve — tungsten pre-formed fragments
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

    // Explosive core (HMX/RDX — tan-yellow)
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
    ctx.fillText('HARD KILL — FRAG WARHEAD CROSS-SECTION', 6, 13);
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

    // Carbon fibers deploying — detailed filament simulation
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

    // EMP/EM glow (CF conducts — shorts electronics)
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
    ctx.fillText('SOFT KILL — CARBON FIBRE BURST', 6, 13);
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
