/**
 * API client for making requests to backend
 * This file will use the generated client from hey-api after running `pnpm generate:client`
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const apiClient = {
  baseUrl: API_BASE_URL,

  async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    console.log(`API Request: ${API_BASE_URL}${endpoint}`, options);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    console.log(`API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    return response.json();
  },
};
