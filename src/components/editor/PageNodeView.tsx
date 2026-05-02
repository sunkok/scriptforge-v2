"use client";

import { useContext, useEffect, useRef } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { PaginationEngineContext } from "./PaginationContext";

export default function PageNodeView({ getPos }: NodeViewProps) {
  const engine = useContext(PaginationEngineContext);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Keep a stable ref to getPos so the registration effect doesn't re-run
  // every time Tiptap refreshes the prop.
  const getPosRef = useRef(getPos);
  useEffect(() => {
    getPosRef.current = getPos;
  }, [getPos]);

  useEffect(() => {
    if (!engine || !sheetRef.current) return;
    // NodeViewContent renders as the .page-content div inside the sheet.
    const contentEl = sheetRef.current.querySelector(".page-content");
    if (!contentEl) return;
    engine.register(contentEl, () => getPosRef.current());
    return () => engine.unregister(contentEl);
  }, [engine]);

  return (
    <NodeViewWrapper>
      <div ref={sheetRef} className="page-sheet">
        <NodeViewContent className="page-content" />
      </div>
    </NodeViewWrapper>
  );
}
