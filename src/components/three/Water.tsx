"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = uv;
    vec3 p = position;
    float w1 = sin(p.x * 0.55 + uTime * 1.1) * 0.09;
    float w2 = cos(p.y * 0.45 + uTime * 0.8) * 0.09;
    float w3 = sin((p.x + p.y) * 0.25 + uTime * 0.55) * 0.06;
    p.z += w1 + w2 + w3;
    vWave = w1 + w2 + w3;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c) * 2.0; // 0 center -> 1 edge
    vec3 deep = vec3(0.05, 0.20, 0.36);
    vec3 shallow = vec3(0.15, 0.52, 0.62);
    vec3 col = mix(shallow, deep, smoothstep(0.12, 0.75, dist));
    // subtle glints
    float glint = smoothstep(0.17, 0.24, vWave) * 0.18;
    col += vec3(glint);
    // foam ring around the island shore
    float shore = smoothstep(0.155, 0.145, dist) * smoothstep(0.118, 0.135, dist);
    col = mix(col, vec3(0.9, 0.96, 0.97), shore * (0.55 + 0.45 * sin(uTime * 1.4 + dist * 90.0)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Water() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value += delta;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[110, 110, 96, 96]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} />
    </mesh>
  );
}
