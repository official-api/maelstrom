// ============================================================================
// Feature deep-dive visualizations for the "Find Out More" screen.
// ============================================================================

export function createFeaturePanel(canvas) {
  const ctx = canvas.getContext("2d");
  let dpr = 1, lastW = 0, lastH = 0;
  let streamlines = null;
  let streamAlpha = -1; // cached angle of attack the streamlines were built for
  let fragParticles = [];
  let fibreStrands = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      lastW = w;
      lastH = h;
      streamlines = null; // rebuild on next aerofoil render at new resolution
    }
  }

  function reset() {
    fragParticles = [];
    fibreStrands = [];
  }

  function render(key, t) {
    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050706";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (key === "aerofoil") renderAerofoil(t);
    else if (key === "fragWarhead") renderFragWarhead(t);
    else if (key === "carbonFibre") renderCarbonFibre(t);
  }

  // ---------------------------------------------------------- aerofoil (potential flow)
  function renderAerofoil(t) {
    const alphaDeg = 6;
    if (!streamlines || streamAlpha !== alphaDeg) {
      streamlines = computeStreamlines(alphaDeg, 22);
      streamAlpha = alphaDeg;
    }
    const w = canvas.width, h = canvas.height;
    const scale = Math.min(w, h) * 0.24;
    const ox = w * 0.52, oy = h * 0.52;

    const toScreen = (p) => [ox + p.x * scale, oy - p.y * scale];

    // airfoil body
    ctx.beginPath();
    streamlines.airfoil.forEach((p, i) => {
      const [x, y] = toScreen(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(0, oy - scale * 0.3, 0, oy + scale * 0.3);
    bodyGrad.addColorStop(0, "#565f63");
    bodyGrad.addColorStop(0.5, "#22262a");
    bodyGrad.addColorStop(1, "#0e1113");
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "#080a0b";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // streamlines, animated flow direction via dash offset
    const speedMax = streamlines.maxSpeed;
    ctx.lineWidth = 1.4 * dpr;
    const dashLen = 6 * dpr;
    const flowOffset = -(t * 90 * dpr) % (dashLen * 2);
    streamlines.lines.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const speed = (a.speed + b.speed) / 2 / speedMax;
        const [ax, ay] = toScreen(a);
        const [bx, by] = toScreen(b);
        ctx.strokeStyle = speedColor(speed);
        ctx.setLineDash([dashLen, dashLen]);
        ctx.lineDashOffset = flowOffset;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);

    // freestream arrow + label
    ctx.fillStyle = "rgba(233,237,238,0.75)";
    ctx.font = `${10 * dpr}px monospace`;
    ctx.fillText("FREESTREAM →", 10 * dpr, 16 * dpr);
    ctx.fillText("SLOW", 10 * dpr, canvas.height - 22 * dpr);
    const legendGrad = ctx.createLinearGradient(60 * dpr, 0, 140 * dpr, 0);
    legendGrad.addColorStop(0, speedColor(0));
    legendGrad.addColorStop(1, speedColor(1));
    ctx.fillStyle = legendGrad;
    ctx.fillRect(60 * dpr, canvas.height - 28 * dpr, 80 * dpr, 6 * dpr);
    ctx.fillStyle = "rgba(233,237,238,0.75)";
    ctx.fillText("FAST", 146 * dpr, canvas.height - 22 * dpr);
  }

  function speedColor(s) {
    s = Math.max(0, Math.min(1, s));
    // blue (slow) -> teal -> amber (fast)
    const stops = [
      [70, 110, 235],
      [95, 224, 200],
      [255, 200, 60],
      [255, 90, 40],
    ];
    const seg = s * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    const f = seg - i;
    const c0 = stops[i], c1 = stops[i + 1];
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
    return `rgba(${r},${g},${b},0.85)`;
  }

  // ---------------------------------------------------------- fragmentation warhead
  function renderFragWarhead(t) {
    const w = canvas.width, h = canvas.height;
    const cx = w * 0.5, cy = h * 0.5;
    const cycle = 3.2;
    const phase = (t % cycle) / cycle; // 0..1
    const caseR = Math.min(w, h) * 0.34;

    // casing cutaway (half-section)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, caseR, Math.PI * 0.5, Math.PI * 1.5);
    ctx.closePath();
    const caseGrad = ctx.createLinearGradient(cx - caseR, 0, cx, 0);
    caseGrad.addColorStop(0, "#171a1c");
    caseGrad.addColorStop(1, "#454d51");
    ctx.fillStyle = caseGrad;
    ctx.fill();
    ctx.restore();

    // fragment liner ring (grid of pre-formed cubes)
    const linerR = caseR * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, linerR, Math.PI * 0.5, Math.PI * 1.5);
    ctx.clip();
    const rows = 10;
    for (let ring = 0; ring < 3; ring++) {
      const rr = linerR * (0.62 + ring * 0.14);
      for (let i = 0; i < rows * 2; i++) {
        const a = Math.PI * 0.5 + (i / (rows * 2)) * Math.PI;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        ctx.fillStyle = i % 2 === 0 ? "#6c7378" : "#4b5155";
        ctx.fillRect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr);
      }
    }
    ctx.restore();

    // explosive fill core
    const coreR = linerR * 0.55;
    const flash = phase < 0.06 ? 1 - phase / 0.06 : 0;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, Math.PI * 0.5, Math.PI * 1.5);
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, flash > 0 ? "#fff6d6" : "#caa24a");
    coreGrad.addColorStop(1, flash > 0 ? "#ffb35c" : "#8a6a2a");
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // detonation flash + fragments
    if (phase < 0.5) {
      const spread = easeOutCubic(Math.min(1, phase / 0.42));
      if (fragParticles.length === 0 || fragParticles[0]._cycle !== Math.floor(t / cycle)) {
        fragParticles = [];
        const n = 46;
        for (let i = 0; i < n; i++) {
          const a = Math.PI * 0.5 + Math.random() * Math.PI;
          fragParticles.push({
            a,
            speed: 0.7 + Math.random() * 0.5,
            size: (1.5 + Math.random() * 2.5) * dpr,
            _cycle: Math.floor(t / cycle),
          });
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      fragParticles.forEach((p) => {
        const r = linerR + spread * caseR * 1.8 * p.speed;
        const x = cx + Math.cos(p.a) * r;
        const y = cy + Math.sin(p.a) * r;
        const a = Math.max(0, 1 - spread);
        ctx.fillStyle = `rgba(255,${180 - spread * 100},${60},${0.6 * a + 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      if (flash > 0) {
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, caseR * 2.2);
        fg.addColorStop(0, `rgba(255,240,210,${0.85 * flash})`);
        fg.addColorStop(1, "rgba(255,240,210,0)");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, caseR, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
  }

  // ---------------------------------------------------------- carbon fibre entanglement
  function renderCarbonFibre(t) {
    const w = canvas.width, h = canvas.height;
    const cx = w * 0.5, cy = h * 0.55;
    const cycle = 3.6;
    const phase = (t % cycle) / cycle;
    const canR = Math.min(w, h) * 0.14;

    // canister
    ctx.fillStyle = "#2a2f32";
    ctx.fillRect(cx - canR, cy - canR * 1.3, canR * 2, canR * 1.3);
    ctx.strokeStyle = "#0d0f10";
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeRect(cx - canR, cy - canR * 1.3, canR * 2, canR * 1.3);

    if (fibreStrands.length === 0 || fibreStrands[0]._cycle !== Math.floor(t / cycle)) {
      fibreStrands = [];
      const n = 26;
      for (let i = 0; i < n; i++) {
        fibreStrands.push({
          angle: (Math.random() - 0.5) * Math.PI * 0.9 - Math.PI / 2,
          wiggle: Math.random() * Math.PI * 2,
          len: canR * (5 + Math.random() * 4),
          speed: 0.7 + Math.random() * 0.6,
          _cycle: Math.floor(t / cycle),
        });
      }
    }

    const burst = phase < 0.1 ? 0 : easeOutCubic(Math.min(1, (phase - 0.1) / 0.55));
    ctx.strokeStyle = "rgba(40,44,46,0.9)";
    ctx.lineWidth = 1 * dpr;
    fibreStrands.forEach((s) => {
      const reach = burst * s.len * s.speed;
      const steps = 18;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const r = f * reach;
        const wob = Math.sin(f * 6 + s.wiggle + t * 2) * (1 - f) * canR * 0.5 * burst;
        const x = cx + Math.cos(s.angle) * r + Math.cos(s.angle + Math.PI / 2) * wob;
        const y = cy - canR * 1.3 + Math.sin(s.angle) * r * 0.6 - r * 0.4 + wob * 0.2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(s.angle) * reach, cy + Math.sin(s.angle) * reach);
      grad.addColorStop(0, "rgba(20,22,23,0.95)");
      grad.addColorStop(1, "rgba(70,76,80,0.55)");
      ctx.strokeStyle = grad;
      ctx.stroke();
    });

    if (phase < 0.12) {
      const flash = 1 - phase / 0.12;
      const fg = ctx.createRadialGradient(cx, cy - canR, 0, cx, cy - canR, canR * 5);
      fg.addColorStop(0, `rgba(200,220,255,${0.5 * flash})`);
      fg.addColorStop(1, "rgba(200,220,255,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  return { render, reset };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ============================================================================
// Potential-flow streamline solver for a Joukowski aerofoil.
// Purely a visual approximation of real CFD/wind-tunnel streamline plots.
// ============================================================================
function computeStreamlines(alphaDeg, count) {
  const alpha = (alphaDeg * Math.PI) / 180;
  // circle centre offset gives the aerofoil camber + thickness
  const cx = -0.08, cy = 0.06;
  const R = Math.sqrt((1 - cx) * (1 - cx) + cy * cy);
  const beta = Math.asin(cy / R);
  const U = 1;
  const gamma = 4 * Math.PI * U * R * Math.sin(alpha + beta);

  function velocity(zx, zy) {
    // ζ - C
    const dx = zx - cx, dy = zy - cy;
    const r2 = dx * dx + dy * dy;
    // U * e^{-ia}
    const uax = U * Math.cos(-alpha), uay = U * Math.sin(-alpha);
    // - U R^2 e^{ia} / (ζ-C)^2
    const eax = Math.cos(alpha), eay = Math.sin(alpha);
    const dz2x = dx * dx - dy * dy, dz2y = 2 * dx * dy; // (ζ-C)^2
    const denom2 = dz2x * dz2x + dz2y * dz2y;
    const numx = -(U * R * R) * eax, numy = -(U * R * R) * eay;
    const term2x = (numx * dz2x + numy * dz2y) / denom2;
    const term2y = (numy * dz2x - numx * dz2y) / denom2;
    // -i * gamma / (2π (ζ-C)) = k * (-dy - i*dx), where k = gamma / (2π r2)
    const k = gamma / (2 * Math.PI * r2);
    const term3x = -k * dy;
    const term3y = -k * dx;
    // dw/dζ = U e^{-ia} + term2 + term3
    const dwx = uax + term2x + term3x;
    const dwy = uay + term2y + term3y;
    // velocity (u, v) = (Re(dw/dζ), -Im(dw/dζ))
    return { u: dwx, v: -dwy };
  }

  function joukowski(zx, zy) {
    const r2 = zx * zx + zy * zy;
    return { x: zx + zx / r2, y: zy - zy / r2 };
  }

  const lines = [];
  let maxSpeed = 0.001;
  const seedYs = [];
  for (let i = 0; i < count; i++) {
    seedYs.push(-1.1 + (i / (count - 1)) * 2.2);
  }
  seedYs.forEach((y0) => {
    let x = -2.6, y = y0 + cy * 0.4;
    const path = [];
    const dt = 0.045;
    for (let step = 0; step < 260; step++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < R * R * 1.02) break; // hit the body
      const { u, v } = velocity(x, y);
      const speed = Math.sqrt(u * u + v * v);
      maxSpeed = Math.max(maxSpeed, speed);
      const mapped = joukowski(x, y);
      path.push({ x: mapped.x, y: mapped.y, speed });
      x += u * dt;
      y += v * dt;
      if (x > 2.8) break;
    }
    if (path.length > 2) lines.push(path);
  });

  // aerofoil outline itself (mapped circle boundary)
  const airfoil = [];
  const segs = 90;
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const zx = cx + R * Math.cos(th);
    const zy = cy + R * Math.sin(th);
    airfoil.push(joukowski(zx, zy));
  }

  return { lines, airfoil, maxSpeed };
}
