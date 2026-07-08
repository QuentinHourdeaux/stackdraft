# Stackdraft v0.1 Implementation Contract

## Purpose

This document removes recurring implementation choices from individual PRs. It
is the shared handoff contract for a coding agent implementing a file from
[`planned-prs/`](planned-prs/).

The coding agent should not redesign these decisions inside a feature PR. If the
current code proves a decision impossible or materially harmful, stop and record
the conflict instead of silently choosing a different architecture.

## Instruction precedence

When instructions appear to conflict, use this order:

1. The active file in `planned-prs/`
2. This implementation contract
3. `v0.1-spec.md`
4. `domain-language.md`
5. The architecture decision records
6. `product-north-star.md`

The domain language remains authoritative for the meaning and spelling of
Stackdraft concepts at every level.

## PR execution protocol

For each PR:

1. Start from current `main`.
2. Read the entire active PR file and every document it references.
3. Inspect the current implementation before adding abstractions.
4. Implement only the active PR's included scope.
5. Add or update tests for each acceptance criterion.
6. Run `deno task ci`.
7. Update `project-evolution.md` only when the work teaches a durable product or
   process lesson; do not add a routine changelog entry.
8. Delete the active PR file as the final implementation change.

Do not implement preparatory behavior assigned to a later PR. A small interface
needed by the current slice is allowed; speculative fields, endpoints,
components, and extension systems are not.

### Composer handoff prompt

Use this prompt with the active plan path substituted:

```text
Implement docs/planned-prs/NN-plan-name.md.

Read that file and every document it marks as required context before changing
code. Follow docs/implementation-contract.md. Inspect the current repository and
merged dependencies first. Implement only the Included scope and fixed details;
do not pull work forward from later PRs.

Add tests for every acceptance criterion, run deno task ci, and delete the active
plan file as the final implementation change. Update project-evolution.md only
if the work reveals a durable product or process lesson. Do not commit or push.

If current code materially conflicts with the plan, stop and explain the exact
conflict instead of silently redesigning the contract.
```

## Backend resource structure

Use these boundaries as the codebase grows:

```text
api/
├── defs/              Shared type and schema definitions only
├── core/              Resource use cases, validation, store contracts, error catalog
├── infrastructure/    Runtime adapters: HTTP, SQLite, process-facing code
├── lib/               Generic reusable mechanics, not Stackdraft concepts
├── commands/          CLI entry points
├── config.ts
└── main.ts
```

New backend resources use this structure:

```text
api/defs/<resource>/
├── <resource>.ts          Entity/shared types, unions, and definition constants
└── <resource>-schema.ts   Effect schemas and inferred schema types

api/core/<resource>/
├── input.ts               Use-case input types
├── service.ts             Public service facade: interface, tag, accessors
├── service-live.ts        Service implementation and use-case orchestration
├── store.ts               Core store contract
└── validation.ts          Resource-specific validation helpers

api/infrastructure/database/
└── <resource>-store.ts    SQLite implementation of the core store contract
```

Open files in this order when learning or extending a resource:

- `api/core/<resource>/service.ts` shows what the resource can do.
- `api/core/<resource>/service-live.ts` shows how use cases are implemented.
- `api/core/<resource>/store.ts` shows which data operations core needs.
- `api/infrastructure/database/<resource>-store.ts` shows SQLite details.
- `api/defs/<resource>/` shows shared type and payload definitions.
- `api/core/errors.ts` shows every backend tagged error in one catalog.

Rules:

- `api/defs` contains definitions only: interfaces, type aliases, schemas,
  schema-derived types, and constants that define unions. It must not contain
  validation functions, mapping functions, services, stores, adapters, or
  runtime logic.
- `api/core` owns application behavior. It must not import Oak, SQLite,
  filesystem, environment variables, or HTTP request/response types.
- `api/core/<resource>/service.ts` is the public facade. Keep it scan-friendly;
  move implementation detail into `service-live.ts`, `validation.ts`,
  `input.ts`, or `store.ts`.
- `api/core/<resource>/store.ts` defines the storage contract that core depends
  on. It is not the database implementation.
- `api/core/errors.ts` is the only place backend `Data.TaggedError` classes are
  defined. Group errors by area in that file so maintainers can audit all error
  tags without grepping the repository.
- `api/infrastructure/http` translates HTTP into core operations. It does not
  execute SQL.
- `api/infrastructure/database` implements store contracts. It must not know
  about HTTP requests or responses.
