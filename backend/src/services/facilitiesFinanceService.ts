import { ConflictError } from '../utils/errors';

// Helpers shared by the bed and billing controllers.

// Retries an update a few times when another request changed the same item at
// the same moment (the optimistic version check failed with 409). Each retry
// re-reads the current state, so e.g. two concurrent payments on one bill are
// both applied, and the second of two concurrent bed assignments sees the bed
// as occupied and gets the normal 400 message instead of a 409.
export const retryOnConflict = async <T>(fn: () => Promise<T>, attempts = 5): Promise<T> => {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ConflictError) || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40 * i));
    }
  }
};
