from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import _serialize_coalition_leaderboard, _serialize_simple_coalitions, _serialize_user_ranking


class CoalitionLeaderboardView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		return Response(
			{'coalitions': _serialize_coalition_leaderboard()},
			status=status.HTTP_200_OK,
		)

class CoalitionSimpleView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		coalition_slug = request.query_params.get('slug')

		if coalition_slug:
			coalition = _serialize_simple_coalitions(coalition_slug=coalition_slug)
			if coalition is None:
				return Response(
					{'error': 'Coalition not found'},
					status=status.HTTP_404_NOT_FOUND,
				)
			return Response({'coalition': coalition}, status=status.HTTP_200_OK)

		return Response(
			{'coalitions': _serialize_simple_coalitions()},
			status=status.HTTP_200_OK,
		)


class UserRankingView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		coalition_filter = request.query_params.get('coalition')
		return Response(
			{'users': _serialize_user_ranking(coalition_filter)},
			status=status.HTTP_200_OK,
		)
