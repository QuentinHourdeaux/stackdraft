# Stackdraft

> Track what you're building.

Stackdraft is a lightweight, self-hosted tracker for software engineers working
on personal Stacks.

The long-term direction is captured in the
[`Stackdraft Product North Star`](docs/product-north-star.md): work should
become clearer as it progresses, not noisier. Stackdraft's canonical vocabulary
is defined in [`Domain Language`](docs/domain-language.md).

This repository currently contains the v0.1 application skeleton. The page in
the browser calls a Deno API, the API runs an Effect service, and that service
checks a persistent SQLite database. Stack and Draft features arrive in the next
slices.

## Security boundary

> [!WARNING]
> Stackdraft v0.1 has no authentication or authorization. Anyone who can reach
> its port can access the application. Run it only on a trusted local network
> and do not expose it directly to the public internet.

## Stack

- Deno 2.9.1 and TypeScript
- Oak HTTP server
- Effect application services
- SQLite through Deno's built-in `node:sqlite`
- React 19 and Vite
- One production container with a mounted data directory

## Run with Docker

Docker is the only host dependency for the production-style workflow.

```sh
docker compose up --build
```

Open <http://localhost:8000>. The health endpoint is available at
<http://localhost:8000/api/health>.

Stop the application with:

```sh
docker compose down
```

The database remains in `./data`.

## Develop locally

Install Deno 2.9.1, then install the locked dependencies:

```sh
deno install --frozen
```

Start the API and Vite development server together:

```sh
deno task dev
```

Open <http://localhost:3000>. Vite proxies `/api` requests to the Deno server on
port 8000.

### Cursor and VS Code

Install the recommended **Deno** extension when the editor prompts for it. The
repository's `.vscode/settings.json` enables the Deno language server and
formatter for TypeScript and TSX files.

After the first checkout, run `deno install --frozen` before relying on editor
diagnostics. If the repository was already open, reload the editor window after
installing the extension so it replaces the default TypeScript language server.

Useful tasks:

```sh
deno task dev:api
deno task dev:web
deno task check
deno task test
deno task build
deno task start
deno task ci
```

`deno task ci` checks formatting, linting, types, tests, and the production
frontend build.

## Configuration

| Variable                   | Development default        | Container default         |
| -------------------------- | -------------------------- | ------------------------- |
| `STACKDRAFT_HOST`          | `127.0.0.1`                | `0.0.0.0`                 |
| `STACKDRAFT_PORT`          | `8000`                     | `8000`                    |
| `STACKDRAFT_DATABASE_PATH` | `./data/stackdraft.sqlite` | `/data/stackdraft.sqlite` |
| `STACKDRAFT_LOG_LEVEL`     | `info`                     | `info`                    |

Copy `.env.example` to `.env` for local overrides. Compose uses
`STACKDRAFT_PORT` as the host port while the container continues to listen on
8000.

To make Stackdraft reachable from another computer on the same trusted network,
run the Compose setup and open `http://<host-lan-ip>:8000` from that computer.
Firewall rules on the host may need to allow the port.

## Data, backup, and transfer

All user-owned runtime data lives under `./data`.

For a safe v0.1 backup:

```sh
docker compose stop
cp data/stackdraft.sqlite stackdraft-backup.sqlite
docker compose start
```

To restore or transfer Stackdraft:

1. Stop Stackdraft.
2. Copy the repository and `data` directory to the destination machine.
3. Install Docker.
4. Run `docker compose up -d --build`.

Do not copy the SQLite file while Stackdraft is running. An online backup
command can be added later.

## Repository map

```text
api/
├── application/       Effect services and use cases
└── infrastructure/
    ├── database/      SQLite connection and migrations
    └── http/          Oak routes and HTTP error mapping

frontend/
└── src/
    ├── api/           Browser-side API calls
    ├── app/           React components
    └── styles/        CSS tokens and global styles

migrations/            Ordered, immutable SQL migrations
tests/                 Deno backend tests
docs/                  Product north star, specs, and architecture decisions
data/                  Ignored local SQLite data
```

The frontend runs in the browser. It can call HTTP endpoints but never imports
database or server modules. Oak translates HTTP into application calls. Effect
models application behavior and typed failures. SQLite owns persistent state.

## Current scope

The skeleton intentionally implements only:

- Application shell
- `GET /api/health`
- Effect health service
- SQLite connection and migration runner
- Development and production build paths
- Docker persistence

It does not yet implement Stacks, Drafts, configurable States, or
authentication. See [`docs/v0.1-spec.md`](docs/v0.1-spec.md) for the product
scope.

## License

No license has been selected. All rights are reserved until that decision is
made.
