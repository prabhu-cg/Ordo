# Ordo

A local-first product roadmap builder. **Plan better. Build smarter**

Phase 0 (foundation) is complete: app shell, design system, versioned data model and IndexedDB storage. Roadmap features arrive in later phases.

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
  domain/v1/           Zod schemas and types for every entity (versioned)
  storage/             The only code allowed to touch Dexie/IndexedDB
    db.ts              Tables · migrations.ts  Schema versions
    repository.ts      Generic CRUD, safe update, soft delete, revisions
    repositories/      One repository per entity
    backup.ts          Export, validate, migrate, restore
    errors.ts          StorageError and mapping from raw failures
  store/               Zustand: workspace (products) and theme
  features/            workspace, data (backup/restore), design-system pages
  lib/                 utils, date formatting, useStorageQuery
e2e/                   Playwright specs
docs/                  Architecture, data model, database, design system
```

See `docs/` for details. Design tokens follow the Doxa system (`PRODUCT.md` records product context).
