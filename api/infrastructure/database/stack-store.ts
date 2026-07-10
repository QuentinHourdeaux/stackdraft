import type { DatabaseSync } from "node:sqlite";
import { DateTime, Effect, Layer } from "effect";
import type { StateScope } from "../../defs/state/state.ts";
import type { Stack } from "../../defs/stack/stack.ts";
import {
  InvalidStateScopeError,
  StateNotFoundError,
  UnknownStackStoreError,
} from "../../core/errors.ts";
import { isStateScope } from "../../core/state/validation.ts";
import type { CreateStackRecord } from "../../core/stack/input.ts";
import { StackStore, type StackStoreApi } from "../../core/stack/store.ts";
import { readSqlString, type SqlRow } from "../../lib/sqlite/rows.ts";
import { runInImmediateTransaction } from "../../lib/sqlite/transaction.ts";
import {
  utcDateTimeFromIsoString,
  utcDateTimeToIsoString,
} from "../../lib/time/utc.ts";

interface StackRow {
  readonly id: string;
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

const writeSqlDateTimeUtc = (value: DateTime.Utc): string =>
  utcDateTimeToIsoString(value);

const readStackRow = (row: SqlRow): StackRow => ({
  id: readSqlString(row, "id"),
  title: readSqlString(row, "title"),
  description: readSqlString(row, "description"),
  state_id: readSqlString(row, "state_id"),
  created_at: readSqlDateTimeUtc(row, "created_at"),
  updated_at: readSqlDateTimeUtc(row, "updated_at"),
});

const mapRow = (row: StackRow): Stack => ({
  id: row.id,
  title: row.title,
  description: row.description,
  stateId: row.state_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const stackSelectColumns = `
  id,
  title,
  description,
  state_id,
  created_at,
  updated_at
`;

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

const readDefaultStackStateRow = (
  database: Pick<DatabaseSync, "prepare">,
): StateAssignmentRow | null => {
  const row = database
    .prepare(
      `
        SELECT id, scope
        FROM states
        WHERE scope = 'stack' AND is_default = 1
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

const resolveStackStateId = (
  database: Pick<DatabaseSync, "prepare">,
  explicitStateId: string | undefined,
): string => {
  if (explicitStateId !== undefined) {
    const state = readStateAssignmentRow(database, explicitStateId);

    if (state === null) {
      throw new StateNotFoundError({ stateId: explicitStateId });
    }

    if (state.scope !== "stack") {
      throw new InvalidStateScopeError({ stateId: explicitStateId });
    }

    return state.id;
  }

  const defaultState = readDefaultStackStateRow(database);

  if (defaultState === null) {
    throw new UnknownStackStoreError({
      cause: new Error("No default stack State found."),
    });
  }

  return defaultState.id;
};

const readStackById = (
  database: Pick<DatabaseSync, "prepare">,
  stackId: string,
): Stack | null => {
  const row = database
    .prepare(
      `
        SELECT ${stackSelectColumns}
        FROM stacks
        WHERE id = ?
      `,
    )
    .get(stackId);

  if (row === undefined) {
    return null;
  }

  return mapRow(readStackRow(row as SqlRow));
};

const readAllStacks = (
  database: Pick<DatabaseSync, "prepare">,
): readonly Stack[] => {
  const rows = database
    .prepare(
      `
        SELECT ${stackSelectColumns}
        FROM stacks
        ORDER BY created_at DESC, id ASC
      `,
    )
    .all()
    .map(readStackRow);

  return rows.map(mapRow);
};

const insertStack = (
  database: Pick<DatabaseSync, "prepare">,
  stack: CreateStackRecord,
  stateId: string,
): void => {
  database
    .prepare(
      `
        INSERT INTO stacks (
          id,
          title,
          description,
          state_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      stack.id,
      stack.title,
      stack.description,
      stateId,
      writeSqlDateTimeUtc(stack.createdAt),
      writeSqlDateTimeUtc(stack.updatedAt),
    );
};

export const makeStackStore = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): StackStoreApi => ({
  list: () =>
    Effect.try({
      try: () => readAllStacks(database),
      catch: (cause) => new UnknownStackStoreError({ cause }),
    }),

  findById: (stackId) =>
    Effect.try({
      try: () => readStackById(database, stackId),
      catch: (cause) => new UnknownStackStoreError({ cause }),
    }),

  create: (stack) =>
    Effect.try({
      try: () => {
        insertStack(database, stack, stack.stateId);

        const created = readStackById(database, stack.id);

        if (created === null) {
          throw new Error("Created stack could not be read back.");
        }

        return created;
      },
      catch: (cause) => new UnknownStackStoreError({ cause }),
    }),

  createWithResolvedState: (stack) =>
    Effect.try({
      try: () => {
        let created: Stack | undefined;

        runInImmediateTransaction(database, () => {
          const stateId = resolveStackStateId(database, stack.stateId);
          insertStack(database, stack, stateId);

          const readCreated = readStackById(database, stack.id);

          if (readCreated === null) {
            throw new Error("Created stack could not be read back.");
          }

          created = readCreated;
        });

        if (created === undefined) {
          throw new Error("Stack creation did not produce a result.");
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

        if (cause instanceof UnknownStackStoreError) {
          return cause;
        }

        return new UnknownStackStoreError({ cause });
      },
    }),
});

export const StackStoreLive = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): Layer.Layer<StackStore> =>
  Layer.succeed(StackStore, makeStackStore(database));
