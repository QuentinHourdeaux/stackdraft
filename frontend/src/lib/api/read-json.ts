import { decodeApiErrorResponse } from "./api-error.ts";

export const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await decodeApiErrorResponse(response);
  }

  return await response.json() as T;
};
