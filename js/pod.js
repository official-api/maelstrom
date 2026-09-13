import * as THREE from "three";

export function buildLauncherPod() {
  const group = new THREE.Group();
  group.name = "launcherPod";

  const caseMat = new THREE.MeshStandardMaterial({ color: 0x3b4247, roughness: 0.6, metalness: 0.4 });
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x1c2124, roughness: 0.4, metalness: 0.5 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x24282a, roughness: 0.7, metalness: 0.3 });

  // base crate
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), caseMat);
  base.position.y = 0.14;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // tripod legs
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), legMat);
    leg.position.set(Math.cos(ang) * 0.32, -0.1, Math.sin(ang) * 0.32);
    leg.rotation.z = Math.cos(ang) * 0.5;
    leg.rotation.x = Math.sin(ang) * -0.5;
    leg.castShadow = true;
    group.add(leg);
  }

  // launch tube, angled up
  const tubeGroup = new THREE.Group();
  tubeGroup.position.set(0, 0.28, 0);
  tubeGroup.rotation.z = THREE.MathUtils.degToRad(-14);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 24, 1, true), tubeMat);
  tube.rotation.z = Math.PI / 2;
  tube.position.x = 0.5;
  tube.castShadow = true;
  tube.receiveShadow = true;
  tubeGroup.add(tube);
  group.add(tubeGroup);
  group.userData.tubeGroup = tubeGroup;
  group.userData.tubeMuzzleLocal = new THREE.Vector3(1.0, 0.28, 0); // approx muzzle in pod-local space before tube rotation applied (used with matrixWorld instead)

  // radar mast + dish
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.55, 8), legMat);
  mast.position.set(-0.28, 0.42, 0);
  mast.castShadow = true;
  group.add(mast);

  const dishGroup = new THREE.Group();
  dishGroup.position.set(-0.28, 0.7, 0);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshStandardMaterial({ color: 0xd8dcdd, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide })
  );
  dish.rotation.x = Math.PI / 2;
  dish.castShadow = true;
  dishGroup.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.012, 0.12, 6), legMat);
  feed.position.y = 0.08;
  dishGroup.add(feed);
  group.add(dishGroup);
  group.userData.dishGroup = dishGroup;

  // small status light
  const statusLight = new THREE.PointLight(0x5fe0c8, 0, 0.4);
  statusLight.position.set(0.25, 0.3, 0.2);
  group.add(statusLight);
  group.userData.statusLight = statusLight;

  const statusBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a2a24, emissive: 0x000000 })
  );
  statusBulb.position.copy(statusLight.position);
  group.add(statusBulb);
  group.userData.statusBulb = statusBulb;

  return group;
}

export function updateRadarSweep(pod, dt, active) {
  pod.userData.dishGroup.rotation.y += dt * (active ? 2.4 : 0.5);
  const bulb = pod.userData.statusBulb;
  const light = pod.userData.statusLight;
  if (active) {
    const glow = new THREE.Color(0x5fe0c8);
    bulb.material.emissive = glow;
    bulb.material.emissiveIntensity = 2;
    light.intensity = 0.6;
  } else {
    bulb.material.emissiveIntensity = 0.1;
    light.intensity = 0.05;
  }
}

// world-space position/direction of the tube muzzle, for spawning the rocket
export function getMuzzleTransform(pod) {
  const tubeGroup = pod.userData.tubeGroup;
  const muzzleLocal = new THREE.Vector3(0.5, 0, 0); // local to tubeGroup (tube extends along +X)
  const dirLocal = new THREE.Vector3(1, 0, 0);
  const worldPos = muzzleLocal.clone();
  tubeGroup.localToWorld(worldPos);
  const worldDir = dirLocal.clone().transformDirection(tubeGroup.matrixWorld).normalize();
  return { position: worldPos, direction: worldDir };
}
