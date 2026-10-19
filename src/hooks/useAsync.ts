import { useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; data: T };

/** Small state machine for API calls: idle → loading → done | error. */
export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({ kind: "idle" });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function run(fn: () => Promise<T>) {
    setState({ kind: "loading" });
    try {
      const data = await fn();
      if (!cancelled.current) setState({ kind: "done", data });
      return data;
    } catch (err) {
      if (!cancelled.current)
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Something went wrong — please try again.",
        });
      return undefined;
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  return { state, run, reset };
}
