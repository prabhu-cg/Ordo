# Data model (schema version 1)

Source: `src/domain/v1/`. All ids are UUID strings; timestamps are ISO-8601; planning dates are `YYYY-MM-DD`. "Soft" = archived via `deletedAt` (absent means active).

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

Work status: idea, planned, in-progress, shipped, paused, dropped. Scoring: impact, confidence, effort, each 1–5.

Rules enforced by schema: names required and trimmed; length caps; end date not before start date; a dependency cannot point at itself. Parent links are optional so strategy can be added progressively.

**Changing the schema:** add a `DbVersion` in `storage/migrations.ts`, bump `SCHEMA_VERSION`, add a `BACKUP_MIGRATIONS[n]` step, add tests.
