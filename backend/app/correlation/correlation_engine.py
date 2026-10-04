"""
Correlation engine.

Groups related Detection rows into CorrelationGroup chains based on shared
source IP, username, or hostname within a configurable time window (e.g.
turning "15 failed logins" + "1 successful login" + "1 new privileged
process" into a single correlated chain, rather than three unrelated
alerts).

A CorrelationGroup is only created once at least one other related
detection is found; a detection with no related activity remains
ungrouped (correlation_group_id stays None) — correlation exists to
describe multi-step activity, not to wrap every single alert in a group
of one.
"""
import logging
from datetime import timedelta
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager
from app.correlation.correlation_rules import derive_correlation_title
from app.models.detection import CorrelationGroup, Detection

logger = logging.getLogger("sentinelx.correlation")

DEFAULT_CORRELATION_WINDOW_SECONDS = 900  # 15 minutes


async def correlate_detection(
    db: AsyncSession,
    detection: Detection,
    window_seconds: int = DEFAULT_CORRELATION_WINDOW_SECONDS,
) -> Optional[CorrelationGroup]:
    """
    Attempt to correlate `detection` (already persisted, with
    correlation_group_id still None) with recent related detections.

    Returns the CorrelationGroup the detection was placed in, or None if
    no related activity was found within the window.
    """
    conditions = []
    if detection.source_ip:
        conditions.append(Detection.source_ip == detection.source_ip)
    if detection.username:
        conditions.append(Detection.username == detection.username)
    if detection.hostname:
        conditions.append(Detection.hostname == detection.hostname)

    if not conditions:
        return None

    window_start = detection.created_at - timedelta(seconds=window_seconds)

    query = (
        select(Detection)
        .where(
            Detection.id != detection.id,
            Detection.created_at >= window_start,
            Detection.created_at <= detection.created_at,
            or_(*conditions),
        )
        .order_by(Detection.created_at.desc())
    )
    related = list((await db.execute(query)).scalars().all())

    if not related:
        return None

    existing_group_id = next((d.correlation_group_id for d in related if d.correlation_group_id), None)

    if existing_group_id:
        group = await db.get(CorrelationGroup, existing_group_id)
        if group is not None:
            group.last_seen = detection.created_at
            group.detection_count += 1
            detection.correlation_group_id = group.id
            await db.commit()
            await db.refresh(group)
            await _broadcast_correlation_update(group)
            return group

    all_related_detections = related + [detection]
    title = derive_correlation_title(all_related_detections)

    group = CorrelationGroup(
        correlation_key=_build_correlation_key(detection),
        title=title,
        first_seen=min(d.created_at for d in all_related_detections),
        last_seen=detection.created_at,
        detection_count=len(all_related_detections),
    )
    db.add(group)
    await db.flush()  # populate group.id before assigning it to detections

    detection.correlation_group_id = group.id
    for related_detection in related:
        if not related_detection.correlation_group_id:
            related_detection.correlation_group_id = group.id

    await db.commit()
    await db.refresh(group)

    logger.info(
        "Created correlation group %s ('%s') with %d detections.",
        group.id, group.title, group.detection_count,
    )

    await _broadcast_correlation_update(group)
    return group


def _build_correlation_key(detection: Detection) -> str:
    if detection.username:
        return f"username:{detection.username}"
    if detection.source_ip:
        return f"source_ip:{detection.source_ip}"
    return f"hostname:{detection.hostname}"


async def _broadcast_correlation_update(group: CorrelationGroup) -> None:
    await manager.broadcast(
        {
            "type": "correlation.updated",
            "data": {
                "id": group.id,
                "correlation_key": group.correlation_key,
                "title": group.title,
                "detection_count": group.detection_count,
                "first_seen": group.first_seen.isoformat(),
                "last_seen": group.last_seen.isoformat(),
            },
        }
    )