/* ═══════════════════════════════════════════
   MAELSTROM — MAIN ORCHESTRATOR v3
   New flow:
     standby → killSelect → engineStage (engine panel + proceed) →
     tracking (flight panel: engine then cv) →
     done (post-sim feature viewer)
   ═══════════════════════════════════════════ */

(() => {
  /* ─── State ─── */
  let simPhase = 'standby';
  let killMode = null;
  let activePanel = null;
  let panelPhaseTimer = 0;
  let lastT = performance.now();
  let missionStartTime = null;
  let trajectoryPoints = [];
  let postSimFeature = null; // 'engine' | 'aerofoil' | 'tracking' | 'payload'
  let rocketFiredTime = null;
  let engineStageDone = false;

  /* ─── DOM Refs ─── */
  const el = id => document.getElementById(id);

  /* ─── Init ─── */
  function init() {
    SIM.init('simCanvas');
    PANELS.init();

    el('beginAttackBtn').addEventListener('click', onBeginAttack);
    el('hardKillBtn').addEventListener('click', () => onKillSelect('hard'));
    el('softKillBtn').addEventListener('click', () => onKillSelect('soft'));
    el('replayBtn').addEventListener('click', onReplay);
    el('replayBtn2').addEventListener('click', onReplay);
    el('proceedBtn').addEventListener('click', onProceedToFlight);

    // Post-sim feature buttons
    ['engine','aerofoil','tracking','payload'].forEach(f => {
      const btn = el(`feat-${f}`);
      if (btn) btn.addEventListener('click', () => showPostSimFeature(f));
    });

    SIM.onAlert(onRadarAlert);
    SIM.onRocketLaunch(onRocketLaunched);
    SIM.onIntercept(onInterceptHit);
    SIM.onDone(onSimDone);

    showPhase('standby');
    startLoop();
  }

  /* ─── Phase visibility ─── */
  function showPhase(name) {
    const allPhases = ['standby','killmode','engine-launch','flight','post-sim'];
    allPhases.forEach(p => {
      const el2 = document.getElementById(`phase-${p}`);
      if (el2) {
        el2.classList.remove('active');
        el2.style.display = 'none';
      }
    });
    const target = document.getElementById(`phase-${name}`);
    if (target) {
      target.style.display = 'flex';
      target.classList.add('active');
    }
  }

  /* ─── Button handlers ─── */
  function onBeginAttack() {
    simPhase = 'approach';
    missionStartTime = performance.now();
    setStatus('RADAR SCANNING', false);
    SIM.startApproach();
    showPhase('standby');
    setHud('hudSys', 'SCANNING');
  }

  function onRadarAlert() {
    simPhase = 'killSelect';
    el('alertBanner').classList.remove('hidden');
    el('alertText').textContent = '⚠ DRONE SWARM DETECTED — SELECT INTERCEPT MODE';
    setStatus('THREAT DETECTED', true);
    showPhase('killmode');
    setHud('hudSys', 'THREAT');
    setHud('hudTargets', '14');
    setHud('hudRange', '540');
    el('replayBtn').classList.remove('hidden');
  }

  function onKillSelect(mode) {
    killMode = mode;
    simPhase = 'engineStage';
    el('alertBanner').classList.add('hidden');
    el('hudKillMode').textContent = mode.toUpperCase();
    PANELS.setPayloadMode(mode);

    // Show engine stage panel — launch happens here but rocket doesn't fly yet
    setStatus('ENGINE IGNITION — REVIEWING SYSTEMS', false);
    showPhase('engine-launch');

    // Start the engine canvas animation immediately
    activePanel = 'engine';
    PANELS.showPanelCanvas('engine');

    // Sequence the status dots over 2 seconds
    sequenceLaunchStatus();

    // Fire the rocket engine (visually) but hold flight until user clicks proceed
    engineStageDone = false;
    SIM.armRocket(mode);   // new API: shows rocket with engine firing but doesn't move
  }

  function sequenceLaunchStatus() {
    const dots = ['ldot-ignition','ldot-guidance','ldot-fins','ldot-seeker'];
    const delays = [300, 800, 1400, 2000];
    dots.forEach((id, i) => {
      setTimeout(() => {
        const d = el(id);
        if (d) d.classList.add(i < 3 ? 'on' : 'warn');
        if (i === dots.length - 1) {
          engineStageDone = true;
          const btn = el('proceedBtn');
          if (btn) btn.disabled = false;
        }
      }, delays[i]);
    });
  }

  function onProceedToFlight() {
    if (!engineStageDone) return;
    simPhase = 'flight';
    panelPhaseTimer = 0;
    rocketFiredTime = performance.now();
    setStatus('MISSILE IN FLIGHT', false);
    showPhase('flight');
    activePanel = 'engine';
    PANELS.showPanelCanvas('engine');
    SIM.fireRocket(); // new API: actually launch the rocket toward swarm
  }

  function onRocketLaunched() {
    // Called when rocket physically fires in 3D (inside SIM.fireRocket)
  }

  function onInterceptHit(mode) {
    simPhase = 'intercept';
    setStatus('INTERCEPT — WARHEAD DEPLOYED', true);
    el('alertBanner').classList.remove('hidden');
    const modeText = mode === 'hard' ? 'HARD KILL — FRAGMENTATION DEPLOYED' : 'SOFT KILL — CARBON FIBRE DEPLOYED';
    el('alertText').textContent = `✓ ${modeText}`;
    el('alertBanner').style.borderColor = mode === 'hard' ? '#ff3c3c' : '#00aaff';
    el('alertBanner').style.color = mode === 'hard' ? '#ff3c3c' : '#00aaff';
  }

  function onSimDone() {
    simPhase = 'done';
    setTimeout(() => {
      el('costOverlay').classList.remove('hidden');
      setStatus('ENGAGEMENT COMPLETE', false);
      // Switch right panel to post-sim
      showPhase('post-sim');
      // Default to engine feature
      showPostSimFeature('engine');
    }, 1800);
  }

  function showPostSimFeature(feature) {
    postSimFeature = feature;
    activePanel = feature;
    PANELS.showPanelCanvas(feature);

    // Update button active state
    ['engine','aerofoil','tracking','payload'].forEach(f => {
      const btn = el(`feat-${f}`);
      if (btn) btn.classList.toggle('active', f === feature);
    });

    // Show description
    const descs = {
      engine:   'SOLID PROPELLANT ROCKET ENGINE — HTPB/AP/Al composite grain delivers sustained high thrust in a regressive burn pattern.',
      aerofoil: 'CONTROL FIN AEROFOIL — NACA 0008 symmetric profile, actuated within 15ms for proportional navigation course corrections.',
      tracking: 'OPTICAL TRACKING — LWIR seeker at 120fps, CNN-based swarm detection, proportional-navigation guidance to centroid.',
      payload:  killMode === 'hard'
        ? 'HARD KILL — Tungsten fragmentation sleeve: >400 m/s lateral fragment velocity, 15m kill radius.'
        : 'SOFT KILL — Carbon fibre filament burst: 20m entanglement radius, rotor jam + electronics shorts.'
    };
    const descEl = el('postSimDesc');
    if (descEl) descEl.textContent = descs[feature] || '';
  }

  function onReplay() {
    simPhase = 'standby';
    killMode = null;
    activePanel = null;
    panelPhaseTimer = 0;
    trajectoryPoints = [];
    missionStartTime = null;
    rocketFiredTime = null;
    engineStageDone = false;
    postSimFeature = null;

    el('alertBanner').classList.add('hidden');
    el('alertBanner').style.borderColor = '';
    el('alertBanner').style.color = '';
    el('costOverlay').classList.add('hidden');
    el('replayBtn').classList.add('hidden');
    el('hudKillMode').textContent = 'NONE';
    el('hudSys').textContent = 'STANDBY';
    el('hudTargets').textContent = '0';
    el('hudRange').textContent = '---';
    el('hudAlt').textContent = '---';
    el('hudVel').textContent = '---';
    el('tofVal').textContent = '0.0s';
    el('distVal').textContent = '0m';
    el('speedVal').textContent = '0 m/s';
    el('missionTimer').textContent = 'T+00:00';

    // Reset launch status dots
    ['ldot-ignition','ldot-guidance','ldot-fins','ldot-seeker'].forEach(id => {
      const d = el(id);
      if (d) d.classList.remove('on','warn');
    });
    const proceedBtn = el('proceedBtn');
    if (proceedBtn) proceedBtn.disabled = true;

    setStatus('SYSTEM NOMINAL', false);
    showPhase('standby');
    SIM.resetSim();
  }

  /* ─── Main loop ─── */
  function startLoop() {
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      update(dt, now);
    }
    requestAnimationFrame(loop);
  }

  function update(dt, now) {
    // Mission timer
    if (missionStartTime !== null) {
      const elapsed = (now - missionStartTime) / 1000;
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      el('missionTimer').textContent = `T+${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    }

    // During flight: cycle engine → cv tracking panels
    if (simPhase === 'flight') {
      panelPhaseTimer += dt;
      if (panelPhaseTimer < 6) {
        if (activePanel !== 'engine') { activePanel = 'engine'; PANELS.showPanelCanvas('engine'); }
      } else {
        if (activePanel !== 'tracking') { activePanel = 'tracking'; PANELS.showPanelCanvas('tracking'); }
      }
    }

    // Telemetry HUD
    const rPos = SIM.getRocketPos();
    const swarm = SIM.getSwarmCenter();

    if (simPhase === 'flight' || simPhase === 'engineStage') {
      const dist = rPos.distanceTo(swarm);
      el('hudRange').textContent = Math.round(dist * 5);
      el('hudAlt').textContent = Math.round(rPos.y * 2);

      const pts = SIM.getTrajectoryPoints();
      trajectoryPoints = pts;
      if (pts.length > 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const vel = last.distanceTo(prev) / Math.max(dt, 0.001);
        const dispVel = Math.min(Math.round(vel * 15), 420);
        el('hudVel').textContent = dispVel;
        el('speedVal').textContent = `${dispVel} m/s`;
        el('distVal').textContent = `${Math.round(pts.length * 1.5)}m`;
      }

      if (rocketFiredTime !== null) {
        const elapsed = (now - rocketFiredTime) / 1000;
        el('tofVal').textContent = `${elapsed.toFixed(1)}s`;
      }
    }

    // Draw panels
    PANELS.update(dt, activePanel, trajectoryPoints, rPos, swarm);
  }

  /* ─── Helpers ─── */
  function setStatus(text, isAlert) {
    el('statusText').textContent = text;
    el('statusText').style.color = isAlert ? '#ff3c3c' : '#00c896';
    const dot = el('systemStatus');
    dot.className = 'status-dot' + (isAlert ? ' alert' : '');
  }
  function setHud(id, val) {
    const e = el(id);
    if (e) e.textContent = val;
  }

  /* ─── Bootstrap ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
