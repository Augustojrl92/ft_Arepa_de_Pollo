# public_api/app/schemas/api_key.py

## Purpose
This file defines the Pydantic schemas used to validate and serialize API key data for the public_api service.

## What it defines
- `ApiKeyBase`: shared validation fields.
- `ApiKeyCreate`: request schema for creating a key.
- `ApiKeyRead`: response schema for returning a key safely.

## Why it matters
Schemas are the contract between your API and its clients.
They are separate from database models because they describe how data should look when entering or leaving the HTTP layer, not how it is stored in PostgreSQL.

## Deep explanation
### `ApiKeyBase`
This is the shared parent schema.
It contains the fields that are common to both creation and read operations:
- `name`
- `expires_at`
- `requests_per_minute`

#### `name`
A human-readable label for the key.
The validation rules enforce:
- at least 1 character
- at most 120 characters

That keeps the value meaningful and prevents empty or absurdly large labels.

#### `expires_at`
Optional datetime for expiration.
If it is `None`, the key does not expire automatically.
If present, the key can later be rejected by validation logic once the expiration date is reached.

#### `requests_per_minute`
Per-key rate limit configuration.
The default is `60`, and it must be at least `1`.
This gives each API key its own quota policy.

### `ApiKeyCreate`
This schema is used for incoming create requests.
It currently adds no new fields beyond `ApiKeyBase`, but it exists as a separate type so you can evolve create behavior later without changing read behavior.

Why this is useful:
- you might later add fields only relevant on creation
- you keep the API contract explicit
- the code stays extensible

### `ApiKeyRead`
This schema is used for outgoing responses.
It contains the base fields plus server-generated metadata:
- `id`
- `key_prefix`
- `is_active`
- `last_used_at`
- `created_at`
- `updated_at`

These are the fields a client should see when reading an API key record.

#### `model_config = ConfigDict(from_attributes=True)`
This is a Pydantic v2 setting that allows the schema to read values from ORM objects.
That means you can pass a SQLAlchemy `ApiKey` instance to this schema and Pydantic will pull the values from its attributes.

This is the bridge between the database layer and the HTTP response layer.

### Why `key_hash` is missing
The database model stores `key_hash`, but the response schema deliberately does not expose it.
That is a security choice.
Clients should never see the stored hash of the secret key.

### Why `id` is a UUID
The response exposes the row identifier so internal tooling or admin interfaces can reference the record safely.
UUIDs are a better public-facing choice than sequential integers for sensitive resources.

## How it fits in the project
- Route handlers will use `ApiKeyCreate` to validate incoming payloads.
- Services will convert SQLAlchemy `ApiKey` objects into `ApiKeyRead` responses.
- The schema ensures the API returns only safe and intentional fields.

## Current scope
This file defines the HTTP-facing contract for API key operations.
It is not a table and it does not contain business logic.
