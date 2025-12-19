"""add activities table

Revision ID: 154f7bd78237
Revises: c7c2c13b6a9e
Create Date: 2025-12-13 09:24:56.445545

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "154f7bd78237"
down_revision = "c7c2c13b6a9e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    activity_status = postgresql.ENUM(
        "todo",
        "in-progress",
        "review",
        "done",
        name="activity_status",
        create_type=False,
    )
    activity_priority = postgresql.ENUM(
        "low",
        "medium",
        "high",
        name="activity_priority",
        create_type=False,
    )
    activity_recurrence = postgresql.ENUM(
        "daily",
        "weekly",
        "monthly",
        name="activity_recurrence",
        create_type=False,
    )

    bind = op.get_bind()
    activity_status.create(bind, checkfirst=True)
    activity_priority.create(bind, checkfirst=True)
    activity_recurrence.create(bind, checkfirst=True)

    op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            activity_status,
            nullable=False,
            server_default=sa.text("'todo'::activity_status"),
        ),
        sa.Column(
            "priority",
            activity_priority,
            nullable=False,
            server_default=sa.text("'medium'::activity_priority"),
        ),
        sa.Column("assigned_to_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("labels", sa.Text(), nullable=True, comment="Comma-separated labels"),
        sa.Column("recurrence", activity_recurrence, nullable=True),
        sa.Column(
            "reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Enable reminders for this activity",
        ),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_activities_title", "activities", ["title"], unique=False)
    op.create_index("ix_activities_status", "activities", ["status"], unique=False)
    op.create_index("ix_activities_priority", "activities", ["priority"], unique=False)
    op.create_index("ix_activities_due_date", "activities", ["due_date"], unique=False)
    op.create_index(
        "ix_activities_assigned_to_id",
        "activities",
        ["assigned_to_id"],
        unique=False,
    )
    op.create_index(
        "ix_activities_created_by_id",
        "activities",
        ["created_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_activities_created_by_id", table_name="activities")
    op.drop_index("ix_activities_assigned_to_id", table_name="activities")
    op.drop_index("ix_activities_due_date", table_name="activities")
    op.drop_index("ix_activities_priority", table_name="activities")
    op.drop_index("ix_activities_status", table_name="activities")
    op.drop_index("ix_activities_title", table_name="activities")
    op.drop_table("activities")

    activity_recurrence = postgresql.ENUM(
        "daily",
        "weekly",
        "monthly",
        name="activity_recurrence",
    )
    activity_priority = postgresql.ENUM(
        "low",
        "medium",
        "high",
        name="activity_priority",
    )
    activity_status = postgresql.ENUM(
        "todo",
        "in-progress",
        "review",
        "done",
        name="activity_status",
    )

    bind = op.get_bind()
    activity_recurrence.drop(bind, checkfirst=True)
    activity_priority.drop(bind, checkfirst=True)
    activity_status.drop(bind, checkfirst=True)
