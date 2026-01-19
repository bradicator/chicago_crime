"""API routes for geocoding."""

import logging
import httpx
from fastapi import APIRouter, HTTPException, Query

from ..models import GeocodeResponse
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["geocoding"])

# Nominatim API (free, no API key required)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


@router.get("/geocode")
async def geocode_address(
    address: str = Query(..., min_length=3, max_length=500, description="Address to geocode")
) -> GeocodeResponse:
    """
    Convert an address to latitude/longitude coordinates.

    Uses OpenStreetMap's Nominatim service (free, rate-limited).
    Results are biased toward Chicago, IL.
    """
    # Append Chicago, IL to improve accuracy for local addresses
    if "chicago" not in address.lower() and "il" not in address.lower():
        search_query = f"{address}, Chicago, IL"
    else:
        search_query = address

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                NOMINATIM_URL,
                params={
                    "q": search_query,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1,
                    # Bias results to Chicago area
                    "viewbox": f"{settings.chicago_lon_min},{settings.chicago_lat_max},{settings.chicago_lon_max},{settings.chicago_lat_min}",
                    "bounded": 1,
                },
                headers={
                    "User-Agent": "ChicagoCrimeAnalysis/1.0"
                },
                timeout=10.0
            )
            response.raise_for_status()
            results = response.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Geocoding service timeout")
    except httpx.HTTPError as e:
        logger.error(f"Geocoding error: {e}")
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")

    if not results:
        raise HTTPException(status_code=404, detail="Address not found")

    result = results[0]
    lat = float(result["lat"])
    lon = float(result["lon"])

    # Validate result is within Chicago bounds
    if not (
        settings.chicago_lat_min <= lat <= settings.chicago_lat_max
        and settings.chicago_lon_min <= lon <= settings.chicago_lon_max
    ):
        raise HTTPException(
            status_code=400,
            detail="Address is outside Chicago city limits"
        )

    return GeocodeResponse(
        latitude=lat,
        longitude=lon,
        display_name=result.get("display_name", address),
        confidence=float(result.get("importance", 0.5))
    )


@router.get("/reverse-geocode")
async def reverse_geocode(
    lat: float = Query(..., ge=41.6, le=42.1),
    lon: float = Query(..., ge=-87.95, le=-87.5)
) -> dict:
    """
    Convert coordinates to an address.

    Uses OpenStreetMap's Nominatim service.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lon,
                    "format": "json",
                    "addressdetails": 1,
                },
                headers={
                    "User-Agent": "ChicagoCrimeAnalysis/1.0"
                },
                timeout=10.0
            )
            response.raise_for_status()
            result = response.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Geocoding service timeout")
    except httpx.HTTPError as e:
        logger.error(f"Reverse geocoding error: {e}")
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")

    if "error" in result:
        raise HTTPException(status_code=404, detail="Location not found")

    return {
        "display_name": result.get("display_name", ""),
        "address": result.get("address", {})
    }
