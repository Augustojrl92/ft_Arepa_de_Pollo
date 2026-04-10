from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyRead
from app.services.api_key_service import ApiKeyService

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
