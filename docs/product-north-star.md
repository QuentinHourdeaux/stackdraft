# Stackdraft Product North Star

> Work should become clearer as it progresses, not noisier.

## Vision

Stackdraft is a lightweight, self-hosted engineering tracker designed to keep
software projects clear as they evolve.

Traditional issue trackers accumulate context chronologically. Requirements,
decisions, implementation notes, review feedback, test results, and release
details become scattered across descriptions, comments, pull requests, and
commit history. The record grows, but the current truth becomes harder to find.

Stackdraft takes the opposite approach. Each Draft is a living engineering
record whose content is continuously refined into an authoritative current
state. Historical changes may be retained for provenance, recovery, and audit,
but history is not the primary interface.

The product serves humans and coding agents from the same structured context:

- what is being built;
- why it is being built;
- how it is expected to work;
- what has been implemented;
- how it has been verified;
- what remains unresolved;
- and where execution currently stands.

## Core promise

Every meaningful interaction with a Draft should do at least one of these:

1. Make its current state easier to understand.
2. Turn unstructured information into maintained engineering context.
3. Connect Delivery to the decision or expectation it supports.
4. Help a human or agent take the next action with less reconstruction.

If a feature only adds more activity without improving current understanding, it
is probably outside Stackdraft's core.

## Conceptual model

```text
Stack
├── Current Stack context
├── State workflow
├── Repositories
└── Draft
    ├── Summary
    ├── State
    ├── Pipeline
    │   ├── Spec
    │   ├── Design
    │   ├── Build
    │   ├── Verify
    │   └── Ship
    ├── Delivery
    └── Trace
```

This is a conceptual destination, not the v0.1 database schema.

The canonical names and usage rules are defined in
[`domain-language.md`](domain-language.md).

### State and Pipeline are different

A State answers:

> Where is this work operationally?

Examples include Backlog, In Progress, Blocked, and Done.

A Pipeline Stage answers:

> What is currently understood about this aspect of the work?

Examples include Spec, Design, Build, Verify, and Ship.

These concepts must remain independent. A Draft can be Building while its Spec
and Design Stages are both being refined. Completing a Pull Request may
influence State, but it does not define the Draft's full current truth.

### Stages are maintained context, not a rigid state machine

The product may present Pipeline Stages in a familiar engineering order, but
they are not necessarily sequential gates. Verify can reveal a Spec gap; Build
can invalidate a Design assumption; Ship can expose missing operational
requirements.

Each Stage represents the latest curated understanding. Progress may update
several Stages at once.

### Current state is primary; history is secondary

Stackdraft should retain enough Trace data to support:

- attribution and provenance;
- review of proposed changes;
- recovery from incorrect edits;
- and understanding how a decision changed when that history matters.

It should not require users or agents to reconstruct the current state by
reading that history. The default view presents the maintained result.

## Human and AI contract

AI assistance is a first-class design constraint, not a requirement that every
feature contain AI.

Agents should be able to:

- read a compact, structured snapshot of relevant Stack and Draft context;
- distinguish decisions, requirements, assumptions, and unresolved questions;
- link their work to the Draft and Stage it affects;
- propose targeted updates instead of appending conversational noise;
- and report Delivery updates in a predictable form.

Humans should be able to:

- see exactly what an agent proposes to change;
- accept, edit, or reject those changes;
- identify their source;
- and retain authority over the curated current state.

Agent activity must not silently rewrite engineering intent. Proposed updates
should be explicit and reviewable.

## Source-control integration

Source-control systems provide Delivery data. They do not own Stackdraft's
engineering context.

The intended relationship is:

```text
Stack
├── zero or more linked repositories
└── Draft
    └── zero or more linked pull requests
```

Stackdraft remains authoritative for specifications, decisions, and curated
context. GitHub remains authoritative for pull-request state, reviews, checks,
commits, and merge events.

Integration principles:

- Pull-request state and Draft State remain separate concepts.
- Automatic State transitions are optional rules, not hardcoded behavior.
- A Draft may link to multiple pull requests.
- Repository and pull-request identities use stable external IDs rather than
  branch names or parsed URLs alone.
- Provider-specific code sits behind an integration boundary so the core model
  is not GitHub-shaped.
- Webhooks provide timely updates; reconciliation protects against missed
  events.
- Agent context should include the relevant PR summary and Delivery data, not an
  unbounded dump of every comment and diff.

Manual linking is a valid first iteration. Authentication, webhooks, discovery,
and automation can arrive after the relationship proves useful.

## Product principles

### 1. Progressive clarification

Drafts should become more precise as knowledge increases.

### 2. Structure over chronology

Organize information by what it means, not merely when it was written.

### 3. One visible current truth

Present the maintained state by default. Keep the Trace available without making
users read it to understand the work.

### 4. Workflow is user-owned

States and future Pipeline templates should be configurable rather than encoded
as product assumptions.

### 5. Integrations enrich; they do not define

GitHub and future providers contribute Delivery data while Stackdraft retains a
provider-neutral engineering model.

### 6. Humans and agents share context

Do not create a rich human interface and a separate, lossy AI representation.
Both should consume the same structured source.

### 7. Local ownership remains real

Self-hosting, understandable backups, and portable data are product properties,
not deployment afterthoughts.

### 8. Small before clever

Only add structure after the simpler form has demonstrated where it is needed.
The north star guides compatibility; it does not require building the final
system upfront.

## Near-term compatibility rules

The first iterations remain intentionally small:

- Stacks organize engineering efforts.
- Drafts represent engineering work within a Stack.
- States represent user-configurable workflow.
- Descriptions hold current context before structured sections exist.

To preserve the path forward:

- Treat a Draft's description as a simple precursor to its Pipeline, not a
  permanent universal text field.
- Keep State independent from Draft content.
- Use stable application-owned IDs.
- Keep domain behavior outside HTTP, UI, and SQL adapters.
- Avoid making comments or activity feeds foundational.
- Avoid single-provider columns such as `github_pr_url` on core entities.
- Model future repository and pull-request links as separate relationships.
- Preserve room for the Trace and proposed changes without exposing them as the
  primary reading experience.

## Explicit non-goals

Stackdraft is not intended to become:

- a team chat replacement;
- a source-control hosting platform;
- a generic company project-management suite;
- a chronological activity feed with a status field;
- a reporting system optimized for managerial surveillance;
- or an autonomous agent that can silently redefine project intent.

Collaboration and reporting features may exist later, but they must support the
curated engineering record rather than displace it.

## Decision filter

Before accepting a major feature, ask:

1. Does it improve the authoritative current understanding of the work?
2. Is the information structured according to meaning rather than chronology?
3. Can both a human and an agent consume it reliably?
4. Is provenance preserved without making history the main interface?
5. Does the core remain useful without a specific external provider?
6. Can the feature start small without forcing the final architecture today?

A feature that repeatedly fails these questions should be redesigned, deferred,
or rejected.

## Measure of success

Stackdraft succeeds when a person or coding agent can open a Stack or Draft and
understand what is being built, why, and what is currently true without
reconstructing the answer from comments, chat, pull requests, or commit history.
