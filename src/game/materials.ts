import * as THREE from 'three';
import { applyCurve } from './curve';

export type GameMaterialKind = 'standard' | 'basic' | 'physical' | 'points' | 'sprite' | 'line';

// Shared palette material cache — guarantees ONE material instance per visual signature
const _sharedMaterialPalette = new Map<string, THREE.Material>();

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
  const { kind = 'standard', curveMultiplier = 1.0, ...rest } = params as any;

  // Build a deterministic cache key for non-textured palette materials so they share ONE GPU program
  const hasUniqueMap = Boolean(rest.map || rest.normalMap || rest.roughnessMap || rest.alphaMap);
  const colorKey = rest.color !== undefined ? new THREE.Color(rest.color).getHexString() : 'ffffff';
  const emissiveKey = rest.emissive !== undefined ? new THREE.Color(rest.emissive).getHexString() : '000000';
  const emIntensity = rest.emissiveIntensity ?? 0;
  const opacityKey = rest.transparent ? (rest.opacity ?? 1).toFixed(2) : 'opaque';
  const cacheKey = !hasUniqueMap
    ? `${kind}_${colorKey}_${emissiveKey}_${emIntensity}_${opacityKey}_${Boolean(rest.wireframe)}_${Boolean(rest.vertexColors)}_${curveMultiplier}`
    : '';

  if (cacheKey && _sharedMaterialPalette.has(cacheKey)) {
    return _sharedMaterialPalette.get(cacheKey)!;
  }

  let mat: THREE.Material;

  switch (kind) {
    case 'basic':
      mat = new THREE.MeshBasicMaterial(rest as THREE.MeshBasicMaterialParameters);
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
    case 'physical':
    case 'standard':
    default: {
      // Stage 2 Optimization: Prefer fast flat-shaded MeshLambertMaterial over expensive PBR MeshStandardMaterial
      const lambertParams: THREE.MeshLambertMaterialParameters = {
        color: rest.color,
        map: rest.map,
        emissive: rest.emissive,
        emissiveIntensity: rest.emissiveIntensity,
        transparent: Boolean(rest.transparent),
        opacity: rest.opacity ?? 1.0,
        wireframe: Boolean(rest.wireframe),
        vertexColors: Boolean(rest.vertexColors),
        side: rest.side ?? THREE.FrontSide,
        depthWrite: rest.depthWrite ?? true,
        flatShading: true
      };
      mat = new THREE.MeshLambertMaterial(lambertParams);
      break;
    }
  }

  const patched = applyCurve(mat, curveMultiplier);
  if (cacheKey) {
    _sharedMaterialPalette.set(cacheKey, patched);
  }
  return patched;
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
  mesh.frustumCulled = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.name = 'BlobShadow';
  mesh.userData.isBlobShadow = true;
  return mesh;
}
