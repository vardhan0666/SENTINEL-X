"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

Hand-written initial migration creating the full SENTINEL-X schema:
users, assets, rules, correlation_groups, events, detections,
anomaly_results, incidents, incident_events, incident_detections,
indicators, response_actions, audit_logs.

Table creation order respects foreign key dependencies.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("ADMIN", "ANALYST", "VIEWER", name="user_role"),
            nullable=False,
            server_default="VIEWER",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # --- assets ---
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hostname", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("asset_type", sa.String(64), nullable=True),
        sa.Column(
            "criticality",
            sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="asset_criticality"),
            nullable=False,
            server_default="MEDIUM",
        ),
        sa.Column("owner", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("hostname", name="uq_assets_hostname"),
    )
    op.create_index("ix_assets_hostname", "assets", ["hostname"])
    op.create_index("ix_assets_ip_address", "assets", ["ip_address"])

    # --- rules ---
    op.create_table(
        "rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rule_key", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("default_severity", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("threshold_config", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rule_key", name="uq_rules_rule_key"),
    )
    op.create_index("ix_rules_rule_key", "rules", ["rule_key"])
    op.create_index("ix_rules_category", "rules", ["category"])

    # --- correlation_groups ---
    op.create_table(
        "correlation_groups",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("correlation_key", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detection_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_correlation_groups_correlation_key", "correlation_groups", ["correlation_key"])

    # --- events ---
    op.create_table(
        "events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("event_type", sa.String(128), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("source_ip", sa.String(45), nullable=True),
        sa.Column("destination_ip", sa.String(45), nullable=True),
        sa.Column("source_port", sa.Integer(), nullable=True),
        sa.Column("destination_port", sa.Integer(), nullable=True),
        sa.Column("protocol", sa.String(16), nullable=True),
        sa.Column("username", sa.String(128), nullable=True),
        sa.Column("hostname", sa.String(255), nullable=True),
        sa.Column("process_name", sa.String(255), nullable=True),
        sa.Column("action", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), nullable=True),
        sa.Column("message", sa.String(1024), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.UniqueConstraint("event_id", name="uq_events_event_id"),
    )
    op.create_index("ix_events_event_id", "events", ["event_id"])
    op.create_index("ix_events_timestamp", "events", ["timestamp"])
    op.create_index("ix_events_source", "events", ["source"])
    op.create_index("ix_events_category", "events", ["category"])
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_severity", "events", ["severity"])
    op.create_index("ix_events_source_ip", "events", ["source_ip"])
    op.create_index("ix_events_destination_ip", "events", ["destination_ip"])
    op.create_index("ix_events_username", "events", ["username"])
    op.create_index("ix_events_hostname", "events", ["hostname"])
    op.create_index("ix_events_source_ip_timestamp", "events", ["source_ip", "timestamp"])
    op.create_index("ix_events_username_timestamp", "events", ["username", "timestamp"])
    op.create_index("ix_events_hostname_timestamp", "events", ["hostname", "timestamp"])

    # --- detections ---
    op.create_table(
        "detections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("rule_key", sa.String(64), sa.ForeignKey("rules.rule_key"), nullable=True),
        sa.Column(
            "detection_type",
            sa.Enum("RULE", "ML_ANOMALY", name="detection_type"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("reason", sa.String(2048), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("source_ip", sa.String(45), nullable=True),
        sa.Column("username", sa.String(128), nullable=True),
        sa.Column("hostname", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "correlation_group_id",
            sa.String(36),
            sa.ForeignKey("correlation_groups.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_detections_rule_key", "detections", ["rule_key"])
    op.create_index("ix_detections_category", "detections", ["category"])
    op.create_index("ix_detections_severity", "detections", ["severity"])
    op.create_index("ix_detections_source_ip", "detections", ["source_ip"])
    op.create_index("ix_detections_username", "detections", ["username"])
    op.create_index("ix_detections_hostname", "detections", ["hostname"])
    op.create_index("ix_detections_created_at", "detections", ["created_at"])
    op.create_index("ix_detections_correlation_group_id", "detections", ["correlation_group_id"])

    # --- anomaly_results ---
    op.create_table(
        "anomaly_results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_value", sa.String(255), nullable=False),
        sa.Column("feature_snapshot", sa.JSON(), nullable=True),
        sa.Column("anomaly_score", sa.Float(), nullable=False),
        sa.Column("is_anomalous", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("baseline_mean", sa.JSON(), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "detection_id",
            sa.String(36),
            sa.ForeignKey("detections.id"),
            nullable=True,
        ),
        sa.UniqueConstraint("detection_id", name="uq_anomaly_results_detection_id"),
    )
    op.create_index("ix_anomaly_results_entity_type", "anomaly_results", ["entity_type"])
    op.create_index("ix_anomaly_results_entity_value", "anomaly_results", ["entity_value"])
    op.create_index("ix_anomaly_results_computed_at", "anomaly_results", ["computed_at"])
    op.create_index("ix_anomaly_results_detection_id", "anomaly_results", ["detection_id"])

    # --- incidents ---
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum(
                "NEW", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE",
                name="incident_status",
            ),
            nullable=False,
            server_default="NEW",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "correlation_group_id",
            sa.String(36),
            sa.ForeignKey("correlation_groups.id"),
            nullable=True,
        ),
        sa.Column("explanation", sa.JSON(), nullable=True),
        sa.Column("recommended_actions", sa.JSON(), nullable=True),
        sa.Column("analyst_notes", sa.Text(), nullable=True),
        sa.Column("assigned_to", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_incidents_severity", "incidents", ["severity"])
    op.create_index("ix_incidents_status", "incidents", ["status"])
    op.create_index("ix_incidents_created_at", "incidents", ["created_at"])
    op.create_index("ix_incidents_correlation_group_id", "incidents", ["correlation_group_id"])

    # --- incident_events (association) ---
    op.create_table(
        "incident_events",
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id"), primary_key=True),
        sa.Column("event_id", sa.String(36), sa.ForeignKey("events.id"), primary_key=True),
    )

    # --- incident_detections (association) ---
    op.create_table(
        "incident_detections",
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id"), primary_key=True),
        sa.Column("detection_id", sa.String(36), sa.ForeignKey("detections.id"), primary_key=True),
    )

    # --- indicators ---
    op.create_table(
        "indicators",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "type",
            sa.Enum("IP", "DOMAIN", "HASH", "URL", name="indicator_type"),
            nullable=False,
        ),
        sa.Column("value", sa.String(512), nullable=False),
        sa.Column("risk_level", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source", sa.String(128), nullable=False, server_default="local-sample-feed"),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("type", "value", name="uq_indicator_type_value"),
    )
    op.create_index("ix_indicators_type", "indicators", ["type"])
    op.create_index("ix_indicators_value", "indicators", ["value"])

    # --- response_actions ---
    op.create_table(
        "response_actions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id"), nullable=False),
        sa.Column(
            "action_type",
            sa.Enum(
                "INVESTIGATE_SOURCE_IP", "REVIEW_AUTH_LOGS", "ISOLATE_ENDPOINT",
                "DISABLE_ACCOUNT", "ROTATE_CREDENTIALS", "BLOCK_INDICATOR",
                "INCREASE_MONITORING", "COLLECT_TELEMETRY",
                name="response_action_type",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("SIMULATED_SUCCESS", "SIMULATED_FAILED", name="response_action_status"),
            nullable=False,
        ),
        sa.Column("simulated", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("performed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_response_actions_incident_id", "response_actions", ["incident_id"])

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("response_actions")
    op.drop_table("indicators")
    op.drop_table("incident_detections")
    op.drop_table("incident_events")
    op.drop_table("incidents")
    op.drop_table("anomaly_results")
    op.drop_table("detections")
    op.drop_table("events")
    op.drop_table("correlation_groups")
    op.drop_table("rules")
    op.drop_table("assets")
    op.drop_table("users")

    # Explicitly drop enum types on PostgreSQL (SQLite ignores these calls
    # gracefully since it has no native enum type).
    bind = op.get_bind()
    for enum_name in (
        "response_action_status",
        "response_action_type",
        "indicator_type",
        "incident_status",
        "detection_type",
        "asset_criticality",
        "user_role",
    ):
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)