# Planned PR 14 — Read and Create Drafts API

Depends on PRs 04, 05, and 10.

## Required context

Read `docs/domain-language.md`, `docs/implementation-contract.md`,
`docs/v0.1-spec.md`, and the merged State and Stack implementations, especially
their `api/defs/`, `api/core/`, `api/infrastructure/database/*-store.ts`,
`api/core/errors.ts`, `api/lib/time/utc.ts`, and shared validation helpers.

## Outcome

Persist Drafts as first-class engineering records and support listing,
retrieving, and creating them through the API. A Draft can be captured without a
Stack or optionally assigned to an existing Stack during creation.

## Included

- `drafts` migration with nullable Stack association, foreign keys, and indexes
- Draft definitions and store contract
- `GET /api/drafts`
- `GET /api/drafts/:draftId`
- `POST /api/drafts`
- Optional Stack assignment during creation
- Automatic use of the default Draft State
- Store, service, migration, and HTTP tests

## Fixed implementation details

- Add the next ordered migration with a `STRICT` `drafts` table, nullable
  `stack_id`, required `state_id`, title/description checks, an index on
  `stack_id`, and an index on `state_id`. The Stack foreign key remains
  `ON UPDATE RESTRICT ON DELETE RESTRICT` when non-null.
- Follow the resource layout from `docs/implementation-contract.md`:
  `api/defs/draft/`, `api/core/draft/`, and
  `api/infrastructure/database/draft-store.ts`.
- Draft definitions and JSON contain `stackId: string | null`; do not omit the
  field for standalone Drafts.
- `CreateDraftBody` contains required `title` plus optional `description`,
  `stateId`, and `stackId`. Omitted or JSON `null` `stackId` creates a
  standalone Draft; a UUID assigns the Draft to that Stack.
- Add new tagged errors only in `api/core/errors.ts`; do not define
  `Data.TaggedError` classes inside Draft resource files.
- Draft IDs use UUID-specific schemas and generation helpers. `createdAt` and
  `updatedAt` are `DateTime.Utc` in core and ISO strings at the API/SQLite
  boundaries through `api/lib/time/utc.ts`.
- Scope consistency and optional Stack validation are enforced transactionally
  by the core create operation. A supplied missing Stack returns
  `STACK_NOT_FOUND`; no Stack lookup occurs for standalone creation.
- Omitted `stateId` resolves to the current default Draft State. A Stack-scoped
  State returns `INVALID_STATE_SCOPE`.
- Add the deferred State-deletion integration test proving a State referenced by
  a Draft returns `STATE_IN_USE`.
- `GET /api/drafts` returns every Draft in the standard deterministic order as
  `{ "drafts": [...] }`.
- `GET /api/drafts/:draftId` returns the Draft directly without Stack context.
- `POST /api/drafts` returns the created Draft directly with `201`.
- Draft JSON contains only the fields defined in `v0.1-spec.md`.

## Not included

- Updating or deleting Drafts
- State or Stack filtering
- Draft UI

## Acceptance

- A standalone Draft can be created with only a title when no Stacks exist.
- A Draft can optionally be created with an existing Stack.
- Supplying a missing Stack returns `STACK_NOT_FOUND`; omitting the Stack does
  not perform parent validation.
- A Stack-scoped State cannot be assigned to a Draft.
- Deleting a State referenced by a standalone or stacked Draft returns
  `STATE_IN_USE`.
- Standalone and stacked Drafts are listed and retrieved through the same global
  routes, with `stackId` serialized as UUID or `null`.
- Migration tests prove nullable Stack persistence, foreign-key enforcement,
  indexes, versioning, and idempotence.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
