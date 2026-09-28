"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { HouseMesh } from "@/components/house-mesh";
import { DEFAULTS } from "@/lib/house/defaults";
import type { House } from "@/lib/house/types";
import { isCoarsePointer, type WalkAxesRef } from "@/lib/walk-input";
import { clampToPlot, collidersFor, footHeight, frameHouse, resolveCollision, walkStart } from "@/lib/house/walk";

type Mode = "orbit" | "walk";

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");

export default function HouseCanvas({
  house,
  mode,
  onMode,
  axesRef,
}: {
  house: House;
  mode: Mode;
  onMode: (mode: Mode) => void;
  axesRef: WalkAxesRef;
}) {
  return (
    <Canvas
      shadows="basic"
      dpr={[1, 1.75]}
      camera={{ position: [6, 8, 18], fov: 40, near: 0.08, far: 220 }}
      gl={{ antialias: true }}
      style={{ touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.domElement.style.touchAction = "none";
      }}
    >
      <color attach="background" args={["#c9d8e8"]} />
      <fog attach="fog" args={["#c9d8e8", 32, 95]} />
      <hemisphereLight args={["#f7fbff", "#d9c7ae", 0.55]} />
      <ambientLight intensity={0.28} />
      <Sun house={house} />
      <HouseMesh house={house} />
      <Experience house={house} mode={mode} onMode={onMode} axesRef={axesRef} />
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

function Experience({
  house,
  mode,
  onMode,
  axesRef,
}: {
  house: House;
  mode: Mode;
  onMode: (mode: Mode) => void;
  axesRef: WalkAxesRef;
}) {
  const get = useThree((state) => state.get);
  const gl = useThree((state) => state.gl);
  const orbit = useRef<OrbitControlsImpl>(null);
  const foot = useRef(0);
  const hadPointerLock = useRef(false);
  const keys = useKeys();
  const colliders = useMemo(() => collidersFor(house), [house]);
  const touch = useMemo(() => isCoarsePointer(), []);

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

  useEffect(() => {
    if (mode !== "walk") {
      hadPointerLock.current = false;
      return;
    }
    placeWalkCamera(get().camera as THREE.PerspectiveCamera, house, colliders, foot);
    if (!touch) {
      try {
        const lock = gl.domElement.requestPointerLock() as Promise<void> | void;
        if (lock && typeof lock.then === "function") {
          lock.catch(() => {
            // Click the canvas if the browser blocks lock outside the gesture.
          });
        }
      } catch {
        // ignore
      }
    }
  }, [mode, house, colliders, get, gl, touch]);

  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement === gl.domElement) {
        hadPointerLock.current = true;
        return;
      }
      if (hadPointerLock.current && mode === "walk" && !touch) {
        hadPointerLock.current = false;
        onMode("orbit");
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () => document.removeEventListener("pointerlockchange", onLockChange);
  }, [gl, mode, onMode, touch]);

  useEffect(() => {
    if (mode !== "walk") return;
    const element = gl.domElement;
    const camera = get().camera as THREE.PerspectiveCamera;
    const sensitivity = touch ? 0.0034 : 0.0022;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const applyLook = (dx: number, dy: number) => {
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= dx * sensitivity;
      euler.x -= dy * sensitivity;
      euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
      camera.quaternion.setFromEuler(euler);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) return;
      applyLook(event.movementX, event.movementY);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!touch) {
        if (document.pointerLockElement !== element) void element.requestPointerLock();
        return;
      }
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!touch || !dragging) return;
      applyLook(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!touch) return;
      dragging = false;
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
    };
  }, [mode, gl, get, touch]);

  useFrame((_, delta) => {
    if (mode !== "walk") return;
    const camera = get().camera;
    const dt = Math.min(delta, 0.05);
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    right.set(forward.z, 0, -forward.x);

    const axisForward = THREE.MathUtils.clamp(keys.current.forward + axesRef.current.forward, -1, 1);
    const axisStrafe = THREE.MathUtils.clamp(keys.current.strafe + axesRef.current.strafe, -1, 1);
    const step = DEFAULTS.walkSpeed * dt;
    const speed = axisForward * step;
    const strafe = axisStrafe * step;

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
    <OrbitControls
      ref={orbit}
      enabled={mode === "orbit"}
      enablePan={!touch}
      enableZoom
      maxPolarAngle={Math.PI / 2.08}
      minDistance={1.6}
      maxDistance={48}
      rotateSpeed={touch ? 0.72 : 1}
      zoomSpeed={touch ? 0.85 : 1}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}

function placeWalkCamera(
  camera: THREE.PerspectiveCamera,
  house: House,
  colliders: ReturnType<typeof collidersFor>,
  foot: { current: number },
) {
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
}

function useKeys() {
  const keys = useRef({ forward: 0, strafe: 0 });
  useEffect(() => {
    const state = { forward: false, back: false, left: false, right: false };
    const sync = () => {
      keys.current.forward = (state.forward ? 1 : 0) + (state.back ? -1 : 0);
      keys.current.strafe = (state.right ? 1 : 0) + (state.left ? -1 : 0);
    };
    const setKey = (code: string, pressed: boolean) => {
      if (code === "KeyW" || code === "ArrowUp") state.forward = pressed;
      if (code === "KeyS" || code === "ArrowDown") state.back = pressed;
      if (code === "KeyA" || code === "ArrowLeft") state.left = pressed;
      if (code === "KeyD" || code === "ArrowRight") state.right = pressed;
      sync();
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