- Inside resource folders, use short filenames because the path carries the
  resource name: `service.ts`, not `state-service.ts`.

## Frontend boundaries

Use these boundaries as the frontend grows:

```text
frontend/src/
├── api/                    Typed fetch functions and entity API clients
├── app/                    Router and application shell
├── features/               State, Stack, and Draft feature UI
├── lib/                    Shared frontend mechanics
└── styles/                 Tokens and global/shared styles
```

- React modules use the typed frontend API client and never import backend
  modules. Shared contracts may be extracted later only when duplication proves
  harmful.
- Keep feature-specific frontend components together under
  `frontend/src/features/<feature>/`.

## Shared lib boundaries

Shared `lib` code extracts repeated mechanics, not domain concepts. Add a helper
only when the current code has at least two real call sites or when the helper
protects a cross-cutting invariant such as request decoding, typed error
response mapping, Effect execution, transaction rollback, SQLite error
detection, shared validation primitives, API error decoding, or form error
splitting. Call sites must still read in domain language.

Backend and frontend have separate lib roots:

```text
api/lib/
├── effect/       Effect runtime boundary helpers
├── http/         HTTP request, response, and API error mechanics
├── sqlite/       SQLite row, transaction, and generic error mechanics
├── time/         Generic UTC DateTime conversion and formatting
└── validation/   Shared validation primitives

frontend/src/lib/
├── api/          Fetch response and API error mechanics
├── async/        Browser async state helpers
└── forms/        Generic form/error helpers
```

Use these guardrails:

- Resource definitions and core rules stay in `api/defs` or `api/core`, not in
  `api/lib`.
- Error definitions stay in `api/core/errors.ts`; error handling, mapping, and
  serialization helpers may live in infrastructure or lib when they are generic
  mechanics.
- Entity-specific store behavior stays in store implementations, not in generic
  table mappers.
- Entity API clients stay in `frontend/src/api/`; frontend lib code may decode
  generic response mechanics but must not own State, Stack, or Draft contracts.
- UI components remain in feature folders unless a second real feature needs the
  same component shape.
- Do not introduce a root-level shared package, generic CRUD route generator,
  store base class, global state library, or data-fetching library in v0.1.
- A wrapper should remove repeated mechanics while keeping HTTP method/path,
  domain operation, response status, and encoder visible at the call site.

## Effect and dependency wiring

- Use Effect for core services, store dependencies, configuration, typed
  failures, and lifecycle.
- Define store contracts and core services with `Context.Tag`.
- Provide live implementations with `Layer`.
- Keep constructors such as `makeStateService` available when they make unit
  testing simpler without a complete runtime.
- Convert Effects to Promises only at the process or HTTP composition boundary.
- `api/main.ts` owns live SQLite layers, the managed runtime, and Oak dependency
  wiring.
- HTTP tests inject simple Promise-returning fakes into `createApp`; they should
  not need a real database.
- Expected domain failures must remain typed until the HTTP error mapper
  converts them. Do not catch every failure and return `500`.

The existing health slice is the style reference, not a requirement to keep all
future code in the same files.

## File and directory naming

- Repository-owned file and directory names use lowercase kebab-case.
- Separate words with one hyphen: `state-store.ts`, `state-store-test.ts`, and
  `read-only-state-catalog.md`.
- Single lowercase words such as `app.ts`, `config.ts`, and `migrations/`
  already satisfy the convention.
- TypeScript symbols keep their normal conventions: React components, classes,
  and types remain PascalCase; functions and values remain camelCase.
- Do not use camelCase, PascalCase, snake_case, or spaces in new path names.
- Future migrations use `NNNN-description-in-kebab-case.sql`.
- A PR that introduces or changes a repository convention must update every
  affected tracked file in the same PR. Do not leave known violations for a
  later cleanup PR.
- Conventions should simplify development, not require compatibility
  workarounds. When a tool has a strong native naming requirement, document the
  narrow exception and use the native behavior.

Exceptions are limited to names required or strongly established by tooling and
platforms, including `README.md`, `Dockerfile`, `LICENSE`, dotfiles,
`package.json`, `deno.json`, `deno.lock`, `vite.config.ts`, and GitHub workflow
paths. Deno test modules retain the natively discovered `*_test.ts` suffix.
Generated dependency files are outside this rule.

Merged migrations are immutable. `migrations/0001_initial.sql` keeps its
existing name; it is not renamed retroactively.

## Identity, time, and text

