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
from sync.models import CampusUser
from sync.projects import _apply_project_score_rows, sync_users_projects_delivered


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
