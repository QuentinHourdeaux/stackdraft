# Planned PR 10 — Read and Create Stacks API

Depends on PRs 04 and 05.

## Required context

Read `docs/implementation-contract.md`, `docs/v0.1-spec.md`, and the merged
State implementation, especially `api/defs/state/`, `api/core/state/`,
`api/infrastructure/database/state-store.ts`, `api/core/errors.ts`,
`api/lib/time/utc.ts`, and `api/lib/validation/uuid.ts`.

## Outcome

Persist Stacks and support listing, retrieving, and creating them through the
API.

## Included

- `stacks` migration and indexes
- Stack definitions and store contract
- `GET /api/stacks`
- `GET /api/stacks/:stackId`
- `POST /api/stacks`
- Automatic use of the default Stack State
- Explicit State assignment when valid
- State-deletion integration coverage for a referenced Stack State
- Store, service, migration, and HTTP tests

## Fixed implementation details

- Add the next ordered migration with a `STRICT` `stacks` table, required
  `state_id` foreign key, title-length check, description-length check, and
  `state_id` index.
- Follow the resource layout from `docs/implementation-contract.md`:
  `api/defs/stack/`, `api/core/stack/`, and
  `api/infrastructure/database/stack-store.ts`.
- Add new tagged errors only in `api/core/errors.ts`; do not define
  `Data.TaggedError` classes inside Stack resource files.
- Stack IDs use UUID-specific schemas and generation helpers. `createdAt` and
  `updatedAt` are `DateTime.Utc` in core and ISO strings at the API/SQLite
  boundaries through `api/lib/time/utc.ts`.
- Scope consistency is enforced transactionally by the core service; do not
  hardcode seed IDs or infer scope from names.
- `GET /api/stacks` returns `{ "stacks": [...] }`.
- `GET /api/stacks/:stackId` returns the Stack directly.
- `POST /api/stacks` accepts `CreateStackBody` and returns the Stack directly
  with `201`.
- Stack JSON contains only `id`, `title`, `description`, `stateId`, `createdAt`,
  and `updatedAt`; State display data is loaded from the State collection in
  v0.1.

## Not included

- Updating or deleting Stacks
- State filtering
- Stack UI

## Acceptance

- A Stack can be created with only a title.
- Description defaults to empty and State defaults correctly.
- A Draft-scoped State cannot be assigned to a Stack.
- Deleting a State referenced by a Stack returns `STATE_IN_USE`.
- Lists use a documented deterministic order.
- Creation and default-State lookup occur in one core operation.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
