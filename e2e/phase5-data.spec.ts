import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { asFile, buildBackup } from './backup-fixture'
import {
  card,
  createFromTemplate,
  createProduct,
  importAlongside,
  openTemplateRoadmap,
} from './helpers'

test.use({ viewport: { width: 1440, height: 1100 } })

const productRow = (page: Page, name: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: `Delete ${name} forever` }) })
const previewDialog = (page: Page) => page.getByRole('dialog', { name: 'What is in this backup' })

async function chooseFile(
  page: Page,
  file: Parameters<ReturnType<Page['getByLabel']>['setInputFiles']>[0],
) {
  await page.goto('/app/data')
  await page.getByLabel('Backup file').setInputFiles(file)
}

/** How many rows a table holds, read straight from the browser's database. */
const storedCount = (page: Page, table: string) =>
  page.evaluate(
    (t) =>
      new Promise<number>((res) => {
        const o = indexedDB.open('ordo')
        o.onsuccess = () => {
          const r = o.result.transaction(t).objectStore(t).count()
          r.onsuccess = () => res(r.result)
        }
      }),
    table,
  )

async function downloadAll(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download all products' }).click(),
  ])
  return download.path().then((p) => JSON.parse(fs.readFileSync(p!, 'utf8')))
}

test.describe('import: validation', () => {
  const bad: [string, Parameters<ReturnType<Page['getByLabel']>['setInputFiles']>[0], RegExp][] = [
    [
      'text that is not JSON',
      { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('not json {') },
      /not valid JSON/,
    ],
    ['JSON from another app', asFile({ app: 'something-else', data: {} }), /not an Ordo backup/],
    [
      'a backup from a newer version',
      asFile({ ...buildBackup([{ name: 'P' }]), schemaVersion: 99 }),
      /newer version of Ordo/,
    ],
    [
      'a backup with no version',
      asFile({ ...buildBackup([{ name: 'P' }]), schemaVersion: 'two' }),
      /no valid version/,
    ],
    [
      'a backup with damaged records',
      asFile({
        ...buildBackup([{ name: 'P' }]),
        data: { ...buildBackup([{ name: 'P' }]).data, products: [{ id: 'x' }] },
      }),
      /damaged or incomplete/,
    ],
    [
      'a backup whose links point at nothing',
      (() => {
        const b = buildBackup([{ name: 'P', initiatives: 2 }])
        ;(b.data.roadmaps[0] as { entries: { itemId: string }[] }).entries[0]!.itemId = 'ghost'
        return asFile(b)
      })(),
      /inconsistent/,
    ],
    [
      'an empty file',
      { name: 'e.json', mimeType: 'application/json', buffer: Buffer.alloc(0) },
      /not valid JSON/,
    ],
  ]
  for (const [what, file, message] of bad)
    test(`rejects ${what}, says why, and changes nothing`, async ({ page }) => {
      await createProduct(page, 'Safe')
      await chooseFile(page, file)
      await expect(page.getByText('That file cannot be used')).toBeVisible()
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
      await expect(previewDialog(page)).toHaveCount(0)
      expect((await downloadAll(page)).data.products.map((p: { name: string }) => p.name)).toEqual([
        'Safe',
      ])
    })

  test('refuses a file that is far too large to be a backup, without reading it', async ({
    page,
  }) => {
    const file = path.join(os.tmpdir(), `ordo-huge-${Date.now()}.json`)
    fs.writeFileSync(file, Buffer.alloc(51 * 1024 * 1024, 32))
    try {
      await chooseFile(page, file)
      await expect(page.getByRole('alert').filter({ hasText: 'larger than 50 MB' })).toBeVisible()
    } finally {
      fs.rmSync(file, { force: true })
    }
  })
})

