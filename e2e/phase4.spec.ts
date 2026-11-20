import { expect, test, type Page } from '@playwright/test'
import {
  card,
  createFromTemplate,
  createProduct,
  dragTo,
  drawer,
  keyboardDrag,
  lane,
  openTemplateRoadmap,
} from './helpers'

// Tall enough that both ends of a drag are on screen.
test.use({ viewport: { width: 1440, height: 1100 } })

const quadrant = (page: Page, name: string) =>
  page.getByRole('region', { name: new RegExp(`^${name},`) })
const undoToast = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true }).last()
const onMatrix = async (page: Page) => {
  await createFromTemplate(page, 'startup-mvp', 'Orbit')
  await page.goto('/app/workspace/prioritise?show=initiatives')
  await expect(quadrant(page, 'Quick wins')).toBeVisible()
}

test.describe('impact, effort, priority and confidence', () => {
  test('are chosen from words, and explained: low, medium, high and exploring, tentative, committed', async ({
    page,
  }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app/workspace/initiatives')
    await page.getByRole('button', { name: 'New initiative' }).click()
    const d = drawer(page, 'New initiative')
    for (const label of ['Expected impact', 'Effort']) {
      expect(await d.getByLabel(label).locator('option').allTextContents()).toEqual([
        'Not set',
        'Low',
        'Medium',
        'High',
      ])
    }
    expect(
      await d.getByLabel('Confidence', { exact: true }).locator('option').allTextContents(),
    ).toEqual(['Not set', 'Exploring', 'Tentative', 'Committed'])
    expect(await d.getByLabel('Priority').locator('option').allTextContents()).toEqual([
      'Not set',
      'Low',
      'Medium',
      'High',
      'Critical',
    ])

    // Each label is explained by a tooltip on the help button, and under the field once chosen.
    await d.getByRole('button', { name: 'What the confidence labels mean' }).focus()
    await expect(
      page.getByRole('tooltip').getByText('We have decided to do this and are planning around it.'),
    ).toBeVisible()
    await d.getByLabel('Confidence', { exact: true }).selectOption('exploring')
    await expect(d.getByText('An idea we are looking into. Nothing is decided')).toBeVisible()

    await d.getByLabel('Initiative', { exact: true }).fill('Beta')
    await d.getByLabel('Expected impact').selectOption('high')
    await d.getByLabel('Effort').selectOption('low')
    await d.getByLabel('Priority').selectOption('low') // deliberately at odds with a quick win
    await d.getByRole('button', { name: 'Create initiative' }).click()
    const row = page.getByRole('row', { name: /Beta/ })
    await expect(row).toContainText('Exploring')
    await expect(row).toContainText('High') // impact
    await expect(row).toContainText('Low') // effort and priority
  })

  test('confidence badges explain themselves on hover and on keyboard focus', async ({ page }) => {
    await createFromTemplate(page, 'startup-mvp', 'Orbit')
    await page.goto('/app/workspace/initiatives')
    const badge = page.getByLabel(/^Committed\. We have decided/).first()
    await badge.focus() // keyboard users get the tooltip too
    await expect(
      page.getByRole('tooltip').getByText('We have decided to do this and are planning around it.'),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await page.goto('/app/workspace/features')
    await page.getByRole('row').nth(2).hover()
  })

  test('priority looks the same everywhere: table, card and board', async ({ page }) => {
    await openTemplateRoadmap(page)
    // Build the MVP is critical in the template.
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Critical')
    await page.getByRole('tab', { name: 'Board' }).click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Critical')
    await page.goto('/app/workspace/initiatives')
    await expect(page.getByRole('row', { name: /Build the MVP/ })).toContainText('Critical')
    // Each level has its own look, with an icon as well as a colour.
    for (const level of ['Critical', 'High', 'Medium', 'Low']) {
      await page.goto(`/app/workspace/initiatives?priority=${level.toLowerCase()}`)
      // The badge is the span that has an icon and says the level (the phone layout's copy is hidden on desktop).
      const badge = page
        .getByRole('row')
        .nth(1)
        .locator('span', { has: page.locator('svg'), hasText: new RegExp(`^${level}$`) })
        .last()
      await expect(badge.locator('svg')).toBeVisible()
    }
  })
})

test.describe('the impact and effort matrix', () => {
  test('puts each item in the area its scores give, and lays out the four quadrants', async ({
    page,
  }) => {
    await onMatrix(page)
    for (const q of ['Quick wins', 'Major projects', 'Fill-ins', 'Reconsider'])
      await expect(quadrant(page, q)).toBeVisible()
    // Customer discovery (high, low), prototype (high, low) and pilot (high, medium) are quick wins.
    for (const t of [
      'Customer discovery interviews',
      'Clickable prototype',
      'Paid pilot with five teams',
    ]) {
      await expect(
        quadrant(page, 'Quick wins').getByRole('button', { name: `${t}, initiative` }),
      ).toBeVisible()
    }
    // MVP (high, high) and billing (high, high) are major projects.
    for (const t of ['Build the MVP', 'Self-serve billing']) {
      await expect(
        quadrant(page, 'Major projects').getByRole('button', { name: `${t}, initiative` }),
      ).toBeVisible()
    }
    await expect(
      quadrant(page, 'Fill-ins').getByRole('button', { name: /, initiative$/ }),
    ).toHaveCount(0)
    await expect(
      quadrant(page, 'Reconsider').getByRole('button', { name: /, initiative$/ }),
    ).toHaveCount(0)
    await expect(page.getByText('Higher impact')).toBeVisible()
  })

  test('changing impact or effort moves an item, and the rule is explained', async ({ page }) => {
    await onMatrix(page)
    await page.getByRole('button', { name: 'Score Paid pilot with five teams' }).click()
    await page.getByRole('menuitemradio', { name: 'Low' }).first().click() // impact: low, effort stays medium
    await expect(
      quadrant(page, 'Fill-ins').getByRole('button', {
        name: 'Paid pilot with five teams, initiative',
      }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Score Paid pilot with five teams' }).click()
    await page.getByRole('menuitemradio', { name: 'High' }).nth(1).click() // effort: high → low impact for high effort
    await expect(
      quadrant(page, 'Reconsider').getByRole('button', {
        name: 'Paid pilot with five teams, initiative',
      }),
    ).toBeVisible()
    await quadrant(page, 'Reconsider')
      .getByRole('button', { name: 'How items land in Reconsider' })
      .focus()
    await expect(page.getByRole('tooltip').getByText('Low impact for high effort.')).toBeVisible()
  })

  test("you can place an item by hand, it says so, and it never changes the item's priority", async ({
    page,
  }) => {
    await onMatrix(page)
    const target = card(page, 'Customer discovery interviews')
    await dragTo(page, target, quadrant(page, 'Reconsider').locator('ul'))
    await expect(
      quadrant(page, 'Reconsider').getByRole('button', {
        name: 'Customer discovery interviews, initiative',
      }),
    ).toBeVisible()
    await expect(quadrant(page, 'Reconsider')).toContainText('Placed by hand')

    // Its scores and its priority are untouched: only where it sits on the matrix changed.
    await page.goto('/app/workspace/initiatives')
    const row = page.getByRole('row', { name: /Customer discovery interviews/ })
    await expect(row).toContainText('High') // priority is still high, though the matrix says reconsider
    await page.goto('/app/workspace/prioritise?show=initiatives')
    // Hand the item back to its scores.
    await page.getByRole('button', { name: 'Score Customer discovery interviews' }).click()
    await page.getByRole('menuitem', { name: 'Use its scores' }).click()
    await expect(
      quadrant(page, 'Quick wins').getByRole('button', {
        name: 'Customer discovery interviews, initiative',
      }),
    ).toBeVisible()
    await expect(page.getByText('Placed by hand')).toHaveCount(0)
  })

  test('a hand placement can be undone, survives editing the item, and is dropped when the scores are changed', async ({
    page,
  }) => {
    await onMatrix(page)
    await dragTo(page, card(page, 'Self-serve billing'), quadrant(page, 'Fill-ins').locator('ul'))
    await expect(
      quadrant(page, 'Fill-ins').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()
    await undoToast(page).click()
    await expect(
      quadrant(page, 'Major projects').getByRole('button', {
        name: 'Self-serve billing, initiative',
      }),
    ).toBeVisible()

    await dragTo(page, card(page, 'Self-serve billing'), quadrant(page, 'Fill-ins').locator('ul'))
    await expect(
      quadrant(page, 'Fill-ins').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()
    // Editing something else about it keeps the placement.
    // A click straight after a drop can land while the board is still settling, so click again if it did not open.
    await expect(async () => {
      if ((await page.getByRole('dialog').count()) === 0)
        await card(page, 'Self-serve billing').click()
      await expect(drawer(page, 'Edit initiative')).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 10000 })
    await drawer(page, 'Edit initiative').getByLabel('Owner').fill('Sam')
    await drawer(page, 'Edit initiative').getByRole('button', { name: 'Save changes' }).click()
    await expect(
      quadrant(page, 'Fill-ins').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()
    // Changing its scores returns it to where the scores say.
    await card(page, 'Self-serve billing').click()
    await drawer(page, 'Edit initiative').getByLabel('Effort').selectOption('low')
    await drawer(page, 'Edit initiative').getByRole('button', { name: 'Save changes' }).click()
    await expect(
      quadrant(page, 'Quick wins').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()
  })

  test('items with no scores are listed and can be scored right there', async ({ page }) => {
    await createFromTemplate(page, 'startup-mvp', 'Orbit')
    await page.goto('/app/workspace/prioritise?show=features')
    await expect(page.getByRole('heading', { name: /^Not scored yet/ })).toBeVisible({
      timeout: 10000,
    })
    await page.getByLabel('Impact of Core workflow').selectOption('high')
    await expect(page.getByLabel('Impact of Core workflow')).toHaveValue('high') // saved and redrawn
    await expect(page.getByRole('heading', { name: /^Not scored yet/ })).toContainText('10') // still unscored: one score is not enough (shipped work is left out)
    await page.getByLabel('Effort of Core workflow').selectOption('low')
    await expect(
      quadrant(page, 'Quick wins').getByRole('button', { name: 'Core workflow, feature' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Not scored yet/ })).toContainText('9')
  })

  test('move an item between quadrants with the keyboard, in all four directions', async ({
    page,
  }) => {
    await onMatrix(page)
    const name = 'Customer discovery interviews, initiative'
    await keyboardDrag(page, card(page, 'Customer discovery interviews'), ['ArrowRight'])
    await expect(quadrant(page, 'Major projects').getByRole('button', { name })).toBeVisible()
    await expect(quadrant(page, 'Major projects')).toContainText('Placed by hand')
    // Left again: back where its scores put it, so it is no longer a hand placement.
    await keyboardDrag(page, card(page, 'Customer discovery interviews'), ['ArrowLeft'])
    await expect(quadrant(page, 'Quick wins').getByRole('button', { name })).toBeVisible()
    await expect(page.getByText('Placed by hand')).toHaveCount(0)

    // Down steps through the cards in the column and then into the quadrant below.
    await card(page, 'Customer discovery interviews').focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(350)
    const live = page.locator('[id^="DndLiveRegion"]')
    for (let i = 0; i < 8 && !/Fill-ins/.test((await live.textContent()) ?? ''); i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(350)
    }
    await expect(live).toContainText('Fill-ins')
    await page.keyboard.press('Space')
    await expect(quadrant(page, 'Fill-ins').getByRole('button', { name })).toBeVisible()
  })

  test('empty states and the phone layout', async ({ page }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app/workspace/prioritise')
    await expect(page.getByText('Nothing to prioritise yet')).toBeVisible()
    await page.goto('/app/new?template=startup-mvp')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Product name').fill('Orbit')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Orbit' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app/workspace/prioritise')
    await expect(quadrant(page, 'Quick wins')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })
})

test.describe('dependencies on roadmap items', () => {
  const link = async (page: Page, from: string, kind: string, to: string) => {
    await card(page, from).click()
    const d = drawer(page, from)
    await d.getByLabel('Add a link').selectOption(kind)
    await d.getByLabel('Item', { exact: true }).selectOption({ label: `${to} (initiative)` })
    await d.getByRole('button', { name: 'Add link' }).click()
    await expect(d.locator('li').getByText(to)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }

  test('a link has a direction, shows on both items, and shows as blocked until the blocker is done', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await link(page, 'Clickable prototype', 'blocks', 'Build the MVP')
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Blocked by 1')
    await expect(card(page, 'Clickable prototype').locator('..')).toContainText('Blocks 1')
    // The same indicators on the board.
    await page.getByRole('tab', { name: 'Board' }).click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Blocked by 1')
    await page.getByRole('tab', { name: 'Now, next, later' }).click()

    // Once the blocker ships, the other is no longer waiting.
    await page.getByRole('button', { name: 'Quick edit Clickable prototype' }).click()
    await page.getByRole('menuitemradio', { name: 'Shipped' }).click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Unblocked')
    // The tooltip names what it is linked to.
    await card(page, 'Build the MVP').locator('..').getByText('Unblocked').hover()
    await expect(page.getByRole('tooltip')).toContainText('Waiting for Clickable prototype (done)')
  })

  test('a link can be removed, and removing it clears the indicators', async ({ page }) => {
    await openTemplateRoadmap(page)
    await link(page, 'Clickable prototype', 'blocks', 'Build the MVP')
    await card(page, 'Build the MVP').click()
    const d = drawer(page, 'Build the MVP')
    await expect(d.getByRole('heading', { name: 'Blocked by' })).toBeVisible()
    await d.getByRole('button', { name: 'Remove link to Clickable prototype' }).click()
    await expect(d.getByText('Nothing is linked to this yet')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Blocked by 1')).toHaveCount(0)
    await undoToast(page).click() // and removing a link can be undone
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Blocked by 1')
  })

  test('direction and loops are validated', async ({ page }) => {
    await openTemplateRoadmap(page)
    await link(page, 'Build the MVP', 'blocked-by', 'Clickable prototype') // "is blocked by" is the reverse direction
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Blocked by 1')
    // The reverse is a loop.
    await card(page, 'Build the MVP').click()
    const d = drawer(page, 'Build the MVP')
    await d.getByLabel('Add a link').selectOption('blocks')
    await d
      .getByLabel('Item', { exact: true })
      .selectOption({ label: 'Clickable prototype (initiative)' })
    await d.getByRole('button', { name: 'Add link' }).click()
    await expect(page.getByText('That would make a loop').first()).toBeVisible()
  })

  test('deleting a linked record leaves no dangling indicator or link', async ({ page }) => {
    await openTemplateRoadmap(page)
    await link(page, 'Clickable prototype', 'blocks', 'Build the MVP')
    await page.goto('/app/workspace/initiatives')
    await page.getByRole('button', { name: 'Clickable prototype' }).click()
    await drawer(page, 'Edit initiative').getByRole('button', { name: 'Delete' }).click()
    await page
      .getByRole('dialog', { name: /Delete “Clickable prototype”/ })
      .getByRole('button', { name: 'Delete initiative' })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(card(page, 'Build the MVP')).toBeVisible()
    await expect(page.getByText('Blocked by')).toHaveCount(0)
    await card(page, 'Build the MVP').click()
    await expect(
      drawer(page, 'Build the MVP').getByText('Nothing is linked to this yet'),
    ).toBeVisible()
  })

  test('a template can carry links, and they arrive as real dependencies', async ({ page }) => {
    await createFromTemplate(page, 'feature-development', 'Launchpad')
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(card(page, 'Design').locator('..')).toContainText('Blocked by 1') // discovery blocks design
    await expect(card(page, 'Discovery').locator('..')).toContainText('Blocks 1')
    await page.getByRole('tab', { name: 'Timeline' }).click()
    await expect(page.locator('[data-testid="dependency-lines"] line').first()).toBeAttached()
    await expect(page.getByText('A red line means')).toHaveCount(0) // the sample is sequenced, so nothing conflicts
  })
})

test.describe('the six starter templates', () => {
  const NAMES = [
    'Startup MVP roadmap',
    'SaaS product roadmap',
    'Quarterly product roadmap',
    'Feature development roadmap',
    'Product redesign roadmap',
    'Solo founder roadmap',
  ]

  test('are listed, clearly labelled as sample data, with their suggested planning structure', async ({
    page,
  }) => {
    await page.goto('/app/templates')
    await expect(page.getByRole('heading', { level: 1, name: 'Templates' })).toBeVisible()
    for (const n of NAMES)
      await expect(page.getByRole('heading', { level: 3, name: new RegExp(`^${n}`) })).toBeVisible()
    await expect(page.getByText('Sample data', { exact: true })).toHaveCount(6)
    await expect(page.getByText('Date-based')).toHaveCount(1) // only the quarterly one plans by date
    await expect(page.getByText('Everything in them is sample data')).toBeVisible()
  })

  test('each one creates a valid product, labelled as sample data until you say it is yours', async ({
    page,
  }) => {
    for (const [id, name, initiatives] of [
      ['startup-mvp', 'Startup MVP roadmap', 5],
      ['saas-product', 'SaaS product roadmap', 6],
      ['quarterly', 'Quarterly product roadmap', 5],
      ['feature-development', 'Feature development roadmap', 5],
      ['product-redesign', 'Product redesign roadmap', 5],
      ['solo-founder', 'Solo founder roadmap', 5],
    ] as const) {
      await createFromTemplate(page, id, `From ${id}`)
      await expect(page.getByText(`Started from the “${name}” template`)).toBeVisible()
      await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText(
        String(initiatives),
      )
    }
    await page.getByRole('button', { name: 'These are mine now' }).click()
    await expect(page.getByText(/Started from the/)).toHaveCount(0)
    await page.reload()
    await expect(page.getByText(/Started from the/)).toHaveCount(0) // it stays dismissed
    await page.goto('/app')
    await expect(page.getByText('Sample data', { exact: true })).toHaveCount(5) // the other five are still labelled
  })

  test('the quarterly template opens as a date-based timeline, as it suggests', async ({
    page,
  }) => {
    await createFromTemplate(page, 'quarterly', 'Q')
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByText('Date-based · 5 items')).toBeVisible()
  })
})

test.describe('template previews', () => {
  const nowLane = (page: Page) => lane(page, 'Now')

  test('you can play with a preview, nothing is saved, and Reset puts it back', async ({
    page,
  }) => {
    await page.goto('/app/example?template=startup-mvp')
    await expect(page.getByText('Sample data, and a preview you can play with')).toBeVisible()
    await expect(page.getByText('Suggested planning structure')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset preview' })).toBeDisabled() // nothing to reset yet

    await dragTo(
      page,
      card(page, 'Customer discovery interviews'),
      card(page, 'Self-serve billing'),
    )
    await expect(
      lane(page, 'Later').getByRole('button', {
        name: 'Customer discovery interviews, initiative',
      }),
    ).toBeVisible()
    await expect(page.getByText('You have changed this preview.')).toBeVisible()

    // Changing a status and switching views both work on the same throwaway copy.
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await page.getByRole('tab', { name: 'Board' }).click()
    await expect(
      quadrant(page, 'In progress').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Reset preview' }).click()
    await expect(page.getByRole('button', { name: 'Reset preview' })).toBeDisabled()
    await page.getByRole('tab', { name: 'Now, next, later' }).click()
    await expect(
      nowLane(page).getByRole('button', { name: 'Customer discovery interviews, initiative' }),
    ).toBeVisible()
    await page.getByRole('tab', { name: 'Board' }).click()
    await expect(
      quadrant(page, 'Idea').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()
  })

  test('a preview changes nothing in your data, even after a reload', async ({ page }) => {
    await page.goto('/app/example?template=startup-mvp')
    await dragTo(
      page,
      card(page, 'Customer discovery interviews'),
      card(page, 'Self-serve billing'),
    )
    await expect(page.getByText('You have changed this preview.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Reset preview' })).toBeDisabled() // back to the original
    await expect(
      nowLane(page).getByRole('button', { name: 'Customer discovery interviews, initiative' }),
    ).toBeVisible()
    await page.goto('/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Ordo' })).toBeVisible() // no product was created
  })

  test('the preview opens details read-only, and the public site has the same preview without duplicating', async ({
    page,
  }) => {
    await page.goto('/example?template=quarterly')
    await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute(
      'aria-selected',
      'true',
    ) // its suggested view
    await expect(page.getByRole('button', { name: 'Duplicate template' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Now, next, later' }).click()
    await page.getByRole('button', { name: 'Headline release, initiative' }).click()
    await expect(page.getByRole('dialog').getByText('Sample, read-only')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Release scope agreed')).toBeVisible()
  })
})

test.describe('template management', () => {
  test('duplicate a starter into a template of your own, then create a product from it', async ({
    page,
  }) => {
    await page.goto('/app/templates')
    await expect(page.getByText('You have not saved a template yet')).toBeVisible()
    await page.getByRole('button', { name: 'Duplicate Quarterly product roadmap' }).click()
    await expect(page.getByText('Template duplicated').first()).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 3, name: 'Quarterly product roadmap (copy)' }),
    ).toBeVisible()
    // The starter itself is still there, untouched.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Quarterly product roadmap Sample data' }),
    ).toBeVisible()

    await page
      .getByRole('link', { name: 'Create product from Quarterly product roadmap (copy)' })
      .click()
    await expect(
      page.getByRole('radio', { name: /Quarterly product roadmap \(copy\)/ }),
    ).toBeChecked()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Product name').fill('Mine')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mine' })).toBeVisible()
    await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText('5')
    await expect(page.getByText(/Started from the/)).toHaveCount(0) // your own structure is not labelled as sample data
  })

  test('save your own roadmap as a template: a copy of its structure, and the source is left alone', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    // Make the source distinctive.
    await page.getByRole('button', { name: 'More roadmap actions' }).click()
    await page.getByRole('menuitem', { name: 'Save as template' }).click()
    const d = drawer(page, 'Save as a template')
    await expect(
      d.getByText('3 objectives, 5 initiatives, 11 features, 2 milestones'),
    ).toBeVisible()
    await d.getByRole('button', { name: 'Save template' }).click()
    await expect(d.getByText('Say what this template is for')).toBeVisible() // a template needs to say what it is for and who it suits
    await expect(d.getByText('Say who this template suits')).toBeVisible()
    await d.getByLabel('Template name').fill('My MVP plan')
    await d.getByLabel('What it is for').fill('How we run an MVP')
    await d.getByLabel('Who it suits').fill('Our team')
    await d.getByRole('button', { name: 'Save template' }).click()
    await expect(page.getByText('Template saved').first()).toBeVisible()

    await page.goto('/app/templates')
    await expect(page.getByRole('heading', { level: 3, name: 'My MVP plan' })).toBeVisible()
    await expect(page.getByText('How we run an MVP')).toBeVisible()
    await expect(page.getByText('Sample data', { exact: true })).toHaveCount(6) // yours is not labelled as sample data

    // The source product is exactly as it was.
    await page.goto('/app/workspace')
    await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText('5')
    await expect(page.getByRole('row', { name: /^Features/ })).toContainText('11')

    // Editing and deleting the template leaves the source alone.
    await page.goto('/app/templates')
    await page.getByRole('button', { name: 'Actions for My MVP plan' }).click()
    await page.getByRole('menuitem', { name: 'Edit details' }).click()
    await drawer(page, 'Edit template').getByLabel('Template name').fill('Renamed plan')
    await drawer(page, 'Edit template').getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 3, name: 'Renamed plan' })).toBeVisible()
    await page.getByRole('button', { name: 'Actions for Renamed plan' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog', { name: /Delete “Renamed plan”/ })).toContainText(
      'Products already made from it are not affected',
    )
    await page.getByRole('button', { name: 'Delete template' }).click()
    await expect(page.getByText('You have not saved a template yet')).toBeVisible()
    await undoToast(page).click()
    await expect(page.getByRole('heading', { level: 3, name: 'Renamed plan' })).toBeVisible()
    await page.goto('/app/workspace')
    await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText('5')
  })

  test('a saved template makes a new product with the same structure, and survives a reload', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'More roadmap actions' }).click()
    await page.getByRole('menuitem', { name: 'Save as template' }).click()
    const d = drawer(page, 'Save as a template')
    await d.getByLabel('Template name').fill('Our plan')
    await d.getByLabel('What it is for').fill('Ours')
    await d.getByLabel('Who it suits').fill('Us')
    await d.getByRole('button', { name: 'Save template' }).click()
    await expect(page.getByText('Template saved').first()).toBeVisible()
    await page.reload()
    await page.goto('/app/new')
    await page.getByRole('radio', { name: /Our plan/ }).check()
    await expect(page.getByText('Yours', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Product name').fill('Second')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Second' })).toBeVisible()
    await expect(page.getByRole('row', { name: /^Initiatives/ })).toContainText('5')
    await expect(page.getByRole('row', { name: /^Features/ })).toContainText('11')
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(card(page, 'Build the MVP')).toBeVisible()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Critical') // priorities came across
  })

  test('with no roadmap there is nothing to save yet, and that is explained', async ({ page }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app/templates')
    await expect(
      page.getByRole('button', { name: 'Save a roadmap as a template' }).first(),
    ).toBeDisabled()
    await expect(
      page.getByText('Build a roadmap in a product, then save its structure here'),
    ).toBeVisible()
  })
})

test.describe('undo history', () => {
  test('survives a reload: change something, reload the page, and still undo it', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('In progress')

    await page.reload()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('In progress')
    const undo = page.getByRole('button', { name: /^Undo: / })
    await expect(undo).toBeEnabled() // the history came back with the page
    await undo.click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('Idea')
    await expect(page.getByRole('button', { name: 'Nothing to undo' })).toBeDisabled()
  })

  test('each product keeps its own history', async ({ page }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('In progress')
    await page.waitForTimeout(300) // the history is saved a moment after the edit
    await createProduct(page, 'Other')
    await page.goto('/app/roadmaps')
    // A product with no roadmaps has nothing to undo; the first product's step is still saved for it.
    const stored = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const open = indexedDB.open('ordo')
          open.onsuccess = () => {
            const all = open.result.transaction('meta').objectStore('meta').getAllKeys()
            all.onsuccess = () =>
              resolve(all.result.filter((k) => String(k).startsWith('undo:')).length)
          }
        }),
    )
    expect(stored).toBe(1)
  })
})
