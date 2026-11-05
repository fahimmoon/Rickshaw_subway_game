import * as THREE from 'three';

// Shared global uniform object for world curvature
export const uCurve = { value: 0.0006 }; // Modest curvature (0.0004 to 0.0008) so distant objects bend smoothly

export const curvedWorldUniforms = {
  uCurve
};

/**
 * Patches any Three.js Material (MeshStandard, MeshBasic, MeshPhysical, Points, Sprite, Shader, Line)
 * so vertex positions bend downward quadratically toward the horizon in world space:
 *   worldPosition.y -= uCurve * distZ * distZ
 * Handles USE_INSTANCING and USE_BATCHING before modelMatrix.
 * Idempotent via material.userData.__curvePatched.
 */
export function applyCurve<T extends THREE.Material>(material: T, curveMultiplier: number = 1.0): T {
  if (!material) return material;
  if (material.userData?.__curvePatched) {
    return material;
  }
  if (!material.userData) {
    material.userData = {};
  }
  material.userData.__curvePatched = true;
  material.userData.__curveMultiplier = curveMultiplier;

  const prevOnBeforeCompile = material.onBeforeCompile as
    | ((shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => void)
    | undefined;

  material.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile(shader, renderer);
    }

    shader.uniforms.uCurve = uCurve;
    shader.uniforms.uCurveMult = { value: curveMultiplier };

    if (!shader.vertexShader.includes('uniform float uCurve;')) {
      shader.vertexShader = `uniform float uCurve;\nuniform float uCurveMult;\n` + shader.vertexShader;
    }

    if (shader.vertexShader.includes('#include <project_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 worldPosition = modelMatrix * mvPosition;

        float distZ = max(0.0, abs(worldPosition.z - cameraPosition.z));
        worldPosition.y -= (uCurve * uCurveMult) * distZ * distZ;

        mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        `
      );
    }
  };

  const baseKey = prevOnBeforeCompile ? 'custom_' : 'std_';
  material.customProgramCacheKey = () => `${baseKey}curved_world_v2_${curveMultiplier}`;
  material.needsUpdate = true;
  return material;
}

/**
 * Alias for backwards compatibility with existing imports.
 */
export const applyCurvedWorld = applyCurve;

/**
 * Recursively applies the curve shader to all Meshes, InstancedMeshes, Points, Sprites, and Lines
 * in an Object3D hierarchy and sets frustumCulled = false so curved vertices never pop or vanish.
 */
export function patchObjectHierarchy(obj: THREE.Object3D, curveMultiplier: number = 1.0): void {
  obj.traverse((child) => {
    const anyChild = child as THREE.Mesh | THREE.Points | THREE.Sprite | THREE.Line;
    if (
      (anyChild as THREE.Mesh).isMesh ||
      (anyChild as THREE.Points).isPoints ||
      (anyChild as THREE.Sprite).isSprite ||
      (anyChild as THREE.Line).isLine
    ) {
      anyChild.frustumCulled = false;
      if (Array.isArray(anyChild.material)) {
        anyChild.material.forEach((mat) => applyCurve(mat, curveMultiplier));
      } else if (anyChild.material) {
        applyCurve(anyChild.material, curveMultiplier);
      }
    }
  });
}

/**
 * Dev-time auditor that traverses every Mesh, InstancedMesh, Points, Sprite, and Line in the scene
 * and logs an error if any visible world object has an unpatched material.
 */
export function auditCurve(scene: THREE.Object3D): string[] {
  const unpatched: string[] = [];
  scene.traverse((child) => {
    if (child.userData?.skipCurveAudit) return;
    // Check if any ancestor has skipCurveAudit
    let p: THREE.Object3D | null = child.parent;
    while (p) {
      if (p.userData?.skipCurveAudit) return;
      p = p.parent;
    }

    const anyChild = child as THREE.Mesh | THREE.Points | THREE.Sprite | THREE.Line;
    if (
      (anyChild as THREE.Mesh).isMesh ||
      (anyChild as THREE.Points).isPoints ||
      (anyChild as THREE.Sprite).isSprite ||
      (anyChild as THREE.Line).isLine
    ) {
      const mats = Array.isArray(anyChild.material) ? anyChild.material : [anyChild.material];
      for (const mat of mats) {
        if (mat && !mat.userData?.__curvePatched) {
          const label = `${child.name || child.type} (mat: ${mat.type})`;
          unpatched.push(label);
          // Auto-patch so it never stays broken, but log loudly in dev
          console.error(`[auditCurve] Unpatched material found on mesh: ${label}`);
          applyCurve(mat);
        }
      }
      if (anyChild.frustumCulled) {
        anyChild.frustumCulled = false;
      }
    }
  });
  return unpatched;
}
