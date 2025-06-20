/**
 * Enforce Error type on reject callbacks
 */
interface PromiseConstructor {
  /**
   * Creates a new Promise.
   * @param executor A callback used to initialize the promise. This callback is passed two arguments:
   * a resolve callback used to resolve the promise with a value or the result of another promise,
   * and a reject callback used to reject the promise with a provided reason or error.
   */
  new <T>(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason: Error) => void,
    ) => void,
  ): Promise<T>;
}
