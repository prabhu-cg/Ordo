import { expect, test, type Page } from '@playwright/test'
import {
  card,
  createFromTemplate,
  createProduct,
  dragTo,
  drawer,
  lane,
  openTemplateRoadmap,
  keyboardDrag,
} from './helpers'

// Tall enough that a column and its drop target are both on screen: a mouse cannot drop onto something it cannot see.
test.use({ viewport: { width: 1440, height: 1100 } })

const undoToast = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true }).last()
const tab = (page: Page, name: string) => page.getByRole('tab', { name })

test.describe('roadmaps', () => {
  test('create several roadmaps with their own settings, from the same plan, without copying anything', async ({
    page,
  }) => {
    await createFromTemplate(page, 'startup-mvp', 'Orbit')
    await page.goto('/app/roadmaps')
    await expect(page.getByRole('link', { name: 'Roadmap', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'New roadmap' }).click()
    const d = drawer(page, 'New roadmap')
    await d.getByLabel('Name').fill('Investor view')
    await d.getByLabel('Description').fill('What we will show investors')
    await d.getByLabel('Planning horizon').selectOption('12-months')
    await d.getByLabel('Opens in').selectOption('timeline')
    await d.getByRole('radio', { name: /Date-based/ }).check()
    await d.getByRole('checkbox', { name: 'Features' }).uncheck()
    await d.getByRole('button', { name: 'Create roadmap' }).click()

    // It opens in the view chosen, with the initiatives placed, and shows the settings.
    await expect(page.getByRole('heading', { level: 1, name: 'Investor view' })).toBeVisible()
    await expect(tab(page, 'Timeline')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('The next 12 months · Date-based · 5 items')).toBeVisible()

    await page.goto('/app/roadmaps')
    await expect(page.getByRole('link', { name: 'Investor view', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Roadmap', exact: true })).toBeVisible()
    // The plan itself was not duplicated.
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Initiatives/ }),
    ).toContainText('5')
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Roadmaps/ }),
    ).toContainText('2')
  })

  test('validates, and edits settings later', async ({ page }) => {
    await createProduct(page, 'Atlas')
    await page.goto('/app/roadmaps')
    await expect(page.getByText('No roadmaps yet')).toBeVisible()
    await page.getByRole('button', { name: 'New roadmap' }).click()
    const d = drawer(page, 'New roadmap')
    await d.getByRole('button', { name: 'Create roadmap' }).click()
    await expect(d.getByText(/name is required/i)).toBeVisible()
    await d.getByLabel('Name').fill('Main')
    await d.getByRole('checkbox', { name: 'Initiatives' }).uncheck()
    await d.getByRole('checkbox', { name: 'Features' }).uncheck()
    await d.getByRole('checkbox', { name: 'Milestones' }).uncheck()
    await d.getByRole('button', { name: 'Create roadmap' }).click()
    await expect(d.getByText('Show at least one kind of item')).toBeVisible()
    await d.getByRole('checkbox', { name: 'Initiatives' }).check()
    await d.getByRole('button', { name: 'Create roadmap' }).click()
    await expect(page.getByText('This roadmap is empty')).toBeVisible() // empty state guides you

    await page.getByRole('button', { name: 'Settings' }).click()
    await drawer(page, 'Roadmap settings').getByLabel('Name').fill('Main plan')
    await drawer(page, 'Roadmap settings').getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Main plan' })).toBeVisible()
  })

  test('deleting a roadmap asks first, leaves the plan alone, and can be undone', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'More roadmap actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete roadmap' }).click()
    await expect(page.getByRole('dialog', { name: /Delete “Roadmap”/ })).toContainText(
      'stay exactly as they are',
    )
    await page.getByRole('button', { name: 'Delete roadmap' }).click()
    await expect(page.getByText('No roadmaps yet')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Initiatives/ }),
    ).toContainText('5')
    await undoToast(page).click()
    await expect(page.getByRole('link', { name: 'Roadmap', exact: true })).toBeVisible()
  })

  test('add items: pick what to add, nothing is offered twice, and the empty case is explained', async ({
    page,
  }) => {
    await createFromTemplate(page, 'startup-mvp', 'Orbit')
    await page.goto('/app/roadmaps')
    await page.getByRole('button', { name: 'New roadmap' }).click()
    await drawer(page, 'New roadmap').getByLabel('Name').fill('Blank')
    await drawer(page, 'New roadmap')
      .getByRole('checkbox', { name: 'Start with my initiatives' })
      .uncheck()
    await drawer(page, 'New roadmap').getByRole('button', { name: 'Create roadmap' }).click()
    await expect(page.getByText('This roadmap is empty')).toBeVisible()

    await page.getByRole('button', { name: 'Add items', exact: true }).first().click()
    const d = drawer(page, 'Add items')
    await d.getByLabel('Put them in').selectOption('now')
    await d.getByRole('checkbox', { name: /Build the MVP/ }).check()
    await d.getByRole('checkbox', { name: /Core workflow/ }).check()
    await d.getByRole('button', { name: 'Add 2 items' }).click()
    await expect(
      lane(page, 'Now').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()
    await expect(
      lane(page, 'Now').getByRole('button', { name: 'Core workflow, feature' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Add items', exact: true }).first().click()
    await expect(
      drawer(page, 'Add items').getByRole('checkbox', { name: /Build the MVP/ }),
    ).toHaveCount(0) // already on it
    await drawer(page, 'Add items').getByLabel('Search').fill('zzzz')
    await expect(drawer(page, 'Add items').getByText('Nothing matches that search.')).toBeVisible()
  })
})

test.describe('now, next, later', () => {
  test.beforeEach(async ({ page }) => {
    await openTemplateRoadmap(page)
  })

  test('shows three columns with status, priority and confidence, and the same cards everywhere', async ({
    page,
  }) => {
    await expect(
      lane(page, 'Now').getByRole('button', { name: /^Customer discovery interviews/ }),
    ).toBeVisible()
    await expect(lane(page, 'Now')).toContainText('In progress')
    await expect(lane(page, 'Now')).toContainText('Committed')
    await expect(lane(page, 'Next')).toContainText('Build the MVP')
    await expect(lane(page, 'Later')).toContainText('Self-serve billing')
    await expect(page.getByText('Columns are yours to set')).toBeVisible()
  })

  test('drag a card to another column with the mouse: it persists, and undo puts it back', async ({
    page,
  }) => {
    const moved = lane(page, 'Later').getByRole('button', {
      name: 'Customer discovery interviews, initiative',
    })
    const home = lane(page, 'Now').getByRole('button', {
      name: 'Customer discovery interviews, initiative',
    })
    await dragTo(
      page,
      card(page, 'Customer discovery interviews'),
      card(page, 'Self-serve billing'),
    )
    await expect(moved).toBeVisible()
    await expect(home).toHaveCount(0)
    await expect(
      page.getByText('Moved “Customer discovery interviews” to Later').first(),
    ).toBeVisible()

    await page.getByRole('button', { name: /^Undo: Moved/ }).click()
    await expect(home).toBeVisible()
    await expect(moved).toHaveCount(0)

    // And a move survives a reload.
    await dragTo(
      page,
      card(page, 'Customer discovery interviews'),
      card(page, 'Self-serve billing'),
    )
    await expect(moved).toBeVisible()
    await page.reload()
    await expect(moved).toBeVisible()
  })

  test('drag to reorder within a column, and the order persists', async ({ page }) => {
    const names = () =>
      lane(page, 'Now')
        .getByRole('button', { name: /, initiative$/ })
        .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.split(',')[0]))
    await expect.poll(names).toEqual(['Customer discovery interviews', 'Clickable prototype'])
    await dragTo(
      page,
      card(page, 'Clickable prototype'),
      card(page, 'Customer discovery interviews'),
      { y: -20 },
    )
    await expect.poll(names).toEqual(['Clickable prototype', 'Customer discovery interviews'])
    await page.reload()
    await expect.poll(names).toEqual(['Clickable prototype', 'Customer discovery interviews'])
  })

  test('shows where a card will land while dragging', async ({ page }) => {
    const a = (await card(page, 'Customer discovery interviews').boundingBox())!
    const b = (await card(page, 'Build the MVP').boundingBox())!
    await page.mouse.move(a.x + 40, a.y + 20)
    await page.mouse.down()
    await page.mouse.move(a.x + 60, a.y + 40, { steps: 4 })
    await page.mouse.move(b.x + 60, b.y + 20, { steps: 12 })
    await expect(lane(page, 'Next')).toHaveCSS('outline-style', 'dashed') // the column that will receive it is marked
    await page.mouse.up()
  })

  test('move with the keyboard: pick up with Space, arrows, drop with Space', async ({ page }) => {
    await keyboardDrag(page, card(page, 'Customer discovery interviews'), ['ArrowRight'])
    await expect(
      lane(page, 'Next').getByRole('button', { name: 'Customer discovery interviews, initiative' }),
    ).toBeVisible()
  })

  test('the quick-edit menu does the same without dragging: move, status, priority, remove', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'Now' }).click()
    await expect(
      lane(page, 'Now').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'Shipped' }).click()
    await expect(
      lane(page, 'Now').getByRole('button', { name: 'Build the MVP, initiative' }).locator('..'),
    ).toContainText('Shipped')

    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'Critical' }).click()
    await expect(lane(page, 'Now')).toContainText('Critical')

    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitem', { name: 'Remove from roadmap' }).click()
    await expect(card(page, 'Build the MVP')).toHaveCount(0)
    await undoToast(page).click() // removing is undoable
    await expect(card(page, 'Build the MVP')).toBeVisible()
  })

  test('only the newest change keeps an Undo toast, so they do not pile up over the page', async ({
    page,
  }) => {
    for (const title of ['Build the MVP', 'Paid pilot with five teams', 'Self-serve billing']) {
      await page.getByRole('button', { name: `Quick edit ${title}` }).click()
      await page.getByRole('menuitemradio', { name: 'High' }).click()
      await expect(page.getByText(`Priority of “${title}” changed`).first()).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(1)
    await expect(page.getByText('Priority of “Self-serve billing” changed').first()).toBeVisible()
  })

  test('the lane header adds items straight into that column', async ({ page }) => {
    await page.getByRole('button', { name: 'Add items to Later' }).click()
    const d = drawer(page, 'Add items')
    await expect(d.getByLabel('Put them in')).toHaveValue('later')
    await d.getByRole('checkbox', { name: /Core workflow/ }).check()
    await d.getByRole('button', { name: 'Add 1 item' }).click()
    await expect(
      lane(page, 'Later').getByRole('button', { name: 'Core workflow, feature' }),
    ).toBeVisible()
  })

  test('undo with Ctrl or Cmd Z', async ({ page }) => {
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
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('ControlOrMeta+z')
    await expect(
      lane(page, 'Now').getByRole('button', { name: 'Customer discovery interviews, initiative' }),
    ).toBeVisible()
  })
})

