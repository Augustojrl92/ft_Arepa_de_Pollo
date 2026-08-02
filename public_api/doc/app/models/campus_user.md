# public_api/app/models/campus_user.py

## Purpose
This file defines the SQLAlchemy ORM model that maps to the Django-synced users table.

## What it defines
- `CampusUser`: ORM model mapped to `sync_campususer`.

## Why it matters
The public API reads user and ranking data directly from the shared database.
This model is the bridge between SQL rows and the users endpoint response layer.

## Main fields
- Identity: `id`, `intra_id`, `user_id`, `login`
- Profile: `email`, `display_name`, `avatar_url`
- Progress: `level`, `grade`, `pool_month`, `pool_year`
- Activity and points: `is_active`, `wallet`, `correction_points`
- Coalition and ranking: `coalition_id`, `coalition_name`, `coalition_slug`, `coalition_user_score`, `coalition_rank`, `general_rank`
- Timestamps: `created_at`, `updated_at`

## Table contract
- Table name is fixed with `__tablename__ = "sync_campususer"`.
- `intra_id` and `login` are unique and indexed for fast lookups.
- `coalition_slug` is indexed for coalition filtering.

## How it is used
- Queried by `UserService.list_users` for list/filter/sort/pagination.
- Queried by `UserService.get_user_by_intra_id` for detail retrieval.
