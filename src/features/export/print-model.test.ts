import { describe, expect, it } from 'vitest'
import { chooseScale } from './png'
import { cssPageSize, fitWindow, geometry, paginate } from './print-model'

describe('paper', () => {
  it('swaps width and height for landscape, and leaves room for margins, header and footer', () => {
    const p = geometry('a4', 'portrait')
    const l = geometry('a4', 'landscape')
    expect([l.width, l.height]).toEqual([p.height, p.width])
    expect(p.contentWidth).toBeLessThan(p.width)
    expect(p.contentHeight).toBeLessThan(p.height)
    expect(geometry('letter', 'portrait').height).toBe(1056)
    expect(cssPageSize('a4', 'landscape')).toBe('A4 landscape')
    expect(cssPageSize('letter', 'portrait')).toBe('letter portrait')
  })
})

describe('pagination', () => {
  it('fills a page, then starts the next, and never cuts a block', () => {
    expect(paginate([40, 40, 40, 40, 40], [], 100)).toEqual([[0, 1], [2, 3], [4]])
  })

  it('keeps a heading with the block after it', () => {
    // 3 blocks of 40 fit two per page; the second is a heading that must stay with the third.
    expect(paginate([40, 40, 40], [false, true, false], 100)).toEqual([[0], [1, 2]])
  })

  it('reserves space for something repeated on every page', () => {
    expect(paginate([40, 40, 40], [], 100, 30)).toEqual([[0], [1], [2]])
  })

  it('gives a block taller than a page its own page rather than losing it', () => {
    const pages = paginate([30, 500, 30], [], 100)
    expect(pages.flat().sort()).toEqual([0, 1, 2])
    expect(pages.find((p) => p.includes(1))).toEqual([1])
  })

  it('always returns at least one page, and every block exactly once', () => {
    expect(paginate([], [], 100)).toEqual([[]])
    const heights = Array.from({ length: 57 }, (_, i) => 10 + (i % 7) * 9)
    const keep = heights.map((_, i) => i % 5 === 0)
    const flat = paginate(heights, keep, 120, 12).flat()
    expect(flat).toEqual(heights.map((_, i) => i))
  })
})

describe('timeline window for print', () => {
  it('spans from the first month to the last, at least a quarter', () => {
    const w = fitWindow([{ start: '2026-02-10', end: '2026-02-20' }], '2026-01-01')
    expect(w.start).toBe('2026-02-01')
    expect(w.months.length).toBe(3)
    const long = fitWindow(
      [
        { start: '2026-01-05', end: '2026-03-01' },
        { start: '2026-08-01', end: '2026-10-15' },
      ],
      '2026-01-01',
    )
    expect(long.months.length).toBe(10)
    expect(long.end).toBe('2026-10-31')
  })

  it('caps a stray far-off date at three years, and uses the fallback with no dates', () => {
    expect(
      fitWindow([{ start: '2026-01-01', end: '2040-01-01' }], '2026-01-01').months.length,
    ).toBe(36)
    expect(fitWindow([], '2026-05-17').start).toBe('2026-05-01')
  })
})

describe('image size', () => {
  it('keeps the requested sharpness for normal views and lowers it for huge ones', () => {
    expect(chooseScale(1200, 800, 2)).toBe(2)
    const s = chooseScale(20000, 3000, 2)
    expect(s).toBeLessThan(1)
    expect(20000 * s).toBeLessThanOrEqual(16000)
    expect(chooseScale(12000, 12000, 2) * 12000).toBeLessThan(16000)
  })
})
