"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveHouse } from "@/lib/storage";
import { isHouse } from "@/lib/house/types";

export function Landing() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(request: RequestInfo, init?: RequestInit) {
    setBusy(true);
    setError("");
    setStatus("Reading the floor plan…");
    try {
      const response = await fetch(request, init);
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "The floor plan could not be read.";
        throw new Error(message);
      }
      if (!payload || typeof payload !== "object" || !("house" in payload) || !isHouse(payload.house)) {
        throw new Error("The floor plan could not be turned into a house.");
      }
      saveHouse(payload.house);
      router.push("/view");
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "The floor plan could not be read.");
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <div className="landing-inner">
        <h1>House Vision</h1>
        <p className="lede">Turn your floor plan into a 3D house.</p>
        <div className="actions">
          <button className="button primary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            Upload Floor Plan
          </button>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() =>
              void run("/api/interpret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sample: true }),
              })
            }
          >
            Try Sample Plan
          </button>
        </div>
        <p className="recommend">
          For best results, upload the original digital or CAD-exported architect floor-plan PDF with room names,
          dimensions, walls, doors, windows and stairs clearly visible.
        </p>
        <p className={error ? "status error" : "status"}>{error || status}</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const body = new FormData();
            body.set("file", file);
            void run("/api/interpret", { method: "POST", body });
          }}
        />
      </div>
    </main>
  );
}