- IDs are lowercase UUID strings generated with `crypto.randomUUID()`.
  Definitions and schemas must type IDs with UUID-specific primitives such as
  `Schema.UUID`, not plain strings.
- API timestamps are UTC ISO-8601 values. Definitions and schemas must type
  timestamps with DateTime-specific primitives such as `Schema.DateTimeUtc`, not
  plain strings.
- Numeric ordering fields such as positions must be typed as integers with
  integer-specific primitives such as `Schema.Int` or `Schema.NonNegativeInt`,
  not plain numbers.
- Services receive `generateId: () => string` and `now: () => Date` when they
  create or update records. Live wiring uses `crypto.randomUUID` and `new Date`;
  tests use deterministic fakes.
- Trim user-entered names and titles before validation and persistence.
- Preserve internal whitespace and description formatting.
- State names: 1–40 characters after trimming.
- Stack and Draft titles: 1–160 characters after trimming.
- Descriptions: 0–20,000 characters.
- State colors: exact CSS hex form `#RRGGBB`, accepted case-insensitively and
  stored lowercase. The shared CSS hex primitive lives in `api/lib/validation`;
  State-specific validation owns the field name and user-facing error message.
- PATCH requests must contain at least one recognized mutable field.
- Entity scope, IDs, creation timestamps, and parent relationships are
  immutable.

Character limits count JavaScript string length in v0.1. Grapheme-aware limits
are unnecessary for this proof of concept.

## SQLite conventions

- Every schema change is a new ordered migration; never edit a migration already
  merged to `main`.
- Use `STRICT` tables.
- Use `TEXT` for IDs and timestamps and `INTEGER` with `CHECK (... IN (0, 1))`
  for booleans.
- Use `COLLATE NOCASE` where the schema requires case-insensitive uniqueness.
- Positions are zero-based, contiguous within their scope, and sorted ascending.
- Foreign keys use `ON UPDATE RESTRICT ON DELETE RESTRICT`.
- Store implementations map snake_case database rows to camelCase core values.
- Multi-row invariant changes use `BEGIN IMMEDIATE` transactions and fully roll
  back on failure.
- Translate expected SQLite constraint failures into typed application errors;
  do not expose SQL text to clients.
- Queries with user values use prepared statements.

Migrations run automatically at startup. Migration tests must assert the new
version, required seed or schema behavior, and idempotence.

## HTTP and JSON conventions

- API paths and query parameter names are lowercase/camelCase exactly as written
  in `v0.1-spec.md`.
- JSON fields are camelCase.
- Entity responses contain the entity directly.
- Collection responses use a named envelope: `{ "states": [...] }`,
  `{ "stacks": [...] }`, or `{ "drafts": [...] }`.
- Successful creation returns `201`.
- Successful reads and updates return `200`.
- Successful deletion returns `204` with no body.
- Request bodies use `application/json`.
- Reject malformed JSON, unknown fields, invalid query parameters, and invalid
  path IDs.
- Use Effect Schema at the HTTP boundary with excess-property rejection.
- Do not return stack traces, SQL messages, filesystem paths, or dependency
  details.

Collection ordering is deterministic:

- States: `position ASC`, then `id ASC`
- Stacks: `created_at DESC`, then `id ASC`
- Drafts: `created_at DESC`, then `id ASC`

### Mutation bodies

```ts
type CreateStateBody = {
  scope: "stack" | "draft";
  name: string;
  color: string;
};

type UpdateStateBody = {
  name?: string;
  color?: string;
};

type MoveStateBody = {
  position: number;
};

type CreateStackBody = {
  title: string;
  description?: string;
  stateId?: string;
};

type UpdateStackBody = {
  title?: string;
  description?: string;
  stateId?: string;
};

type CreateDraftBody = {
  title: string;
  description?: string;
  stateId?: string;
};

type UpdateDraftBody = {
  title?: string;
  description?: string;
  stateId?: string;
};
```

Setting a default State requires no request body. State scope is immutable.

### Error contract

