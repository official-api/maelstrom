/* ═══════════════════════════════════════════
   MAELSTROM - MAIN ORCHESTRATOR
   Manages simulation state, UI transitions,
   HUD updates, and the panel draw loop.
   ═══════════════════════════════════════════ */

(() => {
  /* ─── State ─── */
  let simPhase = 'standby';   // standby | approach | killSelect | launch | flight | tracking | intercept | done
  let killMode = null;
  let activePanel = null;
  let lastT = performance.now();
  let missionStartTime = null;
  let trajectoryPoints = [];

  /* ─── In-flight panel stages ───
     sim.js pauses the missile (motor still burning) at 25% / 50% / 75% of
     the total flight distance and fires onStageReached(idx). Each pause
     holds the CURRENT panel on screen until "NEXT STAGE" is tapped, at
     which point we switch to the panel below and let the missile resume. */
  const NEXT_PANEL_AFTER_STAGE = ['aerofoil', 'tracking', null]; // null = no panel change, just resume to finish flight
  let flightPaused = false;
  let pendingNextPanel = null;

  /* ─── DOM Refs ─── */
  const el = id => document.getElementById(id);

  const phases = {
    standby:   el('phase-standby'),
    killmode:  el('phase-killmode'),
    engine:    el('phase-engine'),
    aerofoil:  el('phase-aerofoil'),
    tracking:  el('phase-tracking'),
    payload:   el('phase-payload')
  };

  /* ─── Init ─── */
  function init() {
    SIM.init('simCanvas');
    PANELS.init();

    // Loading screen: stays up until every external sky/ground/mountain
    // texture asset SIM kicked off has finished (successfully or not).
    const loadingOverlay = el('loadingOverlay');
    const loadingBarFill = el('loadingBarFill');
    const loadingSubText = el('loadingSubText');

    SIM.onLoadProgress((loaded, total) => {
      if (!loadingBarFill) return;
      const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
      loadingBarFill.style.width = pct + '%';
      if (loadingSubText) loadingSubText.textContent = `LOADING TERRAIN & SKY ASSETS… ${pct}%`;
    });

    SIM.onAssetsReady(() => {
      if (!loadingOverlay) return;
      if (loadingBarFill) loadingBarFill.style.width = '100%';
      loadingOverlay.classList.add('fade-out');
      // Fully remove from layout/interaction after the fade transition ends,
      // so it can never block clicks on the canvas underneath.
      setTimeout(() => loadingOverlay.classList.add('hidden'), 550);
    });

    // Wire buttons
    el('beginAttackBtn').addEventListener('click', onBeginAttack);
    el('hardKillBtn').addEventListener('click', () => onKillSelect('hard'));
    el('softKillBtn').addEventListener('click', () => onKillSelect('soft'));
    el('replayBtn').addEventListener('click', onReplay);
    el('replayBtn2').addEventListener('click', onReplay);
    el('nextStageBtn').addEventListener('click', onNextStage);

    // SIM callbacks
    SIM.onAlert(onRadarAlert);
    SIM.onRocketLaunch(onRocketLaunched);
    SIM.onIntercept(onInterceptHit);
    SIM.onDone(onSimDone);
    SIM.onStageReached(onStageReached);

    showPhase('standby');
    startLoop();
  }

  /* ─── Panel visibility ─── */
  function showPhase(name) {
    Object.values(phases).forEach(p => {
      if (p) p.classList.remove('active');
    });
    if (phases[name]) phases[name].classList.add('active');
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
    el('alertText').textContent = '⚠ DRONE SWARM DETECTED - RADAR CONTACT CONFIRMED - SELECT INTERCEPT MODE';
    setStatus('THREAT DETECTED', true);
    showPhase('killmode');
    setHud('hudSys', 'THREAT');
    setHud('hudTargets', '10');
    setHud('hudRange', '320');
    el('replayBtn').classList.remove('hidden');
  }

  function onKillSelect(mode) {
    killMode = mode;
    simPhase = 'launch';
    el('alertBanner').classList.add('hidden');
    el('hudKillMode').textContent = mode.toUpperCase();

    setStatus('MISSILE ARMED - LAUNCHING', true);
    showPhase('engine');
    activePanel = 'engine';
    flightPaused = false;
    pendingNextPanel = null;
    el('nextStageOverlay').classList.add('hidden');

    // Update payload panel for selected mode
    PANELS.setPayloadMode(mode);
    updatePayloadDesc(mode);

    SIM.launchRocket(mode);
  }

  function onRocketLaunched() {
    simPhase = 'flight';
    setStatus('MISSILE IN FLIGHT', false);
  }

  function onInterceptHit(mode) {
    simPhase = 'intercept';
    activePanel = 'payload';
    flightPaused = false;
    pendingNextPanel = null;
    el('nextStageOverlay').classList.add('hidden');
    showPhase('payload');
    setStatus('INTERCEPT - WARHEAD DEPLOYED', true);
    el('alertBanner').classList.remove('hidden');
    const modeText = mode === 'hard' ? 'HARD KILL - FRAGMENTATION DEPLOYED' : 'SOFT KILL - CARBON FIBRE DEPLOYED';
    el('alertText').textContent = `✓ ${modeText}`;
    el('alertBanner').style.borderColor = mode === 'hard' ? '#ff3c3c' : '#00aaff';
    el('alertBanner').style.color = mode === 'hard' ? '#ff3c3c' : '#00aaff';
  }

  function onSimDone() {
    simPhase = 'done';
    setTimeout(() => {
      el('costOverlay').classList.remove('hidden');
      setStatus('ENGAGEMENT COMPLETE', false);
    }, 1500);
  }

  function onReplay() {
    // Reset everything
    simPhase = 'standby';
    killMode = null;
    activePanel = null;
    trajectoryPoints = [];
    missionStartTime = null;
    flightPaused = false;
    pendingNextPanel = null;

    el('alertBanner').classList.add('hidden');
    el('alertBanner').style.borderColor = '';
    el('alertBanner').style.color = '';
    el('costOverlay').classList.add('hidden');
    el('replayBtn').classList.add('hidden');
    el('nextStageOverlay').classList.add('hidden');
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

    setStatus('SYSTEM NOMINAL', false);
    showPhase('standby');
    SIM.resetSim();
  }

  /* ─── Flight stage gating (driven by SIM's distance checkpoints) ─── */
  function onStageReached(stageIdx) {
    // SIM has already paused the missile in place (motor still burning).
    flightPaused = true;
    pendingNextPanel = NEXT_PANEL_AFTER_STAGE[stageIdx] ?? null;
    setStatus('HOLDING - AWAITING NEXT STAGE', false);
    el('nextStageOverlay').classList.remove('hidden');
  }

  function onNextStage() {
    if (!flightPaused) return;
    flightPaused = false;
    el('nextStageOverlay').classList.add('hidden');
    if (pendingNextPanel) {
      activePanel = pendingNextPanel;
      showPhase(pendingNextPanel);
    }
    pendingNextPanel = null;
    SIM.resumeRocket();
    setStatus('MISSILE IN FLIGHT', false);
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
    // Update mission timer
    if (missionStartTime !== null) {
      const elapsed = (now - missionStartTime) / 1000;
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      el('missionTimer').textContent = `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // (Panel switching between engine/aerofoil/tracking now happens via the
    // onStageReached / onNextStage handlers above, not on a timer here.)

    // Update telemetry HUD
    const rPos = SIM.getRocketPos();
    const swarm = SIM.getSwarmCenter();

    if (simPhase === 'flight' || simPhase === 'launch') {
      const dist = rPos.distanceTo(swarm);
      el('hudRange').textContent = Math.round(dist * 5); // scale for display
      el('hudAlt').textContent = Math.round(rPos.y * 2);

      // Estimate speed from trajectory
      const pts = SIM.getTrajectoryPoints();
      trajectoryPoints = pts;
      if (pts.length > 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const vel = last.distanceTo(prev) / dt;
        const dispVel = Math.min(Math.round(vel * 15), 420);
        el('hudVel').textContent = dispVel;
        el('speedVal').textContent = `${dispVel} m/s`;
        el('distVal').textContent = `${Math.round(pts.length * 1.5)}m`;
      }

      const elapsed = missionStartTime ? (performance.now() - missionStartTime) / 1000 : 0;
      el('tofVal').textContent = `${elapsed.toFixed(1)}s`;
    }

    // Draw right panels
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

  function updatePayloadDesc(mode) {
    const title = el('payloadTitle');
    const desc = el('payloadDescText');
    if (!title || !desc) return;

    if (mode === 'hard') {
      title.textContent = 'HARD KILL - FRAGMENTATION WARHEAD';
      /* EDITABLE: Hard Kill Payload description */
      desc.textContent = 'High-density tungsten fragmentation sleeve surrounds the warhead core. On fuze trigger, a precisely timed explosive ring shears the sleeve into hundreds of high-velocity fragments with a controlled dispersion cone matched to the swarm spread. Fragments achieve > 400 m/s lateral velocity, defeating drone airframes and rotor assemblies within a 15m radius sphere.';
    } else {
      title.textContent = 'SOFT KILL - CARBON FIBRE BURST';
      /* EDITABLE: Soft Kill Payload description */
      desc.textContent = 'A compressed carbon-fibre filament package is ejected by a small pyrotechnic charge. The filament cloud expands to fill a 20m radius sphere in milliseconds - individual fibres entangle rotor blades and short-circuit exposed electronics. No energetic material is deposited on the ground, making this ideal for urban or complex terrain where collateral damage must be minimised.';
    }
  }

  /* ─── Bootstrap ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
