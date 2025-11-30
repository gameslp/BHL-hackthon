# 🏗️ System Detekcji Azbestu - Dokumentacja Projektu

## 📋 Opis Rozwiązania

**Aplikacja webowa wspierająca urzędników w identyfikacji budynków z dachami azbestowymi** poprzez inteligentne połączenie oficjalnej bazy azbestowej z predykcją opartą o uczenie maszynowe.

### Problem
Brak narzędzi do efektywnego mapowania budynków z azbestem na dużych obszarach. Ręczna analiza jest czasochłonna i nieefektywna dla całych gmin.

### Rozwiązanie
Interaktywna mapa pozwalająca na automatyczne skanowanie obszarów z:
- ✅ Weryfikacją w oficjalnej bazie azbestowej (gov.pl)
- ✅ Predykcją ML dla budynków nieznanych
- ✅ Wizualizacją kolorystyczną (czerwony=azbest, pomarańczowy=ML, zielony=czysty)
- ✅ Statystykami i exportem do PDF

---

## 🏛️ Architektura Systemu

### Architektura High-Level

```
┌─────────────────┐                          ┌──────────────────┐
│   Frontend      │     REST API (JSON)      │   Backend        │
│   Next.js 16    │ ◄──────────────────────► │   Express.js     │
│   (React)       │      HTTP/HTTPS          │   (Node.js)      │
└─────────────────┘                          └──────────────────┘
      │                                             │
      │                             ┌───────────────┼────────────────┐
      │                             │               │                │
      ▼                       ┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼──────┐
┌─────────────┐               │   MySQL   │  │  Python ML  │  │  External  │
│   Mapbox    │               │ Database  │  │   Service   │  │    APIs    │
│  (Tiles)    │               │ (Prisma)  │  │   (ONNX)    │  │            │
└─────────────┘               └───────────┘  └─────────────┘  └────────────┘
                                                                     │
                                                      ┌──────────────┼──────────┐
                                                      │              │          │
                                                 Overpass API   Baza Azbestowa  Mapbox
                                                 (budynki OSM)  (WMS GeoServer) (geocoding)
```

### Monorepo (pnpm workspaces)
```
packages/
├── database/       # Prisma schema + MySQL client (source of truth typów)
├── validation/     # Zod schemas (HTTP request/response validation)
├── backend/        # Express API + business logic
└── frontend/       # Next.js App Router + Leaflet map
```

**Filozofia typów:**
- **Prisma Client** = source of truth dla entity types
- **Zod** = runtime validation HTTP layer
- **OpenAPI 3.0** = kontrakt API → auto-generated client (hey-api)

---

## 🔧 Wykorzystane Technologie i Zasoby

### Stack Technologiczny

| Warstwa | Technologia | Wersja | Uzasadnienie |
|---------|-------------|--------|--------------|
| **Backend Runtime** | Node.js | 20 LTS | Stabilna, long-term support |
| **Backend Framework** | Express.js | 4.18 | Minimalistyczny, szybki setup |
| **Database** | MySQL | 8.0 | Relacyjna + spatial indexes |
| **ORM** | Prisma | 5.x | Type-safe queries, migracje |
| **Validation** | Zod | 3.22 | Runtime + compile-time safety |
| **Frontend Framework** | Next.js | 16 | App Router, RSC, SSR |
| **State Management** | React Query | 5.x | Cache, optimistic updates |
| **Map Engine** | Leaflet | 1.9 | Open-source, lightweight |
| **Styling** | Tailwind CSS | 4.x | Utility-first, rapid dev |
| **ML Runtime** | Python FastAPI + ONNX | - | Szybki inference modeli ML |

### Zasoby Zewnętrzne

#### 1. **OpenStreetMap Overpass API**
**Endpoint:** `https://overpass-api.de/api/interpreter`
**Cel:** Pobieranie geometrii budynków (polygon coordinates)
**Integracja:**
- Query: `way["building"](bbox)`
- Format: JSON (GeoJSON-compatible)
- Limit: Rate limiting → caching w MySQL

**Przykład zapytania:**
```xml
[out:json][timeout:25];
way["building"](52.12,20.47,52.13,20.48);
out geom;
```

#### 2. **Baza Azbestowa (GeoServer WMS)**
**Endpoint:** `https://esip.bazaazbestowa.gov.pl/GeoServerProxy`
**Cel:** Weryfikacja czy budynek znajduje się w oficjalnej bazie azbestowej
**Metoda:** WMS GetMap
**Integracja:**
- Fetch WMS layer dla bbox budynku
- Analiza pikseli koloru azbestu (`#2c8900` ± tolerance)
- Point-in-polygon check (piksele vs. geometria budynku)
- Wynik: `isAsbestos: boolean`

**Parametry WMS:**
```
LAYERS=budynki_z_azbestem
FORMAT=image/png
BBOX={minLon},{minLat},{maxLon},{maxLat}
```

