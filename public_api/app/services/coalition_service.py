from datetime import date, timedelta
from math import ceil

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.campus_user import CampusUser
from app.models.coalition import Coalition
from app.models.coalition_score_snapshot import CoalitionScoreSnapshot


class CoalitionService:
    VALID_SORT_FIELDS = {
        "coalition_id": Coalition.coalition_id,
        "name": Coalition.name,
        "total_score": Coalition.total_score,
        "updated_at": Coalition.updated_at,
    }

    def __init__(self, db: Session):
        self.db = db

    def list_coalitions(self, *, page: int, per_page: int, sort_by: str):
        descending = sort_by.startswith("-")
        sort_field_name = sort_by[1:] if descending else sort_by
        sort_field = self.VALID_SORT_FIELDS.get(sort_field_name)
        if sort_field is None:
            raise ValueError(f"Unsupported sort field: {sort_by}")

        counts_subquery = (
            self.db.query(
                CampusUser.coalition_id.label("coalition_id"),
                func.count(CampusUser.id).label("member_count"),
                func.sum(case((CampusUser.is_active.is_(True), 1), else_=0)).label("active_member_count"),
            )
            .group_by(CampusUser.coalition_id)
            .subquery()
        )

        query = (
            self.db.query(
                Coalition,
                func.coalesce(counts_subquery.c.member_count, 0),
                func.coalesce(counts_subquery.c.active_member_count, 0),
            )
            .outerjoin(counts_subquery, counts_subquery.c.coalition_id == Coalition.coalition_id)
            .order_by(sort_field.desc() if descending else sort_field.asc())
        )

        total = self.db.query(Coalition).count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        total_pages = ceil(total / per_page) if total else 0
        return items, total, total_pages

    def get_coalition_by_id(self, coalition_id: int) -> Coalition | None:
        return self.db.query(Coalition).filter(Coalition.coalition_id == coalition_id).first()

    def get_member_counts(self, coalition_id: int) -> tuple[int, int]:
        row = (
            self.db.query(
                func.count(CampusUser.id).label("member_count"),
                func.sum(case((CampusUser.is_active.is_(True), 1), else_=0)).label("active_member_count"),
            )
            .filter(CampusUser.coalition_id == coalition_id)
            .first()
        )
        return int(row.member_count or 0), int(row.active_member_count or 0)

    def get_top_members(self, coalition_id: int, limit: int = 3) -> list[CampusUser]:
        return (
            self.db.query(CampusUser)
            .filter(CampusUser.coalition_id == coalition_id)
            .order_by(CampusUser.coalition_user_score.desc(), CampusUser.intra_id.asc())
            .limit(limit)
            .all()
        )

    def get_leader(self, leader_user_id: int | None) -> CampusUser | None:
        if leader_user_id is None:
            return None
        return self.db.query(CampusUser).filter(CampusUser.intra_id == leader_user_id).first()

    def _latest_snapshot_before(self, coalition_pk_id: int, target_date: date) -> CoalitionScoreSnapshot | None:
        return (
            self.db.query(CoalitionScoreSnapshot)
            .filter(
                CoalitionScoreSnapshot.coalition_id == coalition_pk_id,
                CoalitionScoreSnapshot.snapshot_date <= target_date,
            )
            .order_by(CoalitionScoreSnapshot.snapshot_date.desc())
            .first()
        )

    def get_score_trends(self, coalition: Coalition) -> tuple[int, int, int]:
        today = date.today()
        prev_1d = self._latest_snapshot_before(coalition.id, today - timedelta(days=1))
        prev_7d = self._latest_snapshot_before(coalition.id, today - timedelta(days=7))
        prev_30d = self._latest_snapshot_before(coalition.id, today - timedelta(days=30))

        change_24h = coalition.total_score - int(prev_1d.total_score) if prev_1d else 0
        change_7d = coalition.total_score - int(prev_7d.total_score) if prev_7d else 0
        change_30d = coalition.total_score - int(prev_30d.total_score) if prev_30d else 0
        return change_24h, change_7d, change_30d
