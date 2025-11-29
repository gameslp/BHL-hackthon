# Asbestos Detection Application - Technical Summary

## Overview
Web application designed to help government officials identify buildings with asbestos roofs by combining machine learning predictions with official asbestos database records. The system provides an interactive map interface for searching specific geographic areas and visualizing buildings based on their asbestos status.

## Core Functionality
The application allows users to select rectangular areas on an interactive map. When a region is selected, the system queries OpenStreetMap's Overpass API to fetch all buildings within the bounding box. Each building is processed through multiple checks:

1. **Database lookup**: Checks if building already exists in local cache
2. **Asbestos database verification**: Queries official asbestos registry (integrates with existing PreviewLeszno scripts)
3. **ML prediction**: Calls Python ML service to predict potential asbestos presence based on building characteristics
4. **Storage**: Saves processed buildings to MySQL database for future queries

Buildings are displayed on the map with color coding: red for confirmed asbestos, orange for ML-predicted potential asbestos, green for clean buildings, and gray for unknown status.

## Technical Architecture

### Backend (Node.js + Express + Prisma)
- RESTful API with three main endpoints: `/bbox` (query area), `/buildings/:id` (get details), `/geocode` (address search)
- Service-oriented architecture separating concerns: OverpassService (OSM data), AsbestosCheckService (database verification), MLService (Python ML integration), GeocodingService (Mapbox address search)
- Unified error handling and response formatting with Zod validation middleware
- Prisma ORM with MySQL for persistent storage, caching processed buildings with spatial indexing

### Frontend (Next.js + React Query + Leaflet)
- Interactive Leaflet map with building polygons rendered as colored overlays
- React Query for data fetching, caching, and state management
- Dynamic component loading to avoid SSR issues with Leaflet
- Real-time statistics panel showing counts by asbestos status
- Address search capability for quick navigation

### Database Schema
Single `Building` model storing: polygon coordinates (JSON), centroid (separated lng/lat for spatial queries), asbestos status flags, and timestamps. Indexed on centroid coordinates and status fields for efficient querying.

### External Integrations
- OpenStreetMap Overpass API for building geometry
- Existing asbestos database check (from PreviewLeszno package)
- Python ML service (HTTP endpoint, mocked during development)
- Mapbox Geocoding API for address search

## Data Flow
User selects area → Frontend sends bbox request → Backend queries Overpass API → For each building: check local DB → if new: verify asbestos status + call ML service → save to DB → return all buildings with statistics → Frontend renders colored polygons on map.

## Key Design Decisions
- Prisma types as single source of truth (no duplication with Zod)
- Zod only for HTTP request/response validation
- pnpm workspaces monorepo for shared types and validation
- Spatial proximity matching (~0.0001 degree tolerance) to identify duplicate buildings
- Client-side caching with React Query to minimize redundant API calls
- Graceful degradation when ML service unavailable (returns null for isPotentiallyAsbestos)
