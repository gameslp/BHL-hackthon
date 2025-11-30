# Asbestos Detection Application

Web application for government officials to identify buildings with asbestos roofs using ML predictions and official asbestos database records.

## Features

- Interactive map interface with Leaflet
- Select rectangular areas to scan for buildings
- Automatic building detection via OpenStreetMap Overpass API
- Asbestos database verification
- ML-based prediction for potential asbestos presence
- Color-coded building visualization (red = asbestos, orange = potentially, green = clean, gray = unknown)
- Real-time statistics panel
- Address search with geocoding
- Building detail popups

## Tech Stack

### Monorepo
- **Package Manager:** pnpm workspaces

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MySQL (via Docker)
- **ORM:** Prisma
- **Validation:** Zod (HTTP only)
- **Type System:** Prisma Client types (source of truth)

### Frontend
- **Framework:** Next.js 16 (App Router)
- **State Management:** React Query
- **Map Library:** Leaflet + react-leaflet
- **Styling:** Tailwind CSS
- **API Client:** Custom fetch wrapper (hey-api compatible)

### External Services
- OpenStreetMap Overpass API (building data)
- Mapbox Geocoding API (address search)
- Python ML Service (asbestos prediction - in development)

## Project Structure

```
asbestos-detection-app/
├── packages/
│   ├── database/          # Prisma schema + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       └── index.ts
│   ├── validation/        # Zod HTTP validation schemas
│   │   └── src/
│   │       ├── requests.ts
│   │       ├── responses.ts
│   │       └── index.ts
│   ├── backend/           # Express API server
│   │   └── src/
│   │       ├── middleware/
│   │       ├── services/
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── app.ts
│   │       └── index.ts
│   └── frontend/          # Next.js application
│       └── src/
│           ├── app/
│           ├── features/map/
│           └── lib/api/
├── spec/                  # Project specifications
│   ├── domain.json
│   ├── ui.json
│   ├── openapi.yaml
│   ├── summary.md
│   └── plan.md
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for MySQL)

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start MySQL database:**
   ```bash
   pnpm docker:up
   ```

3. **Setup database:**
   ```bash
   cd packages/database
   pnpm generate
   pnpm migrate
   pnpm seed  # Optional: add sample data
   ```

4. **Configure environment variables:**

   Backend (`packages/backend/.env`):
   ```bash
   PORT=3000
   DATABASE_URL="mysql://appuser:apppassword@localhost:3306/appdb"
   MAPBOX_ACCESS_TOKEN=your_mapbox_token_here  # Get from https://www.mapbox.com/
   ML_SERVICE_URL=http://localhost:8000
   ```

   Frontend (`packages/frontend/.env.local`):
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   ```

### Development

Run backend and frontend in separate terminals:

**Terminal 1 - Backend:**
```bash
pnpm dev:backend
```
Backend will run on http://localhost:3000

**Terminal 2 - Frontend:**
```bash
pnpm dev:frontend
```
Frontend will run on http://localhost:3001

### Building for Production

```bash
pnpm build
```

### Production via Docker Compose

1. **Environment:** Copy `.env.production.example` to `.env.production` and fill in the remote `DATABASE_URL`, optional `SHADOW_DATABASE_URL`, Mapbox token, and any custom ports/API URLs.  
2. **ML artifact:** Place the ONNX model at `./artifacts/asbestos_net.onnx` (this directory is mounted read-only into the ML container).  
3. **Build & start:**  
   ```bash
   docker compose --env-file .env.production -f docker-compose-prod.yml up --build
   ```  
   This builds the monorepo once, generates the hey-api client, compiles every workspace package, runs `prisma generate`, and executes `prisma migrate deploy` against the configured MySQL instance before launching the backend.  
4. **Services (host ports):**  
   - Backend → http://localhost:3030 (depends on ML service and external DB)  
   - Frontend → http://localhost:3031 (served via `next start`)  
   - ML API → http://localhost:3032 (FastAPI + ONNX Runtime)

## API Endpoints

### POST /api/bbox
Get buildings in bounding box area.

