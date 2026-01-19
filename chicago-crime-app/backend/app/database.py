"""DuckDB database management for crime data."""

import duckdb
import logging
from pathlib import Path
from datetime import datetime, date, timedelta
from typing import Optional, Any
import io

from .config import settings
from .utils.geo import get_bounding_box, haversine_sql

logger = logging.getLogger(__name__)


class CrimeDatabase:
    """Manages DuckDB connection and crime data queries."""

    def __init__(self):
        self.conn: Optional[duckdb.DuckDBPyConnection] = None
        self.total_records = 0
        self.date_range_start: Optional[date] = None
        self.date_range_end: Optional[date] = None
        self.primary_types: list[str] = []

    def initialize(self):
        """Initialize database connection and load data."""
        self.conn = duckdb.connect(":memory:")

        # Create the incidents table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id VARCHAR PRIMARY KEY,
                case_number VARCHAR,
                incident_date TIMESTAMP,
                block VARCHAR,
                iucr VARCHAR,
                primary_type VARCHAR,
                description VARCHAR,
                location_description VARCHAR,
                arrest BOOLEAN,
                domestic BOOLEAN,
                beat VARCHAR,
                district VARCHAR,
                ward INTEGER,
                community_area INTEGER,
                latitude DOUBLE,
                longitude DOUBLE,
                year INTEGER
            )
        """)

        # Load data from configured CSV path(s)
        csv_paths = settings.get_csv_paths()
        if csv_paths:
            for path in csv_paths:
                logger.info(f"Loading CSV: {path}")
                self._load_csv(path)

        self._update_metadata()
        logger.info(f"Database initialized with {self.total_records} records")

    def _load_csv(self, path: Path) -> tuple[int, int, list[str]]:
        """
        Load a CSV file into the database.

        Returns:
            Tuple of (records_loaded, records_skipped, warnings)
        """
        warnings = []
        records_before = self.total_records

        try:
            # Use DuckDB's CSV reader with error handling
            # DuckDB auto-parses dates, so we cast to timestamp
            self.conn.execute(f"""
                INSERT INTO incidents
                SELECT
                    CAST(ID AS VARCHAR) as id,
                    "Case Number" as case_number,
                    "Date"::TIMESTAMP as incident_date,
                    "Block" as block,
                    "IUCR" as iucr,
                    UPPER(TRIM("Primary Type")) as primary_type,
                    "Description" as description,
                    "Location Description" as location_description,
                    CASE WHEN LOWER(CAST(Arrest AS VARCHAR)) IN ('true', '1', 'yes') THEN true ELSE false END as arrest,
                    CASE WHEN LOWER(CAST(Domestic AS VARCHAR)) IN ('true', '1', 'yes') THEN true ELSE false END as domestic,
                    CAST(Beat AS VARCHAR) as beat,
                    CAST(District AS VARCHAR) as district,
                    TRY_CAST(Ward AS INTEGER) as ward,
                    TRY_CAST("Community Area" AS INTEGER) as community_area,
                    TRY_CAST(Latitude AS DOUBLE) as latitude,
                    TRY_CAST(Longitude AS DOUBLE) as longitude,
                    TRY_CAST(Year AS INTEGER) as year
                FROM read_csv_auto('{path}')
                WHERE
                    Latitude IS NOT NULL
                    AND Longitude IS NOT NULL
                    AND TRY_CAST(Latitude AS DOUBLE) BETWEEN {settings.chicago_lat_min} AND {settings.chicago_lat_max}
                    AND TRY_CAST(Longitude AS DOUBLE) BETWEEN {settings.chicago_lon_min} AND {settings.chicago_lon_max}
                    AND "Date" IS NOT NULL
                ON CONFLICT (id) DO NOTHING
            """)

            self.total_records = self.conn.execute(
                "SELECT COUNT(*) FROM incidents"
            ).fetchone()[0]

            records_loaded = self.total_records - records_before
            logger.info(f"Loaded {records_loaded} records from {path}")

        except Exception as e:
            logger.error(f"Error loading CSV {path}: {e}")
            warnings.append(f"Error loading {path}: {str(e)}")

        return (self.total_records - records_before, 0, warnings)

    def load_csv_from_content(self, content: bytes, filename: str) -> tuple[int, int, list[str]]:
        """Load CSV from uploaded file content."""
        warnings = []
        records_before = self.total_records

        try:
            # Save to temp file for DuckDB to read
            temp_path = Path(settings.upload_dir) / filename
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            temp_path.write_bytes(content)

            result = self._load_csv(temp_path)
            self._update_metadata()

            # Clean up temp file
            temp_path.unlink(missing_ok=True)

            return result

        except Exception as e:
            logger.error(f"Error loading uploaded CSV: {e}")
            return (0, 0, [str(e)])

    def _update_metadata(self):
        """Update cached metadata about the database."""
        if not self.conn:
            return

        self.total_records = self.conn.execute(
            "SELECT COUNT(*) FROM incidents"
        ).fetchone()[0]

        if self.total_records > 0:
            result = self.conn.execute("""
                SELECT
                    MIN(incident_date)::DATE,
                    MAX(incident_date)::DATE
                FROM incidents
            """).fetchone()
            self.date_range_start = result[0]
            self.date_range_end = result[1]

            self.primary_types = [
                row[0] for row in self.conn.execute(
                    "SELECT DISTINCT primary_type FROM incidents ORDER BY primary_type"
                ).fetchall()
            ]

    def get_date_range(
        self,
        date_from: Optional[date],
        date_to: Optional[date],
        preset: Optional[str]
    ) -> tuple[date, date]:
        """Calculate actual date range from inputs."""
        today = date.today()

        if preset and preset != "custom":
            if preset == "7d":
                return (today - timedelta(days=7), today)
            elif preset == "30d":
                return (today - timedelta(days=30), today)
            elif preset == "90d":
                return (today - timedelta(days=90), today)
            elif preset == "1y":
                return (today - timedelta(days=365), today)
            elif preset == "all":
                return (self.date_range_start or today - timedelta(days=365), today)

        return (
            date_from or (today - timedelta(days=30)),
            date_to or today
        )

    def search_incidents(
        self,
        lat: float,
        lon: float,
        radius: float,
        date_from: date,
        date_to: date,
        primary_types: Optional[list[str]] = None,
        limit: int = 5000,
        offset: int = 0
    ) -> tuple[list[dict], int]:
        """
        Search for incidents within radius of a point.

        Uses bounding box pre-filter for performance, then precise Haversine.
        """
        bbox = get_bounding_box(lat, lon, radius)
        haversine = haversine_sql()

        # Build type filter
        type_filter = ""
        if primary_types:
            types_list = ", ".join([f"'{t}'" for t in primary_types])
            type_filter = f"AND primary_type IN ({types_list})"

        # Count query
        count_sql = f"""
            SELECT COUNT(*) FROM incidents
            WHERE latitude BETWEEN {bbox[0]} AND {bbox[1]}
            AND longitude BETWEEN {bbox[2]} AND {bbox[3]}
            AND incident_date::DATE BETWEEN $date_from AND $date_to
            AND {haversine} <= $radius
            {type_filter}
        """

        total_count = self.conn.execute(
            count_sql,
            {"lat": lat, "lon": lon, "radius": radius, "date_from": date_from, "date_to": date_to}
        ).fetchone()[0]

        # Data query
        data_sql = f"""
            SELECT
                id,
                case_number,
                incident_date,
                block,
                iucr,
                primary_type,
                description,
                location_description,
                arrest,
                domestic,
                beat,
                district,
                ward,
                community_area,
                latitude,
                longitude,
                {haversine} as distance_miles
            FROM incidents
            WHERE latitude BETWEEN {bbox[0]} AND {bbox[1]}
            AND longitude BETWEEN {bbox[2]} AND {bbox[3]}
            AND incident_date::DATE BETWEEN $date_from AND $date_to
            AND {haversine} <= $radius
            {type_filter}
            ORDER BY incident_date DESC
            LIMIT {limit} OFFSET {offset}
        """

        rows = self.conn.execute(
            data_sql,
            {"lat": lat, "lon": lon, "radius": radius, "date_from": date_from, "date_to": date_to}
        ).fetchall()

        columns = [
            "id", "case_number", "date", "block", "iucr", "primary_type",
            "description", "location_description", "arrest", "domestic",
            "beat", "district", "ward", "community_area", "latitude",
            "longitude", "distance_miles"
        ]

        incidents = [dict(zip(columns, row)) for row in rows]

        return incidents, total_count

    def get_stats(
        self,
        lat: float,
        lon: float,
        radius: float,
        date_from: date,
        date_to: date,
        primary_types: Optional[list[str]] = None
    ) -> dict:
        """Get aggregated statistics for filtered data."""
        bbox = get_bounding_box(lat, lon, radius)
        haversine = haversine_sql()

        type_filter = ""
        if primary_types:
            types_list = ", ".join([f"'{t}'" for t in primary_types])
            type_filter = f"AND primary_type IN ({types_list})"

        base_filter = f"""
            WHERE latitude BETWEEN {bbox[0]} AND {bbox[1]}
            AND longitude BETWEEN {bbox[2]} AND {bbox[3]}
            AND incident_date::DATE BETWEEN $date_from AND $date_to
            AND {haversine} <= $radius
            {type_filter}
        """

        params = {"lat": lat, "lon": lon, "radius": radius, "date_from": date_from, "date_to": date_to}

        # KPI stats
        kpi_sql = f"""
            SELECT
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN arrest THEN 1 ELSE 0 END), 0) as arrests,
                COALESCE(SUM(CASE WHEN domestic THEN 1 ELSE 0 END), 0) as domestic
            FROM incidents
            {base_filter}
        """
        kpi_result = self.conn.execute(kpi_sql, params).fetchone()
        total = kpi_result[0] or 0
        arrests = kpi_result[1] or 0
        domestic = kpi_result[2] or 0

        days = (date_to - date_from).days + 1

        # By type
        type_sql = f"""
            SELECT
                primary_type,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
            FROM incidents
            {base_filter}
            GROUP BY primary_type
            ORDER BY count DESC
        """
        type_rows = self.conn.execute(type_sql, params).fetchall()
        by_type = [
            {"primary_type": row[0], "count": row[1], "percentage": row[2]}
            for row in type_rows
        ]

        # By day of week and hour
        day_hour_sql = f"""
            SELECT
                DAYOFWEEK(incident_date) as dow,
                CASE DAYOFWEEK(incident_date)
                    WHEN 0 THEN 'Sunday'
                    WHEN 1 THEN 'Monday'
                    WHEN 2 THEN 'Tuesday'
                    WHEN 3 THEN 'Wednesday'
                    WHEN 4 THEN 'Thursday'
                    WHEN 5 THEN 'Friday'
                    WHEN 6 THEN 'Saturday'
                END as day_name,
                HOUR(incident_date) as hour,
                COUNT(*) as count
            FROM incidents
            {base_filter}
            GROUP BY dow, day_name, hour
            ORDER BY dow, hour
        """
        day_hour_rows = self.conn.execute(day_hour_sql, params).fetchall()
        by_day_hour = [
            {"day_of_week": row[0], "day_name": row[1], "hour": row[2], "count": row[3]}
            for row in day_hour_rows
        ]

        # Daily time series
        daily_sql = f"""
            SELECT
                incident_date::DATE as date,
                COUNT(*) as count
            FROM incidents
            {base_filter}
            GROUP BY date
            ORDER BY date
        """
        daily_rows = self.conn.execute(daily_sql, params).fetchall()
        daily_counts = [
            {"date": row[0], "count": row[1]}
            for row in daily_rows
        ]

        # Quarterly time series
        quarterly_sql = f"""
            SELECT
                YEAR(incident_date) as year,
                QUARTER(incident_date) as quarter,
                COUNT(*) as count
            FROM incidents
            {base_filter}
            GROUP BY YEAR(incident_date), QUARTER(incident_date)
            ORDER BY YEAR(incident_date), QUARTER(incident_date)
        """
        quarterly_rows = self.conn.execute(quarterly_sql, params).fetchall()
        quarterly_counts = [
            {"year": row[0], "quarter": row[1], "count": row[2], "label": f"Q{row[1]} {row[0]}"}
            for row in quarterly_rows
        ]

        return {
            "kpi": {
                "total_incidents": total,
                "incidents_per_day": round(total / days, 2) if days > 0 else 0,
                "top_types": by_type[:3],
                "date_range_days": days,
                "arrests_count": arrests,
                "arrests_percentage": round(arrests * 100 / total, 2) if total > 0 else 0,
                "domestic_count": domestic,
            },
            "by_type": by_type,
            "by_day_hour": by_day_hour,
            "daily_counts": daily_counts,
            "quarterly_counts": quarterly_counts,
        }

    def export_csv(
        self,
        lat: float,
        lon: float,
        radius: float,
        date_from: date,
        date_to: date,
        primary_types: Optional[list[str]] = None
    ) -> str:
        """Export filtered incidents as CSV string."""
        bbox = get_bounding_box(lat, lon, radius)
        haversine = haversine_sql()

        type_filter = ""
        if primary_types:
            types_list = ", ".join([f"'{t}'" for t in primary_types])
            type_filter = f"AND primary_type IN ({types_list})"

        sql = f"""
            SELECT
                id as ID,
                case_number as "Case Number",
                incident_date as Date,
                block as Block,
                iucr as IUCR,
                primary_type as "Primary Type",
                description as Description,
                location_description as "Location Description",
                arrest as Arrest,
                domestic as Domestic,
                beat as Beat,
                district as District,
                ward as Ward,
                community_area as "Community Area",
                latitude as Latitude,
                longitude as Longitude,
                {haversine} as "Distance (miles)"
            FROM incidents
            WHERE latitude BETWEEN {bbox[0]} AND {bbox[1]}
            AND longitude BETWEEN {bbox[2]} AND {bbox[3]}
            AND incident_date::DATE BETWEEN $date_from AND $date_to
            AND {haversine} <= $radius
            {type_filter}
            ORDER BY incident_date DESC
            LIMIT {settings.max_export_rows}
        """

        result = self.conn.execute(
            sql,
            {"lat": lat, "lon": lon, "radius": radius, "date_from": date_from, "date_to": date_to}
        )

        # Convert to CSV string
        df = result.df()
        return df.to_csv(index=False)


# Global database instance
db = CrimeDatabase()
