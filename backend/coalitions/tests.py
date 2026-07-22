from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework_simplejwt.tokens import RefreshToken

from sync.models import Coalition, CoalitionScoreSnapshot


class CoalitionPointsHistoryViewTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username='tester', password='secret123')
		access_token = str(RefreshToken.for_user(self.user).access_token)
		self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'

		self.coalition = Coalition.objects.create(
			coalition_id=101,
			name='Marventis',
			slug='marventis',
			color='#00ffaa',
			total_score=12000,
		)
		CoalitionScoreSnapshot.objects.create(
			coalition=self.coalition,
			snapshot_date='2026-04-08',
			total_score=9500,
			campus_rank=1,
		)
		CoalitionScoreSnapshot.objects.create(
			coalition=self.coalition,
			snapshot_date='2026-04-09',
			total_score=10200,
			campus_rank=1,
		)

	def test_returns_points_history_payload(self):
		response = self.client.get('/api/coalitions/points-history/', {'coalition': 'marventis'})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['coalition']['slug'], 'marventis')
		self.assertEqual(
			response.json()['history'],
			[
				{'date': '2026-04-08', 'points': 9500, 'campus_rank': 1},
				{'date': '2026-04-09', 'points': 10200, 'campus_rank': 1},
			],
		)
