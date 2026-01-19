# How to Adapt to a Different CSV Schema

This guide explains how to modify the application to work with crime data from different sources or formats.

## Overview

The application's data layer is centralized in `backend/app/database.py`. To adapt to a new CSV schema, you'll primarily modify the `_load_csv()` method and potentially the `models.py` file.

## Step-by-Step Guide

### 1. Identify Your Schema

First, examine your CSV file to understand its structure:

```bash
head -1 your_data.csv  # View column headers
head -5 your_data.csv  # View sample rows
```

Document the mapping between your columns and required fields:

| Required Field | Your Column | Notes |
|----------------|-------------|-------|
| id | ? | Unique identifier |
| date/time | ? | Incident timestamp |
| latitude | ? | Decimal degrees |
| longitude | ? | Decimal degrees |
| primary_type | ? | Crime category |

### 2. Modify the CSV Loading Logic

Edit `backend/app/database.py`, specifically the `_load_csv()` method:

```python
def _load_csv(self, path: Path) -> tuple[int, int, list[str]]:
    """Load a CSV file into the database."""

    # Modify this SQL to match YOUR column names
    self.conn.execute(f"""
        INSERT INTO incidents
        SELECT
            -- Map your columns to the expected schema
            CAST("YourIDColumn" AS VARCHAR) as id,
            "YourCaseColumn" as case_number,

            -- Date parsing - adjust format string as needed
            -- Common formats:
            -- '%m/%d/%Y %I:%M:%S %p' = 12/31/2024 11:58:00 PM
            -- '%Y-%m-%d %H:%M:%S' = 2024-12-31 23:58:00
            -- '%Y-%m-%dT%H:%M:%S' = 2024-12-31T23:58:00
            strptime("YourDateColumn", '%Y-%m-%d %H:%M:%S') as incident_date,

            "YourAddressColumn" as block,
            NULL as iucr,  -- Set to NULL if you don't have this
            UPPER(TRIM("YourCrimeTypeColumn")) as primary_type,
            "YourDescriptionColumn" as description,
            "YourLocationTypeColumn" as location_description,

            -- Boolean parsing - adjust based on your values
            CASE
                WHEN LOWER("YourArrestColumn") IN ('true', '1', 'yes', 'y')
                THEN true ELSE false
            END as arrest,
            false as domestic,  -- Set to false if you don't have this

            NULL as beat,
            NULL as district,
            NULL as ward,
            NULL as community_area,

            -- Coordinate columns - direct cast if already decimal
            TRY_CAST("YourLatColumn" AS DOUBLE) as latitude,
            TRY_CAST("YourLonColumn" AS DOUBLE) as longitude,

            YEAR(strptime("YourDateColumn", '%Y-%m-%d %H:%M:%S')) as year

        FROM read_csv('{path}', header=true, ignore_errors=true)
        WHERE
            "YourLatColumn" IS NOT NULL
            AND "YourLonColumn" IS NOT NULL
            -- Adjust bounding box for YOUR city
            AND TRY_CAST("YourLatColumn" AS DOUBLE) BETWEEN 41.6 AND 42.1
            AND TRY_CAST("YourLonColumn" AS DOUBLE) BETWEEN -87.95 AND -87.5
            AND "YourDateColumn" IS NOT NULL
        ON CONFLICT (id) DO NOTHING
    """)
```

### 3. Update City Bounds

If your data is from a different city, update the bounds in `backend/app/config.py`:

```python
class Settings(BaseSettings):
    # Example: New York City bounds
    chicago_lat_min: float = 40.4774  # Rename to your_city_lat_min
    chicago_lat_max: float = 40.9176
    chicago_lon_min: float = -74.2591
    chicago_lon_max: float = -73.7004
```

Also update `backend/app/models.py` to match these bounds in the Pydantic validators.

### 4. Update Geocoding Bias

If using a different city, update `backend/app/routes/geocoding.py`:

```python
@router.get("/geocode")
async def geocode_address(address: str) -> GeocodeResponse:
    # Change the city bias
    if "new york" not in address.lower():
        search_query = f"{address}, New York, NY"
    else:
        search_query = address

    # Update the viewbox to your city's bounds
    response = await client.get(
        NOMINATIM_URL,
        params={
            "viewbox": "-74.2591,40.9176,-73.7004,40.4774",
            "bounded": 1,
            ...
        }
    )
```

### 5. Common Schema Variations

#### Coordinates as X/Y (State Plane)

