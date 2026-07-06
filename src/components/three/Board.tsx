"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PLAYER_COLORS, REGION_INFO } from "@/game/constants";
import { koiSymbols } from "@/game/engine";
import { REGION_COLORS, type GameState, type RegionColor } from "@/game/types";
import { useGame } from "@/store/gameStore";
import { BOARD_H, BOARD_W, REGION_MAP, trackUV, uvToWorld } from "./boardMap";
import { labelTexture } from "./textures";

const BOARD_Y = 0.02; // board sheet sits just above the table top (y = 0)

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

/** The wooden table with the board photo lying on it. */
function TableAndBoard() {
  const tex = useLoader(THREE.TextureLoader, "/Ethnos.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return (
    <group>
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[BOARD_W + 8.5, 0.9, BOARD_H + 5]} />
        <meshStandardMaterial color="#5d4230" roughness={0.85} />
      </mesh>
      {/* toneMapped=false keeps the photo's original colors */}
      <mesh position={[0, BOARD_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_W, BOARD_H]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Control markers for one region, clustered per player inside its marker area. */
function RegionMarkers({ game, color }: { game: GameState; color: RegionColor }) {
  const a = REGION_MAP[color];
  const [mx, mz] = uvToWorld(a.markers[0], a.markers[1]);
  const rx = a.markerR[0] * BOARD_W;
  const rz = a.markerR[1] * BOARD_H;
  const markers: { pos: [number, number, number]; hex: string; key: string }[] = [];
  game.regions[color].markers.forEach((count, p) => {
    const clusterAngle = (p / 6) * Math.PI * 2 - Math.PI / 2;
    const cx = mx + Math.cos(clusterAngle) * rx * 0.62;
    const cz = mz + Math.sin(clusterAngle) * rz * 0.62;
    for (let i = 0; i < count; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      markers.push({
        key: `${color}-${p}-${i}`,
        hex: PLAYER_COLORS[p].hex,
        pos: [cx + (col - 1) * 0.21, BOARD_Y + 0.15, cz + row * 0.22 - 0.11],
      });
    }
  });
  return (
    <>
      {markers.map((m) => (
        <mesh key={m.key} position={m.pos}>
          <coneGeometry args={[0.095, 0.3, 8]} />
          <meshStandardMaterial color={m.hex} roughness={0.35} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Prestige tokens sitting on the region's printed Ⅰ/Ⅱ/Ⅲ slots. Tokens of
 * already-scored Ages are gone (like the physical game); the current Age's
 * token is gold and shows any Raccoon coins added to it.
 */
function RegionPrestigeTokens({ game, color }: { game: GameState; color: RegionColor }) {
  const region = game.regions[color];
  const ageIdx = game.age - 1;
  const coinSum = region.coins.reduce((s, c) => s + c, 0);
  return (
    <>
      {region.prestigeTokens.map((value, i) => {
        if (i < ageIdx) return null; // scored and removed
        const active = i === ageIdx;
        const [x, z] = uvToWorld(...REGION_MAP[color].box[i]);
        const text = active && coinSum > 0 ? `${value}+${coinSum}` : String(value);
        const label = labelTexture(text, {
          size: 46,
          color: "#2b2416",
          bg: active ? "#f6c945" : "#ece4cd",
        });
        return (
          <group key={`${color}-${i}`} position={[x, 0, z]}>
            <mesh position={[0, BOARD_Y + 0.035, 0]}>
              <cylinderGeometry args={[0.31, 0.31, 0.07, 6]} />
              <meshStandardMaterial color={active ? "#f6c945" : "#ece4cd"} roughness={0.5} />
            </mesh>
            <Sprite
              tex={label.tex}
              aspect={label.aspect}
              height={0.44}
              position={[0, BOARD_Y + 0.42, 0]}
              opacity={active ? 1 : 0.85}
            />
          </group>
        );
      })}
    </>
  );
}

/** Click hotspot shown while the play wizard needs a region pick (Deer / Koi). */
function RegionHotspot({ color }: { color: RegionColor }) {
  const [hovered, setHovered] = useState(false);
  const wizard = useGame((s) => s.wizard);
  const updateWizard = useGame((s) => s.updateWizard);
  const ring = useRef<THREE.Mesh>(null);
  const a = REGION_MAP[color];
  const [x, z] = uvToWorld(...a.center);
  const r = a.clickR * BOARD_W;

  const wantsRegionPick =
    !!wizard &&
    ((wizard.needsDeer && !wizard.deerRegion) ||
      wizard.koiBonusRegions.length < wizard.koiCrossings);

  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.04;
      ring.current.scale.set(s, s, 1);
    }
  });

  if (!wantsRegionPick) return null;
  return (
    <group position={[x, BOARD_Y + 0.01, z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!wizard) return;
          if (wizard.needsDeer && !wizard.deerRegion) {
            updateWizard({ deerRegion: color });
          } else if (wizard.koiBonusRegions.length < wizard.koiCrossings) {
            updateWizard({ koiBonusRegions: [...wizard.koiBonusRegions, color] });
          }
        }}
      >
        <circleGeometry args={[r, 40]} />
        <meshBasicMaterial
          color={hovered ? "#ffffff" : REGION_INFO[color].hex}
          transparent
          opacity={hovered ? 0.3 : 0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.94, r, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Player pawns on the 0–79 prestige track printed around the board edge. */
function PrestigePawns({ game }: { game: GameState }) {
  return (
    <>
      {game.players.map((p, idx) => {
        const [u, v] = trackUV(p.prestige);
        const [x, z] = uvToWorld(u, v);
        // Nudge co-located pawns apart in a 3x2 mini grid.
        const dx = ((idx % 3) - 1) * 0.17;
        const dz = (Math.floor(idx / 3) - 0.5) * 0.2;
        return (
          <group key={idx} position={[x + dx, BOARD_Y, z + dz]}>
            <mesh position={[0, 0.19, 0]}>
              <coneGeometry args={[0.13, 0.38, 10]} />
              <meshStandardMaterial color={PLAYER_COLORS[idx].hex} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color={PLAYER_COLORS[idx].hex} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Unclaimed Fox tokens lined up on the table beside the board. */
function FoxTokens({ game }: { game: GameState }) {
  if (!game.config.clans.includes("fox")) return null;
  const x = BOARD_W / 2 + 1.1;
  return (
    <>
      {game.foxAvailable.map((v, i) => {
        const { tex, aspect } = labelTexture(`🦊${v}`, { size: 40, color: "#fff", bg: "#7a4a1f" });
        const z = -2.2 + i * 1.1;
        return (
          <group key={v} position={[x, 0, z]}>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 0.06, 20]} />
              <meshStandardMaterial color="#8a5527" roughness={0.6} />
            </mesh>
            <Sprite tex={tex} aspect={aspect} height={0.42} position={[0, 0.42, 0]} />
          </group>
        );
      })}
    </>
  );
}

/**
 * Placeholder Koi Settlement board beside the main board — becomes a texture
 * once the real Koi board image is added.
 */
function KoiBoard({ game }: { game: GameState }) {
  if (!game.koiInPlay) return null;
  const symbols = koiSymbols(game);
  const bx = -(BOARD_W / 2 + 1.5);
  const spaceZ = (i: number) => 4.2 - i * 0.7;
  const koiLabel = labelTexture("🐟", { size: 40 });
  return (
    <group position={[bx, 0, 0]}>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 9.6]} />
        <meshStandardMaterial color="#1d4b46" roughness={0.9} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => {
        const isSymbol = symbols.includes(i);
        return (
          <group key={i}>
            <mesh position={[0, 0.02, spaceZ(i)]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[isSymbol ? 0.3 : 0.22, 20]} />
              <meshStandardMaterial color={isSymbol ? "#3c8c50" : "#2e6e42"} />
            </mesh>
            {isSymbol && (
              <Sprite
                tex={koiLabel.tex}
                aspect={koiLabel.aspect}
                height={0.4}
                position={[-0.62, 0.28, spaceZ(i)]}
              />
            )}
          </group>
        );
      })}
      {game.players.map((p, idx) => (
        <mesh key={idx} position={[((idx % 3) - 1) * 0.24, 0.16, spaceZ(p.koiPos) + (idx > 2 ? 0.22 : 0)]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={PLAYER_COLORS[idx].hex} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function Board() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <group>
      <TableAndBoard />
      {REGION_COLORS.map((color) => (
        <group key={color}>
          <RegionMarkers game={game} color={color} />
          <RegionPrestigeTokens game={game} color={color} />
          <RegionHotspot color={color} />
        </group>
      ))}
      <PrestigePawns game={game} />
      <FoxTokens game={game} />
      <KoiBoard game={game} />
    </group>
  );
}
