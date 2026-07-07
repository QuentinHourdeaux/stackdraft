# Planned PR 05 — API QA Harness

Depends on Planned PR 04.

## Required context

Read `docs/implementation-contract.md`, `docs/v0.1-spec.md`, `README.md`,
`deno.json`, `api/main.ts`, and the merged State API implementation.

## Outcome

Add Stackdraft's first merge-blocking assembled-app API check. The suite
exercises Stackdraft like a real HTTP client, starts the API against an isolated
temporary database for full checks, and becomes part of `deno task ci` so a PR
cannot be considered mergeable while the assembled API contract is failing.

The suite also provides a non-destructive smoke mode for humans and agents to
check an already running local app without mutating its data. This is not a
replacement for unit, service, repository, or HTTP route tests; it is the
blocking product-level confidence check for the assembled API process.

## Included

- `qa/api-suite.ts` or an equivalently small Deno entry point for API QA.
- A non-destructive smoke mode for an already running app.
- A full mode that starts Stackdraft against a temporary SQLite database,
  performs mutating HTTP scenarios, reports results, and cleans up.
- Deno tasks for the smoke and full modes.
- `deno task ci` integration for the isolated full mode so the check is
  merge-blocking.
- Structured, agent-readable pass/fail output.
- Documentation explaining when to use the QA suite directly and when it runs as
  part of `deno task ci`.
- An implementation-contract update requiring future API PRs to extend the QA
  suite when they add externally visible endpoint behavior.

## Fixed implementation details

- Keep `deno task ci` as the complete local merge gate and add
  `deno task qa:api:full` to it in this PR. A failing full API QA run must make
  `deno task ci` fail.
- Add tasks with these roles:
  - `qa:api:smoke` runs against a caller-provided or default base URL and must
    not perform writes.
  - `qa:api:full` starts an isolated local API process using a temporary
    database path and performs writes only against that process.
- Default the smoke target to `http://127.0.0.1:8000` and allow overriding it
  with `--base-url`.
- Do not allow mutating checks against an arbitrary existing base URL unless a
  later PR introduces an explicit, separately reviewed safety mechanism. The
  merge-blocking check must always use the isolated full mode.
- Use `fetch` and standard Deno APIs. Do not introduce Postman, Newman,
  Playwright, OpenAPI generators, or a new test framework for this slice.
- The full-mode temporary database must live outside `./data/dev` and
  `./data/prod`, run migrations through normal app startup, and be removed after
  the suite exits.
- The suite must wait for `GET /api/health` before running endpoint scenarios
  and must terminate the child API process on success, failure, and interrupt.
- Output one concise line per check and exit non-zero on the first or final
  failure. Also write a JSON result file such as `qa-results/api-suite.json` so
  agents and CI logs can inspect failures mechanically.
- Do not commit generated QA result files.
- Keep request/response assertions close to the public API contract: status
  codes, error codes, envelope names, required fields, and observable
  persistence. Avoid asserting implementation-only details.
- Initial smoke coverage must include `GET /api/health`,
  `GET /api/states?scope=stack`, `GET /api/states?scope=draft`, and at least one
  representative validation failure that does not mutate data.
- Initial full coverage must create an isolated State, read it back through the
  collection endpoint, update it, move it when possible without depending on
  seed IDs, select it as default only when the scenario can leave the temporary
  data internally consistent, and cover representative validation/conflict
  failures.
- Keep the harness small and explicit. Add helpers only for repeated request,
  assertion, result-recording, startup, and cleanup mechanics.

## Not included

- Browser/UI automation
- Load, performance, or concurrency testing
- OpenAPI generation or contract publishing
- Mutating checks against `./data/dev`, `./data/prod`, or any user-supplied
  running app
- Stack, Draft, or State deletion QA beyond the endpoints that already exist
  after Planned PR 04

## Acceptance

- `deno task qa:api:smoke` passes against a running development API and does not
  create, update, move, default, or delete data.
- `deno task qa:api:full` starts an isolated API, exercises the current State
  endpoints over real HTTP, writes a JSON result file, and cleans up its child
  process and temporary database.
- `deno task ci` runs `deno task qa:api:full`; a QA failure makes CI fail and
  blocks merge readiness.
- Stopping or failing the full suite does not leave a running API process owned
  by the suite.
- A broken status code, response envelope, or error code causes a clear failure
  and a non-zero exit.
- README or equivalent docs explain that `deno task ci` includes the blocking
  full API QA suite, while `deno task qa:api:smoke` is the safe check for an
  already running app.
- `docs/implementation-contract.md` tells future API PRs to extend the QA suite
  for newly added endpoint behavior while keeping normal tests as the primary
  correctness mechanism.
- `deno task ci` passes.

## Completion signal

Delete this file in the implementation PR.
