"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { AccumulativeShadows, RandomizedLight, OrbitControls } from "@react-three/drei";
import { EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";
import { Fragment, Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function CuttingBoard() {
  const ref = useRef();
  return (
    <mesh ref={ref} receiveShadow position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[4, 2.5, 1, 1]} />
      <meshStandardMaterial color="#7c5a3b" roughness={0.9} metalness={0.0} />
    </mesh>
  );
}

function Knife() {
  const group = useRef();
  // Blade
  return (
    <group ref={group} name="knife">
      {/* Blade */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.02, 0.02, 1.0]} />
        <meshStandardMaterial color="#cfd5da" metalness={1} roughness={0.25} />
      </mesh>
      {/* Edge - subtle triangular tip */}
      <mesh castShadow position={[0, -0.005, 0.5]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.02, 0.08, 8]} />
        <meshStandardMaterial color="#cfd5da" metalness={1} roughness={0.25} />
      </mesh>
      {/* Handle */}
      <mesh castShadow position={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 16]} />
        <meshStandardMaterial color="#222" roughness={0.7} />
      </mesh>
    </group>
  );
}

function SimpleHand() {
  const group = useRef();
  const skin = "#e6c7b1";
  return (
    <group ref={group} name="hand" position={[0.1, 0.02, -0.65]} rotation={[0, 0.1, 0]}>
      {/* Palm */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.18, 0.06, 0.14]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
      {/* Thumb */}
      <mesh castShadow position={[0.12, 0.0, -0.04]} rotation={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
      {/* Fingers */}
      {[ -0.06, -0.02, 0.02, 0.06 ].map((z, i) => (
        <mesh key={i} castShadow position={[0.06 + i * 0.02, 0.0, z]}>
          <cylinderGeometry args={[0.018, 0.018, 0.22, 12]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function GlassMaterial({ color = "#c7ffd1", children, thickness = 0.6 }) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.02,
      metalness: 0.0,
      transmission: 1.0,
      ior: 1.5,
      thickness,
      transparent: true,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      attenuationColor: color,
      attenuationDistance: 2.0,
      envMapIntensity: 0.9
    }),
    [color, thickness]
  );
  return <primitive object={mat} attach="material" />;
}

function WatermelonSlices({ onSliceSound }) {
  // Coordinate system: z axis is slicing direction (camera looks towards -z)
  const group = useRef();
  const glassColor = "#bdebbf"; // light green hue for watermelon glass
  const sphere = useMemo(() => new THREE.SphereGeometry(0.45, 64, 64), []);

  // Clipping planes for 3 segments along z
  const sliceThickness = 0.10;
  const slice2Thickness = 0.12;
  const frontPlaneNear = -0.15;
  const slice1Start = 0.1;
  const slice2Start = -0.07;

  // Materials per-piece with local clipping enabled
  const makeClipMat = (planes, clipIntersection = true) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: glassColor,
      roughness: 0.02,
      transmission: 1.0,
      ior: 1.5,
      thickness: 0.6,
      transparent: true,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      attenuationColor: glassColor,
      attenuationDistance: 2.0,
      envMapIntensity: 0.9
    });
    m.clippingPlanes = planes;
    m.clipIntersection = clipIntersection;
    m.side = THREE.DoubleSide;
    return m;
  };

  // Define planes
  const planes = useMemo(() => {
    // Keep region between two planes => use clipIntersection = true
    const P = THREE.Plane;
    return {
      frontThin: [
        new P(new THREE.Vector3(0, 0, 1), -(slice1Start)), // z >= slice1Start
        new P(new THREE.Vector3(0, 0, -1), slice1Start + sliceThickness) // z <= slice1Start + t
      ],
      secondThin: [
        new P(new THREE.Vector3(0, 0, 1), -(slice2Start)), // z >= slice2Start
        new P(new THREE.Vector3(0, 0, -1), slice2Start + slice2Thickness) // z <= slice2Start + t
      ],
      restBack: [
        new P(new THREE.Vector3(0, 0, 1), -(slice2Start + slice2Thickness)) // z >= back of slice 2
      ],
      restMid: [
        new P(new THREE.Vector3(0, 0, 1), -(slice1Start + sliceThickness)), // z >= back of slice 1
        new P(new THREE.Vector3(0, 0, -1), slice2Start) // z <= front of slice 2
      ],
      restFront: [
        new P(new THREE.Vector3(0, 0, -1), frontPlaneNear) // z <= near front plane
      ]
    };
  }, []);

  const mats = useMemo(() => {
    return {
      whole: makeClipMat([], false),
      slice1: makeClipMat(planes.frontThin, true),
      slice2: makeClipMat(planes.secondThin, true),
      bodyBack: makeClipMat(planes.restBack, false),
      bodyMid: makeClipMat(planes.restMid, true),
    };
  }, [planes]);

  // Animation state
  const [phase, setPhase] = useState("intro"); // intro -> slice1 -> between -> slice2 -> settle
  const tRef = useRef(0);
  const slice1Offset = useRef(0);
  const slice2Offset = useRef(0);

  const shardsRef = useRef([]);
  const shardVel = useRef([]);

  const spawnShards = (zCenter = 0.15) => {
    const count = 36;
    shardsRef.current = new Array(count).fill(0).map((_, i) => {
      const geo = new THREE.IcosahedronGeometry(0.02 + Math.random() * 0.015, 0);
      const mat = mats.whole.clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.set(
        (Math.random() - 0.5) * 0.25,
        (Math.random() - 0.5) * 0.12,
        zCenter + (Math.random() - 0.5) * 0.08
      );
      return mesh;
    });
    shardVel.current = shardsRef.current.map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      Math.random() * 1.2 + 0.4,
      (Math.random() - 0.5) * 0.4
    ));
  };

  useFrame((_, delta) => {
    const d = Math.min(delta, 1 / 30); // target ~30 FPS
    tRef.current += d;

    // Timeline
    if (phase === "intro" && tRef.current > 0.8) {
      setPhase("slice1");
      tRef.current = 0;
      onSliceSound?.("slice");
    }
    if (phase === "slice1") {
      // first slice advances: front slice moves forward and drops slightly
      slice1Offset.current = Math.min(1, slice1Offset.current + d * 0.6);
      if (slice1Offset.current > 0.2 && slice1Offset.current < 0.25) {
        onSliceSound?.("crack");
      }
      if (slice1Offset.current > 0.3 && shardsRef.current.length === 0) {
        spawnShards(0.16);
        onSliceSound?.("shards");
      }
      if (slice1Offset.current >= 1) {
        setPhase("between");
        tRef.current = 0;
      }
    }
    if (phase === "between" && tRef.current > 0.5) {
      setPhase("slice2");
      tRef.current = 0;
      onSliceSound?.("slice");
    }
    if (phase === "slice2") {
      slice2Offset.current = Math.min(1, slice2Offset.current + d * 0.7);
      if (slice2Offset.current > 0.2 && slice2Offset.current < 0.25) {
        onSliceSound?.("crack");
      }
      if (slice2Offset.current > 0.3 && shardVel.current.length < 60) {
        spawnShards(0.0);
        onSliceSound?.("shards");
      }
      if (slice2Offset.current >= 1) {
        setPhase("settle");
        tRef.current = 0;
      }
    }

    // Animate shards with gravity
    if (shardsRef.current.length) {
      shardVel.current.forEach((v, i) => {
        v.y -= 3.2 * d;
        const m = shardsRef.current[i];
        m.position.addScaledVector(v, d);
        // collide with board (y = -0.2 approx top)
        if (m.position.y < -0.22) {
          m.position.y = -0.22;
          v.y *= -0.25;
          v.x *= 0.7;
          v.z *= 0.7;
        }
        m.rotation.x += d * (0.5 + Math.random() * 1.5);
        m.rotation.y += d * (0.5 + Math.random() * 1.5);
      });
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* Whole fruit (fades away on first slice) */}
      {phase === "intro" && (
        <mesh castShadow geometry={sphere}>
          <GlassMaterial color={glassColor} thickness={0.7} />
        </mesh>
      )}

      {/* First thin front slice */}
      <group position={[0, 0, slice1Offset.current * 0.6]}>
        <mesh castShadow geometry={sphere} material={mats.slice1} />
      </group>

      {/* Second thin slice */}
      <group position={[0.02 * slice2Offset.current, -0.02 * slice2Offset.current, -0.05 * slice2Offset.current]}>
        <mesh castShadow geometry={sphere} material={mats.slice2} />
      </group>

      {/* Remaining body (mid + back) */}
      <mesh castShadow geometry={sphere} material={mats.bodyMid} />
      <mesh castShadow geometry={sphere} material={mats.bodyBack} />

      {/* Shards */}
      <group>
        {shardsRef.current.map((m, idx) => (
          <primitive key={idx} object={m} />
        ))}
      </group>
    </group>
  );
}

