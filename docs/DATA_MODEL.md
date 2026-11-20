# Data model (schema version 2)

Source: `src/domain/schema/`. All ids are UUID strings; timestamps are ISO-8601; planning dates are `YYYY-MM-DD`. "Soft" = archived via `deletedAt` (absent means active).

```
Product ─┬─ Objective ── Initiative ── Feature
         ├─ Milestone      (standalone, or linked to an Initiative)
         ├─ Roadmap ── entries[] ──▶ Initiative | Feature     (references, never copies)
         │     └─ RoadmapView[]    (layouts over one roadmap)
         ├─ Tag            (Initiative.tagIds / Feature.tagIds)
         ├─ Dependency     (initiative|feature → initiative|feature)
         └─ Revision       (append-only history)
```

| Entity      | Soft | Key fields (optional marked ?)                                                                         |
| ----------- | ---- | ------------------------------------------------------------------------------------------------------ |
| Product     | yes  | name, tagline?, description?, vision?, targetAudience?                                                 |
| Objective   | yes  | productId, title, description?, status (active/achieved/dropped), targetDate?, order                   |
| Initiative  | yes  | productId, objectiveId?, title, description?, status, scoring?, tagIds[], startDate?, endDate?, order  |
| Feature     | yes  | productId, initiativeId?, title, description?, status, scoring?, tagIds[], startDate?, endDate?, order |
| Milestone   | yes  | productId, initiativeId?, title, description?, date, status (upcoming/reached/missed)                  |
| Roadmap     | yes  | productId, name, description?, entries[{itemType, itemId, lane?, startDate?, endDate?, order}]         |
| RoadmapView | no   | productId, roadmapId, name, layout (now-next-later/timeline/board/table), config, order                |
| Tag         | yes  | productId, name, tone                                                                                  |
| Dependency  | no   | productId, fromType/fromId, toType/toId, kind (blocks/relates), note?                                  |
| Revision    | –    | productId, entityType, entityId, action, snapshot, createdAt                                           |

**Outcomes** (embedded in an Objective): `{ id, title, metric?, unit?, baseline, target, current }`. The target must differ from the baseline. Progress is derived, never stored: `(current - baseline) / (target - baseline)` clamped to 0..1 (so targets below the baseline work), and an objective's progress is the average of its outcomes (`domain/progress.ts`).

**Priority:** low, medium, high, critical.

Fields added after the first release (`category`, `planningHorizon`, `outcomes`, `priority`, `owner`) are optional, so older records and backups remain valid and no migration was needed.

Work status: idea, planned, in-progress, shipped, paused, dropped. Scoring: impact, confidence, effort, each 1–5.

Rules enforced by schema: names required and trimmed; length caps; end date not before start date; a dependency cannot point at itself. Parent links are optional so strategy can be added progressively.

**Changing the schema:** add a `DbVersion` in `storage/migrations.ts`, bump `SCHEMA_VERSION`, add a `BACKUP_MIGRATIONS[n]` step, add tests.

## Keeping the hierarchy valid

Enforced in `storage/planning.ts`, inside one transaction per operation:

- A child may only point at a parent that exists, is not archived, and belongs to the same product (`objectiveId`, `initiativeId`, tag ids). Otherwise the save fails with a field error and nothing is written.
- Deleting an objective or initiative that has children requires choosing **unlink** (children stay, with no parent; the default) or **cascade** (children are deleted too). No live record is ever left pointing at a deleted parent.
- Deleting an initiative or feature also removes its roadmap entries and dependencies, and unlinks any milestone attached to it.
- Any change moves the product's `updatedAt`, so the dashboard's "last modified" is true.
- Deletions are soft (archived with `deletedAt`) and each change is recorded as a Revision.

## Roadmaps: one shared model

A roadmap is `entries`: a list of references to initiatives and features. The three views (now/next/later, timeline, board) are only different drawings of that one list, so no view has data of its own and nothing is copied.

| What                                                    | Where it lives                                                                      | Why                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Which items are on the roadmap, their order, their lane | the roadmap's `entries`                                                             | the only roadmap-specific facts                                                    |
| Start and end dates                                     | the initiative or feature itself                                                    | so editing dates in a drawer, dragging a bar, or a form all agree on every roadmap |
| Status, priority, parent initiative                     | the item itself                                                                     | so a board drop, a quick edit and the planning pages agree                         |
| Board grouping, sort, card fields, timeline zoom        | the roadmap's `RoadmapView.config`                                                  | a view's own preferences                                                           |
| Milestones                                              | the product's milestones (shown when the roadmap's `itemTypes` includes milestones) | they can stand alone or link to an initiative                                      |

