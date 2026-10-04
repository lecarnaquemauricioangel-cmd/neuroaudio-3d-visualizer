import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  type Group,
  type Mesh,
} from 'three';
import { SIMPLEX_NOISE_3D } from './shaders/noise';
import { useDisposable } from './useDisposable';
import type { SceneProps } from './types';

// Grid layout (world units).
const HALF_W = 24;
const NEAR_Z = 8;
const FAR_Z = -60;
const CELL = 0.5;

// Spectrum history texture: X = frequency (log scale), Y = time (row 0 = now).
const FREQ_BINS = 128;
const HISTORY_ROWS = 128;
const ROWS_PER_SECOND = 48;

const terrainVertex = /* glsl */ `
  uniform sampler2D uSpectrum;
  uniform float uScroll;
  uniform float uBass;
  uniform float uEnergy;
  uniform float uAmp;

  varying float vHeight;
  varying float vFog;
  varying float vSpec;

  ${SIMPLEX_NOISE_3D}

  void main() {
    vec3 p = position;
    // Slide the lattice toward the camera, wrapping every cell → infinite grid illusion.
    p.z += mod(uScroll, ${CELL.toFixed(2)});

    float fx = abs(p.x) / ${HALF_W.toFixed(1)};
    float hist = clamp((${NEAR_Z.toFixed(1)} - p.z) / ${(NEAR_Z - FAR_Z).toFixed(1)}, 0.0, 1.0);
    float spec = texture2D(uSpectrum, vec2(clamp(fx * 1.1, 0.0, 1.0), hist)).r;

    // Flat "highway" in the centre, mountains rising toward the edges.
    float road = smoothstep(0.035, 0.2, fx);
    float hills = (snoise(vec3(p.x * 0.11, (p.z - uScroll) * 0.11, 0.0)) * 0.5 + 0.5) * pow(fx, 1.4) * 4.0;
    float h = spec * spec * uAmp * (1.0 + uBass * 1.2) * road + hills * (0.55 + uEnergy * 0.9);
    p.y = h;

    vHeight = clamp(h / 6.0, 0.0, 1.0);
    vSpec = spec;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFog = smoothstep(16.0, 60.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const terrainFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uFogColor;
  uniform float uEnergy;
  uniform float uBeat;

  varying float vHeight;
  varying float vFog;
  varying float vSpec;

  void main() {
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.8, vHeight));
    col = mix(col, uColorC, smoothstep(0.65, 1.0, vSpec) * 0.7);
    col *= 0.55 + uEnergy * 0.7 + uBeat * 0.5;
    col = mix(col, uFogColor, vFog);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const sunVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uTime;
  uniform float uBass;
  varying vec2 vUv;

  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);
    float disc = smoothstep(0.405, 0.395, d);
    float glow = pow(smoothstep(0.5, 0.36, d), 2.0) * (0.25 + uBass * 0.5);

    // Retro horizontal slits that thicken toward the bottom and scroll downward.
    float y = vUv.y;
    float band = fract(y * 16.0 + uTime * 0.35);
    float thickness = clamp((0.52 - y) * 1.6, 0.0, 0.85);
    float slit = y < 0.52 ? step(thickness, band) : 1.0;

    vec3 col = mix(uBottom, uTop, smoothstep(0.1, 0.9, y)) * (0.8 + uBass * 0.9);
    float alpha = disc * slit + glow;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

/** Line lattice (no triangle diagonals) so it reads as a clean neon grid. */
function createGridGeometry(): BufferGeometry {
  const nx = Math.round((HALF_W * 2) / CELL);
  const nz = Math.round((NEAR_Z - FAR_Z) / CELL);
  const segments = (nz + 1) * nx + (nx + 1) * nz;
  const positions = new Float32Array(segments * 2 * 3);
  let o = 0;
  const push = (x: number, z: number) => {
    positions[o++] = x;
    positions[o++] = 0;
    positions[o++] = z;
  };

  for (let j = 0; j <= nz; j++) {
    const z = FAR_Z + j * CELL;
    for (let i = 0; i < nx; i++) {
      push(-HALF_W + i * CELL, z);
      push(-HALF_W + (i + 1) * CELL, z);
    }
  }
  for (let i = 0; i <= nx; i++) {
    const x = -HALF_W + i * CELL;
    for (let j = 0; j < nz; j++) {
      push(x, FAR_Z + j * CELL);
      push(x, FAR_Z + (j + 1) * CELL);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}

/** Precomputed log-spaced bin ranges so the bass occupies as much width as the treble. */
function createLogBins(spectrumLength: number): Array<[number, number]> {
  const minBin = 1;
  const maxBin = Math.floor(spectrumLength * 0.68); // ≈ 16 kHz @ 48 kHz
  const edge = (i: number) => Math.floor(minBin * Math.pow(maxBin / minBin, i / FREQ_BINS));
  return Array.from({ length: FREQ_BINS }, (_, i) => {
    const start = edge(i);
    return [start, Math.max(start, edge(i + 1) - 1)];
  });
}

export function NeonTerrain({ engine, colors, speed, autoRotate }: SceneProps) {
  const groupRef = useRef<Group>(null);
  const sunRef = useRef<Mesh>(null);
  const rowAccumulator = useRef(0);
  const elapsed = useRef(0);

  const logBins = useMemo(() => createLogBins(engine.features.spectrum.length), [engine]);

  const history = useDisposable(() => {
    const data = new Uint8Array(FREQ_BINS * HISTORY_ROWS);
    const texture = new DataTexture(data, FREQ_BINS, HISTORY_ROWS, RedFormat, UnsignedByteType);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return { data, texture, dispose: () => texture.dispose() };
  }, []);
  const spectrumTexture = history.texture;

  const gridGeometry = useDisposable(createGridGeometry, []);
  const sunGeometry = useDisposable(() => new PlaneGeometry(30, 30), []);
  const floorGeometry = useDisposable(() => new PlaneGeometry(HALF_W * 2, NEAR_Z - FAR_Z + 4), []);

  const gridMaterial = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader: terrainVertex,
        fragmentShader: terrainFragment,
        uniforms: {
          uSpectrum: { value: spectrumTexture },
          uScroll: { value: 0 },
          uBass: { value: 0 },
          uEnergy: { value: 0 },
          uBeat: { value: 0 },
          uAmp: { value: 5.5 },
          uColorA: { value: colors.primary },
          uColorB: { value: colors.secondary },
          uColorC: { value: colors.accent },
          uFogColor: { value: colors.background },
        },
      }),
    [spectrumTexture, colors],
  );

  const sunMaterial = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader: sunVertex,
        fragmentShader: sunFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTop: { value: colors.accent },
          uBottom: { value: colors.secondary },
          uTime: { value: 0 },
          uBass: { value: 0 },
        },
      }),
    [colors],
  );

  const floorMaterial = useDisposable(() => new MeshBasicMaterial({ color: colors.background }), [colors]);

  useFrame((_, delta) => {
    const f = engine.features;
    elapsed.current += delta * speed;

    // Push new spectrum rows into the history texture → waves propagate toward the horizon.
    rowAccumulator.current += delta * ROWS_PER_SECOND * speed;
    if (rowAccumulator.current >= 1) {
      const data = history.data;
      const rows = Math.min(HISTORY_ROWS, Math.floor(rowAccumulator.current));
      rowAccumulator.current -= rows;
      data.copyWithin(FREQ_BINS * rows, 0, data.length - FREQ_BINS * rows);
      for (let i = 0; i < FREQ_BINS; i++) {
        const [start, end] = logBins[i];
        let sum = 0;
        for (let b = start; b <= end; b++) sum += f.spectrum[b];
        const value = sum / (end - start + 1);
        for (let r = 0; r < rows; r++) data[r * FREQ_BINS + i] = value;
      }
      spectrumTexture.needsUpdate = true;
    }

    const u = gridMaterial.uniforms;
    u.uScroll.value += delta * speed * (2.2 + f.energy * 6 + f.beat * 2);
    u.uBass.value = f.bass;
    u.uEnergy.value = f.energy;
    u.uBeat.value = f.beat;

    sunMaterial.uniforms.uTime.value = elapsed.current;
    sunMaterial.uniforms.uBass.value = f.bass;
    floorMaterial.color.copy(colors.background);

    if (sunRef.current) sunRef.current.scale.setScalar(1 + f.bass * 0.08 + f.beat * 0.04);
    if (groupRef.current) {
      const target = autoRotate ? Math.sin(elapsed.current * 0.12) * 0.22 : 0;
      groupRef.current.rotation.y += (target - groupRef.current.rotation.y) * Math.min(1, delta * 2);
    }
  });

  return (
    <group ref={groupRef}>
      <Stars radius={90} depth={40} count={2500} factor={3.2} saturation={0} fade speed={0.6} />
      <mesh ref={sunRef} geometry={sunGeometry} material={sunMaterial} position={[0, 6.5, -72]} />
      <mesh
        geometry={floorGeometry}
        material={floorMaterial}
        rotation-x={-Math.PI / 2}
        position={[0, -0.04, (NEAR_Z + FAR_Z) / 2]}
      />
      <lineSegments geometry={gridGeometry} material={gridMaterial} frustumCulled={false} />
    </group>
  );
}
