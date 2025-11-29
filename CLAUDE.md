# CLAUDE.md – Hackathon Project Bootstrap Guide

Ten plik opisuje dokładnie, jak masz pomagać w szybkim bootstrapie projektów hackathonowych (backend + frontend + data/ML).
Postępuj krok po kroku. Nie pomijaj żadnego etapu.

---

# 🎯 CEL NARZĘDZIA

Twoim zadaniem jest szybkie przygotowanie **spójnego fundamentu projektu**, który obejmuje:

- doprecyzowanie wymagań,
- projekt ekranów i przepływów,
- schema Prisma z automatyczną generacją typów,
- kontrakt API (OpenAPI) wykorzystujący wygenerowane typy,
- pnpm monorepo z prawidłową strukturą packages,
- krótki tech-summary + plan prac,
- szkic frontendu w Next.js (React Query + hey-api).

Wszystko musi być:

- praktyczne,
- spójne między frontendem i backendem,
- zgodne z naszym stałym stackiem:
  - **Monorepo:** pnpm workspaces
  - **Backend:** Node.js + Express + Prisma
  - **Frontend:** Next.js (App Router) + React Query
  - **API Client:** generowany przez **hey-api** z openapi.yaml
  - **Types:** Prisma Client types + Zod (tylko do walidacji HTTP)
  - **Database:** MySQL

---

# 🚨 ZASADY OGÓLNE

1. **Stack jest niezmienny**:
   - Monorepo: pnpm workspaces
   - Backend: Express + Prisma + MySQL
   - Frontend: Next.js (App Router) + React Query + hey-api
   - Types: Prisma Client types (source of truth)
   - Validation: Zod (tylko HTTP requests/responses)
   - Database: MySQL (zawsze)

2. **Struktura monorepo** (ZAWSZE):
```
hackathon-starter/
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── spec/
├── packages/
│   ├── database/      # Prisma schema + client
│   ├── validation/    # Zod schemas dla HTTP
│   ├── backend/       # Express API
│   └── frontend/      # Next.js app
├── docker-compose.yml
└── README.md
```

3. **Strategia typów** (KRYTYCZNE):
   - **Prisma types** = source of truth dla entities
   - **Zod schemas** = tylko walidacja HTTP (requests/responses)
   - **NIE DUPLIKUJ** typów między Prisma a Zod
   - Używaj `Prisma.ModelCreateInput`, `Prisma.ModelWhereInput` etc.

4. **Kolejność kroków** (WAŻNE):
   - KROK 0: Monorepo setup (pnpm init)
   - KROK 1: Domain model
   - KROK 2: Prisma schema
   - KROK 3: OpenAPI contract (używa Prisma types)
   - KROK 4: Validation schemas (Zod dla HTTP)
   - KROK 5: Backend implementation
   - KROK 6: Frontend setup + hey-api generation

5. Wszystkie artefakty zapisuj jako:
   - JSON (spec files)
   - YAML (openapi, docker-compose)
   - TypeScript
   - Prisma schema

6. **NIE twórz plików package.json ręcznie** - używaj pnpm init/create

---

# 🟦 KROK 0 — Monorepo Setup

Tworzy strukturę projektu z pnpm workspaces.

### 1. Główny package.json:

```json
{
  "name": "hackathon-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:backend": "pnpm --filter @repo/backend dev",
    "dev:frontend": "pnpm --filter @repo/frontend dev",
    "db:generate": "pnpm --filter @repo/database generate",
    "db:migrate": "pnpm --filter @repo/database migrate",
    "db:seed": "pnpm --filter @repo/database seed",
    "build": "pnpm -r build"
  }
}
```

### 2. pnpm-workspace.yaml:

```yaml
packages:
  - 'packages/*'
```

### 3. .gitignore:

```
node_modules
.pnpm-store
dist
.next
.env
.env.local
*.log
.DS_Store
```

---

# 🟦 KROK 1 — Doprecyzowanie wymagań
Tworzy: `spec/domain.json`

Kiedy użytkownik poda Ci **brief**, wykonaj:

### 1. Zadawaj pytania
Zadawaj precyzyjne pytania, aż będziesz w stanie opisać:

- **główny cel systemu**
- **typy użytkowników**
- **3–7 głównych ekranów**
- **1–3 golden-path flows**
- **główne entities danych**

Pytaj, aż wszystko jest jasne.

### 2. Wygeneruj finalny plik `domain.json`:

Format (użyj dokładnie tego):

