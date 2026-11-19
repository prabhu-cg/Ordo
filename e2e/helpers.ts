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
  const announced = () => text().then((t) => /Picked up|is over/.test(t))
  for (let attempt = 0; attempt < 4; attempt++) {
    await handle.focus()
    await page.keyboard.press('Space')
    // Pick-up is announced and then at once replaced by where the card is.
    const ok = await expect
      .poll(announced, { timeout: 1500 })
      .toBe(true)
      .then(
        () => true,
        () => false,
      )
    if (ok) break
    if (attempt === 3) throw new Error('The card could not be picked up with the keyboard')
    await page.keyboard.press('Escape')
  }
  for (const arrow of arrows) {
    const before = await text()
    await page.keyboard.press(arrow)
    // Go on only once it says it is over something new (the text can blank for a moment in between).
    await expect
      .poll(
        async () => {
          const t = await text()
          return t.includes('is over') && t !== before
        },
        { timeout: 3000 },
      )
      .toBe(true)
  }
  await page.waitForTimeout(100)
  await page.keyboard.press('Space') // the caller then waits for the result it expects, which is the real proof of the drop
}

/** A product from the SaaS template with its roadmap open: 5 initiatives, 3 now/next/later lanes. */
export async function openTemplateRoadmap(page: Page) {
  await createFromTemplate(page, 'saas-mvp', 'Orbit')
  await page.goto('/app/roadmaps')
  await page.getByRole('link', { name: 'Open Roadmap' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Roadmap' })).toBeVisible()
}

export const lane = (page: Page, name: 'Now' | 'Next' | 'Later') =>
  page.getByRole('region', { name: new RegExp(`^${name},`) })
export const card = (scope: Page | Locator, title: string) =>
  scope.getByRole('button', { name: `${title}, initiative` })
