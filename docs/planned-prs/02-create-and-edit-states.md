# PR 02 — Create and Edit States

Depends on PR 01.

## Required context

Read `docs/implementation-contract.md` and the merged implementation of PR 01.

## Outcome

Allow clients to create a State and edit its name and color through the API.

## Included

- Create-State and edit-State application behavior
- `POST /api/states`
- `PATCH /api/states/:stateId`
- Name, scope, and color validation
- Case-insensitive name uniqueness within a scope
- Typed not-found and conflict errors
- Repository, service, and HTTP tests

## Fixed implementation details

- `POST /api/states` accepts `CreateStateBody` and returns the created State
  directly with `201`.
- Creation appends at `MAX(position) + 1` within the requested scope and always
  starts with `isDefault: false`.
- `PATCH /api/states/:stateId` accepts `UpdateStateBody`, rejects an empty body,
  and returns the updated State directly with `200`.
- State scope, position, and default status cannot be changed by PATCH.
- Normalize color and trimmed name before checking uniqueness.
- Map duplicate names to `409 STATE_NAME_CONFLICT`.
- Generate IDs and timestamps in the application service, not the repository or
  HTTP handler.

## Not included

- Reordering States
- Changing the default State
- Deleting States
- State settings UI

## Acceptance

- Valid mutations persist and return the resulting State.
- Duplicate names in one scope are rejected consistently.
- The same name may exist once in each scope.
- Invalid input uses the standard API error shape.
- Creation and update are covered with deterministic service tests.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
