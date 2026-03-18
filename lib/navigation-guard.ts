type GuardCallback = (url: string) => void;

let guardCallback: GuardCallback | null = null;

export function registerNavigationGuard(cb: GuardCallback) {
  guardCallback = cb;
}

export function unregisterNavigationGuard() {
  guardCallback = null;
}

/**
 * Returns true if navigation should proceed, false if it was intercepted.
 * When blocked, calls the registered callback with the destination URL.
 */
export function checkNavigationGuard(url: string): boolean {
  if (!guardCallback) return true;
  guardCallback(url);
  return false;
}
