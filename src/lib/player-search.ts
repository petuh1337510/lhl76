export const SEARCH_DEBOUNCE_MS = 250;

/** Returns cleanup for both the pending debounce and an already started request. */
export function schedulePlayerSearch<T>(
  query: string,
  onResults: (items: T[]) => void,
  onError: () => void,
) {
  const search = query.trim();
  if (search.length < 2) return () => {};

  const controller = new AbortController();
  const timer = setTimeout(async () => {
    try {
      const response = await fetch(`/api/admin/players?search=${encodeURIComponent(search)}&page=1`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Player search failed");
      const data = await response.json();
      // A response/body may finish just as the query changes. Never publish it then.
      if (!controller.signal.aborted) onResults(data.items);
    } catch {
      if (!controller.signal.aborted) onError();
    }
  }, SEARCH_DEBOUNCE_MS);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}
