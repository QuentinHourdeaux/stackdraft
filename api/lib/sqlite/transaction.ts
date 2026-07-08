import type { DatabaseSync } from "node:sqlite";

export const runInImmediateTransaction = (
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
