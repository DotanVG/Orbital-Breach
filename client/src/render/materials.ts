import * as THREE from 'three';

export function makeArenaMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: 0x4a7a9b, transparent: true, opacity: 0.8 });
}

export function makeObstacleMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x2a3a4a, metalness: 0.3, roughness: 0.7 });
}

export function makeGoalMaterial(team: 0 | 1): THREE.MeshStandardMaterial {
  const color = team === 0 ? 0x004444 : 0x440044;
  const emissive = team === 0 ? 0x00ffff : 0xff00ff;
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
}

export function makePlayerMaterial(team: 0 | 1): THREE.MeshStandardMaterial {
  const color = team === 0 ? 0x00ffff : 0xff00ff;
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
}

export function makeGhostMaterial(team: 0 | 1): THREE.MeshStandardMaterial {
  const color = team === 0 ? 0x00ffff : 0xff00ff;
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.3,
  });
}

export type BreachSurface = 'floor' | 'ceiling' | 'side' | 'back';

export function makeBreachRoomMaterial(team: 0 | 1, surface: BreachSurface = 'side'): THREE.MeshStandardMaterial {
  const emissive = team === 0 ? 0x00ffff : 0xff00ff;

  switch (surface) {
    case 'floor':
      // Dark, matte metal — gravity anchor, clearly "down"
      return new THREE.MeshStandardMaterial({
        color:    team === 0 ? 0x051015 : 0x150510,
        emissive,
        emissiveIntensity: 0.06,
        metalness: 0.8,
        roughness: 0.4,
        side: THREE.DoubleSide,
      });

    case 'ceiling':
      // Mid-tone, diffuse — overhead reference
      return new THREE.MeshStandardMaterial({
        color:    team === 0 ? 0x0d2535 : 0x250d35,
        emissive,
        emissiveIntensity: 0.18,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });

    case 'side':
      // Neutral mid-tone — fills space without dominating
      return new THREE.MeshStandardMaterial({
        color:    team === 0 ? 0x0a2030 : 0x200a30,
        emissive,
        emissiveIntensity: 0.22,
        metalness: 0.3,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });

    case 'back':
      // Brightest emissive — the far end you're heading toward (or fleeing from)
      return new THREE.MeshStandardMaterial({
        color:    team === 0 ? 0x003050 : 0x500030,
        emissive,
        emissiveIntensity: 0.65,
        metalness: 0.05,
        roughness: 0.95,
        side: THREE.DoubleSide,
      });
  }
}

export function makeBarMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xff9900,
    emissive: 0xff6600,
    emissiveIntensity: 0.2,
    metalness: 0.9,
    roughness: 0.1,
  });
}
