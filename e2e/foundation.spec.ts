import { expect, test } from '@playwright/test'
import { createProduct } from './helpers'

test('create, survive reload, edit, archive and restore a product', async ({ page }) => {
  await createProduct(page, 'Atlas', { tagline: 'Maps for makers' })

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Atlas' })).toBeVisible()
  await expect(page.getByText('Maps for makers')).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Product name').fill('Atlas 2')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Atlas 2' })).toBeVisible()

  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Archive product' }).click()
  await page.getByRole('button', { name: 'Archive product' }).click()
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible()
  await page.getByRole('link', { name: 'Data and backup' }).first().click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('link', { name: 'Workspace' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Atlas 2' })).toBeVisible()
})

test('backup downloads and restore replaces data; invalid files are rejected', async ({ page }) => {
  await createProduct(page, 'Backed up')
  await page.getByRole('link', { name: 'Data and backup' }).first().click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^ordo-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()

  await page
    .getByLabel('Backup file')
    .setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"app":"nope"}'),
    })
  await expect(page.getByText('That file cannot be restored')).toBeVisible()

  await page.getByLabel('Backup file').setInputFiles(path!)
  await page.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(page.getByText('Backup restored').first()).toBeVisible()
})

test('theme toggle persists across reload', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('design system page renders and mobile app navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/app')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Design system' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Colour' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  )
})
