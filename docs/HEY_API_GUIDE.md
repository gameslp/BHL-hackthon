# hey-api Client Generation Guide

## What is hey-api?

`@hey-api/openapi-ts` is a tool that generates type-safe TypeScript API clients from OpenAPI specifications. It creates:

1. **TypeScript types** from your OpenAPI schemas
2. **Service functions** for each API endpoint
3. **Type-safe fetch wrappers** with automatic validation

## Why Use It?

- ✅ **Type safety**: Compile-time checks for request/response types
- ✅ **DRY principle**: API contract (OpenAPI) is single source of truth
- ✅ **Auto-completion**: Full IDE support for API calls
- ✅ **Reduced bugs**: Catch API mismatches at build time, not runtime
- ✅ **Documentation**: Types serve as inline API documentation

## Workflow

```
spec/openapi.yaml
     ↓
  (hey-api generates)
     ↓
packages/frontend/src/lib/api/generated/
     ├── index.ts        # Main exports
     ├── types.ts        # TypeScript types
     └── services.ts     # API functions
```

## Configuration

Already configured in `packages/frontend/package.json`:

```json
{
  "scripts": {
    "generate:client": "openapi-ts -i ../../spec/openapi.yaml -o ./src/lib/api/generated -c fetch"
  }
}
```

**Flags explained:**
- `-i` (input): Path to OpenAPI spec
- `-o` (output): Output directory for generated code
- `-c fetch`: Use native fetch API (instead of axios)

## Generation Command

```bash
# From project root
cd packages/frontend
pnpm generate:client
```

Or from root with filter:
```bash
pnpm --filter @repo/frontend generate:client
```

## Generated Output

After running `pnpm generate:client`, you'll get:

### `src/lib/api/generated/types.ts`

```typescript
// Auto-generated types from OpenAPI schemas
export interface Building {
  id: string;
  polygon: number[][];
  centroid: {
    lng: number;
    lat: number;
  };
  isAsbestos: boolean;
  isPotentiallyAsbestos: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface BBoxRequest {
  ne: {
    lat: number;
    lng: number;
  };
  sw: {
    lat: number;
    lng: number;
  };
}

export interface BBoxResponse {
  data: {
    buildings: Building[];
    stats: {
      total: number;
      asbestos: number;
      potentiallyAsbestos: number;
      clean: number;
      unknown: number;
    };
  };
  error: null;
}

// ... more types
```

### `src/lib/api/generated/services.ts`

```typescript
// Auto-generated service functions
export const postBbox = async (options: {
  body: BBoxRequest;
}): Promise<BBoxResponse> => {
  // Generated fetch logic
};

export const getBuildingsById = async (options: {
  path: {
    id: string;
  };
}): Promise<BuildingResponse> => {
  // Generated fetch logic
};

export const getGeocode = async (options: {
  query: {
    query: string;
  };
}): Promise<GeocodeResponse> => {
  // Generated fetch logic
};
```

## Using Generated Client

### Before Generation (Current Approach)

```typescript
// packages/frontend/src/features/map/hooks/useBuildings.ts
import { apiClient } from '@/lib/api/client';

export const useBBoxBuildings = () => {
  return useMutation({
    mutationFn: async (bbox: BBoxRequest) => {
      // Manual fetch with custom client
      return apiClient.fetch<BBoxResponse>('/bbox', {
        method: 'POST',
        body: JSON.stringify(bbox),
      });
    },
  });
};
```

### After Generation (Recommended)

```typescript
// packages/frontend/src/features/map/hooks/useBuildings.ts
import { postBbox, getBuildingsById } from '@/lib/api/generated';
import type { BBoxRequest } from '@/lib/api/generated/types';

export const useBBoxBuildings = () => {
  return useMutation({
    mutationFn: async (bbox: BBoxRequest) => {
      // Type-safe generated function
      const response = await postBbox({ body: bbox });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response;
    },
  });
};

export const useBuilding = (id: string | null) => {
  return useQuery({
    queryKey: ['building', id],
    queryFn: async () => {
      if (!id) return null;

      const response = await getBuildingsById({
        path: { id }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    enabled: !!id,
  });
};
```

