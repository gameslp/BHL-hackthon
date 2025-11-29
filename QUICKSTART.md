# Quick Start Guide

Fast setup instructions to get the app running in minutes.

## Step 1: Install Dependencies (2 minutes)

```bash
# Install all packages
pnpm install
```

## Step 2: Start Database (1 minute)

```bash
# Start MySQL in Docker
pnpm docker:up

# Wait for MySQL to be healthy (check logs)
docker ps
```

## Step 3: Setup Database (2 minutes)

```bash
# Navigate to database package
cd packages/database

# Generate Prisma Client
pnpm generate

# Run migrations (creates tables)
pnpm migrate

# Optional: Add sample data
pnpm seed

# Go back to root
cd ../..
```

## Step 4: Generate API Client (1 minute)

```bash
# Navigate to frontend package
cd packages/frontend

# Generate TypeScript client from OpenAPI spec
pnpm generate:client

# Go back to root
cd ../..
```

This creates type-safe API client functions in `packages/frontend/src/lib/api/generated/`

## Step 5: Start Backend (1 minute)

Open a new terminal:

```bash
# Start Express server
pnpm dev:backend
```

You should see:
```
🚀 Server running on port 3000
📍 Health check: http://localhost:3000/health
📡 API endpoint: http://localhost:3000/api
```

Test it:
```bash
curl http://localhost:3000/health
```

## Step 6: Start Frontend (1 minute)

Open another terminal:

```bash
# Start Next.js dev server
pnpm dev:frontend
```

Frontend will run on http://localhost:3001

## Step 7: Test the App

1. Open browser: http://localhost:3001
2. You should see a map centered on Leszno, Poland
3. Map will auto-load buildings in the default area
4. Buildings should appear as colored polygons:
   - Red = Confirmed asbestos
   - Orange = ML predicted asbestos
   - Green = Clean
   - Gray = Unknown

## Common Issues

### Port Already in Use

Backend (port 3000):
```bash
# Kill process on port 3000
npx kill-port 3000
```

Frontend (port 3001):
```bash
# Kill process on port 3001
npx kill-port 3001
# Or start on different port
PORT=3002 pnpm dev:frontend
```

### MySQL Not Starting

```bash
# Check Docker is running
docker --version

# Remove old container and restart
pnpm docker:down
docker volume rm bhl-hackthon_mysql_data
pnpm docker:up
```

### Prisma Client Not Found

```bash
cd packages/database
pnpm generate
cd ../..
```

### Frontend Build Errors

```bash
# Clear Next.js cache
cd packages/frontend
rm -rf .next
pnpm dev
```

## Next Steps

1. **Add Mapbox API Key** (for address search):
   - Sign up at https://www.mapbox.com/
   - Copy API key
   - Add to `packages/backend/.env`:
     ```
     MAPBOX_ACCESS_TOKEN=pk.your_token_here
     ```

2. **Integrate Asbestos Database**:
   - Edit `packages/backend/src/services/asbestosCheckService.ts`
   - Import logic from `packages/PreviewLeszno`

3. **Setup Python ML Service**:
   - Create Flask/FastAPI service
   - Implement POST /predict endpoint
   - Update ML_SERVICE_URL in backend .env

4. **Add Interactive Bbox Selection**:
   - Install leaflet-draw
   - Implement rectangle drawing in Map component
   - Add validation for max area

## Development Workflow

```bash
# Terminal 1: Backend
pnpm dev:backend

# Terminal 2: Frontend
pnpm dev:frontend

# Terminal 3: Database Studio (optional)
pnpm db:studio
```

## Testing API Endpoints

### Test POST /bbox

```bash
curl -X POST http://localhost:3000/api/bbox \
  -H "Content-Type: application/json" \
  -d '{
    "ne": {"lat": 52.1250, "lng": 20.4750},
    "sw": {"lat": 52.1200, "lng": 20.4700}
  }'
```

### Test GET /geocode

```bash
curl "http://localhost:3000/api/geocode?query=Leszno"
```

## Stopping Everything

```bash
# Stop backend/frontend (Ctrl+C in terminals)

# Stop MySQL
pnpm docker:down
```

## Full Reset

If you need to start fresh:

```bash
# Stop everything
pnpm docker:down

# Remove database
docker volume rm bhl-hackthon_mysql_data

# Clear node_modules
rm -rf node_modules packages/*/node_modules

# Reinstall
pnpm install

# Restart from Step 2
```

## Project Structure Quick Reference

```
packages/
├── database/          # Prisma + MySQL
├── validation/        # Zod schemas
├── backend/           # Express API
└── frontend/          # Next.js app

spec/                  # Project documentation
├── domain.json        # Domain model
├── ui.json            # UI specification
├── openapi.yaml       # API contract
├── summary.md         # Tech summary
└── plan.md            # Implementation plan
```

## Useful Commands

```bash
# View all buildings in database
pnpm db:studio

# Check backend logs
pnpm dev:backend --verbose

# Test backend health
curl http://localhost:3000/health

# View MySQL logs
docker logs asbestos_app_mysql

# Connect to MySQL
mysql -h 127.0.0.1 -u appuser -papppassword appdb
```

## Ready to Hack!

You're all set! The application is running and ready for development. Check `spec/plan.md` for the detailed implementation timeline and tasks.
