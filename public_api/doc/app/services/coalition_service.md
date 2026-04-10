# public_api/app/services/coalition_service.py

## Purpose
This file contains coalition query and aggregation logic used by the route layer.

## What it defines
- `CoalitionService` with methods for listing, detail lookup, counts, top members, and score trends.

## Why it matters
It centralizes SQL behavior for coalition endpoints and keeps routes focused on HTTP concerns.

## Key methods
- `list_coalitions(page, per_page, sort_by)`
  - Validates sort field against allowlist.
  - Joins coalition rows with member counts and active member counts.
  - Returns paginated rows plus total metadata.
- `get_coalition_by_id(coalition_id)`
  - Resolves one coalition by public coalition id.
- `get_member_counts(coalition_id)`
  - Returns total and active member counts from `sync_campususer`.
- `get_top_members(coalition_id, limit)`
  - Returns top members sorted by coalition score.
- `get_score_trends(coalition)`
  - Computes 24h, 7d, and 30d deltas from snapshot table.

## Defensive behavior
- Raises `ValueError` for unsupported sort keys.
- Uses `coalesce` and integer conversion to avoid null aggregate leaks in responses.
