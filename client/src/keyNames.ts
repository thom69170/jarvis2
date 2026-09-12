/**
 * Maps browser KeyboardEvent.code values to the key names used by
 * node-global-key-listener (see tools/ptt-listener), so a combo recorded
 * here in the browser is understood by that native helper. Only covers keys
 * sensible for a push-to-talk combo (modifiers, letters, digits, F-keys...).
 */
const CODE_TO_GKL: Record<string, string> = {
  ControlLeft: "LEFT CTRL",
  ControlRight: "RIGHT CTRL",
  ShiftLeft: "LEFT SHIFT",
  ShiftRight: "RIGHT SHIFT",
  AltLeft: "LEFT ALT",
  AltRight: "RIGHT ALT",
  MetaLeft: "LEFT META",
  MetaRight: "RIGHT META",
  Space: "SPACE",
  CapsLock: "CAPS LOCK",
  Tab: "TAB",
  Escape: "ESCAPE",
  Backspace: "BACKSPACE",
  Enter: "RETURN",
  ArrowLeft: "LEFT ARROW",
  ArrowRight: "RIGHT ARROW",
  ArrowUp: "UP ARROW",
  ArrowDown: "DOWN ARROW",
  Insert: "INS",
  Delete: "DELETE",
  Home: "HOME",
  End: "END",
  PageUp: "PAGE UP",
  PageDown: "PAGE DOWN",
  Semicolon: "SEMICOLON",
  Equal: "EQUALS",
  Comma: "COMMA",
  Minus: "MINUS",
  Period: "DOT",
  Slash: "FORWARD SLASH",
  Backslash: "BACKSLASH",
  BracketLeft: "SQUARE BRACKET OPEN",
  BracketRight: "SQUARE BRACKET CLOSE",
  Quote: "QUOTE",
  Backquote: "BACKTICK",
};

for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i);
  CODE_TO_GKL[`Key${letter}`] = letter;
}
for (let i = 0; i <= 9; i++) {
  CODE_TO_GKL[`Digit${i}`] = String(i);
}
for (let i = 1; i <= 24; i++) {
  CODE_TO_GKL[`F${i}`] = `F${i}`;
}

/** Converts a KeyboardEvent.code to its GKL name, or null if unsupported for a combo. */
export function codeToGklName(code: string): string | null {
  return CODE_TO_GKL[code] ?? null;
}

/** Human-readable rendering of a combo, e.g. ["LEFT CTRL", "J"] -> "Ctrl gauche + J". */
const GKL_DISPLAY_OVERRIDES: Record<string, string> = {
  "LEFT CTRL": "Ctrl gauche",
  "RIGHT CTRL": "Ctrl droite",
  "LEFT SHIFT": "Maj gauche",
  "RIGHT SHIFT": "Maj droite",
  "LEFT ALT": "Alt gauche",
  "RIGHT ALT": "Alt droite",
  "LEFT META": "Windows gauche",
  "RIGHT META": "Windows droite",
};

export function formatCombo(combo: string[]): string {
  if (combo.length === 0) return "Aucune combinaison définie";
  return combo.map((k) => GKL_DISPLAY_OVERRIDES[k] ?? k).join(" + ");
}
