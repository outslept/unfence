export type Scalar = string | number | boolean;

export interface FenceInfo {
  lang?: string;
  attrs: Record<string, Scalar>;
  highlight: number[];
}

export interface ParseOptions {
  lowerCaseKeys?: boolean;
  treatFirstBareAsLang?: boolean;
}

export interface FenceBlock {
  info: string;
  code: string;
}

export type KnownKey = "title" | "filename" | "lineNumbers" | "pinned" | "collapsed";

export interface NormalizeOptions {
  lowercaseKeys?: boolean;
  mergeHighlightAttr?: boolean;
  keyMap?: Partial<Record<KnownKey, string[]>>;
}

export interface NormalizedMeta {
  lang?: string;
  highlight: number[];
  title?: string;
  filename?: string;
  lineNumbers?: boolean;
  pinned?: boolean;
  collapsed?: boolean;
  attrs: Record<string, Scalar>;
}
