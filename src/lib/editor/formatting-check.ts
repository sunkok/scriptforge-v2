export type FormattingIssue = {
  message: string;
  fix: string;
};

const SCENE_PREFIXES = ["INT.", "EXT.", "INT./EXT.", "I/E."];

export function checkElementFormatting(
  elementTypeName: string,
  text: string
): FormattingIssue | null {
  switch (elementTypeName) {
    case "scene_heading": {
      const upper = text.toUpperCase();
      const hasPrefix = SCENE_PREFIXES.some((p) => upper.startsWith(p));
      if (!hasPrefix) {
        let fix = text;
        const lower = text.toLowerCase();
        if (lower.startsWith("int ")) fix = "INT. " + text.slice(4);
        else if (lower.startsWith("ext ")) fix = "EXT. " + text.slice(4);
        return {
          message: "Scene heading should start with INT. or EXT.",
          fix,
        };
      }
      return null;
    }

    case "parenthetical": {
      const trimmed = text.trim();
      if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
        const inner = trimmed.replace(/^\(/, "").replace(/\)$/, "");
        return {
          message: "Parenthetical should be wrapped in parentheses",
          fix: `(${inner})`,
        };
      }
      return null;
    }

    case "transition": {
      const trimmed = text.trim();
      if (!trimmed.endsWith(":") && !trimmed.endsWith(".")) {
        return {
          message: "Transition should end with ':' or '.'",
          fix: trimmed + ":",
        };
      }
      return null;
    }

    default:
      return null;
  }
}
