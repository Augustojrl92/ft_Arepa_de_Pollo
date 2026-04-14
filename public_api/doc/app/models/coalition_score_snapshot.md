# public_api/app/models/coalition_score_snapshot.py

## Purpose
This file defines the historical score snapshot model used for coalition trend calculations.

## What it defines
- `CoalitionScoreSnapshot`: ORM class mapped to `sync_coalitionscoresnapshot`.

## Why it matters
The coalition detail endpoint computes 24h, 7d, and 30d score changes.
Those values are derived from snapshot rows in this table.

## Main fields
- `coalition_id`: FK to `sync_coalition.id`
- `snapshot_date`: daily reference date
- `total_score`: coalition score captured for that date
- `campus_rank`: optional rank at capture time
- `captured_at`: timestamp for ingestion/update

## Constraints and indexes
- Unique pair on `coalition_id + snapshot_date`
- Composite index on `coalition_id + snapshot_date`
- Additional indexes on `coalition_id` and `snapshot_date`
