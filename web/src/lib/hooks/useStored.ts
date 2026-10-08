"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Load a value from browser storage after hydration.
 *
 * Pages are prerendered at build time, where there is no storage, so values
 * are `undefined` on the server and on the first client render, then filled
 * in. `reload` re-reads, e.g. after a write.
 */
export function useStored<T>(load: () => Promise<T>): {
  value: T | undefined;
  reload: () => Promise<void>;
} {
  const [value, setValue] = useState<T>();

  const reload = useCallback(async () => {
    setValue(await load());
  }, [load]);

  useEffect(() => {
    let active = true;
    load().then((v) => {
      if (active) setValue(v);
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { value, reload };
}
