# Stackdraft Domain Language

Status: Accepted for product and domain design

## Canonical vocabulary

> A Draft has a State, a maintained Pipeline of Stages, linked Delivery, and a
> Trace. It may optionally belong to a Stack.

| Stackdraft term | Meaning                                                           |
| --------------- | ----------------------------------------------------------------- |
| **Stack**       | Optional organization for a bounded engineering effort            |
| **Draft**       | A living unit of engineering intent and work                      |
| **State**       | The current operational workflow position of a Stack or Draft     |
| **Pipeline**    | The maintained engineering lifecycle of a Draft                   |
| **Stage**       | One current, curated area within a Pipeline                       |
| **Delivery**    | The source-control and deployment activity linked to a Draft      |
| **Trace**       | The secondary provenance stream showing how current truth changed |

These terms are part of the product model, not decorative replacements for
generic project-management nouns. They should be used consistently in product
copy, domain code, APIs, and database naming.

## Stack

A Stack is optional, long-lived organization for a software system or
engineering effort. It groups related Drafts when that shared context is useful
and may eventually connect to zero or more repositories. Creating a Stack is
never a prerequisite for capturing a Draft.

Examples:

- Stackdraft
- A reusable TypeScript library
- A self-hosted service
- An engineering experiment that produces multiple Drafts

Preferred language:

- Create a Stack
- Open a Stack
- Stack State
- Drafts in this Stack

Avoid using **project** as the product-facing or domain-model name.

## Draft

A Draft is a scoped unit of engineering intent. It may represent a feature, bug
fix, refactor, migration, investigation, or technical decision. A Draft may
stand alone or belong to one Stack, and that association may change as the work
becomes clearer.

A Draft is a living record, not a disposable task card. It becomes clearer as
its Pipeline is maintained and Delivery is linked.

Preferred language:

- Create a Draft
- Update this Draft
- Draft State
- Draft Pipeline
- Draft Delivery
- View Trace

Avoid **item**, **issue**, **ticket**, and **task** as generic names for this
entity. Those words may still appear when referring to an external provider's
native object.

## State

A State describes where a Stack or Draft currently stands operationally. States
are user-configurable and scoped to their entity type.

Examples might include:

- Queued
- Ready
- Building
- Blocked
- Verifying
- Shipped
- Dropped

The product must not infer engineering context from a State name. State is
independent from Pipeline content.

Avoid **status** as the product-facing or domain-model name. It may still be
used generically for HTTP responses, health reporting, or an external provider's
native field.

## Pipeline

A Pipeline is the maintained engineering lifecycle of a Draft. It organizes
current understanding by meaning rather than chronology.

The default conceptual Pipeline is:

```text
Spec → Design → Build → Verify → Ship
```

This ordering is familiar, but it is not a rigid one-way state machine. Later
work may update any earlier Stage.

Pipeline is distinct from State:

- **State** answers where the Draft stands operationally.
- **Pipeline** holds what is currently understood about the work.

Pipeline templates and configurability are future decisions. The vocabulary does
not require implementing Pipelines in v0.1.

## Stage

A Stage is one maintained context area inside a Pipeline.

Default conceptual Stages:

- **Spec** — requirements, constraints, and acceptance criteria
- **Design** — architecture and technical decisions
- **Build** — implementation plan and current implementation
- **Verify** — tests, validation, and unresolved failures
- **Ship** — rollout, migration, deployment, and release notes

Stage content represents the current curated truth. Historical edits belong in
the Trace.

Avoid **phase**, **facet**, **chapter**, and **section** as domain-model names.
They may still be used descriptively in prose where appropriate.

## Delivery

Delivery is the engineering activity connected to a Draft through source-control
and deployment providers.

Delivery may eventually include:

- Repositories
- Branches
- Pull requests
- Commits
- Checks
- Builds
- Deployments
- Releases

Stackdraft does not rename these provider-native objects. A pull request remains
a Pull Request; a deployment remains a Deployment.

Stackdraft owns the Draft's engineering intent and curated Pipeline. GitHub or
another provider owns the external Delivery state.

Avoid treating **evidence** or **artifact** as the product-facing umbrella for
Delivery. Those terms may still describe specific implementation concepts
internally.

## Trace

A Trace records how the maintained current state evolved without making that
history the primary reading experience.

A Trace may eventually include:

- State transitions
- Pipeline edits
- Human edits
- Agent proposals, approvals, and rejections
- Delivery links and merge events
- Restorable snapshots
- Attribution and provenance

The product surface is **Trace**, not Revision History. Individual internal
records may be called changes, events, or snapshots without becoming additional
branded product nouns.

## Naming rules

1. Use canonical terms in new domain types, service names, API routes, and
   database tables.
2. Do not expose generic aliases beside canonical terms in the UI.
3. Preserve provider-native terminology inside integrations.
4. Prefer plain verbs: create, update, move, link, verify, and ship.
5. Do not force Stackdraft terminology onto infrastructure concepts such as HTTP
   status, database transaction state, or GitHub pull-request status.
6. If a new concept cannot be explained naturally alongside the canonical
   sentence, its name or its place in the model needs more work.

## Reserved mappings

These mappings exist for migration and discussion only:

| Generic or legacy term                  | Stackdraft term |
| --------------------------------------- | --------------- |
| Project                                 | Stack           |
| Work item, item, issue, ticket, task    | Draft           |
| Workflow status                         | State           |
| Structured lifecycle                    | Pipeline        |
| Phase, facet, chapter                   | Stage           |
| Linked engineering activity or evidence | Delivery        |
| Revision history or activity history    | Trace           |
