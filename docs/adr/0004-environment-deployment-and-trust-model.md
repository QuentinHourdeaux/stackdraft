# ADR 0004: Separate development, staging, and production behind a private trust boundary

Status: Accepted

Related Stackdraft Draft: 9f6884c8-ca7b-4e93-aa90-062f34de334d

## Context

Stackdraft v0.1 has two useful execution modes, but it does not yet have three
operationally distinct environments:

- local development runs from the working tree and uses data/dev;
- Docker Compose builds the current checkout and uses data/prod.

That is sufficient while one developer runs everything on one trusted machine.
It becomes unsafe once Stackdraft is expected to remain available remotely while
development continues. Building or starting from the current checkout can change
the application and migrate its SQLite database immediately. A development
mistake, incomplete migration, or ambiguous command can therefore affect the
only durable instance.

The v0.2 goal is remote access to a stable personal tracker without turning
Stackdraft into a public software-as-a-service product. The project also needs a
place to test the exact artifact that may later run in production, a deliberate
production release boundary, and a recovery path for migration-bearing releases.

This decision extends, rather than replaces, the earlier architecture:

- ADR 0001 still applies independently to each deployed environment: one
  Stackdraft container serves the API and compiled frontend.
- ADR 0002 still applies independently to each environment: one application
  process owns one SQLite database.
- Development continues to optimize for a fast learning loop rather than for
  resemblance to a production server.

## Definitions

These terms describe different controls and must not be used interchangeably.

**Environment** is one independently operated instance of the application and
its data. Development, staging, and production are environments.

**Authentication** proves an identity. In v0.2, Tailscale authenticates devices
and automation identities before they can join the private network. Stackdraft
itself does not authenticate application users.

**Authorization** decides what an authenticated identity may do. Tailscale
grants and narrowly scoped deployment commands restrict which identities may
reach or operate each environment. Stackdraft itself has no user roles or
per-Draft permissions in v0.2.

**Encryption** protects traffic or stored data from being read by an unintended
party. Tailscale encrypts traffic between tailnet devices. Encryption does not
by itself decide who should have access.

**Environment isolation** prevents ordinary application and deployment actions
in one environment from using another environment's container, configuration,
port, or data directory.

**Host isolation** prevents a failure or compromise of one machine from
affecting another. Staging and production do not have host isolation in v0.2
because they share one VPS.

**Artifact** means the built container image. An image digest is its immutable
content identity. A tag is a human-friendly name that may be movable or
immutable depending on how it is used.

## Decision drivers

The design prioritizes:

1. protecting production data from routine development and staging work;
2. keeping Stackdraft reachable from approved devices without public exposure;
3. deploying the same tested artifact rather than rebuilding for production;
4. making every production change explicit and recoverable;
5. keeping the system small enough for one person to understand and operate;
6. learning transferable infrastructure concepts without creating a platform
   that Stackdraft does not yet need.

High availability, zero-downtime releases, public access, and unattended
production operation are not v0.2 drivers.

## Decision

Stackdraft will have three explicit environments:

| Environment | Location               | Source of code                       | Data                              | Update policy                                              |
| ----------- | ---------------------- | ------------------------------------ | --------------------------------- | ---------------------------------------------------------- |
| Development | Developer workstation  | Current working tree                 | Local development SQLite database | Changes as the developer edits code                        |
| Staging     | Private VPS deployment | Immutable GHCR image digest          | Staging-only SQLite database      | Automatically follows successful main builds               |
| Production  | Same private VPS       | Immutable released GHCR image digest | Production-only SQLite database   | Changes only after explicit promotion and local deployment |

The resulting topology is:

```text
Developer workstation
├── working tree
├── development processes
└── development SQLite data

GitHub
├── pull-request verification
├── protected main branch
└── public GHCR package
    └── immutable image digests

Private tailnet
├── approved operator devices and their agents
├── staging deployment automation
└── one VPS
    ├── private staging endpoint
    │   ├── Stackdraft container
    │   └── staging SQLite data
    └── private production endpoint
        ├── Stackdraft container
        └── production SQLite data
```

Staging and production share the VPS to limit cost and operational scope, but
they are separate Compose projects with separate networks, loopback-bound host
ports, configuration, filesystem ownership, and SQLite directories.

No command may infer its target from an ambiguous default. Operational commands
must name development, staging, or production explicitly. Production must also
name an immutable release identity; it must not default to the working tree,
latest, or the movable staging tag.

## Network and access boundary

The VPS has a public network interface because that is how an internet-hosted
server works. Stackdraft does not listen on that public interface.

Container ports bind to VPS loopback. Private HTTPS endpoints are made available
inside the tailnet through Tailscale Serve or an equivalently private Tailscale
mechanism. Tailscale Funnel, public reverse-proxy routes, and public Stackdraft
ports are prohibited.

This produces the following authority model:

