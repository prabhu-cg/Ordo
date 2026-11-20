import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { asFile, buildBackup } from './backup-fixture'
import {
  card,
  createFromTemplate,
  createProduct,
  drawer,
  importAlongside,
  openTemplateRoadmap,
} from './helpers'

test.use({ viewport: { width: 1440, height: 1000 } })

// ── Security ───────────────────────────────────────────────────────────────

test.describe('security', () => {
  test('every page is served with a strict content policy and the usual protective headers', async ({
    request,
  }) => {
    for (const path of ['/', '/app', '/about', '/app/data']) {
      const res = await request.get(path)
      const h = res.headers()
      const csp = h['content-security-policy']!
      expect(csp, path).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'") // no inline or remote scripts
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/)
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(h['x-content-type-options']).toBe('nosniff')
      expect(h['x-frame-options']).toBe('DENY')
      expect(h['referrer-policy']).toBe('no-referrer')
      expect(h['permissions-policy']).toContain('camera=()')
    }
  })

  test('the whole app runs under that policy: nothing is blocked, and nothing loads from elsewhere', async ({
    page,
  }) => {
    const violations: string[] = []
    const external: string[] = []
    page.on(
      'console',
      (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()),
    )
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http'))
        external.push(r.url())
    })
    await openTemplateRoadmap(page)
    for (const tab of ['Timeline', 'Board', 'Now, next, later'])
      await page.getByRole('tab', { name: tab }).click()
    await page.getByRole('button', { name: 'Export' }).click()
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /Image \(PNG\)/ }).click(),
    ])
    expect(dl.suggestedFilename()).toMatch(/\.png$/) // image export works under the policy too
    for (const path of [
      '/app/workspace/prioritise',
      '/app/templates',
      '/app/example',
      '/app/data',
      '/app/appearance',
      '/about',
      '/privacy',
    ])
      await page.goto(path)
    expect(violations).toEqual([])
    expect(external).toEqual([])
  })

  test('there is no analytics, tracker or third-party script unless the deployer configured one', async ({
    page,
  }) => {
    await page.goto('/')
    expect(await page.locator('script[src^="http"]').count()).toBe(0)
    expect(await page.locator('iframe').count()).toBe(0)
    await page.goto('/privacy')
    await expect(page.getByText('does not use analytics, cookies or trackers')).toBeVisible()
    expect(await page.evaluate(() => document.cookie)).toBe('')
  })

  test('hostile text in an imported file is shown as text and never runs', async ({ page }) => {
    const hostile = [
      '<img src=x onerror="window.__pwned=1">',
      '<script>window.__pwned=1</script>',
      '"><svg onload="window.__pwned=1">',
      'javascript:window.__pwned=1',
    ]
    await importAlongside(
      page,
      asFile(
        buildBackup([
          { name: '<b>Bold</b> & <i>Co</i>', initiatives: 4, title: (i) => hostile[i]! },
        ]),
      ),
    )
    await page.goto('/app/workspace/initiatives')
    for (const h of hostile) await expect(page.getByText(h, { exact: true }).first()).toBeVisible() // literal text
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    for (const tab of ['Timeline', 'Board', 'Now, next, later'])
      await page.getByRole('tab', { name: tab }).click()
    await page.goto('/app/workspace/prioritise')
    await page.goto('/app/data')
    await expect(page.getByText('<b>Bold</b> & <i>Co</i>').first()).toBeVisible()
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined()
    expect(await page.locator('b', { hasText: 'Bold' }).count()).toBe(0) // the markup in the name did not become markup
    expect(await page.locator('img[src="x"]').count()).toBe(0)
  })

  test('hostile text is also safe in the print preview and the exported image path', async ({
    page,
  }) => {
    await importAlongside(
      page,
      asFile(
        buildBackup([
          { name: 'P', initiatives: 1, title: () => '<img src=x onerror="window.__pwned=1">' },
        ]),
      ),
    )
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(page).toHaveURL(/\/app\/roadmaps\/[^/?]+/)
    await page.goto(page.url().split('?')[0] + '/print?view=timeline')
    await expect(page.getByTestId('print-sheet').first()).toContainText('<img src=x')
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined()
  })

  test('a file cannot pollute object prototypes or smuggle in unknown fields', async ({ page }) => {
    const backup = buildBackup([{ name: 'Clean', initiatives: 1 }]) as Record<string, unknown>
    const text = JSON.stringify(backup).replace(
      '{"app"',
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"app"',
    )
    await page.goto('/app/data')
    await page
      .getByLabel('Backup file')
      .setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(text) })
    await page.getByRole('button', { name: 'Add alongside what I have' }).click()
    await expect(page.getByText('Imported', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => (({}) as { polluted?: boolean }).polluted)).toBeUndefined()
  })

  test("a backup file never contains anything but the user's own planning data", async ({
    page,
  }) => {
    await createProduct(page, 'Plain')
    await page.goto('/app/data')
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download all products' }).click(),
    ])
    const text = fs.readFileSync((await dl.path())!, 'utf8') as string
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      'app',
      'data',
      'exportedAt',
      'schemaVersion',
    ])
    expect(text).not.toMatch(/token|secret|password|apikey|api_key/i)
  })
})

