import { useEffect, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera } from 'three';

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
import type { AudioEngine } from '../audio/AudioEngine';
import type { SceneId } from '../config/settings';
import { CAMERA_PRESETS } from './cameraPresets';

interface CameraRigProps {
  engine: AudioEngine;
  scene: SceneId;
  autoRotate: boolean;
  speed: number;
  cameraFx: boolean;
}

/**
 * OrbitControls + beat-driven camera effects.
 *
 * drei updates the controls at frame priority -1 (which re-aims the camera with
 * `lookAt`), and this rig runs afterwards at priority 0, so the shake is a pure
 * per-frame rotation offset that never accumulates into the orbit state.
 */
export function CameraRig({ engine, scene, autoRotate, speed, cameraFx }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const preset = CAMERA_PRESETS[scene];

  // Fly to the scene's framing whenever the scene changes.
  useEffect(() => {
    camera.position.set(...preset.position);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
    }
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...preset.target);
      controls.update();
    }
  }, [camera, preset]);

  useFrame((state) => {
    const f = engine.features;
    if (camera instanceof PerspectiveCamera) {
      const kick = cameraFx ? f.beat * 3.5 + f.bass * 2.5 : 0;
      const nextFov = camera.fov + (preset.fov + kick - camera.fov) * 0.2;
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
    if (cameraFx && f.beat > 0.05) {
      const amount = f.beat * 0.01;
      const t = state.clock.elapsedTime * 60;
      camera.rotateX(Math.sin(t * 1.3) * amount);
      camera.rotateY(Math.cos(t * 1.7) * amount);
      camera.rotateZ(Math.sin(t * 0.9) * amount * 0.6);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      rotateSpeed={0.6}
      zoomSpeed={0.7}
      autoRotate={autoRotate && preset.orbitAutoRotate}
      autoRotateSpeed={0.7 * speed}
      minDistance={preset.minDistance}
      maxDistance={preset.maxDistance}
      minPolarAngle={preset.minPolarAngle}
      maxPolarAngle={preset.maxPolarAngle}
      minAzimuthAngle={preset.minAzimuthAngle}
      maxAzimuthAngle={preset.maxAzimuthAngle}
    />
  );
}
