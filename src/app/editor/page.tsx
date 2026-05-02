import { Suspense } from "react";
import EditorShell from "./EditorShell";

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0f0f14]" />}>
      <EditorShell />
    </Suspense>
  );
}
