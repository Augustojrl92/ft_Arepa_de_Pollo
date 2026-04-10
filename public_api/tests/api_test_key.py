from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib import error, request


RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"


@dataclass(frozen=True)
class HttpResult:
    status: int
    reason: str
    body: str


def colorize(text: str, color: str, *, bold: bool = False, dim: bool = False) -> str:
    prefix = ""
    if bold:
        prefix += BOLD
    if dim:
        prefix += DIM
    return f"{prefix}{color}{text}{RESET}"


def status_color(code: int) -> str:
    if 200 <= code < 300:
        return GREEN
    if 300 <= code < 400:
        return CYAN
    if 400 <= code < 500:
        return YELLOW
    return RED


def print_step(name: str, result: HttpResult, detail: str = "") -> None:
    status = colorize(f"[{result.status} {result.reason}]", status_color(result.status), bold=True)
    tail = f" {colorize(detail, CYAN, dim=True)}" if detail else ""
    print(f"{colorize(name, CYAN, bold=True)} -> {status}{tail}")


def http_json(
    method: str,
    url: str,
    *,
    timeout: float,
    headers: dict[str, str] | None = None,
    payload: dict | None = None,
) -> tuple[HttpResult, dict | None]:
    body_bytes = None
    req_headers = dict(headers or {})
    if payload is not None:
        body_bytes = json.dumps(payload).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = request.Request(url=url, data=body_bytes, headers=req_headers, method=method)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else None
            return HttpResult(resp.status, resp.reason, raw), parsed
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        parsed = None
        if raw:
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = None
        return HttpResult(exc.code, exc.reason, raw), parsed


def assert_status(name: str, result: HttpResult, expected: int, failures: list[str]) -> None:
    if result.status != expected:
        failures.append(f"{name}: expected {expected}, got {result.status}")


def create_bootstrap_key(name: str) -> str | None:
    root_dir = Path(__file__).resolve().parents[1]
    repo_root = root_dir.parent

    env = os.environ.copy()
    env["NAME"] = f"{name}_bootstrap"
    bootstrap_code = (
        "import os\n"
        "from app.db.session import SessionLocal\n"
        "from app.services.api_key_service import ApiKeyService\n"
        "db = SessionLocal()\n"
        "try:\n"
        "    service = ApiKeyService(db)\n"
        "    _, raw_key = service.create_api_key(name=os.getenv('NAME', 'bootstrap_key'), requests_per_minute=60)\n"
        "    print('key:' + raw_key)\n"
        "finally:\n"
        "    db.close()\n"
    )

    proc = subprocess.run(
        [
            "docker",
            "compose",
            "-f",
            "docker-compose.dev.yml",
            "run",
            "--rm",
            "-e",
            "NAME",
            "public_api",
            "python",
            "-c",
            bootstrap_code,
        ],
        cwd=str(repo_root),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        return None

    for line in proc.stdout.splitlines():
        if line.strip().startswith("key:"):
            return line.split(":", 1)[1].strip()
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Automatic API key lifecycle test")
    parser.add_argument("name", help="Name used to create API key")
    parser.add_argument("--base-url", default="http://localhost:8001", help="Public API base URL")
    parser.add_argument("--timeout", type=float, default=8.0, help="HTTP timeout in seconds")
    args = parser.parse_args()
    key_name = args.name.strip()
    if not key_name:
        parser.print_usage()
        print(colorize("error: name cannot be empty", RED, bold=True))
        return 2

    base = args.base_url.rstrip("/")
    failures: list[str] = []

    print(colorize("public_api api-keys lifecycle test", CYAN, bold=True))

    # Health
    health_res, _ = http_json("GET", f"{base}/api/v1/health", timeout=args.timeout)
    print_step("GET /api/v1/health", health_res, "service readiness")
    assert_status("health", health_res, 200, failures)

    # Missing header must be unauthorized
    no_header_res, _ = http_json(
        "GET",
        f"{base}/api/v1/api-keys/00000000-0000-0000-0000-000000000000",
        timeout=args.timeout,
    )
    print_step("GET protected without X-API-Key", no_header_res, "auth guard")
    assert_status("missing-key-guard", no_header_res, 401, failures)

    bootstrap_key = create_bootstrap_key(key_name)
    if not bootstrap_key:
        failures.append("bootstrap-key: failed to create key via embedded bootstrap logic")
        print(colorize("Smoke test failed", RED, bold=True))
        for failure in failures:
            print(colorize(f"- {failure}", RED))
        return 1

    print(colorize(f"bootstrap key: {bootstrap_key}", YELLOW, bold=True))

    headers = {"X-API-Key": bootstrap_key}
    # Create key
    create_res, create_payload = http_json(
        "POST",
        f"{base}/api/v1/api-keys",
        timeout=args.timeout,
        headers=headers,
        payload={"name": key_name, "requests_per_minute": 30},
    )
    print_step("POST /api/v1/api-keys", create_res, f"name={key_name}")
    assert_status("create-key", create_res, 201, failures)

    created_id = None
    created_raw_key = None
    if isinstance(create_payload, dict):
        api_key_meta = create_payload.get("api_key")
        if isinstance(api_key_meta, dict):
            created_id = api_key_meta.get("id")
        created_raw_key = create_payload.get("key")

    if not created_id or not created_raw_key:
        failures.append("create-key: missing api_key.id or key in response")
        print(colorize("Smoke test failed", RED, bold=True))
        for failure in failures:
            print(colorize(f"- {failure}", RED))
        return 1

    print(colorize(f"created key: {created_raw_key}", YELLOW, bold=True))

    # Read key
    get_res, _ = http_json(
        "GET",
        f"{base}/api/v1/api-keys/{created_id}",
        timeout=args.timeout,
        headers=headers,
    )
    print_step("GET /api/v1/api-keys/{id}", get_res, f"id={created_id}")
    assert_status("get-key", get_res, 200, failures)

    # Update key
    update_res, _ = http_json(
        "PUT",
        f"{base}/api/v1/api-keys/{created_id}",
        timeout=args.timeout,
        headers=headers,
        payload={"name": f"{key_name}_updated", "requests_per_minute": 45},
    )
    print_step("PUT /api/v1/api-keys/{id}", update_res, "rename + rpm")
    assert_status("update-key", update_res, 200, failures)

    # Revoke key
    delete_res, _ = http_json(
        "DELETE",
        f"{base}/api/v1/api-keys/{created_id}",
        timeout=args.timeout,
        headers=headers,
    )
    print_step("DELETE /api/v1/api-keys/{id}", delete_res, "revoke")
    assert_status("delete-key", delete_res, 200, failures)

    # Revoked key can no longer authenticate
    revoked_headers = {"X-API-Key": created_raw_key}
    revoked_check_res, _ = http_json(
        "GET",
        f"{base}/api/v1/api-keys/{created_id}",
        timeout=args.timeout,
        headers=revoked_headers,
    )
    print_step("GET with revoked key", revoked_check_res, "expected 401")
    assert_status("revoked-key-guard", revoked_check_res, 401, failures)

    if failures:
        print(colorize("Smoke test failed", RED, bold=True))
        for failure in failures:
            print(colorize(f"- {failure}", RED))
        return 1

    print(colorize("Smoke test passed", GREEN, bold=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())