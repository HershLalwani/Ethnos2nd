"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Board } from "./Board";

export function GameScene() {
  return (
    <Canvas
      camera={{ position: [0, 14, 16], fov: 44 }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#141a26"]} />
      <fog attach="fog" args={["#141a26", 46, 95]} />
      <hemisphereLight args={["#e8eef7", "#3a3226", 0.9]} />
      <directionalLight position={[6, 12, 4]} intensity={1.3} color="#fff2dd" />
      <directionalLight position={[-7, 8, -6]} intensity={0.4} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Board />
      </Suspense>
      {/* Free camera: full orbit + pan so you can view any player's side. Polar
          is capped just short of horizontal so you never drop under the table. */}
      <OrbitControls
        target={[0, 0, 0]}
        enablePan
        minDistance={4}
        maxDistance={46}
        minPolarAngle={0.08}
        maxPolarAngle={1.47}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
