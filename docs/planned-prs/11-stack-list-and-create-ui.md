# PR 11 — Stack List and Create UI

Depends on PRs 06 and 09.

## Required context

Read `docs/implementation-contract.md` and the merged routing, State, and Stack
read/create APIs.

## Outcome

Make Stackdraft useful for capturing and opening personal Stacks from its home
screen.

## Included

- Stack list at `/`
- Useful first-run empty state
- Create-Stack interaction
- Stack State shown by name and color
- Navigation to Stack detail
- Loading, validation, and recoverable error states

## Fixed implementation details

- The `/` route loads Stack States and Stacks in parallel.
- The empty state contains the primary create action.
- Creation uses a labeled form with title required, description optional, and
  optional State selection defaulting visually to the API-reported default.
- Omitting `stateId` lets the server resolve the default; the browser must not
  embed a seed ID.
- After successful creation, navigate to `/stacks/:stackId`. PR 11 adds that
  route as a read-only summary placeholder backed by `GET /api/stacks/:stackId`;
  PR 12 expands it into the full detail/edit screen.
- Stack rows show title, State name/color, and a short plain-text description
  preview when present.

## Not included

- Editing Stacks
- State filtering
- Drafts

## Acceptance

- A new user can create the first Stack with only a title.
- Successful creation makes the Stack visible and opens or clearly links to it.
- Refreshing preserves the Stack.
- Keyboard and focus behavior support the complete flow.
- UI tests cover first-run empty state, populated list, create validation,
  successful navigation, and recoverable API failure.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