| Actor                               | Development                                              | Staging                                                           | Production                                                                                                  |
| ----------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Developer on the workstation        | Full local control                                       | May view and operate when authorized                              | May view and run explicit production operations when authorized                                             |
| Agent running on an approved device | Reachable subject to the agent's local sandbox and tools | Reachable when both tailnet policy and agent permissions allow it | Reachable only when explicitly allowed; network membership alone is not sufficient authority for deployment |
| Pull-request workflow               | Verification only                                        | No access                                                         | No access                                                                                                   |
| Main deployment workflow            | No access                                                | May deploy the selected digest and check health                   | No access                                                                                                   |
| Unapproved internet client          | No access                                                | No access                                                         | No access                                                                                                   |

Tailscale is the v0.2 application-access boundary. This is appropriate for a
personal, private deployment, but it is not equivalent to native Stackdraft
authentication. Anyone allowed to reach an instance can exercise whatever the
Stackdraft API permits. Native users, sessions, roles, and API tokens remain
future product work.

Agents do not receive special network powers. An agent running on an approved
tailnet device can reach the same private endpoints only if its own sandbox and
tool permissions allow network access. A cloud agent outside the tailnet cannot
reach them.

## Artifact and deployment flow

Pull requests run verification without package-write, tailnet, deployment, or
production credentials. Untrusted pull-request code must never execute in a job
that holds deployment authority.

After a protected main commit passes verification, CI builds Stackdraft once and
publishes the image to public GHCR. The image receives an immutable commit
identity and its digest is recorded. A movable staging tag may point to the same
digest for discovery, but deployment resolves and pins the digest.

The image is public because the repository and the software inside the image are
public. No runtime secret may be embedded in the image or passed into its build.
The VPS therefore does not need a long-lived GHCR pull secret while that package
remains public.

Staging is an environment, not a Git branch. It continuously receives the image
produced by a successful main commit. Its deployment automation can operate only
the staging project and staging health endpoint. A failed staging deployment
cannot change the production container or production data.

Production promotion begins only after a specific main commit has run
successfully in staging and has been deliberately accepted for release. The
release process assigns an immutable semantic version to the already-built
digest. It does not rebuild the application. This preserves the claim that
production runs the artifact that was tested in staging.

The GitHub release workflow may verify and publish release metadata, but it does
not connect to production or receive production database authority. An
authorized, tailnet-connected operator laptop starts the production deployment
and supplies the exact release version.

The high-level flow is:

```text
Pull request
    │
    └── verify only

Protected main commit
    │
    ├── build once
    ├── publish immutable digest to GHCR
    └── deploy that digest to staging
             │
             └── test and accept
                      │
                      ├── assign immutable release version
                      └── operator deploys same digest to production
```

## Data ownership

Each environment owns exactly one SQLite database:

- development data belongs to the local development workflow;
- staging data belongs to staging and may be reset or replaced deliberately;
- production data is authoritative and may not be used as a convenient staging
  fixture or mounted into another environment.

Environment separation must make an accidental cross-mount or shared path fail
before a container starts. Development reset and migration commands must be
incapable of selecting staging or production through a default or loosely
validated path.

Production migrations run only as part of the explicit production deployment
contract. Before touching the live database, the target image's migrations are
tested against a disposable copy of the pre-deployment backup. This does not
prove that every application behavior will succeed, but it catches migration
failures before they alter the authoritative database.

## Backup, rollback, and emergency recovery

The durable v0.2 backup destination is an authorized operator laptop. Cloud
object storage and unattended scheduled backups are deferred.

Before a production deployment mutates the live database, it must:

1. create a consistent pre-deployment SQLite snapshot;
2. calculate and record its checksum and deployment metadata;
3. verify SQLite integrity;
4. transfer an off-host copy to the operator laptop;
5. verify that the laptop received an identical usable copy; and
6. retain a temporary verified rollback copy on the VPS until the new release
   passes its health checks.

If any prerequisite fails, the forward deployment stops before mutating
production. The unchanged production version is restarted if it was stopped to
obtain the snapshot.

A failed deployment does not attempt to back up the newly broken database before
rolling back. It restores the already-created pre-deployment snapshot and
restarts the previous image digest. Preserving the failed database for diagnosis
is best-effort and must never block recovery.

If production is already unhealthy before a deployment begins, a normal
deployment is not treated as a repair mechanism. An explicit emergency-recovery
operation may restore an earlier known-good laptop backup without first
successfully backing up the unreadable or corrupt current database. Capturing
the current files for forensic analysis is again best-effort.

The two backup copies address different failures:

- the temporary VPS copy enables immediate rollback if the laptop disconnects
  during deployment;
- the laptop copy survives loss of the VPS or its disk.

After a successful production health check, the temporary VPS copy may be
removed. Laptop backups remain until the operator deliberately prunes them.
Automatic retention is deferred so an early automation bug cannot delete the
only recovery copy.

This is not a complete off-site backup system. Recovery depends on the operator
laptop and its storage remaining available. A VPS loss requires provisioning a
replacement host and restoring from the laptop, and changes since the most
recent backup may be lost. Those limitations are accepted for v0.2 and must be
documented honestly.

## Secrets

Doppler will be introduced as the source of real deployment and backup secrets,
with separate development, staging, production, and CI access boundaries.

