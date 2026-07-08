const SQLITE_UNIQUE_CONSTRAINT_ERRCODE = 2067;
const SQLITE_FOREIGN_KEY_ERRCODE = 787;

const readSqliteErrcode = (cause: unknown): number | undefined => {
  if (typeof cause !== "object" || cause === null || !("errcode" in cause)) {
    return undefined;
  }

  return typeof cause.errcode === "number" ? cause.errcode : undefined;
};

export const readSqliteErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "";

export const hasSqliteErrcode = (cause: unknown, errcode: number): boolean =>
  readSqliteErrcode(cause) === errcode;

export const isSqliteUniqueConstraintError = (cause: unknown): boolean =>
  hasSqliteErrcode(cause, SQLITE_UNIQUE_CONSTRAINT_ERRCODE) ||
  readSqliteErrorMessage(cause).includes("UNIQUE constraint failed");

export const isSqliteForeignKeyError = (cause: unknown): boolean =>
  hasSqliteErrcode(cause, SQLITE_FOREIGN_KEY_ERRCODE) ||
  readSqliteErrorMessage(cause).includes("FOREIGN KEY constraint failed");