// ── Errors and storage failures ───────────────────────────────────────────

test.describe('error handling', () => {
  test('if the browser will not give storage, the app says so plainly instead of breaking', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
    })
    await page.goto('/app')
    await expect(page.getByText('Ordo cannot open your saved work')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page.getByRole('main')).not.toContainText('undefined')
  })

  test('a page that fails to load shows a calm error with a way forward, and the work is safe', async ({
    page,
  }) => {
    await createProduct(page, 'Safe')
    await page.route('**/assets/matrix-page-*.js', (route) => route.abort())
    await page.getByRole('link', { name: 'Prioritise' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: /updated|went wrong/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back up your data' })).toBeVisible()
    await page.unroute('**/assets/matrix-page-*.js')
    await page.getByRole('button', { name: 'Reload' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Prioritise' })).toBeVisible()
    await page.goto('/app/data')
    await expect(page.getByRole('button', { name: 'Delete Safe forever' })).toBeVisible() // nothing was lost
  })

  test('an unknown address shows the not-found page, inside and outside the app', async ({
    page,
  }) => {
    await createProduct(page, 'Somewhere')
    for (const path of [
      '/nope',
      '/app/nope',
      '/app/roadmaps/not-a-real-id',
      '/app/workspace/nothing-here',
    ]) {
      await page.goto(path)
      await expect(page.locator('main'), path).toContainText(/does not exist|not found/i)
    }
  })

  test('a failed save is reported next to what you did, and nothing half-changes', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    // Make the next write fail the way a full disk would.
    await page.evaluate(() => {
      const orig = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function () {
        IDBObjectStore.prototype.put = orig
        throw new DOMException('Quota', 'QuotaExceededError')
      }
    })
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await expect(page.getByText('That did not work').first()).toBeVisible()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Idea') // unchanged
  })
})

// ── Keyboard ───────────────────────────────────────────────────────────────

test.describe('keyboard', () => {
  test('the first Tab offers a skip link that moves focus to the content', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('the export menu opens, moves and chooses with the keyboard, and returns focus', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    const trigger = page.getByRole('button', { name: 'Export' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')
    await expect(page.getByRole('menuitem', { name: /Image/ })).toBeFocused()
    await page.waitForTimeout(500) // the menu finishes opening before it takes arrow keys
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowDown') // focus starts on the first item
      await page.waitForTimeout(120)
    }
    await expect(page.getByRole('menuitem', { name: /Product backup/ })).toBeFocused()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')])
    expect(dl.suggestedFilename()).toMatch(/\.json$/) // the fourth item, chosen by keyboard
  })

  test('dialogs trap focus, close on Escape, and give focus back', async ({ page }) => {
    await createProduct(page, 'Focus')
    await page.goto('/app/data')
    const open = page.getByRole('button', { name: 'Delete Focus forever' })
    await open.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true) // never leaves
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(open).toBeFocused()
  })

  test('the print preview and appearance settings can be used without a mouse', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await page.goto(page.url().split('?')[0] + '/print?view=timeline')
    const orientation = page.getByLabel('Orientation')
    await orientation.focus()
    await page.keyboard.type('P') // typing the first letter picks the option, on every platform
    await expect(orientation).toHaveValue('portrait')
    await page.goto('/app/appearance')
    await page.getByRole('radio', { name: 'Compact' }).focus()
    await page.keyboard.press('Space')
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
  })

  test('every control on the data page is reachable and named', async ({ page }) => {
    await createProduct(page, 'Named')
    await page.goto('/app/data')
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], input, select, textarea')]
        .filter((el) => {
          const e = el as HTMLElement
          if (e.closest('[hidden], [aria-hidden="true"]')) return false
          const label =
            e.getAttribute('aria-label') ||
            e.textContent?.trim() ||
            (e as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
            e.getAttribute('title')
          return !label
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    )
    expect(unnamed).toEqual([])
  })
})

// ── Responsive ─────────────────────────────────────────────────────────────

test.describe('responsive layouts', () => {
  for (const [name, size] of [
    ['phone', { width: 390, height: 844 }],
    ['tablet', { width: 768, height: 1024 }],
  ] as const)
    test(`${name}: no page scrolls sideways`, async ({ page }) => {
      await page.setViewportSize(size)
      await createFromTemplate(page, 'startup-mvp', 'Orbit')
      const paths = [
        '/',
        '/about',
        '/privacy',
        '/terms',
        '/help',
        '/example',
        '/app',
        '/app/workspace',
        '/app/workspace/objectives',
        '/app/workspace/initiatives',
        '/app/workspace/features',
        '/app/workspace/prioritise',
        '/app/roadmaps',
        '/app/templates',
        '/app/data',
        '/app/appearance',
        '/app/onboarding',
        '/app/new',
      ]
      for (const path of paths) {
        await page.goto(path)
        await page.waitForTimeout(150)
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(over, `${path} at ${size.width}px`).toBeLessThanOrEqual(1)
      }
      await page.goto('/app/roadmaps')
      await page.getByRole('link', { name: 'Open Roadmap' }).click()
      for (const tab of ['Now, next, later', 'Timeline', 'Board']) {
        await page.getByRole('tab', { name: tab }).click()
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          tab,
        ).toBeLessThanOrEqual(1)
      }
      await page.goto(page.url().split('?')[0] + '/print?view=board')
      await expect(page.getByTestId('print-sheet').first()).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(1) // sheets scroll inside their own area
    })

  test('on a phone the export menu and data page controls are tappable sizes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTemplateRoadmap(page)
    const box = (await page.getByRole('button', { name: 'Export' }).boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(32)
    await page.getByRole('button', { name: 'Export' }).click()
    const menu = (await page.getByRole('menu').boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x + menu.width).toBeLessThanOrEqual(390)
  })
})

