export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Reject if `promise` does not settle within `ms` milliseconds. */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message = 'Request timed out'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new TimeoutError(message));
    }, ms);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}
