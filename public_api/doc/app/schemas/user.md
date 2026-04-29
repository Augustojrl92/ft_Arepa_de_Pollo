# public_api/app/schemas/user.py

## Purpose
This file defines Pydantic schemas for the users HTTP contract.

## What it defines
- `CoalitionSummary`: nested coalition info attached to each user.
- `UserRead`: list-level user shape.
- `UserListResponse`: paginated wrapper for user collections.
- `UserDetailRead`: extended user shape for a single user endpoint.

## Why it matters
These schemas keep the API response stable and explicit.
They also separate HTTP representation from SQLAlchemy models.

## Response shapes
### `UserListResponse`
- `page`, `per_page`, `total`, `total_pages`
- `items`: array of `UserRead`

### `UserRead`
- Core identity and profile preview fields
- Ranking fields: `coalition_user_score`, `coalition_rank`, `general_rank`
- Optional nested `coalition`

### `UserDetailRead`
Inherits `UserRead` and adds:
- `email`, `grade`, `pool_month`, `pool_year`
- `wallet`, `correction_points`
- `created_at`, `updated_at`

## Validation details
- Uses `ConfigDict(from_attributes=True)` for ORM object serialization.
- Pagination fields enforce non-negative and minimum constraints via `Field`.
