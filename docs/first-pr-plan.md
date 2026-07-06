# Stackdraft First Commit / PR Plan

## Proposed PR

**Title:** `chore: scaffold the Stackdraft vertical skeleton`

### Goal

Establish the smallest runnable foundation that proves the chosen architecture
end to end:

```text
React UI → /api/health → Deno/Oak → Effect service → SQLite
                                      ↓
                              production static files
```

This PR creates no Stack, Draft, or State features. Its job is to remove
infrastructure uncertainty before feature work begins.

## PR deliverables

### Application

- A React/Vite page showing the Stackdraft name and a backend connection state.
- A Deno/Oak server exposing `GET /api/health`.
- A small Effect-based health service.
- A SQLite connection using `node:sqlite`.
- An initial migration runner and `schema_migrations` table.
- Production static-file serving from the Deno server.

### Developer workflow

- One command starts the frontend and API in development mode.
- Frontend changes hot reload through Vite.
- `/api` calls are proxied from Vite to Deno.
- Type-check, format, lint, test, build, and production-serve tasks are defined.
- Dependency versions are locked.

### Container workflow

- A multi-stage Dockerfile builds the frontend and runs the Deno API.
- Compose starts one application service.
- `./data` is mounted at `/data`.
- A container health check calls `/api/health`.
- The runtime uses a non-root user where the image and mounted-directory
  permissions allow it.

### Documentation

- README with development, test, Docker, LAN-access, backup, and restore
  instructions.
- Explicit warning that v0.1 has no authentication and must not be publicly
  exposed.
- v0.1 product specification committed under `docs/`.
- Architecture decision records for the choices most likely to be questioned
  later.

## Proposed repository tree

```text
stackdraft/
├── .github/
│   └── workflows/
│       └── ci.yml
├── api/
│   ├── application/
│   │   └── HealthService.ts
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── Sqlite.ts
│   │   │   └── migrate.ts
│   │   └── http/
│   │       ├── app.ts
│   │       └── errors.ts
│   ├── config.ts
│   └── main.ts
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── health.ts
│   │   ├── app/
│   │   │   └── App.tsx
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   └── tokens.css
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
├── migrations/
│   └── 0001_initial.sql
├── tests/
│   ├── health_test.ts
│   └── migrations_test.ts
├── docs/
│   ├── adr/
│   │   ├── 0001-single-container-monolith.md
│   │   ├── 0002-sqlite-persistence.md
│   │   └── 0003-react-spa.md
│   └── v0.1-spec.md
├── data/
│   └── .gitkeep
├── .dockerignore
├── .env.example
├── .gitignore
├── compose.yaml
├── deno.json
├── deno.lock
├── Dockerfile
├── LICENSE
└── README.md
```

## Layer responsibilities

### `frontend/`

Runs in the browser. It renders the interface, holds temporary UI state, and
calls `/api`. It never imports server or database modules.

### `api/infrastructure/http/`

Owns HTTP concerns: routes, status codes, JSON encoding, decoding, and mapping
typed application errors to responses.

### `api/application/`

Owns use cases and Effect service definitions. It does not know about Oak
request objects or React.

### `api/infrastructure/database/`

Owns SQLite connection lifecycle, pragmas, transactions, migration execution,
and later repository implementations.

### `migrations/`

Contains ordered, immutable SQL migrations. A migration is never edited after it
has been merged and used; a new migration changes the schema.

## Initial migration scope

The skeleton PR should create only `schema_migrations`, or use the migration
runner's own equivalent bookkeeping table.

The Stack, Draft, and State tables belong in the next feature PR. This keeps the
skeleton focused and lets the data-model PR receive proper review rather than
hiding domain decisions inside scaffolding.

## Configuration

Environment variables:

```text
STACKDRAFT_HOST=0.0.0.0
STACKDRAFT_PORT=8000
STACKDRAFT_DATABASE_PATH=/data/stackdraft.sqlite
STACKDRAFT_LOG_LEVEL=info
```

Development defaults may point the database to `./data/stackdraft.sqlite`.

Configuration is parsed and validated once at startup. Invalid configuration
fails fast with an actionable error.

## Deno tasks

The exact commands may change during scaffolding, but the public task interface
should be:

```text
deno task dev          # start API and Vite with reload
deno task dev:api      # start only API with reload
deno task dev:web      # start only Vite
deno task check        # type-check all TypeScript
deno task fmt          # format source
deno task lint         # lint source
deno task test         # run automated tests
deno task build        # build frontend production assets
deno task start        # serve API and built frontend
deno task ci           # check formatting, lint, types, tests, and build
```

