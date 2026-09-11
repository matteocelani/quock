// LaTeX to readable Unicode for the chat surface. No typesetting engine — that would be a new dependency — so we
// translate the commands models actually emit and leave anything unknown visible as source rather than guessing.

export interface MathSegment {
  text: string;
  // KaTeX (and every big chat client) italicises single-letter variables and leaves numbers, operators and words
  // upright. Real font italic, not the Unicode math-italic block, which is missing from many Android system fonts.
  isVariable: boolean;
}

const SYMBOLS: Record<string, string> = {
  times: "×",
  cdot: "·",
  div: "÷",
  pm: "±",
  mp: "∓",
  neq: "≠",
  ne: "≠",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  ll: "≪",
  gg: "≫",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  propto: "∝",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  Rightarrow: "⟹",
  implies: "⟹",
  Leftarrow: "⟸",
  iff: "⟺",
  mapsto: "↦",
  infty: "∞",
  sum: "∑",
  prod: "∏",
  int: "∫",
  iint: "∬",
  oint: "∮",
  partial: "∂",
  nabla: "∇",
  forall: "∀",
  exists: "∃",
  nexists: "∄",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  varnothing: "∅",
  land: "∧",
  lor: "∨",
  neg: "¬",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
  degree: "°",
  circ: "∘",
  star: "⋆",
  bullet: "∙",
  oplus: "⊕",
  otimes: "⊗",
  dots: "…",
  ldots: "…",
  cdots: "⋯",
  vdots: "⋮",
  ddots: "⋱",
  prime: "′",
  checkmark: "✓",
  therefore: "∴",
  because: "∵",
  cong: "≅",
  simeq: "≃",
  lt: "<",
  gt: ">",
  mid: "|",
  nmid: "∤",
  setminus: "\\",
  ast: "∗",
  dagger: "†",
  square: "□",
  blacksquare: "■",
  triangle: "△",
  Leftrightarrow: "⟺",
  longrightarrow: "⟶",
  Longrightarrow: "⟹",
  longleftarrow: "⟵",
  uparrow: "↑",
  downarrow: "↓",
  vee: "∨",
  wedge: "∧",
  odot: "⊙",
  oslash: "⊘",
  top: "⊤",
  bot: "⊥",
  lfloor: "⌊",
  rfloor: "⌋",
  lceil: "⌈",
  rceil: "⌉",
  langle: "⟨",
  rangle: "⟩",
  hbar: "ℏ",
  ell: "ℓ",
  aleph: "ℵ",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
};

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
  // `90^\circ` is how a model writes an angle, and the degree sign is the glyph it means.
  "∘": "°",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

// Commands that only dress their argument: the body is kept and the wrapper disappears. An accent we cannot draw is
// better dropped than shown as `\vec` in front of the letter it belongs to.
const TRANSPARENT_WRAPPERS = new Set([
  "text",
  "textrm",
  "textbf",
  "textit",
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathbb",
  "mathcal",
  "operatorname",
  "vec",
  "hat",
  "bar",
  "overline",
  "underline",
  "tilde",
  "boldsymbol",
  "boxed",
  "overrightarrow",
  "widehat",
  "widetilde",
  "mathfrak",
  "mathscr",
]);
// Typesetting directives with nothing to show: they size the formula, they are not part of it.
const NO_OPS = new Set([
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "scriptscriptstyle",
  "limits",
  "nolimits",
  "notag",
  "nonumber",
]);
// Function names set upright in every typesetter; the backslash is notation, the word is the content.
const FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "log",
  "ln",
  "exp",
  "lim",
  "max",
  "min",
  "sup",
  "inf",
  "det",
  "dim",
  "deg",
  "arg",
  "gcd",
  "mod",
]);
// Spacing commands collapse to a single space; `\!` is negative space, so it collapses to nothing.
const SPACERS: Record<string, string> = {
  quad: " ",
  qquad: " ",
  ",": " ",
  ";": " ",
  ":": " ",
  " ": " ",
  "!": "",
};
// Escapes that stand for the literal character.
const ESCAPED_LITERALS = new Set([
  "{",
  "}",
  "$",
  "%",
  "&",
  "#",
  "_",
  "(",
  ")",
  "[",
  "]",
]);

// Own keys only: `\toString` is a command name a model could emit, and a plain index would hand back a function.
function lookup(table: Record<string, string>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : undefined;
}

