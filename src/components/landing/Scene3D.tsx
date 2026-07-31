import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

const WAVE_BAR_COUNT = 80;
const PARTICLE_COUNT = 1_400;

type LyricItem = {
  text: string;
  position: [number, number, number];
  color: string;
  size: number;
  speed: number;
};

const lyricItems: LyricItem[] = [
  {
    text: "FEEL THE RHYTHM",
    position: [-5.2, 2.1, -3.5],
    color: "#8b5cf6",
    size: 0.48,
    speed: 0.55,
  },
  {
    text: "WORD PERFECT",
    position: [4.8, 1.5, -4.4],
    color: "#22d3ee",
    size: 0.42,
    speed: 0.68,
  },
  {
    text: "CREATE",
    position: [-4.5, -1.8, -4.8],
    color: "#3b82f6",
    size: 0.58,
    speed: 0.48,
  },
  {
    text: "SYNCHRONIZE",
    position: [4.1, -2.2, -5.4],
    color: "#a855f7",
    size: 0.37,
    speed: 0.72,
  },
  {
    text: "60 FPS",
    position: [0.2, 3.6, -6.2],
    color: "#06b6d4",
    size: 0.35,
    speed: 0.62,
  },
];

function ParticleField(): React.JSX.Element {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    const purple = new THREE.Color("#7c3aed");
    const blue = new THREE.Color("#3b82f6");
    const cyan = new THREE.Color("#06b6d4");

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const radius = 5 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[index * 3] =
        radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] =
        radius * Math.sin(phi) * Math.sin(theta);
      positions[index * 3 + 2] =
        radius * Math.cos(phi);

      const color = purple
        .clone()
        .lerp(blue, Math.random())
        .lerp(cyan, Math.random() * 0.45);

      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    const bufferGeometry = new THREE.BufferGeometry();

    bufferGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );

    bufferGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );

    return bufferGeometry;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current;

    if (!points) {
      return;
    }

    points.rotation.y += delta * 0.012;
    points.rotation.x =
      Math.sin(clock.elapsedTime * 0.08) * 0.08;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.85}
        vertexColors
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function AudioWave3D(): React.JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const helper = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    for (let index = 0; index < WAVE_BAR_COUNT; index += 1) {
      const normalizedIndex = index / (WAVE_BAR_COUNT - 1);
      color.setHSL(0.76 - normalizedIndex * 0.28, 0.9, 0.62);
      mesh.setColorAt(index, color);
    }

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [color]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const group = groupRef.current;

    if (!mesh || !group) {
      return;
    }

    const time = clock.elapsedTime;

    for (let index = 0; index < WAVE_BAR_COUNT; index += 1) {
      const centerDistance =
        Math.abs(index - WAVE_BAR_COUNT / 2) /
        (WAVE_BAR_COUNT / 2);

      const envelope = 1 - centerDistance * 0.66;

      const primary =
        Math.sin(index * 0.43 + time * 3.4) * 0.5 + 0.5;

      const secondary =
        Math.sin(index * 0.17 - time * 5.1) * 0.5 + 0.5;

      const beat =
        Math.pow(Math.max(0, Math.sin(time * 2.35)), 8) * 1.4;

      const height =
        0.18 +
        envelope *
          (0.55 + primary * 1.25 + secondary * 0.55 + beat);

      const angle =
        (index / WAVE_BAR_COUNT) * Math.PI * 2;

      const radius = 2.65;

      helper.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 2 + time * 0.3) * 0.12,
        Math.sin(angle) * radius,
      );

      helper.rotation.set(0, -angle, 0);
      helper.scale.set(0.7, height, 0.7);
      helper.updateMatrix();

      mesh.setMatrixAt(index, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    group.rotation.y = time * 0.13;
    group.rotation.z = Math.sin(time * 0.22) * 0.08;
  });

  return (
    <group
      ref={groupRef}
      position={[0, -0.2, -2.2]}
      rotation={[0.35, 0, 0]}
    >
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, WAVE_BAR_COUNT]}
      >
        <boxGeometry args={[0.055, 0.7, 0.055]} />

        <meshStandardMaterial
          vertexColors
          emissive="#6d28d9"
          emissiveIntensity={2.1}
          roughness={0.26}
          metalness={0.35}
          transparent
          opacity={0.92}
        />
      </instancedMesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.65, 0.015, 12, 160]} />

        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

