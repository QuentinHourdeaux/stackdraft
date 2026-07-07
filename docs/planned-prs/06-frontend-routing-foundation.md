# Planned PR 06 — Frontend Routing Foundation

## Required context

Read `docs/implementation-contract.md`, `docs/v0.1-spec.md`, and ADR 0003.

## Outcome

Give the React application a small navigation structure that future screens can
join without reshaping the shell.

## Included

- React Router integration
- Shared application layout
- Navigation between the Stack list and State settings
- Placeholder route targets
- Not-found screen
- Keyboard-visible navigation focus
- Focused routing and shell tests

## Fixed implementation details

- Add pinned `react-router` in declarative/library mode.
- Wrap the application in `BrowserRouter`.
- Define these routes now:
  - `/` — Stack-list placeholder
  - `/settings/states` — State-settings placeholder
  - `*` — not-found screen
- Do not add future Stack or Draft detail routes until their UI PRs.
- Replace the centered proof page with a responsive application shell containing
  a semantic header, product link, main navigation, and `<main>`.
- Keep health checking as a compact shell-level indicator; it must not block
  route rendering.
- Introduce Vitest, jsdom, React Testing Library, and `user-event` exactly as
  described in the implementation contract. Remove the conditional wording from
  the Included item: routing and shell behavior must be tested.
- Add `test:api` and `test:web`; make `deno task test` run both.

## Not included

- Functional State, Stack, or Draft screens
- A generalized design system

## Acceptance

- Direct navigation and browser history work for known routes.
- Unknown routes show a useful local not-found view.
- The existing health indication remains available without dominating the UI.
- Tests cover direct route rendering, navigation, not-found behavior, and health
  success/failure without snapshots.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
