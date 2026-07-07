# Planned PR 08 — State Management UI

Depends on PRs 04, 05, and 07.

## Required context

Read `docs/implementation-contract.md` and the complete merged State API.

## Outcome

Complete State administration in the browser.

## Included

- State reordering controls
- Default-State selection
- Delete action with confirmation
- Explanation of protected deletion failures
- Optimistic behavior only where rollback is unambiguous
- Interaction and accessibility tests for behavior-rich controls

## Fixed implementation details

- Reordering uses explicit Move up and Move down buttons. Disable the impossible
  direction at each boundary.
- Replace the local scope list with the reordered collection returned by the
  server.
- Default selection uses a labeled native radio group or an equivalently
  accessible single-choice control.
- Delete confirmation names the State and explains that deletion cannot be
  undone.
- On `STATE_IS_DEFAULT`, `STATE_IN_USE`, or `LAST_STATE_IN_SCOPE`, keep the
  State visible and show the server-derived explanation.

## Not included

- Drag-and-drop
- Reassigning records during deletion

## Acceptance

- The user can reorder States without drag-and-drop.
- The default State is clearly identified and can be changed.
- Destructive deletion requires confirmation.
- Protected States explain why they cannot be deleted.
- Refreshing preserves every successful change.
- UI tests exercise keyboard activation, boundary controls, confirmation,
  successful deletion, and each reachable conflict.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
