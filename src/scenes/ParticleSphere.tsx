import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  type Group,
  type Mesh,
} from 'three';
import { SIMPLEX_NOISE_3D } from './shaders/noise';
import { useDisposable } from './useDisposable';
import type { SceneProps } from './types';

const PARTICLE_COUNT = 32_000;
const SURFACE_RATIO = 0.72;
const RADIUS = 2;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  attribute float aRandom;

  varying vec3 vColor;
  varying float vAlpha;

  ${SIMPLEX_NOISE_3D}

  void main() {
    vec3 p = position;
    float radius = length(p);
    vec3 dir = p / max(radius, 1e-4);

    // Low-frequency "breathing" driven by bass, high-frequency shimmer driven by treble.
    float n = snoise(dir * 1.6 + vec3(uTime * 0.25));
    float detail = snoise(dir * 5.5 + vec3(uTime * 1.3));
    float disp = n * (0.12 + uBass * 0.85) + detail * uTreble * 0.28 + uBeat * 0.2;
    p += dir * disp * (radius / ${RADIUS.toFixed(1)});
    p *= 1.0 + uEnergy * 0.08;

    // Height-dependent twist modulated by the mids.
    float angle = uTime * 0.12 + uMid * 0.9 * p.y * 0.35;
    float c = cos(angle);
    float s = sin(angle);
    p.xz = mat2(c, -s, s, c) * p.xz;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.55 + aRandom * 0.9) * (1.0 + uTreble * 1.4 + uBeat * 0.7);
    gl_PointSize = size * uPixelRatio * (8.0 / -mv.z);

    float heat = clamp(n * 0.5 + 0.5 + uBass * 0.35, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, heat);
    col = mix(col, uColorC, smoothstep(0.7, 1.0, heat) * uBeat);
    vColor = col * (0.32 + uEnergy * 0.7 + uBeat * 0.45);
    vAlpha = 0.25 + 0.55 * aRandom;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a * a * vAlpha);
    #include <colorspace_fragment>
  }
`;

function createSphereGeometry(): BufferGeometry {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const randoms = new Float32Array(PARTICLE_COUNT);
  const surfaceCount = Math.floor(PARTICLE_COUNT * SURFACE_RATIO);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let x: number;
    let y: number;
    let z: number;
    if (i < surfaceCount) {
      // Fibonacci sphere: even distribution on the shell.
      y = 1 - (i / (surfaceCount - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      x = Math.cos(theta) * r * RADIUS;
      z = Math.sin(theta) * r * RADIUS;
      y *= RADIUS;
    } else {
      // Inner "synapse" cloud.
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.cbrt(Math.random()) * RADIUS * 0.85;
      const s = Math.sqrt(1 - u * u);
      x = Math.cos(phi) * s * r;
      y = u * r;
      z = Math.sin(phi) * s * r;
    }
    positions.set([x, y, z], i * 3);
    randoms[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new BufferAttribute(randoms, 1));
  return geometry;
}

export function ParticleSphere({ engine, colors, speed }: SceneProps) {
  const pixelRatio = useThree((s) => s.viewport.dpr);
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const shellRef = useRef<Mesh>(null);

  const geometry = useDisposable(createSphereGeometry, []);
  const coreGeometry = useDisposable(() => new IcosahedronGeometry(0.62, 1), []);
  const shellGeometry = useDisposable(() => new IcosahedronGeometry(0.9, 2), []);

  const material = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uBass: { value: 0 },
          uMid: { value: 0 },
          uTreble: { value: 0 },
          uEnergy: { value: 0 },
          uBeat: { value: 0 },
          uPixelRatio: { value: 1 },
          uSize: { value: 2.6 },
          // References to the live palette colours — no per-frame copies needed.
          uColorA: { value: colors.primary },
          uColorB: { value: colors.secondary },
          uColorC: { value: colors.accent },
        },
      }),
    [colors],
  );

  const coreMaterial = useDisposable(
    () =>
      new MeshStandardMaterial({
        color: '#07070f',
        metalness: 0.85,
        roughness: 0.22,
        flatShading: true,
        emissiveIntensity: 0.6,
      }),
    [],
  );

  const shellMaterial = useDisposable(
    () => new MeshStandardMaterial({ wireframe: true, transparent: true, opacity: 0.35, toneMapped: false }),
    [],
  );

  useFrame((_, delta) => {
    const f = engine.features;
    const u = material.uniforms;
    u.uTime.value += delta * speed * (1 + f.energy * 1.5);
    u.uBass.value = f.bass;
    u.uMid.value = f.mid;
    u.uTreble.value = f.treble;
    u.uEnergy.value = f.energy;
    u.uBeat.value = f.beat;
    u.uPixelRatio.value = pixelRatio;

    if (groupRef.current) groupRef.current.rotation.y += delta * 0.06 * speed;

    if (coreRef.current) {
      const s = 1 + f.bass * 0.45 + f.beat * 0.15;
      coreRef.current.scale.setScalar(s);
      coreRef.current.rotation.x += delta * 0.3 * speed;
      coreRef.current.rotation.y += delta * 0.45 * speed * (1 + f.mid);
    }
    coreMaterial.emissive.copy(colors.secondary);
    coreMaterial.emissiveIntensity = 0.25 + f.bass * 1.6 + f.beat;

    if (shellRef.current) {
      shellRef.current.scale.setScalar(1 + f.mid * 0.5 + f.beat * 0.2);
      shellRef.current.rotation.y -= delta * 0.25 * speed;
      shellRef.current.rotation.z += delta * 0.1 * speed;
    }
    shellMaterial.color.copy(colors.primary);
    shellMaterial.emissive.copy(colors.primary);
    shellMaterial.emissiveIntensity = 0.4 + f.treble * 2;
    shellMaterial.opacity = 0.15 + f.energy * 0.5;
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <mesh ref={coreRef} geometry={coreGeometry} material={coreMaterial} />
      <mesh ref={shellRef} geometry={shellGeometry} material={shellMaterial} />
    </group>
  );
}
