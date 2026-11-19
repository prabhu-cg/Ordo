import { expect, type Page } from '@playwright/test'

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
