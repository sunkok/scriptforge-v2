"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Eye, RotateCcw } from "lucide-react";
import { useScriptForgeStore } from "@/lib/store";
import type { AutosaveSnapshot, ShareRecord, VersionMetadata } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";
import WriterAnnotationPanel from "@/components/editor/WriterAnnotationPanel";
import ViewSnapshotModal from "@/components/editor/ViewSnapshotModal";

type Tab = "versions" | "autosaves" | "shares";

const TABS: { id: Tab; label: string }[] = [
  { id: "versions", label: "Versions" },
  { id: "autosaves", label: "Auto-saves" },
  { id: "shares", label: "Shares" },
];

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayUTC() { return new Date().toISOString().split("T")[0]; }
function yesterdayUTC() { return new Date(Date.now() - 86_400_000).toISOString().split("T")[0]; }

function dateHeader(date: string): string {
  if (date === todayUTC()) return "TODAY";
  if (date === yesterdayUTC()) return "YESTERDAY";
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

interface DateGroup { date: string; label: string; items: AutosaveSnapshot[]; }

function groupByDate(snapshots: AutosaveSnapshot[]): DateGroup[] {
  const map = new Map<string, AutosaveSnapshot[]>();
  for (const s of snapshots) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date, label: dateHeader(date),
      items: [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }));
}

