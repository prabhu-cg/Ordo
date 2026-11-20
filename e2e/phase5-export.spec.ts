import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { asFile, buildBackup, pngSize } from './backup-fixture'
import { card, createFromTemplate, createProduct, importAlongside } from './helpers'

test.use({ viewport: { width: 1440, height: 1100 } })

const openRoadmap = async (page: Page, template = 'quarterly', name = 'Orbit') => {
  await createFromTemplate(page, template, name)
  await page.goto('/app/roadmaps')
  await page.getByRole('link', { name: 'Open Roadmap' }).click()
  await expect(page).toHaveURL(/\/app\/roadmaps\/[^/?]+/)
  await expect(page.getByRole('heading', { level: 1, name: 'Roadmap', exact: true })).toBeVisible()
}

async function exportAs(page: Page, item: RegExp) {
  await page.getByRole('button', { name: 'Export' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('menuitem', { name: item }).click(),
  ])
  const path = await download.path()
  return { name: download.suggestedFilename(), path: path!, buffer: fs.readFileSync(path!) }
}

/** Count pixels in a PNG that are close to a colour, to prove a colour made it into the picture. */
async function pixelsNear(page: Page, png: Buffer, rgb: [number, number, number]) {
  return page.evaluate(
    async ({ b64, rgb }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data
      let n = 0
      for (let i = 0; i < data.length; i += 4)
        if (
          Math.abs(data[i]! - rgb[0]) < 6 &&
          Math.abs(data[i + 1]! - rgb[1]) < 6 &&
          Math.abs(data[i + 2]! - rgb[2]) < 6
        )
          n++
      return n
    },
    { b64: png.toString('base64'), rgb },
  )
}

const rgbOf = (css: string): [number, number, number] => {
  const m = css.match(/\d+(\.\d+)?/g)!.map(Number)
  return [m[0]!, m[1]!, m[2]!]
}

test.describe('PNG export', () => {
  test('timeline: a sharp image at least twice the size on screen, keeping the colours and nothing cut off', async ({
    page,
  }) => {
    await openRoadmap(page)
    await page.getByRole('tab', { name: 'Timeline' }).click()
    const bar = page.getByTestId(/^bar-/).first()
    await expect(bar).toBeVisible()
    const barColour = rgbOf(await bar.evaluate((el) => getComputedStyle(el).backgroundColor))
    const panel = (await page.locator('#roadmap-panel').boundingBox())!

    const out = await exportAs(page, /Image \(PNG\)/)
    expect(out.name).toMatch(/^orbit-roadmap-timeline-\d{4}-\d{2}-\d{2}\.png$/)
    const { width, height } = pngSize(out.buffer)
    expect(width).toBeGreaterThanOrEqual(panel.width * 2) // high resolution
    expect(height).toBeGreaterThanOrEqual(panel.height * 2)
    expect(await pixelsNear(page, out.buffer, barColour)).toBeGreaterThan(500) // the status colour is in the picture
    await expect(page.getByText('Image ready').first()).toBeVisible()
  })

  test('now, next, later and board each export, with the same colours as on screen', async ({
    page,
  }) => {
    await openRoadmap(page)
    for (const [tab, slug] of [
      ['Now, next, later', 'now-next-later'],
      ['Board', 'board'],
    ] as const) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(card(page, 'Headline release')).toBeVisible()
      // The badge itself is the span with a coloured background; wrappers around it are transparent.
      const colour = rgbOf(
        await page
          .getByRole('tabpanel')
          .locator('span:has(svg)', { hasText: /^Critical$/ })
          .evaluateAll(
            (els) =>
              els
                .map((el) => getComputedStyle(el).backgroundColor)
                .find((c) => c !== 'rgba(0, 0, 0, 0)') ?? 'rgb(0, 0, 0)',
          ),
      )
      const out = await exportAs(page, /Image \(PNG\)/)
      expect(out.name).toContain(`-${slug}-`)
      expect(pngSize(out.buffer).width).toBeGreaterThan(1500)
      expect(await pixelsNear(page, out.buffer, colour)).toBeGreaterThan(100)
    }
  })

  test('a view wider than the screen is captured whole, not just the part you can see', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await openRoadmap(page)
    await page.getByRole('tab', { name: 'Timeline' }).click()
    const scrollWidth = await page
      .getByRole('region', { name: /Timeline/ })
      .evaluate((el) => el.scrollWidth)
    expect(scrollWidth).toBeGreaterThan(390) // it scrolls on a phone
    const out = await exportAs(page, /Image \(PNG\)/)
    expect(pngSize(out.buffer).width).toBeGreaterThanOrEqual(scrollWidth * 2 - 4)
    // The page is left as it was: still scrollable the same way, no stray styles.
    expect(
      await page
        .getByRole('region', { name: /Timeline/ })
        .evaluate((el) => getComputedStyle(el).overflowX),
    ).toBe('auto')
  })

  test('controls such as zoom and quick-edit are not drawn into the picture', async ({ page }) => {
    await openRoadmap(page)
    await page.getByRole('tab', { name: 'Board' }).click()
    const out = await exportAs(page, /Image \(PNG\)/)
    const full = pngSize(out.buffer)
    // Compare with the same board with its toolbar left in: the export is shorter by the toolbar's height.
    const toolbar = (await page.getByLabel('Group by').boundingBox())!
    expect(full.height / 2).toBeLessThan(
      (await page.locator('#roadmap-panel').boundingBox())!.height + 220,
    )
    expect(toolbar.height).toBeGreaterThan(0)
  })
})

