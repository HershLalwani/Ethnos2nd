"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Board } from "./Board";

export function GameScene() {
  return (
    <Canvas
      camera={{ position: [0, 10, 11], fov: 44 }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#141a26"]} />
      <fog attach="fog" args={["#141a26", 28, 55]} />
      <hemisphereLight args={["#e8eef7", "#3a3226", 0.9]} />
      <directionalLight position={[6, 12, 4]} intensity={1.3} color="#fff2dd" />
      <directionalLight position={[-7, 8, -6]} intensity={0.4} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Board />
      </Suspense>
      <OrbitControls
        target={[0, 0, 0.4]}
        enablePan={false}
        minDistance={5}
        maxDistance={24}
        minPolarAngle={0.05}
        maxPolarAngle={1.25}
        minAzimuthAngle={-1.1}
        maxAzimuthAngle={1.1}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
