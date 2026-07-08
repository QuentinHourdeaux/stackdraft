# Planned PR 11 — Edit and Filter Stacks API

Depends on Planned PR 10.

## Required context

Read `docs/implementation-contract.md`, `api/core/errors.ts`, the merged Stack
API, and the State validation/store patterns.

## Outcome

Allow Stack details to evolve and Stack lists to be narrowed by State.

## Included

- `PATCH /api/stacks/:stackId`
- Title, description, and State updates
- `stateId` filtering on `GET /api/stacks`
- Scope validation and typed not-found errors
- Store, service, and HTTP tests

## Fixed implementation details

- `PATCH /api/stacks/:stackId` accepts `UpdateStackBody`, rejects an empty body,
  and returns the updated Stack directly.
- Normalize and validate changed fields before beginning persistence. Reuse
  shared validation primitives from `api/lib/validation/` where they fit, and
  keep Stack-specific field messages in `api/core/stack/validation.ts`.
- `GET /api/stacks?stateId=<uuid>` uses the same named collection envelope and
  ordering as the unfiltered request.
- A malformed State ID is `VALIDATION_ERROR`; a Draft-scoped State ID is
  `INVALID_STATE_SCOPE`; a valid absent ID produces an empty collection.
- Reassigning the current State and writing unchanged values are successful
  no-ops and do not need to advance `updatedAt`.
- Any new Stack-specific typed failures are defined in `api/core/errors.ts` and
  mapped to the standard API error envelope in the HTTP layer.

## Not included

- Stack deletion
- Stack UI

## Acceptance

- Partial updates preserve omitted fields.
- A Stack can move only to a Stack-scoped State.
- Filtering returns only matching Stacks.
- Invalid filters and updates use the standard API error shape.
- Tests cover unchanged PATCH behavior and State-scope rejection.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
