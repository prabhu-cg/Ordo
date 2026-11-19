import { expect, test } from '@playwright/test'
import { createProduct } from './helpers'

test.describe('landing page', () => {
  test('shows the required content and every navigation link works', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Plan your product. Shape your roadmap.',
    )
    await expect(
      page.getByText('Turn ideas, priorities and product goals into clear, visual roadmaps'),
    ).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const [name, id] of [
      ['Product', 'product'],
      ['Features', 'features'],
      ['Templates', 'templates'],
      ['Pricing', 'pricing'],
    ] as const) {
      await nav.getByRole('link', { name }).click()
      await expect(page).toHaveURL(new RegExp(`#${id}$`))
      await expect(page.locator(`#${id}`)).toBeInViewport()
    }
    for (const heading of [
      'Decide what comes next, and show why',
      'Three views of the same plan',
      'Start from a template, or from nothing',
      'Made for people who plan with small teams',
      'Free to use',
      'Questions, answered plainly',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeAttached()
    }
  })

  test('CTAs navigate correctly', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('main').getByRole('link', { name: 'Create your roadmap' }).first().click()
    await expect(page).toHaveURL(/\/app\/new$/)
    await page.goto('/')
    await page.getByRole('main').getByRole('link', { name: 'Explore an example' }).first().click()
    await expect(page).toHaveURL(/\/example$/)
    await page.goto('/')
    await page.getByRole('banner').getByRole('link', { name: 'Get started' }).click()
    await expect(page).toHaveURL(/\/app\/new$/)
    await page.goto('/')
    await page.getByRole('link', { name: 'Use the Solo founder roadmap template' }).click()
    await expect(page).toHaveURL(/\/app\/new\?template=solo-founder$/)
    await expect(page.getByRole('radio', { name: /Solo founder roadmap/ })).toBeChecked()
  })

  test('footer links go to real pages and sign in is honest', async ({ page }) => {
    for (const [name, heading] of [
      ['Help', 'Help'],
      ['Privacy', 'Privacy'],
      ['Terms', 'Terms'],
      ['Contact', 'Contact'],
    ] as const) {
      await page.goto('/')
      await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name }).click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
    await page.goto('/')
    await page.getByRole('banner').getByRole('link', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'No sign-in needed' })).toBeVisible()
    // No credential fields or payment controls anywhere on the public site.
    await page.goto('/')
    expect(await page.locator('input[type=password], input[type=email]').count()).toBe(0)
    await expect(page.getByRole('button', { name: /pay|subscribe|checkout|buy/i })).toHaveCount(0)
  })

  test('the main navigation is centred in the header, with the logo left and actions right', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const box = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!
    const nav = await box(page.getByRole('navigation', { name: 'Main' }))
    const header = await box(page.getByRole('banner'))
    const logo = await box(page.getByRole('link', { name: 'Ordo home' }))
    const action = await box(page.getByRole('banner').getByRole('link', { name: 'Get started' }))
    expect(Math.abs(nav.x + nav.width / 2 - (header.x + header.width / 2))).toBeLessThan(2)
    expect(logo.x).toBeLessThan(nav.x)
    expect(action.x).toBeGreaterThan(nav.x + nav.width)
  })

  test('the About page covers what it is, how it is built, what is live, and who built it', async ({
    page,
  }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1, name: 'About Ordo' })).toBeVisible()
    for (const h of [
      'What it is',
      'How it is built',
      'What is live, and what is next',
      'Who built it, and why',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible()
    }
    await expect(page.getByText('IndexedDB through Dexie')).toBeVisible()
    await page.getByRole('link', { name: 'Contact', exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible()
  })

  test('FAQ opens and the product preview switches views', async ({ page }) => {
    await page.goto('/')
    const item = page.locator('details', { hasText: 'Where is my data stored?' })
    await item.locator('summary').click()
    await expect(item.getByText('IndexedDB')).toBeVisible()
    const preview = page.locator('#product')
    await preview.getByRole('tab', { name: 'Timeline' }).click()
    await expect(preview.getByRole('region', { name: /Timeline/ })).toBeVisible()
    await preview.getByRole('tab', { name: 'Board' }).click()
    await expect(preview.getByRole('heading', { name: 'In progress' })).toBeVisible()
  })

  test('is responsive: no sideways scroll at phone width, menu works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'Pricing' }).click()
    await expect(page).toHaveURL(/#pricing$/)
  })
})

