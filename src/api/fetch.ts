import type { RequestOptions } from "./types.js";

// Standard headers to prevent blocking from certain endpoints
const getBrowserHeaders = (): Record<string, string> => ({
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
});

/**
 * Core fetch wrapper for external requests.
 */
export const apiFetch = async (
  url: string,
  options?: RequestInit & RequestOptions
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getBrowserHeaders(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} for URL: ${url}`);
  }

  return response;
};

/**
 * Helper to fetch and parse JSON
 */
export const fetchJson = async <T>(url: string, options?: RequestInit & RequestOptions): Promise<T> => {
  const response = await apiFetch(url, options);
  return response.json() as Promise<T>;
};

/**
 * Helper to fetch raw text (e.g., Markdown or raw source code)
 */
export const fetchText = async (url: string, options?: RequestInit & RequestOptions): Promise<string> => {
  const response = await apiFetch(url, options);
  return response.text();
};
