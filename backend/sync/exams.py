from django.utils.dateparse import parse_datetime

from .models import Coalition
from .projects import (
	CURRENT_SEASON_END_DT,
	CURRENT_SEASON_START_DT,
	_ensure_aware_datetime,
	_request_coalition_scores_page,
)
from .services import _build_sync_context


EXAM_SCORE_REASON = 'You validated an Exam. Congratulations!'


# Objective:
# Recalculate approved exam totals for the current season per coalition from score rows.
# Expects:
# - coalition_queryset: optional local coalition queryset; defaults to every synced coalition.
# - request_interval: delay between requests.
# - max_pages: optional safety limit for partial scans.
# - dry_run: calculate totals without writing them to the database.
# Returns:
# - A summary dict with processed coalitions, scanned score rows, exam rows, and updated coalitions.
def sync_coalition_exams_validated_current_season(coalition_queryset=None, request_interval=0.25, max_pages=None, dry_run=False):
	coalitions = coalition_queryset if coalition_queryset is not None else Coalition.objects.order_by('coalition_id')
	ctx = _build_sync_context()
	processed_coalitions = 0
	total_scanned_rows = 0
	total_exam_rows = 0
	coalitions_to_update = []

	for coalition in coalitions:
		page = 1
		exam_rows = 0

		while True:
			if max_pages is not None and page > max_pages:
				break

			page_rows = _request_coalition_scores_page(
				coalition_id=coalition.coalition_id,
				ctx=ctx,
				page=page,
				request_interval=request_interval,
			).json()

			if not page_rows:
				break

			reached_before_season = False
			for row in page_rows:
				created_at = parse_datetime(row.get('created_at'))
				if created_at is None:
					continue

				created_at = _ensure_aware_datetime(created_at)
				if created_at > CURRENT_SEASON_END_DT:
					total_scanned_rows += 1
					continue
				if created_at < CURRENT_SEASON_START_DT:
					reached_before_season = True
					break

				total_scanned_rows += 1
				if row.get('reason') == EXAM_SCORE_REASON:
					exam_rows += 1

			if reached_before_season:
				break

			page += 1

		processed_coalitions += 1
		total_exam_rows += exam_rows
		if coalition.exams_validated_current_season != exam_rows:
			coalition.exams_validated_current_season = exam_rows
			coalitions_to_update.append(coalition)

	if coalitions_to_update and not dry_run:
		Coalition.objects.bulk_update(coalitions_to_update, ['exams_validated_current_season'])

	return {
		'processed_coalitions': processed_coalitions,
		'scanned_rows': total_scanned_rows,
		'exam_rows': total_exam_rows,
		'updated_coalitions': len(coalitions_to_update),
	}
