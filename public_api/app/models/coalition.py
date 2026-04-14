from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Coalition(Base):
    __tablename__ = "sync_coalition"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coalition_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    cover_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="", nullable=False)

    total_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    leader_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
