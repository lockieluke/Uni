import { useEffect } from "react";

// From npm:use-async-effect
export const useAsyncEffect = (
	effect: () => Promise<CallableFunction | unknown>,
	deps?: unknown[]
) => {
	return useEffect(() => {
		let cb: CallableFunction | unknown;

		(async () => {
			const result = await effect();

			cb = result;
		})();

		return () => {
			if (cb && typeof cb === "function") cb();
		};

		// biome-ignore lint/correctness/useExhaustiveDependencies: Custom use-async-effect hook
	}, deps);
};
