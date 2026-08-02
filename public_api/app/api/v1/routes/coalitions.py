from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.routes.api_keys import get_db, require_api_key
from app.models.api_key import ApiKey
from app.schemas.coalition import (
    CoalitionDetailRead,
    CoalitionLeaderSummary,
    CoalitionListResponse,
    CoalitionRead,
    CoalitionScoreTrends,
    CoalitionTopMember,
)
from app.services.coalition_service import CoalitionService

router = APIRouter(prefix="/api/v1/coalitions", tags=["coalitions"])


@router.get("", response_model=CoalitionListResponse)
def list_coalitions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    sort_by: str = Query("-total_score"),
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    service = CoalitionService(db)
    try:
        rows, total, total_pages = service.list_coalitions(page=page, per_page=per_page, sort_by=sort_by)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    items: list[CoalitionRead] = []
    for coalition, member_count, active_member_count in rows:
        item = CoalitionRead.model_validate(coalition)
        item.member_count = int(member_count)
        item.active_member_count = int(active_member_count)
        items.append(item)

    return CoalitionListResponse(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
        items=items,
    )


@router.get("/{coalition_id}", response_model=CoalitionDetailRead)
def get_coalition(
    coalition_id: int,
    db: Session = Depends(get_db),
    _current_key: ApiKey = Depends(require_api_key),
):
    service = CoalitionService(db)
    coalition = service.get_coalition_by_id(coalition_id)
    if coalition is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coalition not found")

    member_count, active_member_count = service.get_member_counts(coalition_id)
    top_members = service.get_top_members(coalition_id, limit=3)
    leader = service.get_leader(coalition.leader_user_id)
    change_24h, change_7d, change_30d = service.get_score_trends(coalition)

    payload = CoalitionDetailRead.model_validate(coalition)
    payload.member_count = member_count
    payload.active_member_count = active_member_count
    payload.score_trends = CoalitionScoreTrends(
        change_24h=change_24h,
        change_7d=change_7d,
        change_30d=change_30d,
    )
    payload.top_members = [
        CoalitionTopMember(
            intra_id=member.intra_id,
            login=member.login,
            display_name=member.display_name,
            avatar_url=member.avatar_url,
            coalition_user_score=int(member.coalition_user_score or 0),
            coalition_rank=member.coalition_rank,
        )
        for member in top_members
    ]
    payload.leader = (
        CoalitionLeaderSummary(
            intra_id=leader.intra_id,
            login=leader.login,
            display_name=leader.display_name,
            avatar_url=leader.avatar_url,
        )
        if leader
        else None
    )
    return payload
