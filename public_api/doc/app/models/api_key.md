# public_api/app/models/api_key.py

## Purpose
This file defines the SQLAlchemy ORM model for storing API keys in the database.

## What it defines
- `ApiKey`: the ORM class mapped to the `public_api_keys` table.

## Why it matters
This is the actual database representation of a public API credential.
It stores the safe parts of the key lifecycle and security metadata while never storing the raw key itself.

## Deep explanation
### `class ApiKey(Base)`
This makes the class a mapped SQLAlchemy model.
Because it inherits from `Base`, SQLAlchemy knows this class represents a table.

### `__tablename__ = "public_api_keys"`
This explicitly names the table.
That is important because the table name becomes the stable database contract used by migrations and future queries.

### `id`
- Primary key of the row.
- Uses a UUID rather than an integer.
- `uuid4()` generates a unique, hard-to-guess identifier.

Why UUIDs are useful here:
- they are safer to expose in logs or admin tools
- they are harder to enumerate than sequential IDs
- they are good for API-facing resources

### `name`
Human-readable label for the key.
Examples:
- `partner-client`
- `internal-service`
- `staging-integration`

This field helps operators identify the purpose of the key.

### `key_prefix`
A short visible fragment of the raw API key.
This is useful for lookup and identification without exposing the full secret.

Why it exists:
- lets you identify which key was used
- avoids printing the whole secret
- helps logs and support workflows

### `key_hash`
The hashed version of the full API key.
This is the secure storage value.
The raw key is shown to the client only once at creation time; after that, only the hash remains in the database.

This is the key security pattern of the model.
If the database leaks, attackers should not gain immediate access to usable secrets.

### `is_active`
Boolean switch for key revocation.
If `False`, the key should no longer authorize requests.
This lets you disable a key without deleting the record.

### `expires_at`
Optional expiration timestamp.
If present, the key should stop working after that date and time.
This supports temporary or time-limited keys.

### `last_used_at`
Stores the last successful usage time.
This helps with:
- auditing
- inactivity cleanup
- security reviews

### `requests_per_minute`
Stores the rate limit assigned to this key.
That allows different keys to have different quotas.

### `created_at`
Timestamp when the key row was created.
The database sets this automatically using `func.now()`.

### `updated_at`
Timestamp when the row was last modified.
This updates automatically when the record changes.

## How it fits in the project
- `api_key_service.py` creates and validates these rows.
- `schemas/api_key.py` validates input/output data around these rows.
- Alembic migrations will create the actual `public_api_keys` table from this model.
- Authentication and rate limiting will rely on this table later.

## Security model
This file is designed to support a secure API key workflow:
- raw key shown once
- hash stored permanently
- prefix used for lookup
- active/expired state tracked
- usage time recorded
- rate limit stored per key

## Current scope
This is the database foundation for the public API’s authentication and quota system.
It does not yet enforce authentication by itself; that will happen in service and route layers.