```json
{
  "goal": "string",
  "users": [
    { "id": "admin", "description": "..." }
  ],
  "entities": [
    {
      "id": "Alert",
      "description": "Fraud alert",
      "fields": [
        { "name": "id", "type": "string" },
        { "name": "score", "type": "number" }
      ]
    }
  ],
  "screens": [
    {
      "id": "dashboard",
      "title": "Main dashboard",
      "description": "Overview of KPIs"
    }
  ],
  "flows": [
    {
      "id": "review_alert",
      "title": "Review suspicious alert",
      "steps": ["Open list", "Filter", "Open alert", "Resolve alert"]
    }
  ]
}
```

---

# 🟩 KROK 2 — Projekt ekranów

Tworzy: `spec/ui.json`

Na podstawie `domain.json`:

```json
{
  "screens": [
    {
      "id": "dashboard",
      "title": "Main dashboard",
      "route": "/",
      "description": "Shows KPIs and charts",
      "requiredData": [
        "totalUsers",
        "totalTransactions",
        "fraudRate"
      ],
      "actions": ["changeDateRange"],
      "usedByFlows": ["review_alert"]
    }
  ]
}
```

---

# 🟧 KROK 3 — Prisma Schema

Tworzy: `packages/database/`

### 1. Inicjalizuj database package:

```bash
mkdir -p packages/database
cd packages/database
pnpm init
pnpm add -D prisma typescript @types/node
pnpm add @prisma/client
```

### 2. `packages/database/package.json`:

```json
{
  "name": "@repo/database",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 3. `packages/database/prisma/schema.prisma`:

**ZASADY:**
- **ZAWSZE MySQL jako provider**
- `String @id @default(cuid())` lub `Int @id @default(autoincrement())`
- Tylko modele domeny z domain.json
- Indeksy dla często queryowanych pól
- Relacje z `@relation`

Przykład:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}
```

### 4. `packages/database/src/index.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export * from '@prisma/client';
```

### 5. `packages/database/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "prisma/**/*"]
}
```

### 6. `packages/database/.env`:

```
DATABASE_URL="mysql://appuser:apppassword@localhost:3306/appdb"
```

---

# 🟥 KROK 4 — OpenAPI Contract

Tworzy: `spec/openapi.yaml`

Na podstawie `domain.json` + `ui.json`:

### ZASADY:

* OpenAPI 3.0
* Odpowiedź **zawsze**:

```json
{ "data": <payload>, "error": null }
```

* Używaj nazw typów zgodnych z Prisma models
* Wszystkie endpoints z path parameters, query params, body
* Kody: 200, 400, 404, 500

### Output:

Czysty YAML, bez markdown.

Przykład:

```yaml
openapi: 3.0.0
info:
  title: Hackathon API
  version: 1.0.0

paths:
  /users:
    get:
      summary: Get all users
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GetUsersResponse'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
        createdAt:
          type: string
          format: date-time

    GetUsersResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            users:
              type: array
              items:
                $ref: '#/components/schemas/User'
        error:
          type: null

    ErrorResponse:
      type: object
      properties:
        data:
          type: null
        error:
          type: object
          properties:
            message:
              type: string
            code:
              type: string
```

---

# 🟨 KROK 5 — Validation Package (Zod)

Tworzy: `packages/validation/`

**TYLKO dla HTTP request/response validation!**

### 1. Inicjalizuj validation package:

```bash
mkdir -p packages/validation/src
cd packages/validation
pnpm init
pnpm add zod
pnpm add -D typescript @types/node
```

### 2. `packages/validation/package.json`:

```json
{
  "name": "@repo/validation",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### 3. `packages/validation/src/requests.ts`:

**TYLKO request body/query validation!**

```typescript
import { z } from 'zod';

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const GetUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>;
```

### 4. `packages/validation/src/responses.ts`:

**TYLKO response shape validation!**

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

export const GetUsersResponseSchema = z.object({
  data: z.object({
    users: z.array(UserSchema),
  }),
  error: z.null(),
});

export const ErrorResponseSchema = z.object({
  data: z.null(),
  error: z.object({
    message: z.string(),
    code: z.string(),
  }),
});
```

### 5. `packages/validation/src/index.ts`:

```typescript
export * from './requests';
export * from './responses';
```

---

# 🟪 KROK 6 — Docker + Database Setup

Tworzy:
* `docker-compose.yml`
* `docker/mysql/init.sql`

### 1. `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: hackathon_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: appdb
      MYSQL_USER: appuser
      MYSQL_PASSWORD: apppassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 5s
      retries: 10

volumes:
  mysql_data:
```

### 2. `docker/mysql/init.sql`:

```sql
CREATE DATABASE IF NOT EXISTS shadow_db;

GRANT ALL PRIVILEGES ON shadow_db.* TO 'appuser'@'%';
GRANT ALL PRIVILEGES ON appdb.* TO 'appuser'@'%';

FLUSH PRIVILEGES;
```

---

# 🟦 KROK 7 — Backend Implementation

Tworzy: `packages/backend/`

### 1. Inicjalizuj backend:

```bash
mkdir -p packages/backend/src
cd packages/backend
pnpm init
pnpm add express cors dotenv
pnpm add @repo/database @repo/validation
pnpm add -D typescript @types/node @types/express @types/cors ts-node-dev
```

### 2. `packages/backend/package.json`:

```json
{
  "name": "@repo/backend",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@repo/database": "workspace:*",
    "@repo/validation": "workspace:*",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

### 3. Struktura backend:

```
packages/backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app
│   ├── middleware/
│   │   ├── validate.ts       # Zod validation middleware
│   │   ├── asyncHandler.ts   # Async error wrapper
│   │   ├── errorHandler.ts   # Global error handler
│   │   └── response.ts       # Response formatter
│   ├── routes/
│   │   └── index.ts
│   ├── controllers/
│   └── services/
├── .env
├── .env.example
├── tsconfig.json
└── package.json
```

### 4. `packages/backend/src/middleware/validate.ts`:

**Validation middleware using Zod:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req[source]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          data: null,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          },
        });
      }
      next(error);
    }
  };
};
```

### 5. `packages/backend/src/middleware/asyncHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### 6. `packages/backend/src/middleware/response.ts`:

