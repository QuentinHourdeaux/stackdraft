# Planned PR 13 — Stack Detail, Edit, and Filter UI

Depends on PRs 11 and 12.

## Required context

Read `docs/implementation-contract.md` and the complete merged Stack API and UI.

## Outcome

Let the user inspect and maintain Stack context and filter the home view by
State.

## Included

- Stack detail route at `/stacks/:stackId`
- Stack title, description, and State editing
- Stack-State filter on the home view
- Missing-Stack and recoverable error states

## Fixed implementation details

- Replace Planned PR 12's read-only Stack summary with the full detail screen.
- The edit form contains title, description, and Stack-scoped State selection.
- Use a plain `<textarea>` for description and show the v0.1 character limit.
- The home filter offers All plus every Stack State in position order.
- Keep the filter in the URL as `/?stateId=<uuid>` so refresh and browser
  navigation preserve it.
- If a saved filter no longer names a present Stack State, remove it from the
  URL and show all Stacks.

## Not included

- Stack deletion
- Draft rendering

## Acceptance

- Direct navigation loads current Stack data.
- Edits persist and appear on both detail and list screens.
- State filtering is clear and reversible.
- An unknown Stack ID shows a useful not-found state.
- UI tests cover direct load, successful and invalid edit, URL-backed filtering,
  stale filter recovery, and not-found behavior.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
