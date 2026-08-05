# Stackdraft

> Track what you're building.

Stackdraft is a lightweight, self-hosted tracker for software engineers. Drafts
capture development work immediately and may optionally be organized into Stacks
when related work benefits from shared context.

The long-term direction is captured in the
[`Stackdraft Product North Star`](docs/product-north-star.md): work should
become clearer as it progresses, not noisier. Stackdraft's canonical vocabulary
is defined in [`Domain Language`](docs/domain-language.md).

Work remaining for v0.1 is represented by one file per intended pull request in
[`docs/planned-prs/`](docs/planned-prs/). The implementing PR deletes its own
plan, so the directory always describes what remains. Product and process
lessons are recorded in [`Project Evolution`](docs/project-evolution.md). Shared
coding, API, data, and testing decisions are fixed in the
[`Implementation Contract`](docs/implementation-contract.md).

This repository contains the v0.1 application under active development. The
browser calls a Deno API, the API runs Effect services, and those services use a
persistent SQLite database. Remaining work is described by the planned PRs.

## Security boundary

> [!WARNING]
> Stackdraft v0.1 has no authentication or authorization. Anyone who can reach
> its port can access the application. Run it only on a trusted local network
> and do not expose it directly to the public internet.

## Stack

- Deno 2.9.1 and TypeScript
- Oak HTTP server
- Effect core services
- SQLite through Deno's built-in `node:sqlite`
- React 19 and Vite
- One production container with a mounted data directory

## Set up a clone

After cloning the repository, run the post-clone setup as your normal user:

```sh
./scripts/setup.sh
```

The command prepares the development and production data directories, enables
the tracked Git hooks, and reports Docker and local-development readiness
separately. For every available workflow, it also installs or builds the locked
application dependencies and creates or migrates that workflow's SQLite
database.

Setup does not install Docker or Deno, create `.env`, or start Stackdraft. It
prints the missing prerequisite and the next command for each workflow that is
ready. The command is idempotent and can be rerun after pulling migrations or
dependency changes. If the Compose service is running, paused, or restarting,
setup leaves it alone and asks you to stop it before migrating the production
database. Do not run setup with `sudo`.

## Run with Docker

Docker is the only host dependency for the production-style workflow.
`./scripts/setup.sh` verifies Docker and Compose, builds the production image,
and initializes or migrates `./data/prod/stackdraft.sqlite` in a one-shot
container without publishing a port.

```sh
docker compose up --build
```

Open <http://localhost:8000>. The health endpoint is available at
<http://localhost:8000/api/health>.

Stop the application with:

```sh
docker compose down
```

The database remains in `./data/prod`.

## Develop locally

Install Deno 2.9.1, then run the same post-clone setup command:

```sh
./scripts/setup.sh
```

When Deno 2.9.1 is available, setup runs `deno install --frozen`, applies the
development migrations to `./data/dev/stackdraft.sqlite`, and points this clone
at `.githooks/`. The `prepare-commit-msg` hook strips `Co-authored-by: Cursor`
lines from agent commits.

Start the API and Vite development server together:

```sh
deno task dev
```

Open <http://localhost:3000>. Vite proxies `/api` requests to the Deno server on
port 8000.

Local development uses `./data/dev/stackdraft.sqlite`. Docker Compose uses
`./data/prod/stackdraft.sqlite`. A clean checkout can run `deno task dev`
without creating `.env`.

### Cursor and VS Code

Install the recommended **Deno** extension when the editor prompts for it. The
repository's `.vscode/settings.json` enables the Deno language server and
formatter for TypeScript and TSX files.

After the first checkout, run `deno install --frozen` before relying on editor
diagnostics. If the repository was already open, reload the editor window after
installing the extension so it replaces the default TypeScript language server.

## Commands

### Setup

| Command                     | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `./scripts/setup.sh`        | Prepare the clone and report workflow readiness     |
| `deno task setup`           | Run post-clone setup when Deno is already available |
| `deno install --frozen`     | Install locked Deno and npm dependencies            |
| `deno task setup:git-hooks` | Enable tracked Git hooks for this clone             |

### Development

| Command             | Purpose                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `deno task dev`     | Run the API and Vite dev servers together. Open <http://localhost:3000>.                                |
| `deno task dev:api` | Run the Deno API with file watching on port 8000. Uses `./data/dev/stackdraft.sqlite`.                  |
| `deno task dev:web` | Run the Vite frontend dev server. Proxies `/api` to the Deno API.                                       |
| `deno task start`   | Run the API as a single local process without file watching. Also defaults to the development database. |

### Database

| Command                    | Purpose                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `deno task db:migrate:dev` | Apply pending SQL migrations to `./data/dev/stackdraft.sqlite` without starting the HTTP server.                                           |
| `deno task db:reset:dev`   | Delete development SQLite files under `./data/dev` and recreate a fresh database. Refuses `./data/prod` and any path outside `./data/dev`. |

The direct database tasks target development only. For production-style data,
`./scripts/setup.sh` applies migrations through a one-shot container without
starting the application. There is deliberately no production reset command.
Docker Compose also applies pending migrations when the application starts.

