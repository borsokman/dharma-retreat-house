import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; data: T };

/**
 * Small state machine for API calls: idle → loading → done | error.
 * Only the most recent call may update state, so a slow, outdated response
 * can never overwrite a newer one.
 */
export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({ kind: "idle" });
  const mounted = useRef(false);
  const latestCall = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<T>) => {
    const call = ++latestCall.current;
    const isCurrent = () => mounted.current && call === latestCall.current;
    setState({ kind: "loading" });
    try {
      const data = await fn();
      if (isCurrent()) setState({ kind: "done", data });
      return data;
    } catch (err) {
      if (isCurrent())
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Something went wrong — please try again.",
        });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    latestCall.current++;
    setState({ kind: "idle" });
  }, []);

  return { state, run, reset };
}
