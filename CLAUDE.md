# ScriptForge v2

Browser-based screenwriting tool with **true multi-page architecture** (Final Draft style). v2 replaces v1's simulated page breaks (CSS decorations inside a single Tiptap document) with a proper document model where each page is a first-class ProseMirror node.

---

## Goal

Each screenplay page is a discrete `page` node in the ProseMirror tree. A pagination engine will watch the editor's layout and split/merge page nodes as content overflows. This enables accurate page counts, proper page headers/footers, and clean PDF export.

---

## Stack

| Layer | Package | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| UI | React + TypeScript | 19.2.4 / 5 |
| Styling | Tailwind CSS | 4 |
| Editor | Tiptap | ^3.22.5 |
| Screenplay parser | fountain-js | ^1.2.4 |
| Icons | lucide-react | ^1.14.0 |
| Storage | @aws-sdk/client-s3 + presigner | ^3.1039.0 |
| State | Zustand | ^5 |

---

## Folder conventions

```
src/
  app/
    api/          — Next.js route handlers (S3, share links, etc.)
    editor/       — Main editor route
    print/        — Print/PDF export route
    share/        — Share link viewer route
    layout.tsx    — Root layout (fonts, global CSS)
    page.tsx      — Redirects to /editor
    globals.css   — Tailwind 4 @theme tokens + base styles
  components/
    editor/       — Tiptap extensions, node views, editor shell
  lib/
    pagination/   — Pagination engine (NOT YET IMPLEMENTED)
    fountain/     — Fountain parse/serialize utilities
    s3/           — S3 client and presigned URL helpers
    store/        — Zustand store (index.ts)
```

---

## Key architectural decisions

### Page node schema
- `Document` content overridden to `"page+"`
- `PageNode` is a block-level node with `content: "block+"` and `isolating: true`
- Each page renders as an 816px × 1056px (8.5in × 11in at 96dpi) white sheet with 96px (1in) padding

### Fonts
- **Inter** — UI chrome, loaded via `next/font/google`, CSS var `--font-inter`
- **Courier Prime** — screenplay text, loaded via `next/font/google`, CSS var `--font-courier-prime`
- Do NOT add Google Fonts `@import` URLs to CSS; use the next/font variables only

### Theme
- Calm Studio dark theme: canvas `#0f0f14`, accent `#6366f1` (indigo)
- Design tokens live in `globals.css` under `@theme {}`

---

## HARD CONSTRAINTS

**DO NOT touch pagination logic until explicitly instructed.**

The pagination engine (`src/lib/pagination/`) does not exist yet and must not be scaffolded speculatively. Wait for an explicit prompt before implementing any auto-split/merge behavior, ResizeObserver hooks, or page overflow detection.

Similarly, do not implement:
- Screenplay element types (scene heading, action, character, etc.)
- S3 integration
- Share links
- Annotations
- Version history

…until each is explicitly requested in a follow-up prompt.
