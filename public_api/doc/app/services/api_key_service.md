# public_api/app/services/api_key_service.py

## Purpose
This file contains the business logic for creating, hashing, validating, and revoking API keys.

## What it defines
- `ApiKeyService`: a service class that works with the database session.
- key generation helpers.
- key hashing.
- create/validate/revoke operations.

## Why it matters
The service layer is where the application rules live.
Routes should stay thin and focused on HTTP concerns, while the service layer handles:
- how a key is generated
- how it is stored securely
- how it is validated
- how it is revoked
- how usage timestamps are updated

## Deep explanation
### `__init__(self, db: Session)`
The service receives a SQLAlchemy session.
That gives it access to the database without hard-coding a global connection.
This design keeps the code testable and request-scoped.

### `generate_raw_key()`
Uses `secrets.token_urlsafe(32)` to generate a strong random string.
This is the actual secret that would be shown once to the client.

Why `secrets`:
- it is designed for cryptographic randomness
- it is more appropriate than normal random functions for secrets

### `build_key_prefix(raw_key)`
Extracts the first 8 characters of the raw key.
That prefix is used as a short lookup and identification token.

Why it exists:
- the full secret should not be logged or displayed repeatedly
- a prefix gives you a safe way to identify which key is being referenced

### `hash_key(raw_key)`
Creates a SHA-256 hash of the raw key.
This is what gets stored in the database instead of the plain key.

Why hashing matters:
- protects the secret at rest
- if the database is leaked, the raw API key is not immediately exposed
- validation can still compare a candidate key to the stored hash

### `create_api_key(...)`
This is the creation workflow.
It:
1. Generates a raw secret.
2. Computes a prefix.
3. Hashes the raw secret.
4. Builds an `ApiKey` ORM object.
5. Saves it to the database.
6. Returns both the DB row and the raw key.

Why it returns the raw key:
- the raw key should usually be shown only once at creation time
- after that, only the hashed version remains in the database

### `get_api_key_by_prefix(key_prefix)`
Fetches a key record using the prefix.
This is a fast way to narrow down which key is being validated.

### `validate_raw_key(raw_key)`
This is the request-time validation workflow.
It:
1. Computes the prefix from the provided key.
2. Hashes the provided key.
3. Looks up the database row by prefix.
4. Rejects the key if it does not exist.
5. Rejects it if it is inactive.
6. Rejects it if it is expired.
7. Rejects it if the hash does not match.
8. Updates `last_used_at` if validation succeeds.

This method is the core of API key authentication.

### `revoke_api_key(api_key)`
Marks the key inactive and saves the change.
This is the revocation workflow.
It lets you disable a key without deleting its history.

## How it fits in the project
- Routes will call this service when creating keys.
- Authentication dependencies will call it when validating incoming requests.
- Future admin endpoints can call it to revoke keys.
- The model in `app/models/api_key.py` provides the stored data structure the service manipulates.

## Current scope
This is the first major business-logic layer for the public API.
It is the bridge between the database model and the HTTP routes that will eventually expose the API key functionality.