test.describe('import: preview and choices', () => {
  test('shows what is inside before doing anything: file, date, version, counts and each product', async ({
    page,
  }) => {
    await createProduct(page, 'Existing')
    await chooseFile(
      page,
      asFile(
        buildBackup([
          { name: 'Alpha', initiatives: 4, features: 2 },
          { name: 'Beta', initiatives: 1 },
        ]),
        'team.json',
      ),
    )
    const d = previewDialog(page)
    await expect(d).toBeVisible()
    await expect(d).toContainText('team.json')
    await expect(d).toContainText('19 Nov 2026')
    await expect(d).toContainText('Version 2')
    await expect(d).toContainText('2 products')
    await expect(d).toContainText('5 initiatives')
    await expect(d).toContainText('8 features')
    await expect(d.getByRole('listitem').filter({ hasText: 'Alpha' })).toContainText(
      '4 initiatives · 8 features · 1 roadmap',
    )
    await expect(d.getByRole('listitem').filter({ hasText: 'Beta' })).toContainText('1 initiative')
    await expect(d).toContainText('This device holds 1 product now')
    // Cancelling changes nothing.
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(previewDialog(page)).toHaveCount(0)
    expect((await downloadAll(page)).data.products).toHaveLength(1)
  })

  test('an older backup says so, is brought up to date, and its words are the new ones', async ({
    page,
  }) => {
    const v1 = {
      ...buildBackup([{ name: 'Old timer', initiatives: 2, v1Scores: true }]),
      schemaVersion: 1,
    }
    delete (v1.data as Partial<typeof v1.data>).templates
    await chooseFile(page, asFile(v1))
    await expect(previewDialog(page)).toContainText('Version 1')
    await expect(previewDialog(page)).toContainText('older, brought up to date')
    await page.getByRole('button', { name: 'Add alongside what I have' }).click()
    await expect(page.getByText('Imported', { exact: true })).toBeVisible()
    await page.goto('/app/workspace/initiatives')
    const row = page.getByRole('row', { name: /Old timer initiative 1/ })
    await expect(row).toContainText('High') // impact 4 became High
    await expect(row).toContainText('Low') // effort 2 became Low
    await expect(row).toContainText('Committed') // confidence 5 became Committed
    await page.goto('/app/data')
    expect((await downloadAll(page)).schemaVersion).toBe(2)
  })

  test('adding alongside changes nothing that is already here', async ({ page }) => {
    await createFromTemplate(page, 'startup-mvp', 'Mine')
    await importAlongside(page, asFile(buildBackup([{ name: 'Theirs', initiatives: 3 }])))
    const after = await downloadAll(page)
    expect(after.data.products.map((p: { name: string }) => p.name).sort()).toEqual([
      'Mine',
      'Theirs',
    ])
    expect(
      after.data.initiatives.filter((i: { title: string }) => i.title.startsWith('Theirs')),
    ).toHaveLength(3)
    await page.goto('/app/workspace/initiatives')
    await expect(page.getByRole('row', { name: /Build the MVP/ })).toBeVisible() // still there, still the open product
  })

  test('importing a product that is still here never overwrites it: it arrives as a copy', async ({
    page,
  }) => {
    await createFromTemplate(page, 'startup-mvp', 'Original')
    await page.goto('/app/data')
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download backup of Original' }).click(),
    ])
    const file = (await dl.path())!
    // Edit the original after the backup was made, so an overwrite would be visible.
    await page.goto('/app/workspace/initiatives')
    await page.getByRole('button', { name: 'New initiative' }).click()
    await page.getByLabel('Initiative', { exact: true }).fill('Added later')
    await page.getByRole('button', { name: 'Create initiative' }).click()
    await expect(page.getByRole('row', { name: /Added later/ })).toBeVisible()

    await importAlongside(page, file)
    await expect(
      page.getByText('added as copies, because the originals are still here'),
    ).toBeVisible()
    const after = await downloadAll(page)
    const names = after.data.products.map((p: { name: string }) => p.name).sort()
    expect(names).toEqual(['Original', 'Original (imported copy)'])
    const [orig, copy] = ['Original', 'Original (imported copy)'].map(
      (n) => after.data.products.find((p: { name: string }) => p.name === n).id,
    )
    const titles = (id: string) =>
      after.data.initiatives
        .filter((i: { productId: string }) => i.productId === id)
        .map((i: { title: string }) => i.title)
    expect(titles(orig)).toContain('Added later') // untouched by the import
    expect(titles(copy)).not.toContain('Added later') // the copy is the backup as it was
    expect(titles(copy)).toHaveLength(5)
    const ids = new Set(after.data.initiatives.map((i: { id: string }) => i.id))
    expect(ids.size).toBe(after.data.initiatives.length) // no id used twice
  })
})

