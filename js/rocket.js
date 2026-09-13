import * as THREE from "three";
import { PARAMS } from "./config.js";

// Local convention: rocket's own forward (nose) direction is local +X.
// Nose tip sits at local x = 0, tail sits at local x = -totalLength.
// Radial "up" is local +Y; fins are distributed by rotating about local X.

export function buildRocket() {
  const P = PARAMS.rocket;
  const group = new THREE.Group();
  group.name = "MAELSTROM";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x515a5e,
    roughness: 0.45,
    metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x24282a,
    roughness: 0.55,
    metalness: 0.35,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f21,
    roughness: 0.4,
    metalness: 0.2,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    roughness: 0.5,
    metalness: 0.1,
    emissive: 0x431203,
    emissiveIntensity: 0.4,
  });

  const cylLen = P.totalLength - P.noseRadius; // forward body cylinder length
  const cylCenterX = -P.noseRadius - cylLen / 2;

  // ---------------------------------------------------------------- body
  const bodyGeo = new THREE.CylinderGeometry(P.bodyRadius, P.bodyRadius, cylLen, 32, 1, false);
  bodyGeo.rotateZ(-Math.PI / 2);
  bodyGeo.translate(cylCenterX, 0, 0);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // engine-section skin (slightly different material band = motor casing)
  const engGeo = new THREE.CylinderGeometry(
    P.bodyRadius + 0.0006, P.bodyRadius + 0.0006, P.engineLength, 32, 1, true
  );
  engGeo.rotateZ(-Math.PI / 2);
  engGeo.translate(-P.totalLength + P.engineLength / 2, 0, 0);
  const eng = new THREE.Mesh(engGeo, darkMat);
  eng.castShadow = true;
  eng.receiveShadow = true;
  group.add(eng);

  // thin flare-orange ID band just fwd of the engine section
  const bandGeo = new THREE.CylinderGeometry(P.bodyRadius + 0.001, P.bodyRadius + 0.001, 0.012, 32, 1, true);
  bandGeo.rotateZ(-Math.PI / 2);
  bandGeo.translate(-(P.totalLength - P.engineLength) - 0.01, 0, 0);
  const band = new THREE.Mesh(bandGeo, bandMat);
  group.add(band);

  // nose hemisphere (dome): pole rotated to point along +X, then shifted so
  // its flat circular base sits flush against the forward end of the body
  // cylinder (x = -noseRadius) and its apex reaches the true nose tip (x = 0).
  const noseGeo = new THREE.SphereGeometry(P.noseRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  noseGeo.rotateZ(-Math.PI / 2);
  noseGeo.translate(-P.noseRadius, 0, 0);
  const nose = new THREE.Mesh(noseGeo, darkMat);
  nose.castShadow = true;
  group.add(nose);

  // aft base cap (visible open end of the motor)
  const capGeo = new THREE.CircleGeometry(P.bodyRadius, 32);
  capGeo.rotateY(-Math.PI / 2); // face the cap aft (-X), toward the camera when viewed from behind
  capGeo.translate(-P.totalLength, 0, 0);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.8 });
  const cap = new THREE.Mesh(capGeo, capMat);
  group.add(cap);

  // ---------------------------------------------------------------- fins
  const fixedFinFrontX = -(P.totalLength - P.engineLength); // forward edge of engine section
  const fixedFins = buildFinSet({
    count: P.fixedFinCount,
    material: finMat,
    baseRadius: P.bodyRadius,
    rootX: fixedFinFrontX,
    rootChord: 0.11,
    tipChord: 0.045,
    span: 0.075,
    sweep: 0.075,
    thickness: 0.004,
  });
  fixedFins.name = "fixedFins";
  group.add(fixedFins);

  const controlFinRootX = -P.totalLength + 0.005; // right at the aft/tail
  const controlPivots = buildControlFinSet({
    count: P.controlFinCount,
    material: finMat,
    baseRadius: P.bodyRadius,
    rootX: controlFinRootX,
    chord: 0.065,
    span: 0.07,
    thickness: 0.0035,
  });
  controlPivots.forEach((p) => group.add(p));

  // ---------------------------------------------------------------- nose seeker camera rig
  const noseCameraRig = new THREE.Object3D();
  noseCameraRig.position.set(0.002, 0, 0);
  noseCameraRig.lookAt(new THREE.Vector3(1, 0, 0)); // rig local -Z now aligned to rocket +X
  group.add(noseCameraRig);

  const noseCamera = new THREE.PerspectiveCamera(46, 16 / 10, 0.05, 400);
  noseCameraRig.add(noseCamera);

  group.userData.noseCamera = noseCamera;
  group.userData.controlFinPivots = controlPivots;
  group.userData.length = P.totalLength;

  // orient so rocket's local forward (+X) becomes THREE's more intuitive
  // "the group's own -Z is forward" for easy velocity alignment elsewhere —
  // keep as-is and let placement code use local +X as the forward axis.
  return group;
}

function buildFinShape({ rootChord, tipChord, span, sweep, baseRadius }) {
  const shape = new THREE.Shape();
  // Coordinates: x = axial (0 at leading root edge, negative toward tail),
  //              y = radial distance from rocket centerline.
  shape.moveTo(0, baseRadius); // root leading edge
  shape.lineTo(-sweep, baseRadius + span); // tip leading edge
  shape.lineTo(-sweep - tipChord, baseRadius + span); // tip trailing edge
  shape.lineTo(-rootChord, baseRadius); // root trailing edge
  shape.lineTo(0, baseRadius);
  return shape;
}

function buildFinSet({ count, material, baseRadius, rootX, rootChord, tipChord, span, sweep, thickness }) {
  const group = new THREE.Group();
  const shape = buildFinShape({ rootChord, tipChord, span, sweep, baseRadius });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  geo.translate(rootX, 0, 0);

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const pivot = new THREE.Group();
    pivot.rotation.x = (i * Math.PI * 2) / count;
    pivot.add(mesh);
    group.add(pivot);
  }
  return group;
}

// Control fins get their own hinge pivot per fin so each can deflect about
// its own chordwise hinge line (like a rudder) during the manoeuvre phase,
// independently of which of the four radial positions (0/90/180/270) it sits at.
function buildControlFinSet({ count, material, baseRadius, rootX, chord, span, thickness }) {
  // Geometry is built local to its own hinge line: x=0 leading root edge,
  // x=-chord trailing edge, y=0 at the hinge (root), y=+span at the tip.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, span);
  shape.lineTo(-chord, span);
  shape.lineTo(-chord, 0);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);

  const pivots = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const radialAngle = (i * Math.PI * 2) / count;
    const outer = new THREE.Group(); // fixes the radial position (0/90/180/270)
    outer.rotation.x = radialAngle;

    const hinge = new THREE.Group(); // this one animates for "manoeuvring"
    hinge.position.set(rootX, baseRadius, 0);
    hinge.add(mesh);
    outer.add(hinge);
    outer.userData.deflectGroup = hinge;
    pivots.push(outer);
  }
  return pivots;
}
