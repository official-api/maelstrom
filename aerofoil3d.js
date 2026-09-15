/* ═══════════════════════════════════════════════════════════════
   MAELSTROM — AEROFOIL_CFD
   A live WebGL shader flow-field visualisation of the NACA 0018
   control-fin section: analytic potential flow around the aerofoil
   (Joukowski-style circle-plane mapping) blended with a meandering,
   noise-driven turbulent wake, coloured with the same "jet" heatmap
   as the reference CFD render. The fin pitches up and down over
   time, exactly like an active control surface being actuated.
   ═══════════════════════════════════════════════════════════════ */

window.AEROFOIL_CFD = (() => {
  const VERT_SRC = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAG_SRC = `
    precision highp float;
    varying vec2 vUv;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uAoA;      // radians, current fin pitch
    uniform float uAspect;

    // ---- cheap value noise for wake turbulence ----
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
      return v;
    }

    // NACA 00xx half-thickness distribution
    float nacaHalfThickness(float xn, float t) {
      float x = clamp(xn, 0.0, 1.0);
      return 5.0 * t * (0.2969 * sqrt(x) - 0.1260 * x - 0.3516 * x * x
             + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
    }

    // ---- complex-number helpers for the Joukowski conformal map ----
    vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
    vec2 cconj(vec2 a) { return vec2(a.x, -a.y); }
    vec2 cdiv(vec2 a, vec2 b) {
      float d = dot(b, b) + 1e-9;
      return vec2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) / d;
    }
    vec2 csqrt(vec2 z) {
      float r = length(z);
      float re = sqrt(max(0.0, (r + z.x) * 0.5));
      float im = sqrt(max(0.0, (r - z.x) * 0.5));
      return vec2(re, z.y < 0.0 ? -im : im);
    }

        // ---- Berlin Perceptually Uniform Diverging Colormap ----
    vec3 berlin(float t) {
      t = clamp(t, 0.0, 1.0);
      
      // Color key nodes for the Berlin map
      vec3 c0 = vec3(0.61, 0.81, 0.93); // Light Blue / Cyan (Min value)
      vec3 c1 = vec3(0.24, 0.44, 0.65); // Medium Blue
      vec3 c2 = vec3(0.09, 0.09, 0.11); // Dark Neutral Center
      vec3 c3 = vec3(0.70, 0.33, 0.22); // Burnt Orange
      vec3 c4 = vec3(0.93, 0.72, 0.61); // Light Salmon / Orange (Max value)

      // Interpolate across the segments
      if (t < 0.25) {
        return mix(c0, c1, t * 4.0);
      } else if (t < 0.50) {
        return mix(c1, c2, (t - 0.25) * 4.0);
      } else if (t < 0.75) {
        return mix(c2, c3, (t - 0.50) * 4.0);
      } else {
        return mix(c3, c4, (t - 0.75) * 4.0);
      }
    }


    void main() {
      // Aspect-corrected plot space, chord = 1, centred at the quarter-chord.
      vec2 p = (vUv - 0.5) * vec2(3.1 * uAspect, 3.1);
      p.x += 0.15;

      float ca = cos(-uAoA), sa = sin(-uAoA);
      vec2 f = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y); // aerofoil-frame coords

      float t = 0.18; // NACA 0018
      float xn = f.x + 0.5;
      float halfT = nacaHalfThickness(xn, t);
      float inBody = step(0.0, xn) * step(xn, 1.0) * step(abs(f.y), halfT);

      // True Joukowski-transform potential flow around a thickness-matched
      // aerofoil, with circulation set by the Kutta condition (finite,
      // tangent flow off the sharp trailing edge) — this is the actual
      // analytic solution for lifting flow around a Joukowski aerofoil,
      // not just a doublet/cylinder approximation.
      const float PI = 3.14159265359;
      float c = 0.25;                 // map constant: flat-plate limit chord = 4c = 1
      float eps = 0.30 * c * t;        // circle-centre offset -> aerofoil thickness
      float R = c + eps;               // circle radius (passes through the TE at zeta = c)
      vec2 zeta0 = vec2(-eps, 0.0);

      // Invert z = zeta + c^2/zeta  =>  zeta^2 - z*zeta + c^2 = 0
      vec2 z = f;
      vec2 disc = cmul(z, z) - vec2(4.0 * c * c, 0.0);
      vec2 s = csqrt(disc);
      if (dot(s, z) < 0.0) s = -s;      // pick the branch with zeta -> z far from the body
      vec2 zeta = (z + s) * 0.5;

      vec2 w = zeta - zeta0;
      float r = length(w);
      float rc = max(r, R);             // clamp inside the body to avoid a singularity
      w *= rc / max(r, 1e-4);

      vec2 eIA = vec2(cos(uAoA), sin(uAoA));
      vec2 eNegIA = vec2(cos(uAoA), -sin(uAoA));
      float Gamma = -4.0 * PI * R * sin(uAoA);  // Kutta-condition circulation

      vec2 w2 = cmul(w, w);
      vec2 dWdzeta = eNegIA - cdiv(cmul(vec2(R * R, 0.0), eIA), w2)
                            + cdiv(vec2(0.0, -Gamma / (2.0 * PI)), w);

      vec2 dzdzeta = vec2(1.0, 0.0) - cdiv(vec2(c * c, 0.0), cmul(zeta, zeta));

      // Both dWdzeta and dzdzeta analytically vanish together at the Kutta
      // point (zeta = c, the trailing-edge cusp) -- that cancellation is
      // exactly what makes the trailing-edge flow smooth. But computing it
      // as a literal 0/0 in floating point is numerically unstable right
      // at that point, producing a spurious speed spike. Regularise the
      // divisor with a small floor tied to distance from the cusp so the
      // ratio settles to its true finite limit instead of blowing up.
      float distToCusp = length(zeta - vec2(c, 0.0));
      float denomMag2 = max(dot(dzdzeta, dzdzeta), 4e-4 * smoothstep(0.05, 0.0, distToCusp));
      vec2 dWdz = cmul(dWdzeta, cconj(dzdzeta)) / denomMag2;

      float Vx = dWdz.x;
      float Vy = -dWdz.y;
      float speed = length(vec2(Vx, Vy));
      // Soft-saturate instead of hard clamp so any residual noise near the
      // cusp compresses smoothly rather than spiking to full red.
      speed = speed / sqrt(1.0 + (speed * speed) / 12.25);

      // Turbulent, meandering wake downstream of the trailing edge.
      float wakeX = f.x - 0.5;
      float wakeOn = smoothstep(-0.015, 0.015, wakeX); // feathered, not a hard step
      float meander = 0.05 * sin(wakeX * 5.0 - uTime * 2.2) * smoothstep(0.0, 0.5, wakeX)
                     + (fbm(vec2(wakeX * 3.0, uTime * 0.6)) - 0.5) * 0.10 * smoothstep(0.0, 1.2, wakeX);
      float wakeWidth = 0.05 + 0.16 * wakeX;
      float wakeDist = abs(f.y - meander);
      float wakeMask = wakeOn * smoothstep(wakeWidth, 0.0, wakeDist);
      float turb = fbm(vec2(f.x * 4.0 - uTime * 1.6, f.y * 6.0 + uTime * 0.8));
      float wakeSpeed = mix(0.55, 0.15, wakeMask) + (turb - 0.5) * 0.35 * wakeMask;
      speed = mix(speed, speed * wakeSpeed + wakeSpeed * 0.4, wakeMask);

      // Stagnation highlight at the leading edge, slight speed-up at the
      // thickest point — matches the classic red/blue cylinder-flow look.
      float uMag = clamp(speed / 2.0, 0.0, 1.0);

      vec3 col = berlin(uMag);

      // Body: neutral, lightly shaded metal, with a soft rim/spec highlight.
      float edge = smoothstep(halfT - 0.012, halfT, abs(f.y)) * inBody;
      vec3 bodyCol = mix(vec3(0.62, 0.66, 0.70), vec3(0.22, 0.24, 0.27), step(0.0, f.y));
      bodyCol += vec3(1.0) * pow(max(0.0, 1.0 - abs(f.y) / max(halfT, 0.001)), 6.0) * 0.25;
      bodyCol = mix(bodyCol, vec3(0.05, 0.06, 0.07), edge * 0.5);

      col = mix(col, bodyCol, inBody);

      // Subtle background vignette so the panel doesn't look flat/empty
      // outside the flow field, echoing the reference image's khaki field.
      // vec3 farField = vec3(0.55, 0.62, 0.30);
      // float farBlend = smoothstep(1.0, 2.2, length(p));
      // col = mix(col, farField, farBlend * 0.35);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let canvas, gl, program, vbo;
  let uRes, uTime, uAoA, uAspect;
  let t0 = 0, elapsed = 0;
  let ready = false;
  let legendEl, titleEl, aoaEl;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('AEROFOIL_CFD shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function buildOverlay(container) {
    container.querySelectorAll('.gl-aero-ui').forEach(n => n.remove());

    const title = document.createElement('div');
    title.className = 'gl-aero-ui gl-aero-title';
    title.textContent = 'CONTROL FIN — CFD (NACA 0018)';
    container.appendChild(title);

    aoaEl = document.createElement('div');
    aoaEl.className = 'gl-aero-ui gl-aero-aoa';
    container.appendChild(aoaEl);

    const legend = document.createElement('div');
    legend.className = 'gl-aero-ui gl-aero-legend';
    legend.innerHTML = `
      <div class="gl-aero-legend-title">U Magnitude</div>
      <div class="gl-aero-legend-bar"></div>
      <div class="gl-aero-legend-ticks">
        <span>0.0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span>
      </div>`;
    container.appendChild(legend);
    legendEl = legend;

    const axis = document.createElement('div');
    axis.className = 'gl-aero-ui gl-aero-axis';
    axis.innerHTML = `
      <svg viewBox="0 0 40 40" width="30" height="30">
        <line x1="4" y1="36" x2="4" y2="10" stroke="#c8d8e8" stroke-width="1.4"/>
        <line x1="4" y1="36" x2="30" y2="36" stroke="#c8d8e8" stroke-width="1.4"/>
        <polygon points="4,6 1,13 7,13" fill="#c8d8e8"/>
        <polygon points="34,36 27,33 27,39" fill="#c8d8e8"/>
        <text x="8" y="16" fill="#c8d8e8" font-size="8" font-family="monospace">Y</text>
        <text x="26" y="34" fill="#c8d8e8" font-size="8" font-family="monospace">X</text>
      </svg>`;
    container.appendChild(axis);
  }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { console.warn('AEROFOIL_CFD: WebGL unavailable'); return; }

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('AEROFOIL_CFD link error:', gl.getProgramInfoLog(program));
      return;
    }

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    uRes = gl.getUniformLocation(program, 'uRes');
    uTime = gl.getUniformLocation(program, 'uTime');
    uAoA = gl.getUniformLocation(program, 'uAoA');
    uAspect = gl.getUniformLocation(program, 'uAspect');

    // Build a sibling overlay div right after the canvas for legend/labels.
    let overlay = canvas.parentElement.querySelector('.gl-aero-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'gl-aero-overlay';
      canvas.parentElement.appendChild(overlay);
    }
    buildOverlay(overlay);

    ready = true;
  }

  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth || canvas.offsetWidth || 340;
    const h = canvas.clientHeight || canvas.offsetHeight || 180;
    if (w < 2 || h < 2) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.round(w * dpr), nh = Math.round(h * dpr);
    if (nw !== lastW || nh !== lastH) {
      canvas.width = nw; canvas.height = nh;
      lastW = nw; lastH = nh;
      gl.viewport(0, 0, nw, nh);
    }
    return true;
  }

  function render(dt) {
    if (!ready) return;
    if (!resize()) return;
    elapsed += dt;

    const aoaDeg = 9 * Math.sin(elapsed * 0.55);
    const aoa = aoaDeg * Math.PI / 180;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uAoA, aoa);
    gl.uniform1f(uAspect, canvas.width / canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (aoaEl) aoaEl.textContent = `AoA ${aoaDeg >= 0 ? '+' : ''}${aoaDeg.toFixed(1)}°`;
  }

  return { init, render };
})();
