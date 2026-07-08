# Planned PR 20 — Structured Backend Logging

Depends on the shared lib foundation refactor.

## Required context

Read:

- `README.md`
- `docs/implementation-contract.md`
- `docs/domain-language.md`
- `docs/v0.1-spec.md`
- `api/config.ts`
- `api/core/errors.ts`
- `api/main.ts`
- `api/commands/db.ts`
- `api/infrastructure/database/migrate.ts`
- `api/infrastructure/http/app.ts`
- `api/infrastructure/http/routes/states.ts`
- `api/lib/http/response.ts`
- `api/lib/effect/run-effect.ts`

## Outcome

Add backend structured logging that is useful for a human debugging a personal
self-hosted Stackdraft instance from terminal or Docker logs. Logs should be
clear, concise, filterable, and consistent without making each log call a
paperwork exercise.

The logger should accumulate context as execution moves through HTTP, command,
and application boundaries. A log call at the event point should only need to
provide the event-specific message, level, and fields; stable context such as
service, method, route, request ID, and related resources should already be
attached to the scoped logger.

## Included

- Add a backend-only logging lib under `api/lib/logging/`.
- Use the existing `STACKDRAFT_LOG_LEVEL` config value for level filtering.
- Emit structured log objects to stdout/stderr.
- Add contextual child logger support with `.with(context)`.
- Add static TypeScript catalogs for log levels, services, resources, events,
  and outcomes.
- Add request IDs and HTTP request completion/failure logging.
- Replace direct `console.error` calls in backend request handling with the
  logger.
- Log app startup, shutdown cleanup, migration, and database command boundaries.
- Add focused tests for logger context merging, level filtering, safe error
  serialization, static event typing, and HTTP request logging.
- Update `docs/implementation-contract.md` with logging standards.

## Fixed implementation details

### File layout

Create:

```text
api/lib/logging/
├── events.ts
├── logger.ts
├── request-logger.ts
├── resources.ts
└── services.ts
```

Names may be adjusted if the implementation reveals a cleaner split, but keep
all generic logging mechanics under `api/lib/logging/`.

Do not add a frontend logging system in this PR.

### Core logger shape

The logger is an immutable contextual object. Calling `.with(context)` returns a
new logger with merged context; it must not mutate the parent logger.

Use this conceptual API:

```ts
export interface Logger {
  readonly with: (context: LogContext) => Logger;
  readonly debug: (entry: LogInput) => void;
  readonly info: (entry: LogInput) => void;
  readonly warn: (entry: LogInput) => void;
  readonly error: (entry: LogInput) => void;
}
```

Every emitted log entry contains:

- `timestamp`
- `level`
- `service`
- `method`
- `event`
- `message`

Additional context fields are included only when present.

The logger must support a no-op logger for tests and call sites that do not need
logging yet.

### Static catalogs

Use TypeScript constants and unions, not database tables.

Define log levels:

```ts
export const logLevels = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof logLevels)[number];
```

Define services for current backend boundaries:

```ts
export const logServices = [
  "app",
  "http",
  "state",
  "migration",
  "database-command",
] as const;
```

Define resources for current product entities:

```ts
export const logResources = ["stack", "draft", "state"] as const;
export type LogResource = (typeof logResources)[number];

export interface LogResourceRef {
  readonly type: LogResource;
  readonly id: string;
}
```

Define outcomes:

```ts
export const logOutcomes = ["success", "failure", "skipped"] as const;
```

Define a static event catalog. Include at minimum:

```ts
export const logEvents = [
  "app_started",
  "app_shutdown_started",
  "app_shutdown_completed",
  "request_completed",
  "request_failed",
  "state_persistence_failed",
  "migration_started",
  "migration_completed",
  "migration_failed",
  "database_command_started",
  "database_command_completed",
  "database_command_failed",
] as const;
```

Events must be stable, lowercase snake-case strings. Do not create ad hoc event
strings at call sites.

### Log context

Use generic resource references instead of hard-coded fields such as `stackId`,
`draftId`, and `stateId`.

Use this conceptual context shape:

```ts
export interface LogContext {
  readonly service?: LogService;
  readonly method?: string;
  readonly route?: string;
  readonly requestId?: string;
  readonly resources?: readonly LogResourceRef[];
}
```

Context merging rules:

- Later scalar context values override earlier scalar values.
- `resources` are appended and de-duplicated by `type + id`.
- Empty or undefined context fields are omitted from output.
- Context merge behavior is covered by tests.

### Log input

Use this conceptual input shape:

```ts
export interface LogInput {
  readonly event: LogEvent;
  readonly message: string;
  readonly httpStatus?: number;
  readonly outcome?: LogOutcome;
  readonly durationMs?: number;
  readonly cause?: unknown;
}
```

Use `httpStatus` for HTTP status codes. Do not use a generic `status` field
because it becomes ambiguous once non-HTTP operations are logged.

`message` is required. The event identifies the log for filtering; the message
explains it to a human.

### Output format

Emit one structured log object per line.