**Request:**
```json
{
  "ne": { "lat": 52.1250, "lng": 20.4750 },
  "sw": { "lat": 52.1200, "lng": 20.4700 }
}
```

**Response:**
```json
{
  "data": {
    "buildings": [...],
    "stats": {
      "total": 42,
      "asbestos": 5,
      "potentiallyAsbestos": 8,
      "clean": 25,
      "unknown": 4
    }
  },
  "error": null
}
```

### GET /api/buildings/:id
Get building details by ID.

### GET /api/geocode?query=address
Search for address and get coordinates.

## Database Schema

### Building Model
- `id`: string (CUID)
- `polygon`: JSON array of [lng, lat] coordinates
- `centroidLng`, `centroidLat`: float (for spatial queries)
- `isAsbestos`: boolean (from asbestos database)
- `isPotentiallyAsbestos`: boolean | null (ML prediction)
- `createdAt`, `updatedAt`: timestamps

Indexed on: centroid coordinates, isAsbestos, isPotentiallyAsbestos, updatedAt

## Key Commands

```bash
# Install all dependencies
pnpm install

# Development
pnpm dev:backend          # Start backend server
pnpm dev:frontend         # Start frontend dev server

# Database
pnpm db:generate          # Generate Prisma client
pnpm db:migrate           # Run migrations
pnpm db:seed              # Seed database
pnpm db:studio            # Open Prisma Studio

# Docker
pnpm docker:up            # Start MySQL container
pnpm docker:down          # Stop MySQL container

# Build
pnpm build                # Build all packages
```

## Integration Tasks

### 1. Asbestos Database Check
The `AsbestosCheckService` currently returns `false` (placeholder). Integrate actual logic from `packages/PreviewLeszno`:

File: `packages/backend/src/services/asbestosCheckService.ts`

```typescript
// TODO: Implement actual check using PreviewLeszno logic
static async checkIsAsbestos(polygon: number[][]): Promise<boolean> {
  // Import and use actual asbestos database check
  return false; // Replace with real implementation
}
```

### 2. Python ML Service
The `MLService` expects a Python service at `http://localhost:8000`:

**Expected API:**
```
POST /predict
Body: { "polygon": [[lng, lat], ...] }
Response: { "isPotentiallyAsbestos": true/false }
```

**Batch endpoint (optional):**
```
POST /predict/batch
Body: { "buildings": [[[lng, lat], ...], ...] }
Response: { "predictions": [true, false, null, ...] }
```

### 3. Mapbox API Key
Get a free API key from https://www.mapbox.com/ and add to `packages/backend/.env`:
```
MAPBOX_ACCESS_TOKEN=pk.your_actual_token_here
```

## Frontend Rectangle Drawing

The current implementation auto-loads a demo area. To add interactive bbox selection:

1. Install leaflet-draw: `pnpm add leaflet-draw @types/leaflet-draw`
2. Implement rectangle drawing tool in Map component
3. Add max area validation (0.01 deg² limit)

## Troubleshooting

### Database Connection Issues
```bash
# Check if MySQL is running
docker ps

# Restart MySQL
pnpm docker:down
pnpm docker:up

# Check connection
mysql -h 127.0.0.1 -u appuser -papppassword appdb
```

### Frontend SSR Errors with Leaflet
Leaflet is client-side only. Ensure Map component is loaded with `dynamic` import:
```typescript
const Map = dynamic(() => import('@/features/map/components/Map'), { ssr: false });
```

### Overpass API Rate Limiting
Overpass API has rate limits. For production, consider:
- Caching more aggressively
- Using a local Overpass instance
- Batch processing buildings

## Performance Considerations

- Buildings within ~0.0001° of each other are considered duplicates
- Spatial indexes on centroid coordinates enable fast bbox queries
- React Query caches API responses for 1 minute
- ML service timeout is 5 seconds (returns null on failure)

## Security Notes

- Input validation with Zod prevents injection attacks
- CORS is enabled (configure for production)
- No authentication implemented (add for production)
- Environment variables must be set correctly

## License

MIT

## Contributors

Built for BHL Hackathon
