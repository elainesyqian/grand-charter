"""Settings loaded from environment variables or backend/.env."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'grand_charter.db'}"
    secret_key: str = "dev-secret-change-me"
    storage_dir: Path = BACKEND_DIR / "storage"
    max_upload_mb: int = 10
    page_size_default: int = 20
    page_size_max: int = 100
    # Exposes /api/auth/demo-users for the login picker. Turn off outside demos.
    demo_mode: bool = True

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


settings = Settings()
