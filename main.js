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
  let panelPhaseTimer = 0;
  let lastT = performance.now();
  let missionStartTime = null;
  let trajectoryPoints = [];

  /* ─── In-flight panel stages ───
     Each entry plays for `duration` seconds, then the rocket is paused
     (flame/exhaust keep animating) and the mission holds for a "NEXT STAGE"
     tap before moving on to the following animation. */
  const FLIGHT_STAGES = [
    { panel: 'engine',   duration: 3.5 },
    { panel: 'aerofoil', duration: 3.5 },
    { panel: 'tracking', duration: 3.5 }
  ];
  let stageIndex = 0;
  let flightPaused = false;

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
    panelPhaseTimer = 0;
    stageIndex = 0;
    flightPaused = false;
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
    panelPhaseTimer = 0;
    flightPaused = false;
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
    panelPhaseTimer = 0;
    trajectoryPoints = [];
    missionStartTime = null;
    stageIndex = 0;
    flightPaused = false;

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

  /* ─── Flight stage gating ─── */
  function pauseFlight() {
    flightPaused = true;
    SIM.pauseRocket();
    setStatus('HOLDING - AWAITING NEXT STAGE', false);
    el('nextStageOverlay').classList.remove('hidden');
  }

  function onNextStage() {
    if (!flightPaused) return;
    flightPaused = false;
    panelPhaseTimer = 0;
    stageIndex = Math.min(stageIndex + 1, FLIGHT_STAGES.length);
    el('nextStageOverlay').classList.add('hidden');
    SIM.resumeRocket();
    if (stageIndex >= FLIGHT_STAGES.length) {
      // All three staged animations have been dismissed -- let the missile
      // actually close the last bit of distance and detonate.
      SIM.armIntercept();
    }
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

    // Advance panel phases during flight, pausing the rocket in place
    // (motor still burning) between each stage until the user taps "next stage"
    if ((simPhase === 'flight' || simPhase === 'launch') && !flightPaused) {
      panelPhaseTimer += dt;

      const stage = FLIGHT_STAGES[Math.min(stageIndex, FLIGHT_STAGES.length - 1)];
      if (activePanel !== stage.panel) { activePanel = stage.panel; showPhase(stage.panel); }

      if (stageIndex < FLIGHT_STAGES.length && panelPhaseTimer >= stage.duration) {
        pauseFlight();
      }
    }

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
