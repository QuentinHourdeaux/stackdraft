# ADR 0002: Use SQLite for persistence

Status: Accepted

## Context

Stackdraft initially serves one user and a small dataset. Portability and low
operational overhead matter more than horizontal database scaling.

## Decision

Use Deno's built-in `node:sqlite` implementation. Store the database at
`/data/stackdraft.sqlite` in the container and bind-mount `./data` from the
host. Apply ordered SQL migrations automatically at startup.

## Consequences

- No separate database container is required.
- Transferring stopped application data is a filesystem copy.
- SQLite transactions and constraints remain available.
- The application should use one host process writing the database.
- Online backup and multi-instance deployment require deliberate future work.
