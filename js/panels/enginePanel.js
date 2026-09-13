// Draws a cutaway of the MAELSTROM solid rocket motor: case, star-shaped
// propellant grain, burning grain face, nozzle, and an exhaust plume with
// embers. Purely a visual showcase — not a physical burn-rate model.

export function createEnginePanel(canvas) {
  const ctx = canvas.getContext("2d");
  let particles = [];
  let dpr = 1;
  let lastW = 0, lastH = 0;

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
    }
  }

  function reset() {
    particles = [];
  }

  // t in [0,1] burn progress
  function render(t) {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0d0e");
    bg.addColorStop(1, "#050606");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.52;
    const bodyLen = w * 0.66;
    const bodyR = h * 0.24;
    const left = cx - bodyLen / 2;
    const right = cx + bodyLen / 2;

    // --- outer case ---
    roundedCapsule(ctx, left, cy, right, bodyR, "#3a4247", "#181c1e");

    // --- inner cutaway (dark cavity) ---
    const innerR = bodyR * 0.86;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, cy - innerR, bodyLen, innerR * 2);
    ctx.clip();
    ctx.fillStyle = "#0c0805";
    ctx.fillRect(left, cy - innerR, bodyLen, innerR * 2);

    // --- propellant grain (regresses / burns outward from centre bore) ---
    const grainRight = right - bodyLen * 0.16; // nozzle starts here
    const burn = 0.16 + t * 0.62; // bore radius fraction growing as it burns
    const boreR = innerR * burn;

    // unburned propellant ring
    const grainGrad = ctx.createRadialGradient(cx, cy, boreR * 0.6, cx, cy, innerR);
    grainGrad.addColorStop(0, "#5a3a22");
    grainGrad.addColorStop(0.5, "#3f2a1a");
    grainGrad.addColorStop(1, "#241811");
    ctx.fillStyle = grainGrad;
    ctx.fillRect(left, cy - innerR, grainRight - left, innerR * 2);

    // star-shaped burning bore (simplified as a soft star / flower cavity)
    ctx.save();
    ctx.translate(cx, cy);
    starPath(ctx, boreR, boreR * 0.42, 6);
    const flameGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, boreR * 1.15);
    flameGrad.addColorStop(0, "#fff6d6");
    flameGrad.addColorStop(0.35, "#ffcf5c");
    flameGrad.addColorStop(0.7, "#ff7a1f");
    flameGrad.addColorStop(1, "rgba(255,60,10,0.15)");
    ctx.fillStyle = flameGrad;
    ctx.fill();
    ctx.restore(); // undo the bore translate

    ctx.restore(); // undo clip

    // --- nozzle (converging-diverging), aft of the grain ---
    ctx.save();
    const nozzleThroatX = grainRight + bodyLen * 0.05;
    const nozzleR1 = bodyR * 0.5;
    const nozzleThroatR = bodyR * 0.22;
    const nozzleExitR = bodyR * 0.7;
    ctx.beginPath();
    ctx.moveTo(grainRight, cy - bodyR * 0.75);
    ctx.lineTo(nozzleThroatX, cy - nozzleThroatR);
    ctx.lineTo(right, cy - nozzleExitR);
    ctx.lineTo(right, cy + nozzleExitR);
    ctx.lineTo(nozzleThroatX, cy + nozzleThroatR);
    ctx.lineTo(grainRight, cy + bodyR * 0.75);
    ctx.closePath();
    const nozGrad = ctx.createLinearGradient(grainRight, 0, right, 0);
    nozGrad.addColorStop(0, "#4a4f52");
    nozGrad.addColorStop(1, "#26292b");
    ctx.fillStyle = nozGrad;
    ctx.fill();
    ctx.strokeStyle = "#0d0f10";
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
    ctx.restore();

    // --- exhaust plume + embers, shooting out to the right ---
    if (t > 0.02) {
      const exitX = right;
      const spawnCount = Math.round(6 + t * 10);
      for (let i = 0; i < spawnCount; i++) {
        particles.push({
          x: exitX + Math.random() * 4,
          y: cy + (Math.random() - 0.5) * nozzleExitR * 1.4,
          vx: (2.4 + Math.random() * 2.2) * dpr * 60,
          vy: (Math.random() - 0.5) * 40 * dpr,
          life: 0,
          maxLife: 0.35 + Math.random() * 0.35,
          size: (2 + Math.random() * 4) * dpr,
        });
      }
    }
    const dt = 1 / 60;
    particles.forEach((p) => {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    particles = particles.filter((p) => p.life < p.maxLife);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    particles.forEach((p) => {
      const a = 1 - p.life / p.maxLife;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      grad.addColorStop(0, `rgba(255,230,170,${0.85 * a})`);
      grad.addColorStop(0.4, `rgba(255,140,40,${0.55 * a})`);
      grad.addColorStop(1, "rgba(255,60,10,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // subtle vignette
    const vg = ctx.createRadialGradient(cx, cy, h * 0.2, cx, cy, w * 0.6);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  return { render, reset };
}

function roundedCapsule(ctx, x1, cy, x2, r, edgeColor, fillColor) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, cy - r);
  ctx.lineTo(x2, cy - r);
  ctx.arc(x2, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x1, cy + r);
  ctx.arc(x1, cy, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grad.addColorStop(0, "#6a7378");
  grad.addColorStop(0.15, edgeColor);
  grad.addColorStop(0.5, "#2c3234");
  grad.addColorStop(0.85, edgeColor);
  grad.addColorStop(1, "#121516");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = fillColor;
  ctx.stroke();
  ctx.restore();
}

function starPath(ctx, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
