# PR 04 — State Deletion Rules

Depends on PR 03.

## Required context

Read `docs/implementation-contract.md` and the merged State implementation.

## Outcome

Delete States safely without allowing workflow invariants or references to
break.

## Included

- `DELETE /api/states/:stateId`
- Protection for default, in-use, and last-in-scope States
- Position compaction after deletion
- Typed conflict errors
- Repository, service, and HTTP tests

## Fixed implementation details

- Return `204` with no body after successful deletion.
- Use the guard order and stable error codes from the implementation contract.
- Map a SQLite foreign-key deletion failure to `STATE_IN_USE`. Before Stack and
  Draft tables exist, that branch is reachable only as a typed repository
  failure; real integration coverage is added by PRs 08 and 12 rather than with
  a speculative table.
- Last-in-scope protection remains required even though seeded defaults normally
  trigger the default guard first.
- Compact positions and update affected `updatedAt` values in the same
  transaction as deletion.

## Not included

- Reassigning records during deletion
- State settings UI

## Acceptance

- An eligible State can be deleted.
- Default and last-in-scope States cannot be deleted.
- Failed deletion leaves all State data unchanged.
- Remaining positions are contiguous.
- HTTP tests distinguish every currently reachable conflict code.
- The repository exposes the typed `STATE_IN_USE` path that later foreign-key
  integration tests will exercise.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
