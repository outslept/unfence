export { normalize, parseLineSpec } from "./normalize.js";
export type {
  FenceBlock,
  FenceInfo,
  KnownKey,
  NormalizedMeta,
  NormalizeOptions,
  ParseOptions,
  Scalar,
} from "./types.js";

import type { FenceBlock, FenceInfo, ParseOptions, Scalar } from "./types.js";

const CH_TAB = 9;
const CH_LF = 10;
const CH_CR = 13;
const CH_SPACE = 32;
const CH_DQUOTE = 34;
const CH_SQUOTE = 39;
const CH_COMMA = 44;
const CH_DASH = 45;
const CH_DOT = 46;
const CH_0 = 48;
const CH_9 = 57;
const CH_EQ = 61;
const CH_BACKSLASH = 92;
const CH_BACKTICK = 96;
const CH_N = 110;
const CH_R = 114;
const CH_T = 116;
const CH_LBRACE = 123;
const CH_RBRACE = 125;
const CH_TILDE = 126;

const CHAR_SPACE = 1;
const CHAR_BARE_STOP = 2;
const CHAR_TABLE = new Uint8Array(128);
CHAR_TABLE[CH_SPACE] = CHAR_SPACE | CHAR_BARE_STOP;
CHAR_TABLE[CH_TAB] = CHAR_SPACE | CHAR_BARE_STOP;
CHAR_TABLE[CH_LF] = CHAR_SPACE | CHAR_BARE_STOP;
CHAR_TABLE[CH_CR] = CHAR_SPACE | CHAR_BARE_STOP;
CHAR_TABLE[CH_EQ] = CHAR_BARE_STOP;
CHAR_TABLE[CH_LBRACE] = CHAR_BARE_STOP;
CHAR_TABLE[CH_RBRACE] = CHAR_BARE_STOP;

const compareAsc = (a: number, b: number): number => a - b;

interface Cursor {
  index: number;
  str: string;
  length: number;
}

function skipWs(cursor: Cursor): void {
  const { str, length } = cursor;
  let i = cursor.index;
  while (i < length) {
    const ch = str.charCodeAt(i);
    if (ch >= 128 || (CHAR_TABLE[ch]! & CHAR_SPACE) === 0) break;
    i++;
  }
  cursor.index = i;
}

function readQuoted(cursor: Cursor, quoteCode: number): string {
  const { str, length } = cursor;
  let i = cursor.index + 1;
  let chunkStart = i;
  let out = "";

  while (i < length) {
    const ch = str.charCodeAt(i);
    if (ch === quoteCode) {
      cursor.index = i + 1;
      return out.length === 0 ? str.slice(chunkStart, i) : out + str.slice(chunkStart, i);
    }
    if (ch === CH_BACKSLASH) {
      if (i > chunkStart) out += str.slice(chunkStart, i);
      i++;
      if (i >= length) {
        cursor.index = i;
        throw new Error("unterminated escape");
      }
      const esc = str.charCodeAt(i++);
      switch (esc) {
        case CH_N:
          out += "\n";
          break;
        case CH_R:
          out += "\r";
          break;
        case CH_T:
          out += "\t";
          break;
        default:
          out += String.fromCharCode(esc);
          break;
      }
      chunkStart = i;
    } else {
      i++;
    }
  }

  cursor.index = i;
  throw new Error("unterminated string");
}

function readBare(cursor: Cursor): string {
  const { str, length } = cursor;
  const start = cursor.index;
  let i = start;
  while (i < length) {
    const ch = str.charCodeAt(i);
    if (ch < 128 && (CHAR_TABLE[ch]! & CHAR_BARE_STOP) !== 0) break;
    i++;
  }
  cursor.index = i;
  return i === start ? "" : str.slice(start, i);
}

