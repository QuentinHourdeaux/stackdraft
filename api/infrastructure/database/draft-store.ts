import type { DatabaseSync } from "node:sqlite";
import { DateTime, Effect, Layer } from "effect";
import type { Draft } from "../../defs/draft/draft.ts";
import type { StateScope } from "../../defs/state/state.ts";
import {
  DraftNotFoundError,
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownDraftStoreError,
} from "../../core/errors.ts";
import { isStateScope } from "../../core/state/validation.ts";
import type {
  CreateDraftRecord,
  ListDraftsFilter,
  UpdateDraftRecord,
} from "../../core/draft/input.ts";
import { DraftStore, type DraftStoreApi } from "../../core/draft/store.ts";
import { readSqlString, type SqlRow } from "../../lib/sqlite/rows.ts";
import { runInImmediateTransaction } from "../../lib/sqlite/transaction.ts";
import {
  utcDateTimeFromIsoString,
  utcDateTimeToIsoString,
} from "../../lib/time/utc.ts";

interface DraftRow {
  readonly id: string;
  readonly stack_id: string | null;
  readonly title: string;
  readonly description: string;
  readonly state_id: string;
  readonly created_at: DateTime.Utc;
  readonly updated_at: DateTime.Utc;
}

interface StateAssignmentRow {
  readonly id: string;
  readonly scope: StateScope;
}

const readSqlDateTimeUtc = (row: SqlRow, column: string): DateTime.Utc =>
  utcDateTimeFromIsoString(readSqlString(row, column));

const readSqlNullableString = (row: SqlRow, column: string): string | null => {
  const value = row[column];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new TypeError(`Expected nullable string column "${column}".`);
  }

  return value;
};

const readDraftRow = (row: SqlRow): DraftRow => ({
  id: readSqlString(row, "id"),
  stack_id: readSqlNullableString(row, "stack_id"),
  title: readSqlString(row, "title"),
  description: readSqlString(row, "description"),
  state_id: readSqlString(row, "state_id"),
  created_at: readSqlDateTimeUtc(row, "created_at"),
  updated_at: readSqlDateTimeUtc(row, "updated_at"),
});

