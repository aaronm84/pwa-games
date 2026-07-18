// engine-kit / presets — one-call scene dressing so games get good-looking
// lighting, shadows, and materials without re-deriving them each time.
import {
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  ShadowGenerator,
  PBRMaterial,
  ArcRotateCamera,
} from './babylon.js'

// A soft outdoor lighting rig: ambient fill + a warm key light that casts soft
// shadows. Returns the shadow generator so meshes can be registered as casters.
export function outdoorLight(scene, { intensity = 1, shadowSize = 1024 } = {}) {
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0.2), scene)
  hemi.intensity = 0.55 * intensity
  hemi.groundColor = new Color3(0.35, 0.4, 0.3)

  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.6), scene)
  sun.position = new Vector3(30, 60, -40)
  sun.intensity = 1.15 * intensity

  const shadow = new ShadowGenerator(shadowSize, sun)
  shadow.useBlurExponentialShadowMap = true
  shadow.blurKernel = 32
  shadow.darkness = 0.35

  return { hemi, sun, shadow }
}

// A PBR material with sensible defaults (matte, non-metallic).
export function pbr(scene, { color = '#8888aa', rough = 0.85, metal = 0, name = 'm' } = {}) {
  const m = new PBRMaterial(name, scene)
  m.albedoColor = Color3.FromHexString(color)
  m.metallic = metal
  m.roughness = rough
  return m
}

// An orbit camera framed on a target, tuned for a top-down-ish game view with
// pinch-zoom limits that make sense on a phone.
export function orbitCamera(scene, canvas, { target = Vector3.Zero(), alpha = -Math.PI / 2, beta = 0.85, radius = 20, attach = true } = {}) {
  const cam = new ArcRotateCamera('cam', alpha, beta, radius, target, scene)
  cam.lowerRadiusLimit = 8
  cam.upperRadiusLimit = 40
  cam.lowerBetaLimit = 0.2
  cam.upperBetaLimit = 1.35
  cam.wheelDeltaPercentage = 0.01
  cam.pinchDeltaPercentage = 0.01
  cam.panningSensibility = 0
  if (attach) cam.attachControl(canvas, true)
  return cam
}