## Configuration Options

You can customize generation with `openapi-ts.config.ts`:

```typescript
// packages/frontend/openapi-ts.config.ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../spec/openapi.yaml',
  output: './src/lib/api/generated',
  client: 'fetch',

  // Additional options:
  schemas: false,        // Don't generate JSON schemas
  services: {
    asClass: false,      // Generate functions, not classes
  },
  types: {
    enums: 'javascript', // Use JS enums instead of unions
  },
});
```

Then run:
```bash
pnpm generate:client
```

## Integration with React Query

Perfect synergy with React Query:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postBbox, getBuildingsById } from '@/lib/api/generated';

// Mutation with optimistic updates
export const useBBoxBuildings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postBbox,
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
  });
};

// Query with automatic refetching
export const useBuilding = (id: string) => {
  return useQuery({
    queryKey: ['building', id],
    queryFn: () => getBuildingsById({ path: { id } }),
    select: (response) => response.data, // Transform response
  });
};
```

## When to Regenerate

Regenerate the client whenever you:

1. ✅ Update `spec/openapi.yaml`
2. ✅ Add new endpoints
3. ✅ Change request/response schemas
4. ✅ Modify API contracts

**Make it part of your workflow:**

```bash
# After updating OpenAPI spec
cd packages/frontend
pnpm generate:client

# Or add to pre-dev script
"scripts": {
  "predev": "pnpm generate:client",
  "dev": "next dev"
}
```

## Troubleshooting

### Generated files not found

```bash
# Ensure you've run generation
cd packages/frontend
pnpm generate:client

# Check output directory
ls -la src/lib/api/generated/
```

### Type errors after generation

```bash
# Clear TypeScript cache
rm -rf .next
rm -rf node_modules/.cache

# Restart TypeScript server in IDE
# VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### OpenAPI spec validation errors

```bash
# Validate your spec
npx @apidevtools/swagger-cli validate ../../spec/openapi.yaml
```

### Base URL configuration

Generated client needs base URL. Configure it:

```typescript
// src/lib/api/client.ts
import { OpenAPI } from './generated';

OpenAPI.BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
```

## Best Practices

1. **Commit generated files**: Add `src/lib/api/generated/` to Git
2. **Version control**: Regenerate on OpenAPI changes
3. **Type imports**: Import types from generated files, not manual definitions
4. **Error handling**: Always check `response.error` from generated functions
5. **Transformation**: Use React Query's `select` to transform responses

## Comparison: Manual vs Generated

### Manual Approach
```typescript
// ❌ Manual types (can drift from API)
interface Building {
  id: string;
  name: string; // Oops, API doesn't have this field!
}

// ❌ Manual fetch (typos, no validation)
const building = await fetch('/api/buildings/123').then(r => r.json());
```

### Generated Approach
```typescript
// ✅ Types from OpenAPI (always in sync)
import type { Building } from '@/lib/api/generated/types';

// ✅ Type-safe function (catches errors at compile time)
const response = await getBuildingsById({ path: { id: '123' } });
//                                              ^--- TypeScript ensures correct params
```

## Advanced: Custom Transformers

You can wrap generated functions:

```typescript
// src/lib/api/wrappers.ts
import { postBbox as generatedPostBbox } from './generated';

export const postBbox = async (bbox: BBoxRequest) => {
  const response = await generatedPostBbox({ body: bbox });

  if (response.error) {
    // Custom error handling
    throw new ApiError(response.error.message, response.error.code);
  }

  // Transform data
  return {
    ...response.data,
    buildings: response.data.buildings.map(transformBuilding),
  };
};
```

## Summary

- **hey-api** generates type-safe clients from OpenAPI specs
- Run `pnpm generate:client` after updating `spec/openapi.yaml`
- Use generated functions in React Query hooks
- Enjoy compile-time safety and autocomplete
- Reduce runtime bugs and API mismatches

---

For more info: https://heyapi.dev/
