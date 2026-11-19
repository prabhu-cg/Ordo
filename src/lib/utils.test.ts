import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a text colour next to a custom font-size token', () => {
    expect(cn('text-destructive', 'text-body')).toBe('text-destructive text-body')
    expect(cn('text-primary-text', 'text-label')).toBe('text-primary-text text-label')
  })
  it('still resolves real conflicts: the later size or colour wins', () => {
    expect(cn('text-body', 'text-title')).toBe('text-title')
    expect(cn('text-ink', 'text-destructive')).toBe('text-destructive')
  })
  it('treats our radius and shadow tokens as their own groups', () => {
    expect(cn('rounded-card', 'rounded-input')).toBe('rounded-input')
    expect(cn('shadow-menu', 'shadow-raised')).toBe('shadow-raised')
    expect(cn('rounded-full', 'rounded-card')).toBe('rounded-card')
  })
})
