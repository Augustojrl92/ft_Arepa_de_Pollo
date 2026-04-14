from math import ceil

from sqlalchemy.orm import Session

from app.models.campus_user import CampusUser


class UserService:
    VALID_SORT_FIELDS = {
        "intra_id": CampusUser.intra_id,
        "login": CampusUser.login,
        "level": CampusUser.level,
        "coalition_user_score": CampusUser.coalition_user_score,
        "coalition_rank": CampusUser.coalition_rank,
        "general_rank": CampusUser.general_rank,
        "updated_at": CampusUser.updated_at,
    }

    def __init__(self, db: Session):
        self.db = db

    def list_users(
        self,
        *,
        page: int,
        per_page: int,
        coalition: str | None,
        level_min: float | None,
        level_max: float | None,
        is_active: bool | None,
        sort_by: str,
    ) -> tuple[list[CampusUser], int, int]:
        query = self.db.query(CampusUser)

        if coalition:
            query = query.filter(CampusUser.coalition_slug == coalition)
        if level_min is not None:
            query = query.filter(CampusUser.level >= level_min)
        if level_max is not None:
            query = query.filter(CampusUser.level <= level_max)
        if is_active is not None:
            query = query.filter(CampusUser.is_active == is_active)

        total = query.count()

        descending = sort_by.startswith("-")
        sort_field_name = sort_by[1:] if descending else sort_by
        sort_field = self.VALID_SORT_FIELDS.get(sort_field_name)
        if sort_field is None:
            raise ValueError(f"Unsupported sort field: {sort_by}")

        query = query.order_by(sort_field.desc() if descending else sort_field.asc())

        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()
        total_pages = ceil(total / per_page) if total else 0

        return items, total, total_pages

    def get_user_by_intra_id(self, intra_id: int) -> CampusUser | None:
        return (
            self.db.query(CampusUser)
            .filter(CampusUser.intra_id == intra_id)
            .first()
        )
