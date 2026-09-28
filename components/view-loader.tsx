"use client";

import dynamic from "next/dynamic";

const ViewerShell = dynamic(() => import("@/components/viewer-shell").then((mod) => mod.ViewerShell), {
  ssr: false,
  loading: () => <main className="viewer" />,
});

export function ViewLoader() {
  return <ViewerShell />;
}
