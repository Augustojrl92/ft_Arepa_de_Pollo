from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.api_key import ApiKey


class ApiKeyService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def generate_raw_key() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def build_key_prefix(raw_key: str) -> str:
        return raw_key[:8]

    @staticmethod
    def hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def create_api_key(
        self,
        name: str,
        expires_at: datetime | None = None,
        requests_per_minute: int = 60,
    ) -> tuple[ApiKey, str]:
        raw_key = self.generate_raw_key()
        key_prefix = self.build_key_prefix(raw_key)
        key_hash = self.hash_key(raw_key)

        api_key = ApiKey(
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            expires_at=expires_at,
            requests_per_minute=requests_per_minute,
        )

        self.db.add(api_key)
        self.db.commit()
        self.db.refresh(api_key)

        return api_key, raw_key

    def get_api_key_by_prefix(self, key_prefix: str) -> ApiKey | None:
        return (
            self.db.query(ApiKey)
            .filter(ApiKey.key_prefix == key_prefix)
            .first()
        )

    def validate_raw_key(self, raw_key: str) -> ApiKey | None:
        key_prefix = self.build_key_prefix(raw_key)
        key_hash = self.hash_key(raw_key)

        api_key = self.get_api_key_by_prefix(key_prefix)
        if api_key is None:
            return None

        if not api_key.is_active:
            return None

        if api_key.expires_at is not None and api_key.expires_at <= datetime.now(timezone.utc):
            return None

        if api_key.key_hash != key_hash:
            return None

        api_key.last_used_at = datetime.now(timezone.utc)
        self.db.add(api_key)
        self.db.commit()
        self.db.refresh(api_key)

        return api_key

    def revoke_api_key(self, api_key: ApiKey) -> ApiKey:
        api_key.is_active = False
        self.db.add(api_key)
        self.db.commit()
        self.db.refresh(api_key)
        return api_key
