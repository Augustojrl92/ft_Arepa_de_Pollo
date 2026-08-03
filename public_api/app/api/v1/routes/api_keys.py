from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyRead
from app.services.api_key_service import ApiKeyService
from app.services.rate_limit_service import (
    RateLimitExceeded,
    RateLimitService,
    RateLimitUnavailable,
)

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
rate_limiter = RateLimitService(
    redis_url=settings.redis_url,
    window_seconds=settings.rate_limit_window_seconds,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_api_key(
    request: Request,
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

    try:
        usage = rate_limiter.enforce(api_key)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Rate limit exceeded: {exc.limit} requests per "
                f"{exc.window_seconds} seconds"
            ),
            headers={
                "Retry-After": str(exc.retry_after),
                "X-RateLimit-Limit": str(exc.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(exc.retry_after),
            },
        ) from exc
    except RateLimitUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Rate limiter unavailable",
        ) from exc

    request.state.api_key = api_key
    request.state.rate_limit = usage

    return api_key


@router.post(
    "",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    service = ApiKeyService(db)
    api_key, raw_key = service.create_api_key(
        name=payload.name,
        expires_at=payload.expires_at,
        requests_per_minute=payload.requests_per_minute,
    )

    return {"api_key": api_key, "key": raw_key}


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