function FloatingLyrics(): React.JSX.Element {
  const textRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(({ clock }) => {
    textRefs.current.forEach((textMesh, index) => {
      if (!textMesh) {
        return;
      }

      const item = lyricItems[index];
      const time = clock.elapsedTime * item.speed;

      textMesh.position.y =
        item.position[1] + Math.sin(time + index) * 0.18;

      textMesh.rotation.y =
        Math.sin(time * 0.7 + index) * 0.12;

      textMesh.rotation.z =
        Math.sin(time * 0.4 + index * 1.4) * 0.035;
    });
  });

  return (
    <>
      {lyricItems.map((item, index) => (
        <Float
          key={item.text}
          speed={1 + index * 0.08}
          rotationIntensity={0.1}
          floatIntensity={0.2}
        >
          <Text
            ref={(node) => {
              textRefs.current[index] = node;
            }}
            position={item.position}
            fontSize={item.size}
            color={item.color}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.09}
            fillOpacity={0.82}
          >
            {item.text}

            <meshStandardMaterial
              color={item.color}
              emissive={item.color}
              emissiveIntensity={1.4}
              transparent
              opacity={0.78}
              toneMapped={false}
            />
          </Text>
        </Float>
      ))}
    </>
  );
}

function AnimatedLights(): React.JSX.Element {
  const primaryLight = useRef<THREE.PointLight>(null);
  const secondaryLight = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const first = primaryLight.current;
    const second = secondaryLight.current;

    if (first) {
      first.position.x = Math.sin(time * 0.35) * 5;
      first.position.z = 2 + Math.cos(time * 0.35) * 4;
      first.color.setHSL((time * 0.025 + 0.72) % 1, 0.9, 0.62);
    }

    if (second) {
      second.position.x = Math.cos(time * 0.28) * 6;
      second.position.y = Math.sin(time * 0.31) * 3;
      second.color.setHSL((time * 0.02 + 0.52) % 1, 0.9, 0.58);
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />

      <pointLight
        ref={primaryLight}
        position={[4, 3, 4]}
        intensity={34}
        distance={18}
        decay={2}
        color="#7c3aed"
      />

      <pointLight
        ref={secondaryLight}
        position={[-5, -2, 3]}
        intensity={28}
        distance={17}
        decay={2}
        color="#06b6d4"
      />
    </>
  );
}

function CameraRig(): null {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const time = clock.elapsedTime * 0.075;

    camera.position.x = Math.sin(time) * 1.15;
    camera.position.y = 0.4 + Math.sin(time * 0.7) * 0.3;
    camera.position.z = 8.7 + Math.cos(time) * 0.45;
    camera.lookAt(0, 0, -1.7);
  });

  return null;
}

function SceneContent(): React.JSX.Element {
  return (
    <>
      <color attach="background" args={["#07070d"]} />
      <fog attach="fog" args={["#07070d", 8, 24]} />

      <CameraRig />
      <AnimatedLights />
      <ParticleField />
      <AudioWave3D />
      <FloatingLyrics />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.8}
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.12}
          darkness={0.88}
        />
      </EffectComposer>
    </>
  );
}

export default function Scene3D(): React.JSX.Element {
  return (
    <div className="scene-container" aria-hidden="true">
      <Canvas
        dpr={[1, 1.7]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        camera={{
          position: [0, 0.4, 8.8],
          fov: 48,
          near: 0.1,
          far: 60,
        }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
