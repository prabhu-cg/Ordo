import { describe, expect, it } from 'vitest'
import { readAnalyticsConfig, visitorOptedOut } from './analytics'

describe('analytics is off unless explicitly and safely configured', () => {
  it('does nothing with no setting', () => {
    expect(readAnalyticsConfig({})).toBeUndefined()
    expect(readAnalyticsConfig({ VITE_ANALYTICS_DOMAIN: '  ' })).toBeUndefined()
  })

  it('accepts a plain hostname, defaulting to an https script', () => {
    expect(readAnalyticsConfig({ VITE_ANALYTICS_DOMAIN: 'ordo.example' })).toEqual({
      domain: 'ordo.example',
      src: 'https://plausible.io/js/script.js',
    })
  })

  it('refuses anything that is not a hostname or an https address', () => {
    expect(readAnalyticsConfig({ VITE_ANALYTICS_DOMAIN: 'a b' })).toBeUndefined()
    expect(readAnalyticsConfig({ VITE_ANALYTICS_DOMAIN: '"><script>' })).toBeUndefined()
    for (const src of [
      'http://x.example/a.js',
      'javascript:alert(1)',
      'data:text/javascript,1',
      'not a url',
      'https://u:p@x.example/a.js',
    ])
      expect(
        readAnalyticsConfig({ VITE_ANALYTICS_DOMAIN: 'ordo.example', VITE_ANALYTICS_SRC: src }),
      ).toBeUndefined()
  })

  it('respects Do Not Track and Global Privacy Control', () => {
    expect(visitorOptedOut({ doNotTrack: '1' })).toBe(true)
    expect(visitorOptedOut({ doNotTrack: null, globalPrivacyControl: true })).toBe(true)
    expect(visitorOptedOut({ doNotTrack: '0' })).toBe(false)
    expect(visitorOptedOut({ doNotTrack: null })).toBe(false)
  })
})
