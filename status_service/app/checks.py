from dataclasses import dataclass
from datetime import datetime
from urllib import request

import psycopg

from app.config import Settings


@dataclass(frozen=True)
class CheckResult:
    status: str
    error: str | None = None


def check_database(settings: Settings) -> tuple[CheckResult, datetime | None]:
    try:
        with psycopg.connect(
            dbname=settings.db_name,
            user=settings.db_user,
            password=settings.db_password,
            host=settings.db_host,
            port=settings.db_port,
            connect_timeout=max(1, int(settings.check_timeout_seconds)),
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.execute(
                    "SELECT last_time_update FROM sync_syncmetadata WHERE key = %s LIMIT 1",
                    ("campus_sync",),
                )
                row = cursor.fetchone()
    except (psycopg.Error, OSError, ValueError):
        return CheckResult(status="error", error="Database check failed"), None

    return CheckResult(status="ok"), row[0] if row else None


def check_backend(settings: Settings) -> CheckResult:
    probe = request.Request(
        f"{settings.backend_url}/",
        headers={
            "Accept": "application/json",
            "Host": "localhost",
            "User-Agent": "aedlph-status-service/1.0",
            "X-Forwarded-Proto": "https",
        },
    )
    try:
        with request.urlopen(probe, timeout=settings.check_timeout_seconds) as response:
            if 200 <= response.status < 300:
                return CheckResult(status="ok")
    except (OSError, ValueError):
        pass

    return CheckResult(status="error", error="Backend check failed")
