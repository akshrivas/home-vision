"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { loadHouse } from "@/lib/storage";
import type { House } from "@/lib/house/types";

const HouseCanvas = dynamic(() => import("@/components/house-canvas"), {
  ssr: false,
});

export function ViewerShell() {
  const [house] = useState<House | null>(() => loadHouse());
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");

  if (!house) {
    return (
      <main className="empty">
        <div>
          <p className="mark">House Vision</p>
          <h1 style={{ fontSize: 64 }}>View 3D House</h1>
          <p className="empty-copy">Upload a floor plan to walk through the house.</p>
          <p>
            <Link href="/">Back</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="viewer">
      <HouseCanvas house={house} mode={mode} onMode={setMode} />
      <div className="hud">
        <div className="hud-top">
          <div className="house-name">
            <span>View 3D House</span>
            <strong>{house.metadata.name}</strong>
          </div>
          <Link className="back-link" href="/">
            Back
          </Link>
        </div>
        <div className="hud-bottom">
          <div className="modes">
            <button type="button" className={mode === "orbit" ? "active" : ""} onClick={() => setMode("orbit")}>
              Orbit
            </button>
            <button id="enter-walk" type="button" className={mode === "walk" ? "active" : ""}>
              Walk inside
            </button>
          </div>
          <p className="hint">
            {mode === "walk" ? "WASD to move · Esc to step back outside" : "Drag to look around the house"}
          </p>
        </div>
      </div>
    </main>
  );
}
