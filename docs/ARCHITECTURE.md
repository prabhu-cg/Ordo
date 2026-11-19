# Architecture

**Layers, one direction of dependency:** `features/components → store → storage → domain`.

- **domain** — pure Zod schemas and types. No React, no IndexedDB.
- **storage** — Dexie database, repositories, backup. Normalises every failure to `StorageError` (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, `QUOTA_EXCEEDED`, `UNAVAILABLE`, `VERSION_CONFLICT`, `INVALID_BACKUP`, `UNKNOWN`). ESLint forbids importing `dexie` outside `src/storage`, so UI cannot reach IndexedDB.
- **store** — Zustand. `workspace-store` holds products and the active product; `theme-store` holds light/dark (localStorage key `theme`, applied before paint).
- **UI** — reads through stores or `useStorageQuery`, writes through stores. Forms show `StorageError.fieldErrors` next to inputs and `recovery` text for other failures.

**Boot:** `App` calls `workspace.init()` → opens the DB → loads products → resolves the active product (stored in the `meta` table). Loading and error states are rendered by `StorageGate`.

**Writes are validated at the storage boundary**: every create/update runs the entity's Zod schema inside the transaction, so invalid data can never be persisted regardless of caller. Updates accept `expectedUpdatedAt` to reject stale writes (`CONFLICT`). Each change appends a `Revision` in the same transaction.

**Backup/restore:** `parseBackup` (JSON → version check → migrate → schema validate → reference integrity) never writes. `restoreBackup` replaces all tables in one transaction; failure rolls back.

**Known limits (Phase 0):** no cross-tab sync (a second tab needs a reload); revisions are unbounded (no retention policy yet); restore is replace-only (no merge); soft-deleting a parent does not cascade to children.
