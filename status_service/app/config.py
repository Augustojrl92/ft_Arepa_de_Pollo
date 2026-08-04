import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_name: str
    db_user: str
    db_password: str
    db_host: str
    db_port: int
    backend_url: str
    frontend_url: str
    public_api_url: str
    redis_url: str
    check_timeout_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            db_name=os.getenv("DB_NAME", "trascendence"),
            db_user=os.getenv("DB_USER", "postgres"),
            db_password=os.getenv("DB_PASSWORD", "postgres"),
            db_host=os.getenv("DB_HOST", "db"),
            db_port=int(os.getenv("DB_PORT", "5432")),
            backend_url=os.getenv("STATUS_BACKEND_URL", "http://backend:8000").rstrip("/"),
            frontend_url=os.getenv(
                "STATUS_FRONTEND_URL",
                "http://frontend:3000/frontend-health.txt",
            ),
            public_api_url=os.getenv(
                "STATUS_PUBLIC_API_URL",
                "http://public_api:8000/api/v1/health",
            ),
            redis_url=os.getenv("REDIS_URL", "redis://redis:6379/1"),
            check_timeout_seconds=float(os.getenv("STATUS_CHECK_TIMEOUT_SECONDS", "2")),
        )


settings = Settings.from_env()
