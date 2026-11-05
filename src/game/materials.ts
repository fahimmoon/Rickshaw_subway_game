import * as THREE from 'three';
import { applyCurve } from './curve';

export type GameMaterialKind = 'standard' | 'basic' | 'physical' | 'points' | 'sprite' | 'line';

export function createGameMaterial(
  params: THREE.MeshStandardMaterialParameters & { kind?: 'standard'; curveMultiplier?: number }
): THREE.MeshStandardMaterial;
export function createGameMaterial(
  params: THREE.MeshBasicMaterialParameters & { kind: 'basic'; curveMultiplier?: number }
): THREE.MeshBasicMaterial;
export function createGameMaterial(
  params: THREE.MeshPhysicalMaterialParameters & { kind: 'physical'; curveMultiplier?: number }
): THREE.MeshPhysicalMaterial;
export function createGameMaterial(
  params: THREE.PointsMaterialParameters & { kind: 'points'; curveMultiplier?: number }
): THREE.PointsMaterial;
export function createGameMaterial(
  params: THREE.SpriteMaterialParameters & { kind: 'sprite'; curveMultiplier?: number }
): THREE.SpriteMaterial;
export function createGameMaterial(
  params: THREE.LineBasicMaterialParameters & { kind: 'line'; curveMultiplier?: number }
): THREE.LineBasicMaterial;
export function createGameMaterial(
  params: (
    | (THREE.MeshStandardMaterialParameters & { kind?: 'standard' })
    | (THREE.MeshBasicMaterialParameters & { kind: 'basic' })
    | (THREE.MeshPhysicalMaterialParameters & { kind: 'physical' })
    | (THREE.PointsMaterialParameters & { kind: 'points' })
    | (THREE.SpriteMaterialParameters & { kind: 'sprite' })
    | (THREE.LineBasicMaterialParameters & { kind: 'line' })
  ) & { curveMultiplier?: number }
): THREE.Material {
  const { kind = 'standard', curveMultiplier = 1.0, ...rest } = params;
  let mat: THREE.Material;

  switch (kind) {
    case 'basic':
      mat = new THREE.MeshBasicMaterial(rest as THREE.MeshBasicMaterialParameters);
      break;
    case 'physical':
      mat = new THREE.MeshPhysicalMaterial(rest as THREE.MeshPhysicalMaterialParameters);
      break;
    case 'points':
      mat = new THREE.PointsMaterial(rest as THREE.PointsMaterialParameters);
      break;
    case 'sprite':
      mat = new THREE.SpriteMaterial(rest as THREE.SpriteMaterialParameters);
      break;
    case 'line':
      mat = new THREE.LineBasicMaterial(rest as THREE.LineBasicMaterialParameters);
      break;
    case 'standard':
    default:
      mat = new THREE.MeshStandardMaterial(rest as THREE.MeshStandardMaterialParameters);
      break;
  }

  return applyCurve(mat, curveMultiplier);
}

/**
 * Clones a Three.js material and re-applies the curved-world vertex shader patch
 * (since Three.js Material.clone() does not copy onBeforeCompile or customProgramCacheKey).
 */
export function cloneGameMaterial<T extends THREE.Material>(source: T): T {
  const cloned = source.clone() as T;
  if (cloned.userData) {
    delete cloned.userData.__curvePatched;
  }
  const mult = source.userData?.__curveMultiplier ?? 1.0;
  return applyCurve(cloned, mult);
}

// Shared curve-patched blob shadow geometry & material (zero per-spawn allocation)
let _sharedShadowGeo: THREE.PlaneGeometry | null = null;
let _sharedShadowMat: THREE.MeshBasicMaterial | null = null;

export function createBlobShadow(width: number = 1.8, length: number = 2.4, opacity: number = 0.42): THREE.Mesh {
  if (!_sharedShadowGeo) {
    _sharedShadowGeo = new THREE.PlaneGeometry(1, 1);
    _sharedShadowGeo.rotateX(-Math.PI / 2);
  }
  if (!_sharedShadowMat) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);

    _sharedShadowMat = createGameMaterial({
      kind: 'basic',
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false
    });
  }
  const mesh = new THREE.Mesh(_sharedShadowGeo, _sharedShadowMat);
  mesh.scale.set(width, 1, length);
  mesh.position.y = 0.02;
  mesh.frustumCulled = false;
  mesh.name = 'BlobShadow';
  mesh.userData.isBlobShadow = true;
  return mesh;
}