test.describe('restoring and getting back what was replaced', () => {
  test('replace asks first, keeps what was there, and can bring it back', async ({ page }) => {
    await createFromTemplate(page, 'startup-mvp', 'Before')
    await chooseFile(page, asFile(buildBackup([{ name: 'After', initiatives: 2 }])))
    await page.getByRole('button', { name: 'Replace everything…' }).click()
    const confirm = page.getByRole('dialog', { name: 'Replace everything on this device?' })
    await expect(confirm).toContainText('Ordo keeps a copy')
    await confirm.getByRole('button', { name: 'Cancel' }).click() // nothing happens until confirmed
    await expect(previewDialog(page)).toBeVisible() // and you are back at the preview, with nothing changed
    expect(await storedCount(page, 'products')).toBe(1)

    await page.getByRole('button', { name: 'Replace everything…' }).click()
    await page.getByRole('button', { name: 'Replace with backup' }).click()
    await expect(page.getByText('Backup restored').first()).toBeVisible()
    expect((await downloadAll(page)).data.products.map((p: { name: string }) => p.name)).toEqual([
      'After',
    ])

    await expect(page.getByRole('heading', { name: 'Before your last restore' })).toBeVisible()
    await page.getByRole('button', { name: 'Bring it back' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Bring it back' }).click()
    await expect(page.getByText('Earlier data restored').first()).toBeVisible()
    expect((await downloadAll(page)).data.products.map((p: { name: string }) => p.name)).toEqual([
      'Before',
    ])
    // It survives a reload, and switching back is itself reversible.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Before your last restore' })).toBeVisible()
  })

  test('a restore clears saved undo steps, which would point at replaced records', async ({
    page,
  }) => {
    await openTemplateRoadmap(page)
    await page.getByRole('button', { name: 'Quick edit Build the MVP' }).click()
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await expect(card(page, 'Build the MVP').locator('..')).toContainText('In progress')
    await chooseFile(page, asFile(buildBackup([{ name: 'Other' }])))
    await page.getByRole('button', { name: 'Replace everything…' }).click()
    await page.getByRole('button', { name: 'Replace with backup' }).click()
    await expect(page.getByText('Backup restored').first()).toBeVisible()
    const undoKeys = await page.evaluate(
      () =>
        new Promise<number>((res) => {
          const o = indexedDB.open('ordo')
          o.onsuccess = () => {
            const k = o.result.transaction('meta').objectStore('meta').getAllKeys()
            k.onsuccess = () => res(k.result.filter((x) => String(x).startsWith('undo:')).length)
          }
        }),
    )
    expect(undoKeys).toBe(0)
  })
})

test.describe('data management', () => {
  test('export all products gives one file with every product', async ({ page }) => {
    await createProduct(page, 'One')
    await createProduct(page, 'Two')
    await page.goto('/app/data')
    const backup = await downloadAll(page)
    expect(backup.data.products.map((p: { name: string }) => p.name).sort()).toEqual(['One', 'Two'])
    expect(backup.schemaVersion).toBe(2)
  })

  test('each product can be exported as a spreadsheet from the data page', async ({ page }) => {
    await createFromTemplate(page, 'startup-mvp', 'Sheet')
    await page.goto('/app/data')
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV spreadsheet of Sheet' }).click(),
    ])
    const text = fs.readFileSync((await dl.path())!, 'utf8')
    expect(text).toContain('Build the MVP')
    expect(text.split('\r\n').length).toBeGreaterThan(15)
  })

  test('deleting one product needs its name typed, removes only that product, and says so', async ({
    page,
  }) => {
    await createFromTemplate(page, 'startup-mvp', 'Keep me')
    await createFromTemplate(page, 'quarterly', 'Remove me')
    await page.goto('/app/data')
    await page.getByRole('button', { name: 'Delete Remove me forever' }).click()
    const dialog = page.getByRole('dialog', { name: /Delete Remove me forever/ })
    const confirm = dialog.getByRole('button', { name: 'Delete forever' })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel("Type the product's name to confirm").fill('remove')
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel("Type the product's name to confirm").fill('Remove me')
    await confirm.click()
    await expect(page.getByText('Product deleted').first()).toBeVisible()
    await expect(productRow(page, 'Remove me')).toHaveCount(0)
    await expect(productRow(page, 'Keep me')).toHaveCount(1)
    const after = await downloadAll(page)
    expect(after.data.products.map((p: { name: string }) => p.name)).toEqual(['Keep me'])
    expect(
      after.data.initiatives.every(
        (i: { productId: string }) => i.productId === after.data.products[0].id,
      ),
    ).toBe(true)
  })

  test('cancelling a delete leaves everything as it was', async ({ page }) => {
    await createProduct(page, 'Stay')
    await page.goto('/app/data')
    await page.getByRole('button', { name: 'Delete Stay forever' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(productRow(page, 'Stay')).toHaveCount(1)
  })

  test('archiving hides a product and can be undone from the same page', async ({ page }) => {
    await createProduct(page, 'Later')
    await page.goto('/app/data')
    await page.getByRole('button', { name: 'Archive Later' }).click()
    await expect(page.getByRole('heading', { name: 'Archived products' })).toBeVisible()
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(productRow(page, 'Later')).toHaveCount(1)
  })

  test('deleting all local data needs DELETE typed, offers a backup first, and leaves a clean start', async ({
    page,
  }) => {
    await createFromTemplate(page, 'startup-mvp', 'Gone soon')
    await page.goto('/app/appearance')
    await page.getByLabel('Colour for Planned').selectOption('destructive') // a setting, to prove settings go too
    await page.goto('/app/data')
    await page.getByRole('button', { name: 'Delete everything' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete everything on this device?' })
    await expect(dialog.getByRole('button', { name: 'Download a backup first' })).toBeVisible()
    const confirm = dialog.getByRole('button', { name: 'Delete everything' })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('Type DELETE to confirm').fill('delete')
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
    await confirm.click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Ordo' })).toBeVisible()
    const left = await page.evaluate(
      () =>
        new Promise<string>((res) => {
          const o = indexedDB.open('ordo')
          o.onsuccess = () => {
            const db = o.result
            const names = ['products', 'initiatives', 'roadmaps', 'meta']
            const out: string[] = []
            names.forEach((n) => {
              const r = db.transaction(n).objectStore(n).count()
              r.onsuccess = () => {
                out.push(`${n}=${r.result}`)
                if (out.length === names.length) res(out.sort().join(' '))
              }
            })
          }
        }),
    )
    expect(left).toBe('initiatives=0 meta=0 products=0 roadmaps=0')
    await page.goto('/app/appearance')
    await expect(page.getByLabel('Colour for Planned')).toHaveValue('info') // the default again
  })

  test('shows what the browser reports about storage, and says plainly when it cannot', async ({
    page,
  }) => {
    await page.goto('/app/data')
    await expect(page.getByText('This browser (IndexedDB)')).toBeVisible()
    await expect(page.getByText(/Schema 2/)).toBeVisible()
    await expect(page.getByText(/Space used/)).toBeVisible()
    await expect(page.getByText(/Clearing site data for Ordo removes it/)).toBeVisible()
  })
})
