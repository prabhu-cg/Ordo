/**
 * Optional, privacy-first page-view counting. It is off unless the person deploying Ordo sets
 * VITE_ANALYTICS_DOMAIN at build time, and even then it stays off for visitors who send Do Not Track or Global
 * Privacy Control. It is meant for a cookie-less service such as Plausible: no cookies, no identifiers, no
 * roadmap data. Nothing about a product, roadmap or item is ever passed to it.
 */
export interface AnalyticsConfig {
  domain: string
  src: string
}

const DOMAIN_RE = /^(?!-)[a-z0-9.-]{1,253}$/i

/** Read the build settings and keep only safe values: a plain hostname, and an https script address. */
export function readAnalyticsConfig(
  env: { VITE_ANALYTICS_DOMAIN?: string; VITE_ANALYTICS_SRC?: string } = import.meta.env,
): AnalyticsConfig | undefined {
  const domain = env.VITE_ANALYTICS_DOMAIN?.trim()
  if (!domain || !DOMAIN_RE.test(domain)) return undefined
  const raw = env.VITE_ANALYTICS_SRC?.trim() || 'https://plausible.io/js/script.js'
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return { domain, src: url.toString() }
  } catch {
    return undefined
  }
}

/** Visitors who have said they do not want to be tracked. */
export function visitorOptedOut(
  nav: Pick<Navigator, 'doNotTrack'> & { globalPrivacyControl?: boolean } = navigator,
): boolean {
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
}

export const analyticsConfigured = () => readAnalyticsConfig() !== undefined

/** Add the counting script, if it is configured and the visitor has not opted out. Returns whether it started. */
export function startAnalytics(): boolean {
  const config = readAnalyticsConfig()
  if (!config || visitorOptedOut()) return false
  const script = document.createElement('script')
  script.defer = true
  script.src = config.src
  script.dataset.domain = config.domain
  document.head.appendChild(script)
  return true
}
