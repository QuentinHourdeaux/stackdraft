# Planned PR 16 — Draft List and Quick-create UI

Depends on PRs 13, 14, and 15.

## Required context

Read `docs/product-north-star.md`, `docs/implementation-contract.md`, and the
merged Stack UI and complete Draft read/create/filter API.

## Outcome

Make standalone Draft capture the primary Stackdraft experience. A user can open
the application and record work in seconds without first creating or choosing a
Stack, while Stack detail continues to support capture and review of related
Drafts.

## Included

- Global Draft list and title-only quick-create at `/`
- Move the existing Stack list from `/` to `/stacks`
- Draft list and Stack-associated quick-create on Stack detail
- Useful zero-Stack and zero-Draft empty states
- Draft State displayed by name and color
- Optional Stack context displayed only when assigned
- Navigation to read-only Draft detail at `/drafts/:draftId`
- Loading, validation, and recoverable error states

## Fixed implementation details

- Update the app shell so Drafts is the primary navigation destination at `/`
  and Stacks links to `/stacks`. Keep Stack detail at `/stacks/:stackId` and
  State settings at `/settings/states`.
- The global Draft screen loads Draft States, all Drafts, and the Stack
  collection needed to label optional associations. Draft capture and already
  loaded Draft content must not be blocked by slower Stack-label loading.
- The global quick-create form contains one visible title input and submit
  action. Pressing Enter submits; blank input does not. It omits `stackId` and
  `stateId`, so the server creates a standalone Draft in the current default
  Draft State.
- Stack detail lists Drafts through `GET /api/drafts?stackId=<stackId>` and uses
  the same quick-create interaction while supplying the current `stackId`.
- On successful creation, clear and refocus the input and insert the
  server-returned Draft in deterministic list order without fabricating fields.
- A global Draft row shows the assigned Stack's title and link when available;
  standalone rows do not display a placeholder organization requirement. A
  Stack-detail row does not repeat its current Stack.
- Add `/drafts/:draftId` as a read-only summary route backed by the global Draft
  detail endpoint; Planned PR 17 expands it.
- Failed quick-create retains the entered title and exposes a retryable error.
- Reuse shared Draft list, row, quick-create, State badge, and loading/error
  behavior between global and Stack contexts rather than maintaining two
  divergent implementations.

## Not included

- Draft editing
- Draft-State filtering UI
- Stack assignment during quick-create
- Standalone-only filtering

## Acceptance

- With zero Stacks, a standalone Draft can be captured from `/` in seconds.
- Successful global creation does not require navigation or organizational input
  and persists after refresh.
- Global lists correctly render mixed standalone and stacked Drafts; Stack
  detail renders only Drafts assigned to that Stack.
- Stack-detail creation assigns the current Stack while using the same global
  Draft API.
- Keyboard and focus behavior support repeated capture in both contexts.
- Existing Stack-list behavior remains available at `/stacks`, and navigation
  does not leave stale assumptions that `/` is the Stack list.
- UI tests cover zero-Stack empty state, mixed lists, both create contexts,
  Enter submission, duplicate-submission prevention, focus restoration, failure
  retention, optional Stack labels, and global Draft navigation.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
