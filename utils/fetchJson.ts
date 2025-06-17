// utils/fetchJson.ts
// Thin wrapper around fetch with uniform error handling

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

export async function fetchJson(url: string, options: FetchOptions = {}): Promise<any> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  if (mergedOptions.body && typeof mergedOptions.body === 'object') {
    mergedOptions.body = JSON.stringify(mergedOptions.body);
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
      // Log response details for debugging
      const responseText = await response.text();
      console.error(`HTTP ${response.status} for ${fullUrl}:`, responseText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Fetch error for ${fullUrl}:`, error.message);
    throw error;
  }
}
