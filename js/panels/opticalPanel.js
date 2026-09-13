import * as THREE from "three";

export function createOpticalPanel(renderCanvas, overlayCanvas, scene) {
  const renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const octx = overlayCanvas.getContext("2d");
  let dpr = 1;

  function resize(camera) {
    const rect = renderCanvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    renderer.setSize(w, h, false);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ow = Math.max(2, Math.round(rect.width * dpr));
    const oh = Math.max(2, Math.round(rect.height * dpr));
    if (overlayCanvas.width !== ow || overlayCanvas.height !== oh) {
      overlayCanvas.width = ow;
      overlayCanvas.height = oh;
    }
  }

  function render(camera, drones, centroidWorld, scanPhase) {
    resize(camera);
    renderer.render(scene, camera);
    drawOverlay(camera, drones, centroidWorld, scanPhase);
  }

  function drawOverlay(camera, drones, centroidWorld, scanPhase) {
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;
    octx.clearRect(0, 0, w, h);

    const boxes = [];
    drones.forEach((d, i) => {
      if (!d.userData.alive) return;
      const screen = worldToScreen(d.position, camera, w, h);
      if (!screen) return;
      const dist = camera.position.distanceTo(d.position);
      const apparent = Math.min(120, (16 / Math.max(dist, 0.5)) * dpr * 10);
      boxes.push({ x: screen.x, y: screen.y, s: apparent, id: i });
    });

    // bounding boxes, computer-vision style
    octx.lineWidth = Math.max(1, 1.4 * dpr);
    boxes.forEach((b) => {
      octx.strokeStyle = "rgba(95,224,200,0.9)";
      octx.strokeRect(b.x - b.s / 2, b.y - b.s / 2, b.s, b.s);
      // corner ticks
      const t = b.s * 0.22;
      octx.strokeStyle = "#eafff9";
      corner(octx, b.x - b.s / 2, b.y - b.s / 2, t, 1, 1);
      corner(octx, b.x + b.s / 2, b.y - b.s / 2, t, -1, 1);
      corner(octx, b.x - b.s / 2, b.y + b.s / 2, t, 1, -1);
      corner(octx, b.x + b.s / 2, b.y + b.s / 2, t, -1, -1);

      octx.font = `${9 * dpr}px monospace`;
      octx.fillStyle = "rgba(95,224,200,0.95)";
      octx.fillText(`TGT ${String(b.id + 1).padStart(2, "0")}`, b.x - b.s / 2, b.y - b.s / 2 - 4 * dpr);
    });

    // centroid reticle — where the rocket is steering to
    if (centroidWorld) {
      const c = worldToScreen(centroidWorld, camera, w, h);
      if (c) {
        octx.strokeStyle = "#ff5a1f";
        octx.lineWidth = Math.max(1, 1.6 * dpr);
        const r = 14 * dpr;
        octx.beginPath();
        octx.arc(c.x, c.y, r, 0, Math.PI * 2);
        octx.stroke();
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
          octx.beginPath();
          octx.moveTo(c.x + dx * r * 1.3, c.y + dy * r * 1.3);
          octx.lineTo(c.x + dx * r * 2, c.y + dy * r * 2);
          octx.stroke();
        });
        octx.font = `600 ${9 * dpr}px monospace`;
        octx.fillStyle = "#ff5a1f";
        octx.fillText("AIMPOINT", c.x + r * 1.2, c.y - r * 1.2);
      }
    }

    // scan-line sweep + telemetry chrome
    octx.strokeStyle = "rgba(95,224,200,0.35)";
    octx.lineWidth = 1;
    const sweepY = (scanPhase % 1) * h;
    octx.beginPath();
    octx.moveTo(0, sweepY);
    octx.lineTo(w, sweepY);
    octx.stroke();

    octx.font = `${9 * dpr}px monospace`;
    octx.fillStyle = "rgba(95,224,200,0.85)";
    octx.fillText(`TRACK ${boxes.length} CONTACTS`, 8 * dpr, h - 8 * dpr);
    octx.fillText("SEEKER: OPTICAL/EO", w - 118 * dpr, h - 8 * dpr);
  }

  function corner(c, x, y, len, dx, dy) {
    c.beginPath();
    c.moveTo(x, y + len * dy);
    c.lineTo(x, y);
    c.lineTo(x + len * dx, y);
    c.stroke();
  }

  function worldToScreen(worldPos, camera, w, h) {
    const v = worldPos.clone().project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (1 - (v.y * 0.5 + 0.5)) * h };
  }

  return { render };
}
