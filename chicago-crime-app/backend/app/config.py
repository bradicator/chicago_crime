"""Application configuration via environment variables."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # CSV data source - can be a file path or directory containing CSVs
    csv_path: str = os.environ.get("CSV_PATH", "")

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # CORS settings
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    # File upload settings
    max_upload_size_mb: int = 100
    upload_dir: str = "./uploads"

    # Query limits
    max_results: int = 5000  # Max points to return for map display
    max_export_rows: int = 100000  # Max rows for CSV export

    # Chicago bounding box for validation
    chicago_lat_min: float = 41.6
    chicago_lat_max: float = 42.1
    chicago_lon_min: float = -87.95
    chicago_lon_max: float = -87.5

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    def get_csv_paths(self) -> list[Path]:
        """Get list of CSV files to load."""
        if not self.csv_path:
            return []

        path = Path(self.csv_path)
        if path.is_file():
            return [path]
        elif path.is_dir():
            return list(path.glob("*.csv"))
        return []


settings = Settings()
