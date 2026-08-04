from dataclasses import dataclass
from datetime import datetime
from urllib import error, request

import psycopg
import redis

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


def check_http_service(
    url: str,
    label: str,
    settings: Settings,
    headers: dict[str, str] | None = None,
) -> CheckResult:
    probe = request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "aedlph-status-service/1.0",
            **(headers or {}),
        },
    )
    try:
        with request.urlopen(probe, timeout=settings.check_timeout_seconds) as response:
            if 200 <= response.status < 300:
                return CheckResult(status="ok")
    except (error.URLError, OSError, TimeoutError, ValueError):
        pass

    return CheckResult(status="error", error=f"{label} check failed")


def check_backend(settings: Settings) -> CheckResult:
    return check_http_service(
        f"{settings.backend_url}/",
        "Backend",
        settings,
        headers={"Host": "localhost", "X-Forwarded-Proto": "https"},
    )


def check_frontend(settings: Settings) -> CheckResult:
    return check_http_service(settings.frontend_url, "Frontend", settings)


def check_public_api(settings: Settings) -> CheckResult:
    return check_http_service(settings.public_api_url, "Public API", settings)


def check_redis(settings: Settings) -> CheckResult:
    client = redis.Redis.from_url(
        settings.redis_url,
        socket_connect_timeout=settings.check_timeout_seconds,
        socket_timeout=settings.check_timeout_seconds,
    )
    try:
        if client.ping():
            return CheckResult(status="ok")
    except (redis.RedisError, OSError, ValueError):
        pass
    finally:
        client.close()

    return CheckResult(status="error", error="Redis check failed")
