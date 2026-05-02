import type { Editor } from "@tiptap/core";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { CONTENT_HEIGHT_IN } from "./constants";
import { useScriptForgeStore } from "@/lib/store";

// One-time DOM measurement of the device's pixels-per-inch.
// Falls back to 96 (CSS reference pixel spec) in non-browser environments.
function measurePxPerIn(): number {
  if (typeof document === "undefined") return 96;
  const probe = document.createElement("div");
  probe.style.cssText =
    "width:1in;position:absolute;visibility:hidden;top:-9999px;left:-9999px";
  document.body.appendChild(probe);
  const px = probe.offsetWidth;
  document.body.removeChild(probe);
  return px || 96;
}

export class PaginationEngine {
  private editor: Editor | null = null;
  /** Content-area height in CSS pixels (9in × device ppi). */
  readonly contentHeightPx: number;
  /** Map from content DOM element → getPos callback for that page's PM node. */
  private registrations = new Map<Element, () => number | undefined>();
  private ro: ResizeObserver;
  private rafPending = false;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor() {
    this.contentHeightPx = measurePxPerIn() * CONTENT_HEIGHT_IN;
    this.ro = new ResizeObserver(() => {
      if (!this.destroyed && this.editor) this.scheduleOverflowCheck();
    });
  }

  /** Call once the Tiptap editor is ready (inside onCreate). */
  setEditor(editor: Editor): void {
    this.editor = editor;
    // Initial pass after first paint so NodeViews are registered.
    requestAnimationFrame(() => {
      if (!this.destroyed) this.runOverflowCheck();
    });
  }

  /** Called by PageNodeView on mount. */
  register(contentEl: Element, getPos: () => number | undefined): void {
    this.registrations.set(contentEl, getPos);
    this.ro.observe(contentEl);
  }

  /** Called by PageNodeView on unmount. */
  unregister(contentEl: Element): void {
    this.registrations.delete(contentEl);
    this.ro.unobserve(contentEl);
  }