`entry.startDate` and `entry.endDate` are kept in the schema for older data and are no longer read or written.

**An item may be on a roadmap once** (enforced), and on any number of roadmaps. **Planning mode:** `flexible` means lanes are set by hand and dates are optional; `dates` means the lane follows each item's dates (now = this month and next, next = the three months after, later = beyond; undated items keep their stored lane) and moving a dated card to another column moves its dates. **Item types** only hide a kind in this roadmap; entries are kept.

**Dependencies:** `fromType/fromId blocks toType/toId`, or `relates`. Both ends must exist in the product, a link cannot be added twice (a "relates" link counts the same in either direction), and a "blocks" link cannot close a loop.

## Prioritisation (schema 2)

- **Scores** are words, not numbers: `scoring.impact` and `scoring.effort` are `low | medium | high`. Version 1 stored 1–5; the upgrade maps 1–2 to low, 3 to medium, 4–5 to high (`levelFromScore`). Initiatives and features also carry `priority` (`low | medium | high | critical`), `confidence` (`exploring | tentative | committed`) and an optional `matrixOverride`.
- **The matrix** (`quadrantOf` in `src/domain/prioritisation.ts`, the one place the rule lives, covered by tests). An item needs both scores to be placed.

  |               | effort low | effort medium | effort high   |
  | ------------- | ---------- | ------------- | ------------- |
  | impact high   | quick win  | quick win     | major project |
  | impact medium | quick win  | major project | major project |
  | impact low    | fill-in    | fill-in       | reconsider    |

  `matrixOverride` records a hand placement and wins until the item's scores change, when it is cleared. The matrix never reads or writes `priority`.

- **Dependencies** keep the rules above; deleting a record removes the links that pointed at it, and a backup with a link to a missing record is rejected on import.

## Templates (schema 2)

- A **starter template** (six of them, in `src/templates/definitions.ts`) is code, validated by `templateDefinitionSchema`. A **custom template** is a row in the `templates` table (`templateRecordSchema`), made by `templateFromRoadmap` from a roadmap's structure.
- A template holds objectives, initiatives, features, milestones, links and roadmap lanes by key, with dates as month offsets. `resolveTemplate` turns one into a `ProductBundle` with fresh ids and real dates, and the workspace saves the bundle in one transaction. The template is never changed by being used. A saved template carries structure, priorities, estimates, descriptions, tags on initiatives and features, link notes and milestone notes; owners are left out on purpose.
- Products made from a starter are flagged `sampleData` with `templateName`, shown as a banner and a badge until the user selects "These are mine now". Custom templates do not set the flag.
- The template **preview** runs the real roadmap views against an in-memory copy (`RoadmapBindings`), so nothing is written. "Reset preview" restores the original.

## Export, import and settings (Phase 5)

- **Roadmap colour**: `Roadmap.color` is an optional tone (`neutral | amber | success | info | warning | destructive`). It is additive, so version 2 backups without it remain valid and older releases ignore it.
- **Appearance** (density, a colour for each status, which details cards show) is a setting of the device, not of a product. It is saved in the `meta` table under `appearance`, is read tolerantly (anything damaged falls back to the default), and is deliberately not part of a backup.
- **Product backup**: `exportProductBackup` writes the normal backup format holding only that product's rows (its objectives, initiatives, features, milestones, roadmaps and views, tags, dependencies and history). Custom templates belong to the person, so they are only in a whole-device backup.
- **Import alongside** (`importBackupAsNew`): adds a backup's products without changing anything that exists. If any id in the file is already in use, every record gets a new id (`remapIds` rewrites every reference) and products are named "… (imported copy)". One transaction: on failure nothing is added.
- **Replace** (`restoreBackup`) first keeps what was there in `meta` under `safetyCopy`, so the replace can itself be undone (`previousCopy`). It also clears saved undo history.
- **CSV**: one row per objective, initiative or feature. `parent_id` carries the hierarchy (objective → initiative → feature); `blocks` and `blocked_by` list ids. Cells that begin with `=`, `+`, `-` or `@` are prefixed with an apostrophe so a spreadsheet cannot run them as formulas. Written as UTF-8 with a byte order mark.
- **Erase everything** clears every data table and `meta`.
