// utils/fetchJson.ts
// Thin wrapper around fetch with uniform error handling and full
// generics for request/response typing.

type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

interface FetchOptions<TReq = unknown> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: TReq;
}

export async function fetchJson<TRes = unknown, TReq = unknown>(
  url: string,
  options: FetchOptions<TReq> = {}
): Promise<TRes> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // Stringify JSON bodies automatically
  if (
    mergedOptions.body !== undefined &&
    typeof mergedOptions.body === 'object' &&
    !(mergedOptions.body instanceof FormData) &&
    !(mergedOptions.body instanceof Blob)
  ) {
    mergedOptions.body = JSON.stringify(
      mergedOptions.body as unknown as Record<string, unknown>
    );
  }

  try {
    // Debug logging for project creation
    if (fullUrl.includes('/api/projects') && mergedOptions.method === 'POST') {
      console.log('🔍 Debug - Project creation request:');
      console.log('  URL:', fullUrl);
      console.log('  Body:', mergedOptions.body);
    }

    const response = await fetch(fullUrl, mergedOptions);

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`HTTP ${response.status} for ${fullUrl}:`, responseText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Empty responses (e.g., 204 No Content)
    if (response.status === 204) return undefined as unknown as TRes;

    return (await response.json()) as TRes;
  } catch (err: any) {
    console.error(`Fetch error for ${fullUrl}:`, err.message);
    throw err;
  }
}
