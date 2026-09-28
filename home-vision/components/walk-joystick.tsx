"use client";

import { useEffect, useRef } from "react";
import type { WalkAxesRef } from "@/lib/walk-input";

const MAX_TRAVEL = 42;

export function WalkJoystick({ active, axesRef }: { active: boolean; axesRef: WalkAxesRef }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      axesRef.current.forward = 0;
      axesRef.current.strafe = 0;
      if (knobRef.current) {
        knobRef.current.style.transform = "translate(-50%, -50%)";
      }
    }
  }, [active, axesRef]);

  useEffect(() => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob || !active) return;

    const reset = () => {
      pointerId.current = null;
      axesRef.current.forward = 0;
      axesRef.current.strafe = 0;
      knob.style.transform = "translate(-50%, -50%)";
    };

    const moveTo = (clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > MAX_TRAVEL) {
        dx = (dx / distance) * MAX_TRAVEL;
        dy = (dy / distance) * MAX_TRAVEL;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      axesRef.current.strafe = dx / MAX_TRAVEL;
      axesRef.current.forward = -dy / MAX_TRAVEL;
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      pointerId.current = event.pointerId;
      base.setPointerCapture(event.pointerId);
      moveTo(event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId.current !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      moveTo(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId.current !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      reset();
    };

    base.addEventListener("pointerdown", onPointerDown);
    base.addEventListener("pointermove", onPointerMove);
    base.addEventListener("pointerup", onPointerUp);
    base.addEventListener("pointercancel", onPointerUp);
    return () => {
      base.removeEventListener("pointerdown", onPointerDown);
      base.removeEventListener("pointermove", onPointerMove);
      base.removeEventListener("pointerup", onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      reset();
    };
  }, [active, axesRef]);

  if (!active) return null;

  return (
    <div className="joystick" aria-hidden="true">
      <div ref={baseRef} className="joystick-base">
        <div ref={knobRef} className="joystick-knob" />
      </div>
    </div>
  );
}
