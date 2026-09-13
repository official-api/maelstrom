export function createTrajectoryPanel(canvas) {
  const ctx = canvas.getContext("2d");
  let dpr = 1, lastW = 0, lastH = 0;
  let points = [];
  let markers = []; // {x, y, color, label}
  let bounds = { minX: 0, maxX: 20, minY: 0, maxY: 12 };

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
    points = [];
    markers = [];
  }

  function addPoint(distance, altitude) {
    points.push({ x: distance, y: altitude });
    if (points.length > 2000) points.shift();
  }

  function addMarker(distance, altitude, color, label) {
    markers.push({ x: distance, y: altitude, color, label });
  }

  function setBounds(minX, maxX, minY, maxY) {
    bounds = { minX, maxX, minY, maxY };
  }

  function toScreen(px, py, padL, padR, padT, padB, w, h) {
    const sx = padL + ((px - bounds.minX) / (bounds.maxX - bounds.minX)) * (w - padL - padR);
    const sy = h - padB - ((py - bounds.minY) / (bounds.maxY - bounds.minY)) * (h - padT - padB);
    return [sx, sy];
  }

  function render() {
    resize();
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#050706";
    ctx.fillRect(0, 0, w, h);

    const padL = 34 * dpr, padR = 12 * dpr, padT = 12 * dpr, padB = 22 * dpr;

    // grid
    ctx.strokeStyle = "rgba(122,137,146,0.18)";
    ctx.lineWidth = 1;
    const gridCols = 6, gridRows = 4;
    ctx.font = `${10 * dpr}px Archivo, sans-serif`;
    ctx.fillStyle = "rgba(124,137,146,0.7)";
    for (let i = 0; i <= gridCols; i++) {
      const x = padL + (i / gridCols) * (w - padL - padR);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, h - padB);
      ctx.stroke();
    }
    for (let j = 0; j <= gridRows; j++) {
      const y = padT + (j / gridRows) * (h - padT - padB);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      const val = Math.round(bounds.maxY - (j / gridRows) * (bounds.maxY - bounds.minY));
      ctx.fillText(String(val), 4 * dpr, y + 3 * dpr);
    }
    for (let i = 0; i <= gridCols; i += 2) {
      const x = padL + (i / gridCols) * (w - padL - padR);
      const val = Math.round(bounds.minX + (i / gridCols) * (bounds.maxX - bounds.minX));
      ctx.fillText(String(val) + "m", x - 8 * dpr, h - padB + 14 * dpr);
    }

    // axis labels
    ctx.fillStyle = "rgba(124,137,146,0.9)";
    ctx.font = `600 ${9.5 * dpr}px Archivo, sans-serif`;
    ctx.fillText("ALT (m)", padL, padT - 2 * dpr);
    ctx.fillText("DOWNRANGE", w - padR - 62 * dpr, h - 4 * dpr);

    // path
    if (points.length > 1) {
      ctx.beginPath();
      points.forEach((p, i) => {
        const [sx, sy] = toScreen(p.x, p.y, padL, padR, padT, padB, w, h);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.strokeStyle = "#5fe0c8";
      ctx.lineWidth = 2 * dpr;
      ctx.shadowColor = "rgba(95,224,200,0.8)";
      ctx.shadowBlur = 6 * dpr;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // current position marker
      const last = points[points.length - 1];
      const [lx, ly] = toScreen(last.x, last.y, padL, padR, padT, padB, w, h);
      ctx.beginPath();
      ctx.arc(lx, ly, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#ff5a1f";
      ctx.fill();
    }

    // markers (launch point, intercept point, etc)
    markers.forEach((m) => {
      const [sx, sy] = toScreen(m.x, m.y, padL, padR, padT, padB, w, h);
      ctx.beginPath();
      ctx.arc(sx, sy, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.fill();
      if (m.label) {
        ctx.fillStyle = m.color;
        ctx.font = `${9 * dpr}px Archivo, sans-serif`;
        ctx.fillText(m.label, sx + 6 * dpr, sy - 4 * dpr);
      }
    });
  }

  return { render, reset, addPoint, addMarker, setBounds };
}
