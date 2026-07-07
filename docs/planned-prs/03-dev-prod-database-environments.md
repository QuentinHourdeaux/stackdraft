# PR 03 — Dev and Production Database Environments

Depends on PR 02.

## Required context

Read `docs/implementation-contract.md`, ADR 0001, ADR 0002, `README.md`,
`api/config.ts`, `deno.json`, `compose.yaml`, `Dockerfile`, `.env.example`, and
the current `.gitignore`.

## Outcome

Make development and production-style runs use separate SQLite database files by
default, so local feature work cannot accidentally mutate the same data file
used by Docker Compose.

## Included

- Separate default database paths for local development and Compose
- Explicit development API database path in the Deno dev task
- Local-only Deno tasks for migrating and resetting the development database
- Compose volume mapping that persists production-style data under its own host
  directory
- `.env.example`, `.gitignore`, and README updates for the new layout
- Config and task/documentation tests that prove the intended defaults

## Fixed implementation details

- Keep SQLite as the only database. Do not introduce Postgres, a database
  container, an ORM, a migration tool, or a production deployment platform.
- Keep the container-internal database path as `/data/stackdraft.sqlite`.
- Store local development data under `./data/dev/stackdraft.sqlite`.
- Store Compose/production-style data under `./data/prod/stackdraft.sqlite` by
  bind-mounting `./data/prod` to `/data`.
- Ensure `deno task dev` and `deno task dev:api` use the development database
  path even when `.env` is absent.
- Add `deno task db:migrate:dev` to run pending migrations against
  `./data/dev/stackdraft.sqlite` without starting the HTTP server.
- Add `deno task db:reset:dev` to delete only the local development SQLite files
  for `./data/dev/stackdraft.sqlite`, including SQLite sidecar files such as WAL
  and SHM files, then run migrations against a fresh dev database.
- Implement migration/reset support through a small repo-owned script or command
  module rather than shell-specific inline command chains in `deno.json`.
- The reset command must refuse to run if the configured path is outside
  `./data/dev` or points at the Compose/production-style database.
- Keep `deno task start` using `loadConfig` defaults for a local single-process
  run; if this remains a development-style command, document it as such.
- Update `.env.example` to show the development database path. Do not make
  `.env` required for the normal dev workflow.
- Keep runtime database files ignored by git while preserving any empty
  directory placeholders needed for `data/dev` and `data/prod`.
- Update README sections for Docker, local development, configuration, backup,
  restore, and repository map so the paths are unambiguous.
- Add tests for `loadConfig` defaults and environment overrides. Tests must not
  leak environment variables between cases.
- Add a lightweight verification that the Deno task or documented dev command
  points at `./data/dev/stackdraft.sqlite`.
- Add a lightweight verification that Compose mounts `./data/prod` to `/data`.
- Add tests or script-level checks proving `db:migrate:dev` targets the dev
  database and `db:reset:dev` cannot delete the prod-style database path.

## Not included

- Online backups
- Restore automation
- Production reset commands
- Production migration commands beyond startup migrations
- Multiple production profiles
- Secret management
- Authentication or authorization
- Remote deployment instructions
- Docker image publishing
- Data migration between the old shared `./data/stackdraft.sqlite` path and the
  new paths

## Acceptance

- Running the local dev command creates or uses `data/dev/stackdraft.sqlite`.
- `deno task db:migrate:dev` applies migrations to the dev database without
  starting the server.
- `deno task db:reset:dev` recreates only the dev database and refuses to target
  `data/prod` or any path outside `data/dev`.
- Running Docker Compose creates or uses `data/prod/stackdraft.sqlite`.
- A clean checkout can run development without copying `.env.example`.
- The README clearly explains which path belongs to dev and which belongs to
  production-style Compose.
- Existing database migrations still run automatically on whichever configured
  path is opened.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
