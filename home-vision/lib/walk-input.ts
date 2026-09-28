import type { MutableRefObject } from "react";

export type WalkAxes = {
  forward: number;
  strafe: number;
};

export type WalkAxesRef = MutableRefObject<WalkAxes>;

export function createWalkAxes(): WalkAxes {
  return { forward: 0, strafe: 0 };
}

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(max-width: 820px)").matches
  );
}
