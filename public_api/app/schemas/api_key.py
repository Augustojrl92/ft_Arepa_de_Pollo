from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    expires_at: datetime | None = None
    requests_per_minute: int = Field(default=60, ge=1)


class ApiKeyCreate(ApiKeyBase):
    pass


class ApiKeyRead(ApiKeyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    key_prefix: str
    is_active: bool
    last_used_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

class ApiKeyCreateResponse(BaseModel):
    api_key: ApiKeyRead
    key: str