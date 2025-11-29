# Implementation Plan - Asbestos Detection App

## Timeline Overview
This plan assumes a 24-hour hackathon timeline, with work divided across backend, frontend, and data/ML roles.

---

## T+0 to T+2 hours: Foundation & Setup

### Backend Developer
- [x] Initialize monorepo structure (pnpm workspaces)
- [x] Setup MySQL Docker container
- [x] Create and migrate Prisma schema
- [x] Setup Express server with middleware (validation, error handling, async wrapper)
- [x] Implement health check endpoint
- [ ] Run `pnpm install` in root to install all dependencies
- [ ] Start Docker: `pnpm docker:up`
- [ ] Run database migrations: `pnpm db:migrate`
- [ ] Test backend server: `pnpm dev:backend`

### Frontend Developer
- [x] Initialize Next.js app with TypeScript and Tailwind
- [x] Setup React Query provider
- [x] Install Leaflet and react-leaflet
- [x] Create basic map component with OpenStreetMap tiles
- [ ] Run `pnpm install` to install frontend dependencies
- [ ] Test frontend: `pnpm dev:frontend`

### Data/ML Developer
- [ ] Review existing PreviewLeszno asbestos check script
- [ ] Design Python ML service API contract (POST /predict endpoint)
- [ ] Setup basic Flask/FastAPI server skeleton
- [ ] Create mock prediction endpoint returning random/null values

---

## T+2 to T+6 hours: Core Features

### Backend Developer
- [x] Implement OverpassService (fetch buildings from OSM)
- [x] Implement AsbestosCheckService placeholder
- [x] Implement MLService with mock/fallback
- [x] Implement POST /bbox controller with full processing pipeline
- [x] Implement GET /buildings/:id endpoint
- [ ] **Integrate actual asbestos check logic from packages/PreviewLeszno**
- [ ] Test bbox endpoint with Postman/curl
- [ ] Add logging for debugging Overpass API responses
- [ ] Optimize database queries (ensure indexes working)

### Frontend Developer
- [x] Create useBBoxBuildings hook with React Query
- [x] Implement building polygon rendering on map
- [x] Add color coding based on asbestos status
- [x] Create statistics panel component
- [x] Add building detail popup on click
- [ ] Implement rectangle drawing tool for bbox selection (use leaflet-draw or custom)
- [ ] Add max bbox size validation (prevent large queries)
- [ ] Connect frontend to backend API (update .env.local with backend URL)
- [ ] Test end-to-end flow: draw bbox → fetch → render

### Data/ML Developer
- [ ] Implement actual ML model loading (if model ready)
- [ ] Create preprocessing pipeline for building polygon data
- [ ] Implement POST /predict endpoint with real predictions
- [ ] Add batch prediction endpoint for efficiency
- [ ] Test predictions with sample building data
- [ ] Deploy ML service locally and update backend .env with correct URL

---

## T+6 to T+12 hours: Advanced Features

### Backend Developer
- [x] Implement GeocodingService (Mapbox integration)
- [x] Add GET /geocode endpoint
- [ ] **Critical: Integrate PreviewLeszno asbestos database check**
- [ ] Optimize bbox processing (parallel processing for multiple buildings)
- [ ] Add rate limiting for Overpass API calls
- [ ] Implement caching strategy (Redis optional)
- [ ] Add error recovery for external API failures
- [ ] Write API integration tests

### Frontend Developer
- [ ] Implement address search bar with geocoding
- [ ] Add autocomplete for address search
- [ ] Implement map jump-to-location on search result select
- [ ] Add loading states and error messages
- [ ] Improve UX: disable bbox selection while loading
- [ ] Add keyboard shortcuts (Escape to cancel selection)
- [ ] Implement building detail side panel (alternative to popup)
- [ ] Add export functionality (download buildings as GeoJSON/CSV)

