import type { DatabaseSync } from "node:sqlite";
import { Effect, Layer } from "effect";
import type { State, StateScope } from "../../domain/state/state.ts";
import { isStateScope } from "../../domain/state/state.ts";
import {
  StateNameConflictError,
  StateNotFoundError,
  StateRepository,
  type StateRepositoryApi,
  UnknownStateRepositoryError,
} from "../../application/state-repository.ts";
import { readSqlInteger, readSqlString, type SqlRow } from "./sqlite-rows.ts";

interface StateRow {
  readonly id: string;
  readonly scope: StateScope;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly is_default: number;
  readonly created_at: string;
  readonly updated_at: string;
}

const SQLITE_UNIQUE_CONSTRAINT_ERRCODE = 2067;
const STATE_NAME_UNIQUE_CONSTRAINT_COLUMNS = "states.scope, states.name";

const sqliteErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "";

const isSqliteUniqueConstraintError = (cause: unknown): boolean => {
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  if (
    "errcode" in cause && cause.errcode === SQLITE_UNIQUE_CONSTRAINT_ERRCODE
  ) {
    return true;
  }

  return cause instanceof Error &&
    cause.message.includes("UNIQUE constraint failed");
};

const isStateNameUniqueConstraintError = (cause: unknown): boolean =>
  isSqliteUniqueConstraintError(cause) &&
  sqliteErrorMessage(cause).includes(STATE_NAME_UNIQUE_CONSTRAINT_COLUMNS);

const readStateRow = (row: SqlRow): StateRow => {
  const scope = readSqlString(row, "scope");

  if (!isStateScope(scope)) {
    throw new TypeError('Expected state scope column "scope".');
  }

  return {
    id: readSqlString(row, "id"),
    scope,
    name: readSqlString(row, "name"),
    color: readSqlString(row, "color"),
    position: readSqlInteger(row, "position"),
    is_default: readSqlInteger(row, "is_default"),
    created_at: readSqlString(row, "created_at"),
    updated_at: readSqlString(row, "updated_at"),
  };
};

