from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.routes.api_keys import get_db, require_api_key
from app.models.api_key import ApiKey
from app.schemas.user import CoalitionSummary, UserDetailRead, UserListResponse, UserRead
from app.services.user_service import UserService

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _serialize_user(user) -> UserRead:
    coalition = None
    if user.coalition_id is not None or user.coalition_name is not None or user.coalition_slug is not None:
        coalition = CoalitionSummary(
            id=user.coalition_id,
            name=user.coalition_name,
            slug=user.coalition_slug,
        )

    payload = UserRead.model_validate(user)
    payload.coalition = coalition
    return payload


@router.get("", response_model=UserListResponse)
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    coalition: str | None = Query(None),
    level_min: float | None = Query(None),
    level_max: float | None = Query(None),
    is_active: bool | None = Query(None),
    sort_by: str = Query("-coalition_user_score"),
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    if level_min is not None and level_max is not None and level_min > level_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="level_min cannot be greater than level_max",
        )

    service = UserService(db)
    try:
        items, total, total_pages = service.list_users(
            page=page,
            per_page=per_page,
            coalition=coalition,
            level_min=level_min,
            level_max=level_max,
            is_active=is_active,
            sort_by=sort_by,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return UserListResponse(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
        items=[_serialize_user(user) for user in items],
    )


@router.get("/{intra_id}", response_model=UserDetailRead)
def get_user(
    intra_id: int,
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    service = UserService(db)
    user = service.get_user_by_intra_id(intra_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    coalition = None
    if user.coalition_id is not None or user.coalition_name is not None or user.coalition_slug is not None:
        coalition = CoalitionSummary(
            id=user.coalition_id,
            name=user.coalition_name,
            slug=user.coalition_slug,
        )

    payload = UserDetailRead.model_validate(user)
    payload.coalition = coalition
    return payload