function expiresLabel(record: ShareRecord): string {
  if (record.revokedAt) return "Revoked";
  if (!record.expiresAt) return "Never expires";
  const msLeft = new Date(record.expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "Expired";
  const days = Math.ceil(msLeft / 86_400_000);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function shareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share/${token}`;
}

// ─── restore target type ──────────────────────────────────────────────────────

type RestoreTarget =
  | { kind: "version"; versionId: string; label: string }
  | { kind: "autosave"; date: string; slot: number; label: string };

// ─── modal ────────────────────────────────────────────────────────────────────

interface Props { onClose: () => void; }

export default function VersionsModal({ onClose }: Props) {
  const currentScriptId = useScriptForgeStore((s) => s.currentScriptId);
  const versions      = useScriptForgeStore((s) => s.versions);
  const setVersions   = useScriptForgeStore((s) => s.setVersions);
  const autosaves     = useScriptForgeStore((s) => s.autosaves);
  const setAutosaves  = useScriptForgeStore((s) => s.setAutosaves);
  const shares        = useScriptForgeStore((s) => s.shares);
  const setShares     = useScriptForgeStore((s) => s.setShares);

  const [mounted, setMounted]               = useState(false);
  const [activeTab, setActiveTab]           = useState<Tab>("versions");
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [autosavesLoading, setAutosavesLoading] = useState(false);
  const [sharesLoading, setSharesLoading]   = useState(false);

  // Save-as-version form
  const [showSaveForm, setShowSaveForm]     = useState(false);
  const [labelInput, setLabelInput]         = useState("");
  const [saving, setSaving]                 = useState(false);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [flashVersionId, setFlashVersionId] = useState<string | null>(null);

  // Share dialog (one active at a time)
  const [shareDialogVersionId, setShareDialogVersionId] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry]       = useState("never");
  const [shareCreating, setShareCreating]   = useState(false);
  const [shareResult, setShareResult]       = useState<{ url: string } | null>(null);
  const [shareCopied, setShareCopied]       = useState(false);

  // Revoke loading
  const [revokingToken, setRevokingToken]   = useState<string | null>(null);

  // Comments panel
  const [commentsVersionId, setCommentsVersionId] = useState<string | null>(null);
  const commentsVersion = commentsVersionId
    ? (versions.find((v) => v.versionId === commentsVersionId) ?? null)
    : null;

  // View snapshot
  const [viewTarget, setViewTarget]         = useState<{ label: string; fountain: string } | null>(null);
  const [loadingViewId, setLoadingViewId]   = useState<string | null>(null);

  // Restore confirm
  const [restoreTarget, setRestoreTarget]   = useState<RestoreTarget | null>(null);
  const [restoring, setRestoring]           = useState(false);
  const [restoreError, setRestoreError]     = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Fetch versions on open.
  useEffect(() => {
    if (!currentScriptId) return;
    setVersionsLoading(true);
    fetch(`/api/scripts/${currentScriptId}/versions`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions ?? []))
      .catch(() => {})
      .finally(() => setVersionsLoading(false));
  }, [currentScriptId]);

  // Fetch autosaves when tab activates.
  useEffect(() => {
    if (activeTab !== "autosaves" || !currentScriptId) return;
    setAutosavesLoading(true);
    fetch(`/api/scripts/${currentScriptId}/autosaves`)
      .then((r) => r.json())
      .then((d) => setAutosaves(d.snapshots ?? []))
      .catch(() => {})
      .finally(() => setAutosavesLoading(false));
  }, [activeTab, currentScriptId]);

  // Fetch shares when tab activates.
  useEffect(() => {
    if (activeTab !== "shares") return;
    fetchShares();
  }, [activeTab]);

  function fetchShares() {
    setSharesLoading(true);
    fetch("/api/shares")
      .then((r) => r.json())
      .then((d) => setShares(d.shares ?? []))
      .catch(() => {})
      .finally(() => setSharesLoading(false));
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // ── Save-as-version ──
  function openSaveForm() {
    setLabelInput(`Draft ${versions.length + 1}`);
    setShowSaveForm(true);
    setSaveError(null);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
  }

  async function handleSaveVersion() {
    if (!currentScriptId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const label = labelInput.trim() || `Draft ${versions.length + 1}`;
      const res = await fetch(`/api/scripts/${currentScriptId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("server error");
      const newVersion = (await res.json()) as VersionMetadata;
      const listRes = await fetch(`/api/scripts/${currentScriptId}/versions`);
      setVersions((await listRes.json()).versions ?? []);
      setShowSaveForm(false);
      setFlashVersionId(newVersion.versionId);
      setTimeout(() => setFlashVersionId(null), 1000);
    } catch {
      setSaveError("Failed to save");
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ── Share dialog ──
  function openShareDialog(versionId: string) {
    setShareDialogVersionId(versionId);
    setShareExpiry("never");
    setShareResult(null);
    setShareCopied(false);
  }

  function closeShareDialog() {
    setShareDialogVersionId(null);
    setShareResult(null);
    setShareCopied(false);
  }

  async function handleCreateShare() {
    if (!currentScriptId || !shareDialogVersionId || shareCreating) return;
    setShareCreating(true);
    try {
      const body: Record<string, unknown> = {
        scriptId: currentScriptId,
        versionId: shareDialogVersionId,
      };
      if (shareExpiry !== "never") body.expiresInDays = parseInt(shareExpiry, 10);
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("server error");
      const record = (await res.json()) as ShareRecord;
      setShareResult({ url: shareUrl(record.token) });
      fetch("/api/shares")
        .then((r) => r.json())
        .then((d) => setShares(d.shares ?? []))
        .catch(() => {});
    } catch {
      // keep dialog open, no result shown
    } finally {
      setShareCreating(false);
    }
  }

  async function handleCopyShareLink(url: string) {
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  // ── Revoke ──
  async function handleRevoke(token: string) {
    if (!window.confirm("Revoke this share link? It will stop working immediately.")) return;
    setRevokingToken(token);
    try {
      await fetch(`/api/shares/${token}/revoke`, { method: "POST" });
      fetchShares();
    } finally {
      setRevokingToken(null);
    }
  }

  // ── View snapshot ──
  async function handleViewVersion(versionId: string, label: string) {
    if (!currentScriptId) return;
    const id = `v:${versionId}`;
    setLoadingViewId(id);
    try {
      const res = await fetch(`/api/scripts/${currentScriptId}/versions/${versionId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { fountain: string };
      setViewTarget({ label, fountain: data.fountain ?? "" });
    } finally {
      setLoadingViewId(null);
    }
  }

  async function handleViewAutosave(date: string, slot: number, slotLabel: string) {
    if (!currentScriptId) return;
    const id = `a:${date}/${slot}`;
    setLoadingViewId(id);
    try {
      const res = await fetch(`/api/scripts/${currentScriptId}/autosaves/${date}/${slot}`);
      if (!res.ok) return;
      const data = (await res.json()) as { fountain: string };
      setViewTarget({ label: slotLabel, fountain: data.fountain ?? "" });
    } finally {
      setLoadingViewId(null);
    }
  }

  // ── Restore ──
  async function handleRestoreConfirm() {
    if (!restoreTarget || !currentScriptId || restoring) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const body =
        restoreTarget.kind === "version"
          ? { source: "version", versionId: restoreTarget.versionId }
          : { source: "autosave", date: restoreTarget.date, slot: restoreTarget.slot };

      const res = await fetch(`/api/scripts/${currentScriptId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Restore failed");
      const data = (await res.json()) as { fountain: string };

      const { requestRestore } = useScriptForgeStore.getState();
      requestRestore?.(data.fountain);

      setRestoreTarget(null);
      onClose();
    } catch {
      setRestoreError("Restore failed. Try again.");
      setTimeout(() => setRestoreError(null), 4000);
    } finally {
      setRestoring(false);
    }
  }

  if (!mounted) return null;

  const scriptShares = shares.filter((s) => s.scriptId === currentScriptId);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div
          className="modal-glass relative w-full mx-4 flex flex-col"
          style={{ maxWidth: "720px", maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
            <h2 className="text-white text-[20px] font-bold font-sans leading-none">
              Version History
            </h2>
            <button onClick={onClose}
              className="text-[var(--color-fg-secondary)] hover:text-white transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 px-6" style={{ borderBottom: "1px solid #2a2a35" }}>
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`text-[13px] font-sans pb-[11px] mr-5 transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "text-white border-indigo-500"
                    : "text-[#6b6b76] border-transparent hover:text-indigo-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {activeTab === "versions" && (
              <VersionsTab
                versions={versions}
                loading={versionsLoading}
                showSaveForm={showSaveForm}
                labelInput={labelInput}
                setLabelInput={setLabelInput}
                saving={saving}
                saveError={saveError}
                flashVersionId={flashVersionId}
                inputRef={inputRef}
                shareDialogVersionId={shareDialogVersionId}
                shareExpiry={shareExpiry}
                setShareExpiry={setShareExpiry}
                shareCreating={shareCreating}
                shareResult={shareResult}
                shareCopied={shareCopied}
                loadingViewId={loadingViewId}
                onOpenSaveForm={openSaveForm}
                onSave={handleSaveVersion}
                onCancelSave={() => setShowSaveForm(false)}
                onOpenShareDialog={openShareDialog}
                onCloseShareDialog={closeShareDialog}
                onCreateShare={handleCreateShare}
                onCopyShareLink={handleCopyShareLink}
                onViewComments={setCommentsVersionId}
                onViewVersion={handleViewVersion}
                onRestoreVersion={(versionId, label) =>
                  setRestoreTarget({ kind: "version", versionId, label })
                }
              />
            )}

            {activeTab === "autosaves" && (
              <AutosavesTab
                snapshots={autosaves}
                loading={autosavesLoading}
                loadingViewId={loadingViewId}
                onViewAutosave={handleViewAutosave}
                onRestoreAutosave={(date, slot, label) =>
                  setRestoreTarget({ kind: "autosave", date, slot, label })
                }
              />
            )}

            {activeTab === "shares" && (
              <SharesTab
                shares={scriptShares}
                loading={sharesLoading}
                revokingToken={revokingToken}
                onRevoke={handleRevoke}
              />
            )}
          </div>
        </div>

        {commentsVersionId && currentScriptId && commentsVersion && (
          <WriterAnnotationPanel
            scriptId={currentScriptId}
            versionId={commentsVersionId}
            versionLabel={commentsVersion.label}
            onClose={() => setCommentsVersionId(null)}
          />
        )}
      </div>

      {/* View snapshot — full-screen overlay above the modal */}
      {viewTarget && (
        <ViewSnapshotModal
          label={viewTarget.label}
          fountain={viewTarget.fountain}
          onClose={() => setViewTarget(null)}
        />
      )}

      {/* Restore confirm dialog — layered above the modal */}
      {restoreTarget && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="modal-glass mx-4 p-6"
            style={{ maxWidth: "400px", width: "100%" }}
          >
            <h3 className="text-white font-semibold font-sans text-[16px] mb-2">
              {restoreTarget.kind === "version" ? "Restore version" : "Restore auto-save"}
            </h3>
            <p className="text-[13px] font-sans mb-5" style={{ color: "#9099a8" }}>
              {restoreTarget.kind === "version"
                ? `Restore "${restoreTarget.label}"? This will replace your current script content.`
                : `Restore auto-save ${restoreTarget.label}? This will replace your current script content.`}
            </p>
            {restoreError && (
              <p className="text-[12px] font-sans mb-3" style={{ color: "#f87171" }}>
                {restoreError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRestoreTarget(null); setRestoreError(null); }}
                disabled={restoring}
                className="px-4 py-2 text-[13px] font-sans rounded transition-colors disabled:opacity-50"
                style={{ background: "#1e1e28", color: "#9099a8" }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                disabled={restoring}
                className="px-4 py-2 text-[13px] font-semibold font-sans rounded text-white transition-colors disabled:opacity-50"
                style={{ background: "#ef4444" }}
              >
                {restoring ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>,
    document.body
  );
}

// ─── Versions tab ─────────────────────────────────────────────────────────────

function VersionsTab({
  versions, loading, showSaveForm, labelInput, setLabelInput, saving, saveError,
  flashVersionId, inputRef, shareDialogVersionId, shareExpiry, setShareExpiry,
  shareCreating, shareResult, shareCopied, loadingViewId,
  onOpenSaveForm, onSave, onCancelSave,
  onOpenShareDialog, onCloseShareDialog, onCreateShare, onCopyShareLink,
  onViewComments, onViewVersion, onRestoreVersion,
}: {
  versions: VersionMetadata[];
  loading: boolean;
  showSaveForm: boolean;
  labelInput: string;
  setLabelInput: (v: string) => void;
  saving: boolean;
  saveError: string | null;
  flashVersionId: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  shareDialogVersionId: string | null;
  shareExpiry: string;
  setShareExpiry: (v: string) => void;
  shareCreating: boolean;
  shareResult: { url: string } | null;
  shareCopied: boolean;
  loadingViewId: string | null;
  onOpenSaveForm: () => void;
  onSave: () => void;
  onCancelSave: () => void;
  onOpenShareDialog: (versionId: string) => void;
  onCloseShareDialog: () => void;
  onCreateShare: () => void;
  onCopyShareLink: (url: string) => void;
  onViewComments: (versionId: string) => void;
  onViewVersion: (versionId: string, label: string) => void;
  onRestoreVersion: (versionId: string, label: string) => void;
}) {
  return (
    <>
      {/* Save form */}
      <div className="flex items-center gap-3 mb-5">
        {!showSaveForm ? (
          <button onClick={onOpenSaveForm}
            className="px-3.5 py-2 text-[13px] font-sans font-medium text-white rounded-md bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            Save as new version
          </button>
        ) : (
          <>
            <input ref={inputRef} type="text" value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancelSave(); }}
              className="px-3 py-2 text-[13px] font-sans text-white rounded-md outline-none"
              style={{ width: "240px", background: "#1e1e28", border: "1px solid #3a3a4a" }}
              placeholder="Version label" disabled={saving}
            />
            <button onClick={onSave} disabled={saving}
              className="px-3.5 py-2 text-[13px] font-sans font-medium text-white rounded-md bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onCancelSave} disabled={saving}
              className="px-3.5 py-2 text-[13px] font-sans text-[#6b6b76] rounded-md hover:text-white transition-colors"
            >
              Cancel
            </button>
          </>
        )}
        {saveError && <span className="text-[12px] text-red-400 font-sans">{saveError}</span>}
      </div>

      {/* Version list */}
      {loading ? (
        <div className="text-[13px] text-[var(--color-fg-secondary)] font-sans">Loading…</div>
      ) : versions.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-[#6b6b76] font-sans">
          No versions yet. Save one above.
        </div>
      ) : (
        versions.map((v) => (
          <div key={v.versionId}>
            <VersionRow
              version={v}
              flash={v.versionId === flashVersionId}
              shareActive={shareDialogVersionId === v.versionId}
              viewLoading={loadingViewId === `v:${v.versionId}`}
              onShare={() => onOpenShareDialog(v.versionId)}
              onViewComments={() => onViewComments(v.versionId)}
              onView={() => onViewVersion(v.versionId, v.label)}
              onRestore={() => onRestoreVersion(v.versionId, v.label)}
            />
            {shareDialogVersionId === v.versionId && (
              <ShareInlineForm
                expiry={shareExpiry}
                onExpiryChange={setShareExpiry}
                creating={shareCreating}
                result={shareResult}
                copied={shareCopied}
                onCreate={onCreateShare}
                onClose={onCloseShareDialog}
                onCopy={onCopyShareLink}
              />
            )}
          </div>
        ))
      )}
    </>
  );
}

function VersionRow({
  version, flash, shareActive, viewLoading, onShare, onViewComments, onView, onRestore,
}: {
  version: VersionMetadata;
  flash: boolean;
  shareActive: boolean;
  viewLoading: boolean;
  onShare: () => void;
  onViewComments: () => void;
  onView: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      className="flex items-center gap-4 py-3.5"
      style={{
        borderBottom: shareActive ? "none" : "1px solid #1e1e28",
        background: flash ? "rgba(99, 102, 241, 0.12)" : "transparent",
        transition: "background 1s ease",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-[14px] font-semibold font-sans leading-tight">{version.label}</p>
        <p className="text-[#6b6b76] text-[11px] font-sans mt-0.5">{relativeTime(version.createdAt)}</p>
      </div>

      {(version.pageCount != null || version.wordCount != null) && (
        <div className="shrink-0 text-[12px] text-[#6b6b76] font-sans text-right leading-tight">
          {version.pageCount != null && (
            <span>{version.pageCount} {version.pageCount === 1 ? "page" : "pages"}</span>
          )}
          {version.pageCount != null && version.wordCount != null && <span className="mx-1.5">·</span>}
          {version.wordCount != null && <span>{version.wordCount.toLocaleString()} words</span>}
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={onViewComments}
          className="px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
        >Comments</button>
        <button onClick={onShare}
          className={`px-2.5 py-1.5 text-[12px] font-sans rounded transition-colors ${
            shareActive ? "text-indigo-400" : "text-[#6b6b76] hover:text-indigo-400"
          }`}
        >Share</button>
        <button
          onClick={onView}
          disabled={viewLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors disabled:opacity-50"
        >
          <Eye size={11} />
          {viewLoading ? "…" : "View"}
        </button>
        <button
          onClick={onRestore}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
        >
          <RotateCcw size={11} />
          Restore
        </button>
      </div>
    </div>
  );
}

function ShareInlineForm({
  expiry, onExpiryChange, creating, result, copied, onCreate, onClose, onCopy,
}: {
  expiry: string;
  onExpiryChange: (v: string) => void;
  creating: boolean;
  result: { url: string } | null;
  copied: boolean;
  onCreate: () => void;
  onClose: () => void;
  onCopy: (url: string) => void;
}) {
  return (
    <div
      className="mb-0.5 px-4 py-3 rounded-b-md"
      style={{ background: "#1a1a24", border: "1px solid #2a2a35", borderTop: "none" }}
    >
      {!result ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[12px] text-[#6b6b76] font-sans">Expires in:</span>
          <select
            value={expiry}
            onChange={(e) => onExpiryChange(e.target.value)}
            disabled={creating}
            className="text-[12px] font-sans text-white rounded px-2 py-1 outline-none"
            style={{ background: "#2a2a35", border: "1px solid #3a3a45" }}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={onCreate}
            disabled={creating}
            className="px-3 py-1 text-[12px] font-sans font-medium text-white rounded bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create link"}
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 text-[12px] font-sans text-[#6b6b76] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-[12px] font-mono text-indigo-300 truncate flex-1 min-w-0"
            style={{ maxWidth: "380px" }}
          >
            {result.url}
          </span>
          <button
            onClick={() => onCopy(result.url)}
            className="flex items-center gap-1.5 px-3 py-1 text-[12px] font-sans text-white rounded bg-indigo-500 hover:bg-indigo-600 transition-colors shrink-0"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 text-[12px] font-sans text-[#6b6b76] hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Auto-saves tab ───────────────────────────────────────────────────────────

function AutosavesTab({
  snapshots, loading, loadingViewId, onViewAutosave, onRestoreAutosave,
}: {
  snapshots: AutosaveSnapshot[];
  loading: boolean;
  loadingViewId: string | null;
  onViewAutosave: (date: string, slot: number, label: string) => void;
  onRestoreAutosave: (date: string, slot: number, label: string) => void;
}) {
  if (loading) return <div className="text-[13px] text-[var(--color-fg-secondary)] font-sans">Loading…</div>;

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-[#6b6b76] font-sans">
        No auto-saves yet. They&apos;ll appear as you work.
      </div>
    );
  }

  return (
    <>
      {groupByDate(snapshots).map((group) => (
        <div key={group.date} className="mb-4">
          <p className="text-[10px] font-sans font-semibold tracking-widest mb-1"
            style={{ color: "#4a4a58", letterSpacing: "0.1em" }}
          >
            {group.label}
          </p>
          {group.items.map((s) => {
            const slotLabel = `Slot ${s.slot} — ${formatSlotTime(s.createdAt)}`;
            const viewId = `a:${s.date}/${s.slot}`;
            return (
              <div key={`${s.date}-${s.slot}`}
                className="flex items-center gap-4 py-3"
                style={{ borderBottom: "1px solid #1e1e28" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-medium font-sans leading-tight">
                    {slotLabel}
                  </p>
                  <p className="text-[#6b6b76] text-[11px] font-sans mt-0.5">
                    {relativeTime(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onViewAutosave(s.date, s.slot, slotLabel)}
                    disabled={loadingViewId === viewId}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors disabled:opacity-50"
                  >
                    <Eye size={11} />
                    {loadingViewId === viewId ? "…" : "View"}
                  </button>
                  <button
                    onClick={() => onRestoreAutosave(s.date, s.slot, slotLabel)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
                  >
                    <RotateCcw size={11} />
                    Restore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

// ─── Shares tab ───────────────────────────────────────────────────────────────

function SharesTab({
  shares, loading, revokingToken, onRevoke,
}: {
  shares: ShareRecord[];
  loading: boolean;
  revokingToken: string | null;
  onRevoke: (token: string) => void;
}) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (loading) return <div className="text-[13px] text-[var(--color-fg-secondary)] font-sans">Loading…</div>;

  if (shares.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-[#6b6b76] font-sans">
        No share links yet. Create one from a version above.
      </div>
    );
  }

  return (
    <>
      {shares.map((record) => {
        const isRevoked = !!record.revokedAt;
        const expLabel = expiresLabel(record);
        const isExpiredOrRevoked = isRevoked || expLabel === "Expired";

        return (
          <div key={record.token}
            className="flex items-center gap-4 py-3.5"
            style={{ borderBottom: "1px solid #1e1e28" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-white text-[14px] font-semibold font-sans leading-tight truncate">
                {record.scriptTitle} — {record.versionLabel}
              </p>
              <p className="text-[#6b6b76] text-[11px] font-sans mt-0.5">
                {relativeTime(record.createdAt)}
                <span className="mx-1.5">·</span>
                <span style={{ color: isExpiredOrRevoked ? "#ef4444" : "#6b6b76" }}>
                  {expLabel}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleCopy(record.token)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
              >
                {copiedToken === record.token ? <Check size={11} /> : <Copy size={11} />}
                {copiedToken === record.token ? "Copied!" : "Copy link"}
              </button>
              {!isRevoked && (
                <button
                  onClick={() => onRevoke(record.token)}
                  disabled={revokingToken === record.token}
                  className="px-2.5 py-1.5 text-[12px] font-sans text-red-500 rounded hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {revokingToken === record.token ? "Revoking…" : "Revoke"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