function isNumericLiteral(raw: string): boolean {
  const len = raw.length;
  if (len === 0) return false;
  let i = 0;
  let ch = raw.charCodeAt(0);
  if (ch === CH_DASH) {
    if (len === 1) return false;
    i = 1;
    ch = raw.charCodeAt(1);
  }
  if (ch < CH_0 || ch > CH_9) return false;
  i++;
  let sawDot = false;
  for (; i < len; i++) {
    ch = raw.charCodeAt(i);
    if (ch >= CH_0 && ch <= CH_9) continue;
    if (ch === CH_DOT && !sawDot && i + 1 < len) {
      sawDot = true;
      continue;
    }
    return false;
  }
  return true;
}

function coerceBareScalar(raw: string): Scalar {
  const len = raw.length;
  if (len === 4) {
    if (raw === "true" || raw.toLowerCase() === "true") return true;
  } else if (len === 5) {
    if (raw === "false" || raw.toLowerCase() === "false") return false;
  }
  if (isNumericLiteral(raw)) {
    const num = +raw;
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

function expectDigit(cursor: Cursor): number {
  const { str, length } = cursor;
  let i = cursor.index;
  let d = str.charCodeAt(i) - CH_0;
  if (!(d >= 0 && d <= 9)) throw new Error(`expected digit at ${i}`);
  let val = d;
  i++;
  while (i < length) {
    d = str.charCodeAt(i) - CH_0;
    if (d < 0 || d > 9) break;
    val = val * 10 + d;
    i++;
  }
  cursor.index = i;
  return val;
}

function parseHighlightBlock(cursor: Cursor, hl: Set<number>): void {
  const { str, length } = cursor;
  cursor.index++;
  skipWs(cursor);
  let needValue = true;
  while (cursor.index < length) {
    const ch = str.charCodeAt(cursor.index);
    if (ch === CH_RBRACE) {
      cursor.index++;
      return;
    }
    if (ch === CH_COMMA) {
      if (needValue) throw new Error("trailing comma in highlight block");
      cursor.index++;
      skipWs(cursor);
      needValue = true;
      continue;
    }
    const startLine = expectDigit(cursor);
    let endLine = startLine;
    skipWs(cursor);
    if (cursor.index < length && str.charCodeAt(cursor.index) === CH_DASH) {
      cursor.index++;
      skipWs(cursor);
      endLine = expectDigit(cursor);
    }
    const lo = startLine <= endLine ? startLine : endLine;
    const hi = startLine <= endLine ? endLine : startLine;
    for (let k = lo; k <= hi; k++) hl.add(k);
    skipWs(cursor);
    needValue = false;
  }
  throw new Error("unterminated highlight block");
}

function readValue(cursor: Cursor): Scalar {
  skipWs(cursor);
  if (cursor.index < cursor.length) {
    const ch = cursor.str.charCodeAt(cursor.index);
    if (ch === CH_DQUOTE || ch === CH_SQUOTE) {
      return readQuoted(cursor, ch);
    }
  }
  return coerceBareScalar(readBare(cursor));
}

export function parseInfo(info: string, opts?: ParseOptions): FenceInfo {
  const len = info.length;
  if (len === 0) {
    return { attrs: {}, highlight: [] };
  }

  const lowerCaseKeys = opts?.lowerCaseKeys ?? true;
  const treatFirstBareAsLang = opts?.treatFirstBareAsLang ?? true;

  const cursor: Cursor = { index: 0, str: info, length: len };

  let lang: string | undefined;
  const attrs: Record<string, Scalar> = {};
  let hl: Set<number> | null = null;
  let sawBareToken = false;

  skipWs(cursor);
  while (cursor.index < len) {
    if (info.charCodeAt(cursor.index) === CH_LBRACE) {
      hl ??= new Set<number>();
      parseHighlightBlock(cursor, hl);
      skipWs(cursor);
      continue;
    }

    const token = readBare(cursor);
    if (token.length === 0) {
      const ch = info.charCodeAt(cursor.index);
      throw new Error(
        ch === CH_RBRACE
          ? `unexpected '}' at ${cursor.index}`
          : `unexpected '=' at ${cursor.index}`,
      );
    }

    skipWs(cursor);
    if (cursor.index < len && info.charCodeAt(cursor.index) === CH_EQ) {
      cursor.index++;
      const value = readValue(cursor);
      const key = lowerCaseKeys ? token.toLowerCase() : token;
      attrs[key] = value;
      skipWs(cursor);
      continue;
    }

    if (!sawBareToken && treatFirstBareAsLang) {
      lang = token;
    } else {
      const key = lowerCaseKeys ? token.toLowerCase() : token;
      attrs[key] = true;
    }
    sawBareToken = true;
    skipWs(cursor);
  }

  let highlight: number[];
  if (hl === null || hl.size === 0) {
    highlight = [];
  } else {
    highlight = Array.from(hl);
    if (highlight.length > 1) highlight.sort(compareAsc);
  }

  return lang !== undefined ? { attrs, highlight, lang } : { attrs, highlight };
}

const NEEDLE_BACKTICK_3 = "\n```";
const NEEDLE_TILDE_3 = "\n~~~";

export function extractBlocks(md: string): FenceBlock[] {
  const len = md.length;
  const out: FenceBlock[] = [];
  if (len < 7) return out;

  let lineStart = 0;
  while (lineStart < len) {
    let i = lineStart;
    let indent = 0;
    while (i < len && indent < 4) {
      const ch = md.charCodeAt(i);
      if (ch !== CH_SPACE && ch !== CH_TAB) break;
      indent++;
      i++;
    }

    if (indent <= 3 && i + 2 < len) {
      const fch = md.charCodeAt(i);
      if (
        (fch === CH_BACKTICK || fch === CH_TILDE) &&
        md.charCodeAt(i + 1) === fch &&
        md.charCodeAt(i + 2) === fch
      ) {
        const fenceStart = i;
        i += 3;
        while (i < len && md.charCodeAt(i) === fch) i++;
        const fLen = i - fenceStart;

        const openNl = md.indexOf("\n", i);
        if (openNl === -1) break;

        const infoEnd = openNl > i && md.charCodeAt(openNl - 1) === CH_CR ? openNl - 1 : openNl;
        const codeStart = openNl + 1;

        const needle =
          fLen === 3
            ? fch === CH_BACKTICK
              ? NEEDLE_BACKTICK_3
              : NEEDLE_TILDE_3
            : "\n" + md.slice(fenceStart, i);

        let searchFrom = codeStart;
        let matchedClose = -1;
        let afterFence = -1;

        while (searchFrom < len) {
          const idx = md.indexOf(needle, searchFrom);
          if (idx === -1) break;
          const endIdx = idx + 1 + fLen;
          if (
            endIdx === len ||
            md.charCodeAt(endIdx) === CH_LF ||
            (md.charCodeAt(endIdx) === CH_CR &&
              endIdx + 1 < len &&
              md.charCodeAt(endIdx + 1) === CH_LF)
          ) {
            matchedClose = idx;
            afterFence = endIdx;
            break;
          }
          searchFrom = idx + 1;
        }

        if (matchedClose !== -1) {
          const info = i === infoEnd ? "" : md.slice(i, infoEnd).trim();
          const codeEnd =
            matchedClose > codeStart && md.charCodeAt(matchedClose - 1) === CH_CR
              ? matchedClose - 1
              : matchedClose;
          out.push({ info, code: md.slice(codeStart, codeEnd) });

          if (afterFence >= len) return out;
          lineStart = md.charCodeAt(afterFence) === CH_CR ? afterFence + 2 : afterFence + 1;
          continue;
        }

        lineStart = openNl + 1;
        continue;
      }
    }

    const nextNl = md.indexOf("\n", i);
    if (nextNl === -1) break;
    lineStart = nextNl + 1;
  }

  return out;
}

export function parseBlocks(
  md: string,
  opts?: ParseOptions,
): Array<FenceBlock & { meta: FenceInfo }> {
  const blocks = extractBlocks(md);
  const out: Array<FenceBlock & { meta: FenceInfo }> = [];
  for (const b of blocks) {
    out.push({ info: b.info, code: b.code, meta: parseInfo(b.info, opts) });
  }
  return out;
}
