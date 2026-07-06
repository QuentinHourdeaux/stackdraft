# PR 13 — Edit and Filter Drafts API

Depends on PR 12.

## Required context

Read `docs/implementation-contract.md` and the merged Draft API.

## Outcome

Allow Draft context to evolve and a Stack's Draft list to be filtered by State.

## Included

- `PATCH /api/stacks/:stackId/drafts/:draftId`
- Title, description, and State updates
- `stateId` filtering on the Draft collection
- Scope and parent-Stack validation
- Repository, service, and HTTP tests

## Fixed implementation details

- `PATCH /api/stacks/:stackId/drafts/:draftId` accepts `UpdateDraftBody`,
  rejects an empty body, and returns the updated Draft directly.
- `GET /api/stacks/:stackId/drafts?stateId=<uuid>` retains the collection
  envelope and deterministic ordering.
- Apply the same filter semantics as Stack filtering, using Draft scope.
- Validate the parent Stack before querying or mutating its Drafts.
- Reassigning the current State and writing unchanged values are successful
  no-ops and do not need to advance `updatedAt`.

## Not included

- Draft deletion
- Draft relationships
- Draft UI

## Acceptance

- Partial updates preserve omitted fields.
- A Draft can move only to a Draft-scoped State.
- Filtering returns only matching Drafts in the requested Stack.
- Cross-Stack access and invalid updates fail predictably.
- Tests distinguish missing Stack from a missing or cross-Stack Draft.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
