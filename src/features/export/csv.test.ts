import { describe, expect, it } from 'vitest'
import { getTemplate, resolveTemplate } from '@/templates'
import { stampBundle } from '@/templates/records'
import { CSV_COLUMNS, csvField, planToCsv, planToRows, safeCell, toCsv } from './csv'

const plan = (id = 'feature-development') => {
  const b = resolveTemplate(getTemplate(id)!, { product: { name: 'P' } })
  const r = stampBundle(b)
  return { ...r, roadmap: r.roadmap }
}

describe('csv fields', () => {
  it('quotes commas, quotes and line breaks, and doubles quotes', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a, b')).toBe('"a, b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
  })

  it('defuses spreadsheet formulas but leaves numbers, dates and words alone', () => {
    for (const bad of ['=SUM(A1)', '+1', '-2+3', '@cmd', '=HYPERLINK("http://x")'])
      expect(safeCell(bad).startsWith("'")).toBe(true)
    for (const fine of ['2026-01-31', 'Hello', '12', 'High']) expect(safeCell(fine)).toBe(fine)
  })

  it('starts with a byte order mark and uses CRLF, so spreadsheets read it as UTF-8', () => {
    const text = toCsv(['a', 'b'], [['é', 'x']])
    expect(text.startsWith('﻿a,b\r\n')).toBe(true)
    expect(text.endsWith('é,x\r\n')).toBe(true)
  })
})

describe('the plan as CSV', () => {
  it('has one header row and a fixed set of columns', () => {
    const lines = planToCsv(plan()).replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
  })

  it('keeps the hierarchy through ids and parent ids, with status, priority and dates', () => {
    const p = { ...plan(), roadmap: undefined }
    const rows = planToRows(p)
    const col = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name)
    const byId = new Map(rows.map((r) => [r[col('id')]!, r]))
    expect(rows.length).toBe(p.objectives.length + p.initiatives.length + p.features.length)
    for (const r of rows) {
      const type = r[col('type')]
      const parent = r[col('parent_id')]
      if (type === 'objective') expect(parent).toBe('')
      if (type === 'initiative' && parent) expect(byId.get(parent)![col('type')]).toBe('objective')
      if (type === 'feature' && parent) expect(byId.get(parent)![col('type')]).toBe('initiative')
    }
    const withDates = rows.filter((r) => r[col('start_date')] && r[col('end_date')])
    expect(withDates.length).toBeGreaterThan(0)
    expect(withDates[0]![col('start_date')]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(
      rows.some((r) => r[col('status')] === 'In progress' || r[col('status')] === 'Planned'),
    ).toBe(true)
    expect(rows.some((r) => r[col('priority')] !== '')).toBe(true)
  })

  it('records links between initiatives by id', () => {
    const rows = planToRows({ ...plan('feature-development'), roadmap: undefined })
    const col = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name)
    const blocking = rows.filter((r) => r[col('blocks')])
    expect(blocking.length).toBeGreaterThan(0)
    const ids = new Set(rows.map((r) => r[col('id')]))
    for (const r of blocking)
      for (const id of r[col('blocks')]!.split(';')) expect(ids.has(id)).toBe(true)
    expect(rows.some((r) => r[col('blocked_by')])).toBe(true)
  })

  it('limited to a roadmap, still carries the parents and children so nothing is orphaned', () => {
    const p = plan()
    const first = p.roadmap.entries[0]!
    const scoped = { ...p, roadmap: { ...p.roadmap, entries: [first] } }
    const rows = planToRows(scoped)
    const col = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name)
    expect(rows.filter((r) => r[col('on_roadmap')] === 'yes').length).toBe(1)
    const ids = new Set(rows.map((r) => r[col('id')]))
    for (const r of rows) if (r[col('parent_id')]) expect(ids.has(r[col('parent_id')]!)).toBe(true)
  })

  it('a hostile title cannot become a formula', () => {
    const p = plan()
    const evil = {
      ...p,
      initiatives: p.initiatives.map((i, n) => (n === 0 ? { ...i, title: '=1+1' } : i)),
    }
    const csv = planToCsv(evil)
    expect(csv).toContain("'=1+1")
    expect(csv).not.toMatch(/(^|,)=1\+1/m)
  })
})
