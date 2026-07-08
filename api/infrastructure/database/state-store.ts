import type { DatabaseSync } from "node:sqlite";
import { DateTime, Effect, Layer, Schema } from "effect";
import type { State, StateScope } from "../../defs/state/state.ts";
import {
  StateInUseError,
  StateNameConflictError,
  StateNotFoundError,
  UnknownStateStoreError,
  ValidationError,
} from "../../core/errors.ts";
import { StateStore, type StateStoreApi } from "../../core/state/store.ts";
import { isStateScope } from "../../core/state/validation.ts";
import {
  readSqlInteger,
  readSqlString,
  type SqlRow,
} from "../../lib/sqlite/rows.ts";
import {
  utcDateTimeFromIsoString,
  utcDateTimeToIsoString,
} from "../../lib/time/utc.ts";
import { runInImmediateTransaction } from "../../lib/sqlite/transaction.ts";
import {
  isSqliteForeignKeyError,
  isSqliteUniqueConstraintError,
  readSqliteErrorMessage,
} from "../../lib/sqlite/errors.ts";

interface StateRow {
  readonly id: string;
  readonly scope: StateScope;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly is_default: number;
  readonly created_at: DateTime.Utc;
  readonly updated_at: DateTime.Utc;
}

const STATE_NAME_UNIQUE_CONSTRAINT_COLUMNS = "states.scope, states.name";

const isStateNameUniqueConstraintError = (cause: unknown): boolean =>
  isSqliteUniqueConstraintError(cause) &&
  readSqliteErrorMessage(cause).includes(STATE_NAME_UNIQUE_CONSTRAINT_COLUMNS);

const readSqlDateTimeUtc = (row: SqlRow, column: string): DateTime.Utc =>
  utcDateTimeFromIsoString(readSqlString(row, column));

const writeSqlDateTimeUtc = (value: DateTime.Utc): string =>
  utcDateTimeToIsoString(value);

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
    created_at: readSqlDateTimeUtc(row, "created_at"),
    updated_at: readSqlDateTimeUtc(row, "updated_at"),
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

export const makeStateStore = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): StateStoreApi => ({
  listByScope: (scope) =>
    Effect.try({
      try: () => readStatesInScope(database, scope),
      catch: (cause) => new UnknownStateStoreError({ cause }),
    }),

  findById: (stateId) =>
    Effect.try({
      try: () => readStateById(database, stateId),
      catch: (cause) => new UnknownStateStoreError({ cause }),
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
      catch: (cause) => new UnknownStateStoreError({ cause }),
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
            writeSqlDateTimeUtc(state.createdAt),
            writeSqlDateTimeUtc(state.updatedAt),
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

        return new UnknownStateStoreError({ cause });
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
          .run(
            state.name,
            state.color,
            writeSqlDateTimeUtc(state.updatedAt),
            state.id,
          );

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

        return new UnknownStateStoreError({ cause });
      },
    }),

  reorderState: (stateId, targetPosition, updatedAt) =>
    Effect.try({
      try: () => {
        let result: readonly State[] = [];

        runInImmediateTransaction(database, () => {
          const existing = readStateById(database, stateId);

          if (existing === null) {
            throw new StateNotFoundError({ stateId });
          }

          const states = [...readStatesInScope(database, existing.scope)];
          const maxPosition = states.length - 1;

          if (!Schema.is(Schema.Int)(targetPosition)) {
            throw new ValidationError({
              fields: {
                position: "Position must be a whole number.",
              },
            });
          }

          if (targetPosition < 0 || targetPosition > maxPosition) {
            throw new ValidationError({
              fields: {
                position: `Position must be between 0 and ${maxPosition}.`,
              },
            });
          }

          if (targetPosition === existing.position) {
            result = states;
            return;
          }

          const reordered = [...states];
          const [moved] = reordered.splice(existing.position, 1);

          if (moved === undefined) {
            throw new Error("Moved state could not be removed from scope.");
          }

          reordered.splice(targetPosition, 0, moved);

          // Stage changed rows outside the valid range before assigning final positions.
          const uniquePositionStagingOffset = states.length + 1000;
          const updatePosition = database.prepare(
            `
              UPDATE states
              SET position = ?, updated_at = ?
              WHERE id = ?
            `,
          );

          for (let index = 0; index < reordered.length; index += 1) {
            const state = reordered[index];

            if (state === undefined || state.position === index) {
              continue;
            }

            updatePosition.run(
              uniquePositionStagingOffset + index,
              writeSqlDateTimeUtc(updatedAt),
              state.id,
            );
          }

          for (let index = 0; index < reordered.length; index += 1) {
            const state = reordered[index];

            if (state === undefined || state.position === index) {
              continue;
            }

            updatePosition.run(index, writeSqlDateTimeUtc(updatedAt), state.id);
          }

          result = readStatesInScope(database, existing.scope);
        });

        return result;
      },
      catch: (cause) => {
        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        if (cause instanceof ValidationError) {
          return cause;
        }

        return new UnknownStateStoreError({ cause });
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

        runInImmediateTransaction(database, () => {
          clearDefault.run(writeSqlDateTimeUtc(updatedAt), existing.scope);
          setDefault.run(writeSqlDateTimeUtc(updatedAt), stateId);
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

        return new UnknownStateStoreError({ cause });
      },
    }),

  deleteState: (stateId, updatedAt) =>
    Effect.try({
      try: () => {
        runInImmediateTransaction(database, () => {
          const existing = readStateById(database, stateId);

          if (existing === null) {
            throw new StateNotFoundError({ stateId });
          }

          const deleteState = database.prepare(
            `
              DELETE FROM states
              WHERE id = ?
            `,
          );
          const compactPositions = database.prepare(
            `
              UPDATE states
              SET position = position - 1, updated_at = ?
              WHERE scope = ? AND position > ?
            `,
          );

          deleteState.run(stateId);
          compactPositions.run(
            writeSqlDateTimeUtc(updatedAt),
            existing.scope,
            existing.position,
          );
        });
      },
      catch: (cause) => {
        if (cause instanceof StateNotFoundError) {
          return cause;
        }

        if (isSqliteForeignKeyError(cause)) {
          return new StateInUseError({ stateId });
        }

        return new UnknownStateStoreError({ cause });
      },
    }),
});

export const StateStoreLive = (
  database: Pick<DatabaseSync, "prepare" | "exec">,
): Layer.Layer<StateStore> =>
  Layer.succeed(StateStore, makeStateStore(database));
