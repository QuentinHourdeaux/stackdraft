# PR 15 — Draft List and Quick-create UI

Depends on PRs 12 and 13.

## Required context

Read `docs/implementation-contract.md` and the merged Stack detail screen and
Draft read/create API.

## Outcome

Make a Stack useful for quickly capturing and reviewing its Drafts.

## Included

- Draft list on the Stack detail screen
- Useful empty state
- Always-available title-only quick-create interaction
- Draft State displayed by name and color
- Navigation to Draft detail
- Loading, validation, and recoverable error states

## Fixed implementation details

- Load Draft States and the Stack's Draft collection without blocking already
  available Stack context.
- The quick-create form contains one visible title input and submit action.
  Pressing Enter submits; blank input does not.
- Omit `stateId` so the server selects the current default Draft State.
- On success, clear and refocus the input and insert the server-returned Draft
  in deterministic list order.
- Add `/stacks/:stackId/drafts/:draftId` as a read-only summary route backed by
  the Draft detail endpoint; PR 16 expands it.
- A failed quick-create retains the entered title and exposes a retryable error.

## Not included

- Draft editing
- Draft-State filtering

## Acceptance

- A Draft can be captured from its Stack in seconds.
- Successful creation does not require leaving the Stack screen.
- Drafts remain scoped to their Stack and persist after refresh.
- Keyboard and focus behavior support repeated capture.
- UI tests cover empty/populated lists, Enter submission, duplicate submission
  prevention, focus restoration, failure retention, and navigation.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