#### 3. **Mapbox Geocoding API**
**Endpoint:** `https://api.mapbox.com/geocoding/v5/`
**Cel:**
- Forward geocoding (adres → współrzędne)
- Batch reverse geocoding (współrzędne → adresy)

**Features:**
- `/mapbox.places/{query}.json` - wyszukiwanie miejsc
- `/mapbox.places-permanent/{lng},{lat}.json` - reverse geocoding
- Batch API (max 1000 coordinates/request)

**Wykorzystanie:**
- Wyszukiwanie adresów w UI
- Automatyczne pobieranie adresów dla budynków (batch)

#### 4. **Python ML Service (Custom)**
**Port:** `8000` (FastAPI)
**Model:** ONNX Runtime (asbestos_net.onnx)
**Endpoint:** `POST /predict`

**Input:**
```json
{
  "polygon": [[20.471, 52.123], [20.472, 52.124], ...]
}
```

**Output:**
```json
{
  "isPotentiallyAsbestos": true | false | null
}
```

**Timeout:** 5s (fallback do null przy błędzie)

---

## 💾 Model Danych

### Prisma Schema

```prisma
model Building {
  id        String   @id @default(cuid())

  // Geometria budynku
  polygon     Json      // Array[[lng, lat], ...] - GeoJSON compatible
  centroidLng Float     // Centroid dla spatial queries
  centroidLat Float

  // Status azbestu
  isAsbestos            Boolean   // Z oficjalnej bazy azbestowej
  isPotentiallyAsbestos Boolean?  // Predykcja ML (null = nie sprawdzono)

  // Metadane
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indeksy dla wydajności
  @@index([centroidLng, centroidLat])  // Spatial bbox queries
  @@index([isAsbestos])
  @@index([isPotentiallyAsbestos])
  @@index([updatedAt])
}
```

**Optymalizacje:**
- **Spatial indexes** na centroid → szybkie bbox queries (<100ms)
- **Deduplikacja** budynków (tolerance 0.0001° = ~11m)
- **Connection pooling** (10 connections)
- **Prepared statements** (Prisma ORM)

---

## 🔄 Przepływ Danych (User Flow)

### Scenariusz: Użytkownik skanuje obszar na mapie

```
1. USER: Zaznacza prostokąt na mapie (leaflet-draw)
           ↓
2. FRONTEND: POST /api/bbox { ne: {lat,lng}, sw: {lat,lng} }
           ↓
3. BACKEND: Sprawdza cache w MySQL
   ├─ Budynek istnieje → zwróć z bazy (FAST PATH)
   └─ Budynek nowy → wykonaj kroki 4-6 (SLOW PATH)
           ↓
4. OVERPASS API: Pobierz geometrie budynków w bbox
   - Request: Overpass QL query
   - Response: Array of building polygons
           ↓
5. BAZA AZBESTOWA: Dla każdego budynku
   - Fetch WMS tile dla bbox budynku
   - Analiza pikseli (#2c8900)
   - Point-in-polygon → isAsbestos: boolean
           ↓
6. ML SERVICE: Dla budynków bez azbestu
   - POST /predict z polygon
   - Response: isPotentiallyAsbestos: boolean | null
   - Timeout: 5s → null
           ↓
7. SAVE TO MYSQL: Zapisz wszystkie budynki
           ↓
8. RESPONSE: Zwróć { buildings[], stats }
           ↓
9. FRONTEND: Renderuj
   - Budynki na mapie (kolorowane wg statusu)
   - Panel statystyk (total, azbest, potencjalny, czysty)
   - Export PDF (jsPDF + autoTable)
```

**Performance:**
- Cache hit: **<100ms**
- New area (50 buildings): **5-10s**
- ML prediction: **<5s** (z timeoutem)

---

## 🎯 Kluczowe Funkcjonalności

### 1. Interaktywna Mapa (Leaflet)
- **Rectangle drawing:** Zaznaczanie obszarów do skanowania
- **Validation:** Max ~2km × 2km (0.01 deg² bbox area)
- **Color coding:**
  - 🔴 **Czerwony:** `isAsbestos = true` (oficjalna baza)
  - 🟠 **Pomarańczowy:** `isPotentiallyAsbestos = true` (ML)
  - 🟢 **Zielony:** clean (obie false)
  - ⚪ **Szary:** unknown (ML nie sprawdził)
- **Popups:** Szczegóły budynku (status, adres, ID)

### 2. Panel Statystyk
- **Liczniki:** Total / Azbest / Potencjalny / Czysty / Nieznany
- **Wykres kołowy:** Recharts visualization
- **Export PDF:** jsPDF + autoTable (raport z statystykami)

### 3. Wyszukiwanie Adresów
- **Forward geocoding:** Wpisz adres → przenieś mapę
- **Batch reverse:** Automatyczne adresy dla budynków
- **Debounced search:** 500ms delay

