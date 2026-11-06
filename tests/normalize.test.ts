import { describe, it, expect } from 'vitest'
import { normalize, parseLineSpec } from '../src/normalize.js'
import type { FenceInfo } from '../src/types.js'

describe('normalize', () => {
  it('merges highlight from attr aliases and canonicalizes keys', () => {
    const meta: FenceInfo = {
      lang: 'ts',
      highlight: [5],
      attrs: {
        lines: '1-3',
        linenumbers: 'false',
        file: 'x.ts',
        pinned: '0',
        collapsed: 'TRUE',
        ttl: 123,
        keepMe: 'v',
        MIXED: 1
      }
    }
    const out = normalize(meta, {
      keyMap: { title: ['title', 'ttl'] },
      lowercaseKeys: false
    })
    expect(out.lang).toBe('ts')
    expect(out.highlight).toEqual([1, 2, 3, 5])
    expect(out.lineNumbers).toBe(false)
    expect(out.filename).toBe('x.ts')
    expect(out.pinned).toBe(false)
    expect(out.collapsed).toBe(true)
    expect(out.title).toBe('123')
    expect(out.attrs.keepMe).toBe('v')
    expect(out.attrs.MIXED).toBe(1)
    expect(out.attrs.lines).toBeUndefined()
  })

  it('respects mergeHighlightAttr=false', () => {
    const meta: FenceInfo = {
      highlight: [2],
      attrs: { hl: '3' }
    }
    const out = normalize(meta, { mergeHighlightAttr: false })
    expect(out.highlight).toEqual([2])
    expect(out.attrs.hl).toBe('3')
  })

  it('handles lineNumbers as boolean and number', () => {
    const meta: FenceInfo = {
      highlight: [],
      attrs: { linenumbers: true }
    }
    const out1 = normalize(meta)
    expect(out1.lineNumbers).toBe(true)

    const meta2: FenceInfo = {
      highlight: [],
      attrs: { linenumbers: 0 }
    }
    const out2 = normalize(meta2)
    expect(out2.lineNumbers).toBe(false)
  })

  it('converts filename and title to strings', () => {
    const meta: FenceInfo = {
      highlight: [],
      attrs: { filename: 42, title: true }
    }
    const out = normalize(meta)
    expect(out.filename).toBe('42')
    expect(out.title).toBe('true')
  })
})

describe('parseLineSpec', () => {
  it('handles numbers directly', () => {
    expect(parseLineSpec(3)).toEqual([3])
    expect(parseLineSpec(3.7)).toEqual([3])
    expect(parseLineSpec(-2)).toEqual([-2])
  })

  it('returns empty for non-string non-number', () => {
    expect(parseLineSpec(true as any)).toEqual([])
  })

  it('parses lists, ranges, reversed ranges, zeros, and ignores junk', () => {
    expect(parseLineSpec('1, 2, 4-6, 6-4, 2, foo, 0, 10')).toEqual([0, 1, 2, 4, 5, 6, 10])
  })

  it('parses ranges with leading zeros and trims spaces', () => {
    expect(parseLineSpec('03 - 05, 1')).toEqual([1, 3, 4, 5])
  })
})
