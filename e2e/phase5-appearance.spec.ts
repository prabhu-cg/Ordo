import fs from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { card, createFromTemplate, drawer, openTemplateRoadmap } from './helpers'

test.use({ viewport: { width: 1440, height: 1100 } })

const cardOf = (page: Page, title: string) => card(page, title).locator('..')
const bg = (loc: Locator) => loc.evaluate((el) => getComputedStyle(el).backgroundColor)

/** Wait until a setting has actually reached the browser's database (it is saved a moment after you choose it). */
const saved = (page: Page, key: string, density?: string) =>
  expect
    .poll(() =>
      page.evaluate(
        ({ k, d }) =>
          new Promise<boolean>((res) => {
            const o = indexedDB.open('ordo')
            o.onsuccess = () => {
              const r = o.result.transaction('meta').objectStore('meta').get(k)
              r.onsuccess = () =>
                res(r.result !== undefined && (!d || r.result.value?.density === d))
            }
          }),
        { k: key, d: density },
      ),
    )
    .toBe(true)

test.describe('status colours', () => {
  test('choose a colour for a status and it changes everywhere that status is shown, and stays after a reload', async ({
    page,
  }) => {
    await openTemplateRoadmap(page) // "Clickable prototype" is Planned: blue by default
    const planned = () =>
      cardOf(page, 'Clickable prototype')
        .locator('span', { hasText: /^Planned$/ })
        .first()
    const before = await bg(planned())
    await page.goto('/app/appearance')
    await expect(page.getByLabel('Colour for Planned')).toHaveValue('info')
    await page.getByLabel('Colour for Planned').selectOption('destructive')
    await saved(page, 'appearance')
    await page.reload()
    await expect(page.getByLabel('Colour for Planned')).toHaveValue('destructive') // kept
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(card(page, 'Clickable prototype')).toBeVisible()
    expect(await bg(planned())).not.toBe(before)
    // The word is still there, so colour is never the only signal.
    await expect(planned()).toHaveText('Planned')
    // The same colour is used on the initiatives table and on the board.
    const onCard = await bg(planned())
    await page.goto('/app/workspace/initiatives')
    const inTable = page
      .getByRole('row', { name: /Clickable prototype/ })
      .locator('span', { hasText: /^Planned$/ })
      .last()
    expect(await bg(inTable)).toBe(onCard)
  })

  test('timeline bars follow the same colours, and in progress stays solid', async ({ page }) => {
    await createFromTemplate(page, 'quarterly', 'Orbit')
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await page.getByRole('tab', { name: 'Timeline' }).click()
    const bars = page.getByTestId(/^bar-/)
    await expect(bars.first()).toBeVisible()
    const before = await Promise.all((await bars.all()).map(bg))
    await page.goto('/app/appearance')
    await page.getByLabel('Colour for In progress').selectOption('success')
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await page.getByRole('tab', { name: 'Timeline' }).click()
    await expect(bars.first()).toBeVisible()
    const after = await Promise.all((await bars.all()).map(bg))
    expect(after).not.toEqual(before)
    expect(after.filter((c) => !before.includes(c)).length).toBeGreaterThan(0)
  })

  test('every status can be set, and reset puts them all back', async ({ page }) => {
    await page.goto('/app/appearance')
    const statuses = ['Idea', 'Planned', 'In progress', 'Shipped', 'Paused', 'Dropped']
    for (const s of statuses) await page.getByLabel(`Colour for ${s}`).selectOption('neutral')
    await page.getByRole('button', { name: 'Reset to defaults' }).click()
    await expect(page.getByText('Appearance reset').first()).toBeVisible()
    const defaults = ['neutral', 'info', 'amber', 'success', 'warning', 'destructive']
    for (const [i, s] of statuses.entries())
      await expect(page.getByLabel(`Colour for ${s}`)).toHaveValue(defaults[i]!)
  })
})

