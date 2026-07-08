# Planned PR 15 — Edit and Filter Drafts API

Depends on Planned PR 14.

## Required context

Read `docs/implementation-contract.md`, `api/core/errors.ts`, the merged Draft
API, and the State/Stack validation and store patterns.

## Outcome

Allow Draft context to evolve and a Stack's Draft list to be filtered by State.

## Included

- `PATCH /api/stacks/:stackId/drafts/:draftId`
- Title, description, and State updates
- `stateId` filtering on the Draft collection
- Scope and parent-Stack validation
- Store, service, and HTTP tests

## Fixed implementation details

- `PATCH /api/stacks/:stackId/drafts/:draftId` accepts `UpdateDraftBody`,
  rejects an empty body, and returns the updated Draft directly.
- `GET /api/stacks/:stackId/drafts?stateId=<uuid>` retains the collection
  envelope and deterministic ordering.
- Apply the same filter semantics as Stack filtering, using Draft scope.
- Validate the parent Stack before querying or mutating its Drafts.
- Reassigning the current State and writing unchanged values are successful
  no-ops and do not need to advance `updatedAt`.
- Reuse shared validation primitives from `api/lib/validation/` where they fit,
  and keep Draft-specific field messages in `api/core/draft/validation.ts`.
- Any new Draft-specific typed failures are defined in `api/core/errors.ts` and
  mapped to the standard API error envelope in the HTTP layer.

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
