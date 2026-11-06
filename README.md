# unfence

A tiny predictable parser for Markdown fenced code block info strings and blocks. Extracts language, attributes, and line highlights with zero dependencies.

## Usage

````markdown
```ts {1,3-5} title="App.tsx" line-numbers
const a = 1;
function foo() {}
foo();
bar();
baz();
```
````

```ts
import { parseInfo, normalize } from "unfence";

const raw = parseInfo('ts {1,3-5} title="App.tsx" line-numbers');
const meta = normalize(raw);
```

Normalized meta:

```json
{
  "lang": "ts",
  "title": "App.tsx",
  "lineNumbers": true,
  "highlight": [1, 3, 4, 5],
  "attrs": {}
}
```

## Info string syntax

### Language

The first bare token is treated as the language:

```text
js
ts
bash
```

### Attributes

Key-value attributes:

```text
key=value
```

Bare flags are converted to `true`:

```text
line-numbers
```

Unquoted numbers and `true`/`false` values are coerced to their corresponding types.

Quoted strings can use either double or single quotes:

```text
title="App.tsx"
title='App.tsx'
```

Supported escapes:

```text
\n
\r
\t
\"
\'
\\
```

### Line highlights

Curly-brace syntax:

```text
{1,3-5}
```

Or attribute aliases:

```text
highlight="1,3-5"
lines="1,3-5"
hl="1,3-5"
```

## API

### `parseInfo(info: string, opts?: ParseOptions): FenceInfo`

Parses a fence info string into language, raw attributes, and line highlights.

Returns:

```ts
{
  lang?: string;
  attrs: Record<string, string | number | boolean>;
  highlight: number[];
}
```

Options:

```ts
{
  lowerCaseKeys?: boolean;
  treatFirstBareAsLang?: boolean;
}
```

Both options default to `true`.

### `extractBlocks(md: string): FenceBlock[]`

Extracts fenced code blocks from a Markdown string.

Returns:

```ts
Array<{
  info: string;
  code: string;
}>
```

Supports:

- Backtick fences (` ``` `)
- Tilde fences (` ~~~ `)
- Matching fence lengths (3 or more characters)
- Up to 3 spaces or tabs of indentation

### `parseBlocks(md: string, opts?: ParseOptions)`

Extracts fenced code blocks and parses each block's `info` string.

Returns:

```ts
Array<{
  info: string;
  code: string;
  meta: FenceInfo;
}>
```

### `normalize(meta: FenceInfo, options?: NormalizeOptions): NormalizedMeta`

Maps known attribute keys to canonical fields and merges highlight aliases.

Options:

```ts
{
  lowercaseKeys?: boolean;
  mergeHighlightAttr?: boolean;
  keyMap?: Partial<Record<KnownKey, string[]>>;
}
```

Default key map:

| Input | Output |
|---|---|
| `title` | `meta.title` |
| `filename`, `file`, `name` | `meta.filename` |
| `line-numbers`, `linenumbers`, `linenos` | `meta.lineNumbers` |
| `pinned` | `meta.pinned` |
| `collapsed` | `meta.collapsed` |
| `highlight`, `lines`, `hl` | merged into `meta.highlight` |

Returns:

```ts
{
  lang?: string;
  title?: string;
  filename?: string;
  lineNumbers?: boolean;
  pinned?: boolean;
  collapsed?: boolean;
  highlight: number[];
  attrs: Record<string, string | number | boolean>;
}
```

### `parseLineSpec(value: Scalar): number[]`

Parses a line range specification string or number into a sorted array of unique line numbers.

Example:

```ts
parseLineSpec("1,3-5");
// → [1, 3, 4, 5]
```

## License

MIT
