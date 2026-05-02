"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

export default function PageNodeView() {
  return (
    <NodeViewWrapper>
      <div className="page-sheet">
        <NodeViewContent className="page-content" />
      </div>
    </NodeViewWrapper>
  );
}
