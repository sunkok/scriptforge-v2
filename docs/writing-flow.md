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
| Dialogue | Action |
| Transition | Scene Heading |

Example:
- User types "She walks in." (Action mode), presses Tab
- Same line is now Character mode — content stays, type indicator changes
- Press Tab again → Parenthetical, press Tab again → Dialogue

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
- Tab on any element → relabels current line to target type, content preserved

## Reasoning Behind Choices

**Why Tab from Action relabels to Character:** If you typed action and realize "actually this should be a character cue," Tab relabels it without retyping. Tab cycles forward through the most natural progression.

**Why Tab from Character relabels to Parenthetical:** Enter from Character goes to Dialogue (the common path). Tab offers "wait, I want a parenthetical first" — relabels the character line to Parenthetical. Type the note, then Enter for Dialogue.

**Why Tab from Dialogue goes to Action:** After dialogue, the most common next element is Action (describing what happens next). This breaks the dialogue-cluster loop (Action → Character → Parenthetical → Dialogue → Action → …) so Tab never traps you. For back-and-forth dialogue, use Cmd+3 or type the next character name directly.

**Why Shift+Tab relabels rather than navigates:** Going to a previous existing line is what arrow keys do. Shift+Tab is for fixing the current line's type without retyping its content.

## Future: Tutor Mode

When tutor mode is implemented:
- Show contextual hints based on current element
- E.g., when cursor enters a Character element, briefly show: "Press Enter for dialogue, Tab for parenthetical, Shift+Tab to relabel as action"
- Hints appear as small unobtrusive overlays, dismiss after 3 seconds or on any keypress
- Hints disable after the user has made N successful element transitions (learned the system)
- Hints can be re-enabled in settings
