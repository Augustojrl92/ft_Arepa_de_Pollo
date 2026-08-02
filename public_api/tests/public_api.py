from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Tests for public_api users and coalitions endpoints")
    parser.add_argument("--base-url", default="http://localhost:8001", help="Public API base URL")
    parser.add_argument(
        "--api-key",
        default=os.getenv("PUBLIC_API_KEY", ""),
        help="API key for protected endpoint tests (or set PUBLIC_API_KEY)",
    )
    parser.add_argument("--timeout", type=float, default=8.0, help="HTTP timeout in seconds")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    api_key = args.api_key.strip()
    failures: list[str] = []

    print(colorize("public_api new endpoints test", CYAN, bold=True))

    health_res, _ = http_json("GET", f"{base}/api/v1/health", timeout=args.timeout)
    print_step("GET /api/v1/health", health_res, "service readiness")
    assert_status("health", health_res, 200, failures)

    if not api_key:
        print(colorize("Missing API key: pass --api-key or set PUBLIC_API_KEY", YELLOW, bold=True))
        if failures:
            print(colorize("Endpoints test failed", RED, bold=True))
            for failure in failures:
                print(colorize(f"- {failure}", RED))
            return 1
        print(colorize("Endpoints test passed (health only)", GREEN, bold=True))
        return 0

    headers = {"X-API-Key": api_key}

    users_list_res, users_list_payload = http_json(
        "GET",
        f"{base}/api/v1/users?page=1&per_page=5&sort_by=-coalition_user_score",
        timeout=args.timeout,
        headers=headers,
    )
    print_step("GET /api/v1/users", users_list_res, "list users")
    assert_status("users-list", users_list_res, 200, failures)

    first_user_intra_id = None
    if isinstance(users_list_payload, dict):
        users_items = users_list_payload.get("items")
        if isinstance(users_items, list) and users_items:
            first_item = users_items[0]
            if isinstance(first_item, dict):
                first_user_intra_id = first_item.get("intra_id")

    if first_user_intra_id is not None:
        user_detail_res, _ = http_json(
            "GET",
            f"{base}/api/v1/users/{first_user_intra_id}",
            timeout=args.timeout,
            headers=headers,
        )
        print_step("GET /api/v1/users/{intra_id}", user_detail_res, f"intra_id={first_user_intra_id}")
        assert_status("users-detail", user_detail_res, 200, failures)
    else:
        print(colorize("Skipping user detail check: no users returned", YELLOW, bold=True))

    coalitions_list_res, coalitions_list_payload = http_json(
        "GET",
        f"{base}/api/v1/coalitions?page=1&per_page=5&sort_by=-total_score",
        timeout=args.timeout,
        headers=headers,
    )
    print_step("GET /api/v1/coalitions", coalitions_list_res, "list coalitions")
    assert_status("coalitions-list", coalitions_list_res, 200, failures)

    first_coalition_id = None
    if isinstance(coalitions_list_payload, dict):
        coalition_items = coalitions_list_payload.get("items")
        if isinstance(coalition_items, list) and coalition_items:
            first_coalition = coalition_items[0]
            if isinstance(first_coalition, dict):
                first_coalition_id = first_coalition.get("coalition_id")

    if first_coalition_id is not None:
        coalition_detail_res, _ = http_json(
            "GET",
            f"{base}/api/v1/coalitions/{first_coalition_id}",
            timeout=args.timeout,
            headers=headers,
        )
        print_step(
            "GET /api/v1/coalitions/{coalition_id}",
            coalition_detail_res,
            f"coalition_id={first_coalition_id}",
        )
        assert_status("coalitions-detail", coalition_detail_res, 200, failures)
    else:
        print(colorize("Skipping coalition detail check: no coalitions returned", YELLOW, bold=True))

    if failures:
        print(colorize("Endpoints test failed", RED, bold=True))
        for failure in failures:
            print(colorize(f"- {failure}", RED))
        return 1

    print(colorize("Endpoints test passed", GREEN, bold=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
