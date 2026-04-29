from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CampusUser(Base):
    __tablename__ = "sync_campususer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    intra_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    login: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    level: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pool_month: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pool_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    wallet: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correction_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    coalition_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    coalition_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    coalition_slug: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    coalition_user_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    coalition_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    general_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
