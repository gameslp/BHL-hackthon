/**
 * Configured API client
 *
 * This file exports a client instance with baseUrl set from environment variable.
 * It's imported by the generated SDK to avoid circular dependencies.
 */

import { createClient, createConfig } from './generated/client';
import type { ClientOptions } from './generated/types.gen';

// Create client with environment-specific baseUrl
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const client = createClient(
  createConfig<ClientOptions>({
    baseUrl,
  })
);
