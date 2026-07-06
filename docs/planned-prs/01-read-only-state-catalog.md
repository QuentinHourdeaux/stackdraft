# PR 01 — Read-only State Catalog

## Required context

Read `docs/implementation-contract.md`, `docs/v0.1-spec.md`, and
`docs/domain-language.md` before implementation.

## Outcome

Persist the initial Stack and Draft States and expose them through a tested
read-only API.

## Included

- `states` migration and editable seed rows
- State domain model, scope validation, and response schema
- State repository contract and SQLite implementation
- State query service
- `GET /api/states?scope=stack|draft`
- Repository, service, migration, and HTTP tests

## Fixed implementation details

- Add `migrations/0002-states.sql`.
- Create a `STRICT` `states` table with the columns from `v0.1-spec.md`.
- Add checks for scope, non-negative position, boolean `is_default`, and valid
  stored hex color.
- Enforce unique `(scope, name COLLATE NOCASE)`, unique `(scope, position)`, and
  at most one default per scope with a partial unique index.
- Seed zero-based positions:

| Scope | Name        | Color     | Default |
| ----- | ----------- | --------- | ------- |
| stack | Planned     | `#8d98a5` | yes     |
| stack | Active      | `#8fa8ff` | no      |
| stack | Paused      | `#f0b35a` | no      |
| stack | Completed   | `#62d79b` | no      |
| draft | Backlog     | `#8d98a5` | yes     |
| draft | Todo        | `#8fa8ff` | no      |
| draft | In Progress | `#b28cff` | no      |
| draft | Done        | `#62d79b` | no      |
| draft | Canceled    | `#ff7b8a` | no      |

- Seed IDs must be fixed valid UUIDs so migration tests are deterministic, but
  application behavior must never branch on them.
- Add State modules under the boundaries defined by the implementation contract;
  do not place feature SQL in `app.ts`.
- Extend `apiError` to accept optional details while preserving the existing
  health response.

The successful response is:

```json
{
  "states": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "scope": "stack",
      "name": "Planned",
      "color": "#8d98a5",
      "position": 0,
      "isDefault": true,
      "createdAt": "2026-07-06T00:00:00.000Z",
      "updatedAt": "2026-07-06T00:00:00.000Z"
    }
  ]
}
```

The timestamp values above illustrate shape only; migration application time may
be used for seed timestamps.

## Not included

- State mutations
- State settings UI
- Stack or Draft persistence

## Acceptance

- A fresh database contains the specified starter States.
- States are returned in position order and can be filtered by scope.
- Invalid or missing scope input returns the standard validation error.
- Domain code does not depend on seeded names or IDs.
- The existing health endpoint and SPA fallback still behave unchanged.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR. Its deletion means this outcome is
available on `main`; Git retains the original plan.