### 4. Optymalizacje UX
- **React Query cache:** 60s (minimalizacja API calls)
- **Optimistic updates:** UI update przed API response
- **Loading states:** Szkielety, spinnery
- **Error handling:** Toast notifications (react-hot-toast)

---

## 🚀 Deployment & Infrastructure

### Docker Compose (Production)

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports: ["3030:3030"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
      MAPBOX_ACCESS_TOKEN: ${MAPBOX_TOKEN}
      ML_SERVICE_URL: http://ml-service:8000

  frontend:
    build:
      dockerfile: docker/frontend.Dockerfile
    ports: ["3031:3031"]
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3030/api

  ml-service:
    build: ./packages/ml-service
    ports: ["3032:8000"]
    volumes:
      - ./artifacts/asbestos_net.onnx:/app/model.onnx:ro

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
    volumes:
      - mysql_data:/var/lib/mysql
```

### Build Process
1. **Monorepo install:** `pnpm install` (workspace dependencies)
2. **Generate Prisma Client:** `prisma generate`
3. **Generate API Client:** `openapi-ts` (hey-api z spec)
4. **Build packages:** Backend (tsc) + Frontend (next build)
5. **Database migration:** `prisma migrate deploy`
6. **Multi-stage Docker:** Minimize image size

**Deployment targets:**
- Backend: `http://host:3030`
- Frontend: `http://host:3031`
- ML Service: `http://host:3032`

---

## 🔐 Bezpieczeństwo

| Warstwa | Implementacja |
|---------|---------------|
| **Input Validation** | Zod schemas (wszystkie endpointy) |
| **SQL Injection** | Prisma ORM (parameterized queries) |
| **XSS Protection** | React auto-escaping + Content Security Policy |
| **CORS** | Konfiguracja Express middleware |
| **Environment Variables** | `.env` files (gitignored) |
| **Type Safety** | TypeScript strict mode + Prisma types |
| **Error Handling** | Global middleware (unified format) |

**TODO dla produkcji:**
- [ ] Authentication (OAuth2/JWT)
- [ ] Rate limiting (Express middleware)
- [ ] HTTPS enforcement
- [ ] Logging (Winston/Pino)

---

## 📊 Metryki Projektu

### Techniczne
- **Packages:** 4 (database, validation, backend, frontend)
- **LOC Backend:** ~1,500 TypeScript
- **LOC Frontend:** ~2,000 TypeScript + React
- **API Endpoints:** 4 (bbox, building, geocode, batch-geocode)
- **Database Tables:** 1 (Building) + migrations
- **External APIs:** 4 (Overpass, Baza Azbestowa, Mapbox, ML)

### Performance
- **Cache hit query:** <100ms
- **New area scan (50 bldg):** 5-10s
- **ML inference:** <5s (per building)
- **Database connections:** 10 (pool)
- **Docker build time:** ~3 min (full)

---

## 💡 Innowacje i Wartość

### Kluczowe innowacje
1. **🧠 Hybrid Detection:** Oficjalna baza + ML = maksymalne pokrycie
2. **🚀 Smart Caching:** MySQL → zero duplikatów API calls
3. **🎨 Visual Clarity:** Kolorystyka (czerwony/pomarańczowy/zielony)
4. **📦 Monorepo + Type Safety:** Shared types → brak desynchronizacji
5. **🔗 Contract-First API:** OpenAPI → auto-generated client

### Wartość dla użytkownika końcowego
- **Automatyzacja:** Zamiast ręcznej analizy map
- **Szybkość:** Skanowanie 50 budynków w ~10s
- **Dokładność:** Oficjalna baza + ML validation
- **Raportowanie:** Export PDF dla urzędów
- **Skalowalność:** Cache → kolejne skanowania tego samego obszaru <100ms

---

## 📈 Możliwości Rozwoju

**Planowane funkcjonalności:**
- [ ] **Autentykacja:** OAuth2 dla urzędników
- [ ] **Role-based access:** Admin vs. Viewer
- [ ] **Historical tracking:** Timeline zmian statusu
- [ ] **Batch processing:** Async jobs dla dużych obszarów (całe gminy)
- [ ] **Real-time collaboration:** WebSockets (multi-user)
- [ ] **Advanced ML:** CNN na satellite imagery (wyższa dokładność)
- [ ] **Mobile app:** React Native wrapper
- [ ] **PWA:** Offline mode (Service Workers)

---

## 👥 Informacje o Projekcie

**Hackathon:** BHL 2025
**Timeline:** 24 godziny
**Tech Stack Decision:** Modern monorepo (Next.js + Prisma) dla production-grade MVP

**Dokumentacja techniczna:**
- OpenAPI Spec: `/spec/openapi.yaml`
- Prisma Schema: `/packages/database/prisma/schema.prisma`
- README: `/Readme.md`

---

_Dokumentacja projektu wygenerowana: 30.01.2025_
