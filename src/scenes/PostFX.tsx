import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction, type BloomEffect } from 'postprocessing';
import { Vector2 } from 'three';
import type { AudioEngine } from '../audio/AudioEngine';

interface PostFXProps {
  engine: AudioEngine;
  bloomStrength: number;
  cameraFx: boolean;
}

/** Bloom whose intensity rides the energy/beat envelope, plus beat-triggered chromatic aberration. */
export function PostFX({ engine, bloomStrength, cameraFx }: PostFXProps) {
  const bloomRef = useRef<BloomEffect>(null);
  // The effect keeps a reference to this vector as its uniform value, so mutating it is enough.
  const aberration = useMemo(() => new Vector2(0, 0), []);

  useFrame(() => {
    const f = engine.features;
    if (bloomRef.current) {
      bloomRef.current.intensity = bloomStrength * (0.55 + f.energy * 0.8 + f.beat * 0.6);
    }
    const shift = cameraFx ? f.beat * 0.0035 + f.treble * 0.0008 : 0;
    aberration.set(shift, shift * 0.6);
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        intensity={bloomStrength}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.35}
        radius={0.78}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={aberration}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette eskil={false} offset={0.22} darkness={0.78} />
    </EffectComposer>
  );
}
