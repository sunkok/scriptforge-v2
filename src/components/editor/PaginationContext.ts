import { createContext } from "react";
import type { PaginationEngine } from "@/lib/pagination/engine";

/**
 * Provides the PaginationEngine instance to all PageNodeViews rendered
 * inside the editor. Null until the editor's onCreate fires.
 */
export const PaginationEngineContext = createContext<PaginationEngine | null>(null);
