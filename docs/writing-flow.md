# ScriptForge Writing Flow

This document defines how Tab, Shift+Tab, and Enter behave across the 6 screenplay element types. Reference for current implementation and future tutor mode.

## Philosophy

Tab cycles through all 6 element types in natural screenplay order. Predictable and complete — every element reachable, no routing surprises. For direct selection, use Cmd+1..6.

Enter follows smart defaults for the most common next-element after each type.

## Element Types

1. Scene Heading — INT./EXT. LOCATION - TIME
2. Action — descriptive prose
3. Character — speaker name (uppercase, indented)
4. Parenthetical — (action note, whispered, etc.) before dialogue
5. Dialogue — what the character says
6. Transition — CUT TO:, FADE OUT., etc.

## Key Distinction: Tab vs Shift+Tab vs Enter

- **Tab** = "This CURRENT line should be a different type" — relabel current line forward in the cycle
- **Shift+Tab** = "This CURRENT line should be a different type" — relabel current line backward to an alternative
- **Enter** = "I'm done here, create a NEW LINE below for the default next element"

Tab and Shift+Tab both relabel the current line in place (content preserved, cursor stays). Enter is the only key that creates a new line.

## ENTER — Continue forward (creates new line)

| In | Pressing Enter creates new line as |
|---|---|
| Scene Heading | Action |
| Action (with text) | Action (continue describing) |
| Action (empty) | Character (smart default — convert empty Action to Character on same line) |
| Character (with text) | Dialogue |
| Character (empty) | Action (cancel — convert empty Character to Action on same line) |
| Parenthetical | Dialogue |
| Dialogue | Action |
| Transition | Scene Heading |

Note: empty Action/Character cases CONVERT the current line (no new line created), since user clearly didn't want that type.

## TAB — Relabel current line (no new line)

| In | Pressing Tab relabels current line to |
|---|---|
| Scene Heading | Action |
| Action | Character |
| Character | Parenthetical |
| Parenthetical | Dialogue |
| Dialogue | Transition |
| Transition | Scene Heading |

Full cycle: Scene Heading → Action → Character → Parenthetical → Dialogue → Transition → Scene Heading (repeats)

Example:
- Press Tab 6 times in a row → returns to the starting element type

## SHIFT+TAB — Relabel current line (no new line)

| In | Shift+Tab changes current line to |
|---|---|
| Scene Heading | Transition |
| Action | Scene Heading |
| Character | Action |
| Parenthetical | Character |
| Dialogue | Parenthetical |
| Transition | Dialogue |

This is for when you realize "this line shouldn't be this type, let me fix it."

## Cmd+1 through Cmd+6 — Direct selection (relabels current line)

- Cmd+1: Scene Heading
- Cmd+2: Action
- Cmd+3: Character
- Cmd+4: Dialogue
- Cmd+5: Parenthetical
- Cmd+6: Transition

Same as Shift+Tab in spirit — relabels current line to a specific type.

## Smart Defaults

- Empty Action + Enter → converts current line to Character (no new line)
- Empty Character + Enter → converts current line to Action (no new line)
- Tab on any element → relabels current line to target type, content preserved

## Reasoning Behind Choices

**Why Tab cycles in screenplay order:** Scene Heading → Action → Character → Parenthetical → Dialogue → Transition mirrors the natural top-to-bottom structure of a screenplay page. The order is predictable because it matches how elements appear on screen, so muscle memory develops quickly.

**Why not smart routing:** Context-aware routing creates unreachable elements and surprises. A complete cycle means Tab always works the same way regardless of what the writer is doing — less cognitive load.

**Why Shift+Tab relabels rather than navigates:** Going to a previous existing line is what arrow keys do. Shift+Tab is for fixing the current line's type without retyping its content.

## Future: Tutor Mode

When tutor mode is implemented:
- Show contextual hints based on current element
- E.g., when cursor enters a Character element, briefly show: "Press Enter for dialogue, Tab for parenthetical, Shift+Tab to relabel as action"
- Hints appear as small unobtrusive overlays, dismiss after 3 seconds or on any keypress
- Hints disable after the user has made N successful element transitions (learned the system)
- Hints can be re-enabled in settings
