from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CoalitionScoreSnapshot(Base):
    __tablename__ = "sync_coalitionscoresnapshot"
    __table_args__ = (
        UniqueConstraint("coalition_id", "snapshot_date", name="sync_coalitionscoresnapshot_coalition_id_snapshot_date_key"),
        Index("sync_coalitionscoresnapshot_coalition_id_snapshot_date_idx", "coalition_id", "snapshot_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coalition_id: Mapped[int] = mapped_column(
        ForeignKey("sync_coalition.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    campus_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
