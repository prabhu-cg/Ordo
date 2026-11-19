# Database schema (IndexedDB via Dexie)

Database `ordo`, Dexie version 1 (`storage/migrations.ts`).

| Table        | Indexes                                                         |
| ------------ | --------------------------------------------------------------- |
| products     | id, name, updatedAt                                             |
| objectives   | id, productId, status, [productId+order]                        |
| initiatives  | id, productId, objectiveId, status, *tagIds, [productId+order]  |
| features     | id, productId, initiativeId, status, *tagIds, [productId+order] |
| milestones   | id, productId, initiativeId, date                               |
| roadmaps     | id, productId                                                   |
| roadmapViews | id, productId, roadmapId                                        |
| tags         | id, productId, [productId+name]                                 |
| dependencies | id, productId, fromId, toId, [fromType+fromId], [toType+toId]   |
| revisions    | id, productId, createdAt, [entityType+entityId]                 |
| meta         | key (small settings, e.g. activeProductId)                      |

`*tagIds` is a multi-entry index. `deletedAt` is not indexed (absent values cannot be); archived rows are filtered after the indexed lookup.

Backups are JSON: `{ app: "ordo", schemaVersion, exportedAt, data: { <table>: [...] } }` covering every table except `meta`.

Note: Dexie opens a database whose stored version is higher than the app's without error; the app does not detect "data from a newer release" at open time. Backup files, by contrast, are version-checked and refused if newer.
