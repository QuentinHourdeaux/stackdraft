# PR 04 — State Ordering and Defaults

Depends on PR 02.

## Required context

Read `docs/implementation-contract.md` and the merged State implementation.

## Outcome

Support deterministic State ordering and exactly one default State per scope.

## Included

- Transactional State reordering
- Transactional default-State selection
- `PUT /api/states/:stateId/position`
- `PUT /api/states/:stateId/default`
- Scope and position invariant tests
- Concurrent or partial-failure safety where SQLite permits it

## Fixed implementation details

- `PUT /api/states/:stateId/position` accepts `MoveStateBody`.
- Moving to the current position is a successful no-op.
- Move affected rows out of the unique-position range temporarily inside the
  transaction, then assign final contiguous positions without dropping the
  uniqueness constraint.
- The move response is `{ "states": [...] }` containing the complete reordered
  scope.
- `PUT /api/states/:stateId/default` requires no body and returns the selected
  State directly.
- Selecting the current default is a successful no-op.
- Update `updatedAt` on every State whose position or default flag changes.

## Not included

- State deletion
- State settings UI

## Acceptance

- Positions remain contiguous and unique within each scope.
- Moving one State produces deterministic ordering for its peers.
- Selecting a default atomically replaces the previous default.
- Each scope retains exactly one default State.
- An injected mid-operation failure proves the transaction rolls back.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
