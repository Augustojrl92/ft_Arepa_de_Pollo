from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.checks import (
    check_backend,
    check_database,
    check_frontend,
    check_public_api,
    check_redis,
)
from app.config import settings


SERVICE_NAME = "aedlph-status-service"

app = FastAPI(
    title="AEDLPH Status Service",
    version="1.0.0",
    description="Independent health and status checks for AEDLPH services.",
    docs_url="/status-service/docs",
    openapi_url="/status-service/openapi.json",
)
templates = Jinja2Templates(directory=Path(__file__).resolve().parent.parent / "templates")

SERVICE_LABELS = {
    "frontend": "Frontend",
    "backend": "Backend",
    "database": "PostgreSQL",
    "redis": "Redis",
    "public_api": "Public API",
}


def build_status_payload() -> tuple[dict, int]:
    database, last_sync = check_database(settings)
    checks = {
        "frontend": check_frontend(settings),
        "backend": check_backend(settings),
        "database": database,
        "redis": check_redis(settings),
        "public_api": check_public_api(settings),
    }
    is_healthy = all(result.status == "ok" for result in checks.values())

    payload = {
        "service": SERVICE_NAME,
        "status": "ok" if is_healthy else "error",
        "services": {name: result.status for name, result in checks.items()},
        "backend": checks["backend"].status,
        "database": database.status,
        "last_sync": last_sync.isoformat() if last_sync else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    errors = [result.error for result in checks.values() if result.error]
    if errors:
        payload["errors"] = errors

    return payload, 200 if is_healthy else 503


@app.get("/healthz")
def liveness() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "ok"}


@app.get("/api/health/")
def health() -> JSONResponse:
    payload, status_code = build_status_payload()
    return JSONResponse(payload, status_code=status_code)


@app.get("/api/status/")
def status() -> JSONResponse:
    payload, status_code = build_status_payload()
    return JSONResponse(payload, status_code=status_code)


@app.get("/status", response_class=HTMLResponse)
def status_page(request: Request) -> HTMLResponse:
    payload, _status_code = build_status_payload()
    return templates.TemplateResponse(
        request=request,
        name="status.html",
        context={"status": payload, "service_labels": SERVICE_LABELS},
        headers={"Cache-Control": "no-store"},
    )
