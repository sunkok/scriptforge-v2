"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FileText, Pencil, Plus, Trash2, User, X } from "lucide-react";
import type { Profile, ScriptMetadata } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";
import { useScriptForgeStore } from "@/lib/store";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TypeToConfirmDialog from "@/components/ui/TypeToConfirmDialog";
import NameInputDialog from "@/components/ui/NameInputDialog";

export default function ScriptLauncher() {
  const router = useRouter();
  const activeProfile = useScriptForgeStore((s) => s.activeProfile);
  const setActiveProfile = useScriptForgeStore((s) => s.setActiveProfile);
  const profiles = useScriptForgeStore((s) => s.profiles);
  const setProfiles = useScriptForgeStore((s) => s.setProfiles);

  const [profilesLoading, setProfilesLoading] = useState(true);
  const [scripts, setScripts] = useState<ScriptMetadata[] | null>(null);
  const [newScriptDialogVisible, setNewScriptDialogVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ScriptMetadata | null>(null);

  // Profile creation
  const [addingProfile, setAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Profile editing
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Profile deletion
  const [pendingDeleteProfile, setPendingDeleteProfile] = useState<Profile | null>(null);

  // On mount: fetch profiles and hydrate activeProfile from localStorage
  useEffect(() => {
    setProfilesLoading(true);
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data) => {
        const list: Profile[] = data.profiles ?? [];
        setProfiles(list);
        const storedId = localStorage.getItem("activeProfileId");
        if (storedId) {
          const found = list.find((p) => p.profileId === storedId);
          if (found) setActiveProfile(found);
        }
      })
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, [setActiveProfile, setProfiles]);

  // Fetch scripts whenever activeProfile changes
  useEffect(() => {
    if (!activeProfile) { setScripts(null); return; }
    setScripts(null);
    fetch(`/api/scripts?profileId=${activeProfile.profileId}`)
      .then((r) => r.json())
      .then((data) => setScripts(data.scripts ?? []))
      .catch(() => setScripts([]));
  }, [activeProfile]);

  // Focus add-profile input when it appears
  useEffect(() => {
    if (addingProfile) addInputRef.current?.focus();
  }, [addingProfile]);

  async function handleCreateScript(title: string) {
    if (!activeProfile) return;
    const res = await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, fountain: "", ownerProfileId: activeProfile.profileId }),
    });
    if (!res.ok) throw new Error("Failed to create script. Try again.");
    const data = (await res.json()) as ScriptMetadata;
    setNewScriptDialogVisible(false);
    router.push(`/editor?id=${data.scriptId}`);
  }

  async function handleAddProfile() {
    const name = newProfileName.trim();
    if (!name || creatingProfile) return;
    setCreatingProfile(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const profile = (await res.json()) as Profile;
        const updated = [...profiles, profile];
        setProfiles(updated);
        setAddingProfile(false);
        setNewProfileName("");
        setActiveProfile(profile);
      }
    } finally {
      setCreatingProfile(false);
    }
  }

  async function handleSaveEdit(profileId: string) {
    const name = editName.trim();
    if (!name || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Profile;
        const newList = profiles.map((p) =>
          p.profileId === profileId ? updated : p
        );
        setProfiles(newList);
        if (activeProfile?.profileId === profileId) setActiveProfile(updated);
        setEditingProfileId(null);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  // ─── STEP B: Script launcher ──────────────────────────────────────────────

  if (activeProfile) {
    return (
      <>
      <div className="w-full max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-fg-secondary)] uppercase tracking-[0.12em] font-sans">
            Forge your scripts
          </span>
          <span className="text-[12px] font-sans" style={{ color: "#6b6b76" }}>
            {activeProfile.name}{" "}
            <button
              onClick={() => {
                setActiveProfile(null);
                setScripts(null);
              }}
              className="text-orange-400 hover:text-orange-300 transition-colors"
            >
              · Switch
            </button>
          </span>
        </div>

        {scripts === null ? (
          <div className="px-5 py-4 text-[13px] text-[var(--color-fg-secondary)] font-sans">
            Loading…
          </div>
        ) : scripts.length === 0 ? (
          <div className="px-5 py-4 text-[13px] text-[var(--color-fg-secondary)] font-sans">
            No scripts yet
          </div>
        ) : (
          scripts.map((script) => (
            <button
              key={script.scriptId}
              onClick={() => router.push(`/editor?id=${script.scriptId}`)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group"
            >
              <FileText
                size={15}
                className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
              />
              <span className="flex-1 text-left text-[var(--color-fg-primary)] text-[14px] font-sans truncate">
                {script.title || "Untitled"}
              </span>
              <span className="text-[var(--color-fg-secondary)] text-[12px] font-sans shrink-0">
                {relativeTime(script.updatedAt)}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setPendingDelete(script); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setPendingDelete(script);
                  }
                }}
                className="shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-colors hover:text-red-400"
                style={{ color: "#6b6b76" }}
                aria-label="Delete script"
              >
                <Trash2 size={14} />
              </span>
              <ChevronRight
                size={14}
                className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
              />
            </button>
          ))
        )}

        <div className="border-t border-[var(--color-border-subtle)]" />

        <button
          onClick={() => setNewScriptDialogVisible(true)}
          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group"
        >
          <Plus
            size={15}
            className="text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors"
          />
          <span className="text-indigo-400 text-[14px] font-sans group-hover:text-indigo-300 transition-colors">
            Create new script
          </span>
        </button>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete script?"
          body={`Are you sure you want to delete "${pendingDelete.title || "Untitled"}"? This will permanently delete the script and all its versions, autosaves, and shares. This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={async () => {
            const res = await fetch(`/api/scripts/${pendingDelete.scriptId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            setScripts(null);
            fetch(`/api/scripts?profileId=${activeProfile!.profileId}`)
              .then((r) => r.json())
              .then((data) => setScripts(data.scripts ?? []))
              .catch(() => setScripts([]));
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {newScriptDialogVisible && (
        <NameInputDialog
          title="New script"
          body="What's the title of your screenplay?"
          placeholder="e.g., Resonant Skies"
          confirmLabel="Create"
          onConfirm={handleCreateScript}
          onCancel={() => setNewScriptDialogVisible(false)}
        />
      )}
    </>
    );
  }

  // ─── STEP A: Profile selector ─────────────────────────────────────────────

  return (
    <>
    <div className="w-full max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="px-5 pt-5 pb-3 text-[10px] text-[var(--color-fg-secondary)] uppercase tracking-[0.12em] font-sans">
        Who&apos;s writing?
      </div>

      {profilesLoading ? (
        <div className="px-5 py-4 text-[13px] text-[var(--color-fg-secondary)] font-sans">
          Loading…
        </div>
      ) : (
        <>
          {profiles.length === 0 && !addingProfile && (
            <div className="px-5 py-3 text-[13px] font-sans" style={{ color: "#5a6070" }}>
              Create your first profile to begin
            </div>
          )}

          {profiles.map((profile) =>
            editingProfileId === profile.profileId ? (
              <div key={profile.profileId} className="flex items-center gap-2 px-5 py-2.5">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveEdit(profile.profileId);
                    if (e.key === "Escape") setEditingProfileId(null);
                  }}
                  autoFocus
                  className="flex-1 px-3 py-1.5 rounded-lg text-[14px] font-sans text-white focus:outline-none"
                  style={{ background: "#0f0f14", border: "1px solid #3a3a55" }}
                />
                <button
                  onClick={() => void handleSaveEdit(profile.profileId)}
                  disabled={!editName.trim() || savingEdit}
                  className="p-1.5 rounded text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingProfileId(null)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: "#6b6b76" }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                key={profile.profileId}
                role="button"
                tabIndex={0}
                onClick={() => setActiveProfile(profile)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveProfile(profile);
                  }
                }}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group cursor-pointer"
              >
                <User
                  size={15}
                  className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
                />
                <span className="flex-1 text-left text-white text-[14px] font-sans font-semibold truncate">
                  {profile.name}
                </span>
                <span className="text-[var(--color-fg-secondary)] text-[12px] font-sans shrink-0">
                  {relativeTime(profile.createdAt)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProfileId(profile.profileId);
                    setEditName(profile.name);
                  }}
                  className="shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-400"
                  style={{ color: "#6b6b76" }}
                  title="Edit profile name"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteProfile(profile);
                  }}
                  className="shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                  style={{ color: "#6b6b76" }}
                  title="Delete profile"
                >
                  <Trash2 size={13} />
                </button>
                <ChevronRight
                  size={14}
                  className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
                />
              </div>
            )
          )}
        </>
      )}

      <div className="border-t border-[var(--color-border-subtle)]" />

      {addingProfile ? (
        <div className="px-5 py-3 flex items-center gap-2">
          <input
            ref={addInputRef}
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddProfile();
              if (e.key === "Escape") {
                setAddingProfile(false);
                setNewProfileName("");
              }
            }}
            placeholder="Profile name"
            className="flex-1 px-3 py-1.5 rounded-lg text-[14px] font-sans text-white focus:outline-none"
            style={{ background: "#0f0f14", border: "1px solid #3a3a55" }}
          />
          <button
            onClick={() => void handleAddProfile()}
            disabled={!newProfileName.trim() || creatingProfile}
            className="px-3 py-1.5 rounded-lg text-[13px] font-sans font-semibold text-white disabled:opacity-40"
            style={{ background: "#6366f1" }}
          >
            {creatingProfile ? "…" : "Create"}
          </button>
          <button
            onClick={() => {
              setAddingProfile(false);
              setNewProfileName("");
            }}
            className="text-[13px] font-sans px-2 py-1.5 rounded-lg"
            style={{ color: "#6b6b76" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingProfile(true)}
          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group"
        >
          <Plus
            size={15}
            className="text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors"
          />
          <span className="text-indigo-400 text-[14px] font-sans group-hover:text-indigo-300 transition-colors">
            Add new profile
          </span>
        </button>
      )}
    </div>

    {pendingDeleteProfile && (
      <TypeToConfirmDialog
        title="Delete profile?"
        body={`This will permanently delete the profile "${pendingDeleteProfile.name}". This cannot be undone.`}
        confirmPrompt="Type the profile name to confirm:"
        confirmMatch={pendingDeleteProfile.name}
        confirmLabel="Delete profile"
        onConfirm={async () => {
          const target = pendingDeleteProfile!;
          const res = await fetch(`/api/profiles/${target.profileId}`, {
            method: "DELETE",
          });
          if (res.status === 409) {
            const data = (await res.json()) as { error?: string };
            throw new Error(data.error ?? "Cannot delete this profile.");
          }
          if (!res.ok) throw new Error("Failed to delete. Try again.");
          const newList = profiles.filter((p) => p.profileId !== target.profileId);
          setProfiles(newList);
          if (localStorage.getItem("activeProfileId") === target.profileId) {
            setActiveProfile(null);
          }
        }}
        onCancel={() => setPendingDeleteProfile(null)}
      />
    )}
    </>
  );
}
