"""API routes for incident queries."""

import time
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io

from ..models import (
    IncidentSearchRequest,
    IncidentSearchResponse,
    Incident,
    StatsRequest,
    StatsResponse,
    KPIStats,
    TypeCount,
    DayHourCount,
    DailyCount,
    QuarterlyCount,
    ExportRequest,
)
from ..database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("/types")
async def get_types() -> list[str]:
    """Get all unique primary types in the database."""
    if not db.conn:
        raise HTTPException(status_code=503, detail="Database not initialized")
    return db.primary_types


@router.post("/search")
async def search_incidents(request: IncidentSearchRequest) -> IncidentSearchResponse:
    """Search for incidents within a radius of a location."""
    if not db.conn:
        raise HTTPException(status_code=503, detail="Database not initialized")

    start_time = time.time()

    date_from, date_to = db.get_date_range(
        request.date_from,
        request.date_to,
        request.date_preset.value if request.date_preset else None
    )

    incidents, total_count = db.search_incidents(
        lat=request.latitude,
        lon=request.longitude,
        radius=request.radius,
        date_from=date_from,
        date_to=date_to,
        primary_types=request.primary_types,
        limit=request.limit,
        offset=request.offset,
    )

    query_time = (time.time() - start_time) * 1000

    return IncidentSearchResponse(
        incidents=[Incident(**inc) for inc in incidents],
        total_count=total_count,
        returned_count=len(incidents),
        query_time_ms=round(query_time, 2),
    )


@router.post("/stats")
async def get_stats(request: StatsRequest) -> StatsResponse:
    """Get aggregated statistics for a location and filters."""
    if not db.conn:
        raise HTTPException(status_code=503, detail="Database not initialized")

    start_time = time.time()

    date_from, date_to = db.get_date_range(
        request.date_from,
        request.date_to,
        request.date_preset.value if request.date_preset else None
    )

    stats = db.get_stats(
        lat=request.latitude,
        lon=request.longitude,
        radius=request.radius,
        date_from=date_from,
        date_to=date_to,
        primary_types=request.primary_types,
    )

    query_time = (time.time() - start_time) * 1000

    return StatsResponse(
        kpi=KPIStats(**stats["kpi"]),
        by_type=[TypeCount(**t) for t in stats["by_type"]],
        by_day_hour=[DayHourCount(**d) for d in stats["by_day_hour"]],
        daily_counts=[DailyCount(**d) for d in stats["daily_counts"]],
        quarterly_counts=[QuarterlyCount(**q) for q in stats["quarterly_counts"]],
        query_time_ms=round(query_time, 2),
    )


@router.post("/export")
async def export_incidents(request: ExportRequest):
    """Export filtered incidents as CSV download."""
    if not db.conn:
        raise HTTPException(status_code=503, detail="Database not initialized")

    date_from, date_to = db.get_date_range(
        request.date_from,
        request.date_to,
        request.date_preset.value if request.date_preset else None
    )

    csv_content = db.export_csv(
        lat=request.latitude,
        lon=request.longitude,
        radius=request.radius,
        date_from=date_from,
        date_to=date_to,
        primary_types=request.primary_types,
    )

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=chicago_crime_export_{date_from}_{date_to}.csv"
        }
    )
