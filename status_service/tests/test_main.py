from datetime import datetime, timezone
from importlib import import_module

from fastapi.testclient import TestClient

from app.checks import CheckResult
from app.main import app


client = TestClient(app)
main_module = import_module("app.main")


def configure_checks(monkeypatch, **overrides):
    results = {
        "frontend": CheckResult(status="ok"),
        "backend": CheckResult(status="ok"),
        "database": CheckResult(status="ok"),
        "redis": CheckResult(status="ok"),
        "public_api": CheckResult(status="ok"),
        **overrides,
    }
    monkeypatch.setattr(main_module, "check_frontend", lambda _settings: results["frontend"])
    monkeypatch.setattr(main_module, "check_backend", lambda _settings: results["backend"])
    monkeypatch.setattr(
        main_module,
        "check_database",
        lambda _settings: (
            results["database"],
            datetime(2026, 8, 4, tzinfo=timezone.utc)
            if results["database"].status == "ok"
            else None,
        ),
    )
    monkeypatch.setattr(main_module, "check_redis", lambda _settings: results["redis"])
    monkeypatch.setattr(main_module, "check_public_api", lambda _settings: results["public_api"])


def test_status_reports_all_healthy_dependencies(monkeypatch):
    configure_checks(monkeypatch)

    response = client.get("/api/status/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["services"] == {
        "frontend": "ok",
        "backend": "ok",
        "database": "ok",
        "redis": "ok",
        "public_api": "ok",
    }
    assert response.json()["last_sync"] == "2026-08-04T00:00:00+00:00"


def test_health_is_unavailable_when_backend_fails(monkeypatch):
    configure_checks(
        monkeypatch,
        backend=CheckResult(status="error", error="Backend check failed"),
    )

    response = client.get("/api/health/")

    assert response.status_code == 503
    assert response.json()["status"] == "error"
    assert response.json()["services"]["backend"] == "error"
    assert response.json()["errors"] == ["Backend check failed"]


def test_status_is_unavailable_when_redis_fails(monkeypatch):
    configure_checks(
        monkeypatch,
        redis=CheckResult(status="error", error="Redis check failed"),
    )

    response = client.get("/api/status/")

    assert response.status_code == 503
    assert response.json()["services"]["redis"] == "error"


def test_status_page_is_served_without_nextjs(monkeypatch):
    configure_checks(monkeypatch)

    response = client.get("/status")

    assert response.status_code == 200
    assert "Estado del sistema" in response.text
    assert "Public API" in response.text
    assert "Operativo" in response.text


def test_liveness_does_not_depend_on_monitored_services():
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"service": "aedlph-status-service", "status": "ok"}
