import * as THREE from "three";
import { DESCRIPTIONS as D, PARAMS } from "./config.js";
import { createSceneSetup } from "./sceneSetup.js";
import { buildRocket } from "./rocket.js";
import { buildLauncherPod, updateRadarSweep, getMuzzleTransform } from "./pod.js";
import {
  buildDroneSwarm, updateSwarmApproach, updateSwarmIdle,
  getSwarmCentroid, triggerKill, updateFallingDrones,
} from "./drones.js";
import { createEnginePanel } from "./panels/enginePanel.js";
import { createOpticalPanel } from "./panels/opticalPanel.js";
import { createTrajectoryPanel } from "./panels/trajectoryPanel.js";
import { createFeaturePanel } from "./panels/featurePanels.js";

// ============================================================================
// DOM references
// ============================================================================
const $ = (id) => document.getElementById(id);
const mainCanvas = $("main-canvas");
const mainPanel = $("panel-main");
const alertBanner = $("alert-banner");
const mainCaption = $("main-caption");

const stages = {
  intro: $("stage-intro"),
  select: $("stage-select"),
  engine: $("stage-engine"),
  tracking: $("stage-tracking"),
  result: $("stage-result"),
  feature: $("stage-feature"),
};

// ============================================================================
// Static copy from config
// ============================================================================
$("intro-title").textContent = D.intro.title;
$("intro-body").textContent = D.intro.body;
$("select-title").textContent = D.detection.title;
$("select-body").textContent = D.detection.body;
$("engine-title").textContent = D.engineCutaway.title;
$("engine-body").textContent = D.engineCutaway.body;
$("btn-next-stage").textContent = D.nextStage.label;
$("tracking-title").textContent = D.opticalTracking.title;
$("tracking-body").textContent = D.opticalTracking.body;
$("result-title").textContent = D.costComparison.title;
$("cost-left-label").textContent = D.costComparison.left.label;
$("cost-left-figure").textContent = D.costComparison.left.cost;
$("cost-left-note").textContent = D.costComparison.left.note;
$("cost-right-label").textContent = D.costComparison.right.label;
$("cost-right-figure").textContent = D.costComparison.right.cost;
$("cost-right-note").textContent = D.costComparison.right.note;
$("cost-footnote").textContent = D.costComparison.footnote;
$("feature-menu-title").textContent = D.featureMenu.title;
$("btn-begin").textContent = D.buttons.begin;
$("btn-hard").textContent = D.buttons.hardKill;
$("btn-soft").textContent = D.buttons.softKill;
$("btn-feature-back").textContent = "← " + D.buttons.back;
$("bottom-panel-label").textContent = D.panels.trajectoryTitle;
$("top-panel-label").textContent = "Control";
document.title = D.panels.mainTitle;

document.querySelectorAll("[data-feature]").forEach((btn) => {
  const key = btn.getAttribute("data-feature");
  btn.textContent = D.features[key].label;
  btn.addEventListener("click", () => showFeature(key));
});

// ============================================================================
// Three.js world
// ============================================================================
const { renderer, scene, camera, onResize } = createSceneSetup(mainCanvas);

const pod = buildLauncherPod();
pod.position.set(...PARAMS.world.podPosition);
pod.rotation.y = Math.PI / 2; // face the pod toward -Z, the swarm's approach line
scene.add(pod);
pod.updateMatrixWorld(true);

const swarm = buildDroneSwarm();
scene.add(swarm);

const rocket = buildRocket();
rocket.visible = false;
scene.add(rocket);

const muzzle = getMuzzleTransform(pod); // fixed launcher, computed once

// impact flash FX
const flashGeo = new THREE.SphereGeometry(1, 24, 16);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0 });
const flashMesh = new THREE.Mesh(flashGeo, flashMat);
scene.add(flashMesh);
const flashLight = new THREE.PointLight(0xffdca0, 0, 20);
scene.add(flashLight);

// ============================================================================
// Panels
// ============================================================================
const enginePanel = createEnginePanel($("engine-canvas"));
const opticalPanel = createOpticalPanel($("optical-render-canvas"), $("optical-overlay-canvas"), scene);
const trajectoryPanel = createTrajectoryPanel($("trajectory-canvas"));
const featurePanel = createFeaturePanel($("feature-canvas"));
trajectoryPanel.setBounds(0, 26, 0, 12);

// ============================================================================
// State machine
// ============================================================================
const STATE = {
  INTRO: "intro",
  APPROACH: "approach",
  DETECTED: "detected",
  LAUNCH: "launch",
  PAUSED: "paused",
  TRACKING: "tracking",
  INTERCEPT: "intercept",
  RESULT: "result",
  FEATURE: "feature",
};

let state = STATE.INTRO;
let killMode = null;
let phaseT0 = performance.now() / 1000;
let launchStartPos = new THREE.Vector3();
let launchEndPos = new THREE.Vector3();
let trackingStartPos = new THREE.Vector3();
let interceptPoint = new THREE.Vector3();
let podDownrangeOrigin = new THREE.Vector3(PARAMS.world.podPosition[0], 0, PARAMS.world.podPosition[2]);
let preFeatureStage = "result";