function RigAndLights() {
  return (
    <group>
      {/* Key and rim lights */}
      <spotLight position={[2.5, 2.6, 1.8]} angle={0.45} penumbra={0.6} intensity={2.2} castShadow />
      <spotLight position={[-2.2, 2.8, 1.6]} angle={0.5} penumbra={0.7} intensity={1.9} />
      <hemisphereLight args={["#ffffff", "#1a1a1a", 0.4]} />
    </group>
  );
}

function CameraDof() {
  return (
    <EffectComposer multisampling={0}>
      <DepthOfField
        focusDistance={0.015}
        focalLength={0.02}
        bokehScale={2.4}
        height={480}
      />
      <Bloom intensity={0.25} luminanceThreshold={0.6} luminanceSmoothing={0.2} />
    </EffectComposer>
  );
}

function AnimatedKnifeAndHand({ onSliceSound }) {
  const knife = useRef();
  const hand = useRef();
  const tRef = useRef(0);
  const phaseRef = useRef("intro");

  useFrame((_, delta) => {
    const d = Math.min(delta, 1 / 30);
    tRef.current += d;
    // Knife motion timeline synced loosely with slices
    if (tRef.current < 0.8) {
      // hover
    } else if (tRef.current < 1.4) {
      // first slice downwards and forward
      const k = (tRef.current - 0.8) / 0.6;
      knife.current.position.set(0.0, 0.25 - 0.28 * k, 0.5 - 0.5 * k);
      knife.current.rotation.set(0.1, 0, 0.0 + 0.2 * k);
    } else if (tRef.current < 2.0) {
      // reset slightly
      const k = (tRef.current - 1.4) / 0.6;
      knife.current.position.set(0.0, 0.0 + 0.1 * k, 0.0 + 0.2 * k);
      knife.current.rotation.set(0.2 - 0.1 * k, 0, 0.2 - 0.1 * k);
    } else if (tRef.current < 2.6) {
      // second slice
      const k = (tRef.current - 2.0) / 0.6;
      knife.current.position.set(0.02, 0.15 - 0.26 * k, 0.15 - 0.35 * k);
      knife.current.rotation.set(0.1, 0, 0.1 + 0.15 * k);
    } else {
      // settle
      knife.current.position.lerp(new THREE.Vector3(-0.1, 0.05, -0.2), 0.04);
      knife.current.rotation.x = 0.05;
    }

    // Hand follows handle
    if (hand.current && knife.current) {
      hand.current.position.lerp(
        new THREE.Vector3(knife.current.position.x + 0.12, 0.02, knife.current.position.z - 0.6),
        0.12
      );
    }
  });

  return (
    <group>
      <group ref={knife} position={[0, 0.25, 0.55]}>
        <Knife />
      </group>
      <group ref={hand}>
        <SimpleHand />
      </group>
    </group>
  );
}

export default function GlassWatermelonScene({ width = 1280, height = 720, dpr = 1.5, onSliceSound }) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, localClippingEnabled: true }}
      dpr={dpr}
      camera={{ fov: 35, position: [0.0, 0.25, 1.6] }}
      style={{ width, height, display: "block", background: "radial-gradient(ellipse at center, #0d0f12 0%, #090a0c 100%)" }}
    >
      <Suspense fallback={null}>
        <RigAndLights />
        <group position={[0, -0.0, 0]}>
          <CuttingBoard />
          <WatermelonSlices onSliceSound={onSliceSound} />
          <AnimatedKnifeAndHand onSliceSound={onSliceSound} />
        </group>
        <AccumulativeShadows temporal frames={40} alphaTest={0.8} scale={6} position={[0, -0.25, 0]}>
          <RandomizedLight amount={8} radius={2} intensity={0.5} ambient={0.2} position={[1, 2.5, 1.5]} />
        </AccumulativeShadows>
        <CameraDof />
        {/* Controls disabled by default to keep cinematic framing, enable if needed */}
        {/* <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} /> */}
      </Suspense>
    </Canvas>
  );
}

