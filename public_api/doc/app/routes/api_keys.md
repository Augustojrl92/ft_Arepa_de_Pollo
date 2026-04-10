# public_api/app/api/v1/routes/api_keys.py

## Purpose
This file defines the HTTP routes for API key management in the public_api service.

It is the route layer, not the business logic layer.
Its job is to receive HTTP requests, validate input, call the service layer, and return structured responses.

## What it defines
- `router`: a FastAPI `APIRouter` instance for the API key feature.
- `get_db()`: a dependency that creates and closes a SQLAlchemy session per request.
- `api_key_header`: security scheme that reads `X-API-Key` from request headers.
- `require_api_key()`: dependency that validates API keys through the service layer.
- `POST /api/v1/api-keys`: create a new API key.
- `GET /api/v1/api-keys/{api_key_id}`: read one API key by UUID.
- `PUT /api/v1/api-keys/{api_key_id}`: update an API key.
- `DELETE /api/v1/api-keys/{api_key_id}`: revoke an API key.

## Security model
- Header name: `X-API-Key`
- Validation source: `ApiKeyService.validate_raw_key`
- `GET`, `PUT`, `DELETE` require a valid key.
- `POST` currently does not require a key (bootstrap mode).
- Invalid, missing, inactive, or expired keys return `401 Unauthorized`.

## Why it matters
This file is the public HTTP surface for API key administration.
It is where FastAPI turns HTTP verbs and URLs into application actions.

The file also shows a classic FastAPI layering approach:
- routes handle HTTP concerns
- schemas handle validation and serialization
- services handle business rules
- models handle database mapping

## Deep explanation
### Imports
#### `from datetime import datetime, timezone`
Used in the update endpoint to stamp the key with a new modification time:

```python
api_key.updated_at = datetime.now(timezone.utc)
```

This import exists because the route manually updates the timestamp after changing the record.

#### `from uuid import UUID`
Used to type the `api_key_id` path parameter in the read, update, and revoke routes:

```python
def get_api_key(api_key_id: UUID, db: Session = Depends(get_db)):
```

This tells FastAPI to validate the path value as a UUID before the handler runs.

#### `from fastapi import APIRouter, Depends, HTTPException, Security, status`
These are the FastAPI building blocks used by the route layer.

- `APIRouter`: groups related endpoints together.
- `Depends`: injects dependencies such as the database session.
- `Security`: injects security dependencies (header-based API key in this file).
- `HTTPException`: returns API-friendly errors like 404.
- `status`: provides readable HTTP status constants such as `status.HTTP_201_CREATED`.

#### `from fastapi.security import APIKeyHeader`
This imports FastAPI's header security helper.

It is used to declare that this API expects an API key in the `X-API-Key` header.

#### `from sqlalchemy.orm import Session`
This is the SQLAlchemy session type used only for typing and clarity in the route signatures.

The actual session object is created by `SessionLocal()` inside `get_db()`.

#### `from app.db.session import SessionLocal`
This is the session factory used by `get_db()`.

It creates a new database session for each incoming request.

#### `from app.models.api_key import ApiKey`
This imports the SQLAlchemy ORM model for the `public_api_keys` table.

It is used in direct database queries such as:

```python
api_key = db.query(ApiKey).filter(ApiKey.id == api_key_id).first()
```

#### `from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyRead`
These are the Pydantic schemas that define the HTTP contract.

- `ApiKeyCreate` validates incoming create and update payloads.
- `ApiKeyCreateResponse` defines the one-time create response with raw key.
- `ApiKeyRead` defines the safe response shape returned to the client.

#### `from app.services.api_key_service import ApiKeyService`
This imports the service layer that contains the actual API key business logic.

The router delegates creation and revocation to this service instead of implementing those rules directly.

### Router definition
```python
router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
```

This creates a route group.

The `prefix` means every endpoint in this file automatically lives under `/api/v1/api-keys`.
The `tags` value is mainly for Swagger/OpenAPI documentation grouping.

This is not a reserved Python word.
`router` is just a normal variable name that points to an `APIRouter` instance.

`api_key_header` defines how the API key is read from incoming requests.
`auto_error=False` lets the code return a custom 401 message from `require_api_key()`.

### Database dependency
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

This function is a FastAPI dependency.

How it works:
1. A session is created.
2. The session is yielded to the route handler.
3. After the request finishes, the session is always closed.

Why this pattern matters:
- it avoids leaking open database connections
- it gives each request its own session scope
- it keeps the route handlers clean

### Security dependency
```python
def require_api_key(
    raw_key: str | None = Security(api_key_header),
    db: Session = Depends(get_db),
) -> ApiKey:
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )

    service = ApiKeyService(db)
    api_key = service.validate_raw_key(raw_key)
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
        )

    return api_key
```

