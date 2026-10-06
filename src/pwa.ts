import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

/** Whether the app shell is cached and Letritas can open without internet. */
export const usePwa = create<{ offlineReady: boolean }>()(() => ({ offlineReady: false }));

export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onOfflineReady: () => usePwa.setState({ offlineReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration?.active) usePwa.setState({ offlineReady: true });
    },
  });
}
