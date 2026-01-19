# Chicago Crime Analysis Application - Architecture Overview

## System Overview

This application provides interactive analysis of Chicago Police Department incident data. Users can explore crime patterns by location, time, and type through an intuitive web interface with maps, charts, and tables.

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CSV File(s)   │────▶│  DuckDB Engine  │────▶│   FastAPI API   │
│  (Local/Upload) │     │  (In-Memory DB) │     │   (Backend)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   React + Vite  │◀────│   REST API      │
                        │   (Frontend)    │     │   JSON Response │
                        └─────────────────┘     └─────────────────┘
```

## Key Components

### Backend (FastAPI + DuckDB)

**Technology Choices:**
- **FastAPI**: Modern, fast Python web framework with automatic OpenAPI docs, async support, and excellent type validation via Pydantic
- **DuckDB**: Embedded analytical database optimized for OLAP queries. Chosen over SQLite because:
  - 10-100x faster for analytical queries (aggregations, filters, grouping)
  - Columnar storage is ideal for filtering large datasets
  - Native CSV import with automatic type inference
  - Zero configuration, runs in-process

**Core Modules:**
1. `main.py` - FastAPI application entry point, CORS config, route registration
2. `database.py` - DuckDB connection management, CSV loading, schema validation
3. `models.py` - Pydantic models for request/response validation
4. `routes/incidents.py` - API endpoints for incident queries
5. `routes/geocoding.py` - Address-to-coordinates conversion
6. `utils/geo.py` - Haversine distance calculations, bounding box queries

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/incidents/search` | POST | Filter incidents by location, radius, date range, types |
| `/api/incidents/types` | GET | List all unique primary types |
| `/api/incidents/stats` | POST | Aggregated statistics for filters |
| `/api/incidents/export` | POST | Download filtered results as CSV |
| `/api/geocode` | GET | Convert address to lat/lon (uses Nominatim) |
| `/api/health` | GET | Health check endpoint |
| `/api/upload` | POST | Upload new CSV file |

### Frontend (React + Vite)

**Technology Choices:**
- **Vite**: Fast dev server with HMR, optimized production builds
- **React 18**: Component-based UI with hooks
- **Leaflet + react-leaflet**: Open-source mapping (no API key required)
- **Recharts**: Composable charting library built on D3
- **TanStack Query**: Data fetching with caching and background updates
- **Tailwind CSS**: Utility-first styling for rapid development

**Component Architecture:**
```
App
├── Header (logo, upload button)
├── Sidebar
│   ├── LocationSearch (address input, geocoding)
│   ├── MapLocationPicker (click-to-select)
│   ├── FilterPanel
│   │   ├── RadiusSelector
│   │   ├── DateRangeFilter
│   │   └── TypeMultiSelect
│   └── KPICards (total, per day, top types)
├── MainContent
│   ├── MapView
│   │   ├── IncidentMarkers (clustered)
│   │   └── RadiusCircle
│   ├── ChartsPanel
│   │   ├── TimeSeriesChart
│   │   ├── TopTypesBarChart
│   │   └── DayHourHeatmap
│   └── TablesPanel
│       ├── TypeBreakdownTable
│       ├── DayHourPivotTable
│       └── RecentIncidentsTable
└── ExportButton
```

### Data Processing Pipeline

**On Startup / CSV Load:**
1. Read CSV file(s) from configured path or uploaded file
2. Parse and validate each row:
   - Convert date strings to timestamps
   - Validate lat/lon ranges (Chicago: ~41.6-42.1 lat, -87.9 to -87.5 lon)
   - Handle missing values (skip rows without valid coordinates)
   - Normalize string fields (trim whitespace, uppercase types)
3. Load into DuckDB with optimized column types
4. Create spatial index (bounding box pre-filter)

**On Query:**
1. Apply bounding box filter (fast, uses index)
2. Apply precise Haversine distance filter
3. Apply date range filter
4. Apply type filter
5. Aggregate and return results

## Key Design Decisions

### 1. DuckDB for Analytics
Standard SQLite would work but DuckDB provides:
- Native analytical functions (percentiles, window functions)
- Parallel query execution
- Better performance for GROUP BY and aggregations
- Direct CSV querying capability

### 2. Bounding Box + Haversine
For radius queries, we first filter by a bounding box (fast, uses indexes), then apply precise Haversine distance calculation. This is 10x faster than calculating distance for every row.

### 3. Leaflet over Mapbox
- No API key required
- Free and open-source
- Sufficient for this use case
- Easy clustering with leaflet.markercluster

### 4. Server-Side Aggregation
All heavy computations (aggregations, pivots) happen on the backend. The frontend only receives pre-computed results. This keeps the UI responsive even with 700K+ rows.

### 5. Configurable CSV Path
The application supports:
- Environment variable `CSV_PATH` pointing to a file or directory
- Runtime CSV upload via UI
- Multiple CSV files (automatically merged)

## Performance Considerations

| Dataset Size | Expected Query Time | Notes |
|--------------|---------------------|-------|
| 100K rows | <50ms | Instant feel |
| 500K rows | <150ms | Acceptable |
| 1M rows | <300ms | May need loading indicator |

**Optimizations Applied:**
- Bounding box pre-filter before distance calculation
- DuckDB columnar storage with compression
- Query result pagination (map shows max 5000 points)
- Aggregations computed server-side
- React Query caching on frontend

## Security Considerations

1. **Input Validation**: All inputs validated via Pydantic models
2. **SQL Injection**: DuckDB parameterized queries only
3. **File Upload**: CSV files validated, size limited (100MB default)
4. **CORS**: Configurable allowed origins
5. **Rate Limiting**: Optional, can be enabled via middleware
6. **No Secrets**: All configuration via environment variables

## Deployment Options

**Development:**
- Backend: `uvicorn main:app --reload`
- Frontend: `npm run dev`

**Production:**
- Backend: Docker container with gunicorn + uvicorn workers
- Frontend: Static build served via nginx or CDN
- Can be combined into single Docker container

## File Structure

```
chicago-crime-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── incidents.py
│   │   │   └── geocoding.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── geo.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── ARCHITECTURE.md
│   └── ADAPTING_CSV.md
└── README.md
```
