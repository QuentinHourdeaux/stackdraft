export type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly data: T }
  | { readonly kind: "error"; readonly message: string };

export const mapReadyLoadable = <T>(
  loadable: Loadable<T>,
  update: (data: T) => T,
): Loadable<T> =>
  loadable.kind === "ready"
    ? { kind: "ready", data: update(loadable.data) }
    : loadable;

export const readErrorMessage = (
  error: unknown,
  fallback: string,
): string => error instanceof Error ? error.message : fallback;