  /**
   * Collapse concurrent ResizeObserver fires into a single RAF callback.
   * Also resets the idle-reconciliation debounce.
   */
  private scheduleOverflowCheck(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      if (!this.destroyed && this.editor) this.runOverflowCheck();
    });

    if (this.reconcileTimer !== null) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      if (!this.destroyed && this.editor) this.runReconciliation();
    }, 300);
  }

  private sortedPages(): Array<{ contentEl: HTMLElement; pagePos: number }> {
    const result: Array<{ contentEl: HTMLElement; pagePos: number }> = [];
    for (const [el, getPos] of this.registrations) {
      const pos = getPos();
      if (pos !== undefined) {
        result.push({ contentEl: el as HTMLElement, pagePos: pos });
      }
    }
    return result.sort((a, b) => a.pagePos - b.pagePos);
  }

  // ─── Overflow: push trailing blocks to the next page ────────────────────

  private runOverflowCheck(): void {
    const editor = this.editor;
    if (!editor) return;

    const { state } = editor;
    const tr = state.tr;
    let changed = false;

    for (const { contentEl, pagePos } of this.sortedPages()) {
      // Map the original page position through any steps already added to tr.
      const mappedPagePos = tr.mapping.map(pagePos);
      const pageNode = tr.doc.nodeAt(mappedPagePos);
      if (!pageNode || pageNode.type.name !== "page") continue;
      // Never leave a page empty — keep at least the first block on it.
      if (pageNode.childCount <= 1) continue;

      // DOM measurements (accurate for this page; stale for pages that
      // received blocks from previous iterations — handled in the next RAF).
      // NodeViewContent renders a wrapper div (contentDOMElement) inside contentEl;
      // the actual screenplay blocks are its children, one level down.
      const pmContent = contentEl.firstElementChild;
      if (!pmContent) continue;
      const children = Array.from(pmContent.children) as HTMLElement[];
      const contentTop = contentEl.getBoundingClientRect().top;
      const budget = contentTop + this.contentHeightPx;

      // Find the first block (index ≥ 1) whose top edge is at or past the budget.
      let firstNonFitting = -1;
      for (let i = 1; i < children.length; i++) {
        if (children[i].getBoundingClientRect().top >= budget) {
          firstNonFitting = i;
          break;
        }
      }
      if (firstNonFitting === -1) continue; // page fits — nothing to do

      // Collect the PM nodes we need to move.
      const nodesToMove: ProsemirrorNode[] = [];
      for (let i = firstNonFitting; i < pageNode.childCount; i++) {
        nodesToMove.push(pageNode.child(i));
      }

      // ── Step 1: delete the overflowing blocks from this page ────────────
      //
      // Positions inside the page:
      //   mappedPagePos           → opening token of the page node
      //   mappedPagePos + 1       → first byte of content
      //   mappedPagePos + N - 1   → last byte of content (just before closing)
      //   mappedPagePos + N       → closing token
      //
      // We delete [deleteFrom, deleteTo) which is [firstNonFitting start, closing).
      let startOffset = 1; // skip page's own opening token
      for (let i = 0; i < firstNonFitting; i++) startOffset += pageNode.child(i).nodeSize;
      const deleteFrom = mappedPagePos + startOffset;
      const deleteTo = mappedPagePos + pageNode.nodeSize - 1; // exclusive: keeps closing token

      // Record next-page position before we mutate tr, then remap it after.
      const nextPageAbsPos = mappedPagePos + pageNode.nodeSize;
      tr.delete(deleteFrom, deleteTo);
      changed = true;

      // ── Step 2: insert into the next page (or create one) ───────────────
      const mappedNextPos = tr.mapping.map(nextPageAbsPos);
      const nextPageNode = tr.doc.nodeAt(mappedNextPos);
      if (nextPageNode && nextPageNode.type.name === "page") {
        // Prepend at the start of the existing next page.
        tr.insert(mappedNextPos + 1, nodesToMove);
      } else {
        // Create a new page containing the overflowed blocks.
        const pageType = state.schema.nodes["page"];
        tr.insert(mappedNextPos, pageType.create(null, nodesToMove));
      }
    }

    if (changed) {
      tr.setMeta("pagination", true);
      editor.view.dispatch(tr);
      this.syncPageCount();
    }
  }

  // ─── Reconciliation: pull blocks back up during idle ────────────────────

  private runReconciliation(): void {
    const editor = this.editor;
    if (!editor) return;

    useScriptForgeStore.getState().setPaginationStatus("reconciling");

    const { state } = editor;
    const tr = state.tr;
    let changed = false;
    const pages = this.sortedPages();

    for (let pi = 0; pi < pages.length - 1; pi++) {
      const { contentEl: p1El, pagePos: p1OrigPos } = pages[pi];
      const { contentEl: p2El } = pages[pi + 1];

      // p2's DOM is accurate at reconciliation time (idle, DOM settled).
      // Descend past Tiptap's contentDOMElement wrapper to the actual blocks.
      const p2PmContent = p2El.firstElementChild;
      if (!p2PmContent) continue;
      const p2Children = Array.from(p2PmContent.children) as HTMLElement[];
      // p1VirtualHeight tracks P1's height as we speculatively add blocks.
      let p1VirtualHeight = p1El.getBoundingClientRect().height;
      // CSS margin-bottom of the last child collapses through the parent when
      // there is no border/padding-bottom, so it is excluded from the measured
      // height. Add it back so we don't move blocks that will immediately overflow.
      const p1PmContent = p1El.firstElementChild;
      const p1LastChild = p1PmContent?.lastElementChild as HTMLElement | null;
      if (p1LastChild) {
        p1VirtualHeight += parseFloat(getComputedStyle(p1LastChild).marginBottom) || 0;
      }
      let p2Consumed = 0; // how many of p2's blocks have been virtually moved

      while (p2Consumed < p2Children.length) {
        const block = p2Children[p2Consumed];
        // The candidate becomes P1's last child, so its margin-bottom will
        // collapse — check height only (not height + margin).
        const blockHeight = block.getBoundingClientRect().height;
        if (p1VirtualHeight + blockHeight > this.contentHeightPx) break;

        // Re-resolve positions through tr's accumulated mapping each iteration.
        const mappedP1Pos = tr.mapping.map(p1OrigPos);
        const p1Now = tr.doc.nodeAt(mappedP1Pos);
        if (!p1Now || p1Now.type.name !== "page") break;

        const p2StartPos = mappedP1Pos + p1Now.nodeSize;
        const p2Now = tr.doc.nodeAt(p2StartPos);
        if (!p2Now || p2Now.type.name !== "page" || p2Now.childCount === 0) break;

        const blockToMove = p2Now.child(0);

        // Insert at end of P1 first — P1 is before P2 in the document, so
        // inserting here does NOT shift P2's position backwards (it shifts it
        // forwards). We then remap p2StartPos through tr.mapping for the delete.
        const p1EndInsert = mappedP1Pos + p1Now.nodeSize - 1; // just before P1 close
        tr.insert(p1EndInsert, blockToMove);

        const mappedP2Pos = tr.mapping.map(p2StartPos);
        tr.delete(mappedP2Pos + 1, mappedP2Pos + 1 + blockToMove.nodeSize);

        // Block is no longer P1's last child — its margin-bottom now contributes
        // to layout spacing, so include it in the running height tally.
        p1VirtualHeight += blockHeight + (parseFloat(getComputedStyle(block).marginBottom) || 0);
        p2Consumed++;
        changed = true;
      }
    }

    // Remove the trailing empty page if reconciliation left one (never remove
    // the sole remaining page).
    if (pages.length > 1) {
      const last = pages[pages.length - 1];
      const mappedLastPos = tr.mapping.map(last.pagePos);
      const lastNode = tr.doc.nodeAt(mappedLastPos);
      if (lastNode && lastNode.type.name === "page" && lastNode.childCount === 0) {
        tr.delete(mappedLastPos, mappedLastPos + lastNode.nodeSize);
        changed = true;
      }
    }

    if (changed) {
      tr.setMeta("pagination", true);
      editor.view.dispatch(tr);
      this.syncPageCount();
    }

    useScriptForgeStore.getState().setPaginationStatus("idle");
  }

  private syncPageCount(): void {
    if (!this.editor) return;
    let count = 0;
    this.editor.state.doc.forEach((node) => {
      if (node.type.name === "page") count++;
    });
    useScriptForgeStore.getState().setPageCount(count);
  }

  destroy(): void {
    this.destroyed = true;
    this.ro.disconnect();
    if (this.reconcileTimer !== null) clearTimeout(this.reconcileTimer);
  }
}
