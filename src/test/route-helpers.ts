/**
 * Helpers for testing Next.js App Router API handlers.
 * Constructs Request objects and parses Response JSON.
 */

const BASE_URL = "http://localhost:6959";

/** Build a GET request with optional query params */
export function makeGetRequest(path: string, params?: Record<string, string>): Request {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString());
}

/** Build a POST/PATCH/DELETE request with optional JSON body */
export function makeJsonRequest(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Request {
  return new Request(new URL(path, BASE_URL).toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Extract JSON from a NextResponse */
export async function parseJson<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
