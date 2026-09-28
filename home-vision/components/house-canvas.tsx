"use client";

import { OrbitControls, PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { HouseMesh } from "@/components/house-mesh";
import { DEFAULTS } from "@/lib/house/defaults";
import type { House } from "@/lib/house/types";
import { clampToPlot, collidersFor, footHeight, frameHouse, resolveCollision, walkStart } from "@/lib/house/walk";

type Mode = "orbit" | "walk";

export default function HouseCanvas({
  house,
  mode,
  onMode,
}: {
  house: House;
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  return (
    <Canvas
      shadows="basic"
      dpr={[1, 1.75]}
      camera={{ position: [6, 8, 18], fov: 40, near: 0.08, far: 220 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <color attach="background" args={["#c9d8e8"]} />
      <fog attach="fog" args={["#c9d8e8", 32, 95]} />
      <hemisphereLight args={["#f7fbff", "#d9c7ae", 0.55]} />
      <ambientLight intensity={0.28} />
      <Sun house={house} />
      <HouseMesh house={house} />
      <Experience house={house} mode={mode} onMode={onMode} />
    </Canvas>
  );
}

function Sun({ house }: { house: House }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const frame = useMemo(() => frameHouse(house), [house]);

  useEffect(() => {
    if (light.current) light.current.target = target;
  }, [target]);

  return (
    <>
      <primitive object={target} position={[frame.target.x, frame.target.y, frame.target.z]} />
      <directionalLight
        ref={light}
        position={[frame.target.x + 8, 14, frame.target.z - 12]}
        intensity={3.4}
        color="#fff1dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={55}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[frame.target.x - 8, 7, frame.target.z - 6]} intensity={0.45} color="#d5e4f6" />
    </>
  );
}

function Experience({ house, mode, onMode }: { house: House; mode: Mode; onMode: (mode: Mode) => void }) {
  const get = useThree((state) => state.get);
  const gl = useThree((state) => state.gl);
  const orbit = useRef<OrbitControlsImpl>(null);
  const foot = useRef(0);
  const keys = useKeys();
  const colliders = useMemo(() => collidersFor(house), [house]);

  useEffect(() => {
    if (mode !== "orbit") return;
    const camera = get().camera as THREE.PerspectiveCamera;
    const frame = frameHouse(house);
    camera.fov = 42;
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
    camera.updateProjectionMatrix();
    orbit.current?.target.set(frame.target.x, frame.target.y, frame.target.z);
    orbit.current?.update();
    if (document.pointerLockElement) document.exitPointerLock();
  }, [mode, house, get]);

  useFrame((_, delta) => {
    if (mode !== "walk" || document.pointerLockElement !== gl.domElement) return;
    const camera = get().camera;
    const dt = Math.min(delta, 0.05);
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    right.set(forward.z, 0, -forward.x);

    let speed = 0;
    const step = DEFAULTS.walkSpeed * dt;
    if (keys.current.forward) speed += step;
    if (keys.current.back) speed -= step;
    let strafe = 0;
    if (keys.current.right) strafe += step;
    if (keys.current.left) strafe -= step;

    let x = camera.position.x + forward.x * speed + right.x * strafe;
    let z = camera.position.z + forward.z * speed + right.z * strafe;
    const limited = clampToPlot(house, x, z);
    const resolved = resolveCollision(limited.x, limited.z, foot.current, colliders);
    x = resolved.x;
    z = resolved.z;
    const targetFoot = footHeight(house, x, z, foot.current);
    foot.current += (targetFoot - foot.current) * Math.min(1, dt * 8);
    camera.position.set(x, foot.current + DEFAULTS.eyeHeight, z);
  });

  return (
    <>
      <OrbitControls
        ref={orbit}
        enabled={mode === "orbit"}
        enablePan
        maxPolarAngle={Math.PI / 2.08}
        minDistance={1.6}
        maxDistance={48}
      />
      <PointerLockControls
        selector="#enter-walk"
        onLock={() => {
          const camera = get().camera as THREE.PerspectiveCamera;
          const start = walkStart(house);
          let x = start.x;
          let z = start.z;
          const ground = start.eye - DEFAULTS.eyeHeight;
          for (let index = 0; index < 4; index += 1) {
            const resolved = resolveCollision(x, z, ground, colliders);
            x = resolved.x;
            z = resolved.z;
          }
          foot.current = footHeight(house, x, z, ground);
          camera.fov = 68;
          camera.position.set(x, foot.current + DEFAULTS.eyeHeight, z);
          camera.lookAt(start.lookX, foot.current + DEFAULTS.eyeHeight, start.lookZ);
          camera.updateProjectionMatrix();
          onMode("walk");
        }}
        onUnlock={() => onMode("orbit")}
      />
    </>
  );
}

function useKeys() {
  const keys = useRef({ forward: false, back: false, left: false, right: false });
  useEffect(() => {
    const setKey = (code: string, pressed: boolean) => {
      if (code === "KeyW" || code === "ArrowUp") keys.current.forward = pressed;
      if (code === "KeyS" || code === "ArrowDown") keys.current.back = pressed;
      if (code === "KeyA" || code === "ArrowLeft") keys.current.left = pressed;
      if (code === "KeyD" || code === "ArrowRight") keys.current.right = pressed;
    };
    const onDown = (event: KeyboardEvent) => {
      setKey(event.code, true);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    };
    const onUp = (event: KeyboardEvent) => setKey(event.code, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
  return keys;
}