If your data has X/Y coordinates instead of lat/lon, you'll need to convert them. DuckDB doesn't have built-in projection support, so you have two options:

**Option A: Pre-process the CSV**
```python
import pandas as pd
from pyproj import Transformer

# Example: Illinois State Plane East (EPSG:3435) to WGS84
transformer = Transformer.from_crs("EPSG:3435", "EPSG:4326", always_xy=True)

df = pd.read_csv('your_data.csv')
df['longitude'], df['latitude'] = transformer.transform(
    df['x_coordinate'].values,
    df['y_coordinate'].values
)
df.to_csv('your_data_with_latlon.csv', index=False)
```

**Option B: Add conversion in the load query (slower)**
See the DuckDB spatial extension documentation.

#### Date in Separate Columns

If date and time are in separate columns:

```sql
strptime(CONCAT("DateColumn", ' ', "TimeColumn"), '%m/%d/%Y %H:%M:%S') as incident_date
```

#### Multiple Crime Type Columns

If you have both a category and subcategory:

```sql
UPPER(TRIM(CONCAT("Category", ' - ', "Subcategory"))) as primary_type,
-- OR use just the category:
UPPER(TRIM("Category")) as primary_type,
"Subcategory" as description
```

### 6. Testing Your Changes

After modifying the loading logic:

1. Clear any existing data:
```python
# In Python REPL
import duckdb
conn = duckdb.connect(':memory:')
# Test your query directly
```

2. Start the backend with debug logging:
```bash
DEBUG=true uvicorn app.main:app --reload
```

3. Check the health endpoint:
```bash
curl http://localhost:8000/api/health
```

4. Verify data loaded:
```bash
curl http://localhost:8000/api/incidents/types
```

### 7. Example: LAPD Crime Data

Here's an example adaptation for Los Angeles Police Department data:

```python
# LAPD crime data has different column names
self.conn.execute(f"""
    INSERT INTO incidents
    SELECT
        CAST("DR_NO" AS VARCHAR) as id,
        CAST("DR_NO" AS VARCHAR) as case_number,
        strptime("DATE OCC" || ' ' || LPAD(CAST("TIME OCC" AS VARCHAR), 4, '0'),
                 '%m/%d/%Y %H%M') as incident_date,
        "LOCATION" as block,
        NULL as iucr,
        UPPER(TRIM("Crm Cd Desc")) as primary_type,
        "Crm Cd Desc" as description,
        "Premis Desc" as location_description,
        false as arrest,
        false as domestic,
        CAST("AREA" AS VARCHAR) as beat,
        CAST("AREA NAME" AS VARCHAR) as district,
        NULL as ward,
        NULL as community_area,
        TRY_CAST("LAT" AS DOUBLE) as latitude,
        TRY_CAST("LON" AS DOUBLE) as longitude,
        YEAR(strptime("DATE OCC", '%m/%d/%Y')) as year
    FROM read_csv('{path}', header=true, ignore_errors=true)
    WHERE
        "LAT" IS NOT NULL AND "LAT" != 0
        AND "LON" IS NOT NULL AND "LON" != 0
        AND TRY_CAST("LAT" AS DOUBLE) BETWEEN 33.7 AND 34.4
        AND TRY_CAST("LON" AS DOUBLE) BETWEEN -118.7 AND -118.1
    ON CONFLICT (id) DO NOTHING
""")
```

### 8. Adding New Fields

If your data has useful fields not in the current schema:

1. Add the column to the `incidents` table in `database.py`:
```python
self.conn.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        ...
        your_new_field VARCHAR,
        ...
    )
""")
```

2. Add to the Pydantic model in `models.py`:
```python
class Incident(BaseModel):
    ...
    your_new_field: Optional[str] = None
```

3. Include in queries and API responses as needed.

## Troubleshooting

### "No records loaded"
- Check date format matches your `strptime` pattern
- Verify coordinate columns have valid numbers
- Check that coordinates fall within your bounding box

### "Invalid coordinates"
- Ensure lat/lon aren't swapped
- Check for 0,0 coordinates (filter them out)
- Verify coordinate system (must be WGS84 decimal degrees)

### "Date parsing errors"
- Test your date format with a sample value in DuckDB:
```sql
SELECT strptime('12/31/2024 11:58:00 PM', '%m/%d/%Y %I:%M:%S %p')
```

### Performance issues
- Add `ignore_errors=true` to skip bad rows
- Consider loading a subset first for testing
- Check if your CSV has very wide rows (many unused columns)