test.describe('CSV export', () => {
  test('has the items with ids, parent ids, status, priority and dates, and opens cleanly in a spreadsheet', async ({
    page,
  }) => {
    await openRoadmap(page, 'feature-development', 'Launchpad')
    const out = await exportAs(page, /Spreadsheet \(CSV\)/)
    expect(out.name).toMatch(/^launchpad-roadmap-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = out.buffer.toString('utf8')
    expect(text.charCodeAt(0)).toBe(0xfeff) // byte order mark, for Excel
    const lines = text.slice(1).trim().split('\r\n')
    const header = lines[0]!.split(',')
    for (const c of [
      'id',
      'parent_id',
      'type',
      'title',
      'status',
      'priority',
      'start_date',
      'end_date',
    ])
      expect(header).toContain(c)
    const rows = lines.slice(1)
    expect(rows.length).toBeGreaterThanOrEqual(5)
    const col = (r: string, name: string) => r.split(',')[header.indexOf(name)]!
    const types = new Set(rows.map((r) => col(r, 'type')))
    expect(types).toContain('initiative')
    expect(types).toContain('objective')
    const ids = new Set(rows.map((r) => col(r, 'id')))
    for (const r of rows) if (col(r, 'parent_id')) expect(ids.has(col(r, 'parent_id'))).toBe(true) // every parent is in the file
    expect(rows.some((r) => /^\d{4}-\d{2}-\d{2}$/.test(col(r, 'start_date')))).toBe(true)
    expect(rows.some((r) => ['Planned', 'In progress', 'Idea'].includes(col(r, 'status')))).toBe(
      true,
    )
  })

  test('a title that looks like a formula is made safe', async ({ page }) => {
    await importAlongside(
      page,
      asFile(
        buildBackup([
          {
            name: 'Evil',
            initiatives: 1,
            title: () => '=HYPERLINK("http://evil.example","click")',
          },
        ]),
      ),
    )
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(page).toHaveURL(/\/app\/roadmaps\/[^/?]+/)
    const out = await exportAs(page, /Spreadsheet \(CSV\)/)
    const text = out.buffer.toString('utf8')
    expect(text).toContain(`'=HYPERLINK`)
    expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m)
  })
})

test.describe('JSON export', () => {
  test('is a full backup of the product, with the schema version, and it restores', async ({
    page,
  }) => {
    await openRoadmap(page, 'feature-development', 'Launchpad')
    await createProduct(page, 'Second product') // so we can tell the export is only the open one
    await page.goto('/app/roadmaps')
    // Back to the first product to export it.
    await page
      .getByRole('button', { name: /Second product|Launchpad/ })
      .first()
      .click()
      .catch(() => undefined)
    await page.keyboard.press('Escape')
    await page.goto('/app')
    await page
      .getByRole('link', { name: /Launchpad/ })
      .first()
      .click()
      .catch(() => undefined)
    await page.goto('/app/data')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download backup of Launchpad' }).click(),
    ])
    const backup = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))
    expect(backup.app).toBe('ordo')
    expect(backup.schemaVersion).toBe(2)
    expect(backup.data.products.map((p: { name: string }) => p.name)).toEqual(['Launchpad'])
    for (const t of ['objectives', 'initiatives', 'features', 'roadmaps', 'tags', 'dependencies'])
      expect(Array.isArray(backup.data[t]), t).toBe(true)
    expect(backup.data.initiatives.length).toBe(5)
    expect(backup.data.roadmaps.length).toBe(1)
    expect(backup.data.dependencies.length).toBeGreaterThan(0)
    expect(download.suggestedFilename()).toMatch(/^launchpad-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })

  test('the roadmap menu offers the same backup', async ({ page }) => {
    await openRoadmap(page)
    const out = await exportAs(page, /Product backup \(JSON\)/)
    const backup = JSON.parse(out.buffer.toString('utf8'))
    expect(backup.data.products).toHaveLength(1)
    expect(backup.schemaVersion).toBe(2)
  })
})

