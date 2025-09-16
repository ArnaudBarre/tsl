/**
 * Enforce that Promise.{all, race, allSettled, any} are only used with promises
 */
interface PromiseConstructor {
  /**
   * Creates a Promise that is resolved with an array of results when all of the provided Promises
   * resolve, or rejected when any Promise is rejected.
   * @param values An array of Promises.
   * @returns A new Promise.
   */
  all<T extends readonly Promise<unknown>[]>(
    values: T,
  ): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
  all<T>(values: Iterable<Promise<T>>): Promise<Awaited<T>[]>;

  /**
   * Creates a Promise that is resolved or rejected when any of the provided Promises are resolved
   * or rejected.
   * @param values An array of Promises.
   * @returns A new Promise.
   */
  race<T extends readonly Promise<unknown>[]>(
    values: T,
  ): Promise<Awaited<T[number]>>;
  race<T>(values: Iterable<Promise<T>>): Promise<Awaited<T>>;

  /**
   * Creates a Promise that is resolved with an array of results when all
   * of the provided Promises resolve or reject.
   * @param values An array of Promises.
   * @returns A new Promise.
   */
  allSettled<T extends readonly Promise<unknown>[]>(
    values: T,
  ): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;
  allSettled<T>(
    values: Iterable<Promise<T>>,
  ): Promise<PromiseSettledResult<Awaited<T>>[]>;

  /**
   * The any function returns a promise that is fulfilled by the first given promise to be fulfilled, or rejected with an AggregateError containing an array of rejection reasons if all of the given promises are rejected. It resolves all elements of the passed iterable to promises as it runs this algorithm.
   * @param values An array or iterable of Promises.
   * @returns A new Promise.
   */
  any<T extends readonly Promise<unknown>[]>(
    values: T,
  ): Promise<Awaited<T[number]>>;
  any<T>(values: Iterable<Promise<T>>): Promise<Awaited<T>>;
}
