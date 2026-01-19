"""Geographic utilities for distance calculations."""

import math
from typing import Tuple

# Earth's radius in miles
EARTH_RADIUS_MILES = 3958.8
EARTH_RADIUS_KM = 6371.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth.

    Args:
        lat1, lon1: Coordinates of first point (degrees)
        lat2, lon2: Coordinates of second point (degrees)

    Returns:
        Distance in miles
    """
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    # Haversine formula
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))

    return EARTH_RADIUS_MILES * c


def get_bounding_box(
    lat: float, lon: float, radius_miles: float
) -> Tuple[float, float, float, float]:
    """
    Calculate a bounding box around a point.

    This is used as a fast pre-filter before applying precise Haversine distance.
    The bounding box is slightly larger than needed to ensure no points are missed.

    Args:
        lat: Center latitude (degrees)
        lon: Center longitude (degrees)
        radius_miles: Search radius in miles

    Returns:
        Tuple of (min_lat, max_lat, min_lon, max_lon)
    """
    # Add 10% buffer to ensure we don't miss edge cases
    radius_buffered = radius_miles * 1.1

    # Latitude: 1 degree ≈ 69 miles
    lat_delta = radius_buffered / 69.0

    # Longitude: varies by latitude, 1 degree ≈ 69 * cos(lat) miles
    lon_delta = radius_buffered / (69.0 * math.cos(math.radians(lat)))

    return (
        lat - lat_delta,
        lat + lat_delta,
        lon - lon_delta,
        lon + lon_delta,
    )


def haversine_sql() -> str:
    """
    Return DuckDB SQL expression for Haversine distance calculation.

    The expression expects parameters: $lat, $lon for the center point,
    and uses columns 'latitude' and 'longitude' from the table.

    Returns:
        SQL expression that calculates distance in miles
    """
    return """
    (
        3958.8 * 2 * ASIN(
            SQRT(
                POWER(SIN(RADIANS(latitude - $lat) / 2), 2) +
                COS(RADIANS($lat)) * COS(RADIANS(latitude)) *
                POWER(SIN(RADIANS(longitude - $lon) / 2), 2)
            )
        )
    )
    """