test.describe('views stay in step', () => {
  test.beforeEach(async ({ page }) => {
    await openTemplateRoadmap(page)
  })

  test('no item disappears when switching views', async ({ page }) => {
    await expect(page.getByRole('button', { name: /, initiative$/ })).toHaveCount(5)
    await tab(page, 'Timeline').click()
    await expect(page.getByRole('button', { name: /Enter opens details/ })).toHaveCount(5)
    await tab(page, 'Board').click()
    await expect(page.getByRole('button', { name: /, initiative$/ })).toHaveCount(5)
    await tab(page, 'Now, next, later').click()
    await expect(page.getByRole('button', { name: /, initiative$/ })).toHaveCount(5)
  })

  test('moving a card changes the board and timeline; changing status regroups the board', async ({
    page,
  }) => {
    // Status set in now/next/later regroups the board.
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await tab(page, 'Board').click()
    const column = (n: string) => page.getByRole('region', { name: new RegExp(`^${n},`) })
    await expect(
      column('In progress').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()
    await expect(
      column('Idea').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toHaveCount(0)

    // And a board drop changes the status that the timeline bar shows.
    await dragTo(page, card(page, 'Build the MVP'), column('Shipped').locator('ul'))
    await expect(
      column('Shipped').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()
    await tab(page, 'Timeline').click()
    await expect(
      page.getByRole('button', { name: /^Build the MVP, .*Enter opens details/ }),
    ).toContainText('Shipped')
    await tab(page, 'Now, next, later').click()
    await expect(
      lane(page, 'Next').getByRole('button', { name: 'Build the MVP, initiative' }).locator('..'),
    ).toContainText('Shipped')
  })

  test("editing an initiative's dates in its own form moves it on the timeline", async ({
    page,
  }) => {
    await tab(page, 'Timeline').click()
    const bar = () =>
      page.getByRole('button', { name: /^Self-serve billing, .*Enter opens details/ })
    const before = await bar().getAttribute('aria-label')
    await page.getByRole('button', { name: 'Self-serve billing', exact: true }).click()
    await drawer(page, 'Self-serve billing')
      .getByRole('button', { name: 'Edit all details' })
      .click()
    await drawer(page, 'Edit initiative').getByLabel('Start date').fill('2027-02-01')
    await drawer(page, 'Edit initiative').getByLabel('End date').fill('2027-02-28')
    await drawer(page, 'Edit initiative').getByRole('button', { name: 'Save changes' }).click()
    await expect(bar()).toHaveAttribute('aria-label', /1 Feb 2027 to 28 Feb 2027/)
    expect(before).not.toContain('1 Feb 2027')
  })

  test('filters apply to every view and travel in the address', async ({ page }) => {
    await page.getByLabel('Search this roadmap').fill('billing')
    await expect(page.getByRole('button', { name: /, initiative$/ })).toHaveCount(1)
    await tab(page, 'Board').click()
    await expect(page.getByRole('button', { name: /, initiative$/ })).toHaveCount(1)
    await tab(page, 'Timeline').click()
    await expect(page.getByRole('button', { name: /Enter opens details/ })).toHaveCount(1)
    await expect(page).toHaveURL(/q=billing/)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByRole('button', { name: /Enter opens details/ })).toHaveCount(5)

    await page.getByLabel('Filter by status').selectOption('planned')
    await expect(page.getByText('1 of 5 items')).toBeVisible()
    await page.getByLabel('Search this roadmap').fill('zzzz')
    await expect(page.getByText('No items match')).toBeVisible()
  })
})

test.describe('timeline', () => {
  test.beforeEach(async ({ page }) => {
    await openTemplateRoadmap(page)
    await tab(page, 'Timeline').click()
  })
  const bar = (page: Page, title: string) =>
    page.getByRole('button', { name: new RegExp(`^${title}, .*Enter opens details`) })

  test('shows swimlane bars with dates, a today marker, milestones, and the date range', async ({
    page,
  }) => {
    await expect(page.getByTestId('today-line')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Milestone: Problem validated/ })).toBeVisible()
    await expect(bar(page, 'Customer discovery interviews')).toHaveAttribute(
      'aria-label',
      /Nov 2026/,
    )
    await expect(
      page.getByText(/^[A-Z][a-z]{2} \d{4} to [A-Z][a-z]{2} \d{4}$/).first(),
    ).toBeVisible()
  })

  test('navigate by month and quarter, zoom, and jump back to today', async ({ page }) => {
    const label = page.getByText(/^[A-Z][a-z]{2} \d{4} to [A-Z][a-z]{2} \d{4}$/).first()
    const start = await label.textContent()
    await page.getByRole('button', { name: 'Next month' }).click()
    expect(await label.textContent()).not.toBe(start)
    await page.getByRole('button', { name: 'Previous month' }).click()
    expect(await label.textContent()).toBe(start)

    await page.getByRole('button', { name: 'Quarter', exact: true }).click()
    await expect(page.getByText(/^Q\d \d{4}$/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next quarter' })).toBeVisible()
    await page.getByRole('button', { name: 'Next quarter' }).click()
    expect(await label.textContent()).not.toBe(start)
    await page.getByRole('button', { name: 'Year', exact: true }).click()
    await expect(page.getByText(/^20\d\d$/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await expect(page.getByTestId('today-line')).toBeVisible()

    // The zoom is remembered for this roadmap.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Year', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('drag a bar to move its dates, persist, and undo', async ({ page }) => {
    const b = bar(page, 'Clickable prototype')
    const before = await b.getAttribute('aria-label')
    const move = async () => {
      const box = (await bar(page, 'Clickable prototype').boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 8 })
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 })
      await page.mouse.up()
    }
    await move()
    await expect(b).not.toHaveAttribute('aria-label', before!)
    await page.getByRole('button', { name: /^Undo: Moved/ }).click()
    await expect(bar(page, 'Clickable prototype')).toHaveAttribute('aria-label', before!)

    await move()
    await expect(b).not.toHaveAttribute('aria-label', before!)
    const after = (await b.getAttribute('aria-label'))!
    await page.reload()
    await expect(bar(page, 'Clickable prototype')).toHaveAttribute('aria-label', after)
  })

  test('drag the end of a bar to resize it, keeping the start', async ({ page }) => {
    const b = bar(page, 'Build the MVP')
    const before = (await b.getAttribute('aria-label'))!
    const startDate = before.match(/, (\d+ \w+ \d{4}) to/)![1]
    const handle = page.getByTestId(
      (await b.getAttribute('data-testid'))!.replace('bar-', 'resize-end-'),
    )
    const h = (await handle.boundingBox())!
    await page.mouse.move(h.x + 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + 40, h.y + h.height / 2, { steps: 6 })
    await page.mouse.move(h.x + 100, h.y + h.height / 2, { steps: 6 })
    await page.mouse.up()
    await expect(b).not.toHaveAttribute('aria-label', before)
    const after = (await b.getAttribute('aria-label'))!
    expect(after).toContain(`, ${startDate} to`)
  })

  test('move and resize with the keyboard: arrows shift a week, Shift changes the end, Alt the start', async ({
    page,
  }) => {
    const b = bar(page, 'Build the MVP')
    await expect(b).toHaveAttribute('aria-label', /1 Jan 2027 to 31 Mar 2027/)
    await b.focus()
    await page.keyboard.press('ArrowRight')
    await expect(bar(page, 'Build the MVP')).toHaveAttribute(
      'aria-label',
      /8 Jan 2027 to 7 Apr 2027/,
    )
    await bar(page, 'Build the MVP').focus()
    await page.keyboard.press('Shift+ArrowLeft')
    await expect(bar(page, 'Build the MVP')).toHaveAttribute(
      'aria-label',
      /8 Jan 2027 to 31 Mar 2027/,
    )
    await bar(page, 'Build the MVP').focus()
    await page.keyboard.press('Alt+ArrowLeft')
    await expect(bar(page, 'Build the MVP')).toHaveAttribute(
      'aria-label',
      /1 Jan 2027 to 31 Mar 2027/,
    )
    await expect(page.getByRole('status').filter({ hasText: 'now runs' })).toBeAttached()
  })

  test('a click opens the item drawer and does not move the bar', async ({ page }) => {
    const b = bar(page, 'Build the MVP')
    const before = await b.getAttribute('aria-label')
    await b.click()
    await expect(drawer(page, 'Build the MVP')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(bar(page, 'Build the MVP')).toHaveAttribute('aria-label', before!)
  })

  test('undated items sit in their own list until scheduled', async ({ page }) => {
    await page.getByRole('button', { name: 'Add items', exact: true }).click()
    await drawer(page, 'Add items')
      .getByRole('checkbox', { name: /Core workflow/ })
      .check()
    await drawer(page, 'Add items').getByRole('button', { name: 'Add 1 item' }).click()
    const undated = page.locator('section[aria-labelledby="undated-heading"]')
    await expect(undated.getByText('Core workflow')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Core workflow, .*Enter opens details/ }),
    ).toHaveCount(0)

    // Features live in their initiative's swimlane, collapsed until opened.
    await expect(
      page.getByRole('button', { name: 'Show 1 feature of Build the MVP' }),
    ).toBeVisible()

    await undated.getByRole('button', { name: 'Schedule this month: Core workflow' }).click()
    await expect(page.getByRole('heading', { name: /^No dates/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Show 1 feature of Build the MVP' }).click()
    await expect(
      page.getByRole('button', { name: /^Core workflow, .*Enter opens details/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Collapse features' }).click()
    await expect(
      page.getByRole('button', { name: /^Core workflow, .*Enter opens details/ }),
    ).toHaveCount(0)
  })

  test('milestones: add, edit and delete with confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Milestone', exact: true }).click()
    const d = drawer(page, 'New milestone')
    await d.getByRole('button', { name: 'Add milestone' }).click()
    await expect(d.getByText(/name is required/i)).toBeVisible()
    await d.getByLabel('Milestone', { exact: true }).fill('Investor demo')
    await d.getByRole('button', { name: 'Add milestone' }).click()
    await expect(page.getByRole('button', { name: /^Milestone: Investor demo/ })).toBeVisible()

    await page.getByRole('button', { name: /^Milestone: Investor demo/ }).click()
    await drawer(page, 'Edit milestone').getByLabel('Status').selectOption('reached')
    await drawer(page, 'Edit milestone').getByRole('button', { name: 'Save changes' }).click()
    await page.getByRole('button', { name: /^Milestone: Investor demo/ }).click()
    await drawer(page, 'Edit milestone').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog', { name: /Delete “Investor demo”/ })).toBeVisible()
    await page.getByRole('button', { name: 'Delete milestone' }).click()
    await expect(page.getByRole('button', { name: /^Milestone: Investor demo/ })).toHaveCount(0)
    await undoToast(page).click()
    await expect(page.getByRole('button', { name: /^Milestone: Investor demo/ })).toBeVisible()
  })

  test('dependencies are drawn as lines, can be hidden, and a loop is refused', async ({
    page,
  }) => {
    await bar(page, 'Clickable prototype').click()
    const d = drawer(page, 'Clickable prototype')
    await d.getByLabel('Add a link').selectOption('blocks')
    await d
      .getByLabel('Item', { exact: true })
      .selectOption({ label: 'Build the MVP (initiative)' })
    await d.getByRole('button', { name: 'Add link' }).click()
    await expect(d.locator('li').getByText('Build the MVP')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="dependency-lines"] line').first()).toBeAttached()
    await page.getByRole('button', { name: /Dependencies on/ }).click()
    await expect(page.locator('[data-testid="dependency-lines"] line')).toHaveCount(0)
    await page.getByRole('button', { name: /Dependencies off/ }).click()

    // The reverse would be a loop.
    await bar(page, 'Build the MVP').click()
    const d2 = drawer(page, 'Build the MVP')
    await d2.getByLabel('Add a link').selectOption('blocks')
    await d2
      .getByLabel('Item', { exact: true })
      .selectOption({ label: 'Clickable prototype (initiative)' })
    await d2.getByRole('button', { name: 'Add link' }).click()
    await expect(page.getByText('That would make a loop').first()).toBeVisible()
  })
})

test.describe('board', () => {
  test.beforeEach(async ({ page }) => {
    await openTemplateRoadmap(page)
    await tab(page, 'Board').click()
  })
  const column = (page: Page, n: string) => page.getByRole('region', { name: new RegExp(`^${n},`) })

  test('group by priority: drop a card in a column to set its priority, undo, and the setting is remembered', async ({
    page,
  }) => {
    await page.getByLabel('Group by').selectOption('priority')
    await expect(column(page, 'Critical')).toBeVisible()
    // The template gives every initiative an example priority, so nothing is without one.
    await expect(
      column(page, 'No priority').getByRole('button', { name: /, initiative$/ }),
    ).toHaveCount(0)
    await expect(
      column(page, 'Low').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()
    await dragTo(page, card(page, 'Self-serve billing'), column(page, 'Critical').locator('ul'))
    await expect(
      column(page, 'Critical').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Undo: Moved/ }).click()
    await expect(
      column(page, 'Low').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Group by')).toHaveValue('priority')
  })

  test('group by initiative: features are cards, and dragging one to another initiative moves it', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Add items', exact: true }).click()
    await drawer(page, 'Add items')
      .getByRole('checkbox', { name: /Core workflow/ })
      .check()
    await drawer(page, 'Add items').getByRole('button', { name: 'Add 1 item' }).click()
    await page.getByLabel('Group by').selectOption('initiative')
    await expect(
      column(page, 'Build the MVP').getByRole('button', { name: 'Core workflow, feature' }),
    ).toBeVisible()
    await dragTo(
      page,
      page.getByRole('button', { name: 'Core workflow, feature' }),
      column(page, 'Clickable prototype').locator('ul'),
    )
    await expect(
      column(page, 'Clickable prototype').getByRole('button', { name: 'Core workflow, feature' }),
    ).toBeVisible()
    // It really moved: the feature's own record now belongs to the other initiative.
    await page.goto('/app/workspace/features')
    await expect(page.getByRole('row', { name: /Core workflow/ })).toContainText(
      'Clickable prototype',
    )
  })

  test('sorting and card customisation', async ({ page }) => {
    await page.getByRole('button', { name: 'Customise cards' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Dates' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText(/\d{4} to \d{1,2} \w+ \d{4}/)).toHaveCount(0)
    await page.reload()
    await expect(page.getByText(/\d{4} to \d{1,2} \w+ \d{4}/)).toHaveCount(0) // remembered

    await page.getByRole('button', { name: 'Customise cards' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Effort' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText(/^Effort (low|medium|high)$/).first()).toBeVisible()

    await page.getByLabel('Sort cards by').selectOption('title')
    await expect(page.getByText(/Cards are sorted/)).toBeVisible()
    const ideas = column(page, 'Idea').getByRole('button', { name: /, initiative$/ })
    await expect(ideas.first()).toHaveAttribute('aria-label', 'Build the MVP, initiative')
  })

  test('the quick-edit menu changes status and priority', async ({ page }) => {
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'Planned' }).click()
    await expect(
      column(page, 'Planned').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()
  })

  test('keyboard: pick up a card, move it to another column, drop it', async ({ page }) => {
    await keyboardDrag(page, card(page, 'Build the MVP'), ['ArrowRight'])
    await expect(
      column(page, 'Planned').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toBeVisible()
    await expect(
      column(page, 'Idea').getByRole('button', { name: 'Build the MVP, initiative' }),
    ).toHaveCount(0)
  })
})

test.describe('item drawer', () => {
  test('shows everything about a card and edits it in place', async ({ page }) => {
    await openTemplateRoadmap(page)
    await card(page, 'Build the MVP').click()
    const d = drawer(page, 'Build the MVP')
    for (const heading of ['Details', 'Change it here', 'Dependencies'])
      await expect(d.getByRole('heading', { name: heading })).toBeVisible()
    await expect(
      d.getByText('Accounts, the core workflow and the basics of reliability.'),
    ).toBeVisible()
    for (const label of ['Objective', 'Owner', 'Dates', 'Impact', 'Confidence', 'Effort'])
      await expect(d.getByText(label, { exact: true }).first()).toBeVisible()
    await expect(d.getByText('Deliver a usable MVP')).toBeVisible()
    await expect(d.getByText('Tentative').first()).toBeVisible()

    await d.getByLabel('Status').selectOption('shipped')
    await expect(d.getByText('Shipped').first()).toBeVisible()
    await d.getByLabel('Priority').selectOption('critical')
    await d.getByLabel('Column').selectOption('later')
    await d.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect(
      lane(page, 'Later').getByRole('button', { name: 'Build the MVP, initiative' }).locator('..'),
    ).toContainText('Critical')

    // Removing it from the roadmap closes the drawer and can be undone.
    await card(page, 'Build the MVP').click()
    await drawer(page, 'Build the MVP').getByRole('button', { name: 'Remove from roadmap' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await undoToast(page).click()
    await expect(card(page, 'Build the MVP')).toBeVisible()
  })

  test('opens from the keyboard with Enter', async ({ page }) => {
    await openTemplateRoadmap(page)
    await card(page, 'Build the MVP').focus()
    await page.keyboard.press('Enter')
    await expect(drawer(page, 'Build the MVP')).toBeVisible()
  })
})

test.describe('date-based planning', () => {
  test('the column follows the dates, and moving a card changes its dates everywhere', async ({
    page,
  }) => {
    await createFromTemplate(page, 'startup-mvp', 'Orbit')
    await page.goto('/app/roadmaps')
    await page.getByRole('button', { name: 'New roadmap' }).click()
    await drawer(page, 'New roadmap').getByLabel('Name').fill('By date')
    await drawer(page, 'New roadmap')
      .getByRole('radio', { name: /Date-based/ })
      .check()
    await drawer(page, 'New roadmap').getByRole('button', { name: 'Create roadmap' }).click()
    await expect(page.getByText('This roadmap follows dates')).toBeVisible()

    // Customer discovery starts this month, so it is in Now by its dates.
    await expect(
      lane(page, 'Now').getByRole('button', { name: 'Customer discovery interviews, initiative' }),
    ).toBeVisible()
    await expect(
      lane(page, 'Later').getByRole('button', { name: 'Self-serve billing, initiative' }),
    ).toBeVisible()

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

    // Its dates moved, so the timeline shows it later too.
    await tab(page, 'Timeline').click()
    const bar = page.getByRole('button', {
      name: /^Customer discovery interviews, .*Enter opens details/,
    })
    await expect(bar).not.toHaveAttribute('aria-label', /Nov 2026/)
    // And undo puts the dates back.
    await page.getByRole('button', { name: /^Undo: Moved/ }).click()
    await expect(bar).toHaveAttribute('aria-label', /Nov 2026/)
  })
})

test.describe('on a phone', () => {
  test('every view fits the screen and the drawer fills it', async ({ page }) => {
    await openTemplateRoadmap(page)
    await page.setViewportSize({ width: 390, height: 844 })
    for (const view of ['Now, next, later', 'Timeline', 'Board']) {
      await tab(page, view).click()
      await expect(tab(page, view)).toHaveAttribute('aria-selected', 'true')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        view,
      ).toBe(true)
    }
    await tab(page, 'Now, next, later').click()
    await card(page, 'Build the MVP').click()
    const box = (await drawer(page, 'Build the MVP').boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(385)
  })
})