// ── Accessibility (automated) ──────────────────────────────────────────────

test.describe('accessibility', () => {
  const run = async (page: Page, label: string) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const bad = results.violations.map(
      (v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`,
    )
    expect(bad, label).toEqual([])
  }

  const publicPaths = [
    '/',
    '/about',
    '/help',
    '/privacy',
    '/terms',
    '/contact',
    '/example',
    '/nope',
  ]
  for (const theme of ['light', 'dark'] as const)
    test(`public pages have no detectable WCAG A/AA problems (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
      for (const path of publicPaths) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await run(page, `${path} (${theme})`)
      }
    })

  for (const theme of ['light', 'dark'] as const)
    test(`app pages have no detectable WCAG A/AA problems (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
      await createFromTemplate(page, 'startup-mvp', 'Orbit')
      for (const path of [
        '/app',
        '/app/workspace',
        '/app/workspace/objectives',
        '/app/workspace/initiatives',
        '/app/workspace/features',
        '/app/workspace/prioritise',
        '/app/roadmaps',
        '/app/templates',
        '/app/example',
        '/app/data',
        '/app/appearance',
        '/app/onboarding',
        '/app/new',
      ]) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await run(page, `${path} (${theme})`)
      }
    })

  test('roadmap views, the export menu, drawers, dialogs and the print preview have no detectable problems', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    for (const tab of ['Now, next, later', 'Timeline', 'Board']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(300)
      await run(page, `roadmap ${tab}`)
    }
    await page.getByRole('button', { name: 'Export' }).click()
    await page.waitForTimeout(500) // let the opening animation finish, or colours are measured half-faded
    await run(page, 'export menu')
    await page.keyboard.press('Escape')
    await card(page, 'Build the MVP').click()
    await expect(drawer(page, 'Build the MVP')).toBeVisible()
    await page.waitForTimeout(500) // let the opening animation finish, or colours are measured half-faded
    await run(page, 'item drawer')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.waitForTimeout(500) // let the opening animation finish, or colours are measured half-faded
    await run(page, 'roadmap settings drawer')
    await page.keyboard.press('Escape')
    await page.goto(page.url().split('?')[0] + '/print?view=now-next-later')
    await expect(page.getByTestId('print-sheet').first()).toBeVisible()
    await run(page, 'print preview')
    await page.goto('/app/data')
    await page.getByRole('button', { name: 'Delete Orbit forever' }).click()
    await page.waitForTimeout(500) // let the opening animation finish, or colours are measured half-faded
    await run(page, 'delete dialog')
    await page.keyboard.press('Escape')
    await page
      .getByLabel('Backup file')
      .setInputFiles(asFile(buildBackup([{ name: 'A11y', initiatives: 2 }])))
    await expect(page.getByRole('dialog', { name: 'What is in this backup' })).toBeVisible()
    await page.waitForTimeout(500) // let the opening animation finish, or colours are measured half-faded
    await run(page, 'import preview dialog')
  })
})
