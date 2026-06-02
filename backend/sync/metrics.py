from django.utils import timezone
from prometheus_client import Gauge

from .models import CampusUserScoreSnapshot, CoalitionScoreSnapshot, SyncMetadata
from .season import CURRENT_SEASON_START_DATE


coalition_score_snapshots_total = Gauge(
    "coalition_score_snapshots_total",
    "Current total number of coalition score snapshots stored in the database.",
)

campus_user_score_snapshots_total = Gauge(
    "campus_user_score_snapshots_total",
    "Current total number of campus user score snapshots stored in the database.",
)

campus_sync_last_update_timestamp = Gauge(
    "campus_sync_last_update_timestamp",
    "Unix timestamp of the last successful campus sync update.",
)

season_days_covered_total = Gauge(
    "season_days_covered_total",
    "Number of unique coalition snapshot dates covered since the current season start date.",
)

season_days_missing_total = Gauge(
    "season_days_missing_total",
    "Number of season days missing coalition snapshots between the current season start date and today.",
)


def update_coalition_score_snapshots_total():
    coalition_score_snapshots_total.set(CoalitionScoreSnapshot.objects.count())


def update_campus_user_score_snapshots_total():
    campus_user_score_snapshots_total.set(CampusUserScoreSnapshot.objects.count())


def update_campus_sync_last_update_timestamp():
    metadata = SyncMetadata.objects.filter(key='campus_sync').only('last_time_update').first()
    if metadata is None or metadata.last_time_update is None:
        campus_sync_last_update_timestamp.set(0)
        return

    campus_sync_last_update_timestamp.set(metadata.last_time_update.timestamp())


def update_season_days_covered_total():
    covered_days = (
        CoalitionScoreSnapshot.objects.filter(snapshot_date__gte=CURRENT_SEASON_START_DATE)
        .values('snapshot_date')
        .distinct()
        .count()
    )
    season_days_covered_total.set(covered_days)


def update_season_days_missing_total():
    today = timezone.localdate()
    expected_days = max((today - CURRENT_SEASON_START_DATE).days + 1, 0)
    covered_days = (
        CoalitionScoreSnapshot.objects.filter(snapshot_date__gte=CURRENT_SEASON_START_DATE)
        .values('snapshot_date')
        .distinct()
        .count()
    )
    missing_days = max(expected_days - covered_days, 0)
    season_days_missing_total.set(missing_days)
