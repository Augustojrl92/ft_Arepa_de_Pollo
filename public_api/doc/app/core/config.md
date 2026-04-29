# public_api/app/core/config.py

## Purpose
This file reads environment variables for the public_api service and turns them into a structured settings object. It also builds the SQLAlchemy database URL from the individual database values.

## What it defines
- `Settings`: a Pydantic settings class.
- `get_settings()`: a cached function that returns the settings instance.
- `settings`: the shared settings object used by the rest of the app.

## Why it matters
Configuration should not be hard-coded inside services. In a Dockerized app, values such as database host, port, username, and password are expected to change between environments.

This file centralizes those values so the rest of the codebase can stay clean and environment-agnostic.

## Deep explanation
### `BaseSettings`
`BaseSettings` is a Pydantic feature designed specifically for application configuration.
It can read values from:
- environment variables
- `.env` files
- system configuration

That makes it a natural fit for Docker-based development.

### `SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")`
This tells Pydantic to read the `public_api/.env` file.
Because the service runs inside its own container, this file belongs to the public_api microservice and is separate from the backend environment.

### `db_name`, `db_user`, `db_password`, `db_host`, `db_port`
These fields represent the individual parts of the database connection.
Keeping them separate is useful because:
- they are easier to change independently
- they are easier to reuse in other places
- they avoid embedding the full connection string directly in the `.env` file

### `Field(alias="DB_NAME")` and similar aliases
The environment variables use uppercase names like `DB_NAME`, while the Python attributes use lowercase names like `db_name`.
The alias connects the two worlds.

So Pydantic reads:
- `DB_NAME` from the environment
and stores it in:
- `settings.db_name`

This keeps Python code idiomatic while preserving the conventional env variable naming style.

### `database_url` property
This is the most important convenience in the file.
It builds the final SQLAlchemy connection string dynamically:

- username: `db_user`
- password: `db_password`
- host: `db_host`
- port: `db_port`
- database name: `db_name`

The property returns a string like:
`postgresql+psycopg://postgres:postgres@db:5432/trascendence`

That means:
- the `.env` stays simple
- you do not duplicate the full URL manually
- if one value changes, the URL changes automatically

### `@lru_cache`
This caches the settings object.
Configuration should usually be read once and reused, not rebuilt repeatedly.
This avoids unnecessary object creation and keeps imports stable.

### `settings = get_settings()`
This gives the rest of the application a ready-to-use shared settings instance.
Other files import `settings` instead of creating their own copies.

## How it fits in the project
- `session.py` uses `settings.database_url` to build the DB engine.
- Future security and API key services can read more config values here.
- This file acts as the single source of truth for public_api runtime configuration.

## Current scope
At this stage, this file is focused on database connectivity. It can later be expanded to include more public_api settings such as rate-limit defaults, secret keys, Redis URL, or debug flags.
