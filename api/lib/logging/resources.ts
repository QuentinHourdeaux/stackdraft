export const logResources = ["stack", "draft", "state"] as const;
export type LogResource = (typeof logResources)[number];

export interface LogResourceRef {
  readonly type: LogResource;
  readonly id: string;
}
