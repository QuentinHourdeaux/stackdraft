import type { SQLOutputValue } from "node:sqlite";

export type SqlRow = Record<string, SQLOutputValue>;

export const readSqlString = (row: SqlRow, column: string): string => {
  const value = row[column];

  if (typeof value !== "string") {
    throw new TypeError(`Expected string column "${column}".`);
  }

  return value;
};

export const readSqlInteger = (row: SqlRow, column: string): number => {
  const value = row[column];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`Expected integer column "${column}".`);
  }

  return value;
};
