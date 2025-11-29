# API Client Generation Workflow

## Quick Answer

**hey-api is optional but recommended.** The app works with the custom fetch wrapper, but hey-api provides type safety.

## Two Approaches

### Approach 1: Custom Fetch (Current - Works Now) ✅

**Files:**
- `packages/frontend/src/lib/api/client.ts` - Custom fetch wrapper
- `packages/frontend/src/features/map/hooks/useBuildings.ts` - Using custom client

**Pros:**
- Works immediately without generation step
- Simple, no build step needed
- Manual types from `@repo/validation`

**Cons:**
- Types can drift from API
- No compile-time validation
- Manual endpoint URLs

**Usage:**
```typescript
const result = await apiClient.fetch<BBoxResponse>('/bbox', {
  method: 'POST',
  body: JSON.stringify(bbox),
});
```

### Approach 2: hey-api Generated (Recommended) 🚀

**Setup:**
```bash
cd packages/frontend
pnpm generate:client
```

**Files Created:**
- `src/lib/api/generated/index.ts`
- `src/lib/api/generated/types.ts`
- `src/lib/api/generated/services.ts`

**Pros:**
- ✅ Type-safe API calls
- ✅ Autocomplete for all endpoints
- ✅ Compile-time error catching
- ✅ OpenAPI as single source of truth
- ✅ No manual type definitions

**Cons:**
- Needs generation step after OpenAPI changes
- One extra command to run

**Usage:**
```typescript
import { postBbox } from '@/lib/api/generated';

const result = await postBbox({ body: bbox });
// ^--- Fully typed, autocomplete works
```

## Recommended Workflow

### During Hackathon (Fast Development)

**Use Custom Client** - It's already working!

1. Start developing immediately
2. No generation step needed
3. Types from `@repo/validation` work fine

### For Production (Best Practices)

**Switch to hey-api**:

1. Run generation once:
   ```bash
   cd packages/frontend
   pnpm generate:client
   ```

2. Update hooks to use generated client:
   ```typescript
   // Before
   import { apiClient } from '@/lib/api/client';

   // After
   import { postBbox } from '@/lib/api/generated';
   ```

3. Regenerate when API changes:
   ```bash
   pnpm generate:client
   ```

## Current Status

✅ **Custom client implemented** - App works without hey-api
✅ **hey-api configured** - Ready to use when you run `pnpm generate:client`
✅ **Example file created** - See `useBuildings.generated.example.ts`

## Which Should You Use?

### Use Custom Client If:
- You want to start coding immediately
- Hackathon time is limited
- You're comfortable with manual types

### Use hey-api If:
- You want maximum type safety
- You plan to maintain this long-term
- You have 5 minutes to run generation
- You want IDE autocomplete for API calls

## Migration Path

If you start with custom client, you can switch to hey-api later:

```typescript
// Step 1: Generate client
// cd packages/frontend && pnpm generate:client

// Step 2: Update imports
- import { apiClient } from '@/lib/api/client';
+ import { postBbox } from '@/lib/api/generated';

// Step 3: Update function calls
- await apiClient.fetch('/bbox', { method: 'POST', body: JSON.stringify(bbox) })
+ await postBbox({ body: bbox })
```

## Summary

| Feature | Custom Client | hey-api |
|---------|--------------|---------|
| **Setup Time** | 0 min | 5 min |
| **Type Safety** | Manual | Automatic |
| **Autocomplete** | Partial | Full |
| **Maintenance** | Manual sync | Auto-generated |
| **Works Now** | ✅ Yes | After generation |
| **Recommended For** | Hackathons | Production |

**TL;DR**: The app works now with custom client. Run `pnpm generate:client` when you want better type safety.