All API errors retain this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {
      "fields": {
        "name": "Name is required."
      }
    }
  }
}
```

`details` is always an object. Field details are included when a particular
input caused the failure and omitted otherwise.

Use these stable codes:

| Status | Code                  | Meaning                                         |
| ------ | --------------------- | ----------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | Malformed or invalid body, query, or path input |
| 400    | `INVALID_STATE_SCOPE` | A State belongs to the wrong entity scope       |
| 404    | `STATE_NOT_FOUND`     | Requested State does not exist                  |
| 404    | `STACK_NOT_FOUND`     | Requested Stack does not exist                  |
| 404    | `DRAFT_NOT_FOUND`     | Requested Draft does not exist in that Stack    |
| 409    | `STATE_NAME_CONFLICT` | State name already exists in its scope          |
| 409    | `STATE_IN_USE`        | Stack or Draft currently references the State   |
| 409    | `STATE_IS_DEFAULT`    | State is the current default for its scope      |
| 409    | `LAST_STATE_IN_SCOPE` | Deletion would leave a scope without States     |
| 500    | `UNKNOWN_ERROR`       | Unexpected failure                              |
| 503    | `SERVICE_UNAVAILABLE` | Health dependency unavailable                   |

Malformed UUIDs are validation errors. A syntactically valid but absent filter
ID returns an empty collection. A filter that names a State from the wrong scope
returns `INVALID_STATE_SCOPE`.

## State behavior

- `GET /api/states` requires exactly one `scope=stack|draft` query parameter.
- Creating a State appends it after the current final position in its scope and
  creates it as non-default.
- Updating a State changes only `name`, `color`, and `updatedAt`.
- Moving a State shifts the affected inclusive range and updates every changed
  row in one transaction. Positions outside `0..count-1` are invalid.
- `PUT /api/states/:stateId/default` makes that State the sole default in its
  scope and returns the updated State.
- Deletion checks constraints in this order: not found, default, last in scope,
  then foreign-key use during deletion. Eligible deletion compacts later
  positions.

## Stack and Draft behavior

- Omitted descriptions become `""`.
- Omitted `stateId` resolves to the current default for the correct scope inside
  the create operation.
- Supplying a valid but missing State ID returns `STATE_NOT_FOUND`.
- `updatedAt` equals `createdAt` on creation and changes on successful mutation.
- Stack and Draft collection filters are optional.
- Draft routes always scope lookup and mutation by both `stackId` and `draftId`.
  A Draft belonging to another Stack is reported as `DRAFT_NOT_FOUND`.
- Stack and Draft deletion do not exist in v0.1.

## Frontend conventions

- Use React Router in declarative/library mode with `BrowserRouter`, not a
  framework-mode setup or generated route system.
- Use semantic HTML and native controls before introducing abstractions.
- Keep server-owned data in feature hooks or components using `fetch`; do not
  add a global state library or data-fetching library in v0.1.
- Every request started by an effect uses an `AbortController`.
- The frontend API layer decodes the standard error body into a typed
  `ApiError`; UI components do not parse arbitrary response JSON.
- Forms disable duplicate submission while a mutation is pending.
- On success, update from the server response or refetch; do not fabricate IDs,
  timestamps, positions, or defaults in the browser.
- Validation errors appear beside the relevant field. Non-field errors appear in
  an `aria-live` region.
- State color is always accompanied by its name.
- All interactions must work without drag-and-drop or pointer-only controls.
- Reuse the existing CSS token layer. Add a token when a value is genuinely
  shared; avoid a component framework and premature design system.

Planned PR 07 introduces the frontend test harness using Vitest, jsdom, React
Testing Library, and `user-event`, all pinned through the Deno lockfile. It also
splits the tasks into `test:api` and `test:web`; `deno task test` runs both.
Later UI PRs test user-visible behavior rather than component internals or
snapshots.

## Testing and completion

- Store tests use an in-memory SQLite database with migrations applied.
- Service tests use deterministic IDs and clocks.
- HTTP tests use `app.handle(new Request(...))` and injected operations.
- UI tests query by accessible role, name, label, and visible text.
- Test the success path plus validation, not-found, conflict, and rollback paths
  introduced by the active PR.
- Update the `check` task when new independent test entry points are added;
  imported source modules are checked transitively.
- `deno task ci` must remain the one complete local merge gate. It includes the
  isolated full API QA suite (`deno task qa:api:full`) and must fail when the
  assembled HTTP API check fails.
- `deno task qa:api:smoke` is the safe read-only check for an already running
  local API. `deno task qa:api:full` is the merge-blocking isolated check used
  by `deno task ci`.
- API PRs that add externally visible endpoint behavior must extend
  `qa/api-suite.ts` with smoke and/or full coverage for the new contract while
  keeping store, service, and HTTP route tests as the primary correctness
  mechanism.
- Do not weaken strict TypeScript, lint, formatting, migration safety, or the
  existing health behavior to make a feature pass.
