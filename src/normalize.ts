import type { FenceInfo, KnownKey, NormalizedMeta, NormalizeOptions, Scalar } from "./types.ts";

const CH_TAB = 9;
const CH_CR = 13;
const CH_SPACE = 32;
const CH_DASH = 45;
const CH_0 = 48;

const compareAsc = (a: number, b: number): number => a - b;

function coerceBool(val: Scalar): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  const len = val.length;
  if (len === 0 || len === 4 || len > 5) return true;
  if (len === 1) return val !== "0";
  const lc = val.toLowerCase();
  return lc !== "false" && lc !== "no" && lc !== "off";
}

function isTrimWs(ch: number): boolean {
  return (
    ch === CH_SPACE ||
    (ch >= CH_TAB && ch <= CH_CR) ||
    (ch > 127 &&
      (ch === 0x00a0 ||
        ch === 0x1680 ||
        (ch >= 0x2000 && ch <= 0x200a) ||
        ch === 0x2028 ||
        ch === 0x2029 ||
        ch === 0x202f ||
        ch === 0x205f ||
        ch === 0x3000 ||
        ch === 0xfeff))
  );
}

export function parseLineSpec(v: Scalar): number[] {
  if (typeof v === "number") {
    return Number.isFinite(v) ? [Math.trunc(v)] : [];
  }
  if (typeof v !== "string" || v.length === 0) return [];

  const len = v.length;
  let set: Set<number> | null = null;
  let pos = 0;

  while (pos < len) {
    let comma = v.indexOf(",", pos);
    if (comma === -1) comma = len;

    let i = pos;
    let end = comma;
    pos = comma + 1;

    while (i < end && isTrimWs(v.charCodeAt(i))) i++;
    while (end > i && isTrimWs(v.charCodeAt(end - 1))) end--;
    if (i >= end) continue;

    let d = v.charCodeAt(i) - CH_0;
    if (d < 0 || d > 9) continue;
    let startLine = d;
    i++;
    while (i < end) {
      d = v.charCodeAt(i) - CH_0;
      if (d < 0 || d > 9) break;
      startLine = startLine * 10 + d;
      i++;
    }

    while (i < end && isTrimWs(v.charCodeAt(i))) i++;

    if (i === end) {
      if (Number.isFinite(startLine)) {
        set ??= new Set<number>();
        set.add(startLine);
      }
      continue;
    }

    if (v.charCodeAt(i) !== CH_DASH) continue;
    i++;
    while (i < end && isTrimWs(v.charCodeAt(i))) i++;
    if (i >= end) continue;

    d = v.charCodeAt(i) - CH_0;
    if (d < 0 || d > 9) continue;
    let endLine = d;
    i++;
    while (i < end) {
      d = v.charCodeAt(i) - CH_0;
      if (d < 0 || d > 9) break;
      endLine = endLine * 10 + d;
      i++;
    }

    if (i !== end || !Number.isFinite(startLine) || !Number.isFinite(endLine)) continue;

    if (startLine > endLine) {
      const tmp = startLine;
      startLine = endLine;
      endLine = tmp;
    }

    set ??= new Set<number>();
    for (let k = startLine; k <= endLine; k++) set.add(k);
  }

  if (set === null || set.size === 0) return [];
  const res = Array.from(set);
  if (res.length > 1) res.sort(compareAsc);
  return res;
}

const KNOWN_KEYS: readonly KnownKey[] = [
  "title",
  "filename",
  "lineNumbers",
  "pinned",
  "collapsed",
];

const DEFAULT_KEYMAP = {
  title: ["title"],
  filename: ["filename", "file", "name"],
  lineNumbers: ["linenumbers", "line-numbers", "linenos"],
  pinned: ["pinned"],
  collapsed: ["collapsed"],
} satisfies Record<KnownKey, string[]>;

const DEFAULT_CANONICAL_MAP = new Map<string, KnownKey>();
for (const k of KNOWN_KEYS) {
  const aliases = DEFAULT_KEYMAP[k];
  for (const alias of aliases) {
    DEFAULT_CANONICAL_MAP.set(alias.toLowerCase(), k);
  }
}

export function normalize(meta: FenceInfo, options?: NormalizeOptions): NormalizedMeta {
  const lowercaseKeys = options?.lowercaseKeys ?? true;
  const mergeHighlightAttr = options?.mergeHighlightAttr ?? true;

  let canonical = DEFAULT_CANONICAL_MAP;
  const customKeyMap = options?.keyMap;
  if (customKeyMap !== undefined) {
    canonical = new Map<string, KnownKey>();
    for (const k of KNOWN_KEYS) {
      const aliases = customKeyMap[k] ?? DEFAULT_KEYMAP[k];
      for (const alias of aliases) {
        canonical.set(alias.toLowerCase(), k);
      }
    }
  }

  const out: NormalizedMeta = {
    highlight: meta.highlight.length > 0 ? meta.highlight.slice() : [],
    attrs: {},
  };
  if (meta.lang) out.lang = meta.lang;

  let extraHighlight: number[] | null = null;
  const attrs = meta.attrs;
  for (const rawKey in attrs) {
    const val = attrs[rawKey];
    if (val === undefined) continue;

    const lcKey = rawKey.toLowerCase();
    if (mergeHighlightAttr && (lcKey === "highlight" || lcKey === "lines" || lcKey === "hl")) {
      extraHighlight = parseLineSpec(val);
      continue;
    }

    const canon = canonical.get(lcKey);
    if (canon !== undefined) {
      if (canon === "lineNumbers") {
        out.lineNumbers = coerceBool(val);
      } else if (canon === "title" || canon === "filename") {
        out[canon] = typeof val === "string" ? val : String(val);
      } else {
        out[canon] = coerceBool(val);
      }
      continue;
    }

    out.attrs[lowercaseKeys ? lcKey : rawKey] = val;
  }

  if (extraHighlight !== null && extraHighlight.length > 0) {
    if (out.highlight.length === 0) {
      out.highlight = extraHighlight;
    } else {
      const set = new Set<number>(out.highlight);
      for (const x of extraHighlight) set.add(x);
      out.highlight = Array.from(set).sort(compareAsc);
    }
  }

  return out;
}
