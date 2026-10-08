"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * A value that only exists in the browser (storage availability, the local
 * clock, feature detection), without a hydration mismatch: prerendered HTML
 * and the first client render use `serverValue`, then React switches to
 * `getClientValue()`. `getClientValue` must return a stable (primitive) value.
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscription, getClientValue, () => serverValue);
}
