import { describe, it, expect } from "vitest";
import { extractBlocks, parseBlocks, parseInfo } from "../src/index.js";

describe("extractBlocks", () => {
  it("extracts backtick fenced blocks with info and code", () => {
    const md = ["before", '```js title="X"', "line1", "line2", "```", "after"].join("\n");
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.info).toBe('js title="X"');
    expect(blocks[0]?.code).toBe("line1\nline2");
  });

  it("extracts tilde fenced blocks with Windows newlines", () => {
    const md = "~~~ py\r\nprint(123)\r\n~~~\r\n";
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.info).toBe("py");
    expect(blocks[0]?.code).toBe("print(123)");
  });

  it("allows up to 3 spaces or tabs indentation", () => {
    const md = ["  \t```", "indented", "```"].join("\n");
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.code).toBe("indented");
  });

  it("does not match when indentation exceeds 3 spaces", () => {
    const md = ["    ```", "nope", "```"].join("\n");
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(0);
  });

  it("handles longer backtick and tilde fences and inner shorter fences", () => {
    const md = ["````", "```", "inner", "```", "````", "~~~~", "tilde", "~~~~"].join("\n");
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.code).toBe("```\ninner\n```");
    expect(blocks[1]?.code).toBe("tilde");
  });

  it("matches EOF without trailing newline", () => {
    const md = "```text\nabc\n```";
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.info).toBe("text");
    expect(blocks[0]?.code).toBe("abc");
  });

  it("ignores unclosed fences and non-closing fence prefixes inside code", () => {
    expect(extractBlocks("short")).toEqual([]);
    expect(extractBlocks("```typescript")).toEqual([]);
    const md = ["```ts", "unclosed", "```js", "const s = 1", "```"].join("\n");
    const blocks = extractBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.info).toBe("ts");
    expect(blocks[0]?.code).toBe("unclosed\n```js\nconst s = 1");

    expect(extractBlocks("```ts\nno-close")).toEqual([]);
  });
});

describe("parseBlocks", () => {
  it("parses meta for each block", () => {
    const md = ['```ts title="Hello" {1,3-4}', "code", "```", "", "~~~", "other", "~~~"].join("\n");
    const blocks = parseBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.meta.lang).toBe("ts");
    expect(blocks[0]?.meta.highlight).toEqual([1, 3, 4]);
    expect(blocks[0]?.meta.attrs).toMatchObject({ title: "Hello" });
    expect(blocks[1]?.meta.highlight).toEqual([]);
    expect(blocks[1]?.meta.attrs).toEqual({});
  });
});

describe("parseInfo", () => {
  it("parses language, attrs, types, and highlight ranges", () => {
    const huge = "9".repeat(400);
    const info = `ts pinned collapsed=false num=42 neg=-5 nfloat=-1.5 float=3.5 dash=- negbad=-a dot=1. dots=1.2.3 huge=${huge} truth=TRUE falsy=false e=12e3 f="34.5" bare ключ=значение empty= {3-1, 2}`;
    const res = parseInfo(info);
    expect(res.lang).toBe("ts");
    expect(res.highlight).toEqual([1, 2, 3]);
    expect(res.attrs).toMatchObject({
      pinned: true,
      collapsed: false,
      num: 42,
      neg: -5,
      nfloat: -1.5,
      float: 3.5,
      dash: "-",
      negbad: "-a",
      dot: "1.",
      dots: "1.2.3",
      huge,
      truth: true,
      falsy: false,
      e: "12e3",
      f: "34.5",
      bare: true,
      ключ: "значение",
      empty: "",
    });
  });

  it("handles quoted escapes, consecutive escapes, and unknown escapes", () => {
    const info = `lang d1="\\n\\ta\\nb\\\"d\\\\" s1='y\\r\\t\\'z\\\\q'`;
    const res = parseInfo(info);
    expect(res.lang).toBe("lang");
    expect(res.attrs.d1).toBe('\n\ta\nb"d\\');
    expect(res.attrs.s1).toBe("y\r\t'z\\q");
  });

  it("treatFirstBareAsLang=false makes bare tokens boolean", () => {
    const res = parseInfo("abc def", { treatFirstBareAsLang: false });
    expect(res.lang).toBeUndefined();
    expect(res.attrs).toMatchObject({ abc: true, def: true });
  });

  it("respects lowerCaseKeys=false for attr keys", () => {
    const res = parseInfo("JS Flag Extra=1", { lowerCaseKeys: false });
    expect(res.lang).toBe("JS");
    expect(res.attrs).toMatchObject({ Flag: true, Extra: 1 });
    expect(Object.keys(res.attrs)).toEqual(["Flag", "Extra"]);
  });

  it("supports empty, single-item, and multiple highlight blocks", () => {
    expect(parseInfo("{}").highlight).toEqual([]);
    expect(parseInfo("{4}").highlight).toEqual([4]);
    expect(parseInfo("{ 1 - 3 , 5 } {7,7}").highlight).toEqual([1, 2, 3, 5, 7]);
  });
});

describe("parseInfo errors", () => {
  it("unexpected }", () => {
    expect(() => parseInfo(" } ")).toThrowError(/unexpected '}'/);
  });

  it("unexpected =", () => {
    expect(() => parseInfo(" = ")).toThrowError(/unexpected '='/);
  });

  it("expected digit in highlight", () => {
    expect(() => parseInfo("{a}")).toThrowError(/expected digit at /);
  });

  it("trailing comma in highlight block", () => {
    expect(() => parseInfo("{,1}")).toThrowError(/trailing comma in highlight block/);
  });

  it("unterminated highlight block", () => {
    expect(() => parseInfo("{1,2")).toThrowError(/unterminated highlight block/);
  });

  it("unterminated string", () => {
    expect(() => parseInfo('x="hi')).toThrowError(/unterminated string/);
  });

  it("unterminated escape", () => {
    expect(() => parseInfo('x="hi\\')).toThrowError(/unterminated escape/);
  });
});
