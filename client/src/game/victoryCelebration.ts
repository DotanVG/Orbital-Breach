import * as THREE from "three";

const FORWARD = new THREE.Vector3(0, 0, -1);

export function getVictoryDanceFacing(cameraQuat: THREE.Quaternion): THREE.Quaternion {
  const forward = FORWARD.clone().applyQuaternion(cameraQuat);
  const flatForward = new THREE.Vector3(forward.x, 0, forward.z);

  if (flatForward.lengthSq() < 1e-5) {
    return new THREE.Quaternion();
  }

  flatForward.normalize();
  return new THREE.Quaternion().setFromUnitVectors(FORWARD, flatForward);
}

export function shouldUseVictoryRearView(
  selfieHeld: boolean,
  victoryDanceActive: boolean,
): boolean {
  return selfieHeld || victoryDanceActive;
}
