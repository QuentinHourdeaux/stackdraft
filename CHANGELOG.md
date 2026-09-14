# Changelog

User-visible changes to Stackdraft are recorded here. Dates use `YYYY-MM-DD`.
The v0.1.0 date marks the implemented baseline, not a tagged release; real-use
validation remains in progress.

## [Unreleased]

Add user-visible changes here under Added, Changed, or Fixed as they are merged.
Move them to a dated version section when that version is released.

## [0.1.0] - 2026-08-19

### Added

- Capture standalone Drafts with a title-only quick-add, then edit their
  descriptions, States, and optional Stack assignments. Browse all Drafts and
  filter them by State.
- Create and edit Stacks, browse their Drafts, add Drafts directly from a Stack,
  and filter Stacks or a Stack's Drafts by State.
- Manage separate Stack and Draft State workflows: create, rename, recolor,
  reorder, choose defaults, and delete States that are safe to remove.
- Keep Drafts, Stacks, and States in SQLite. Run the app with Docker Compose,
  prepare a clone with `./scripts/setup.sh`, and back up or restore a stopped
  database using the documented procedure.

### Fixed

- Keep Draft capture and detail views usable when related data fails to load,
  and distinguish load errors from genuinely empty lists.
- Reject blank Draft quick-add titles and keep Stack and State details accurate
  after Draft edits.
- Support host-owned Docker data directories and prevent setup from migrating
  the production database while the Compose service is active.
