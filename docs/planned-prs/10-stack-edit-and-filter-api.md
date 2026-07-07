# PR 10 — Edit and Filter Stacks API

Depends on PR 09.

## Required context

Read `docs/implementation-contract.md` and the merged Stack API.

## Outcome

Allow Stack details to evolve and Stack lists to be narrowed by State.

## Included

- `PATCH /api/stacks/:stackId`
- Title, description, and State updates
- `stateId` filtering on `GET /api/stacks`
- Scope validation and typed not-found errors
- Repository, service, and HTTP tests

## Fixed implementation details

- `PATCH /api/stacks/:stackId` accepts `UpdateStackBody`, rejects an empty body,
  and returns the updated Stack directly.
- Normalize and validate changed fields before beginning persistence.
- `GET /api/stacks?stateId=<uuid>` uses the same named collection envelope and
  ordering as the unfiltered request.
- A malformed State ID is `VALIDATION_ERROR`; a Draft-scoped State ID is
  `INVALID_STATE_SCOPE`; a valid absent ID produces an empty collection.
- Reassigning the current State and writing unchanged values are successful
  no-ops and do not need to advance `updatedAt`.

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
