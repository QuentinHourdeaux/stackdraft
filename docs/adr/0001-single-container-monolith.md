# ADR 0001: Use a single-container monolith

Status: Accepted

## Context

Stackdraft v0.1 is a personal application that must be quick to build, simple to
operate on a local network, and easy to move to another machine.

## Decision

Development uses separate Vite and Deno processes for hot reload. Production
uses one Deno process that serves both the JSON API and the compiled React
assets from one container.

## Consequences

- Production has one service, origin, port, and image.
- No production CORS configuration is needed.
- The frontend and backend deploy together.
- Independent frontend scaling is unavailable and unnecessary for the expected
  workload.
