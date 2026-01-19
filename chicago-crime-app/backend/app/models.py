"""Pydantic models for request/response validation."""

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class RadiusUnit(str, Enum):
    MILES = "miles"
    KILOMETERS = "km"


class DatePreset(str, Enum):
    LAST_7_DAYS = "7d"
    LAST_30_DAYS = "30d"
    LAST_90_DAYS = "90d"
    LAST_YEAR = "1y"
    ALL_TIME = "all"
    CUSTOM = "custom"


# Request Models

class LocationQuery(BaseModel):
    """Location-based query parameters."""
    latitude: float = Field(..., ge=41.6, le=42.1, description="Latitude (Chicago range)")
    longitude: float = Field(..., ge=-87.95, le=-87.5, description="Longitude (Chicago range)")
    radius: float = Field(default=0.5, ge=0.1, le=5.0, description="Search radius in miles")


class IncidentSearchRequest(BaseModel):
    """Request model for incident search."""
    latitude: float = Field(..., ge=41.6, le=42.1)
    longitude: float = Field(..., ge=-87.95, le=-87.5)
    radius: float = Field(default=0.5, ge=0.1, le=5.0, description="Radius in miles")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    date_preset: Optional[DatePreset] = DatePreset.LAST_30_DAYS
    primary_types: Optional[list[str]] = None  # None means all types
    limit: int = Field(default=5000, le=10000)
    offset: int = Field(default=0, ge=0)

    @field_validator("date_to")
    @classmethod
    def date_to_not_before_from(cls, v, info):
        if v and info.data.get("date_from") and v < info.data["date_from"]:
            raise ValueError("date_to must be after date_from")
        return v


class StatsRequest(BaseModel):
    """Request model for statistics."""
    latitude: float = Field(..., ge=41.6, le=42.1)
    longitude: float = Field(..., ge=-87.95, le=-87.5)
    radius: float = Field(default=0.5, ge=0.1, le=5.0)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    date_preset: Optional[DatePreset] = DatePreset.LAST_30_DAYS
    primary_types: Optional[list[str]] = None


class ExportRequest(BaseModel):
    """Request model for CSV export."""
    latitude: float = Field(..., ge=41.6, le=42.1)
    longitude: float = Field(..., ge=-87.95, le=-87.5)
    radius: float = Field(default=0.5, ge=0.1, le=5.0)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    date_preset: Optional[DatePreset] = DatePreset.LAST_30_DAYS
    primary_types: Optional[list[str]] = None


class GeocodeRequest(BaseModel):
    """Request for address geocoding."""
    address: str = Field(..., min_length=3, max_length=500)


# Response Models

class Incident(BaseModel):
    """Single incident record."""
    id: str
    case_number: Optional[str] = None
    date: datetime
    block: Optional[str] = None
    iucr: Optional[str] = None
    primary_type: str
    description: Optional[str] = None
    location_description: Optional[str] = None
    arrest: bool = False
    domestic: bool = False
    beat: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[int] = None
    community_area: Optional[int] = None
    latitude: float
    longitude: float
    distance_miles: Optional[float] = None


class IncidentSearchResponse(BaseModel):
    """Response for incident search."""
    incidents: list[Incident]
    total_count: int
    returned_count: int
    query_time_ms: float


class TypeCount(BaseModel):
    """Count of incidents by type."""
    primary_type: str
    count: int
    percentage: float


class DayHourCount(BaseModel):
    """Count by day of week and hour."""
    day_of_week: int  # 0=Monday, 6=Sunday
    day_name: str
    hour: int
    count: int


class DailyCount(BaseModel):
    """Daily incident count for time series."""
    date: date
    count: int


class QuarterlyCount(BaseModel):
    """Quarterly incident count for trend analysis."""
    year: int
    quarter: int
    count: int
    label: str


class KPIStats(BaseModel):
    """Key performance indicators."""
    total_incidents: int
    incidents_per_day: float
    top_types: list[TypeCount]
    date_range_days: int
    arrests_count: int
    arrests_percentage: float
    domestic_count: int


class StatsResponse(BaseModel):
    """Full statistics response."""
    kpi: KPIStats
    by_type: list[TypeCount]
    by_day_hour: list[DayHourCount]
    daily_counts: list[DailyCount]
    quarterly_counts: list[QuarterlyCount]
    query_time_ms: float


class GeocodeResponse(BaseModel):
    """Geocoding response."""
    latitude: float
    longitude: float
    display_name: str
    confidence: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    database_loaded: bool
    total_records: int
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    primary_types_count: int


class UploadResponse(BaseModel):
    """CSV upload response."""
    success: bool
    message: str
    records_loaded: int
    records_skipped: int
    warnings: list[str]
