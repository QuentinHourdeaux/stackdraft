# Planned PR 07 — State Settings UI

Depends on PRs 02 and 06.

## Required context

Read `docs/implementation-contract.md` and the merged State API and application
shell.

## Outcome

Let the user view, create, and edit Stack and Draft States from the browser.

## Included

- `/settings/states` screen
- Separate Stack-State and Draft-State sections
- Typed frontend State API client
- Create and edit forms
- Loading, empty, validation, and recoverable error states
- State names displayed alongside colors

## Fixed implementation details

- Load stack and draft scopes independently so one failed request does not hide
  the other scope.
- Within each scope, show States in API order with name, color swatch, and a
  visible default marker even though changing defaults comes later.
- Use one create form per scope; scope is derived from the section and is not a
  user-editable field.
- Editing occurs inline or in a small dialog, but must use a real `<form>` with
  labeled name and color controls.
- A successful create appends the server-returned State. A successful edit
  replaces the matching State.
- Decode `VALIDATION_ERROR` and `STATE_NAME_CONFLICT` through the shared typed
  API client.

## Not included

- Reordering
- Default selection
- Deletion

## Acceptance

- Persisted States load in the correct scope and order.
- Create and edit operations update the visible list.
- Server validation appears beside the relevant input.
- The screen is keyboard usable and never communicates State by color alone.
- UI tests cover load, independent-scope failure, create, edit, duplicate
  submission prevention, and field/non-field errors.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
