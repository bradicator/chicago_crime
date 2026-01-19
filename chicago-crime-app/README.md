# Chicago Crime Analysis Application

A full-stack web application for analyzing Chicago Police Department incident data. Explore crime patterns by location, time, and type through an interactive interface with maps, charts, and tables.

## Features

- **Location-based search**: Enter an address, coordinates, or click on the map
- **Flexible filtering**: Radius (0.25-5 miles), date range presets and custom, event type multi-select
- **KPI dashboard**: Total incidents, incidents/day, top types, arrest rate
- **Interactive map**: Clustered markers with popups showing incident details
- **Charts**: Time series, top types bar chart, day/hour heatmap
- **Tables**: Type breakdown, day/hour pivot, sortable recent incidents
- **CSV export**: Download filtered results

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Clone and Setup

```bash
cd chicago-crime-app
```

### 2. Backend Setup

```bash
# Create virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure data source (choose one):

# Option A: Set environment variable pointing to your CSV file(s)
export CSV_PATH=/path/to/your/crime/data.csv
# Or point to a directory containing multiple CSV files:
export CSV_PATH=/path/to/your/crime/data/

# Option B: Create .env file
cp .env.example .env
# Edit .env and set CSV_PATH

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000 with docs at http://localhost:8000/docs

### 3. Frontend Setup

```bash
# In a new terminal
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:5173

### 4. Upload Data (Alternative)

If you didn't set `CSV_PATH`, you can upload CSV files through the UI:
1. Open http://localhost:5173
2. Click "Upload CSV" in the header
3. Select your Chicago crime data CSV file

## Project Structure

```
chicago-crime-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI application
│   │   ├── config.py        # Configuration
│   │   ├── database.py      # DuckDB integration
│   │   ├── models.py        # Pydantic models
│   │   ├── routes/
│   │   │   ├── incidents.py # Incident API endpoints
│   │   │   └── geocoding.py # Address geocoding
│   │   └── utils/
│   │       └── geo.py       # Geographic calculations
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── api/             # API client
│   │   ├── App.jsx          # Main application
│   │   └── main.jsx         # Entry point
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── ARCHITECTURE.md      # System design
│   └── ADAPTING_CSV.md      # CSV adaptation guide
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/health` | GET | Health check with database status |
| `GET /api/incidents/types` | GET | List all incident types |
| `POST /api/incidents/search` | POST | Search incidents by location/filters |
| `POST /api/incidents/stats` | POST | Get aggregated statistics |
| `POST /api/incidents/export` | POST | Export filtered data as CSV |
| `GET /api/geocode` | GET | Convert address to coordinates |
| `POST /api/upload` | POST | Upload new CSV file |

## Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CSV_PATH` | (empty) | Path to CSV file or directory |
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8000 | Server port |
| `DEBUG` | false | Enable debug mode |
| `CORS_ORIGINS` | localhost:5173,3000 | Allowed CORS origins |
| `MAX_UPLOAD_SIZE_MB` | 100 | Maximum upload file size |
| `MAX_RESULTS` | 5000 | Maximum incidents returned |
| `MAX_EXPORT_ROWS` | 100000 | Maximum export rows |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | /api | API base URL |

## Expected CSV Format

The application expects Chicago crime data with these columns:

| Column | Required | Description |
|--------|----------|-------------|
| ID | Yes | Unique identifier |
| Date | Yes | Incident date/time (MM/DD/YYYY HH:MM:SS AM/PM) |
| Primary Type | Yes | Crime category (e.g., THEFT, BATTERY) |
| Latitude | Yes | Latitude coordinate |
| Longitude | Yes | Longitude coordinate |
| Case Number | No | Police case number |
| Block | No | Street address block |
| IUCR | No | Illinois Uniform Crime Reporting code |
| Description | No | Detailed description |
| Location Description | No | Location type (e.g., STREET, APARTMENT) |
| Arrest | No | Whether arrest was made (true/false) |
| Domestic | No | Whether domestic-related (true/false) |
| Beat | No | Police beat |
| District | No | Police district |
| Ward | No | City ward |
| Community Area | No | Community area number |

For adapting to different CSV formats, see [docs/ADAPTING_CSV.md](docs/ADAPTING_CSV.md).

## Performance

- **DuckDB** provides fast analytical queries on 700K+ rows
- **Bounding box pre-filter** speeds up radius queries 10x
- **React Query** caches API responses
- **Marker clustering** handles thousands of map points
- Typical query time: 50-150ms for 500K rows

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **DuckDB**: Embedded analytical database
- **Pydantic**: Data validation
- **httpx**: Async HTTP client for geocoding

### Frontend
- **React 18**: UI framework
- **Vite**: Build tool
- **Leaflet**: Maps
- **Recharts**: Charts
- **TanStack Query**: Data fetching
- **Tailwind CSS**: Styling

## License

MIT
