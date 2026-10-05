/**
 * Typed view of a dedicated worker's global scope. The app is type-checked with the DOM lib, and
 * mixing in the WebWorker lib causes duplicate declarations, so workers use this small interface.
 */
export interface WorkerScope<In, Out> {
  postMessage(message: Out, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<In>) => void): void;
}

export function workerScope<In, Out>(): WorkerScope<In, Out> {
  return self as unknown as WorkerScope<In, Out>;
}
