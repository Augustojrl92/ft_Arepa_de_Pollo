# public_api/app/api/v1/routes/coalitions.py

## Purpose
This file defines read-only coalition endpoints for the public API.

## What it defines
- `GET /api/v1/coalitions`
- `GET /api/v1/coalitions/{coalition_id}`

## Security model
- Both routes require `X-API-Key` and reuse `require_api_key` dependency.
- Database access uses the shared `get_db` dependency.

## List endpoint behavior
- Supports `page`, `per_page`, and `sort_by` query params.
- Returns paginated coalition rows with:
  - coalition metadata
  - `member_count`
  - `active_member_count`
- Invalid `sort_by` returns `400`.

## Detail endpoint behavior
- Resolves one coalition by `coalition_id`.
- Returns:
  - coalition metadata
  - member counters
  - top members
  - leader summary
  - score trends (`24h`, `7d`, `30d`)
- Missing coalition returns `404`.
