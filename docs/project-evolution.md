# Stackdraft Project Evolution

## Purpose

This document records what building Stackdraft teaches us about Stackdraft. It
preserves decisions, workflow friction, and product implications that would be
lost in a task list or commit history.

The record is intentionally not a second backlog. Remaining implementation work
lives in [`planned-prs/`](planned-prs/), and code history lives in Git.

This is also a manual prototype of the future product:

- each planned PR behaves like a Draft;
- its file holds the current implementation intent;
- GitHub will provide Delivery;
- this document currently approximates a project-level Trace;
- the product north star and domain language hold curated current context.

Once Stackdraft can represent this information itself, the temporary tracking
workflow should move into Stackdraft. Durable architectural and product
documents may remain in the repository where proximity to the code is useful.

## How to maintain this record

Add an entry when work produces a meaningful product or process insight. Do not
add an entry merely because a PR merged.

Each entry should capture:

1. **Context** — what prompted the observation.
2. **Observation** — what actually happened.
3. **Lesson** — what we now understand.
4. **Product implication** — how it may influence Stackdraft.
5. **Open question** — what remains uncertain, when applicable.

Prefer refining an existing entry when our understanding improves. Add a new
dated entry when the change itself is useful history.

## Current working model

```text
Stack: Stackdraft
├── Curated context: north star, domain language, and v0.1 specification
├── Planned Drafts: one file per remaining PR
├── Delivery: commits and GitHub pull requests
└── Trace precursor: this evolution record
```

The gap between this manual workflow and the desired experience is product
research, not incidental paperwork.

## Evolution record

### 2026-07-06 — Start with a tool worth using

**Context:** The immediate need was a lightweight place to track personal
engineering work during a month focused on personal projects.

**Observation:** Existing trackers could satisfy parts of the need, but using
one would not provide the ownership, learning, or exact workflow fit that makes
this project valuable.

**Lesson:** v0.1 should prove daily usefulness quickly. Product ambition is
welcome, but it must not delay the smallest tool that can replace temporary
notes.

**Product implication:** Stackdraft begins as a personal, self-hosted tracker.
Every early feature must help capture or understand active engineering work.

### 2026-07-06 — Build a portable vertical skeleton first

**Context:** The chosen stack combined familiar backend tools with an unfamiliar
frontend: Deno, Effect, Oak, SQLite, React, Vite, and Docker.

**Observation:** A small health slice exposed integration and editor problems
before domain behavior existed, including a Vite/Deno loader incompatibility.

**Lesson:** A narrow end-to-end slice isolates infrastructure uncertainty better
than beginning with the complete data model.

**Product implication:** Stackdraft development should continue in small,
independently testable slices. The architecture must keep domain behavior
separate from HTTP, UI, persistence, and external providers.

### 2026-07-06 — Establish engineering-native language

**Context:** Generic tracker vocabulary made Stackdraft sound like a smaller
Linear or Jira.

**Observation:** Naming the model Stack, Draft, State, Pipeline, Stage,
Delivery, and Trace made the product's intended behavior substantially clearer.

**Lesson:** Vocabulary shapes architecture. A Draft is not merely a renamed
ticket; it is a living unit of engineering intent that becomes clearer over
time.

**Product implication:** Product copy, domain code, APIs, and database naming
must use the canonical language consistently while preserving native terms for
external systems such as GitHub.

### 2026-07-06 — Separate current truth from history

**Context:** Traditional issue trackers accumulate specifications, decisions,
implementation notes, and review feedback chronologically.

**Observation:** More recorded activity often makes the current answer harder to
find.

**Lesson:** Maintained current context and historical provenance serve different
reading needs. They should be connected without being presented as the same
thing.

**Product implication:** Pipeline Stages will hold curated current
understanding. Trace will preserve how it changed. Humans and coding agents
should consume the same structured current context.

### 2026-07-06 — Use the repository as a temporary Stackdraft

**Context:** Stackdraft is not yet capable of tracking its own development.

**Observation:** Specifications, planning files, chat, and Git history are
already becoming a fragmented manual substitute for the intended product.

**Lesson:** The temporary workflow should model the desired product closely
enough to reveal which information belongs where and what becomes tedious.

**Product implication:** Each remaining PR is represented by one disposable
planning file. The implementing PR deletes that file, leaving only future work
on `main`. This evolution record captures durable learning until Stackdraft can
provide an accessible Stack-level Trace.

**Open question:** Which repository documents should remain durable beside the
code, and which should disappear after their structured content has migrated
into Stackdraft?

### 2026-07-06 — Separate architecture from code generation

**Context:** Codex is being used for architecture and specification while Cursor
Composer implements the bounded code changes.

**Observation:** Outcome-oriented PR plans still leave enough low-level choices
for separate coding sessions to invent incompatible API shapes, validation,
layering, and tests.

**Lesson:** An agent handoff needs both local intent and shared implementation
contracts. Acceptance criteria explain when the work is done; stable conventions
prevent each Draft from rediscovering how the system works.

**Product implication:** A future Draft should expose its scoped specification,
relevant Stack conventions, dependencies, acceptance criteria, and current
Delivery context as one agent-readable package. Moving between agents or coding
sessions should not require reconstructing architecture from chat.

### 2026-07-06 — Let conventions evolve when tools push back

**Context:** Repository-owned files adopted lowercase kebab-case for clarity and
cross-system portability.

**Observation:** Renaming Deno tests from `*_test.ts` to `*-test.ts` disabled
native test discovery. Preserving pure kebab-case would require custom globbing
in every test command.

**Lesson:** A convention is valuable while it removes ambiguity and friction.
Adding machinery solely to preserve it is counterproductive; a narrow,
documented ecosystem exception is clearer.

**Product implication:** Stackdraft should make conventions visible and
maintained, but not present them as immutable law. Exceptions and changes should
retain their rationale so humans and agents apply the current rule rather than
repeating old workarounds.

### 2026-07-11 — Let Drafts stand alone

**Context:** The initial v0.1 plan required creating a Stack before a Draft
could be captured.

**Observation:** Small features, bugs, investigations, and passing engineering
intent often need only one Draft. Requiring a Stack for that work adds ceremony
that is less convenient than a notepad. In comparable trackers, many developers
use individual work records without creating higher-level projects.

**Lesson:** Organization should emerge when it helps; it must not be an entry
fee for capture. Stackdraft needs to adapt to a developer's workflow rather than
require the developer to model work in advance.

**Product implication:** A Draft is first-class and may exist without a Stack.
Its optional Stack association can be assigned, changed, or removed later. Draft
capture and the primary Draft view must work when no Stacks exist, while Stacks
remain available for related work that benefits from shared context.
