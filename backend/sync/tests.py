from unittest.mock import Mock, patch

from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime
import requests

from sync.evaluations import (
	_apply_evaluation_score_rows,
	_request_evaluations_page,
	sync_users_evaluations_done_total,
)
from sync.models import CampusUser, CampusUserScoreSnapshot, Coalition, CoalitionScoreSnapshot
from sync.projects import _apply_project_score_rows, sync_users_projects_delivered
from sync.score_snapshots_backfill import backfill_daily_score_snapshots


def _http_error(status_code):
	response = Mock(status_code=status_code)
	error = requests.HTTPError(response=response)
	error.response = response
	return error


class Sync404ToleranceTests(TestCase):
	def setUp(self):
		now = timezone.now()
		self.missing_user = CampusUser.objects.create(
			intra_id=1,
			user_id=1,
			login='missing-user',
			created_at=now,
			updated_at=now,
		)
		self.valid_user = CampusUser.objects.create(
			intra_id=2,
			user_id=2,
			login='valid-user',
			created_at=now,
			updated_at=now,
		)

	@patch('sync.projects._build_sync_context', return_value={'base_url': '', 'headers': {}, 'cursus_id': 21})
	@patch('sync.projects.fetch_user_projects_delivered_current_season')
	@patch('sync.projects.fetch_user_projects_delivered_total')
	def test_projects_sync_skips_missing_42_user(self, total_mock, current_season_mock, _ctx_mock):
		total_mock.side_effect = [_http_error(404), 7]
		current_season_mock.side_effect = [3]

		result = sync_users_projects_delivered(
			queryset=[self.missing_user, self.valid_user],
			request_interval=0,
		)

		self.missing_user.refresh_from_db()
		self.valid_user.refresh_from_db()

		self.assertEqual(result['processed'], 2)
		self.assertEqual(result['updated'], 1)
		self.assertEqual(result['skipped_missing'], 1)
		self.assertEqual(self.missing_user.projects_delivered_total, 0)
		self.assertIsNone(self.missing_user.projects_delivered_synced_at)
		self.assertEqual(self.valid_user.projects_delivered_total, 7)
		self.assertEqual(self.valid_user.projects_delivered_current_season, 3)
		self.assertIsNotNone(self.valid_user.projects_delivered_synced_at)

	@patch('sync.evaluations._build_sync_context', return_value={'base_url': '', 'headers': {}})
	@patch('sync.evaluations.fetch_user_evaluations_done_current_season')
	@patch('sync.evaluations.fetch_user_evaluations_done_total')
	def test_evaluations_sync_skips_missing_42_user(self, total_mock, current_season_mock, _ctx_mock):
		total_mock.side_effect = [_http_error(404), 11]
		current_season_mock.side_effect = [4]

		result = sync_users_evaluations_done_total(
			queryset=[self.missing_user, self.valid_user],
			request_interval=0,
		)

		self.missing_user.refresh_from_db()
		self.valid_user.refresh_from_db()

		self.assertEqual(result['processed'], 2)
		self.assertEqual(result['updated'], 1)
		self.assertEqual(result['skipped_missing'], 1)
		self.assertEqual(self.missing_user.evaluations_done_total, 0)
		self.assertIsNone(self.missing_user.evaluations_synced_at)
		self.assertEqual(self.valid_user.evaluations_done_total, 11)
		self.assertEqual(self.valid_user.evaluations_done_current_season, 4)
		self.assertIsNotNone(self.valid_user.evaluations_synced_at)


class EvaluationRequestRetryTests(TestCase):
	@patch('sync.evaluations.time.sleep')
	@patch('sync.evaluations.requests.get')
	def test_evaluation_page_retries_429_and_respects_retry_after(self, get_mock, sleep_mock):
		rate_limited_response = Mock(status_code=429, headers={'Retry-After': '0'})
		success_response = Mock(status_code=200, headers={})
		get_mock.side_effect = [rate_limited_response, success_response]

		response = _request_evaluations_page(
			login='valid-user',
			ctx={'base_url': 'https://api.intra.42.fr', 'headers': {'Authorization': 'Bearer token'}},
			request_interval=0,
		)

		self.assertIs(response, success_response)
		self.assertEqual(get_mock.call_count, 2)
		sleep_mock.assert_any_call(0)
		success_response.raise_for_status.assert_called_once()


