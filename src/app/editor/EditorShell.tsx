"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ScreenplayEditor from "@/components/editor/ScreenplayEditor";
import { useScriptForgeStore } from "@/lib/store";
import type { Profile } from "@/lib/types";

export default function EditorShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scriptId = searchParams.get("id");

  const activeProfile = useScriptForgeStore((s) => s.activeProfile);
  const setActiveProfile = useScriptForgeStore((s) => s.setActiveProfile);
  const setProfiles = useScriptForgeStore((s) => s.setProfiles);
  const [profileChecked, setProfileChecked] = useState(false);

  // If the store has no activeProfile (e.g. direct navigation), hydrate from localStorage
  useEffect(() => {
    if (activeProfile) {
      setProfileChecked(true);
      return;
    }
    const storedId = localStorage.getItem("activeProfileId");
    if (!storedId) {
      setProfileChecked(true);
      return;
    }
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data) => {
        const list: Profile[] = data.profiles ?? [];
        setProfiles(list);
        const found = list.find((p) => p.profileId === storedId);
        if (found) setActiveProfile(found);
      })
      .catch(() => {})
      .finally(() => setProfileChecked(true));
  }, [activeProfile, setActiveProfile, setProfiles]);

  // Redirect to / if no profile found after hydration
  useEffect(() => {
    if (profileChecked && !activeProfile) {
      router.push("/");
    }
  }, [profileChecked, activeProfile, router]);

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

  if (!profileChecked || !activeProfile) {
    return <div className="h-screen bg-[#0f0f14]" />;
  }

  return <ScreenplayEditor scriptId={scriptId} />;
}
