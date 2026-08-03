from __future__ import annotations

import os
from datetime import datetime

from app.db.session import SessionLocal
from app.services.api_key_service import ApiKeyService


def _parse_expiry(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None
    return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))


def _parse_rpm(raw_value: str | None) -> int:
    if not raw_value:
        return 60
    value = int(raw_value)
    if value < 1:
        raise ValueError("RPM must be at least 1")
    return value


def main() -> int:
    name = (os.getenv("NAME") or "").strip()
    if not name:
        print("error: NAME is required")
        return 2

    expires_at = _parse_expiry(os.getenv("EXPIRES_AT"))
    requests_per_minute = _parse_rpm(os.getenv("RPM"))

    db = SessionLocal()
    try:
        service = ApiKeyService(db)
        api_key, raw_key = service.create_api_key(
            name=name,
            expires_at=expires_at,
            requests_per_minute=requests_per_minute,
        )
    finally:
        db.close()

    print(f"id={api_key.id}")
    print(f"name={api_key.name}")
    print(f"key_prefix={api_key.key_prefix}")
    print(f"requests_per_minute={api_key.requests_per_minute}")
    print(f"key={raw_key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