function now() { return performance.now() / 1000; }
function phaseTime() { return now() - phaseT0; }
function setPhase(s) { state = s; phaseT0 = now(); }

function showStage(name) {
  Object.values(stages).forEach((el) => el.classList.add("hidden"));
  stages[name].classList.remove("hidden");
}

function setCaption(text) {
  if (!text) { mainCaption.classList.add("hidden"); return; }
  mainCaption.textContent = text;
  mainCaption.classList.remove("hidden");
}

function showAlert(text) {
  $("alert-text").textContent = text;
  alertBanner.classList.remove("hidden");
}
function hideAlert() { alertBanner.classList.add("hidden"); }

// ---------------------------------------------------------------- transitions
$("btn-begin").addEventListener("click", () => {
  setPhase(STATE.APPROACH);
  showStage("intro"); // keep intro visible (title) while swarm approaches
  setCaption("Hostile drone swarm inbound.");
});

$("btn-hard").addEventListener("click", () => startLaunch("hard"));
$("btn-soft").addEventListener("click", () => startLaunch("soft"));

function startLaunch(mode) {
  killMode = mode;
  hideAlert();
  rocket.visible = true;
  rocket.position.copy(muzzle.position);
  rocket.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), muzzle.direction);
  launchStartPos.copy(muzzle.position);
  launchEndPos.copy(muzzle.position).addScaledVector(muzzle.direction, PARAMS.rocket.totalLength * 1.7);
  trajectoryPanel.reset();
  trajectoryPanel.addMarker(0, muzzle.position.y, "#5fe0c8", "LAUNCH");
  enginePanel.reset();
  showStage("engine");
  $("btn-next-stage").classList.add("hidden");
  setPhase(STATE.LAUNCH);
  setCaption(mode === "hard" ? D.hardKill.title : D.softKill.title);
}

$("btn-next-stage").addEventListener("click", () => {
  trackingStartPos.copy(rocket.position);
  showStage("tracking");
  setPhase(STATE.TRACKING);
  setCaption(D.opticalTracking.title);
});

$("btn-replay").addEventListener("click", replay);

function replay() {
  hideAlert();
  setCaption(null);
  rocket.visible = false;
  killMode = null;
  delete stages.select.dataset.shown;
  swarm.userData.drones.forEach((d) => {
    d.userData.alive = true;
    d.userData.fallVelocity.set(0, 0, 0);
  });
  flashMat.opacity = 0;
  flashLight.intensity = 0;
  trajectoryPanel.reset();
  showStage("intro");
  setPhase(STATE.INTRO);
}

function showFeature(key) {
  if (state !== STATE.FEATURE) preFeatureStage = "result";
  $("feature-title").textContent = D.features[key].title;
  $("feature-body").textContent = D.features[key].body;
  stages.feature.dataset.activeFeature = key;
  showStage("feature");
  setPhase(STATE.FEATURE);
}
$("btn-feature-back").addEventListener("click", () => {
  showStage(preFeatureStage);
  setPhase(STATE.RESULT);
});

// ============================================================================
// Camera cinematics
// ============================================================================
const camTarget = new THREE.Vector3(0, 1.2, 0);
const camDesired = new THREE.Vector3(-6, 3.2, 10);
const lookDesired = new THREE.Vector3(0, 1.2, 0);

function updateCamera(dt) {
  const podPos = pod.position;
  if (state === STATE.INTRO || state === STATE.APPROACH || state === STATE.DETECTED) {
    const t = now() * 0.06;
    camDesired.set(podPos.x + Math.cos(t) * 7, 3.4, podPos.z + 4 + Math.sin(t) * 7);
    lookDesired.copy(podPos).add(new THREE.Vector3(0, 0.8, -3));
  } else if (state === STATE.LAUNCH || state === STATE.PAUSED) {
    camDesired.set(podPos.x + 3.2, 1.6, podPos.z + 2.6);
    lookDesired.copy(rocket.position);
  } else if (state === STATE.TRACKING || state === STATE.INTERCEPT) {
    const behind = rocket.position.clone().addScaledVector(getForward(rocket), -2.4).add(new THREE.Vector3(1.1, 0.7, 0.6));
    camDesired.copy(behind);
    lookDesired.copy(rocket.position).addScaledVector(getForward(rocket), 3);
  } else {
    const c = getSwarmCentroid(swarm);
    camDesired.set(c.x + 3, c.y + 1.6, c.z + 5);
    lookDesired.copy(c);
  }
  const k = 1 - Math.pow(0.0025, dt);
  camera.position.lerp(camDesired, k);
  camTarget.lerp(lookDesired, k);
  camera.lookAt(camTarget);
}

function getForward(obj) {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(obj.quaternion);
}

