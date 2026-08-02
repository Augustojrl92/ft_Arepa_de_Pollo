# public_api/app/models/coalition.py

## Purpose
This file defines the SQLAlchemy ORM model for coalition data synced from Django.

## What it defines
- `Coalition`: ORM class mapped to `sync_coalition`.

## Why it matters
Coalition list and detail endpoints read directly from this model.
It is the source of identity, branding, scores, and leader references.

## Main fields
- Identity: `id`, `coalition_id`
- Branding: `name`, `slug`, `image_url`, `cover_url`, `color`
- Scoring: `total_score`
- Leadership: `leader_user_id`
- Update tracking: `updated_at`

## Table contract
- Table name is fixed with `__tablename__ = "sync_coalition"`.
- `coalition_id` is unique and indexed for fast lookup.
- `slug` is indexed for optional filtering and sorting use cases.
