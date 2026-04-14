# public_api/app/schemas/coalition.py

## Purpose
This file defines the Pydantic response schemas for coalition endpoints.

## What it defines
- `CoalitionRead`: coalition row plus member counters.
- `CoalitionListResponse`: paginated coalition list wrapper.
- `CoalitionTopMember`: top member projection for coalition detail.
- `CoalitionLeaderSummary`: optional leader user summary.
- `CoalitionScoreTrends`: 24h, 7d, 30d score deltas.
- `CoalitionDetailRead`: full detail payload for one coalition.

## Why it matters
These schemas define the HTTP contract exposed by:
- `GET /api/v1/coalitions`
- `GET /api/v1/coalitions/{coalition_id}`

## Serialization behavior
- Uses `ConfigDict(from_attributes=True)` in model-backed schemas.
- Aggregated fields (`member_count`, `active_member_count`, `score_trends`) are populated at route layer.