## Health contract

`GET /api/health` returns `200` only when the application is running and can
query SQLite.

```json
{
  "status": "ok",
  "database": "ok"
}
```

An unavailable database returns `503` with the standard API error shape. The
endpoint must not expose file paths, stack traces, dependency versions, or
secrets.

## Visual skeleton

The first page should not attempt the final product design. It should establish:

- Application typography
- Background and surface colors
- Spacing and border-radius tokens
- A basic responsive application shell
- A visible API/database connection result

The page may say:

```text
Stackdraft
Track what you're building.

System ready
```

This is enough to teach and verify the React entry point, component composition,
CSS imports, API client, loading state, and error state.

## Automated checks

### Backend

- Health endpoint returns `200` when SQLite is available.
- Health endpoint returns `503` when its dependency fails.
- A fresh database applies migrations.
- Re-running migrations is idempotent.
- An unknown migration state fails safely.

### Frontend

For the first PR, production build and TypeScript checking are sufficient.
Component tests should be introduced with the first behavior-rich component
rather than installing a test stack solely to assert static text.

### Container

- Image builds successfully.
- Container starts with an empty mounted data directory.
- Health check becomes healthy.
- Restarting the container uses the same database.

## CI

The initial GitHub Actions workflow runs:

1. `deno fmt --check`
2. `deno lint`
3. Type checking
4. Automated tests
5. Frontend production build
6. Docker image build

CI should not publish images or deploy anything in the first PR.

## Suggested implementation sequence

1. Initialize the repository and Deno/Vite manifests.
2. Render the static Stackdraft React shell.
3. Start Oak and serve `GET /api/health`.
4. Introduce the Effect health service and typed failure.
5. Add SQLite connection lifecycle and pragmas.
6. Implement the migration runner.
7. Connect health to a trivial SQLite query.
8. Add frontend health fetching with loading/success/error states.
9. Build frontend assets and serve them through Oak.
10. Add Dockerfile, Compose, and persistent data mount.
11. Add tests and CI.
12. Finish README and ADRs.

## Review checklist

- [ ] `deno task ci` passes from a clean checkout.
- [ ] `docker compose up --build` starts Stackdraft.
- [ ] `http://localhost:8000` loads the React shell.
- [ ] `http://localhost:8000/api/health` reports database health.
- [ ] An empty `data` directory is initialized automatically.
- [ ] Container restart preserves the database.
- [ ] The application does not require Node.js, npm, or Deno on the Docker host.
- [ ] Runtime dependency versions are pinned.
- [ ] No secrets or machine-specific paths are committed.
- [ ] The no-auth trusted-network warning is visible in the README.
- [ ] The PR contains no Stack/Draft/State implementation.

## Recommended commit structure

If this is opened as a PR rather than committed as one large scaffold:

1. `chore: initialize Deno and React workspace`
2. `feat: add application health slice`
3. `feat: initialize SQLite migrations`
4. `build: add production container`
5. `ci: add repository checks`
6. `docs: describe Stackdraft architecture and local operation`

The commits should each build on the previous one and remain reviewable. They do
not need to be artificially independent if that makes the history misleading.

## PR description draft

```markdown
## What

Scaffolds Stackdraft as a Deno/Effect backend with a React/Vite frontend, SQLite
persistence, and a single-container Docker deployment.

The PR includes one vertical health slice to prove that the browser, API, Effect
services, SQLite, production asset serving, and container health check work
together.

## Why

Stackdraft v0.1 needs a small, portable foundation before domain features are
added. This PR resolves the core runtime and deployment questions without mixing
them with Stack and Draft behavior.

## Included

- React application shell
- Deno/Oak API
- Effect health service
- SQLite connection and migration runner
- Development and production workflows
- Docker Compose persistence
- CI and architecture documentation

## Not included

- Stacks
- Drafts
- Configurable States
- Authentication

## Verification

- `deno task ci`
- `docker compose up --build`
- Open `http://localhost:8000`
- Check `http://localhost:8000/api/health`
```

## Next PR

The second PR should implement configurable States as the first complete domain
slice:

```text
State migration
→ State repository
→ State service
→ State API
→ State settings UI
```

Stacks and Drafts depend on States, so building State configuration first avoids
temporary hardcoded workflows.