test.describe('density', () => {
  test('compact gives cards and rows less room, comfortable gives it back, and it is remembered', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    const handle = () => card(page, 'Build the MVP')
    const pad = () =>
      handle()
        .locator('..')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop))
    const comfortable = await pad()
    await page.goto('/app/appearance')
    await page.locator('label', { hasText: /^Compact$/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
    await saved(page, 'appearance', 'compact')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact') // remembered
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(handle()).toBeVisible()
    expect(await pad()).toBeLessThan(comfortable)
    // Tables too.
    await page.goto('/app/workspace/initiatives')
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
    const cell = page
      .getByRole('row', { name: /Build the MVP/ })
      .getByRole('cell')
      .first()
    const compactCell = await cell.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop))
    await page.goto('/app/appearance')
    await page.locator('label', { hasText: /^Comfortable$/ }).click()
    await saved(page, 'appearance', 'comfortable')
    await page.goto('/app/workspace/initiatives')
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable')
    const roomyCell = await page
      .getByRole('row', { name: /Build the MVP/ })
      .getByRole('cell')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop))
    expect(compactCell).toBeLessThan(roomyCell)
  })
})

test.describe('card details', () => {
  test('choose which details every card shows; a board with its own choice keeps it', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await expect(cardOf(page, 'Build the MVP')).toContainText('Critical')
    await expect(cardOf(page, 'Build the MVP')).toContainText('Tentative')
    await page.goto('/app/appearance')
    await page.getByRole('checkbox', { name: 'Priority' }).uncheck()
    await page.getByRole('checkbox', { name: 'Tags' }).check()
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(cardOf(page, 'Build the MVP')).not.toContainText('Critical')
    await expect(cardOf(page, 'Build the MVP')).toContainText('Tentative') // untouched details stay
    await page.getByRole('tab', { name: 'Board' }).click()
    await expect(cardOf(page, 'Build the MVP')).not.toContainText('Critical')
    // Setting up the board by hand takes precedence over the default.
    await page.getByRole('button', { name: 'Customise cards' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Priority' }).click()
    await page.keyboard.press('Escape')
    await expect(cardOf(page, 'Build the MVP')).toContainText('Critical')
    await page.getByRole('tab', { name: 'Now, next, later' }).click()
    await expect(cardOf(page, 'Build the MVP')).not.toContainText('Critical') // that view still follows the default
  })

  test('owner is one of the details that can be shown', async ({ page }) => {
    await page.goto('/app/appearance')
    await expect(page.getByRole('checkbox', { name: 'Owner' })).toBeChecked()
  })
})

test.describe('roadmap colour', () => {
  test('a roadmap can have a colour, shown on its cards and in the list', async ({ page }) => {
    await openTemplateRoadmap(page)
    const edge = () =>
      card(page, 'Build the MVP')
        .locator('xpath=ancestor::div[contains(@class,"bg-card")][1]')
        .evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth))
    expect(await edge()).toBe(1) // no accent
    await page.getByRole('button', { name: 'Settings' }).click()
    await drawer(page, 'Roadmap settings')
      .locator('label', { hasText: /^Green$/ })
      .click()
    await drawer(page, 'Roadmap settings').getByRole('button', { name: /Save/ }).click()
    await expect(page.getByText('Roadmap saved').first()).toBeVisible()
    expect(await edge()).toBe(4) // the accent edge
    await page.goto('/app/roadmaps')
    await expect(
      page.getByRole('heading', { level: 2 }).first().locator('span[aria-hidden]'),
    ).toBeVisible()
    // And it can be removed again.
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await drawer(page, 'Roadmap settings')
      .locator('label', { hasText: /^None$/ })
      .click()
    await drawer(page, 'Roadmap settings').getByRole('button', { name: /Save/ }).click()
    await expect(page.getByText('Roadmap saved').first()).toBeVisible()
    expect(await edge()).toBe(1)
  })

  test('the colour comes with a backup and into an export', async ({ page }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'Settings' }).click()
    await drawer(page, 'Roadmap settings')
      .locator('label', { hasText: /^Blue$/ })
      .click()
    await drawer(page, 'Roadmap settings').getByRole('button', { name: /Save/ }).click()
    await expect(page.getByText('Roadmap saved').first()).toBeVisible()
    await page.getByRole('button', { name: 'Export' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /Product backup/ }).click(),
    ])
    const backup = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))
    expect(backup.data.roadmaps[0].color).toBe('info')
  })
})
