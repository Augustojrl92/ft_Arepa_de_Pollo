# public_api/app/services/user_service.py

## Purpose
This file contains business logic for querying users from the shared database.

## What it defines
- `UserService`: service class with list and detail query methods.

## Why it matters
Routes should stay focused on HTTP and error mapping.
This service centralizes filtering, sorting, pagination, and lookup rules.

## Main methods
### `list_users(...)`
Returns a tuple:
- `items`: list of `CampusUser`
- `total`: total matching rows
- `total_pages`: page count derived from `total` and `per_page`

Supported filters:
- `coalition` (matches `coalition_slug`)
- `level_min`, `level_max`
- `is_active`

Sorting:
- Supports an allowlist in `VALID_SORT_FIELDS`
- Supports descending mode with a leading `-` in `sort_by`
- Raises `ValueError` for unsupported sort keys

### `get_user_by_intra_id(intra_id)`
Returns one `CampusUser` by `intra_id` or `None` if not found.

## Safety controls
- Sort field allowlist prevents arbitrary attribute access.
- Pagination (`offset`, `limit`) bounds each list query.
