import type { SceneId } from '../config/settings';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  /** Whether OrbitControls' auto-rotate makes sense (others implement their own motion). */
  orbitAutoRotate: boolean;
}

export const CAMERA_PRESETS: Record<SceneId, CameraPreset> = {
  sphere: {
    position: [0, 0.6, 7.2],
    target: [0, 0, 0],
    fov: 55,
    minDistance: 3.5,
    maxDistance: 16,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
    orbitAutoRotate: true,
  },
  terrain: {
    position: [0, 2.6, 8],
    target: [0, 1.4, -6],
    fov: 62,
    minDistance: 4,
    maxDistance: 24,
    minPolarAngle: 0.9,
    maxPolarAngle: 1.53,
    minAzimuthAngle: -0.9,
    maxAzimuthAngle: 0.9,
    orbitAutoRotate: false,
  },
  tunnel: {
    position: [0, 0, 6.5],
    target: [0, 0, -10],
    fov: 70,
    minDistance: 4,
    maxDistance: 22,
    minPolarAngle: 1.15,
    maxPolarAngle: 2.0,
    minAzimuthAngle: -0.45,
    maxAzimuthAngle: 0.45,
    orbitAutoRotate: false,
  },
};
