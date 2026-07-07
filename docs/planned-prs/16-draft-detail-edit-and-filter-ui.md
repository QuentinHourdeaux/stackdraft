# PR 16 — Draft Detail, Edit, and Filter UI

Depends on PRs 14 and 15.

## Required context

Read `docs/implementation-contract.md` and the complete merged Draft API and UI.

## Outcome

Let the user maintain a Draft's current context and narrow a Stack's Draft list
by State.

## Included

- Draft detail route at `/stacks/:stackId/drafts/:draftId`
- Draft title, description, and State editing
- Draft-State filter on Stack detail
- Navigation back to the parent Stack
- Missing-Draft and recoverable error states

## Fixed implementation details

- Replace PR 15's read-only Draft summary with the full detail screen.
- The edit form contains title, description, and Draft-scoped State selection.
- Use a plain `<textarea>` for description and show the v0.1 character limit.
- Keep the Draft filter in the Stack URL as
  `/stacks/:stackId?draftStateId=<uuid>`.
- If a saved filter no longer names a present Draft State, remove it from the
  URL and show all Drafts.
- Breadcrumb/navigation labels use the loaded Stack and Draft titles where
  available.

## Not included

- Draft deletion
- Pipeline Stages
- Markdown

## Acceptance

- Direct navigation loads the current Draft.
- Edits persist and appear on detail and Stack screens.
- Filtering is clear, scoped to one Stack, and reversible.
- Unknown or mismatched Stack/Draft IDs show a useful not-found state.
- UI tests cover direct load, edit, URL-backed filtering, stale filter recovery,
  back navigation, and mismatched IDs.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
