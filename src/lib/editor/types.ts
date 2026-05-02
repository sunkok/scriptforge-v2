export type ElementType =
  | "scene_heading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition";

export const ELEMENT_CYCLE: ElementType[] = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
];

export const ELEMENT_DISPLAY_NAMES: Record<ElementType, string> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
};

export function isElementType(name: string): name is ElementType {
  return ELEMENT_CYCLE.includes(name as ElementType);
}