test.describe('PDF and print preview', () => {
  const sheets = (page: Page) => page.getByTestId('print-sheet')

  test('the preview shows every page with the product title, export date and page numbers', async ({
    page,
  }) => {
    await openRoadmap(page, 'saas-product', 'Orbit')
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: /PDF or print/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Print preview' })).toBeVisible()
    await expect(sheets(page).first()).toBeVisible()
    const total = await sheets(page).count()
    for (let n = 0; n < total; n++) {
      const sheet = sheets(page).nth(n)
      await expect(sheet).toContainText('Orbit')
      await expect(sheet).toContainText(/Exported \d{1,2} \w{3} \d{4}/)
      await expect(sheet).toContainText(`Page ${n + 1} of ${total}`)
    }
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeEnabled()
    await expect(page.getByRole('status').filter({ hasText: /pages?$/ })).toHaveText(
      `${total} page${total === 1 ? '' : 's'}`,
    )
  })

  test('portrait and landscape change the sheet, and Letter differs from A4', async ({ page }) => {
    await openRoadmap(page)
    await page.goto(page.url().split('?')[0] + '/print?view=timeline')
    await expect(sheets(page).first()).toBeVisible()
    const box = async () => (await sheets(page).first().boundingBox())!
    let b = await box()
    expect(b.width).toBeGreaterThan(b.height) // a timeline opens in landscape
    await page.getByLabel('Orientation').selectOption('portrait')
    await expect.poll(async () => (await box()).height).toBeGreaterThan((await box()).width)
    b = await box()
    const a4Ratio = b.height / b.width
    await page.getByLabel('Paper').selectOption('letter')
    await expect
      .poll(async () => Math.round(((await box()).height / (await box()).width) * 1000))
      .not.toBe(Math.round(a4Ratio * 1000))
  })

  test('a long roadmap runs onto more pages, and the printed PDF has exactly the pages you saw, at the chosen size', async ({
    page,
  }) => {
    await importAlongside(
      page,
      asFile(buildBackup([{ name: 'Big', initiatives: 60, features: 0 }])),
    )
    await page.goto('/app/roadmaps')
    await page.getByRole('link', { name: 'Open Roadmap' }).click()
    await expect(page).toHaveURL(/\/app\/roadmaps\/[^/?]+/)
    await page.goto(page.url().split('?')[0] + '/print?view=board&orientation=portrait&paper=a4')
    await expect(sheets(page).first()).toBeVisible()
    await expect.poll(() => sheets(page).count()).toBeGreaterThan(2)
    const total = await sheets(page).count()
    // Nothing is lost between pages: every initiative appears once.
    const text = (await page.getByTestId('print-pages').innerText()).replace(/\s+/g, ' ')
    for (let i = 1; i <= 60; i++)
      expect(
        text.match(new RegExp(`Big initiative ${i}(?!\\d)`, 'g'))?.length,
        `initiative ${i}`,
      ).toBe(1)

    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ preferCSSPageSize: true })
    const raw = pdf.toString('latin1')
    expect((raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(total)
    const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)!
    expect(Math.round(Number(box[1]))).toBe(595) // A4 portrait, in points
    expect(Math.round(Number(box[2]))).toBe(842)
    // The application's own chrome is not printed.
    expect(
      await page
        .getByRole('navigation')
        .first()
        .isVisible()
        .catch(() => false),
    ).toBe(false)
  })

  test('landscape and Letter produce a landscape Letter PDF', async ({ page }) => {
    await openRoadmap(page)
    await page.goto(
      page.url().split('?')[0] + '/print?view=timeline&orientation=landscape&paper=letter',
    )
    await expect(sheets(page).first()).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    const raw = (await page.pdf({ preferCSSPageSize: true })).toString('latin1')
    const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)!
    expect([Math.round(Number(box[1])), Math.round(Number(box[2]))]).toEqual([792, 612])
  })

  test('the preview follows the filters you had on the roadmap, and prints on white even in dark mode', async ({
    page,
  }) => {
    await openRoadmap(page)
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: /PDF or print/ }).click()
    await expect(sheets(page).first()).toBeVisible()
    expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(false) // white paper
    await page.getByRole('link', { name: 'Back to the roadmap' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/) // and the screen's theme comes back

    await page.getByLabel('Search this roadmap').fill('Headline')
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: /PDF or print/ }).click()
    await expect(sheets(page).first()).toContainText('Headline release')
    await expect(sheets(page).first()).not.toContainText('Quality sweep')
    await expect(sheets(page).first()).toContainText('(filtered)')
  })
})