const mapRow = (row: DraftRow): Draft => ({
  id: row.id,
  stackId: row.stack_id,
  title: row.title,
  description: row.description,
  stateId: row.state_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const draftSelectColumns = `
  id,
  stack_id,
  title,
  description,
  state_id,
  created_at,
  updated_at
`;

const writeSqlDateTimeUtc = (value: DateTime.Utc): string =>
  utcDateTimeToIsoString(value);

const readStateAssignmentRow = (
  database: Pick<DatabaseSync, "prepare">,
  stateId: string,
): StateAssignmentRow | null => {
  const row = database
    .prepare(
      `
        SELECT id, scope
        FROM states
        WHERE id = ?
      `,
    )
    .get(stateId);

  if (row === undefined) {
    return null;
  }

  const scope = readSqlString(row as SqlRow, "scope");

  if (!isStateScope(scope)) {
    throw new TypeError('Expected state scope column "scope".');
  }

  return {
    id: readSqlString(row as SqlRow, "id"),
    scope,
  };
};

const readDefaultDraftStateRow = (
  database: Pick<DatabaseSync, "prepare">,
): StateAssignmentRow | null => {
  const row = database
    .prepare(
      `
        SELECT id, scope
        FROM states
        WHERE scope = 'draft' AND is_default = 1
        LIMIT 1
      `,
    )
    .get();

  if (row === undefined) {
    return null;
  }

  const scope = readSqlString(row as SqlRow, "scope");

  if (!isStateScope(scope)) {
    throw new TypeError('Expected state scope column "scope".');
  }

  return {
    id: readSqlString(row as SqlRow, "id"),
    scope,
  };
};

const readStackExists = (
  database: Pick<DatabaseSync, "prepare">,
  stackId: string,
): boolean => {
  const row = database
    .prepare(
      `
        SELECT id
        FROM stacks
        WHERE id = ?
      `,
    )
    .get(stackId);

  return row !== undefined;
};

const resolveDraftStateId = (
  database: Pick<DatabaseSync, "prepare">,
  explicitStateId: string | undefined,
): string => {
  if (explicitStateId !== undefined) {
    const state = readStateAssignmentRow(database, explicitStateId);

    if (state === null) {
      throw new StateNotFoundError({ stateId: explicitStateId });
    }

    if (state.scope !== "draft") {
      throw new InvalidStateScopeError({ stateId: explicitStateId });
    }

    return state.id;
  }

  const defaultState = readDefaultDraftStateRow(database);

  if (defaultState === null) {
    throw new UnknownDraftStoreError({
      cause: new Error("No default draft State found."),
    });
  }

  return defaultState.id;
};

const resolveStackId = (
  database: Pick<DatabaseSync, "prepare">,
  explicitStackId: string | null | undefined,
): string | null => {
  if (explicitStackId === undefined || explicitStackId === null) {
    return null;
  }

  if (!readStackExists(database, explicitStackId)) {
    throw new StackNotFoundError({ stackId: explicitStackId });
  }

  return explicitStackId;
};

const readDraftById = (
  database: Pick<DatabaseSync, "prepare">,
  draftId: string,
): Draft | null => {
  const row = database
    .prepare(
      `
        SELECT ${draftSelectColumns}
        FROM drafts
        WHERE id = ?
      `,
    )
    .get(draftId);

  if (row === undefined) {
    return null;
  }

  return mapRow(readDraftRow(row as SqlRow));
};

const readAllDrafts = (
  database: Pick<DatabaseSync, "prepare">,
): readonly Draft[] => {
  const rows = database
    .prepare(
      `
        SELECT ${draftSelectColumns}
        FROM drafts
        ORDER BY created_at DESC, id ASC
      `,
    )
    .all()
    .map(readDraftRow);

  return rows.map(mapRow);
};

const readDraftsByStateId = (
  database: Pick<DatabaseSync, "prepare">,
  stateId: string,
): readonly Draft[] => {
  const rows = database
    .prepare(
      `
        SELECT ${draftSelectColumns}
        FROM drafts
        WHERE state_id = ?
        ORDER BY created_at DESC, id ASC
      `,
    )
    .all(stateId)
    .map(readDraftRow);

  return rows.map(mapRow);
};

const readDraftsByStackId = (
  database: Pick<DatabaseSync, "prepare">,
  stackId: string,
): readonly Draft[] => {
  const rows = database
    .prepare(
      `
        SELECT ${draftSelectColumns}
        FROM drafts
        WHERE stack_id = ?
        ORDER BY created_at DESC, id ASC
      `,
    )
    .all(stackId)
    .map(readDraftRow);

  return rows.map(mapRow);
};

const readDraftsByStateAndStackId = (
  database: Pick<DatabaseSync, "prepare">,
  stateId: string,
  stackId: string,
): readonly Draft[] => {
  const rows = database
    .prepare(
      `
        SELECT ${draftSelectColumns}
        FROM drafts
        WHERE state_id = ? AND stack_id = ?
        ORDER BY created_at DESC, id ASC
      `,
    )
    .all(stateId, stackId)
    .map(readDraftRow);

  return rows.map(mapRow);
};

const readFilteredDrafts = (
  database: Pick<DatabaseSync, "prepare">,
  filter: ListDraftsFilter,
): readonly Draft[] => {
  if (filter.stateId !== undefined) {
    const state = readStateAssignmentRow(database, filter.stateId);

    if (state === null) {
      return [];
    }

    if (state.scope !== "draft") {
      throw new InvalidStateScopeError({ stateId: filter.stateId });
    }
  }

  if (
    filter.stackId !== undefined && !readStackExists(database, filter.stackId)
  ) {
    return [];
  }

  if (filter.stateId !== undefined && filter.stackId !== undefined) {
    return readDraftsByStateAndStackId(
      database,
      filter.stateId,
      filter.stackId,
    );
  }

  if (filter.stateId !== undefined) {
    return readDraftsByStateId(database, filter.stateId);
  }

  if (filter.stackId !== undefined) {
    return readDraftsByStackId(database, filter.stackId);
  }

  return readAllDrafts(database);
};

const insertDraft = (
  database: Pick<DatabaseSync, "prepare">,
  draft: CreateDraftRecord,
  stateId: string,
  stackId: string | null,
): void => {
  database
    .prepare(
      `
        INSERT INTO drafts (
          id,
          stack_id,
          title,
          description,
          state_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      draft.id,
      stackId,
      draft.title,
      draft.description,
      stateId,
      writeSqlDateTimeUtc(draft.createdAt),
      writeSqlDateTimeUtc(draft.updatedAt),
    );
};

const updateDraft = (
  database: Pick<DatabaseSync, "prepare">,
  draft: Draft,
): void => {
  const result = database
    .prepare(
      `
        UPDATE drafts
        SET title = ?, description = ?, state_id = ?, stack_id = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(
      draft.title,
      draft.description,
      draft.stateId,
      draft.stackId,
      writeSqlDateTimeUtc(draft.updatedAt),
      draft.id,
    );

  if (result.changes === 0) {
    throw new DraftNotFoundError({ draftId: draft.id });
  }
};

export const makeDraftStore = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): DraftStoreApi => ({
  list: (filter) =>
    Effect.try({
      try: () =>
        filter === undefined
          ? readAllDrafts(database)
          : readFilteredDrafts(database, filter),
      catch: (cause) => {
        if (cause instanceof InvalidStateScopeError) {
          return cause;
        }

        return new UnknownDraftStoreError({ cause });
      },
    }),

  findById: (draftId) =>
    Effect.try({
      try: () => readDraftById(database, draftId),
      catch: (cause) => new UnknownDraftStoreError({ cause }),
    }),

  createWithResolvedStateAndStack: (draft) =>
    Effect.try({
      try: () => {
        let created: Draft | undefined;

        runInImmediateTransaction(database, () => {
          const stateId = resolveDraftStateId(database, draft.stateId);
          const stackId = resolveStackId(database, draft.stackId);
          insertDraft(database, draft, stateId, stackId);

          const readCreated = readDraftById(database, draft.id);

          if (readCreated === null) {
            throw new Error("Created draft could not be read back.");
          }

          created = readCreated;
        });

        if (created === undefined) {
          throw new Error("Draft creation did not produce a result.");
        }

        return created;
      },
      catch: (cause) => {
        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        if (cause instanceof InvalidStateScopeError) {
          return cause;
        }

        if (cause instanceof StackNotFoundError) {
          return cause;
        }

        if (cause instanceof UnknownDraftStoreError) {
          return cause;
        }

        return new UnknownDraftStoreError({ cause });
      },
    }),

  updateWithResolvedStateAndStack: (draft: UpdateDraftRecord) =>
    Effect.try({
      try: () => {
        let updated: Draft | undefined;

        runInImmediateTransaction(database, () => {
          const existing = readDraftById(database, draft.id);

          if (existing === null) {
            throw new DraftNotFoundError({ draftId: draft.id });
          }

          const stateId = draft.stateId === undefined
            ? existing.stateId
            : resolveDraftStateId(database, draft.stateId);

          let stackId: string | null;

          if (draft.stackId === undefined) {
            stackId = existing.stackId;
          } else if (draft.stackId === null) {
            stackId = null;
          } else {
            stackId = resolveStackId(database, draft.stackId);
          }

          const next: Draft = {
            id: draft.id,
            stackId,
            title: draft.title,
            description: draft.description,
            stateId,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
          };

          updateDraft(database, next);

          const readUpdated = readDraftById(database, draft.id);

          if (readUpdated === null) {
            throw new Error("Updated draft could not be read back.");
          }

          updated = readUpdated;
        });

        if (updated === undefined) {
          throw new Error("Draft update did not produce a result.");
        }

        return updated;
      },
      catch: (cause) => {
        if (cause instanceof DraftNotFoundError) {
          return cause;
        }

        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        if (cause instanceof InvalidStateScopeError) {
          return cause;
        }

        if (cause instanceof StackNotFoundError) {
          return cause;
        }

        if (cause instanceof UnknownDraftStoreError) {
          return cause;
        }

        return new UnknownDraftStoreError({ cause });
      },
    }),
});

export const DraftStoreLive = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): Layer.Layer<DraftStore> =>
  Layer.succeed(DraftStore, makeDraftStore(database));
