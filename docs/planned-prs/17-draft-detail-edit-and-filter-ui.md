# Planned PR 17 — Draft Detail, Edit, and Filter UI

Depends on PRs 15 and 16.

## Required context

Read `docs/implementation-contract.md` and the complete merged Draft API and UI.

## Outcome

Let the user maintain a Draft's current context and optional organization from a
global Draft identity. The user can also narrow the global Draft list or one
Stack's Draft list by State.

## Included

- Draft detail route at `/drafts/:draftId`
- Draft title, description, State, and optional Stack editing
- Draft-State filter on the global Draft screen and Stack detail
- Conditional navigation to an assigned Stack
- Missing-Draft and recoverable error states

## Fixed implementation details

- Replace Planned PR 16's read-only Draft summary with the full detail screen at
  `/drafts/:draftId`; a Stack ID is never part of Draft identity or routing.
- The edit form contains title, description, Draft-scoped State selection, and
  optional Stack selection. A clear `No Stack` option submits `stackId: null`.
- Load the Stack collection for assignment choices without treating the absence
  of any Stacks as an error. A standalone Draft remains fully editable when no
  Stacks exist.
- Use a plain `<textarea>` for description and show the v0.1 character limit.
- Keep the global Draft filter in the root URL as `/?draftStateId=<uuid>` and
  the Stack-detail filter as `/stacks/:stackId?draftStateId=<uuid>`.
- If a saved filter no longer names a present Draft State, remove it from the
  URL and show all Drafts.
- Breadcrumbs and navigation always link to Drafts. They additionally link to
  the loaded Stack title when the Draft has an assignment; standalone Drafts do
  not render an unavailable parent link.
- Successful Stack assignment, reassignment, and removal update both detail and
  relevant collection screens from server-owned data.

## Not included

- Draft deletion
- Pipeline Stages
- Markdown
- Standalone-only filtering

## Acceptance

- Direct `/drafts/:draftId` navigation loads standalone and stacked Drafts.
- Title, description, State, and Stack-association edits persist and appear on
  detail, global Draft, and relevant Stack screens.
- A Draft can be assigned, moved, and returned to `No Stack` from the same form.
- Global and Stack-scoped State filtering are clear, URL-backed, and reversible.
- Unknown Draft IDs show a useful not-found state without requiring Stack
  context; the obsolete mismatched Stack/Draft case does not exist.
- UI tests cover direct standalone and stacked loads, all edit fields, optional
  Stack behavior with zero or multiple Stacks, both filter contexts, stale
  filter recovery, conditional Stack navigation, and API failures.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
