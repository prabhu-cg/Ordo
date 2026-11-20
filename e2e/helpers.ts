import { expect, type Locator, type Page } from '@playwright/test'

/** Walk the guided flow from scratch with just a name (and optional extras). */
export async function createProduct(page: Page, name: string, extra: { tagline?: string } = {}) {
  await page.goto('/app/new')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Product name').fill(name)
  if (extra.tagline) await page.getByLabel('Short description').fill(extra.tagline)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

export async function createFromTemplate(page: Page, templateId: string, name: string) {
  await page.goto(`/app/new?template=${templateId}`)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Product name').fill(name)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** The open item drawer (a right-hand dialog). */
export const drawer = (page: Page, name: RegExp | string) => page.getByRole('dialog', { name })

/** Drag with the real mouse, in small steps so drag libraries see a gesture rather than a jump. */
export async function dragTo(
  page: Page,
  from: Locator,
  to: Locator,
  offset: { x?: number; y?: number } = {},
) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  const sx = a.x + a.width / 2
  const sy = a.y + a.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 8, sy + 8, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2 + (offset.x ?? 0), b.y + b.height / 2 + (offset.y ?? 0), {
    steps: 14,
  })
  // A person pauses before letting go. Wait for the drag library to say it is over something, so this holds under load.
  await page
    .locator('[id^="DndLiveRegion"]')
    .filter({ hasText: /is over / })
    .waitFor({ state: 'attached', timeout: 3000 })
    .catch(() => {})
  await page.waitForTimeout(150)
  await page.mouse.up()
}

/**
 * Move a card with the keyboard: focus it, Space to pick up, the arrows, Space to drop. It waits for the
 * drag library's own announcements between steps, and re-focuses if the page re-rendered under it, so it
 * behaves the same on a busy machine.
 */
export async function keyboardDrag(page: Page, handle: Locator, arrows: string[]) {
  const live = page.locator('[id^="DndLiveRegion"]')
  const text = async () => (await live.textContent()) ?? ''
  const poll = (fn: () => Promise<boolean>, timeout: number) =>
    expect
      .poll(fn, { timeout })
      .toBe(true)
      .then(
        () => true,
        () => false,
      )

  // If the page re-renders while a card is held (it can, on a busy machine) the drag is lost, so start over.
  for (let round = 0; round < 4; round++) {
    await handle.focus()
    await page.keyboard.press('Space')
    // Pick-up is announced and then at once replaced by where the card is.
    if (!(await poll(() => text().then((t) => /Picked up|is over/.test(t)), 1500))) {
      await page.keyboard.press('Escape')
      continue
    }
    // dnd-kit starts listening for the arrow keys a moment after it announces the pick-up.
    await page.waitForTimeout(250)
    let lost = false
    for (const arrow of arrows) {
      const before = await text()
      await page.keyboard.press(arrow)
      const moved = await poll(async () => {
        const t = await text()
        return t.includes('is over') && t !== before
      }, 2000)
      if (!moved) {
        lost = true
        break
      }
    }
    if (!lost) {
      await page.waitForTimeout(100)
      await page.keyboard.press('Space') // the caller then waits for the result it expects, which is the real proof of the drop
      return
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  throw new Error('The card could not be moved with the keyboard')
}

/** A product from the SaaS template with its roadmap open: 5 initiatives, 3 now/next/later lanes. */
export async function openTemplateRoadmap(page: Page) {
  await createFromTemplate(page, 'startup-mvp', 'Orbit')
  await page.goto('/app/roadmaps')
  await page.getByRole('link', { name: 'Open Roadmap' }).click()
  await expect(page).toHaveURL(/\/app\/roadmaps\/[^/?]+/)
  await expect(page.getByRole('heading', { level: 1, name: 'Roadmap', exact: true })).toBeVisible()
}

export const lane = (page: Page, name: 'Now' | 'Next' | 'Later') =>
  page.getByRole('region', { name: new RegExp(`^${name},`) })
export const card = (scope: Page | Locator, title: string) =>
  scope.getByRole('button', { name: `${title}, initiative` })

/** Import a backup file on the Data page, adding it alongside what is already there. */
export async function importAlongside(
  page: Page,
  file: Parameters<ReturnType<Page['getByLabel']>['setInputFiles']>[0],
) {
  await page.goto('/app/data')
  await page.getByLabel('Backup file').setInputFiles(file)
  await expect(page.getByRole('dialog', { name: 'What is in this backup' })).toBeVisible()
  await page.getByRole('button', { name: 'Add alongside what I have' }).click()
  // The toast says exactly "Imported". (The dialog's own text also contains the word, so match the whole text.)
  await expect(page.getByText('Imported', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
