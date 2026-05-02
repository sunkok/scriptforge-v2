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

## ENTER — "Continue forward, default next thing"

| In | Pressing Enter creates |
|---|---|
| Scene Heading | Action |
| Action (with text) | Action (continue describing) |
| Action (empty) | Character (smart default — starting a dialogue exchange) |
| Character (with text) | Dialogue |
| Character (empty) | Action (back out to description) |
| Parenthetical | Dialogue |
| Dialogue | Action |
| Transition | Scene Heading |

## TAB — "Jump to most likely next element"

| In | Pressing Tab jumps to |
|---|---|
| Scene Heading | Action |
| Action | Character |
| Character | Parenthetical |
| Parenthetical | Dialogue |
| Dialogue | Character (next speaker, same scene) |
| Transition | Scene Heading |

## SHIFT+TAB — "Jump backward to likely previous element"

| In | Pressing Shift+Tab jumps to |
|---|---|
| Scene Heading | Transition |
| Action | Scene Heading |
| Character | Action |
| Parenthetical | Character |
| Dialogue | Parenthetical (if non-empty parenthetical exists immediately above in the same block), else Character |
| Transition | Dialogue |

## Cmd+1 through Cmd+6 — Direct selection

Same as before — pressing Cmd+N converts the current line to that element type regardless of context.

- Cmd+1: Scene Heading
- Cmd+2: Action
- Cmd+3: Character
- Cmd+4: Dialogue
- Cmd+5: Parenthetical
- Cmd+6: Transition

## Smart Defaults (additional)

- Empty Action + Enter → Character (starts dialogue exchange)
- Empty Character + Enter → Action (cancels speaker, returns to description)
- Both behaviors trigger only when the line is empty (no text, no whitespace)

## Reasoning Behind Choices

**Why Tab from Action goes to Character (not Scene Heading):** After describing action, the most common next element is a character speaking. New scene headings are less frequent than character cues in scene-heavy screenplays. Tab should optimize for the most common case.

**Why Tab from Character goes to Parenthetical (not Dialogue):** Parenthetical is the rarer-but-relevant option. Enter from Character already goes to Dialogue (the common case). Tab offers the alternative path. This avoids dead-Tab-equivalent-to-Enter redundancy.

**Why Shift+Tab from Dialogue smart-checks for Parenthetical:** Within a single character block (Character → Parenthetical → Dialogue), Shift+Tab from Dialogue should respect the actual structure. If Parenthetical is present, Shift+Tab goes there. If absent, it skips to Character.

## Future: Tutor Mode

When tutor mode is implemented:
- On first launch (or when enabled), show contextual hints based on current element
- E.g., when cursor enters a Character element, briefly show: "Press Enter for dialogue, Tab for parenthetical, Shift+Tab to go back to action"
- Hints appear as small unobtrusive overlays, dismiss after 3 seconds or on any keypress
- Hints disable after the user has made N successful element transitions (learned the system)
- Hints can be re-enabled in settings