// Reads the balanced `{...}` group starting at `open`, so a nested \frac inside a numerator survives intact.
function readGroup(
  input: string,
  open: number,
): { body: string; end: number } | null {
  if (input[open] !== "{") return null;
  let depth = 0;
  for (let i = open; i < input.length; i += 1) {
    if (input[i] === "{") depth += 1;
    else if (input[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: input.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}
// Reads the argument of a command: a braced group, a whole command when the argument is one (`^\infty` is a single
// argument, not a lone backslash), or the character that follows.
function readArgument(
  input: string,
  at: number,
): { body: string; end: number } | null {
  const group = readGroup(input, at);
  if (group) return group;
  const command = /^\\[A-Za-z]+/.exec(input.slice(at))?.[0];
  if (command !== undefined) {
    return { body: command, end: at + command.length };
  }
  const char = input[at];
  if (char === undefined || char === " ") return null;
  return { body: char, end: at + 1 };
}
// A fraction part only needs parentheses when it is more than a bare number, identifier or single symbol.
function wrapPart(part: string): string {
  if ([...part].length <= 1) return part;
  return /^[A-Za-z0-9.]+$/.test(part) ? part : `(${part})`;
}
// Maps a script body to its Unicode tier, or null when a single character has no equivalent — better a literal
// `^(n+1)` than a half-raised expression.
function toScript(body: string, table: Record<string, string>): string | null {
  let out = "";
  for (const char of body) {
    const mapped = lookup(table, char);
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

function transform(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (char === "\\") {
      const name = /^[A-Za-z]+/.exec(input.slice(i + 1))?.[0];
      if (name === undefined) {
        const next = input[i + 1];
        if (next === "\\") {
          out += "\n";
          i += 2;
          continue;
        }
        const spacer = next === undefined ? undefined : lookup(SPACERS, next);
        if (spacer !== undefined) {
          out += spacer;
          i += 2;
          continue;
        }
        if (next !== undefined && ESCAPED_LITERALS.has(next)) {
          out += next;
          i += 2;
          continue;
        }
        out += char;
        i += 1;
        continue;
      }
      const after = i + 1 + name.length;
      // An environment wrapper carries no content of its own: drop the command and the {name} that follows it.
      if (name === "begin" || name === "end") {
        const group = readGroup(input, after);
        i = group ? group.end : after;
        continue;
      }
      if (TRANSPARENT_WRAPPERS.has(name)) {
        const group = readGroup(input, after);
        if (group) {
          out += transform(group.body);
          i = group.end;
          continue;
        }
      }
      if (FUNCTIONS.has(name)) {
        out += name;
        i = after;
        continue;
      }
      if (NO_OPS.has(name)) {
        i = after;
        continue;
      }
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const numerator = readArgument(input, after);
        const denominator = numerator ? readArgument(input, numerator.end) : null;
        if (numerator && denominator) {
          out += `${wrapPart(transform(numerator.body))}/${wrapPart(transform(denominator.body))}`;
          i = denominator.end;
          continue;
        }
      }
      if (name === "sqrt") {
        const argument = readArgument(input, after);
        if (argument) {
          out += `√${wrapPart(transform(argument.body))}`;
          i = argument.end;
          continue;
        }
      }
      // \left and \right only size the delimiter that follows, which the normal path emits on its own.
      if (name === "left" || name === "right") {
        i = after;
        continue;
      }
      const namedSpacer = lookup(SPACERS, name);
      if (namedSpacer !== undefined) {
        out += namedSpacer;
        i = after;
        continue;
      }
      const symbol = lookup(SYMBOLS, name);
      if (symbol !== undefined) {
        out += symbol;
        i = after;
        continue;
      }
      // Unknown command: keep it as written. A stripped backslash would read as a word the model never wrote.
      out += `\\${name}`;
      i = after;
      continue;
    }
    if (char === "^" || char === "_") {
      const argument = readArgument(input, i + 1);
      if (argument) {
        const body = transform(argument.body);
        const scripted = toScript(
          body,
          char === "^" ? SUPERSCRIPT : SUBSCRIPT,
        );
        out += scripted ?? `${char}${wrapPart(body)}`;
        i = argument.end;
        continue;
      }
    }
    // Alignment markers separate columns of a cases/aligned row; a space is all they mean once stacked as text.
    if (char === "&") {
      out += " ";
      i += 1;
      continue;
    }
    // Bare braces group the source, they are not content.
    if (char === "{" || char === "}") {
      i += 1;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}
// Collapses the whitespace the command translation leaves behind, per line so a cases block keeps its rows.
function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// Greek included: \alpha and friends land here as real letters and are variables like any other.
const LETTER = /[A-Za-zͰ-Ͽ]/;
// Capital Greek is set upright by every math font — \Delta is a constant's name, not a variable.
const UPPERCASE_GREEK = /[Α-Ω]/;

/** Readable text for a LaTeX span, split so single-letter variables can render italic. */
export function mathToSegments(latex: string): MathSegment[] {
  const text = tidy(transform(latex));
  const segments: MathSegment[] = [];
  let i = 0;
  while (i < text.length) {
    let end = i;
    const isLetterRun = LETTER.test(text[i]);
    while (end < text.length && LETTER.test(text[end]) === isLetterRun) {
      end += 1;
    }
    const run = text.slice(i, end);
    // A run of one letter is a variable; `sin`, `max` and words lifted out of \text stay upright.
    const isVariable =
      isLetterRun && run.length === 1 && !UPPERCASE_GREEK.test(run);
    const previous = segments[segments.length - 1];
    if (previous && previous.isVariable === isVariable) previous.text += run;
    else segments.push({ text: run, isVariable });
    i = end;
  }
  return segments;
}

/** Same translation as the rendered form, for copy, select-text and excerpts. */
export function mathToPlainText(latex: string): string {
  return tidy(transform(latex));
}
