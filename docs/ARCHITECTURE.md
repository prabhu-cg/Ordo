# Architecture

**Layers, one direction of dependency:** `features/components → store → storage → domain`.

- **domain** — pure Zod schemas and types. No React, no IndexedDB.
- **storage** — Dexie database, repositories, backup. Normalises every failure to `StorageError` (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, `QUOTA_EXCEEDED`, `UNAVAILABLE`, `VERSION_CONFLICT`, `INVALID_BACKUP`, `UNKNOWN`). ESLint forbids importing `dexie` outside `src/storage`, so UI cannot reach IndexedDB.
- **store** — Zustand. `workspace-store` holds products and the active product; `theme-store` holds light/dark (localStorage key `theme`, applied before paint).
- **UI** — reads through stores or `useStorageQuery`, writes through stores. Forms show `StorageError.fieldErrors` next to inputs and `recovery` text for other failures.

**Planning (Phase 2):** `storage/planning.ts` holds every operation that creates, edits or deletes objectives, initiatives and features: parent validation, tag resolution, delete strategies, roadmap/dependency cleanup, product `updatedAt`. `store/planning-store.ts` keeps the open product's records centrally (loaded whenever the active product changes) and re-reads after every write, so the overview, lists, sidebar counts and dashboard all update together. `store/drawer-store.ts` says which drawer or delete confirmation is open, so any page can open one. Filters (search, status, priority, objective, initiative, tag, sort) live in the URL (`features/planning/use-filters.ts`) and are applied by pure functions in `features/planning/query.ts`.

**Roadmaps (Phase 3):** `storage/roadmaps.ts` creates, edits, archives and restores roadmaps and validates every change to `entries` (items must exist, belong to the product, and appear once). `storage/planning.ts` also patches single items (quick edits, date drags), and manages milestones and dependencies. `features/roadmap/engine.ts` is pure (no React, no storage): it joins entries to items (`buildRows`), applies the lane rules, orders and drops cards (`placeEntry`, `resolveDrop`), groups the board, and does the timeline geometry. Every view calls `useRoadmapData`, which reads the shared planning store, so a change anywhere redraws every view. Every edit goes through `features/roadmap/actions.ts`, which writes through storage, refreshes the store, and records how to undo itself in `store/undo-store.ts` (each step is plain data, `UndoOp`s run by `runOps`, so the history is saved per product in the `meta` table under `undo:<productId>` and survives a reload; the last 30 steps are kept, a step that fails is dropped, and restoring a backup clears all of it). Drag and drop uses dnd-kit (mouse, touch and keyboard) for cards; the timeline uses its own pointer handling because bars move continuously by date.

**Prioritisation and templates (Phase 4):** `domain/prioritisation.ts` is the one home of the matrix rule. `features/planning/matrix-page.tsx` reads the shared planning store and writes through `updateWork`, so a score change or hand placement is validated, undoable and visible in every other view. `templates/` holds the six starter definitions, `resolveTemplate` (template → `ProductBundle` with new ids and real dates), and `templateFromRoadmap` (roadmap → custom template); `storage/templates.ts` saves custom templates in their own table and never touches the source product. The template preview (`features/templates/sandbox.ts`) runs the real roadmap views against an in-memory copy by swapping `RoadmapBindings` (`features/roadmap/bindings.ts`), and `planMove` in `engine.ts` is shared by the real app and the preview so both behave the same. Pages load on demand (`app/router.tsx`) and `vite.config.ts` puts React, Radix, dnd-kit and Dexie/Zod in their own cacheable chunks. Schema 2 upgrades version-1 data in Dexie (`storage/migrations.ts`) and old backups (`BACKUP_MIGRATIONS[1]`).

**Boot:** `App` calls `workspace.init()` → opens the DB → loads products → resolves the active product (stored in the `meta` table). Loading and error states are rendered by `StorageGate`.

**Writes are validated at the storage boundary**: every create/update runs the entity's Zod schema inside the transaction, so invalid data can never be persisted regardless of caller. Updates accept `expectedUpdatedAt` to reject stale writes (`CONFLICT`). Each change appends a `Revision` in the same transaction.

**Backup/restore:** `parseBackup` (JSON → version check → migrate → schema validate → reference integrity) never writes. `restoreBackup` replaces all tables in one transaction; failure rolls back.

**Known limits:** no cross-tab sync (a second tab needs a reload); revisions are unbounded (no retention policy yet); restore is replace-only (no merge); soft-deleting a parent does not cascade to children.

- Planning data is not synced between browser tabs; reload the other tab.
- Items have a stored `order` but there is no drag-to-reorder yet ("Manual order" is creation order).
- Deleted items stay in the database (archived) and in revisions; there is no screen to restore a deleted objective, initiative or feature.
