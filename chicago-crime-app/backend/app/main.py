"""
Chicago Crime Analysis API

FastAPI application for analyzing Chicago Police Department incident data.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import db
from .models import HealthResponse, UploadResponse
from .routes import incidents, geocoding

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown."""
    # Startup
    logger.info("Starting Chicago Crime Analysis API...")
    db.initialize()
    logger.info(f"Database ready with {db.total_records} records")
    yield
    # Shutdown
    logger.info("Shutting down...")
    if db.conn:
        db.conn.close()


app = FastAPI(
    title="Chicago Crime Analysis API",
    description="API for analyzing Chicago Police Department incident data",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(incidents.router)
app.include_router(geocoding.router)


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint with database status."""
    return HealthResponse(
        status="healthy" if db.conn else "unhealthy",
        database_loaded=db.conn is not None and db.total_records > 0,
        total_records=db.total_records,
        date_range_start=db.date_range_start,
        date_range_end=db.date_range_end,
        primary_types_count=len(db.primary_types),
    )


@app.post("/api/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)) -> UploadResponse:
    """
    Upload a CSV file to add to the database.

    The CSV should have Chicago crime data format with columns:
    ID, Case Number, Date, Block, IUCR, Primary Type, Description,
    Location Description, Arrest, Domestic, Beat, District, Ward,
    Community Area, FBI Code, X Coordinate, Y Coordinate, Year,
    Updated On, Latitude, Longitude, Location
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV"
        )

    # Check file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)

    if size_mb > settings.max_upload_size_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB"
        )

    logger.info(f"Processing upload: {file.filename} ({size_mb:.2f}MB)")

    records_loaded, records_skipped, warnings = db.load_csv_from_content(
        content, file.filename
    )

    return UploadResponse(
        success=records_loaded > 0,
        message=f"Loaded {records_loaded} records" if records_loaded > 0 else "No records loaded",
        records_loaded=records_loaded,
        records_skipped=records_skipped,
        warnings=warnings,
    )


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Chicago Crime Analysis API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
