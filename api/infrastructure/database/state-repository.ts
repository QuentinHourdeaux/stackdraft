import type { DatabaseSync } from "node:sqlite";
import { Effect, Layer } from "effect";
import type { State, StateScope } from "../../domain/state/state.ts";
import { isStateScope } from "../../domain/state/state.ts";
import {
  StateRepository,
  type StateRepositoryApi,
  StateRepositoryError,
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

export const makeStateRepository = (
  database: Pick<DatabaseSync, "prepare">,
): StateRepositoryApi => ({
  listByScope: (scope) =>
    Effect.try({
      try: () => {
        const rows = database
          .prepare(
            `
              SELECT
                id,
                scope,
                name,
                color,
                position,
                is_default,
                created_at,
                updated_at
              FROM states
              WHERE scope = ?
              ORDER BY position ASC, id ASC
            `,
          )
          .all(scope)
          .map(readStateRow);

        return rows.map(mapRow);
      },
      catch: (cause) => new StateRepositoryError({ cause }),
    }),
});

export const StateRepositoryLive = (
  database: Pick<DatabaseSync, "prepare">,
): Layer.Layer<StateRepository> =>
  Layer.succeed(StateRepository, makeStateRepository(database));
