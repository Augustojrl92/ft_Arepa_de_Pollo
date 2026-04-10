# public_api/app/db/base.py

## Purpose
This file defines the shared SQLAlchemy declarative base class used by all ORM models in the public_api service.

## What it defines
- `Base`: the root class that every SQLAlchemy model will inherit from.

## Why it matters
SQLAlchemy needs a common base class to know which Python classes represent database tables. Without a shared base, the ORM cannot register models properly, and Alembic will have no central metadata collection to inspect for migrations.

## Deep explanation
### `declarative_base()`
This function creates a base class for SQLAlchemy’s declarative model system.
When a model inherits from `Base`, SQLAlchemy treats that class as a mapped table definition.

In practical terms, the base lets you write model classes like:
- `class ApiKey(Base): ...`

and SQLAlchemy understands that as a database table definition rather than a plain Python class.

### `Base`
This is the shared parent of all ORM models.
It acts as the container for table metadata, including:
- table names
- columns
- constraints
- relationships

That metadata is important for both runtime database operations and migration generation.

## How it fits in the project
- `app/models/api_key.py` inherits from this base.
- Alembic will eventually import model metadata through this base.
- Any future model such as users, tokens, logs, or rate-limit records will also inherit from it.

## Why this file is small
This file is intentionally minimal because it has one job only: establish the ORM foundation.
All actual table definitions live in the model files, not here.

## Current scope
At this point, `Base` is ready for the first model and future migrations.