This dependency is the authentication gate for protected endpoints.

How it works:
1. Reads `X-API-Key` from headers.
2. Rejects missing header with `401`.
3. Uses service-layer validation (hash match, active state, expiration).
4. Returns the authenticated key record when valid.

### `POST /api/v1/api-keys`
```python
@router.post(
    "",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key(payload: ApiKeyCreate, db: Session = Depends(get_db)):
    service = ApiKeyService(db)
    api_key, raw_key = service.create_api_key(
        name=payload.name,
        expires_at=payload.expires_at,
        requests_per_minute=payload.requests_per_minute,
    )

    return {"api_key": api_key, "key": raw_key}
```

This endpoint creates a new API key record.

The flow is:
1. FastAPI validates the request body with `ApiKeyCreate`.
2. The route creates an `ApiKeyService` with the current DB session.
3. The service generates a raw key, hashes it, and stores the hashed form.
4. The route returns both the metadata and the one-time raw key.

Important detail:
- The raw key is shown once in this create response.
- The database still stores only the hash.
- Later reads (`GET`) do not return the raw key.

### `GET /api/v1/api-keys/{api_key_id}`
```python
@router.get("/{api_key_id}", response_model=ApiKeyRead)
def get_api_key(
    api_key_id: UUID,
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    api_key = db.query(ApiKey).filter(ApiKey.id == api_key_id).first()
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    return api_key
```

This endpoint reads one API key record by its UUID.

It requires a valid API key via `require_api_key()`.

It performs a direct database query instead of calling the service layer because the logic is simple: find one row and return it.

If the record does not exist, it raises a 404.

Why this matters:
- the API does not silently return `null`
- clients get an explicit and standard HTTP error
- the response contract stays predictable

### `PUT /api/v1/api-keys/{api_key_id}`
```python
@router.put("/{api_key_id}", response_model=ApiKeyRead)
def update_api_key(
    api_key_id: UUID,
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    api_key = db.query(ApiKey).filter(ApiKey.id == api_key_id).first()
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    api_key.name = payload.name
    api_key.expires_at = payload.expires_at
    api_key.requests_per_minute = payload.requests_per_minute
    api_key.updated_at = datetime.now(timezone.utc)

    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return api_key
```

This endpoint updates the editable fields of an API key.

The current implementation behaves like a full replacement update:
- `name`
- `expires_at`
- `requests_per_minute`

Why `PUT` can make sense here:
- the client sends the full set of mutable fields
- the existing row is replaced with those values

Why `PATCH` could also be argued for:
- many API key changes are partial in practice
- changing only one property is common

This route also sets `updated_at` manually.

The route uses `datetime.now(timezone.utc)`, which keeps timestamp writes timezone-aware.

### `DELETE /api/v1/api-keys/{api_key_id}`
```python
@router.delete("/{api_key_id}", response_model=ApiKeyRead)
def revoke_api_key(
    api_key_id: UUID,
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    api_key = db.query(ApiKey).filter(ApiKey.id == api_key_id).first()
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    service = ApiKeyService(db)
    api_key = service.revoke_api_key(api_key)
    return api_key
```

This endpoint revokes an API key.

It requires a valid API key via `require_api_key()`.

It does not physically delete the row.
Instead, it delegates to the service layer, which marks the key inactive.

Why this is useful:
- the key can no longer be used for authentication
- the record still exists for auditing
- usage history remains available

So this is really a soft delete or revocation endpoint, not a hard database delete.

## How it fits in the project
- `app/models/api_key.py` defines the database row.
- `app/schemas/api_key.py` defines safe request and response shapes.
- `app/services/api_key_service.py` performs key generation, hashing, and revocation.
- This route file exposes those behaviors over HTTP.

## Design notes
### Why the file is a router
Using an `APIRouter` keeps the API key feature isolated from the rest of the application.
That makes the code easier to maintain, test, and register in the main FastAPI app.

### Why the file uses both direct queries and service calls
This route file is thin by design.

Simple lookup operations are done directly with SQLAlchemy.
Security-sensitive or business-rule-heavy actions go through `ApiKeyService`.

### Why the response model is `ApiKeyRead`
The read, update, and revoke routes return only safe metadata.
`key_hash` and raw secrets are never exposed there.

The create route uses `ApiKeyCreateResponse` so the raw key can be returned once.

### Why HTTP verbs matter here
- `POST` creates a new key.
- `GET` reads one key.
- `PUT` updates key settings.
- `DELETE` revokes the key.

This keeps the API predictable and aligned with standard HTTP semantics.

## Current scope
This file defines the HTTP layer for API key management.
The router is registered in `app/main.py`, so these endpoints are reachable through the FastAPI app.

Security is now integrated at the route layer through `X-API-Key` validation on `GET`, `PUT`, and `DELETE`.