### Data/ML Developer
- [ ] Fine-tune ML model if needed
- [ ] Implement confidence scores in predictions
- [ ] Add model versioning and metadata
- [ ] Create prediction explanation endpoint (why model predicted asbestos)
- [ ] Setup model monitoring and logging
- [ ] Optimize batch prediction performance
- [ ] Document ML service API

---

## T+12 to T+18 hours: Polish & Integration

### Backend Developer
- [ ] Review and optimize all database queries
- [ ] Add comprehensive error messages
- [ ] Implement request logging
- [ ] Add OpenAPI documentation generation
- [ ] Setup environment-specific configs (dev/prod)
- [ ] Add database seeding with real sample data
- [ ] Performance testing with large bbox queries
- [ ] Security review (input validation, SQL injection prevention)

### Frontend Developer
- [ ] Responsive design improvements (mobile support)
- [ ] Accessibility improvements (keyboard navigation, ARIA labels)
- [ ] Add legend explaining color codes
- [ ] Implement zoom-to-building feature
- [ ] Add filter controls (show only asbestos, hide clean buildings, etc.)
- [ ] Improve map controls (zoom, reset view, fullscreen)
- [ ] Add toast notifications for user feedback
- [ ] Performance optimization (virtualization for many buildings)

### Data/ML Developer
- [ ] Run model evaluation on test dataset
- [ ] Generate performance metrics report
- [ ] Create visualization of model predictions vs. ground truth
- [ ] Document model architecture and training process
- [ ] Prepare model deployment documentation
- [ ] Create fallback strategy documentation

---

## T+18 to T+24 hours: Demo Preparation & Testing

### All Team Members
- [ ] End-to-end testing of complete workflow
- [ ] Bug fixing and edge case handling
- [ ] Prepare demo scenario (select interesting area with mixed results)
- [ ] Create demo script and talking points
- [ ] Prepare presentation slides (problem, solution, tech stack, results)
- [ ] Record demo video as backup
- [ ] Update README with setup instructions
- [ ] Add screenshots to documentation
- [ ] Cleanup code and remove debug statements
- [ ] Final deployment check

### Backend
- [ ] Load testing with realistic data volumes
- [ ] Monitoring setup (if deploying to cloud)
- [ ] Backup/restore procedures documented

### Frontend
- [ ] Browser compatibility testing (Chrome, Firefox, Safari)
- [ ] Performance profiling and optimization
- [ ] Final UI polish and consistency check

### Data/ML
- [ ] Prepare model performance summary
- [ ] Create comparison: ML predictions vs. database records
- [ ] Document future improvements and model limitations

---

## Critical Dependencies

1. **Mapbox API Key**: Required for geocoding (get from https://www.mapbox.com/)
2. **Asbestos Database Integration**: Must integrate actual logic from packages/PreviewLeszno
3. **Python ML Service**: Backend depends on ML service being available (can use mock temporarily)
4. **MySQL Running**: All backend operations require database

---

## Success Criteria

- ✅ User can select area on map and see buildings
- ✅ Buildings are color-coded by asbestos status
- ✅ Statistics are displayed accurately
- ⏳ Asbestos database check works (integrate PreviewLeszno)
- ⏳ ML predictions are reasonable (depends on ML model quality)
- ⏳ Address search and map navigation works
- ⏳ System handles errors gracefully
- ⏳ Performance is acceptable for typical queries (<5 seconds)
- ⏳ Demo is ready and polished

---

## Next Immediate Actions

1. **Run pnpm install** in project root
2. **Start MySQL**: `pnpm docker:up`
3. **Setup database**: `cd packages/database && pnpm generate && pnpm migrate`
4. **Start backend**: `pnpm dev:backend`
5. **Start frontend**: `pnpm dev:frontend`
6. **Test**: Draw bbox on map at http://localhost:3000
7. **Integrate PreviewLeszno asbestos check** into AsbestosCheckService
8. **Setup Python ML service** (create new package or separate repo)
9. **Get Mapbox API key** and add to backend .env
