"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PLAYER_COLORS, REGION_INFO } from "@/game/constants";
import { koiSymbols } from "@/game/engine";
import { REGION_COLORS, type GameState, type RegionColor } from "@/game/types";
import { useGame } from "@/store/gameStore";
import { labelTexture, prestigeTexture } from "./textures";

export const REGION_RADIUS = 4.3;
export const ISLAND_TOP = 0.95;

export function regionAngle(index: number): number {
  return (index / 6) * Math.PI * 2 + Math.PI / 6;
}

export function regionCenter(index: number): [number, number, number] {
  const a = regionAngle(index);
  return [Math.cos(a) * REGION_RADIUS, ISLAND_TOP, Math.sin(a) * REGION_RADIUS];
}

function Sprite({
  tex,
  aspect,
  height,
  position,
  opacity = 1,
}: {
  tex: THREE.Texture;
  aspect: number;
  height: number;
  position: [number, number, number];
  opacity?: number;
}) {
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
    </sprite>
  );
}

/** Floating prestige tokens above a region — "the prestige floats on the island". */
function FloatingPrestige({
  game,
  color,
  index,
}: {
  game: GameState;
  color: RegionColor;
  index: number;
}) {
  const group = useRef<THREE.Group>(null);
  const region = game.regions[color];
  const { tex, aspect } = useMemo(
    () =>
      prestigeTexture(
        REGION_INFO[color].name.replace(" Region", ""),
        REGION_INFO[color].hex,
        region.prestigeTokens,
        game.age - 1,
        region.coins.reduce((a, b) => a + b, 0)
      ),
    [color, region.prestigeTokens, game.age, region.coins]
  );
  const [x, , z] = regionCenter(index);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.position.y = 3.0 + Math.sin(clock.elapsedTime * 0.9 + index * 1.3) * 0.13;
    }
  });
  const height = 1.9;
  return (
    <group ref={group} position={[x, 3.0, z]}>
      <sprite scale={[height * aspect, height, 1]}>
        <spriteMaterial map={tex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/** Control markers on a region plateau, clustered per player. */
function RegionMarkers({ game, color, index }: { game: GameState; color: RegionColor; index: number }) {
  const [cx, , cz] = regionCenter(index);
  const markers: { pos: [number, number, number]; hex: string; key: string }[] = [];
  game.regions[color].markers.forEach((count, p) => {
    const clusterAngle = (p / 6) * Math.PI * 2;
    const clusterX = cx + Math.cos(clusterAngle) * 0.95;
    const clusterZ = cz + Math.sin(clusterAngle) * 0.95;
    for (let i = 0; i < count; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      markers.push({
        key: `${color}-${p}-${i}`,
        hex: PLAYER_COLORS[p].hex,
        pos: [
          clusterX + (col - 1) * 0.24,
          ISLAND_TOP + 0.78 + row * 0.0001,
          clusterZ + row * 0.26 - 0.13,
        ],
      });
    }
  });
  return (
    <>
      {markers.map((m) => (
        <mesh key={m.key} position={m.pos}>
          <coneGeometry args={[0.13, 0.4, 8]} />
          <meshStandardMaterial color={m.hex} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

function Trees({ index }: { index: number }) {
  // Deterministic decorative trees per region.
  const trees = useMemo(() => {
    const [cx, , cz] = regionCenter(index);
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const a = index * 2.1 + i * 2.4;
      out.push({
        x: cx + Math.cos(a) * (1.35 + (i % 2) * 0.25),
        z: cz + Math.sin(a) * (1.35 + ((i + 1) % 2) * 0.25),
        s: 0.75 + ((index + i) % 3) * 0.14,
      });
    }
    return out;
  }, [index]);
  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, ISLAND_TOP + 0.56, t.z]} scale={t.s}>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.35, 6]} />
            <meshStandardMaterial color="#6d4c33" />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <coneGeometry args={[0.34, 0.85, 7]} />
            <meshStandardMaterial color="#2f6b3f" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Region({ game, color, index }: { game: GameState; color: RegionColor; index: number }) {
  const [hovered, setHovered] = useState(false);
  const wizard = useGame((s) => s.wizard);
  const updateWizard = useGame((s) => s.updateWizard);
  const [x, , z] = regionCenter(index);
  const info = REGION_INFO[color];

  const wantsRegionPick =
    !!wizard &&
    ((wizard.needsDeer && !wizard.deerRegion) ||
      wizard.koiBonusRegions.length < wizard.koiCrossings);

  const onClick = () => {
    if (!wizard) return;
    if (wizard.needsDeer && !wizard.deerRegion) {
      updateWizard({ deerRegion: color });
    } else if (wizard.koiBonusRegions.length < wizard.koiCrossings) {
      updateWizard({ koiBonusRegions: [...wizard.koiBonusRegions, color] });
    }
  };

  return (
    <group>
      <mesh
        position={[x, ISLAND_TOP + 0.28, z]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (wantsRegionPick) document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
        onClick={onClick}
      >
        <cylinderGeometry args={[1.95, 2.25, 0.6, 6]} />
        <meshStandardMaterial
          color={info.terrainHex}
          roughness={0.85}
          emissive={hovered && wantsRegionPick ? "#ffffff" : info.hex}
          emissiveIntensity={hovered && wantsRegionPick ? 0.35 : hovered ? 0.12 : 0.05}
        />
      </mesh>
      <Trees index={index} />
      <RegionMarkers game={game} color={color} index={index} />
      <FloatingPrestige game={game} color={color} index={index} />
    </group>
  );
}

/** Centre hill with the Age banner and the three Dragon omens. */
function Centerpiece({ game }: { game: GameState }) {
  const age = useMemo(
    () => labelTexture(`AGE ${["Ⅰ", "Ⅱ", "Ⅲ"][game.age - 1]}`, { size: 54, color: "#ffe9b0", bg: "#3b2f22" }),
    [game.age]
  );
  const dragon = useMemo(() => labelTexture("🐉", { size: 72 }), []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.12;
  });
  return (
    <group>
      <mesh position={[0, ISLAND_TOP + 0.85, 0]}>
        <coneGeometry args={[2.1, 2.4, 7]} />
        <meshStandardMaterial color="#8a7a5e" roughness={0.9} />
      </mesh>
      <mesh position={[0, ISLAND_TOP + 2.0, 0]}>
        <coneGeometry args={[0.9, 1.1, 6]} />
        <meshStandardMaterial color="#a4937200" transparent opacity={0} />
      </mesh>
      <group ref={group}>
        <Sprite tex={age.tex} aspect={age.aspect} height={1.05} position={[0, 5.6, 0]} />
        {[0, 1, 2].map((i) => (
          <Sprite
            key={i}
            tex={dragon.tex}
            aspect={dragon.aspect}
            height={0.9}
            position={[(i - 1) * 1.05, 4.7, 0]}
            opacity={i < game.dragonsRevealed ? 1 : 0.16}
          />
        ))}
      </group>
    </group>
  );
}

/** Unclaimed Fox tokens hover near the centre hill. */
function FoxTokens({ game }: { game: GameState }) {
  if (!game.config.clans.includes("fox")) return null;
  return (
    <>
      {game.foxAvailable.map((v, i) => {
        const { tex, aspect } = labelTexture(`🦊${v}`, { size: 40, color: "#fff", bg: "#7a4a1f" });
        // A row along the front-right beach.
        const a = 0.62 + i * 0.14;
        return (
          <Sprite
            key={v}
            tex={tex}
            aspect={aspect}
            height={0.5}
            position={[Math.cos(a) * 7.1, 1.5, Math.sin(a) * 7.1]}
          />
        );
      })}
    </>
  );
}

/** The Koi board rendered as lily pads arcing across the water. */
function KoiTrack({ game }: { game: GameState }) {
  if (!game.koiInPlay) return null;
  const symbols = koiSymbols(game);
  const start = 2.05; // front-left arc, visible from the player's seat
  const end = 3.05;
  const radius = 8.5;
  const posFor = (i: number): [number, number] => {
    const a = start + (i / 12) * (end - start);
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  };
  const koiLabel = labelTexture("🐟", { size: 40 });
  return (
    <group>
      {Array.from({ length: 13 }, (_, i) => {
        const [x, z] = posFor(i);
        const isSymbol = symbols.includes(i);
        return (
          <group key={i}>
            <mesh position={[x, 0.12, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[isSymbol ? 0.42 : 0.32, 20]} />
              <meshStandardMaterial color={isSymbol ? "#3c8c50" : "#2e6e42"} />
            </mesh>
            {isSymbol && (
              <Sprite tex={koiLabel.tex} aspect={koiLabel.aspect} height={0.45} position={[x, 0.55, z]} />
            )}
          </group>
        );
      })}
      {game.players.map((p, idx) => {
        const [x, z] = posFor(p.koiPos);
        return (
          <mesh key={idx} position={[x, 0.32 + idx * 0.18, z]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color={PLAYER_COLORS[idx].hex} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Island() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <group>
      {/* island base + beach */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[7.4, 8.1, 1.1, 24]} />
        <meshStandardMaterial color="#d9c08c" roughness={1} />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[6.6, 7.3, 0.35, 24]} />
        <meshStandardMaterial color="#8fae6b" roughness={1} />
      </mesh>
      {REGION_COLORS.map((color, i) => (
        <Region key={color} game={game} color={color} index={i} />
      ))}
      <Centerpiece game={game} />
      <FoxTokens game={game} />
      <KoiTrack game={game} />
    </group>
  );
}
