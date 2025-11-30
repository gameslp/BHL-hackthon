/**
 * API SDK entry point
 *
 * Exports the configured client and all generated SDK functions.
 * The client is configured with NEXT_PUBLIC_API_URL from environment.
 */

export { client } from './client-config';
export * from './generated/sdk.gen';
export * from './generated/types.gen';
