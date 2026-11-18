import { describe, it, expect } from "vitest";
import { normalize, parseLineSpec } from "../src/normalize.js";
import type { FenceInfo, Scalar } from "../src/types.js";

describe("normalize", () => {
  it("merges highlight from attr aliases and canonicalizes keys", () => {
    const meta: FenceInfo = {
      lang: "ts",
      highlight: [5],
      attrs: {
        lines: "1-3",
        linenumbers: "false",
        file: "x.ts",
        pinned: "0",
        collapsed: "TRUE",
        ttl: 123,
        keepMe: "v",
        MIXED: 1,
      },
    };
    const out = normalize(meta, {
      keyMap: { title: ["title", "ttl"] },
      lowercaseKeys: false,
    });
    expect(out.lang).toBe("ts");
    expect(out.highlight).toEqual([1, 2, 3, 5]);
    expect(out.lineNumbers).toBe(false);
    expect(out.filename).toBe("x.ts");
    expect(out.pinned).toBe(false);
    expect(out.collapsed).toBe(true);
    expect(out.title).toBe("123");
    expect(out.attrs.keepMe).toBe("v");
    expect(out.attrs.MIXED).toBe(1);
    expect(out.attrs.lines).toBeUndefined();
  });

  it("respects mergeHighlightAttr=false and default lowercaseKeys=true", () => {
    const meta: FenceInfo = {
      highlight: [2],
      attrs: { hl: "3", CustomKey: "val", skipped: undefined as unknown as Scalar },
    };
    const out = normalize(meta, { mergeHighlightAttr: false });
    expect(out.highlight).toEqual([2]);
    expect(out.attrs).toEqual({ hl: "3", customkey: "val" });
  });

  it("handles boolean coercion for strings, numbers, and empty highlight target", () => {
    expect(
      normalize({
        highlight: [],
        attrs: { highlight: "2,4", linenumbers: true, pinned: "no", collapsed: "off" },
      }),
    ).toMatchObject({
      highlight: [2, 4],
      lineNumbers: true,
      pinned: false,
      collapsed: false,
    });

    expect(
      normalize({
        highlight: [],
        attrs: { linenumbers: 0, pinned: 1, collapsed: "" },
      }),
    ).toMatchObject({
      lineNumbers: false,
      pinned: true,
      collapsed: true,
    });

    expect(
      normalize({
        highlight: [],
        attrs: { linenumbers: "1", pinned: "yes", collapsed: "enabled" },
      }),
    ).toMatchObject({
      lineNumbers: true,
      pinned: true,
      collapsed: true,
    });
  });

  it("converts filename and title to strings", () => {
    const meta: FenceInfo = {
      highlight: [],
      attrs: { filename: 42, title: true },
    };
    const out = normalize(meta);
    expect(out.filename).toBe("42");
    expect(out.title).toBe("true");
  });
});

describe("parseLineSpec", () => {
  it("handles numbers directly and rejects non-finite values", () => {
    expect(parseLineSpec(3)).toEqual([3]);
    expect(parseLineSpec(3.7)).toEqual([3]);
    expect(parseLineSpec(-2)).toEqual([-2]);
    expect(parseLineSpec(Number.NaN)).toEqual([]);
    expect(parseLineSpec(Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it("returns empty for non-string non-number or empty string", () => {
    expect(parseLineSpec(true)).toEqual([]);
    expect(parseLineSpec("")).toEqual([]);
  });

  it("parses single item, lists, reversed ranges, unicode spaces, and ignores junk", () => {
    expect(parseLineSpec("5")).toEqual([5]);
    expect(
      parseLineSpec(
        "1, , 2, 4-6, 6-4, 2, foo, 1-, 1-a, 1-2-3, \u00a0\u1680\u2000\u2028\u2029\u202f\u205f\u3000\ufeff8\u00a0, 0, 10",
      ),
    ).toEqual([0, 1, 2, 4, 5, 6, 8, 10]);
  });

  it("parses ranges with leading zeros and trims spaces", () => {
    expect(parseLineSpec("03 - 05, 1")).toEqual([1, 3, 4, 5]);
  });
});