class IncrementalSyncTimestampGuardTests(TestCase):
	def setUp(self):
		now = timezone.now()
		self.user = CampusUser.objects.create(
			intra_id=42,
			user_id=42,
			login='valid-user',
			coalitions_user_id=4242,
			evaluations_done_total=10,
			evaluations_done_current_season=1,
			evaluations_synced_at=parse_datetime('2026-05-17T10:00:00Z'),
			projects_delivered_total=5,
			projects_delivered_current_season=1,
			projects_delivered_synced_at=parse_datetime('2026-05-17T10:00:00Z'),
			created_at=now,
			updated_at=now,
		)

	def test_evaluation_incremental_skips_events_already_covered_by_user_sync(self):
		result = _apply_evaluation_score_rows([
			{
				'id': 1,
				'reason': 'You evaluated someone. Well done!',
				'coalitions_user_id': self.user.coalitions_user_id,
				'created_at': '2026-05-17T09:00:00Z',
			},
			{
				'id': 2,
				'reason': 'You evaluated someone. Well done!',
				'coalitions_user_id': self.user.coalitions_user_id,
				'created_at': '2026-05-17T11:00:00Z',
			},
		])

		self.user.refresh_from_db()

		self.assertEqual(result['evaluation_rows'], 1)
		self.assertEqual(result['updated_users'], 1)
		self.assertEqual(self.user.evaluations_done_total, 11)
		self.assertEqual(self.user.evaluations_done_current_season, 2)

	@patch('sync.projects._fetch_project_user')
	def test_project_incremental_skips_events_already_covered_by_user_sync(self, fetch_project_user_mock):
		fetch_project_user_mock.side_effect = [
			{
				'id': 1,
				'validated?': True,
				'cursus_ids': [21],
				'marked_at': '2026-05-17T09:00:00Z',
				'user': {'id': self.user.intra_id},
			},
			{
				'id': 2,
				'validated?': True,
				'cursus_ids': [21],
				'marked_at': '2026-05-17T11:00:00Z',
				'user': {'id': self.user.intra_id},
			},
		]

		result = _apply_project_score_rows(
			[
				{
					'id': 1,
					'reason': 'You validated a project. Congratulations!',
					'scoreable_type': 'ProjectsUser',
					'scoreable_id': 1,
					'created_at': '2026-05-17T09:00:00Z',
				},
				{
					'id': 2,
					'reason': 'You validated a project. Congratulations!',
					'scoreable_type': 'ProjectsUser',
					'scoreable_id': 2,
					'created_at': '2026-05-17T11:00:00Z',
				},
			],
			ctx={'base_url': 'https://api.intra.42.fr', 'headers': {}, 'cursus_id': 21},
			request_interval=0,
		)

		self.user.refresh_from_db()

		self.assertEqual(result['project_rows'], 2)
		self.assertEqual(result['updated_users'], 1)
		self.assertEqual(self.user.projects_delivered_total, 6)
		self.assertEqual(self.user.projects_delivered_current_season, 2)


