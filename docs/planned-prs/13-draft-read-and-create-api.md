# Planned PR 13 — Read and Create Drafts API

Depends on PRs 04 and 09.

## Required context

Read `docs/implementation-contract.md`, `docs/v0.1-spec.md`, and the merged
State and Stack implementations.

## Outcome

Persist Drafts inside a Stack and support listing, retrieving, and creating them
through the API.

## Included

- `drafts` migration, foreign keys, and indexes
- Draft domain model and repository
- `GET /api/stacks/:stackId/drafts`
- `GET /api/stacks/:stackId/drafts/:draftId`
- `POST /api/stacks/:stackId/drafts`
- Automatic use of the default Draft State
- Repository, service, migration, and HTTP tests

## Fixed implementation details

- Add the next ordered migration with a `STRICT` `drafts` table, required Stack
  and State foreign keys, title/description checks, an index on `stack_id`, and
  an index on `state_id`.
- Scope consistency is enforced transactionally by the application service.
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