**Unified response format:**

```typescript
import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200) => {
  res.status(statusCode).json({
    data,
    error: null,
  });
};

export const sendError = (res: Response, message: string, code: string, statusCode: number = 500) => {
  res.status(statusCode).json({
    data: null,
    error: {
      message,
      code,
    },
  });
};
```

### 7. `packages/backend/src/middleware/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@repo/database';

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      data: null,
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        data: null,
        error: {
          message: 'Resource already exists',
          code: 'DUPLICATE_ERROR',
        },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        data: null,
        error: {
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
      });
    }
  }

  res.status(500).json({
    data: null,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
};
```

### 8. `packages/backend/src/app.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

export default app;
```

### 9. `packages/backend/src/index.ts`:

```typescript
import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 10. Przykładowy controller pattern:

**`packages/backend/src/controllers/usersController.ts`:**

```typescript
import { Request, Response } from 'express';
import { prisma } from '@repo/database';
import type { Prisma } from '@repo/database';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../middleware/response';
import { AppError } from '../middleware/errorHandler';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;

  const users = await prisma.user.findMany({
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit),
  });

  sendSuccess(res, { users });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data: Prisma.UserCreateInput = req.body;

  const user = await prisma.user.create({ data });

  sendSuccess(res, user, 201);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError('User not found', 'NOT_FOUND', 404);
  }

  sendSuccess(res, user);
});
```

### 11. Przykładowy routing pattern:

**`packages/backend/src/routes/users.ts`:**

```typescript
import { Router } from 'express';
import { getUsers, createUser, getUserById } from '../controllers/usersController';
import { validate } from '../middleware/validate';
import { CreateUserRequestSchema, GetUsersQuerySchema } from '@repo/validation';

const router = Router();

router.get('/', validate(GetUsersQuerySchema, 'query'), getUsers);
router.post('/', validate(CreateUserRequestSchema, 'body'), createUser);
router.get('/:id', getUserById);

export default router;
```

### 12. `packages/backend/.env.example`:

```
PORT=3000
DATABASE_URL="mysql://appuser:apppassword@localhost:3306/appdb"
NODE_ENV=development
```

---

# 🟩 KROK 8 — Frontend Setup

Tworzy: `packages/frontend/`

### 1. Inicjalizuj Next.js:

```bash
cd packages
pnpm create next-app frontend --typescript --tailwind --app --src-dir --import-alias "@/*"
cd frontend
pnpm add @tanstack/react-query @repo/validation
pnpm add -D @hey-api/openapi-ts
```

### 2. `packages/frontend/package.json` dodaj:

```json
{
  "scripts": {
    "generate:client": "openapi-ts -i ../../spec/openapi.yaml -o ./src/lib/api/generated -c fetch"
  },
  "dependencies": {
    "@repo/validation": "workspace:*",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

### 3. Struktura frontend:

```
packages/frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # QueryClientProvider
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   └── api/
│   │       ├── client.ts      # hey-api client config
│   │       ├── queryClient.ts # React Query config
│   │       └── generated/     # Auto-generated by hey-api
│   └── features/
│       └── users/
│           ├── hooks/
│           │   └── useUsers.ts
│           └── components/
├── .env.local.example
└── package.json
```

### 4. `packages/frontend/src/lib/api/client.ts`:

```typescript
import { createClient } from './generated';

export const apiClient = createClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
});
```

### 5. `packages/frontend/src/lib/api/queryClient.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### 6. `packages/frontend/src/app/layout.tsx`:

