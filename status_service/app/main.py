from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.checks import check_backend, check_database
from app.config import settings


SERVICE_NAME = "aedlph-status-service"

app = FastAPI(
    title="AEDLPH Status Service",
    version="1.0.0",
    description="Independent health and status checks for AEDLPH services.",
    docs_url="/status/docs",
    openapi_url="/status/openapi.json",
)


def build_status_payload() -> tuple[dict, int]:
    database, last_sync = check_database(settings)
    backend = check_backend(settings)
    is_healthy = database.status == "ok" and backend.status == "ok"

    payload = {
        "service": SERVICE_NAME,
        "status": "ok" if is_healthy else "error",
        "backend": backend.status,
        "database": database.status,
        "last_sync": last_sync.isoformat() if last_sync else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    errors = [result.error for result in (backend, database) if result.error]
    if errors:
        payload["errors"] = errors

    return payload, 200 if is_healthy else 503


@app.get("/api/health/")
def health() -> JSONResponse:
    payload, status_code = build_status_payload()
    return JSONResponse(payload, status_code=status_code)


@app.get("/api/status/")
def status() -> JSONResponse:
    payload, status_code = build_status_payload()
    return JSONResponse(payload, status_code=status_code)
