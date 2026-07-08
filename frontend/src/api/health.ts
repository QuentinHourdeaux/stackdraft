import { readJson } from "../lib/api/read-json.ts";

export interface HealthStatus {
  readonly status: "ok";
  readonly database: "ok";
}

export const fetchHealth = async (
  signal?: AbortSignal,
): Promise<HealthStatus> => {
  const response = await fetch("/api/health", { signal });

  return await readJson<HealthStatus>(response);
};