```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/queryClient';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

### 7. Przykładowy custom hook z React Query:

**`packages/frontend/src/features/users/hooks/useUsers.ts`:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { CreateUserRequest } from '@repo/validation';

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return response.data;
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      const response = await apiClient.post('/users', { body: data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

### 8. `.env.local.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

# 🟨 KROK 9 — Summary & Plan

Tworzy:
* `spec/summary.md`
* `spec/plan.md`

### Summary:

* max ~250 słów
* po angielsku
* opis co system robi, dla innego AI

### Plan:

* podział prac na role (backend, frontend, data/ML)
* timeline typu:
  * T+0–2h: Setup & migrations
  * T+2–6h: Core features
  * T+6–12h: Advanced features
  * T+12–24h: Polish & demo

---

# 🧪 JAK Z TEGO KORZYSTAĆ

## Tryb automatyczny (domyślny):

Gdy użytkownik poda brief projektu, **automatycznie przejdź przez wszystkie kroki 0-9** bez pytania o zgodę na każdy krok.

1. Zadaj pytania doprecyzowujące (KROK 1)
2. Po otrzymaniu odpowiedzi, **od razu** wygeneruj wszystkie artefakty w kolejności:
   - Monorepo setup (pnpm-workspace.yaml, root package.json)
   - `spec/domain.json`
   - `spec/ui.json`
   - `packages/database/` (Prisma schema, package.json, .env)
   - `spec/openapi.yaml`
   - `packages/validation/` (Zod schemas)
   - `docker-compose.yml`, `docker/mysql/init.sql`
   - `packages/backend/` (pełna struktura z middleware)
   - `packages/frontend/` (Next.js setup + React Query)
   - `spec/summary.md`, `spec/plan.md`

**Nie pytaj użytkownika "czy przejść do następnego kroku"** - po prostu to zrób.

## Po zakończeniu:

**Setup i start:**

```bash
# Root directory
pnpm install

# Start MySQL
docker-compose up -d

# Database setup
cd packages/database
pnpm generate
pnpm migrate
pnpm seed

# Terminal 1: Backend
cd packages/backend
pnpm dev

# Terminal 2: Frontend
cd packages/frontend
pnpm generate:client  # Generate API client from OpenAPI
pnpm dev
```

---

# ✅ CHECKLIST JAKOŚCI

Przed zakończeniem, sprawdź:

- [ ] pnpm workspaces działa (`pnpm install` w root)
- [ ] Prisma types są używane w backend (`import type { Prisma } from '@repo/database'`)
- [ ] Zod TYLKO do HTTP validation (nie duplikuje Prisma models)
- [ ] Middleware: validate, asyncHandler, errorHandler, response
- [ ] Controllers używają `Prisma.ModelCreateInput` etc.
- [ ] Frontend ma wygenerowany client z hey-api
- [ ] React Query hooks używają wygenerowanego clienta
- [ ] Wszystkie packages mają `workspace:*` dependencies
- [ ] .env.example files są obecne
- [ ] Docker Compose działa i tworzy shadow_db

---

# 🚫 CZEGO UNIKAĆ

1. **NIE duplikuj typów** - Prisma jest source of truth
2. **NIE twórz ręcznie Zod schemas dla entities** - tylko dla HTTP validation
3. **NIE używaj symlinków** - tylko pnpm workspaces
4. **NIE rób validation w controllerach** - używaj middleware
5. **NIE hardcoduj response format** - używaj helper functions
6. **NIE ignoruj Prisma error types** - obsługuj je w errorHandler
7. **NIE twórz package.json ręcznie** - używaj pnpm init
8. **NIE zapomnij o hey-api generation** w workflow frontendu

---

# 📚 PRZYKŁADOWY FLOW DANYCH

```
User Request (Frontend)
  ↓
React Query hook
  ↓
hey-api generated client
  ↓
HTTP Request
  ↓
Express Route
  ↓
Zod Validation Middleware (validate request shape)
  ↓
Controller (uses Prisma types)
  ↓
Prisma Client (database query)
  ↓
Response Helper (sendSuccess/sendError)
  ↓
HTTP Response
  ↓
React Query cache update
  ↓
UI Re-render
```

**Typy:**
- Request validation: `@repo/validation` Zod schemas
- Database operations: `Prisma.ModelCreateInput`, `Prisma.ModelWhereInput`
- Return types: `User`, `Post` etc. from `@repo/database`

---

Zawsze trzymaj się tej struktury i formatów opisanych powyżej!