const mapRow = (row: StateRow): State => ({
  id: row.id,
  scope: row.scope,
  name: row.name,
  color: row.color,
  position: row.position,
  isDefault: row.is_default === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const stateSelectColumns = `
  id,
  scope,
  name,
  color,
  position,
  is_default,
  created_at,
  updated_at
`;

const readStateById = (
  database: Pick<DatabaseSync, "prepare">,
  stateId: string,
): State | null => {
  const row = database
    .prepare(
      `
        SELECT ${stateSelectColumns}
        FROM states
        WHERE id = ?
      `,
    )
    .get(stateId);

  if (row === undefined) {
    return null;
  }

  return mapRow(readStateRow(row as SqlRow));
};

const readStatesInScope = (
  database: Pick<DatabaseSync, "prepare">,
  scope: StateScope,
): readonly State[] => {
  const rows = database
    .prepare(
      `
        SELECT ${stateSelectColumns}
        FROM states
        WHERE scope = ?
        ORDER BY position ASC, id ASC
      `,
    )
    .all(scope)
    .map(readStateRow);

  return rows.map(mapRow);
};

const runInTransaction = (
  database: Pick<DatabaseSync, "exec">,
  operation: () => void,
): void => {
  database.exec("BEGIN IMMEDIATE");

  try {
    operation();
    database.exec("COMMIT");
  } catch (cause) {
    database.exec("ROLLBACK");
    throw cause;
  }
};

export const makeStateRepository = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): StateRepositoryApi => ({
  listByScope: (scope) =>
    Effect.try({
      try: () => readStatesInScope(database, scope),
      catch: (cause) => new UnknownStateRepositoryError({ cause }),
    }),

  findById: (stateId) =>
    Effect.try({
      try: () => readStateById(database, stateId),
      catch: (cause) => new UnknownStateRepositoryError({ cause }),
    }),

  maxPositionInScope: (scope) =>
    Effect.try({
      try: () => {
        const row = database
          .prepare(
            `
              SELECT COALESCE(MAX(position), -1) AS max_position
              FROM states
              WHERE scope = ?
            `,
          )
          .get(scope) as SqlRow | undefined;

        return readSqlInteger(row ?? {}, "max_position");
      },
      catch: (cause) => new UnknownStateRepositoryError({ cause }),
    }),

  create: (state) =>
    Effect.try({
      try: () => {
        database
          .prepare(
            `
              INSERT INTO states (
                id,
                scope,
                name,
                color,
                position,
                is_default,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            state.id,
            state.scope,
            state.name,
            state.color,
            state.position,
            state.isDefault ? 1 : 0,
            state.createdAt,
            state.updatedAt,
          );

        const created = readStateById(database, state.id);

        if (created === null) {
          throw new Error("Created state could not be read back.");
        }

        return created;
      },
      catch: (cause) => {
        if (isStateNameUniqueConstraintError(cause)) {
          return new StateNameConflictError({
            scope: state.scope,
            name: state.name,
          });
        }

        return new UnknownStateRepositoryError({ cause });
      },
    }),

  update: (state) =>
    Effect.try({
      try: () => {
        const result = database
          .prepare(
            `
              UPDATE states
              SET name = ?, color = ?, updated_at = ?
              WHERE id = ?
            `,
          )
          .run(state.name, state.color, state.updatedAt, state.id);

        if (result.changes === 0) {
          throw new StateNotFoundError({ stateId: state.id });
        }

        const updated = readStateById(database, state.id);

        if (updated === null) {
          throw new Error("Updated state could not be read back.");
        }

        return updated;
      },
      catch: (cause) => {
        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        if (isStateNameUniqueConstraintError(cause)) {
          return new StateNameConflictError({
            scope: state.scope,
            name: state.name,
          });
        }

        return new UnknownStateRepositoryError({ cause });
      },
    }),

  reorderState: (stateId, targetPosition, updatedAt) =>
    Effect.try({
      try: () => {
        const existing = readStateById(database, stateId);

        if (existing === null) {
          throw new StateNotFoundError({ stateId });
        }

        const states = [...readStatesInScope(database, existing.scope)];

        if (targetPosition === existing.position) {
          return states;
        }

        const reordered = [...states];
        const [moved] = reordered.splice(existing.position, 1);

        if (moved === undefined) {
          throw new Error("Moved state could not be removed from scope.");
        }

        reordered.splice(targetPosition, 0, moved);

        const tempOffset = states.length + 1000;
        const updatePosition = database.prepare(
          `
            UPDATE states
            SET position = ?, updated_at = ?
            WHERE id = ?
          `,
        );

        runInTransaction(database, () => {
          for (let index = 0; index < reordered.length; index += 1) {
            const state = reordered[index];

            if (state === undefined || state.position === index) {
              continue;
            }

            updatePosition.run(tempOffset + index, updatedAt, state.id);
          }

          for (let index = 0; index < reordered.length; index += 1) {
            const state = reordered[index];

            if (state === undefined || state.position === index) {
              continue;
            }

            updatePosition.run(index, updatedAt, state.id);
          }
        });

        return readStatesInScope(database, existing.scope);
      },
      catch: (cause) => {
        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        return new UnknownStateRepositoryError({ cause });
      },
    }),

  selectDefault: (stateId, updatedAt) =>
    Effect.try({
      try: () => {
        const existing = readStateById(database, stateId);

        if (existing === null) {
          throw new StateNotFoundError({ stateId });
        }

        if (existing.isDefault) {
          return existing;
        }

        const clearDefault = database.prepare(
          `
            UPDATE states
            SET is_default = 0, updated_at = ?
            WHERE scope = ? AND is_default = 1
          `,
        );
        const setDefault = database.prepare(
          `
            UPDATE states
            SET is_default = 1, updated_at = ?
            WHERE id = ?
          `,
        );

        runInTransaction(database, () => {
          clearDefault.run(updatedAt, existing.scope);
          setDefault.run(updatedAt, stateId);
        });

        const selected = readStateById(database, stateId);

        if (selected === null) {
          throw new Error("Default state could not be read back.");
        }

        return selected;
      },
      catch: (cause) => {
        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        return new UnknownStateRepositoryError({ cause });
      },
    }),
});

export const StateRepositoryLive = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): Layer.Layer<StateRepository> =>
  Layer.succeed(StateRepository, makeStateRepository(database));
