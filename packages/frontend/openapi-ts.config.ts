import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: '../../spec/openapi.yaml',
  output: {
    path: './src/lib/api/generated',
  },
});
