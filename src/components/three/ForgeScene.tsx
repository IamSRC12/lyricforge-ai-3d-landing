"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

const BEAT_BPM = 96;
const BEAT = 60 / BEAT_BPM;

/* ---------------------------------------------------------------- *
 * Simulated audio analyser — a deterministic stand-in for the real
 * Float32Array the editor feeds the renderer.
 * ---------------------------------------------------------------- */
function beatEnvelope(t: number, offset = 0): number {
  const phase = ((t + offset) % BEAT) / BEAT;
  const attack = Math.pow(1 - phase, 3.2);
  const swing = 0.5 + 0.5 * Math.sin((t + offset) * 1.7);
  return attack * (0.65 + 0.35 * swing);
}

/* ---------------------------------------------------------------- *
 * 1000+ particle field with additive glow sprites
 * ---------------------------------------------------------------- */
function ParticleField({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const sprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(190,190,255,0.55)");
      gradient.addColorStop(1, "rgba(120,120,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color("#7c3aed"), new THREE.Color("#3b82f6"), new THREE.Color("#06b6d4")];

    for (let i = 0; i < count; i += 1) {
      const radius = 3 + Math.pow(Math.random(), 0.6) * 12;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 11;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius - 2;

      const color = palette[i % palette.length].clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.25);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.085,
        map: sprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [sprite],
  );

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    points.rotation.y += delta * 0.035;
    const t = state.clock.elapsedTime;
    points.position.y = Math.sin(t * 0.35) * 0.35;
    material.size = 0.075 + beatEnvelope(t) * 0.05;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/* ---------------------------------------------------------------- *
 * 3D audio waveform — instanced bar ring reacting to the beat
 * ---------------------------------------------------------------- */
function AudioWave3D({ bars = 84 }: { bars?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorAttr = useMemo(() => {
    const array = new Float32Array(bars * 3);
    const from = new THREE.Color("#7c3aed");
    const mid = new THREE.Color("#3b82f6");
    const to = new THREE.Color("#06b6d4");
    for (let i = 0; i < bars; i += 1) {
      const k = i / (bars - 1);
      const color = k < 0.5 ? from.clone().lerp(mid, k * 2) : mid.clone().lerp(to, (k - 0.5) * 2);
      array[i * 3] = color.r;
      array[i * 3 + 1] = color.g;
      array[i * 3 + 2] = color.b;
    }
    return new THREE.InstancedBufferAttribute(array, 3);
  }, [bars]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const radius = 4.4;

    for (let i = 0; i < bars; i += 1) {
      const angle = (i / bars) * Math.PI * 2;
      const wave =
        0.5 +
        0.5 * Math.sin(t * 1.9 + i * 0.32) * Math.cos(t * 0.7 + i * 0.12) +
        0.35 * Math.sin(t * 3.4 + i * 0.9);
      const height = 0.28 + Math.abs(wave) * 1.35 + beatEnvelope(t, i * 0.004) * 1.5;

      dummy.position.set(Math.cos(angle) * radius, height / 2 - 2.1, Math.sin(angle) * radius - 2);
      dummy.scale.set(1, height, 1);
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.rotation.y = t * 0.08;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bars]} frustumCulled={false}>
      <boxGeometry args={[0.14, 1, 0.14]}>
        <primitive object={colorAttr} attach="attributes-color" />
      </boxGeometry>
      <meshStandardMaterial
        vertexColors
        emissive="#3b1e6e"
        emissiveIntensity={1.15}
        metalness={0.6}
        roughness={0.18}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ---------------------------------------------------------------- *
 * Floating lyric slabs — canvas-textured planes (no font fetch)
 * ---------------------------------------------------------------- */
const LYRIC_WORDS: Array<{ text: string; position: [number, number, number]; scale: number }> = [
  { text: "word-perfect", position: [-4.6, 2.2, -1.2], scale: 1 },
  { text: "60 FPS", position: [4.5, 1.5, -0.6], scale: 0.85 },
  { text: "karaoke fill", position: [-3.9, -1.9, 0.9], scale: 0.9 },
  { text: "mi corazón", position: [4.1, -2.2, 0.4], scale: 0.85 },
  { text: "WebCodecs", position: [-1.4, 3.3, -2.6], scale: 0.78 },
  { text: "no desync", position: [1.9, -3.1, -1.8], scale: 0.8 },
];

function LyricSlab({
  text,
  position,
  scale,
  index,
}: {
  text: string;
  position: [number, number, number];
  scale: number;
  index: number;
}) {
  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(120, 0, 900, 0);
      gradient.addColorStop(0, "#c4b5fd");
      gradient.addColorStop(0.5, "#7dd3fc");
      gradient.addColorStop(1, "#06b6d4");
      ctx.font = "700 116px Inter, 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(124,58,237,0.85)";
      ctx.shadowBlur = 34;
      ctx.fillStyle = gradient;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, [text]);

  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    material.opacity = 0.55 + 0.4 * Math.abs(Math.sin(t * 0.5 + index));
    mesh.rotation.y = Math.sin(t * 0.25 + index) * 0.22;
  });

  return (
    <Float speed={1.1 + index * 0.12} rotationIntensity={0.18} floatIntensity={0.85}>
      <mesh ref={meshRef} position={position} scale={scale} material={material}>
        <planeGeometry args={[3.4, 0.85]} />
      </mesh>
    </Float>
  );
}

/* ---------------------------------------------------------------- *
 * Energy rings + timeline grid floor
 * ---------------------------------------------------------------- */
function EnergyRings() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.z += delta * 0.06;
    const pulse = 1 + beatEnvelope(state.clock.elapsedTime) * 0.06;
    group.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef} position={[0, -0.4, -3]}>
      <mesh rotation={[Math.PI / 2.1, 0, 0]}>
        <torusGeometry args={[5.6, 0.012, 8, 160]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, 0.5, 0.4]}>
        <torusGeometry args={[6.6, 0.008, 8, 160]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 1.9, -0.3, 0.9]}>
        <torusGeometry args={[7.6, 0.006, 8, 160]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CoreOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    mesh.rotation.y += delta * 0.25;
    mesh.rotation.x = Math.sin(t * 0.3) * 0.2;
    mesh.scale.setScalar(1 + beatEnvelope(t) * 0.12);
  });

  return (
    <mesh ref={meshRef} position={[0, -0.2, -2]}>
      <icosahedronGeometry args={[1.35, 1]} />
      <meshStandardMaterial
        color="#120c26"
        emissive="#5b21b6"
        emissiveIntensity={0.65}
        wireframe
        toneMapped={false}
      />
    </mesh>
  );
}

