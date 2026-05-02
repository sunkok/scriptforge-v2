# ScriptForge Writing Flow

This document defines how Tab, Shift+Tab, and Enter behave across the 6 screenplay element types. Reference for current implementation and future tutor mode.

## Philosophy

The editor should read the writer's mind. Tab and Enter follow the most common screenwriting patterns so writers rarely press them more than once for the element they actually want next.

Industry reference: Final Draft, Highland, Arc Studio Pro all use intelligent next-element prediction rather than dumb cycling.

## Element Types

1. Scene Heading — INT./EXT. LOCATION - TIME
2. Action — descriptive prose
3. Character — speaker name (uppercase, indented)
4. Parenthetical — (action note, whispered, etc.) before dialogue
5. Dialogue — what the character says
6. Transition — CUT TO:, FADE OUT., etc.

## Key Distinction: Tab vs Shift+Tab

- **Tab** = "I'm done here, create a NEW LINE below for the next likely element"
- **Shift+Tab** = "Wait, this CURRENT line should actually be a different type" — relabel current line in place
- **Enter** = "I'm done here, create a NEW LINE below for default-next-thing"

Tab and Enter both create new lines. The difference: Enter goes to the most-conventional next element. Tab goes to the most-likely-but-context-aware-alternative element.

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

## TAB — Create new line for likely next element (creates new line)

| In | Pressing Tab creates new line as |
|---|---|
| Scene Heading | Action |
| Action | Character |
| Character | Parenthetical |
| Parenthetical | Dialogue |
| Dialogue | Character (next speaker, same scene) |
| Transition | Scene Heading |

Example:
- User types "JOHN" (Character mode), presses Tab
- New line below appears in Parenthetical mode (already showing "()" with cursor between parens)
- User types "whispered", presses Enter
- New line below in Dialogue mode for John's actual line

## SHIFT+TAB — Relabel current line (no new line)

| In | Shift+Tab changes current line to |
|---|---|
| Scene Heading | Transition |
| Action | Scene Heading |
| Character | Action |
| Parenthetical | Character |
| Dialogue | Character |
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
- Tab on Character → creates new Parenthetical line, cursor between auto-inserted "()"
- Tab on any other element → creates new line of target type, cursor at start

## Reasoning Behind Choices

**Why Tab from Action creates a new Character line:** After describing action, the most common next element is a character speaking. Enter on Action continues Action. Tab on Action says "done with action, someone's about to speak."

**Why Tab from Character creates a new Parenthetical line:** Enter from Character already goes to Dialogue (the common case). Tab offers the alternative parenthetical path. The new Parenthetical line is pre-filled with "()" and cursor between, ready for typing.

**Why Shift+Tab relabels rather than navigates:** Going to a previous existing line is what arrow keys do. Shift+Tab is for fixing the current line's type without retyping its content.

## Future: Tutor Mode

When tutor mode is implemented:
- Show contextual hints based on current element
- E.g., when cursor enters a Character element, briefly show: "Press Enter for dialogue, Tab for parenthetical, Shift+Tab to relabel as action"
- Hints appear as small unobtrusive overlays, dismiss after 3 seconds or on any keypress
- Hints disable after the user has made N successful element transitions (learned the system)
- Hints can be re-enabled in settings
