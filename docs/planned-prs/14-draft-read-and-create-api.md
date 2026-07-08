# Planned PR 14 — Read and Create Drafts API

Depends on PRs 04, 05, and 10.

## Required context

Read `docs/implementation-contract.md`, `docs/v0.1-spec.md`, and the merged
State and Stack implementations, especially their `api/defs/`, `api/core/`,
`api/infrastructure/database/*-store.ts`, `api/core/errors.ts`,
`api/lib/time/utc.ts`, and shared validation helpers.

## Outcome

Persist Drafts inside a Stack and support listing, retrieving, and creating them
through the API.

## Included

- `drafts` migration, foreign keys, and indexes
- Draft definitions and store contract
- `GET /api/stacks/:stackId/drafts`
- `GET /api/stacks/:stackId/drafts/:draftId`
- `POST /api/stacks/:stackId/drafts`
- Automatic use of the default Draft State
- Store, service, migration, and HTTP tests

## Fixed implementation details

- Add the next ordered migration with a `STRICT` `drafts` table, required Stack
  and State foreign keys, title/description checks, an index on `stack_id`, and
  an index on `state_id`.
- Follow the resource layout from `docs/implementation-contract.md`:
  `api/defs/draft/`, `api/core/draft/`, and
  `api/infrastructure/database/draft-store.ts`.
- Add new tagged errors only in `api/core/errors.ts`; do not define
  `Data.TaggedError` classes inside Draft resource files.
- Draft IDs use UUID-specific schemas and generation helpers. `createdAt` and
  `updatedAt` are `DateTime.Utc` in core and ISO strings at the API/SQLite
  boundaries through `api/lib/time/utc.ts`.
- Scope consistency is enforced transactionally by the core service.
- Add the deferred State-deletion integration test proving a State referenced by
  a Draft returns `STATE_IN_USE`.
- `GET /api/stacks/:stackId/drafts` returns `{ "drafts": [...] }`.
- `GET /api/stacks/:stackId/drafts/:draftId` returns the Draft directly.
- `POST /api/stacks/:stackId/drafts` accepts `CreateDraftBody` and returns the
  Draft directly with `201`.
- Draft JSON contains only the fields defined in `v0.1-spec.md`.

## Not included

- Updating or deleting Drafts
- State filtering
- Draft UI

## Acceptance

- A Draft can be created inside an existing Stack with only a title.
- Drafts cannot exist under a missing Stack.
- A Stack-scoped State cannot be assigned to a Draft.
- Deleting a State referenced by a Draft returns `STATE_IN_USE`.
- A Draft cannot be retrieved through another Stack's route.
- Missing parent Stack is checked before default Draft State lookup.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
