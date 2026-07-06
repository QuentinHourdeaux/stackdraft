export interface HealthStatus {
  readonly status: "ok";
  readonly database: "ok";
}

export const fetchHealth = async (
  signal?: AbortSignal,
): Promise<HealthStatus> => {
  const response = await fetch("/api/health", { signal });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return await response.json() as HealthStatus;
};
