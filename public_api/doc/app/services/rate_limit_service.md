# public_api/app/services/rate_limit_service.py

## Purpose
This service enforces the public API quota attached to each API key.

## How it works
- `requests_per_minute` is read from the authenticated `ApiKey` row.
- Redis stores a fixed-window counter per key id.
- The counter key includes the current window index, so each minute gets a fresh
  quota.
- If the counter is above the allowed quota, the route returns `429 Too Many
  Requests` with `Retry-After`.
- If Redis is unavailable, protected endpoints return `503` instead of silently
  bypassing the limit.

## Evaluation evidence
Create a key with a tiny quota and call a protected endpoint repeatedly:

```bash
make api-create-key NAME="rate_demo" RPM=2
curl -i "http://localhost:8001/api/v1/users?per_page=1" -H "X-API-Key: <key>"
curl -i "http://localhost:8001/api/v1/users?per_page=1" -H "X-API-Key: <key>"
curl -i "http://localhost:8001/api/v1/users?per_page=1" -H "X-API-Key: <key>"
```

The third request should return `429`.