Only confidential values belong in Doppler. Environment names, ports, image
names, and private-but-non-secret configuration remain in version-controlled
configuration. Local development must continue to work without Doppler while it
has no secrets to consume.

Where supported, short-lived workload identity is preferred over stored CI
tokens. Any unavoidable bootstrap credential must be narrow, revocable, and
scoped to one consumer and environment. Secrets are injected at runtime and
never copied into Git, Docker build context, image layers, workflow artifacts,
or logs.

Doppler does not solve network authorization, container isolation, or backup
correctness. It limits where secret values are stored and who can retrieve them.

## Failure boundaries and accepted risk

Separate Compose projects prevent ordinary commands from confusing staging and
production, but the shared VPS remains one failure domain.

The following events may affect both deployed environments:

- VPS or disk failure;
- host reboot or Docker daemon failure;
- disk, memory, CPU, or inode exhaustion;
- root compromise or unrestricted Docker-socket access;
- incorrect host firewall or Tailscale configuration; and
- destructive operator commands executed with host-wide privileges.

Calling staging and production isolated must therefore mean environment
isolation, not host isolation or security isolation against a hostile root user.
Resource limits, narrow deployment commands, monitoring, and documented host
recovery reduce this risk but do not remove the shared failure domain.

One VPS is accepted for v0.2 because Stackdraft is a personal project, brief
downtime is tolerable, and operating two servers would add cost and learning
surface before evidence shows that stronger isolation is needed.

## Alternatives considered

### Continue running production from the local checkout

Rejected because remote availability would depend on the development machine,
and building, migrating, or experimenting locally would remain coupled to the
durable instance.

### Expose Stackdraft publicly and add application authentication now

Rejected for v0.2 because safe public authentication introduces account
recovery, session security, authorization policy, rate limiting, and continuous
internet-facing maintenance. Private Tailscale access meets the current need
with a smaller and more understandable boundary.

### Use one deployed instance as both staging and production

Rejected because testing a candidate would necessarily modify the same
application process and database used for durable work.

### Use separate VPSs for staging and production

Deferred. It would provide real host isolation, but doubles host provisioning,
patching, monitoring, and cost. The shared-host limitation is acceptable while
the project has one user and can tolerate downtime.

### Rebuild the image when releasing production

Rejected because a second build can differ through dependencies, build tools, or
inputs. Promoting the staging-tested digest provides a stronger and simpler
chain of evidence.

### Let GitHub Actions deploy production directly

Rejected because v0.2 deliberately requires an off-host backup on the operator
laptop before mutation. Keeping production deployment local also avoids giving
an unattended hosted runner broad production and database authority.

### Store backups immediately in a cloud object store

Deferred. Object storage would improve unattended and geographically separate
retention, but it adds provider credentials, lifecycle policy, encryption, cost,
and restore testing. Local off-host backups are the deliberate first recovery
step, not a claim that cloud backups are unnecessary forever.

## Consequences

Positive consequences:

- development can change freely without targeting production;
- every accepted main build is exercised in a persistent staging environment;
- production runs an immutable artifact already tested in staging;
- public internet clients cannot reach Stackdraft;
- CI authority is separated from production database authority;
- each production deployment begins with a verified recovery point; and
- the system remains small enough to operate and learn as one coherent setup.

Costs and limitations:

- the VPS, tailnet policy, image registry, Doppler configuration, deployment
  scripts, and backup directory all require maintenance;
- staging and production can still fail together because they share one host;
- production deployment requires the authorized laptop to be online;
- local-only durable backups are not continuous, automatic, or geographically
  redundant;
- private-network access does not provide per-user application authorization;
  and
- production deployments may include downtime while SQLite is snapshotted,
  migrated, and verified.

These costs are accepted for v0.2. Evidence from operating this design will
determine whether later work should add native authentication, object storage,
scheduled backups, separate hosts, or higher-availability deployment.

## Implementation boundaries

This ADR records the topology, authority boundaries, artifact flow, data
ownership, and recovery contract. It does not prescribe every command or file.
The dependent Stackdraft Drafts own implementation and verification for:

- isolated Compose projects;
- GHCR build and publication;
- VPS selection and provisioning;
- Tailscale policy and private endpoints;
- Doppler configuration;
- automatic staging deployment;
- local backup and restore commands; and
- immutable production promotion and rollback.

Those implementations may refine mechanics without weakening this decision. A
change that exposes Stackdraft publicly, gives staging authority over
production, rebuilds during promotion, shares environment data, or permits
production mutation without a verified recovery point requires revisiting this
ADR.

## Acceptance of this decision

Before changing the status from Proposed to Accepted, confirm that:

- the topology and every actor's authority are understandable without relying on
  undocumented assumptions;
- authentication, authorization, encryption, environment isolation, and host
  isolation are clearly distinguished;
- the staging and production artifact flow uses one immutable image digest;
- normal rollback and emergency recovery remain possible when the current
  database is unhealthy;
- the shared-VPS and local-backup limitations are acceptable; and
- each deferred implementation Draft can proceed without redesigning the trust
  model.
