import { useState, type JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import type { AudioEngine } from '../audio/AudioEngine';
import { PALETTES } from '../config/palettes';
import type { SceneId, VisualizerSettings } from '../config/settings';
import { createAnimatedPalette } from './animatedPalette';
import { CameraRig } from './CameraRig';
import { DynamicLights } from './DynamicLights';
import { AudioFrameDriver, FpsProbe } from './FrameDrivers';
import { NeonTerrain } from './NeonTerrain';
import { ParticleSphere } from './ParticleSphere';
import { PostFX } from './PostFX';
import { TunnelVortex } from './TunnelVortex';
import type { SceneProps } from './types';

const SCENE_COMPONENTS: Record<SceneId, (props: SceneProps) => JSX.Element> = {
  sphere: ParticleSphere,
  terrain: NeonTerrain,
  tunnel: TunnelVortex,
};

interface SceneRootProps {
  engine: AudioEngine;
  settings: VisualizerSettings;
  onFps: (fps: number) => void;
}

export function SceneRoot({ engine, settings, onFps }: SceneRootProps) {
  const palette = PALETTES[settings.palette];
  // Created once (initial palette only); the frame driver lerps these colours in place afterwards.
  const [colors] = useState(() => createAnimatedPalette(palette));
  const ActiveScene = SCENE_COMPONENTS[settings.scene];

  return (
    <Canvas
      className="!fixed inset-0"
      dpr={[1, 1.75]}
      flat
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: [0, 0.6, 7.2], fov: 55, near: 0.1, far: 300 }}
    >
      <AudioFrameDriver engine={engine} colors={colors} palette={palette} />
      <FpsProbe onFps={onFps} />
      <DynamicLights engine={engine} colors={colors} speed={settings.animationSpeed} />

      {/* `key` remounts the scene on switch → previous geometries/materials are disposed. */}
      <ActiveScene
        key={settings.scene}
        engine={engine}
        colors={colors}
        speed={settings.animationSpeed}
        autoRotate={settings.autoRotate}
      />

      <CameraRig
        engine={engine}
        scene={settings.scene}
        autoRotate={settings.autoRotate}
        speed={settings.animationSpeed}
        cameraFx={settings.cameraFx}
      />
      <PostFX engine={engine} bloomStrength={settings.bloomStrength} cameraFx={settings.cameraFx} />
    </Canvas>
  );
}
