import type { FetchJson } from '../services/http.ts';

const responses = new Map<string, Promise<unknown>>();

/** Fetch for the page: each URL at most once per visit (the free servers ask for fair use), with one retry. */
export const browserFetch: FetchJson = (url) => {
  let response = responses.get(url);
  if (!response) {
    response = fetchWithRetry(url);
    responses.set(url, response);
    response.catch(() => responses.delete(url)); // don't keep a failure around
  }
  return response;
};

async function fetchWithRetry(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}
