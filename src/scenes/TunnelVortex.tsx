import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TorusGeometry,
  type Group,
} from 'three';
import { useDisposable } from './useDisposable';
import type { SceneProps } from './types';

const RINGS_PER_KIND = 28;
const RING_COUNT = RINGS_PER_KIND * 2;
const SPACING = 1.2;
const LENGTH = RING_COUNT * SPACING;
const NEAR_Z = 8;
const RADIUS = 3.2;
const STREAK_COUNT = 1800;

/** Curved tunnel path: the far end snakes around while the near end stays centred on the camera. */
const PATH_GLSL = /* glsl */ `
  vec2 tunnelOffset(float z, float t) {
    float depth = clamp((${NEAR_Z.toFixed(1)} - z) / ${LENGTH.toFixed(1)}, 0.0, 1.0);
    return vec2(sin(z * 0.09 + t * 0.6) * 1.6, cos(z * 0.07 + t * 0.5) * 1.1) * depth;
  }
`;

function tunnelOffset(z: number, t: number, out: { x: number; y: number }): void {
  const depth = Math.min(1, Math.max(0, (NEAR_Z - z) / LENGTH));
  out.x = Math.sin(z * 0.09 + t * 0.6) * 1.6 * depth;
  out.y = Math.cos(z * 0.07 + t * 0.5) * 1.1 * depth;
}

const streakVertex = /* glsl */ `
  uniform float uTravel;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  attribute float aRandom;
  varying float vAlpha;

  ${PATH_GLSL}

  void main() {
    vec3 p = position;
    p.z = ${NEAR_Z.toFixed(1)} - mod(position.z - uTravel * (1.4 + aRandom), ${LENGTH.toFixed(1)});
    p.xy += tunnelOffset(p.z, uTime);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float near = 1.0 - clamp((${NEAR_Z.toFixed(1)} - p.z) / ${LENGTH.toFixed(1)}, 0.0, 1.0);
    gl_PointSize = (1.0 + aRandom * 1.8) * (1.0 + uEnergy * 1.5) * uPixelRatio * (8.0 / -mv.z);
    vAlpha = near * (0.3 + uEnergy);
  }
`;

const streakFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor * 1.5, smoothstep(0.5, 0.0, d) * vAlpha);
    #include <colorspace_fragment>
  }
`;

const portalVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const portalFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uEnergy;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);
    float a = atan(c.y, c.x);
    float swirl = 0.5 + 0.5 * sin(a * 6.0 + d * 30.0 - uTime * 3.0);
    float core = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uColorB, uColorA, core) * (0.6 + uEnergy * 2.5) * (0.7 + swirl * 0.5);
    gl_FragColor = vec4(col, pow(core, 2.2));
    #include <colorspace_fragment>
  }
`;

function createRings(tubeRadius: number, tubularSegments: number): InstancedMesh {
  const geometry = new TorusGeometry(RADIUS, tubeRadius, 6, tubularSegments);
  const material = new MeshBasicMaterial({
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const mesh = new InstancedMesh(geometry, material, RINGS_PER_KIND);
  // Allocate per-instance colours up front so the shader compiles with instancing colour support.
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(RINGS_PER_KIND * 3), 3);
  mesh.frustumCulled = false;
  return mesh;
}

function disposeRings(mesh: InstancedMesh): void {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) material.forEach((m) => m.dispose());
  else material.dispose();
  mesh.dispose();
}

