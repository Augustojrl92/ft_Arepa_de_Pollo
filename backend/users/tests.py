from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from sync.models import CampusUser, CampusUserScoreSnapshot


class UserPointsHistoryViewTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username='tester', password='secret123')
		access_token = str(RefreshToken.for_user(self.user).access_token)
		self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'

		self.campus_user = CampusUser.objects.create(
			django_user=self.user,
			intra_id=42,
			user_id=42,
			level=5.5,
			login='tester',
			email='tester@example.com',
			display_name='Tester User',
			avatar_url='https://example.com/avatar.jpg',
			coalition_id=401,
			coalitions_user_id=9001,
			coalition_name='Zefiria',
			coalition_slug='zefiria',
			coalition_user_score=1500,
			coalition_rank=3,
			general_rank=10,
			created_at=timezone.make_aware(timezone.datetime(2026, 4, 8, 12, 0, 0)),
			updated_at=timezone.make_aware(timezone.datetime(2026, 4, 9, 12, 0, 0)),
		)
		CampusUserScoreSnapshot.objects.create(
			campus_user=self.campus_user,
			snapshot_date='2026-04-08',
			coalition_user_score=1200,
			coalition_user_rank=4,
			campus_user_rank=12,
		)
		CampusUserScoreSnapshot.objects.create(
			campus_user=self.campus_user,
			snapshot_date='2026-04-09',
			coalition_user_score=1500,
			coalition_user_rank=3,
			campus_user_rank=10,
		)

	def test_returns_points_history_payload(self):
		response = self.client.get('/api/users/points-history/', {'login': 'tester'})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['user']['login'], 'tester')
		self.assertEqual(
			response.json()['history'],
			[
				{'date': '2026-04-08', 'points': 1200, 'coalition_rank': 4, 'campus_rank': 12},
				{'date': '2026-04-09', 'points': 1500, 'coalition_rank': 3, 'campus_rank': 10},
			],
		)
