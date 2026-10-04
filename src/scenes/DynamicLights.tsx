import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { AmbientLight, PointLight } from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import type { AnimatedPalette } from './animatedPalette';

interface DynamicLightsProps {
  engine: AudioEngine;
  colors: AnimatedPalette;
  speed: number;
}

/** Two orbiting neon point lights whose intensity and colour follow the bass, treble and beat. */
export function DynamicLights({ engine, colors, speed }: DynamicLightsProps) {
  const ambientRef = useRef<AmbientLight>(null);
  const keyRef = useRef<PointLight>(null);
  const rimRef = useRef<PointLight>(null);
  const angle = useRef(0);

  useFrame((_, delta) => {
    const f = engine.features;
    angle.current += delta * speed * (0.4 + f.energy * 1.5);
    const a = angle.current;

    if (keyRef.current) {
      keyRef.current.position.set(Math.cos(a) * 4.5, Math.sin(a * 0.7) * 2, Math.sin(a) * 4.5);
      keyRef.current.color.copy(colors.primary);
      keyRef.current.intensity = 6 + f.bass * 60 + f.beat * 40;
    }
    if (rimRef.current) {
      rimRef.current.position.set(-Math.cos(a * 1.3) * 4, -Math.sin(a) * 2.5, -Math.sin(a * 1.3) * 4);
      rimRef.current.color.copy(colors.secondary);
      rimRef.current.intensity = 4 + f.treble * 50 + f.beat * 25;
    }
    if (ambientRef.current) {
      ambientRef.current.color.copy(colors.background).lerp(colors.primary, 0.15);
      ambientRef.current.intensity = 0.3 + f.energy * 0.8;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} />
      <pointLight ref={keyRef} decay={1.4} distance={0} />
      <pointLight ref={rimRef} decay={1.4} distance={0} />
    </>
  );
}