test.describe('dashboard and onboarding', () => {
  test('new users see an empty state and the guide prompt; nothing is auto-created', async ({
    page,
  }) => {
    await page.goto('/example') // exploring must not insert anything
    await page.goto('/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Ordo' })).toBeVisible()
    await expect(page.getByText('Create your first product').first()).toBeVisible()
    await expect(page.getByText('New to roadmaps?')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent products' })).toHaveCount(0)
  })

  test('skipping the guide persists and it can be revisited', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page.getByText('New to roadmaps?')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Ordo' })).toBeVisible()
    await expect(page.getByText('New to roadmaps?')).toHaveCount(0)

    await page.getByRole('link', { name: 'Guide' }).first().click()
    await expect(page.getByRole('heading', { level: 2, name: 'Objectives' })).toBeVisible()
    for (const next of ['Initiatives', 'Features', 'Prioritisation', 'Roadmap views']) {
      await page.getByRole('button', { name: 'Next' }).click()
      await expect(page.getByRole('heading', { level: 2, name: next })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page).toHaveURL(/\/app$/)
  })

  test('dashboard reflects saved products, with counts and last modified', async ({ page }) => {
    await createProduct(page, 'Atlas', { tagline: 'Maps for makers' })
    await createProduct(page, 'Beacon')
    await page.goto('/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
    const cards = page
      .getByRole('list')
      .filter({ has: page.getByRole('heading', { level: 3 }) })
      .first()
      .getByRole('listitem')
    await expect(cards).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'Atlas', exact: true })).toBeVisible()
    await expect(page.getByText('Maps for makers')).toBeVisible()
    await expect(page.getByText('Updated').first()).toBeVisible()
    await expect(page.getByText('Roadmaps').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: 'Beacon', exact: true })).toBeVisible()
  })

  test('card actions: edit and archive from the dashboard', async ({ page }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app')
    await page.getByRole('button', { name: 'Actions for Atlas' }).click()
    await page.getByRole('menuitem', { name: 'Edit details' }).click()
    await page.getByLabel('Product name').fill('Atlas Prime')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('link', { name: 'Atlas Prime', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Actions for Atlas Prime' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Archive product' }).click()
    await expect(page.getByText('Create your first product').first()).toBeVisible()
  })
})

test.describe('product creation', () => {
  test('requires a name and moves through three steps', async ({ page }) => {
    await page.goto('/app/new')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /name is required/i })).toBeVisible()
    await page.getByLabel('Product name').fill('Nova')
    await page.getByLabel('Product category').selectOption('mobile-app')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Target audience').fill('Runners')
    await page.getByLabel('Product vision').fill('Everyone runs')
    await page.getByLabel('Planning horizon').selectOption('12-months')
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Nova' })).toBeVisible()
    await expect(page.getByText('Mobile app').first()).toBeVisible()
    await expect(page.getByText('Runners')).toBeVisible()
  })

  test('from a template: copies it, links the records, and leaves the original untouched', async ({
    page,
  }) => {
    await page.goto('/app/new?template=startup-mvp')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Product name').fill('Orbit')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Orbit' })).toBeVisible()
    const row = (label: string) => page.getByRole('row', { name: new RegExp(`^${label}`) })
    await expect(page.getByRole('heading', { name: /^Objectives\s*3/ })).toBeVisible()
    await expect(row('Initiatives')).toContainText('5')
    await expect(row('Features')).toContainText('11')
    await expect(page.getByRole('heading', { name: /^Roadmaps\s*1/ })).toBeVisible()

    // Survives a reload and shows on the dashboard with one roadmap.
    await page.reload()
    await expect(row('Initiatives')).toContainText('5')
    await page.goto('/app')
    await expect(page.getByText('Orbit').first()).toBeVisible()

    // Using the template twice gives two independent products.
    await page.goto('/app/new?template=startup-mvp')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Product name').fill('Orbit two')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Orbit two' })).toBeVisible()

    // The sample is unchanged.
    await page.goto('/app/example?template=startup-mvp')
    await expect(page.getByText('Customer discovery interviews')).toBeVisible()
  })

  test('warns before discarding typed input', async ({ page }) => {
    await page.goto('/app/new')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Product name').fill('Half done')
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Discard this product?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByLabel('Product name')).toHaveValue('Half done')
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await page.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(page).toHaveURL(/\/app$/)
  })
})

test.describe('example roadmap', () => {
  test('is explorable, read-only, and never touches the workspace', async ({ page }) => {
    await page.goto('/example')
    await expect(page.getByRole('heading', { level: 1, name: 'Example roadmap' })).toBeVisible()
    await page.getByRole('button', { name: 'Build the MVP, initiative' }).click()
    await expect(page.getByRole('dialog').getByText('Sample, read-only')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Impact')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByLabel('Template').selectOption('feature-development')
    await expect(page.getByText('Discovery').first()).toBeVisible()
    await page.getByRole('tab', { name: 'Timeline' }).click()
    await page.getByRole('tab', { name: 'Board' }).click()

    await page.goto('/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Ordo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent products' })).toHaveCount(0)
  })
})
