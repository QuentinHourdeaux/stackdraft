# ADR 0003: Use a React single-page application

Status: Accepted

## Context

Stackdraft needs an interactive developer-tool interface, and its author wants
to learn frontend development using broadly transferable tools.

## Decision

Use React with TypeScript and Vite. Keep browser state local to components until
a concrete need for shared state appears. Use plain CSS and a small token layer
before adopting a component or styling framework.

## Consequences

- Frontend concerns remain explicit and learnable.
- Vite provides a focused development and build workflow.
- The browser communicates with the Deno backend through `/api`.
- Server-side rendering, a global state library, and frontend caching are not
  included in v0.1.
