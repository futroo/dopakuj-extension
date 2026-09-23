import type { PendingSearch } from '../types/offers';

const KEY = 'pendingSearch';

export function usePendingSearch() {
  const save = async (pending: PendingSearch): Promise<void> => {
    await chrome.storage.session.set({ [KEY]: pending });
  };
  const load = async (): Promise<PendingSearch | undefined> => {
    const result = await chrome.storage.session.get(KEY);
    const value = result[KEY] as PendingSearch | undefined;
    return value?.query ? value : undefined;
  };
  const clear = async (): Promise<void> => chrome.storage.session.remove(KEY);
  return { save, load, clear };
}
