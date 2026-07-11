# Planned PR 15 — Edit and Filter Drafts API

Depends on Planned PR 14.

## Required context

Read `docs/implementation-contract.md`, `api/core/errors.ts`, the merged Draft
API, and the State/Stack validation and store patterns.

## Outcome

Allow Draft context and optional organization to evolve. Drafts can be assigned
to a Stack, moved between Stacks, or made standalone, and the global Draft
collection can be filtered by State and Stack.

## Included

- `PATCH /api/drafts/:draftId`
- Title, description, State, and optional Stack-association updates
- Composable `stateId` and `stackId` filtering on the global Draft collection
- State-scope and supplied-Stack validation
- Store, service, and HTTP tests

## Fixed implementation details

- `PATCH /api/drafts/:draftId` accepts `UpdateDraftBody`, rejects an empty body,
  and returns the updated Draft directly.
- `UpdateDraftBody.stackId` has three distinct meanings: omission preserves the
  current association, a UUID assigns or changes the Stack, and JSON `null`
  removes the association.
- Assigning a missing Stack returns `STACK_NOT_FOUND`. Updating a standalone
  Draft never requires a Stack lookup unless `stackId` is supplied as a UUID.
- `GET /api/drafts?stateId=<uuid>&stackId=<uuid>` retains the collection
  envelope and deterministic ordering. Either filter may appear alone and both
  compose with AND semantics.
- With no filters, the collection includes standalone and stacked Drafts. A
  syntactically valid but absent `stackId` filter returns an empty collection.
  An explicit standalone-only filter is not included in v0.1.
- Apply the existing State-filter semantics using Draft scope: an absent State
  returns an empty collection and a Stack-scoped State returns
  `INVALID_STATE_SCOPE`.
- Reassigning the current State or Stack and writing unchanged values are
  successful no-ops and do not need to advance `updatedAt`.
- Reuse shared validation primitives from `api/lib/validation/` where they fit,
  and keep Draft-specific field messages in `api/core/draft/validation.ts`.
- Any new Draft-specific typed failures are defined in `api/core/errors.ts` and
  mapped to the standard API error envelope in the HTTP layer.

## Not included

- Draft deletion
- Draft relationships
- Standalone-only collection filtering
- Draft UI

## Acceptance

- Partial updates preserve omitted fields.
- A Draft can move only to a Draft-scoped State.
- A standalone Draft can be assigned to a Stack, moved to another Stack, and
  returned to standalone with `stackId: null`.
- A missing supplied Stack fails predictably without changing the Draft.
- State and Stack collection filters work independently and together.
- Direct Draft lookup and mutation use only `draftId`; there is no cross-Stack
  identity or mismatch behavior.
- Tests cover malformed IDs, missing resources, wrong State scope, no-op
  updates, and transaction rollback for rejected association changes.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
