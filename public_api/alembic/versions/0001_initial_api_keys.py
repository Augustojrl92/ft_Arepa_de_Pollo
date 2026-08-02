"""initial api keys schema

Revision ID: 0001_initial_api_keys
Revises:
Create Date: 2026-04-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "0001_initial_api_keys"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "public_api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requests_per_minute", sa.Integer(), nullable=False, server_default=sa.text("60")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_public_api_keys_key_prefix", "public_api_keys", ["key_prefix"], unique=True)
    op.create_unique_constraint("uq_public_api_keys_key_hash", "public_api_keys", ["key_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_public_api_keys_key_hash", "public_api_keys", type_="unique")
    op.drop_index("ix_public_api_keys_key_prefix", table_name="public_api_keys")
    op.drop_table("public_api_keys")
