from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CoalitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    coalition_id: int
    name: str
    slug: str
    image_url: str
    cover_url: str
    color: str
    total_score: int
    member_count: int
    active_member_count: int
    updated_at: datetime


class CoalitionListResponse(BaseModel):
    page: int = Field(ge=1)
    per_page: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    items: list[CoalitionRead]


class CoalitionTopMember(BaseModel):
    intra_id: int
    login: str
    display_name: str | None = None
    avatar_url: str | None = None
    coalition_user_score: int
    coalition_rank: int | None = None


class CoalitionLeaderSummary(BaseModel):
    intra_id: int | None = None
    login: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None


class CoalitionScoreTrends(BaseModel):
    change_24h: int
    change_7d: int
    change_30d: int


class CoalitionDetailRead(CoalitionRead):
    leader: CoalitionLeaderSummary | None = None
    score_trends: CoalitionScoreTrends
    top_members: list[CoalitionTopMember]
