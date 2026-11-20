# Ordo

A local-first product roadmap builder. **Plan better. Build smarter**

Built so far: foundation (shell, design system, versioned data model, IndexedDB storage), the public landing page and onboarding, and the product planning workspace (objectives with measurable outcomes, initiatives, features, search and filters, integrity-checked deletes). Roadmaps in three views (now/next/later, timeline, board) with drag and drop, undo and dependencies, prioritisation and templates, and export (PNG, PDF/print, CSV, JSON), import and restore, appearance settings and data management. No server or external service is needed: everything is stored in the browser. See `docs/RELEASE.md` for the release report and `docs/DEPLOYMENT.md` to deploy it.

## Commands

| Command                           | What it does                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server at http://localhost:5173                                                                   |
| `npm run build`                   | Typecheck and production build to `dist/`                                                             |
| `npm run preview`                 | Serve the production build                                                                            |
| `npm test`                        | Vitest unit and integration tests                                                                     |
| `npm run test:e2e`                | Playwright end-to-end tests (builds and serves the app; first run: `npx playwright install chromium`) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                                     |
| `npm run check`                   | Typecheck, lint, tests and build                                                                      |

## Folder structure

```
src/
  app/                 App root and router
  components/ui/       Design-system components (shadcn-style, Radix + Tailwind)
  components/shell/    Sidebar, header, product switcher, product form
  domain/schema/       Zod schemas and types for every entity (schema version 2)
  storage/             The only code allowed to touch Dexie/IndexedDB
    db.ts              Tables · migrations.ts  Schema versions
    repository.ts      Generic CRUD, safe update, soft delete, revisions
    repositories/      One repository per entity
    backup.ts          Export, validate, migrate, restore
    portability.ts     Per-product export, import alongside (never overwrites), erase everything
    errors.ts          StorageError and mapping from raw failures
  store/               Zustand: workspace (products) and theme
  features/            marketing, dashboard, new-product, onboarding, example,
                       workspace (overview), planning (objectives, initiatives, features),
                       roadmap (list, three views, drawers, engine, actions),
                       data (export, import, restore, delete), export (PNG, CSV, print/PDF), appearance,
                       templates, design-system pages
  templates/           Read-only starter templates and the resolver that copies one into a product
  lib/                 utils, date formatting, useStorageQuery
e2e/                   Playwright specs
docs/                  Architecture, data model, database, design system
```

See `docs/` for details. Design tokens follow the Doxa system (`PRODUCT.md` records product context).
