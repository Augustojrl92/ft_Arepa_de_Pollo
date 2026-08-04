from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.checks import CheckResult
from app.main import app


client = TestClient(app)


@patch("app.main.check_backend", return_value=CheckResult(status="ok"))
@patch(
    "app.main.check_database",
    return_value=(CheckResult(status="ok"), datetime(2026, 8, 4, tzinfo=timezone.utc)),
)
def test_status_reports_healthy_dependencies(_database, _backend):
    response = client.get("/api/status/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["backend"] == "ok"
    assert response.json()["database"] == "ok"
    assert response.json()["last_sync"] == "2026-08-04T00:00:00+00:00"


@patch("app.main.check_backend", return_value=CheckResult(status="error", error="Backend check failed"))
@patch("app.main.check_database", return_value=(CheckResult(status="ok"), None))
def test_health_is_unavailable_when_backend_fails(_database, _backend):
    response = client.get("/api/health/")

    assert response.status_code == 503
    assert response.json()["status"] == "error"
    assert response.json()["backend"] == "error"
    assert response.json()["errors"] == ["Backend check failed"]


@patch("app.main.check_backend", return_value=CheckResult(status="ok"))
@patch(
    "app.main.check_database",
    return_value=(CheckResult(status="error", error="Database check failed"), None),
)
def test_status_is_unavailable_when_database_fails(_database, _backend):
    response = client.get("/api/status/")

    assert response.status_code == 503
    assert response.json()["database"] == "error"
    assert response.json()["last_sync"] is None