### Quality and build

| Command              | Purpose                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `deno task check`    | Type-check the listed API, frontend, and test entry points                                            |
| `deno task test`     | Run API and frontend test suites                                                                      |
| `deno task test:api` | Run backend tests in `tests/`                                                                         |
| `deno task test:web` | Run frontend Vitest suite in `frontend/tests/`                                                        |
| `deno task fmt`      | Format supported files in the repository                                                              |
| `deno task lint`     | Lint TypeScript and TSX sources                                                                       |
| `deno task build`    | Build the production frontend bundle into `dist/`                                                     |
| `deno task ci`       | Run the full local CI pipeline: format check, lint, type-check, test, isolated full API QA, and build |

### API QA

| Command                  | Purpose                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `deno task qa:api:smoke` | Read-only API checks against a running app. Defaults to `http://127.0.0.1:8000`. Override with `--base-url`.                |
| `deno task qa:api:full`  | Start an isolated API with a temporary database, run mutating HTTP checks, write `qa-results/api-suite.json`, and clean up. |

`deno task ci` includes `deno task qa:api:full` as the merge-blocking assembled
API check. Use `deno task qa:api:smoke` while developing against an already
running `deno task dev:api` process without mutating its data.

### Docker (production-style)

| Command                     | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `docker compose up --build` | Build and start Stackdraft. Persists data in `./data/prod`. |
| `docker compose down`       | Stop and remove the Compose stack                           |
| `docker compose stop`       | Stop the running container without removing it              |
| `docker compose start`      | Start a stopped container                                   |

## Configuration

| Variable                   | Development default            | Container default         |
| -------------------------- | ------------------------------ | ------------------------- |
| `STACKDRAFT_HOST`          | `127.0.0.1`                    | `0.0.0.0`                 |
| `STACKDRAFT_PORT`          | `8000`                         | `8000`                    |
| `STACKDRAFT_DATABASE_PATH` | `./data/dev/stackdraft.sqlite` | `/data/stackdraft.sqlite` |
| `STACKDRAFT_LOG_LEVEL`     | `info`                         | `info`                    |

Copy `.env.example` to `.env` only when you need local overrides. Compose uses
`STACKDRAFT_PORT` as the host port while the container continues to listen on
8000 and persists data under `./data/prod`.

To make Stackdraft reachable from another computer on the same trusted network,
run the Compose setup and open `http://<host-lan-ip>:8000` from that computer.
Firewall rules on the host may need to allow the port.

## Data, backup, and transfer

Runtime SQLite data lives in two host directories:

- `./data/dev` for local Deno development
- `./data/prod` for Docker Compose

`./scripts/setup.sh` creates or migrates the database for each workflow whose
runtime is available. Application startup also keeps migrations idempotently
current.

For a safe v0.1 backup of the production-style database:

```sh
docker compose stop
cp data/prod/stackdraft.sqlite stackdraft-backup.sqlite
docker compose start
```

To restore a stopped backup into a clean checkout or deployment:

1. Stop Stackdraft if the destination is already running.
2. Create `data/prod` in the destination checkout if it does not exist.
3. Copy the backup to `data/prod/stackdraft.sqlite`.
4. Run `docker compose up -d --build`.

To transfer the complete deployment, copy the repository and its stopped
`data/prod` directory to the destination machine, install Docker, and run the
same Compose command.

Do not copy the SQLite file while Stackdraft is running. An online backup
command can be added later.

## Repository map

```text
api/
├── defs/              Shared type and schema definitions
├── core/              Resource use cases, validation, store contracts, errors
├── infrastructure/
│   ├── database/      SQLite connection, migrations, and store implementations
│   └── http/          Oak routes and HTTP error mapping
└── lib/               Shared backend mechanics

frontend/
└── src/
    ├── api/           Browser-side API calls
    ├── app/           Router and application shell
    ├── features/      Feature UI by resource
    ├── lib/           Shared frontend mechanics
    └── styles/        CSS tokens and global styles

migrations/            Ordered, immutable SQL migrations
tests/                 Deno backend tests
qa/                    Assembled-app API QA harness
docs/                  Product direction, PR queue, and architecture decisions
data/
├── dev/               Local development SQLite data (ignored by git)
└── prod/              Docker Compose SQLite data (ignored by git)
```

The frontend runs in the browser. It can call HTTP endpoints but never imports
database or server modules. Oak translates HTTP into core calls. Effect models
core behavior and typed failures. SQLite owns persistent state.

## Current scope

Stackdraft v0.1 implements the Draft, Stack, and State workflows described in
[`docs/v0.1-spec.md`](docs/v0.1-spec.md):

- Global standalone and stacked Draft capture, editing, assignment, and State
  filtering
- Stack creation, editing, State filtering, and Stack-specific Draft capture
- Stack and Draft State creation, editing, ordering, default selection, and
  guarded deletion
- Persistent SQLite storage, migrations, health reporting, Docker deployment,
  and stopped-database backup and restoration

Stack and Draft deletion, authentication, and the specification's explicit
non-goals remain outside v0.1.

## License

No license has been selected. All rights are reserved until that decision is
made.
