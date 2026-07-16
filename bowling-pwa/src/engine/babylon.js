// Per-module Babylon imports, in one place, so Vite tree-shakes away the ~80% of
// the engine this game never touches (GUI, loaders, particles, post-processes,
// extra cameras/materials, animation, audio, gizmos…). Importing the
// `@babylonjs/core` barrel instead pulls in everything.
//
// Babylon relies on side-effect registration for a lot of features — importing a
// class isn't enough, the feature module has to run to patch Scene/hook the
// pipeline. Those imports live here so they load exactly once. Miss one and it
// fails at runtime, not build time, so keep this list in sync with what the game
// actually uses.

// --- side effects (order-independent) ---
import '@babylonjs/core/Meshes/Builders/boxBuilder'
import '@babylonjs/core/Meshes/Builders/sphereBuilder'
import '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import '@babylonjs/core/Meshes/Builders/planeBuilder'
import '@babylonjs/core/Meshes/Builders/polygonBuilder' // CreatePolygon (uses earcut)
import '@babylonjs/core/Meshes/Builders/torusBuilder'
import '@babylonjs/core/Meshes/Builders/discBuilder' // CreateDisc
import '@babylonjs/core/Meshes/Builders/latheBuilder' // CreateLathe (bowling pins)
import '@babylonjs/core/Meshes/Builders/linesBuilder' // CreateLines (path traces)
import '@babylonjs/core/Layers/effectLayerSceneComponent' // GlowLayer hooks
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent' // shadows hook into scene render
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent' // adds Scene.enablePhysics

// --- named re-exports (tree-shaken) ---
export { Engine } from '@babylonjs/core/Engines/engine'
export { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine'
export { Scene } from '@babylonjs/core/scene'
export { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector'
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
export { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
export { PointLight } from '@babylonjs/core/Lights/pointLight'
export { SpotLight } from '@babylonjs/core/Lights/spotLight'
export { GlowLayer } from '@babylonjs/core/Layers/glowLayer'
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
export { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
export { Mesh } from '@babylonjs/core/Meshes/mesh'
export { MirrorTexture } from '@babylonjs/core/Materials/Textures/mirrorTexture'
export { Plane } from '@babylonjs/core/Maths/math.plane'
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
export { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
export { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
export { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
export { PhysicsShapeType, PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
