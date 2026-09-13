import * as THREE from "three";
import { PARAMS } from "./config.js";

export function buildDroneSwarm() {
  const group = new THREE.Group();
  group.name = "droneSwarm";

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2f31, roughness: 0.5, metalness: 0.4 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.6, metalness: 0.3 });
  const propMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0d,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });

  const drones = [];
  const count = PARAMS.world.droneCount;

  for (let i = 0; i < count; i++) {
    const d = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    d.add(body);

    const armLen = 0.22;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + Math.PI / 4;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, armLen, 6), armMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(Math.cos(ang) * armLen * 0.5, 0, Math.sin(ang) * armLen * 0.5);
      arm.rotation.y = -ang;
      arm.castShadow = true;
      d.add(arm);

      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 16), propMat);
      prop.position.set(Math.cos(ang) * armLen, 0.02, Math.sin(ang) * armLen);
      d.add(prop);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), armMat);
      motor.position.set(Math.cos(ang) * armLen, 0.01, Math.sin(ang) * armLen);
      d.add(motor);

      d.userData.props = d.userData.props || [];
      d.userData.props.push(prop);
    }

    const led = new THREE.PointLight(0xff2f2f, 0.6, 0.6);
    led.position.set(0, -0.02, 0);
    d.add(led);

    d.userData.formationOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 3.4,
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 3.4
    );
    d.userData.bobPhase = Math.random() * Math.PI * 2;
    d.userData.alive = true;
    d.userData.fallVelocity = new THREE.Vector3();
    d.userData.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4
    );

    group.add(d);
    drones.push(d);
  }

  group.userData.drones = drones;
  return group;
}

export function updateSwarmApproach(swarm, t01, dt, clockTime) {
  const start = new THREE.Vector3(...PARAMS.world.swarmStartPosition);
  const end = new THREE.Vector3(...PARAMS.world.swarmEndPosition);
  const center = start.clone().lerp(end, easeOutQuad(t01));

  swarm.userData.drones.forEach((d) => {
    if (!d.userData.alive) return;
    const off = d.userData.formationOffset;
    d.position.set(
      center.x + off.x,
      center.y + off.y + Math.sin(clockTime * 2 + d.userData.bobPhase) * 0.08,
      center.z + off.z
    );
    d.rotation.y += dt * 0.6;
    d.userData.props.forEach((p) => (p.rotation.y += dt * 40));
  });
  swarm.userData.centerWorld = center;
  return center;
}

export function updateSwarmIdle(swarm, dt, clockTime) {
  swarm.userData.drones.forEach((d) => {
    if (!d.userData.alive) return;
    d.userData.props.forEach((p) => (p.rotation.y += dt * 40));
  });
}

export function getSwarmCentroid(swarm) {
  const alive = swarm.userData.drones.filter((d) => d.userData.alive);
  if (alive.length === 0) return swarm.userData.centerWorld || new THREE.Vector3();
  const c = new THREE.Vector3();
  alive.forEach((d) => c.add(d.position));
  c.divideScalar(alive.length);
  return c;
}

export function triggerKill(swarm, mode) {
  swarm.userData.drones.forEach((d) => {
    d.userData.alive = false;
    d.userData.killMode = mode;
    d.userData.fallVelocity.set(
      (Math.random() - 0.5) * (mode === "hard" ? 3.5 : 1.2),
      mode === "hard" ? 1.5 + Math.random() : -0.2,
      (Math.random() - 0.5) * (mode === "hard" ? 3.5 : 1.2)
    );
  });
}

export function updateFallingDrones(swarm, dt) {
  swarm.userData.drones.forEach((d) => {
    if (d.userData.alive) return;
    d.userData.fallVelocity.y -= 9.8 * dt * (d.userData.killMode === "soft" ? 0.5 : 1);
    d.position.addScaledVector(d.userData.fallVelocity, dt);
    d.rotation.x += d.userData.spin.x * dt;
    d.rotation.y += d.userData.spin.y * dt;
    d.rotation.z += d.userData.spin.z * dt;
    if (d.position.y < 0.05) {
      d.position.y = 0.05;
      d.userData.fallVelocity.set(0, 0, 0);
      d.userData.spin.set(0, 0, 0);
    }
  });
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}
