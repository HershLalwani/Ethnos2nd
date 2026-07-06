"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Island } from "./Island";
import { Water } from "./Water";

export function GameScene() {
  return (
    <Canvas
      camera={{ position: [0, 11.5, 20], fov: 44 }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#9fc3d8"]} />
      <fog attach="fog" args={["#9fc3d8", 34, 85]} />
      <hemisphereLight args={["#dcecf5", "#3d5a63", 0.85]} />
      <directionalLight position={[8, 14, 6]} intensity={1.5} color="#fff4dd" />
      <directionalLight position={[-6, 8, -8]} intensity={0.35} color="#bcd6ff" />
      <Water />
      <Island />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        minDistance={10}
        maxDistance={30}
        minPolarAngle={0.55}
        maxPolarAngle={1.32}
        minAzimuthAngle={-1.05}
        maxAzimuthAngle={1.05}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
