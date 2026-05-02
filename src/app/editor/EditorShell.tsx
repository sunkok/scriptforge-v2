"use client";

import { useSearchParams, useRouter } from "next/navigation";
import ScreenplayEditor from "@/components/editor/ScreenplayEditor";

export default function EditorShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scriptId = searchParams.get("id");

  if (!scriptId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#0f0f14]">
        <p className="text-[var(--color-fg-secondary)] text-[15px] font-sans">
          No script selected
        </p>
        <button
          onClick={() => router.push("/")}
          className="text-indigo-400 hover:text-indigo-300 text-[14px] font-sans transition-colors"
        >
          ← Back to library
        </button>
      </div>
    );
  }

  return <ScreenplayEditor scriptId={scriptId} />;
}
