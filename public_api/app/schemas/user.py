from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CoalitionSummary(BaseModel):
    id: int | None = None
    name: str | None = None
    slug: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    intra_id: int
    login: str
    display_name: str | None = None
    avatar_url: str | None = None
    level: float
    is_active: bool
    coalition_user_score: int | None = None
    coalition_rank: int | None = None
    general_rank: int | None = None
    coalition: CoalitionSummary | None = None


class UserListResponse(BaseModel):
    page: int = Field(ge=1)
    per_page: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    items: list[UserRead]


class UserDetailRead(UserRead):
    email: str | None = None
    grade: str | None = None
    pool_month: str | None = None
    pool_year: int | None = None
    wallet: int
    correction_points: int
    created_at: datetime
    updated_at: datetime
