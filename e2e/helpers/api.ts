/**
 * Direct API helpers for E2E setup/teardown.
 * Uses the test API key from env — never hardcode credentials.
 *
 * NOTE: E2E_API_URL defaults to port 3000 (backend default).
 * Set E2E_API_URL in .env if running on a different port.
 */
export const API_BASE    = process.env.E2E_API_URL    ?? 'http://localhost:3000';
export const TEST_API_KEY = process.env.E2E_TEST_API_KEY ?? '';

export async function apiRequest(
  path: string,
  opts: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${TEST_API_KEY}`,
      ...(opts.headers as Record<string, string>),
    },
  });
}