For v0.1, JSON-lines output is acceptable for both local development and Docker
because it is copyable, grep-friendly, and usable by `docker compose logs`.

Use stdout for `debug` and `info`. Use stderr for `warn` and `error`.

Example:

```json
{
  "timestamp": "2026-07-08T13:42:10.123Z",
  "level": "info",
  "service": "http",
  "method": "request",
  "route": "GET /api/states",
  "requestId": "...",
  "event": "request_completed",
  "message": "Completed HTTP request.",
  "httpStatus": 200,
  "durationMs": 4,
  "outcome": "success"
}
```

### Error serialization

When a log includes `cause`, serialize it safely:

- `name` when available
- `message` when available
- `stack` only for `debug` level or when `STACKDRAFT_LOG_LEVEL=debug`
- tagged error `_tag` when available
- The backend tagged error catalog lives in `api/core/errors.ts`; do not create
  new error classes for logging.

Do not log request bodies, SQL text, dependency internals, or arbitrary object
dumps. Unknown causes should serialize to a bounded string.

### Request logging middleware

Add request logging middleware under `api/lib/logging/request-logger.ts`.

Each request receives:

- generated `requestId`
- route context where known
- request method
- request path
- duration in milliseconds
- final HTTP status
- success or failure outcome

The middleware should log one completion entry for each handled request:

```ts
logger.with({
  service: "http",
  method: "request",
  route: "GET /api/states",
  requestId,
}).info({
  event: "request_completed",
  message: "Completed HTTP request.",
  httpStatus: context.response.status,
  durationMs,
  outcome: "success",
});
```

For unhandled exceptions, log `request_failed` with `outcome: "failure"` and the
safe serialized cause before the application maps the response to `500`.

Request logging must not expose query parameter values beyond the route/path
shape unless they are already part of a route pattern. For v0.1 it is acceptable
to log the request pathname without query string.

### Logger dependency flow

Create the root logger in `api/main.ts` from `config.logLevel`.

Pass a scoped logger into `createApp`:

```ts
createApp({
  logger: rootLogger.with({ service: "http" }),
  ...
});
```

Route modules may create more specific loggers:

```ts
const stateRouteLogger = logger.with({ service: "state" });
```

At operation points, add method and resource context:

```ts
const log = stateRouteLogger.with({
  method: "deleteState",
  resources: [{ type: "state", id: stateId }],
});
```

Do not introduce automatic call-stack inspection. Do not use global mutable
logger state. Do not require every service function to accept a logger in this
PR. Prefer explicit logger passing at infrastructure and route boundaries.

### Module-local logger helpers

Module-local logger helpers are allowed when they reduce friction and
standardize context. They should wrap the generic logger, not implement logging
themselves.

Example:

```ts
export const stateLogger = (logger: Logger) =>
  logger.with({ service: "state" });

export const stateMethodLogger = (
  logger: Logger,
  method: string,
  stateId?: string,
) =>
  stateLogger(logger).with({
    method,
    resources: stateId === undefined ? [] : [{ type: "state", id: stateId }],
  });
```

Only add such a helper where current call sites benefit from it.

### Initial logging call sites

Log these events:

- app startup after config is loaded and before listening begins;
- shutdown cleanup started and completed;
- migration started, completed, and failed;
- database command started, completed, and failed for `migrate` and `reset`;
- every HTTP request completion;
- every unhandled HTTP request failure;
- State persistence failures currently mapped to `UNKNOWN_ERROR`.

For startup logs, include safe operational context:

- configured host
- configured port
- log level
- database path category, such as `"development"`, `"container"`, `"custom"`,
  not necessarily the full path

### Existing console calls

Replace backend `console.error` calls used for operational failures with the
logger. Do not remove `console.log` only when it is deliberate CLI user output
and not operational logging, unless the new logger provides the same human
value.

## Not included

- Frontend/browser logging
- Persisted logs in SQLite
- Log viewer UI
- External logging dependencies
- Async context propagation
- Automatic service/method detection from stack traces
- Logging every service method by default
- Request or response body logging
- SQL query logging
- DB-backed event registry
- A telemetry, metrics, tracing, or alerting system

## Acceptance

- `api/lib/logging/` contains the backend logger implementation and static
  catalogs.
- The logger emits JSON-lines with required fields: `timestamp`, `level`,
  `service`, `method`, `event`, and `message`.
- Log events, services, resources, and outcomes are TypeScript unions derived
  from static constants.
- `.with(context)` returns a child logger without mutating the parent.
- Resource context uses `resources: [{ type, id }]` rather than hard-coded ID
  fields.
- `STACKDRAFT_LOG_LEVEL` filters output correctly.
- HTTP request middleware logs completion and unhandled failure entries with a
  request ID, route/path context, HTTP status, duration, and outcome.
- State persistence failures use the logger instead of direct `console.error`.
- Migration and database command boundaries are logged.
- Sensitive/noisy data such as request bodies and SQL text is not logged.
- Tests cover level filtering, context merging, resource de-duplication, error
  serialization, request logging, and at least one State route error log.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
