import { useEffect } from "react"

// From npm:use-async-effect
export const useAsyncEffect = (effect: () => Promise<CallableFunction | unknown>, deps?: any[]) => {
  return useEffect(() => {
    let cb: CallableFunction | unknown;

    (async () => {
      const result = await effect();

      cb = result;
    })();

    return () => {
      if (cb && typeof cb === "function")
        cb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