/* ---------------------------------------------------------------- *
 * Lights + camera rig
 * ---------------------------------------------------------------- */
function CyclingLights() {
  const purple = useRef<THREE.PointLight>(null);
  const cyan = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (purple.current) {
      purple.current.position.set(Math.sin(t * 0.4) * 6, 3.4, Math.cos(t * 0.4) * 6 - 2);
      purple.current.intensity = 42 + beatEnvelope(t) * 55;
    }
    if (cyan.current) {
      cyan.current.position.set(Math.cos(t * 0.32) * -6.5, -2.6, Math.sin(t * 0.32) * 6 - 2);
      cyan.current.intensity = 30 + beatEnvelope(t, BEAT / 2) * 45;
    }
  });

  return (
    <>
      <ambientLight intensity={0.42} color="#8b8bd8" />
      <pointLight ref={purple} color="#7c3aed" distance={26} decay={1.6} />
      <pointLight ref={cyan} color="#06b6d4" distance={26} decay={1.6} />
      <directionalLight position={[0, 8, 6]} intensity={0.55} color="#c4b5fd" />
    </>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0, -2), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const orbitX = Math.sin(t * 0.09) * 1.9 + state.pointer.x * 1.1;
    const orbitY = 0.9 + Math.sin(t * 0.13) * 0.5 + state.pointer.y * 0.6;
    camera.position.x += (orbitX - camera.position.x) * Math.min(1, delta * 1.6);
    camera.position.y += (orbitY - camera.position.y) * Math.min(1, delta * 1.6);
    camera.position.z = 9.2 + Math.cos(t * 0.09) * 0.7;
    camera.lookAt(target);
  });

  return null;
}

export type ForgeSceneProps = {
  quality?: "high" | "low";
};

export default function ForgeScene({ quality = "high" }: ForgeSceneProps) {
  const particleCount = quality === "high" ? 1400 : 420;
  const bars = quality === "high" ? 84 : 44;

  return (
    <Canvas
      dpr={[1, quality === "high" ? 1.85 : 1.25]}
      gl={{ antialias: quality === "high", alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1, 9.2], fov: 46, near: 0.1, far: 80 }}
      style={{ pointerEvents: "none" }}
    >
      <color attach="background" args={["#07070c"]} />
      <fog attach="fog" args={["#07070c", 12, 30]} />
      <Suspense fallback={null}>
        <CyclingLights />
        <CameraRig />
        <ParticleField count={particleCount} />
        <AudioWave3D bars={bars} />
        <EnergyRings />
        <CoreOrb />
        {LYRIC_WORDS.map((word, index) => (
          <LyricSlab key={word.text} {...word} index={index} />
        ))}
        {quality === "high" ? (
          <Sparkles count={90} scale={[16, 9, 12]} size={2.6} speed={0.32} color="#a78bfa" opacity={0.55} />
        ) : null}
      </Suspense>
    </Canvas>
  );
}