class DailyScoreSnapshotsBackfillTests(TestCase):
	def setUp(self):
		now = timezone.now()
		self.alpha = Coalition.objects.create(coalition_id=1, name='Alpha', slug='alpha')
		self.beta = Coalition.objects.create(coalition_id=2, name='Beta', slug='marventis')
		self.user_a = CampusUser.objects.create(
			intra_id=10,
			user_id=10,
			login='user-a',
			coalition_id=self.alpha.coalition_id,
			coalitions_user_id=101,
			is_active=True,
			created_at=now,
			updated_at=now,
		)
		self.user_b = CampusUser.objects.create(
			intra_id=20,
			user_id=20,
			login='user-b',
			coalition_id=self.alpha.coalition_id,
			coalitions_user_id=102,
			is_active=True,
			created_at=now,
			updated_at=now,
		)
		self.user_c = CampusUser.objects.create(
			intra_id=30,
			user_id=30,
			login='user-c',
			coalition_id=self.beta.coalition_id,
			coalitions_user_id=201,
			is_active=True,
			created_at=now,
			updated_at=now,
		)

	@patch('sync.score_snapshots_backfill.get_request_count', return_value=2)
	@patch('sync.score_snapshots_backfill._build_sync_context', return_value={'base_url': '', 'headers': {}})
	@patch('sync.score_snapshots_backfill._collect_coalition_score_events')
	def test_backfill_reconstructs_daily_snapshots_with_carry_forward_and_ranks(self, collect_mock, _ctx_mock, _request_count_mock):
		collect_mock.side_effect = [
			[
				{
					'coalition_id': self.alpha.coalition_id,
					'coalitions_user_id': self.user_a.coalitions_user_id,
					'value': 10,
					'created_at': '2026-04-08T10:00:00Z',
				},
				{
					'coalition_id': self.alpha.coalition_id,
					'coalitions_user_id': self.user_b.coalitions_user_id,
					'value': 5,
					'created_at': '2026-04-08T16:00:00Z',
				},
				{
					'coalition_id': self.alpha.coalition_id,
					'coalitions_user_id': self.user_a.coalitions_user_id,
					'value': 5,
					'created_at': '2026-04-10T09:00:00Z',
				},
			],
			[
				{
					'coalition_id': self.beta.coalition_id,
					'coalitions_user_id': self.user_c.coalitions_user_id,
					'value': 20,
					'created_at': '2026-04-09T08:00:00Z',
				},
			],
		]

		result = backfill_daily_score_snapshots(
			start_date=parse_datetime('2026-04-08T00:00:00Z').date(),
			end_date=parse_datetime('2026-04-10T00:00:00Z').date(),
			request_interval=0,
		)

		self.assertEqual(result['processed_coalitions'], 2)
		self.assertEqual(result['processed_users'], 3)
		self.assertEqual(result['fetched_score_rows'], 4)
		self.assertEqual(CoalitionScoreSnapshot.objects.count(), 6)
		self.assertEqual(CampusUserScoreSnapshot.objects.count(), 9)

		alpha_day_1 = CoalitionScoreSnapshot.objects.get(coalition=self.alpha, snapshot_date='2026-04-08')
		beta_day_1 = CoalitionScoreSnapshot.objects.get(coalition=self.beta, snapshot_date='2026-04-08')
		alpha_day_2 = CoalitionScoreSnapshot.objects.get(coalition=self.alpha, snapshot_date='2026-04-09')
		beta_day_2 = CoalitionScoreSnapshot.objects.get(coalition=self.beta, snapshot_date='2026-04-09')
		alpha_day_3 = CoalitionScoreSnapshot.objects.get(coalition=self.alpha, snapshot_date='2026-04-10')
		beta_day_3 = CoalitionScoreSnapshot.objects.get(coalition=self.beta, snapshot_date='2026-04-10')

		self.assertEqual((alpha_day_1.total_score, alpha_day_1.campus_rank), (5, 2))
		self.assertEqual((beta_day_1.total_score, beta_day_1.campus_rank), (9500, 1))
		self.assertEqual((alpha_day_2.total_score, alpha_day_2.campus_rank), (5, 2))
		self.assertEqual((beta_day_2.total_score, beta_day_2.campus_rank), (9520, 1))
		self.assertEqual((alpha_day_3.total_score, alpha_day_3.campus_rank), (10, 2))
		self.assertEqual((beta_day_3.total_score, beta_day_3.campus_rank), (9520, 1))

		user_a_day_2 = CampusUserScoreSnapshot.objects.get(campus_user=self.user_a, snapshot_date='2026-04-09')
		user_b_day_2 = CampusUserScoreSnapshot.objects.get(campus_user=self.user_b, snapshot_date='2026-04-09')
		user_c_day_2 = CampusUserScoreSnapshot.objects.get(campus_user=self.user_c, snapshot_date='2026-04-09')
		user_a_day_3 = CampusUserScoreSnapshot.objects.get(campus_user=self.user_a, snapshot_date='2026-04-10')

		self.assertEqual(
			(user_a_day_2.coalition_user_score, user_a_day_2.coalition_user_rank, user_a_day_2.campus_user_rank),
			(0, 2, 3),
		)
		self.assertEqual(
			(user_b_day_2.coalition_user_score, user_b_day_2.coalition_user_rank, user_b_day_2.campus_user_rank),
			(5, 1, 2),
		)
		self.assertEqual(
			(user_c_day_2.coalition_user_score, user_c_day_2.coalition_user_rank, user_c_day_2.campus_user_rank),
			(20, 1, 1),
		)
		self.assertEqual(
			(user_a_day_3.coalition_user_score, user_a_day_3.coalition_user_rank, user_a_day_3.campus_user_rank),
			(5, 1, 2),
		)
