# public_api/app/api/v1/routes/users.py

## Purpose
This file exposes read-only user endpoints for the public API.

## What it defines
- `router`: FastAPI router with prefix `/api/v1/users`
- `GET /api/v1/users`: paginated list with filters and sorting
- `GET /api/v1/users/{intra_id}`: single user details

## Security model
- Both endpoints require `X-API-Key`.
- Reuses route dependencies from the API keys module:
  - `get_db` for SQLAlchemy session scope
  - `require_api_key` for authentication

## Query contract for list endpoint
- `page` (default `1`, min `1`)
- `per_page` (default `50`, min `1`, max `200`)
- `coalition` (optional slug)
- `level_min` and `level_max` (optional)
- `is_active` (optional)
- `sort_by` (default `-coalition_user_score`)

## Error behavior
- `400` when `level_min > level_max`
- `400` when `sort_by` is unsupported
- `404` when a user is not found in detail endpoint

## Serialization note
The helper `_serialize_user` constructs nested coalition output from
`coalition_id`, `coalition_name`, and `coalition_slug` fields in `CampusUser`.