function createStreakGeometry(): BufferGeometry {
  const positions = new Float32Array(STREAK_COUNT * 3);
  const randoms = new Float32Array(STREAK_COUNT);
  for (let i = 0; i < STREAK_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = RADIUS * (0.35 + Math.random() * 0.6);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r;
    positions[i * 3 + 2] = Math.random() * LENGTH;
    randoms[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new BufferAttribute(randoms, 1));
  return geometry;
}

export function TunnelVortex({ engine, colors, speed, autoRotate }: SceneProps) {
  const pixelRatio = useThree((s) => s.viewport.dpr);
  const groupRef = useRef<Group>(null);
  const travel = useRef(0);
  const time = useRef(0);
  const spin = useRef(0);

  // Circular rings interleaved with hexagonal rings (a torus with 6 tubular segments).
  const { circles, hexagons } = useDisposable(() => {
    const ringSet = { circles: createRings(0.028, 96), hexagons: createRings(0.045, 6) };
    return { ...ringSet, dispose: () => Object.values(ringSet).forEach(disposeRings) };
  }, []);

  const streakGeometry = useDisposable(createStreakGeometry, []);
  const portalGeometry = useDisposable(() => new PlaneGeometry(14, 14), []);

  const streakMaterial = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader: streakVertex,
        fragmentShader: streakFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTravel: { value: 0 },
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uPixelRatio: { value: 1 },
          uColor: { value: colors.accent },
        },
      }),
    [colors],
  );

  const portalMaterial = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader: portalVertex,
        fragmentShader: portalFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uColorA: { value: colors.accent },
          uColorB: { value: colors.secondary },
          uEnergy: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [colors],
  );

  // Scratch objects reused every frame (no per-frame allocations → no GC hitches).
  const scratch = useMemo(() => ({ dummy: new Object3D(), color: new Color(), offset: { x: 0, y: 0 } }), []);

  useFrame((_, delta) => {
    const f = engine.features;
    const { dummy, color, offset } = scratch;
    const spectrum = f.spectrum;
    const usable = Math.floor(spectrum.length * 0.6);

    time.current += delta * speed;
    travel.current += delta * speed * (3.5 + f.energy * 14 + f.beat * 6);
    if (autoRotate) spin.current += delta * speed * (0.25 + f.mid * 0.8);
    const t = time.current;

    for (let i = 0; i < RING_COUNT; i++) {
      const mesh = i % 2 === 0 ? circles : hexagons;
      const index = i >> 1;

      const z = NEAR_Z - ((((i * SPACING - travel.current) % LENGTH) + LENGTH) % LENGTH);
      const depth = (NEAR_Z - z) / LENGTH;
      tunnelOffset(z, t, offset);

      // Each ring listens to its own slice of the spectrum (log-ish mapping: near rings = bass).
      const bin = Math.floor(Math.pow(i / RING_COUNT, 2) * usable) + 1;
      const level = spectrum[bin] / 255;

      const scale = 1 + level * 0.5 + f.beat * 0.28 * (1 - depth);
      const direction = i % 2 === 0 ? 1 : -1;
      dummy.position.set(offset.x, offset.y, z);
      dummy.rotation.set(0, 0, spin.current * direction + i * 0.13 + level * 0.6);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      const nearFade = 1 - Math.min(1, Math.max(0, (z - 3.5) / (NEAR_Z - 3.5)));
      const intensity = (0.45 + level * 2.4 + f.beat * 1.4) * (1 - depth * 0.8) * nearFade;
      color.copy(colors.primary).lerp(colors.secondary, Math.min(1, depth * 1.3));
      if (level > 0.75) color.lerp(colors.accent, (level - 0.75) * 3);
      color.multiplyScalar(intensity);
      mesh.setColorAt(index, color);
    }

    for (const mesh of [circles, hexagons]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const su = streakMaterial.uniforms;
    su.uTravel.value = travel.current;
    su.uTime.value = t;
    su.uEnergy.value = f.energy;
    su.uPixelRatio.value = pixelRatio;

    portalMaterial.uniforms.uEnergy.value = f.energy + f.beat * 0.5;
    portalMaterial.uniforms.uTime.value = t;

    if (groupRef.current) groupRef.current.rotation.z = Math.sin(t * 0.2) * 0.15 * (autoRotate ? 1 : 0);
  });

  return (
    <group ref={groupRef}>
      <primitive object={circles} />
      <primitive object={hexagons} />
      <points geometry={streakGeometry} material={streakMaterial} frustumCulled={false} />
      <mesh geometry={portalGeometry} material={portalMaterial} position={[0, 0, NEAR_Z - LENGTH - 2]} />
    </group>
  );
}
