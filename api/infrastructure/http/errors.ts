export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: Readonly<Record<string, unknown>>;
  };
}

export const apiError = (code: string, message: string): ApiErrorBody => ({
  error: {
    code,
    message,
    details: {},
  },
});
