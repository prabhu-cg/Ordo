import { expect, test } from '@playwright/test'
import { createFromTemplate, createProduct, drawer } from './helpers'

test.describe('building the hierarchy', () => {
  test('product, objective, initiative and feature, all persisted and linked', async ({ page }) => {
    await createProduct(page, 'Atlas')

    // Objective with a measurable outcome.
    await page.getByRole('link', { name: 'Objectives' }).first().click()
    await expect(page.getByText('Start with an objective')).toBeVisible()
    await page.getByRole('button', { name: 'New objective' }).click()
    const od = drawer(page, 'New objective')
    await od.getByLabel('Objective', { exact: true }).fill('Find the first 25 people')
    await od.getByLabel('Description').fill('Real people who care')
    await od.getByLabel('Target date').fill('2026-12-31')
    await od.getByRole('button', { name: 'Add an outcome' }).click()
    await od.getByLabel('Outcome', { exact: true }).fill('Weekly active users')
    await od.getByLabel('Success metric').fill('WAU')
    await od.getByLabel('Unit').fill('users')
    await od.getByLabel('Target', { exact: true }).fill('25')
    await od.getByLabel('Current').fill('10')
    await expect(od.getByText('40% of the way')).toBeVisible()
    await od.getByRole('button', { name: 'Create objective' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Find the first 25 people' }),
    ).toBeVisible()
    await expect(page.getByText('40% overall')).toBeVisible()
    await expect(page.getByText('Target 31 Dec 2026')).toBeVisible()

    // Track progress: edit the current value.
    await page.getByRole('button', { name: 'Edit Find the first 25 people' }).click()
    await drawer(page, 'Edit objective').getByLabel('Current').fill('20')
    await drawer(page, 'Edit objective').getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('80% overall')).toBeVisible()

    // Initiative, created from the objective, so the link is preset.
    await page
      .getByRole('button', { name: 'Add an initiative to Find the first 25 people' })
      .click()
    const id = drawer(page, 'New initiative')
    await expect(id.getByLabel('Objective').locator('option:checked')).toHaveText(
      'Find the first 25 people',
    )
    await id.getByLabel('Initiative', { exact: true }).fill('Private beta')
    await id.getByLabel('Priority').selectOption('high')
    await id.getByLabel('Status').selectOption('planned')
    await id.getByLabel('Expected impact').selectOption('5')
    await id.getByLabel('Confidence').selectOption('3')
    await id.getByLabel('Effort').selectOption('2')
    await id.getByLabel('Owner').fill('Sam')
    await id.getByLabel('Start date').fill('2026-11-01')
    await id.getByLabel('End date').fill('2026-12-01')
    await id.getByPlaceholder('Add a tag').fill('Growth')
    await id.getByRole('button', { name: 'Add', exact: true }).click()
    await id.getByRole('button', { name: 'Create initiative' }).click()
    await expect(page.getByRole('link', { name: '1 initiative' })).toBeVisible()

    // The initiative list shows it, linked to its objective.
    await page.getByRole('link', { name: '1 initiative' }).click()
    await expect(page).toHaveURL(/initiatives\?objective=/)
    const row = page.getByRole('row', { name: /Private beta/ })
    await expect(row).toContainText('Find the first 25 people')
    await expect(row).toContainText('Planned')
    await expect(row).toContainText('High')
    await expect(row).toContainText('Sam')

    // Feature, created from the initiative's feature link.
    await page.getByRole('link', { name: '0 features' }).click()
    await expect(page).toHaveURL(/features\?initiative=/)
    await page.getByRole('button', { name: 'New feature' }).click()
    const fd = drawer(page, 'New feature')
    await expect(
      fd.getByLabel('Initiative', { exact: false }).last().locator('option:checked'),
    ).toHaveText('Private beta')
    await fd.getByLabel('Feature', { exact: true }).fill('Invite flow')
    await fd.getByLabel('Expected impact').selectOption('4')
    await fd.getByLabel('Effort').selectOption('3')
    await fd.getByPlaceholder('Add a tag').fill('growth') // reuses the existing tag, ignoring case
    await fd.getByRole('button', { name: 'Add', exact: true }).click()
    await fd.getByRole('button', { name: 'Create feature' }).click()
    await expect(page.getByRole('row', { name: /Invite flow/ })).toBeVisible()

    // Counts propagate: sidebar, overview and dashboard.
    const sidebar = page.getByRole('navigation', { name: 'Primary' })
    await expect(sidebar.getByRole('link', { name: /Objectives/ })).toContainText('1')
    await expect(sidebar.getByRole('link', { name: /Initiatives/ })).toContainText('1')
    await expect(sidebar.getByRole('link', { name: /Features/ })).toContainText('1')
    await sidebar.getByRole('link', { name: 'Overview' }).click()
    await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText('1')
    await expect(page.getByRole('row', { name: /^Features/ })).toContainText('1')
    await expect(page.getByText('80%').first()).toBeVisible()

    // Everything survives a reload, with its links.
    await page.reload()
    await page.getByRole('link', { name: 'Features' }).first().click()
    await expect(page.getByRole('row', { name: /Invite flow/ })).toContainText('Private beta')
    // One shared tag was created, not two.
    await page.getByLabel('Filter by tag').selectOption({ label: 'Growth' })
    await expect(page.getByRole('row', { name: /Invite flow/ })).toBeVisible()
    expect(await page.getByLabel('Filter by tag').locator('option').allTextContents()).toEqual([
      'Any tag',
      'Growth',
    ])
  })

  test('validation keeps bad data out and the drawer open', async ({ page }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app/workspace/objectives')
    await page.getByRole('button', { name: 'New objective' }).click()
    const od = drawer(page, 'New objective')
    await od.getByRole('button', { name: 'Create objective' }).click()
    await expect(od.getByRole('alert').filter({ hasText: /name is required/i })).toBeVisible()
    await od.getByLabel('Objective', { exact: true }).fill('Grow')
    await od.getByRole('button', { name: 'Add an outcome' }).click()
    await od.getByLabel('Outcome', { exact: true }).fill('Users')
    await od.getByLabel('Target', { exact: true }).fill('0')
    await od.getByRole('button', { name: 'Create objective' }).click()
    await expect(od.getByText('The target must differ from the baseline')).toBeVisible()
    await od.getByLabel('Target', { exact: true }).fill('10')
    await od.getByRole('button', { name: 'Create objective' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Grow' })).toBeVisible()

    await page.goto('/app/workspace/initiatives')
    await page.getByRole('button', { name: 'New initiative' }).click()
    const id = drawer(page, 'New initiative')
    await id.getByLabel('Initiative', { exact: true }).fill('X')
    await id.getByLabel('Start date').fill('2026-05-10')
    await id.getByLabel('End date').fill('2026-05-01')
    await id.getByRole('button', { name: 'Create initiative' }).click()
    await expect(id.getByText('The end date cannot be before the start date')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(id).toBeHidden()
    await expect(page.getByText('No initiatives yet')).toBeVisible()
  })

  test('editing propagates to every screen without a reload', async ({ page }) => {
    await createFromTemplate(page, 'solo-maker-launch', 'Solo')
    await page.getByRole('link', { name: 'Initiatives' }).first().click()
    await page.getByRole('button', { name: 'Build the core workflow' }).click()
    const id = drawer(page, 'Edit initiative')
    await id.getByLabel('Initiative', { exact: true }).fill('Build the core product')
    await id.getByRole('button', { name: 'Save changes' }).click()
    await page.getByRole('link', { name: 'Features' }).first().click()
    await expect(page.getByRole('row', { name: /Create and edit an item/ })).toContainText(
      'Build the core product',
    )
    await page.getByRole('link', { name: 'Overview' }).first().click()
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect(page.getByRole('link', { name: 'Solo', exact: true })).toBeVisible()
  })
})

test.describe('search, filters and sorting', () => {
  test.beforeEach(async ({ page }) => {
    await createFromTemplate(page, 'saas-mvp', 'Orbit')
    await page.goto('/app/workspace/initiatives')
    await expect(page.getByRole('row')).toHaveCount(6) // header + 5
  })

  test('search, status, objective and tag filters narrow the list and live in the address', async ({
    page,
  }) => {
    const rows = page.getByRole('row')
    await page.getByLabel('Search initiatives').fill('billing')
    await expect(rows).toHaveCount(2)
    await expect(page.getByText('1 of 5 initiatives')).toBeVisible()
    await expect(page).toHaveURL(/q=billing/)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows).toHaveCount(6)

    await page.getByLabel('Filter by status').selectOption('in-progress')
    await expect(rows).toHaveCount(2)
    await expect(page.getByRole('row', { name: /Customer discovery interviews/ })).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()

    await page.getByLabel('Filter by objective').selectOption({ label: 'Deliver a usable MVP' })
    await expect(rows).toHaveCount(3)
    await page.getByRole('button', { name: 'Clear filters' }).click()

    await page.getByLabel('Filter by tag').selectOption({ label: 'Growth' })
    await expect(rows).toHaveCount(3) // pilot, billing
    await page.reload() // filters survive a reload because they are in the URL
    await expect(page.getByLabel('Filter by tag')).toHaveValue(/.+/)
    await expect(rows).toHaveCount(3)
  })

  test('priority filter, sorting, and the no-results state', async ({ page }) => {
    await page.getByRole('button', { name: 'Self-serve billing' }).click()
    await drawer(page, 'Edit initiative').getByLabel('Priority').selectOption('critical')
    await drawer(page, 'Edit initiative').getByRole('button', { name: 'Save changes' }).click()

    await page.getByLabel('Filter by priority').selectOption('critical')
    await expect(page.getByRole('row')).toHaveCount(2)
    await page.getByLabel('Filter by priority').selectOption('none')
    await expect(page.getByRole('row')).toHaveCount(5)
    await page.getByRole('button', { name: 'Clear filters' }).click()

    await page.getByLabel('Sort').selectOption('priority')
    await expect(page.getByRole('row').nth(1)).toContainText('Self-serve billing')
    await page.getByLabel('Sort').selectOption('title')
    await expect(page.getByRole('row').nth(1)).toContainText('Build the MVP')

    await page.getByLabel('Search initiatives').fill('zzzz')
    await expect(page.getByText('No initiatives match')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).last().click()
    await expect(page.getByRole('row')).toHaveCount(6)
  })

  test('features filter by initiative and by objective', async ({ page }) => {
    await page.goto('/app/workspace/features')
    await expect(page.getByRole('row')).toHaveCount(12)
    await page.getByLabel('Filter by initiative').selectOption({ label: 'Build the MVP' })
    await expect(page.getByRole('row')).toHaveCount(4)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.getByLabel('Filter by objective').selectOption({ label: 'Validate the problem' })
    await expect(page.getByRole('row')).toHaveCount(4)
  })
})

test.describe('data integrity on delete', () => {
  test.beforeEach(async ({ page }) => {
    await createFromTemplate(page, 'saas-mvp', 'Orbit')
  })

  test('deleting an objective asks what happens to its initiatives: keep them', async ({
    page,
  }) => {
    await page.goto('/app/workspace/objectives')
    await page.getByRole('button', { name: 'Delete Deliver a usable MVP' }).click()
    const dialog = page.getByRole('dialog', { name: /Delete “Deliver a usable MVP”/ })
    await expect(dialog).toContainText('2 initiatives and 5 features')
    await expect(dialog.getByRole('radio', { name: /Keep the initiatives/ })).toBeChecked() // the safe choice is the default
    await dialog.getByRole('button', { name: 'Delete objective' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Deliver a usable MVP' })).toHaveCount(
      0,
    )

    await page.goto('/app/workspace/initiatives')
    await expect(page.getByRole('row')).toHaveCount(6) // all five still there
    await expect(page.getByRole('row', { name: /Build the MVP/ })).toContainText('No objective')
  })

  test('deleting an objective and everything under it', async ({ page }) => {
    await page.goto('/app/workspace/objectives')
    await page.getByRole('button', { name: 'Delete Deliver a usable MVP' }).click()
    const dialog = page.getByRole('dialog', { name: /Delete “Deliver a usable MVP”/ })
    await dialog.getByRole('radio', { name: /Delete them too/ }).check()
    await dialog.getByRole('button', { name: 'Delete objective and 2 initiatives' }).click()
    await expect(page.getByText('Objective deleted').first()).toBeVisible()
    await page.goto('/app/workspace/initiatives')
    await expect(page.getByRole('row')).toHaveCount(4) // 3 left + header
    await page.goto('/app/workspace/features')
    await expect(page.getByRole('row')).toHaveCount(7) // 11 - 5 = 6 + header
    await expect(page.getByRole('row', { name: /Core workflow/ })).toHaveCount(0)
  })

  test('deleting an initiative: unlink or cascade, and it leaves the roadmap', async ({ page }) => {
    await page.goto('/app/workspace')
    await expect(page.getByRole('listitem').filter({ hasText: '5 items' })).toBeVisible() // the roadmap has 5 entries

    await page.goto('/app/workspace/initiatives')
    await page.getByRole('button', { name: 'Build the MVP' }).click()
    await drawer(page, 'Edit initiative').getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog', { name: /Delete “Build the MVP”/ })
    await expect(dialog).toContainText('3 features')
    await expect(dialog).toContainText('1 roadmap')
    await dialog.getByRole('button', { name: 'Delete initiative' }).click() // keep the features
    await expect(page.getByText('Initiative deleted').first()).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0) // both the confirmation and the drawer close

    await page.goto('/app/workspace/features')
    await expect(page.getByRole('row')).toHaveCount(12) // none deleted
    await expect(page.getByRole('row', { name: /Core workflow/ })).toContainText('No initiative')

    await page.goto('/app/workspace')
    await expect(page.getByRole('listitem').filter({ hasText: '4 items' })).toBeVisible() // removed from the roadmap too
    await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText('4')
  })

  test('deleting a feature needs a confirmation and nothing else is touched', async ({ page }) => {
    await page.goto('/app/workspace/features')
    await page.getByRole('button', { name: 'Core workflow' }).click()
    await drawer(page, 'Edit feature').getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog', { name: /Delete “Core workflow”/ })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(drawer(page, 'Edit feature')).toBeVisible() // cancelling leaves you where you were
    await drawer(page, 'Edit feature').getByRole('button', { name: 'Delete' }).click()
    await page
      .getByRole('dialog', { name: /Delete “Core workflow”/ })
      .getByRole('button', { name: 'Delete feature' })
      .click()
    await expect(page.getByRole('row', { name: /Core workflow/ })).toHaveCount(0)
    await expect(page.getByRole('row')).toHaveCount(11) // 10 + header
  })
})

test.describe('empty states and the logo', () => {
  test('empty planning pages guide the user', async ({ page }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app/workspace')
    await expect(page.getByText('Start with an objective')).toBeVisible()
    await expect(page.getByText('Nothing planned yet.')).toBeVisible()
    await expect(page.getByText('No roadmap yet')).toBeVisible()
    await page.goto('/app/workspace/initiatives')
    await expect(page.getByText('No initiatives yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add an objective first' })).toBeVisible()
    await page.goto('/app/workspace/features')
    await expect(page.getByText('No features yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add an initiative first' })).toBeVisible()
  })

  test('without a product the planning pages point to creating one', async ({ page }) => {
    await page.goto('/app/workspace/objectives')
    await expect(page.getByText('No product yet')).toBeVisible()
    await page.getByRole('link', { name: 'Create a product' }).click()
    await expect(page).toHaveURL(/\/app\/new$/)
  })

  test('the logo is used in the header and as the favicon', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('banner').locator('svg path[fill="var(--logo-accent)"]'),
    ).toBeVisible()
    const icon = await page.locator('link[rel=icon]').getAttribute('href')
    expect(icon).toBe('/favicon.svg')
    const svg = await (await page.request.get('/favicon.svg')).text()
    expect(svg).toContain('#E8B560')
    expect(svg).toContain('M128 0L23.7434 64.1268')
  })
})

test('planning pages fit a phone: no sideways page scroll, filters fold behind a button', async ({
  page,
}) => {
  await createFromTemplate(page, 'saas-mvp', 'Orbit')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of [
    '/app/workspace',
    '/app/workspace/objectives',
    '/app/workspace/initiatives',
    '/app/workspace/features',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBe(true)
  }
  await page.goto('/app/workspace/initiatives')
  await expect(page.getByLabel('Filter by status')).toBeHidden()
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByLabel('Filter by status').selectOption('planned')
  await expect(page.getByRole('button', { name: /Filters\s*1/ })).toBeVisible() // the count of active filters
  // The drawer fills the screen on a phone.
  await page.getByRole('button', { name: 'Clickable prototype' }).click()
  const box = await drawer(page, 'Edit initiative').boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(385)
})
