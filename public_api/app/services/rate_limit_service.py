from __future__ import annotations

import time
from dataclasses import dataclass

from redis import Redis
from redis.exceptions import RedisError

from app.models.api_key import ApiKey


class RateLimitUnavailable(Exception):
    pass


@dataclass(frozen=True)
class RateLimitExceeded(Exception):
    limit: int
    window_seconds: int
    retry_after: int


@dataclass(frozen=True)
class RateLimitUsage:
    limit: int
    remaining: int
    reset_after: int


class RateLimitService:
    def __init__(self, redis_url: str, window_seconds: int = 60):
        self.redis_url = redis_url
        self.window_seconds = window_seconds
        self._client: Redis | None = None

    @property
    def client(self) -> Redis:
        if self._client is None:
            self._client = Redis.from_url(self.redis_url, decode_responses=True)
        return self._client

    def enforce(self, api_key: ApiKey) -> RateLimitUsage:
        limit = max(int(api_key.requests_per_minute or 1), 1)
        now = int(time.time())
        window_index = now // self.window_seconds
        reset_at = (window_index + 1) * self.window_seconds
        reset_after = max(reset_at - now, 1)
        cache_key = f"public_api:rate_limit:{api_key.id}:{window_index}"

        try:
            pipeline = self.client.pipeline()
            pipeline.incr(cache_key)
            pipeline.expire(cache_key, self.window_seconds + 5)
            count, _expires = pipeline.execute()
        except RedisError as exc:
            raise RateLimitUnavailable("Rate limiter backend is unavailable") from exc

        count = int(count)
        if count > limit:
            raise RateLimitExceeded(
                limit=limit,
                window_seconds=self.window_seconds,
                retry_after=reset_after,
            )

        return RateLimitUsage(
            limit=limit,
            remaining=max(limit - count, 0),
            reset_after=reset_after,
        )