// ============================================================================
// Main animation loop
// ============================================================================
const clock = new THREE.Clock();
let scanPhase = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const pt = phaseTime();

  updateRadarSweep(pod, dt, state !== STATE.INTRO);

  // ---------------------------------------------------- state behaviour
  if (state === STATE.INTRO) {
    updateSwarmApproach(swarm, 0, dt, t);
    swarm.visible = false;
  } else if (state === STATE.APPROACH) {
    swarm.visible = true;
    const dur = PARAMS.timeline.swarmApproachSeconds;
    const t01 = Math.min(1, pt / dur);
    updateSwarmApproach(swarm, t01, dt, t);
    if (t01 >= 1) {
      showAlert(D.detection.title);
      setPhase(STATE.DETECTED);
    }
  } else if (state === STATE.DETECTED) {
    updateSwarmIdle(swarm, dt, t);
    if (pt > PARAMS.timeline.detectionAlertSeconds && !stages.select.dataset.shown) {
      hideAlert();
      showStage("select");
      stages.select.dataset.shown = "1";
    }
  } else if (state === STATE.LAUNCH) {
    updateSwarmIdle(swarm, dt, t);
    const dur = 1.5;
    const t01 = Math.min(1, pt / dur);
    const eased = easeOutCubic(t01);
    rocket.position.lerpVectors(launchStartPos, launchEndPos, eased);
    enginePanel.render(Math.min(1, pt / PARAMS.timeline.engineBurnSeconds));
    recordTrajectory(rocket.position);
    if (t01 >= 1) {
      $("btn-next-stage").classList.remove("hidden");
      setPhase(STATE.PAUSED);
    }
  } else if (state === STATE.PAUSED) {
    updateSwarmIdle(swarm, 0, t);
    enginePanel.render(Math.min(1, 1.0));
  } else if (state === STATE.TRACKING) {
    updateSwarmIdle(swarm, dt, t);
    const dur = PARAMS.timeline.trackingSeconds;
    const t01 = Math.min(1, pt / dur);
    const centroid = getSwarmCentroid(swarm);
    const eased = easeInOutQuad(t01);
    const arcLift = Math.sin(Math.PI * t01) * 1.3;
    const pos = trackingStartPos.clone().lerp(centroid, eased);
    pos.y += arcLift;
    const prevPos = rocket.position.clone();
    rocket.position.copy(pos);
    const fwd = pos.clone().sub(prevPos);
    if (fwd.lengthSq() > 1e-8) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), fwd.normalize());
      rocket.quaternion.slerp(q, 0.35);
    }
    animateControlFins(t);
    recordTrajectory(rocket.position);
    scanPhase += dt * 0.5;
    opticalPanel.render(rocket.userData.noseCamera, swarm.userData.drones, centroid, scanPhase);

    if (t01 >= 1) {
      interceptPoint.copy(rocket.position);
      trajectoryPanel.addMarker(
        distAlong(interceptPoint), interceptPoint.y, "#ff5a1f", "INTERCEPT"
      );
      triggerKill(swarm, killMode);
      flashMat.opacity = 1;
      flashLight.intensity = 6;
      flashLight.position.copy(interceptPoint);
      flashMesh.position.copy(interceptPoint);
      flashMesh.scale.setScalar(0.05);
      rocket.visible = false;
      setCaption(killMode === "hard" ? D.intercept.hard : D.intercept.soft);
      setPhase(STATE.INTERCEPT);
    }
  } else if (state === STATE.INTERCEPT) {
    updateFallingDrones(swarm, dt);
    const dur = PARAMS.timeline.interceptEffectSeconds;
    const t01 = Math.min(1, pt / dur);
    flashMesh.scale.setScalar(0.05 + t01 * 3.2);
    flashMat.opacity = Math.max(0, 1 - t01 * 1.4);
    flashLight.intensity = Math.max(0, 6 * (1 - t01 * 1.4));
    if (t01 >= 1) {
      showStage("result");
      setCaption(null);
      setPhase(STATE.RESULT);
    }
  } else if (state === STATE.RESULT || state === STATE.FEATURE) {
    updateFallingDrones(swarm, dt);
  }

  // feature canvas keeps animating whenever visible
  if (state === STATE.FEATURE) {
    const key = stages.feature.dataset.activeFeature || "aerofoil";
    featurePanel.render(key, t);
  }

  trajectoryPanel.render();
  updateCamera(dt);
  onResize(mainPanel);
  renderer.render(scene, camera);
}

function animateControlFins(t) {
  const pivots = rocket.userData.controlFinPivots || [];
  pivots.forEach((p, i) => {
    const phase = i * 1.3;
    p.userData.deflectGroup.rotation.x = Math.sin(t * 3.2 + phase) * 0.28;
  });
}

function recordTrajectory(pos) {
  trajectoryPanel.addPoint(distAlong(pos), pos.y);
}
function distAlong(pos) {
  return podDownrangeOrigin.distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

showStage("intro");
window.addEventListener("resize", () => onResize(mainPanel));
animate();
